import {
  ConnectionStatus,
  DataSourceStatus,
  Prisma,
  TransactionStatus,
  type PrismaClient,
} from "@prisma/client";
import { plaidProviderIdentityKey } from "./account-identity";

type DatabaseClient = PrismaClient;
type TransactionClient = Prisma.TransactionClient;

export type PlaidAccountRepairReport = {
  ownerId: string;
  dryRun: boolean;
  accountsBefore: number;
  accountsAfter: number;
  duplicateGroups: number;
  accountsMerged: number;
  transactionsPreserved: number;
  duplicateTransactionsCanceled: number;
  recurringStreamsPreserved: number;
  duplicateStreamsDeactivated: number;
  calendarEventsPreserved: number;
  connectionsRetired: number;
};

class DryRunRollback extends Error {
  constructor(public readonly report: PlaidAccountRepairReport) {
    super("Roll back Plaid account repair dry run");
  }
}

function jsonSnapshot(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(
    JSON.stringify(value, (_key, candidate) =>
      candidate instanceof Prisma.Decimal ? candidate.toString() : candidate,
    ),
  ) as Prisma.InputJsonValue;
}

function storedIdentityKey(account: {
  institutionConnection: { institutionId: string | null };
  mask: string | null;
  name: string;
  officialName: string | null;
  accountType: string;
  accountSubtype: string | null;
  currency: string;
}) {
  return plaidProviderIdentityKey({
    institutionId: account.institutionConnection.institutionId,
    mask: account.mask,
    name: account.name,
    officialName: account.officialName,
    type: account.accountType,
    subtype: account.accountSubtype,
    currency: account.currency,
  });
}

function transactionFingerprint(transaction: {
  originalName: string;
  merchantName: string | null;
  amount: Prisma.Decimal;
  currency: string;
  authorizedAt: Date | null;
  postedAt: Date | null;
  status: TransactionStatus;
}) {
  return JSON.stringify({
    originalName: transaction.originalName,
    merchantName: transaction.merchantName,
    amount: transaction.amount.toString(),
    currency: transaction.currency,
    authorizedAt: transaction.authorizedAt?.toISOString() ?? null,
    postedAt: transaction.postedAt?.toISOString() ?? null,
    status: transaction.status,
  });
}

function streamFingerprint(stream: {
  typicalAccountId: string | null;
  merchantName: string | null;
  description: string;
  flowType: string;
  frequency: string;
  averageAmount: Prisma.Decimal;
  firstDate: Date;
  lastDate: Date;
}) {
  return JSON.stringify({
    typicalAccountId: stream.typicalAccountId,
    merchantName: stream.merchantName?.toLocaleLowerCase("en-US") ?? null,
    description: stream.description.toLocaleLowerCase("en-US"),
    flowType: stream.flowType,
    frequency: stream.frequency,
    averageAmount: stream.averageAmount.toString(),
    firstDate: stream.firstDate.toISOString(),
    lastDate: stream.lastDate.toISOString(),
  });
}

async function preserveProviderLink(
  tx: TransactionClient,
  account: {
    id: string;
    userId: string;
    providerAccountId: string | null;
    institutionConnectionId: string | null;
    institutionConnection: { provider: string };
  },
  identityKey: string,
  now: Date,
) {
  if (!account.providerAccountId || !account.institutionConnectionId) return;
  await tx.providerAccountLink.upsert({
    where: {
      userId_provider_providerAccountId: {
        userId: account.userId,
        provider: account.institutionConnection.provider,
        providerAccountId: account.providerAccountId,
      },
    },
    update: {
      accountId: account.id,
      institutionConnectionId: account.institutionConnectionId,
      logicalIdentityKey: identityKey,
      lastSeenAt: now,
    },
    create: {
      userId: account.userId,
      provider: account.institutionConnection.provider,
      providerAccountId: account.providerAccountId,
      logicalIdentityKey: identityKey,
      accountId: account.id,
      institutionConnectionId: account.institutionConnectionId,
      firstSeenAt: account.id.startsWith("seed_") ? now : undefined,
      lastSeenAt: now,
    },
  });
}

