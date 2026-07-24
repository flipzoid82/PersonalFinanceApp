import "server-only";
import {
  ConnectionStatus,
  DataSourceStatus,
  Prisma,
  type PrismaClient,
} from "@prisma/client";
import { db } from "@/lib/db";
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
}

export type PlaidSyncResult = {
  accounts: number;
  added: number;
  modified: number;
  removed: number;
};

export async function syncPlaidConnection(
  ownerId: string,
  connectionId: string,
  options: {
    plaid?: PlaidClient;
    database?: DatabaseClient;
    now?: Date;
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
      const reconnectedProviderAccountIds = new Set<string>();
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
        const existing = await tx.account.findUnique({
          where: {
            dataSourceId_providerAccountId: {
              dataSourceId: connection.dataSourceId,
              providerAccountId: account.account_id,
            },
          },
          select: { id: true },
        });
        if (existing) {
          await tx.account.update({
            where: { id: existing.id },
            data: {
              institutionConnectionId: connection.id,
              ...mapped,
            },
          });
          continue;
        }

        const reconnectCandidates = await tx.account.findMany({
          where: {
            userId: ownerId,
            source: "SYNCED",
            isActive: false,
            institutionName: connection.institutionName,
            mask: account.mask,
            name: account.name,
            accountType: mapped.accountType,
          },
          select: { id: true },
          orderBy: { updatedAt: "desc" },
          take: 2,
        });
        if (reconnectCandidates.length === 1) {
          await tx.account.update({
            where: { id: reconnectCandidates[0].id },
            data: {
              dataSourceId: connection.dataSourceId,
              institutionConnectionId: connection.id,
              providerAccountId: account.account_id,
              ...mapped,
            },
          });
          reconnectedProviderAccountIds.add(account.account_id);
        } else {
          await tx.account.create({
            data: {
              userId: ownerId,
              dataSourceId: connection.dataSourceId,
              institutionConnectionId: connection.id,
              providerAccountId: account.account_id,
              ...mapped,
            },
          });
        }
      }
      for (const transaction of [...changes.added, ...changes.modified])
        await upsertTransaction(
          tx,
          ownerId,
          connection.id,
          transaction,
          reconnectedProviderAccountIds.has(transaction.account_id),
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
    });
    return {
      accounts: accountResponse.data.accounts.length,
      added: changes.added.length,
      modified: changes.modified.length,
      removed: changes.removed.length,
    };
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
