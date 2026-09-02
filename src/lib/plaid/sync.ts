import "server-only";
import {
  ConnectionStatus,
  DataSourceStatus,
  Prisma,
  type PrismaClient,
} from "@prisma/client";
import { db } from "@/lib/db";
import { runRecurringDetection } from "@/lib/recurring";
import {
  bootstrapTransactionCategories,
  classifyStoredTransactions,
  preservePendingOwnerState,
} from "@/lib/transactions/truth";
import { plaidProviderIdentityKey } from "./account-identity";
import { decryptAccessToken } from "./crypto";
import {
  getPlaidClient,
  normalizePlaidError,
  SafePlaidError,
  type PlaidClient,
} from "./client";
import {
  plaidAccountData,
  plaidTransactionData,
  type PlaidSyncChanges,
} from "./mapping";

const LOCK_TIMEOUT_MS = 15 * 60 * 1000;
const MAX_PAGES = 100;
const MAX_MUTATION_RESTARTS = 3;

type DatabaseClient = PrismaClient;

export async function collectTransactionChanges(
  accessToken: string,
  originalCursor: string | null,
  client: PlaidClient,
): Promise<PlaidSyncChanges> {
  for (let attempt = 0; attempt < MAX_MUTATION_RESTARTS; attempt += 1) {
    const added: PlaidSyncChanges["added"] = [];
    const modified: PlaidSyncChanges["modified"] = [];
    const removed: PlaidSyncChanges["removed"] = [];
    let cursor = originalCursor ?? undefined;

    try {
      for (let page = 0; page < MAX_PAGES; page += 1) {
        const response = await client.transactionsSync({
          access_token: accessToken,
          cursor,
        });
        added.push(...response.data.added);
        modified.push(...response.data.modified);
        removed.push(...response.data.removed);
        cursor = response.data.next_cursor;
        if (!response.data.has_more)
          return { added, modified, removed, nextCursor: cursor };
      }
      throw new SafePlaidError("PLAID_PAGE_LIMIT_EXCEEDED");
    } catch (error) {
      const safe = normalizePlaidError(error);
      if (
        safe.code === "TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION" &&
        attempt + 1 < MAX_MUTATION_RESTARTS
      )
        continue;
      throw safe;
    }
  }
  throw new SafePlaidError("TRANSACTIONS_SYNC_RESTART_LIMIT");
}

async function upsertTransaction(
  tx: Prisma.TransactionClient,
  ownerId: string,
  connectionId: string,
  transaction: PlaidSyncChanges["added"][number],
  reconcileReconnect = false,
) {
  const account = await tx.account.findFirst({
    where: {
      userId: ownerId,
      institutionConnectionId: connectionId,
      providerAccountId: transaction.account_id,
    },
    select: { id: true },
  });
  if (!account) throw new SafePlaidError("PLAID_ACCOUNT_NOT_FOUND");

  const data = plaidTransactionData(transaction);
  const providerIdentity = {
    accountId_providerTransactionId: {
      accountId: account.id,
      providerTransactionId: transaction.transaction_id,
    },
  };
  const existing = await tx.transaction.findUnique({
    where: providerIdentity,
    select: { id: true },
  });
  let stored: { id: string };
  if (existing) {
    stored = await tx.transaction.update({
      where: { id: existing.id },
      data,
    });
  } else {
    const reconnectCandidates = reconcileReconnect
      ? await tx.transaction.findMany({
          where: {
            accountId: account.id,
            providerTransactionId: { not: null },
            originalName: data.originalName,
            merchantName: data.merchantName,
            amount: data.amount,
            currency: data.currency,
            authorizedAt: data.authorizedAt,
            postedAt: data.postedAt,
            status: data.status,
          },
          select: { id: true },
          orderBy: { createdAt: "asc" },
          take: 2,
        })
      : [];
    stored =
      reconnectCandidates.length === 1
        ? await tx.transaction.update({
            where: { id: reconnectCandidates[0].id },
            data: {
              providerTransactionId: transaction.transaction_id,
              ...data,
            },
          })
        : await tx.transaction.create({
            data: {
              userId: ownerId,
              accountId: account.id,
              providerTransactionId: transaction.transaction_id,
              ...data,
            },
          });
  }

  let pendingId: string | null = null;
  if (transaction.pending_transaction_id && !transaction.pending) {
    const pending = await tx.transaction.findFirst({
      where: {
        userId: ownerId,
        providerTransactionId: transaction.pending_transaction_id,
        account: { institutionConnectionId: connectionId },
      },
      select: { id: true },
    });
    if (pending) {
      pendingId = pending.id;
      await tx.transaction.update({
        where: { id: pending.id },
        data: { status: "CANCELED" },
      });
      await tx.transaction.update({
        where: { id: stored.id },
        data: { pendingTransactionId: pending.id },
      });
    }
  }
  return { id: stored.id, pendingId };
}