async function moveSnapshots(
  tx: TransactionClient,
  canonicalAccountId: string,
  duplicateAccountId: string,
) {
  const balanceSnapshots = await tx.balanceSnapshot.findMany({
    where: { accountId: duplicateAccountId },
  });
  for (const snapshot of balanceSnapshots) {
    const conflict = await tx.balanceSnapshot.findUnique({
      where: {
        accountId_capturedAt: {
          accountId: canonicalAccountId,
          capturedAt: snapshot.capturedAt,
        },
      },
    });
    if (!conflict) {
      await tx.balanceSnapshot.update({
        where: { id: snapshot.id },
        data: { accountId: canonicalAccountId },
      });
    } else if (
      !conflict.currentBalance.equals(snapshot.currentBalance) ||
      conflict.availableBalance?.toString() !==
        snapshot.availableBalance?.toString()
    ) {
      throw new Error("PLAID_ACCOUNT_REPAIR_SNAPSHOT_CONFLICT");
    } else {
      await tx.balanceSnapshot.delete({ where: { id: snapshot.id } });
    }
  }

  const investmentSnapshots = await tx.investmentBalanceSnapshot.findMany({
    where: { accountId: duplicateAccountId },
  });
  for (const snapshot of investmentSnapshots) {
    const conflict = await tx.investmentBalanceSnapshot.findUnique({
      where: {
        accountId_source_asOfDate: {
          accountId: canonicalAccountId,
          source: snapshot.source,
          asOfDate: snapshot.asOfDate,
        },
      },
    });
    if (!conflict) {
      await tx.investmentBalanceSnapshot.update({
        where: { id: snapshot.id },
        data: { accountId: canonicalAccountId },
      });
    } else if (
      !conflict.totalValue.equals(snapshot.totalValue) ||
      conflict.vestedValue?.toString() !== snapshot.vestedValue?.toString()
    ) {
      throw new Error("PLAID_ACCOUNT_REPAIR_SNAPSHOT_CONFLICT");
    } else {
      await tx.investmentBalanceSnapshot.delete({
        where: { id: snapshot.id },
      });
    }
  }

  const investmentTransactions = await tx.investmentTransaction.findMany({
    where: { accountId: duplicateAccountId },
  });
  for (const transaction of investmentTransactions) {
    const conflict = transaction.providerInvestmentTransactionId
      ? await tx.investmentTransaction.findUnique({
          where: {
            accountId_providerInvestmentTransactionId: {
              accountId: canonicalAccountId,
              providerInvestmentTransactionId:
                transaction.providerInvestmentTransactionId,
            },
          },
        })
      : null;
    if (conflict)
      throw new Error("PLAID_ACCOUNT_REPAIR_INVESTMENT_TRANSACTION_CONFLICT");
    await tx.investmentTransaction.update({
      where: { id: transaction.id },
      data: { accountId: canonicalAccountId },
    });
  }
}

