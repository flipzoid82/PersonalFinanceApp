import "server-only";
import {
  ConnectionStatus,
  DataSourceStatus,
  DataSourceType,
  type PrismaClient,
} from "@prisma/client";
import { CountryCode } from "plaid";
import { db } from "@/lib/db";
import {
  getPlaidClient,
  linkTokenRequest,
  normalizePlaidError,
  SafePlaidError,
  type PlaidClient,
} from "./client";
import { decryptAccessToken, encryptAccessToken } from "./crypto";
import { syncPlaidConnection } from "./sync";

type DatabaseClient = PrismaClient;

export async function createPlaidLinkToken(
  ownerId: string,
  connectionId?: string,
  options: { plaid?: PlaidClient; database?: DatabaseClient } = {},
) {
  const plaid = options.plaid ?? getPlaidClient();
  const database = options.database ?? db;
  let accessToken: string | undefined;
  if (connectionId) {
    const connection = await database.institutionConnection.findFirst({
      where: {
        id: connectionId,
        userId: ownerId,
        status: { not: ConnectionStatus.DISCONNECTED },
      },
      select: { encryptedAccessToken: true },
    });
    if (!connection?.encryptedAccessToken)
      throw new SafePlaidError("PLAID_CONNECTION_NOT_FOUND");
    accessToken = decryptAccessToken(connection.encryptedAccessToken);
  }
  try {
    const response = await plaid.linkTokenCreate(
      linkTokenRequest(ownerId, accessToken),
    );
    return response.data.link_token;
  } catch (error) {
    throw normalizePlaidError(error);
  }
}

export async function exchangePlaidPublicToken(
  ownerId: string,
  input: {
    publicToken: string;
    linkSessionId: string;
    institutionId?: string | null;
    institutionName?: string | null;
  },
  options: { plaid?: PlaidClient; database?: DatabaseClient } = {},
) {
  const plaid = options.plaid ?? getPlaidClient();
  const database = options.database ?? db;
  const duplicate = await database.institutionConnection.findFirst({
    where: { userId: ownerId, linkSessionId: input.linkSessionId },
    select: { id: true },
  });
  if (duplicate) return { connectionId: duplicate.id, duplicate: true };

  try {
    const exchange = await plaid.itemPublicTokenExchange({
      public_token: input.publicToken,
    });
    const { access_token: accessToken, item_id: itemId } = exchange.data;
    const existing = await database.institutionConnection.findFirst({
      where: { userId: ownerId, provider: "PLAID", providerItemId: itemId },
      select: { id: true, dataSourceId: true },
    });
    const item = await plaid.itemGet({ access_token: accessToken });
    const institutionId =
      item.data.item.institution_id ?? input.institutionId ?? null;
    let institutionName =
      input.institutionName?.trim() || "Plaid Sandbox institution";
    if (institutionId) {
      const institution = await plaid.institutionsGetById({
        institution_id: institutionId,
        country_codes: [CountryCode.Us],
      });
      institutionName = institution.data.institution.name;
    }
    const encryptedAccessToken = encryptAccessToken(accessToken);

    const connection = await database.$transaction(async (tx) => {
      const source = existing
        ? await tx.dataSource.update({
            where: { id: existing.dataSourceId },
            data: {
              displayName: `${institutionName} (Plaid Sandbox)`,
              status: DataSourceStatus.ACTIVE,
            },
          })
        : await tx.dataSource.create({
            data: {
              userId: ownerId,
              sourceType: DataSourceType.PLAID,
              displayName: `${institutionName} (Plaid Sandbox)`,
              status: DataSourceStatus.ACTIVE,
            },
          });
      return existing
        ? tx.institutionConnection.update({
            where: { id: existing.id },
            data: {
              linkSessionId: input.linkSessionId,
              institutionId,
              institutionName,
              encryptedAccessToken,
              status: ConnectionStatus.ACTIVE,
              disconnectedAt: null,
              lastErrorCode: null,
              lastErrorMessage: null,
            },
          })
        : tx.institutionConnection.create({
            data: {
              userId: ownerId,
              dataSourceId: source.id,
              provider: "PLAID",
              providerItemId: itemId,
              linkSessionId: input.linkSessionId,
              institutionId,
              institutionName,
              encryptedAccessToken,
            },
          });
    });
    await syncPlaidConnection(ownerId, connection.id, {
      plaid,
      database,
    });
    return { connectionId: connection.id, duplicate: Boolean(existing) };
  } catch (error) {
    throw error instanceof SafePlaidError ? error : normalizePlaidError(error);
  }
}

export async function repairPlaidConnection(
  ownerId: string,
  connectionId: string,
  options: { plaid?: PlaidClient; database?: DatabaseClient } = {},
) {
  const database = options.database ?? db;
  const connection = await database.institutionConnection.findFirst({
    where: { id: connectionId, userId: ownerId },
    select: { id: true },
  });
  if (!connection) throw new SafePlaidError("PLAID_CONNECTION_NOT_FOUND");
  await database.institutionConnection.update({
    where: { id: connection.id },
    data: {
      status: ConnectionStatus.ACTIVE,
      lastErrorCode: null,
      lastErrorMessage: null,
    },
  });
  return syncPlaidConnection(ownerId, connection.id, options);
}

export async function disconnectPlaidConnection(
  ownerId: string,
  connectionId: string,
  options: { plaid?: PlaidClient; database?: DatabaseClient } = {},
) {
  const database = options.database ?? db;
  const plaid = options.plaid ?? getPlaidClient();
  const connection = await database.institutionConnection.findFirst({
    where: { id: connectionId, userId: ownerId, provider: "PLAID" },
    select: {
      id: true,
      dataSourceId: true,
      encryptedAccessToken: true,
      status: true,
    },
  });
  if (!connection) throw new SafePlaidError("PLAID_CONNECTION_NOT_FOUND");
  if (connection.status !== ConnectionStatus.DISCONNECTED) {
    if (connection.encryptedAccessToken) {
      try {
        await plaid.itemRemove({
          access_token: decryptAccessToken(connection.encryptedAccessToken),
        });
      } catch (error) {
        const safe = normalizePlaidError(error);
        if (safe.code !== "ITEM_NOT_FOUND") throw safe;
      }
    }
    const now = new Date();
    await database.$transaction([
      database.institutionConnection.update({
        where: { id: connection.id },
        data: {
          status: ConnectionStatus.DISCONNECTED,
          encryptedAccessToken: null,
          syncStartedAt: null,
          disconnectedAt: now,
        },
      }),
      database.dataSource.update({
        where: { id: connection.dataSourceId },
        data: { status: DataSourceStatus.INACTIVE },
      }),
      database.account.updateMany({
        where: {
          userId: ownerId,
          institutionConnectionId: connection.id,
        },
        data: { isActive: false },
      }),
      database.providerAccountLink.updateMany({
        where: {
          userId: ownerId,
          institutionConnectionId: connection.id,
        },
        data: { isCurrent: false, lastSeenAt: now },
      }),
    ]);
  }
}