export type PlaidSyncResult = {
  accounts: number;
  added: number;
  modified: number;
  removed: number;
  recurringDetection?: "completed" | "failed";
};

export async function syncPlaidConnection(
  ownerId: string,
  connectionId: string,
  options: {
    plaid?: PlaidClient;
    database?: DatabaseClient;
    now?: Date;
    detectRecurring?: typeof runRecurringDetection;
  } = {},
): Promise<PlaidSyncResult> {
  const database = options.database ?? db;
  const plaid = options.plaid ?? getPlaidClient();
  const now = options.now ?? new Date();
  const staleLock = new Date(now.getTime() - LOCK_TIMEOUT_MS);
  const lock = await database.institutionConnection.updateMany({
    where: {
      id: connectionId,
      userId: ownerId,
      status: { not: ConnectionStatus.DISCONNECTED },
      OR: [{ syncStartedAt: null }, { syncStartedAt: { lt: staleLock } }],
    },
    data: { syncStartedAt: now, lastAttemptedSyncAt: now },
  });
  if (lock.count !== 1) throw new SafePlaidError("SYNC_ALREADY_RUNNING");

  try {
    const connection = await database.institutionConnection.findFirst({
      where: { id: connectionId, userId: ownerId },
      select: {
        id: true,
        dataSourceId: true,
        institutionId: true,
        institutionName: true,
        encryptedAccessToken: true,
        syncCursor: true,
      },
    });
    if (!connection?.encryptedAccessToken)
      throw new SafePlaidError("PLAID_CONNECTION_NOT_FOUND");

    const accessToken = decryptAccessToken(connection.encryptedAccessToken);
    const [accountResponse, changes] = await Promise.all([
      plaid.accountsGet({ access_token: accessToken }),
      collectTransactionChanges(accessToken, connection.syncCursor, plaid),
    ]);

    await database.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`plaid-account-owner:${ownerId}`}, 0))`;
      const reconciledProviderAccountIds = new Set<string>();
      const predecessorConnectionIds = new Set<string>();
      await tx.account.updateMany({
        where: { userId: ownerId, institutionConnectionId: connection.id },
        data: { isActive: false },
      });
      for (const account of accountResponse.data.accounts) {
        const mapped = plaidAccountData(
          account,
          connection.institutionName,
          now,
        );
        const identityKey = plaidProviderIdentityKey({
          institutionId: connection.institutionId,
          mask: account.mask ?? null,
          name: account.name,
          officialName: account.official_name ?? null,
          type: mapped.accountType,
          subtype: mapped.accountSubtype,
          currency: mapped.currency,
        });
        const providerLink = await tx.providerAccountLink.findUnique({
          where: {
            userId_provider_providerAccountId: {
              userId: ownerId,
              provider: "PLAID",
              providerAccountId: account.account_id,
            },
          },
          select: { accountId: true },
        });
        const byLogicalIdentity = identityKey
          ? await tx.account.findUnique({
              where: {
                userId_providerIdentityKey: {
                  userId: ownerId,
                  providerIdentityKey: identityKey,
                },
              },
              select: {
                id: true,
                institutionConnectionId: true,
                providerAccountId: true,
              },
            })
          : null;
        const exact = await tx.account.findUnique({
          where: {
            dataSourceId_providerAccountId: {
              dataSourceId: connection.dataSourceId,
              providerAccountId: account.account_id,
            },
          },
          select: {
            id: true,
            institutionConnectionId: true,
            providerAccountId: true,
          },
        });
        let existing =
          byLogicalIdentity ??
          exact ??
          (providerLink
            ? await tx.account.findFirst({
                where: { id: providerLink.accountId, userId: ownerId },
                select: {
                  id: true,
                  institutionConnectionId: true,
                  providerAccountId: true,
                },
              })
            : null);
        if (!existing && identityKey) {
          const legacyCandidates = await tx.account.findMany({
            where: {
              userId: ownerId,
              source: "SYNCED",
              providerIdentityKey: null,
              institutionConnection: {
                provider: "PLAID",
                institutionId: connection.institutionId,
              },
              institutionName: connection.institutionName,
              mask: account.mask,
              name: account.name,
              accountType: mapped.accountType,
              accountSubtype: mapped.accountSubtype,
              currency: mapped.currency,
            },
            select: {
              id: true,
              institutionConnectionId: true,
              providerAccountId: true,
            },
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            take: 2,
          });
          if (legacyCandidates.length > 1)
            throw new SafePlaidError("PLAID_ACCOUNT_REPAIR_REQUIRED");
          existing = legacyCandidates[0] ?? null;
        }
        if (existing) {
          const replacement =
            existing.institutionConnectionId !== connection.id ||
            existing.providerAccountId !== account.account_id;
          if (
            existing.institutionConnectionId &&
            existing.institutionConnectionId !== connection.id
          )
            predecessorConnectionIds.add(existing.institutionConnectionId);
          await tx.providerAccountLink.updateMany({
            where: { accountId: existing.id },
            data: { isCurrent: false },
          });
          await tx.account.update({
            where: { id: existing.id },
            data: {
              dataSourceId: connection.dataSourceId,
              institutionConnectionId: connection.id,
              providerAccountId: account.account_id,
              providerIdentityKey: identityKey,
              ...mapped,
            },
          });
          await tx.providerAccountLink.upsert({
            where: {
              userId_provider_providerAccountId: {
                userId: ownerId,
                provider: "PLAID",
                providerAccountId: account.account_id,
              },
            },
            update: {
              accountId: existing.id,
              institutionConnectionId: connection.id,
              logicalIdentityKey: identityKey,
              isCurrent: true,
              lastSeenAt: now,
            },
            create: {
              userId: ownerId,
              provider: "PLAID",
              providerAccountId: account.account_id,
              logicalIdentityKey: identityKey,
              accountId: existing.id,
              institutionConnectionId: connection.id,
              isCurrent: true,
              firstSeenAt: now,
              lastSeenAt: now,
            },
          });
          if (replacement) reconciledProviderAccountIds.add(account.account_id);
          continue;
        }

        const reconnectCandidates = await tx.account.findMany({
          where: {
            userId: ownerId,
            source: "SYNCED",
            isActive: false,
            institutionConnection: { provider: "PLAID" },
            institutionName: connection.institutionName,
            mask: account.mask,
            name: account.name,
            accountType: mapped.accountType,
            accountSubtype: mapped.accountSubtype,
          },
          select: {
            id: true,
            institutionConnectionId: true,
          },
          orderBy: { updatedAt: "desc" },
          take: 2,
        });
        if (reconnectCandidates.length === 1) {
          if (reconnectCandidates[0].institutionConnectionId)
            predecessorConnectionIds.add(
              reconnectCandidates[0].institutionConnectionId,
            );
          await tx.providerAccountLink.updateMany({
            where: { accountId: reconnectCandidates[0].id },
            data: { isCurrent: false },
          });
          await tx.account.update({
            where: { id: reconnectCandidates[0].id },
            data: {
              dataSourceId: connection.dataSourceId,
              institutionConnectionId: connection.id,
              providerAccountId: account.account_id,
              providerIdentityKey: identityKey,
              ...mapped,
            },
          });
          await tx.providerAccountLink.upsert({
            where: {
              userId_provider_providerAccountId: {
                userId: ownerId,
                provider: "PLAID",
                providerAccountId: account.account_id,
              },
            },
            update: {
              accountId: reconnectCandidates[0].id,
              institutionConnectionId: connection.id,
              logicalIdentityKey: identityKey,
              isCurrent: true,
              lastSeenAt: now,
            },
            create: {
              userId: ownerId,
              provider: "PLAID",
              providerAccountId: account.account_id,
              logicalIdentityKey: identityKey,
              accountId: reconnectCandidates[0].id,
              institutionConnectionId: connection.id,
              isCurrent: true,
              firstSeenAt: now,
              lastSeenAt: now,
            },
          });
          reconciledProviderAccountIds.add(account.account_id);
        } else {
          const created = await tx.account.create({
            data: {
              userId: ownerId,
              dataSourceId: connection.dataSourceId,
              institutionConnectionId: connection.id,
              providerAccountId: account.account_id,
              providerIdentityKey: identityKey,
              ...mapped,
            },
          });
          await tx.providerAccountLink.create({
            data: {
              userId: ownerId,
              provider: "PLAID",
              providerAccountId: account.account_id,
              logicalIdentityKey: identityKey,
              accountId: created.id,
              institutionConnectionId: connection.id,
              isCurrent: true,
              firstSeenAt: now,
              lastSeenAt: now,
            },
          });
        }
      }
      const storedTransactions: Array<{
        id: string;
        pendingId: string | null;
      }> = [];
      for (const transaction of [...changes.added, ...changes.modified])
        storedTransactions.push(
          await upsertTransaction(
            tx,
            ownerId,
            connection.id,
            transaction,
            reconciledProviderAccountIds.has(transaction.account_id),
          ),
        );
      for (const removed of changes.removed) {
        await tx.transaction.updateMany({
          where: {
            userId: ownerId,
            providerTransactionId: removed.transaction_id,
            account: { institutionConnectionId: connection.id },
          },
          data: { status: "CANCELED", removedAt: now },
        });
      }
      await bootstrapTransactionCategories(tx, ownerId);
      await classifyStoredTransactions(
        tx,
        ownerId,
        storedTransactions.map(({ id }) => id),
      );
      for (const stored of storedTransactions) {
        if (stored.pendingId)
          await preservePendingOwnerState(
            tx,
            ownerId,
            stored.pendingId,
            stored.id,
          );
      }
      await tx.institutionConnection.update({
        where: { id: connection.id },
        data: {
          status: ConnectionStatus.ACTIVE,
          syncCursor: changes.nextCursor,
          syncStartedAt: null,
          lastSuccessfulSyncAt: now,
          lastErrorCode: null,
          lastErrorMessage: null,
          disconnectedAt: null,
        },
      });
      await tx.dataSource.update({
        where: { id: connection.dataSourceId },
        data: {
          status: DataSourceStatus.ACTIVE,
          lastUpdatedAt: now,
        },
      });
      for (const predecessorId of predecessorConnectionIds) {
        const remainingAccounts = await tx.account.count({
          where: { institutionConnectionId: predecessorId, isActive: true },
        });
        if (remainingAccounts > 0) continue;
        const predecessor = await tx.institutionConnection.findUnique({
          where: { id: predecessorId },
          select: { status: true, dataSourceId: true },
        });
        if (
          !predecessor ||
          predecessor.status === ConnectionStatus.DISCONNECTED
        )
          continue;
        await tx.institutionConnection.update({
          where: { id: predecessorId },
          data: {
            status: ConnectionStatus.DISCONNECTED,
            encryptedAccessToken: null,
            syncStartedAt: null,
            disconnectedAt: now,
          },
        });
        await tx.dataSource.update({
          where: { id: predecessor.dataSourceId },
          data: { status: DataSourceStatus.INACTIVE },
        });
      }
    });
    const result: PlaidSyncResult = {
      accounts: accountResponse.data.accounts.length,
      added: changes.added.length,
      modified: changes.modified.length,
      removed: changes.removed.length,
    };
    try {
      await (options.detectRecurring ?? runRecurringDetection)(ownerId, {
        database,
        now,
      });
      result.recurringDetection = "completed";
    } catch {
      // Provider persistence is already committed. Detection is deliberately
      // isolated so a projection failure cannot corrupt Plaid history.
      result.recurringDetection = "failed";
    }
    return result;
  } catch (error) {
    const safe =
      error instanceof SafePlaidError ? error : normalizePlaidError(error);
    const repairNeeded = safe.code === "ITEM_LOGIN_REQUIRED";
    await database.institutionConnection.updateMany({
      where: { id: connectionId, userId: ownerId, syncStartedAt: now },
      data: {
        syncStartedAt: null,
        status: repairNeeded
          ? ConnectionStatus.NEEDS_REAUTHENTICATION
          : ConnectionStatus.ERROR,
        lastErrorCode: safe.code,
        lastErrorMessage: safe.message,
      },
    });
    throw safe;
  }
}