async function consolidateTransactions(
  tx: TransactionClient,
  accountId: string,
  now: Date,
) {
  const transactions = await tx.transaction.findMany({
    where: { accountId },
    include: { override: true },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
  const groups = new Map<string, typeof transactions>();
  for (const transaction of transactions) {
    if (transaction.status === TransactionStatus.CANCELED) continue;
    const key = transactionFingerprint(transaction);
    groups.set(key, [...(groups.get(key) ?? []), transaction]);
  }

  let canceled = 0;
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const [keeper, ...duplicates] = group;
    for (const duplicate of duplicates) {
      if (duplicate.override && !keeper.override) {
        await tx.transactionOverride.update({
          where: { id: duplicate.override.id },
          data: { transactionId: keeper.id },
        });
      }
      await tx.transactionOverride.updateMany({
        where: { linkedTransactionId: duplicate.id },
        data: { linkedTransactionId: keeper.id },
      });
      await tx.transaction.updateMany({
        where: { pendingTransactionId: duplicate.id },
        data: { pendingTransactionId: keeper.id },
      });
      const keeperAlreadyMatched = await tx.calendarEvent.findFirst({
        where: { userId: keeper.userId, linkedTransactionId: keeper.id },
        select: { id: true },
      });
      if (!keeperAlreadyMatched) {
        await tx.calendarEvent.updateMany({
          where: { linkedTransactionId: duplicate.id },
          data: { linkedTransactionId: keeper.id },
        });
      }
      await tx.transaction.update({
        where: { id: duplicate.id },
        data: { status: TransactionStatus.CANCELED, removedAt: now },
      });
      canceled += 1;
    }
  }
  return canceled;
}

async function deactivateDuplicateStreams(
  tx: TransactionClient,
  ownerId: string,
) {
  const streams = await tx.recurringStream.findMany({
    where: {
      userId: ownerId,
      typicalAccount: {
        providerIdentityKey: { startsWith: "plaid:v1:" },
      },
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  const groups = new Map<string, typeof streams>();
  for (const stream of streams) {
    if (!stream.isActive) continue;
    const key = streamFingerprint(stream);
    groups.set(key, [...(groups.get(key) ?? []), stream]);
  }

  let deactivated = 0;
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const [canonical, ...duplicates] = group;
    for (const duplicate of duplicates) {
      await tx.calendarOverride.updateMany({
        where: { recurringStreamId: duplicate.id },
        data: { recurringStreamId: canonical.id },
      });
      await tx.recurringStream.update({
        where: { id: duplicate.id },
        data: {
          isActive: false,
          status: "INACTIVE",
          detectionKey: null,
        },
      });
      deactivated += 1;
    }
  }
  return deactivated;
}

async function executeRepair(
  tx: TransactionClient,
  ownerId: string,
  now: Date,
  dryRun: boolean,
) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`plaid-account-owner:${ownerId}`}, 0))`;
  const accounts = await tx.account.findMany({
    where: {
      userId: ownerId,
      source: "SYNCED",
      institutionConnection: { provider: "PLAID" },
    },
    include: {
      institutionConnection: true,
      balanceSnapshots: true,
      investmentSnapshots: true,
      investmentHoldings: true,
      investmentTransactions: true,
      _count: {
        select: {
          transactions: true,
          recurringStreams: true,
          calendarEvents: true,
        },
      },
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  type RepairAccount = (typeof accounts)[number] & {
    institutionConnection: NonNullable<
      (typeof accounts)[number]["institutionConnection"]
    >;
  };
  const groups = new Map<string, RepairAccount[]>();
  for (const account of accounts) {
    if (!account.institutionConnection) continue;
    const repairAccount = {
      ...account,
      institutionConnection: account.institutionConnection,
    } as RepairAccount;
    const identityKey = storedIdentityKey(repairAccount);
    if (!identityKey) continue;
    groups.set(identityKey, [
      ...(groups.get(identityKey) ?? []),
      repairAccount,
    ]);
  }

  let accountsMerged = 0;
  let duplicateGroups = 0;
  let duplicateTransactionsCanceled = 0;
  const touchedCanonicalAccounts = new Set<string>();
  const predecessorConnectionIds = new Set<string>();

  for (const [identityKey, group] of groups) {
    const current = [...group].sort((a, b) => {
      const aCurrent =
        a.isActive &&
        a.institutionConnection.status !== ConnectionStatus.DISCONNECTED;
      const bCurrent =
        b.isActive &&
        b.institutionConnection.status !== ConnectionStatus.DISCONNECTED;
      if (aCurrent !== bCurrent) return bCurrent ? 1 : -1;
      const aSync =
        a.institutionConnection.lastSuccessfulSyncAt?.getTime() ??
        a.updatedAt.getTime();
      const bSync =
        b.institutionConnection.lastSuccessfulSyncAt?.getTime() ??
        b.updatedAt.getTime();
      return bSync - aSync;
    })[0];
    const canonical = group[0];

    for (const account of group) {
      await preserveProviderLink(tx, account, identityKey, now);
      await tx.providerAccountLink.updateMany({
        where: { accountId: account.id },
        data: { isCurrent: false, logicalIdentityKey: identityKey },
      });
    }

    if (group.length > 1) duplicateGroups += 1;
    for (const duplicate of group.slice(1)) {
      await tx.accountMergeAudit.upsert({
        where: { duplicateAccountId: duplicate.id },
        update: {},
        create: {
          userId: ownerId,
          provider: "PLAID",
          canonicalAccountId: canonical.id,
          duplicateAccountId: duplicate.id,
          reason: "replacement-item-logical-identity",
          snapshot: jsonSnapshot(duplicate),
          mergedAt: now,
        },
      });
      await tx.transaction.updateMany({
        where: { accountId: duplicate.id },
        data: { accountId: canonical.id },
      });
      await tx.recurringStream.updateMany({
        where: { typicalAccountId: duplicate.id },
        data: { typicalAccountId: canonical.id },
      });
      await tx.calendarEvent.updateMany({
        where: { accountId: duplicate.id },
        data: { accountId: canonical.id },
      });
      await tx.investmentHolding.updateMany({
        where: { accountId: duplicate.id },
        data: { accountId: canonical.id },
      });
      await moveSnapshots(tx, canonical.id, duplicate.id);
      await tx.providerAccountLink.updateMany({
        where: { accountId: duplicate.id },
        data: { accountId: canonical.id },
      });
      await tx.account.delete({ where: { id: duplicate.id } });
      accountsMerged += 1;
    }

    await tx.account.update({
      where: { id: canonical.id },
      data: {
        dataSourceId: current.dataSourceId,
        institutionConnectionId: current.institutionConnectionId,
        providerAccountId: current.providerAccountId,
        providerIdentityKey: identityKey,
        mask: current.mask,
        name: current.name,
        officialName: current.officialName,
        institutionName: current.institutionName,
        accountType: current.accountType,
        accountSubtype: current.accountSubtype,
        currency: current.currency,
        currentBalance: current.currentBalance,
        balanceAvailable: current.balanceAvailable,
        availableBalance: current.availableBalance,
        creditLimit: current.creditLimit,
        isActive: current.isActive,
        lastSyncedAt: current.lastSyncedAt,
      },
    });
    if (current.providerAccountId) {
      await tx.providerAccountLink.update({
        where: {
          userId_provider_providerAccountId: {
            userId: ownerId,
            provider: "PLAID",
            providerAccountId: current.providerAccountId,
          },
        },
        data: { accountId: canonical.id, isCurrent: true, lastSeenAt: now },
      });
    }
    for (const account of group)
      if (
        account.institutionConnectionId &&
        account.institutionConnectionId !== current.institutionConnectionId
      )
        predecessorConnectionIds.add(account.institutionConnectionId);
    touchedCanonicalAccounts.add(canonical.id);
  }

  for (const accountId of touchedCanonicalAccounts)
    duplicateTransactionsCanceled += await consolidateTransactions(
      tx,
      accountId,
      now,
    );

  const duplicateStreamsDeactivated = await deactivateDuplicateStreams(
    tx,
    ownerId,
  );
  let connectionsRetired = 0;
  for (const connectionId of predecessorConnectionIds) {
    const currentAccountCount = await tx.account.count({
      where: { institutionConnectionId: connectionId, isActive: true },
    });
    if (currentAccountCount > 0) continue;
    const connection = await tx.institutionConnection.findUnique({
      where: { id: connectionId },
      select: { status: true, dataSourceId: true },
    });
    if (!connection || connection.status === ConnectionStatus.DISCONNECTED)
      continue;
    await tx.institutionConnection.update({
      where: { id: connectionId },
      data: {
        status: ConnectionStatus.DISCONNECTED,
        encryptedAccessToken: null,
        syncStartedAt: null,
        disconnectedAt: now,
      },
    });
    await tx.dataSource.update({
      where: { id: connection.dataSourceId },
      data: { status: DataSourceStatus.INACTIVE },
    });
    connectionsRetired += 1;
  }

  const report: PlaidAccountRepairReport = {
    ownerId,
    dryRun,
    accountsBefore: accounts.length,
    accountsAfter: accounts.length - accountsMerged,
    duplicateGroups,
    accountsMerged,
    transactionsPreserved: await tx.transaction.count({
      where: {
        userId: ownerId,
        account: { providerIdentityKey: { startsWith: "plaid:v1:" } },
      },
    }),
    duplicateTransactionsCanceled,
    recurringStreamsPreserved: await tx.recurringStream.count({
      where: {
        userId: ownerId,
        typicalAccount: {
          providerIdentityKey: { startsWith: "plaid:v1:" },
        },
      },
    }),
    duplicateStreamsDeactivated,
    calendarEventsPreserved: await tx.calendarEvent.count({
      where: {
        userId: ownerId,
        account: { providerIdentityKey: { startsWith: "plaid:v1:" } },
      },
    }),
    connectionsRetired,
  };
  if (dryRun) throw new DryRunRollback(report);
  return report;
}

export async function repairPlaidAccountDuplicates(
  ownerId: string,
  options: {
    database: DatabaseClient;
    now?: Date;
    dryRun?: boolean;
  },
) {
  const database = options.database;
  const now = options.now ?? new Date();
  try {
    return await database.$transaction(
      (tx) => executeRepair(tx, ownerId, now, options.dryRun ?? false),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (error) {
    if (error instanceof DryRunRollback) return error.report;
    throw error;
  }
}
