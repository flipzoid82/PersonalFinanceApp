// @vitest-environment node

import {
  AccountType,
  ConnectionStatus,
  DataSourceType,
  Prisma,
  PrismaClient,
  TransactionStatus,
} from "@prisma/client";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type { AccountBase, Transaction } from "plaid";

vi.mock("server-only", () => ({}));

import { calculatePortfolio } from "@/lib/portfolio/calculations";
import { getPortfolioData } from "@/lib/portfolio/queries";
import type { PlaidClient } from "./client";
import {
  createPlaidLinkToken,
  disconnectPlaidConnection,
  exchangePlaidPublicToken,
  repairPlaidConnection,
} from "./connections";
import { decryptAccessToken } from "./crypto";
import { syncPlaidConnection } from "./sync";
import { processPlaidTransactionsWebhook } from "./webhook";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeDatabase = testDatabaseUrl ? describe : describe.skip;
const NOW = new Date("2026-07-23T18:00:00.000Z");
const TOKEN = "access-sandbox-integration-fixture";
let prisma: PrismaClient;
let ownerId: string;

function account(
  id: string,
  name: string,
  current: number | null,
): AccountBase {
  return {
    account_id: id,
    balances: {
      available: current,
      current,
      iso_currency_code: "USD",
      limit: null,
      unofficial_currency_code: null,
    },
    mask: id === "account-unavailable" ? "2222" : "1111",
    name,
    official_name: null,
    type: "depository",
    subtype: "checking",
  } as AccountBase;
}

function transaction(
  id: string,
  accountId: string,
  input: Partial<Transaction> = {},
): Transaction {
  return {
    transaction_id: id,
    account_id: accountId,
    name: `Transaction ${id}`,
    merchant_name: `Merchant ${id}`,
    amount: 12.34,
    iso_currency_code: "USD",
    unofficial_currency_code: null,
    authorized_date: "2026-07-22",
    authorized_datetime: null,
    date: "2026-07-23",
    datetime: null,
    pending: false,
    pending_transaction_id: null,
    personal_finance_category: null,
    category: ["Fixture"],
    payment_channel: "online",
    ...input,
  } as Transaction;
}

function plaidClient(input: {
  syncPages?: Array<{
    added: Transaction[];
    modified: Transaction[];
    removed: Array<{ transaction_id: string }>;
    next_cursor: string;
    has_more: boolean;
  }>;
  accounts?: AccountBase[];
  syncError?: unknown;
}) {
  const pages = [...(input.syncPages ?? [])];
  return {
    itemPublicTokenExchange: vi.fn(async () => ({
      data: {
        access_token: TOKEN,
        item_id: "sandbox-item",
        request_id: "request-id",
      },
    })),
    itemGet: vi.fn(async () => ({
      data: {
        item: { institution_id: "sandbox-institution" },
        status: null,
        request_id: "request-id",
      },
    })),
    institutionsGetById: vi.fn(async () => ({
      data: {
        institution: { name: "First Sandbox Bank" },
        request_id: "request-id",
      },
    })),
    accountsGet: vi.fn(async () => ({
      data: {
        accounts: input.accounts ?? [
          account("account-available", "Sandbox Checking", 500),
        ],
        item: {},
        request_id: "request-id",
      },
    })),
    transactionsSync: vi.fn(async () => {
      if (input.syncError) throw input.syncError;
      const page = pages.shift();
      if (!page) throw new Error("Missing deterministic sync page.");
      return { data: { ...page, request_id: "request-id" } };
    }),
    linkTokenCreate: vi.fn(async (request) => ({
      data: {
        link_token: "link-sandbox-fixture",
        expiration: NOW.toISOString(),
        request_id: "request-id",
        request,
      },
    })),
    itemRemove: vi.fn(async () => ({
      data: { removed: true, request_id: "request-id" },
    })),
  } as unknown as PlaidClient;
}

function initialPages() {
  return [
    {
      added: [
        transaction("pending-transaction", "account-available", {
          pending: true,
          date: "2026-07-22",
        }),
        transaction("modified-transaction", "account-available"),
        transaction("removed-transaction", "account-available"),
      ],
      modified: [],
      removed: [],
      next_cursor: "initial-cursor",
      has_more: false,
    },
  ];
}

async function clearTestData() {
  await prisma.calendarOverride.deleteMany();
  await prisma.transactionOverride.deleteMany();
  await prisma.calendarEvent.deleteMany();
  await prisma.investmentHolding.deleteMany();
  await prisma.investmentBalanceSnapshot.deleteMany();
  await prisma.investmentTransaction.deleteMany();
  await prisma.balanceSnapshot.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.recurringStream.deleteMany();
  await prisma.importJob.deleteMany();
  await prisma.account.deleteMany();
  await prisma.institutionConnection.deleteMany();
  await prisma.dataSource.deleteMany();
  await prisma.manualAsset.deleteMany();
  await prisma.authSession.deleteMany();
  await prisma.user.deleteMany();
}

async function connect(client = plaidClient({ syncPages: initialPages() })) {
  const result = await exchangePlaidPublicToken(
    ownerId,
    {
      publicToken: "public-sandbox-fixture",
      linkSessionId: "link-session-1",
      institutionId: "sandbox-institution",
      institutionName: "First Sandbox Bank",
    },
    { plaid: client, database: prisma },
  );
  return { ...result, client };
}

describeDatabase("Milestone 6 Plaid Sandbox integration", () => {
  beforeAll(async () => {
    const url = new URL(testDatabaseUrl!);
    if (!url.pathname.toLowerCase().includes("test"))
      throw new Error("TEST_DATABASE_URL must name an isolated test database.");
    process.env.PLAID_CLIENT_ID = "sandbox-client";
    process.env.PLAID_SECRET = "sandbox-secret";
    process.env.PLAID_ENV = "sandbox";
    process.env.PLAID_WEBHOOK_URL = "https://example.test/api/plaid/webhook";
    process.env.PLAID_TOKEN_ENCRYPTION_KEY = "1".repeat(64);
    if (
      process.env.PLAID_TOKEN_ENCRYPTION_KEY ===
      process.env.TOKEN_ENCRYPTION_KEY
    )
      process.env.PLAID_TOKEN_ENCRYPTION_KEY = "3".repeat(64);
    prisma = new PrismaClient({
      datasources: { db: { url: testDatabaseUrl } },
    });
    await prisma.$connect();
  });

  beforeEach(async () => {
    await clearTestData();
    ownerId = (
      await prisma.user.create({
        data: {
          email: "plaid-owner@example.test",
          passwordHash: "disabled",
        },
      })
    ).id;
  });

  afterAll(async () => prisma?.$disconnect());

  it("encrypts the token, initializes sync idempotently, preserves manual data, and excludes unavailable balances", async () => {
    const manualSource = await prisma.dataSource.create({
      data: {
        userId: ownerId,
        sourceType: DataSourceType.MANUAL,
        displayName: "Manual source",
      },
    });
    const manual = await prisma.account.create({
      data: {
        userId: ownerId,
        dataSourceId: manualSource.id,
        name: "Manual cash",
        accountType: AccountType.CHECKING,
        source: "MANUAL",
        currentBalance: new Prisma.Decimal(100),
        isManual: true,
      },
    });
    const client = plaidClient({
      accounts: [
        account("account-available", "Sandbox Checking", 500),
        account("account-unavailable", "Unavailable Checking", null),
      ],
      syncPages: initialPages(),
    });

    const first = await connect(client);
    const duplicate = await exchangePlaidPublicToken(
      ownerId,
      {
        publicToken: "public-token-retry",
        linkSessionId: "link-session-1",
      },
      { plaid: client, database: prisma },
    );
    const connection = await prisma.institutionConnection.findUniqueOrThrow({
      where: { id: first.connectionId },
    });

    expect(duplicate).toEqual({
      connectionId: first.connectionId,
      duplicate: true,
    });
    expect(client.itemPublicTokenExchange).toHaveBeenCalledOnce();
    expect(connection.encryptedAccessToken).not.toContain(TOKEN);
    expect(decryptAccessToken(connection.encryptedAccessToken!)).toBe(TOKEN);
    expect(connection.syncCursor).toBe("initial-cursor");
    expect(
      await prisma.account.findUnique({ where: { id: manual.id } }),
    ).toMatchObject({ isActive: true, source: "MANUAL" });
    expect(
      await prisma.account.findFirstOrThrow({
        where: { providerAccountId: "account-unavailable" },
      }),
    ).toMatchObject({ balanceAvailable: false });

    const portfolio = calculatePortfolio(await getPortfolioData(ownerId), NOW);
    expect(portfolio.totalAssets.toString()).toBe("600");
    expect(portfolio.isPartial).toBe(true);
    expect(portfolio.partialReasons.join(" ")).toMatch(/unavailable balance/i);
  });

  it("reconciles modified, removed, and pending-to-posted activity while preserving overrides and advancing the cursor atomically", async () => {
    const { connectionId } = await connect();
    const modified = await prisma.transaction.findFirstOrThrow({
      where: { providerTransactionId: "modified-transaction" },
    });
    await prisma.transactionOverride.create({
      data: {
        userId: ownerId,
        transactionId: modified.id,
        merchantNameOverride: "Owner override",
      },
    });
    const client = plaidClient({
      syncPages: [
        {
          added: [
            transaction("posted-replacement", "account-available", {
              pending_transaction_id: "pending-transaction",
            }),
          ],
          modified: [
            transaction("modified-transaction", "account-available", {
              amount: 99.99,
              merchant_name: "Updated provider merchant",
            }),
          ],
          removed: [{ transaction_id: "removed-transaction" }],
          next_cursor: "reconciled-cursor",
          has_more: false,
        },
      ],
    });
    await syncPlaidConnection(ownerId, connectionId, {
      plaid: client,
      database: prisma,
      now: new Date(NOW.getTime() + 60_000),
    });

    const pending = await prisma.transaction.findFirstOrThrow({
      where: { providerTransactionId: "pending-transaction" },
    });
    const posted = await prisma.transaction.findFirstOrThrow({
      where: { providerTransactionId: "posted-replacement" },
    });
    const removed = await prisma.transaction.findFirstOrThrow({
      where: { providerTransactionId: "removed-transaction" },
    });
    const updated = await prisma.transaction.findUniqueOrThrow({
      where: { id: modified.id },
      include: { override: true },
    });
    expect(pending.status).toBe(TransactionStatus.CANCELED);
    expect(posted.pendingTransactionId).toBe(pending.id);
    expect(removed.status).toBe(TransactionStatus.CANCELED);
    expect(removed.removedAt).not.toBeNull();
    expect(updated.amount.toString()).toBe("99.99");
    expect(updated.override?.merchantNameOverride).toBe("Owner override");
    expect(
      (
        await prisma.institutionConnection.findUniqueOrThrow({
          where: { id: connectionId },
        })
      ).syncCursor,
    ).toBe("reconciled-cursor");
  });

  it("does not advance the cursor on failure and prevents concurrent sync", async () => {
    const { connectionId } = await connect();
    const errorClient = plaidClient({
      syncError: {
        response: {
          data: {
            error_code: "INSTITUTION_DOWN",
            request_id: "safe-request",
          },
        },
      },
    });
    await expect(
      syncPlaidConnection(ownerId, connectionId, {
        plaid: errorClient,
        database: prisma,
      }),
    ).rejects.toThrow("temporarily unavailable");
    const failed = await prisma.institutionConnection.findUniqueOrThrow({
      where: { id: connectionId },
    });
    expect(failed.syncCursor).toBe("initial-cursor");
    expect(failed.status).toBe(ConnectionStatus.ERROR);

    await prisma.institutionConnection.update({
      where: { id: connectionId },
      data: { status: ConnectionStatus.ACTIVE, syncStartedAt: NOW },
    });
    const concurrentClient = plaidClient({ syncPages: initialPages() });
    await expect(
      syncPlaidConnection(ownerId, connectionId, {
        plaid: concurrentClient,
        database: prisma,
        now: new Date(NOW.getTime() + 1_000),
      }),
    ).rejects.toMatchObject({ code: "SYNC_ALREADY_RUNNING" });
    expect(concurrentClient.accountsGet).not.toHaveBeenCalled();
  });

  it("keeps committed Plaid history when post-sync recurring detection fails", async () => {
    const { connectionId } = await connect();
    const client = plaidClient({
      syncPages: [
        {
          added: [
            transaction(
              "persisted-before-detection-failure",
              "account-available",
            ),
          ],
          modified: [],
          removed: [],
          next_cursor: "detection-failure-cursor",
          has_more: false,
        },
      ],
    });
    const result = await syncPlaidConnection(ownerId, connectionId, {
      plaid: client,
      database: prisma,
      now: new Date(NOW.getTime() + 90_000),
      detectRecurring: async () => {
        throw new Error("synthetic detection failure");
      },
    });

    expect(result.recurringDetection).toBe("failed");
    expect(
      await prisma.transaction.count({
        where: {
          userId: ownerId,
          providerTransactionId: "persisted-before-detection-failure",
        },
      }),
    ).toBe(1);
    expect(
      (
        await prisma.institutionConnection.findUniqueOrThrow({
          where: { id: connectionId },
        })
      ).syncCursor,
    ).toBe("detection-failure-cursor");
  });

  it("supports owner-scoped update mode, repair, webhook idempotency, and historical disconnect", async () => {
    const { connectionId } = await connect();
    const other = await prisma.user.create({
      data: {
        email: "other-owner@example.test",
        passwordHash: "disabled",
      },
    });
    const updateClient = plaidClient({
      syncPages: [
        {
          added: [],
          modified: [],
          removed: [],
          next_cursor: "repair-cursor",
          has_more: false,
        },
        {
          added: [],
          modified: [],
          removed: [],
          next_cursor: "webhook-cursor",
          has_more: false,
        },
      ],
    });
    await expect(
      createPlaidLinkToken(other.id, connectionId, {
        plaid: updateClient,
        database: prisma,
      }),
    ).rejects.toMatchObject({ code: "PLAID_CONNECTION_NOT_FOUND" });
    await createPlaidLinkToken(ownerId, connectionId, {
      plaid: updateClient,
      database: prisma,
    });
    const request = vi.mocked(updateClient.linkTokenCreate).mock.calls[0][0];
    expect(request.access_token).toBe(TOKEN);
    expect(request.products).toBeUndefined();

    await prisma.institutionConnection.update({
      where: { id: connectionId },
      data: { status: ConnectionStatus.NEEDS_REAUTHENTICATION },
    });
    await repairPlaidConnection(ownerId, connectionId, {
      plaid: updateClient,
      database: prisma,
    });
    expect(
      await processPlaidTransactionsWebhook(
        {
          webhook_type: "TRANSACTIONS",
          webhook_code: "SYNC_UPDATES_AVAILABLE",
          item_id: "unknown-item",
          environment: "sandbox",
        },
        { plaid: updateClient, database: prisma },
      ),
    ).toBe("unknown");
    await prisma.institutionConnection.update({
      where: { id: connectionId },
      data: { syncStartedAt: new Date() },
    });
    expect(
      await processPlaidTransactionsWebhook(
        {
          webhook_type: "TRANSACTIONS",
          webhook_code: "SYNC_UPDATES_AVAILABLE",
          item_id: "sandbox-item",
          environment: "sandbox",
        },
        { plaid: updateClient, database: prisma },
      ),
    ).toBe("already-syncing");
    await prisma.institutionConnection.update({
      where: { id: connectionId },
      data: { syncStartedAt: null },
    });
    const detectRecurring = vi.fn(async () => ({
      eligibleTransactions: 0,
      candidates: 0,
      streamsCreated: 0,
      streamsUpdated: 0,
      projectionsCreated: 0,
      projectionsUpdated: 0,
      transactionsMatched: 0,
      streamsMarkedInactive: 0,
    }));
    expect(
      await processPlaidTransactionsWebhook(
        {
          webhook_type: "TRANSACTIONS",
          webhook_code: "SYNC_UPDATES_AVAILABLE",
          item_id: "sandbox-item",
          environment: "sandbox",
        },
        { plaid: updateClient, database: prisma, detectRecurring },
      ),
    ).toBe("synced");
    expect(detectRecurring).toHaveBeenCalledWith(
      ownerId,
      expect.objectContaining({ database: prisma }),
    );

    const transactionCount = await prisma.transaction.count({
      where: { userId: ownerId },
    });
    await disconnectPlaidConnection(ownerId, connectionId, {
      plaid: updateClient,
      database: prisma,
    });
    const disconnected = await prisma.institutionConnection.findUniqueOrThrow({
      where: { id: connectionId },
    });
    expect(disconnected.status).toBe(ConnectionStatus.DISCONNECTED);
    expect(disconnected.encryptedAccessToken).toBeNull();
    expect(await prisma.transaction.count({ where: { userId: ownerId } })).toBe(
      transactionCount,
    );
    expect(
      await prisma.account.count({
        where: { userId: ownerId, isActive: true },
      }),
    ).toBe(0);
  });

  it("reuses disconnected accounts and transactions on reconnect instead of duplicating them", async () => {
    const first = await connect();
    const original = await prisma.account.findFirstOrThrow({
      where: { providerAccountId: "account-available" },
    });
    const originalTransaction = await prisma.transaction.findFirstOrThrow({
      where: { providerTransactionId: "modified-transaction" },
    });
    await disconnectPlaidConnection(ownerId, first.connectionId, {
      plaid: plaidClient({ syncPages: [] }),
      database: prisma,
    });
    const reconnectClient = plaidClient({
      accounts: [
        {
          ...account("replacement-provider-account", "Sandbox Checking", 650),
          mask: "1111",
        } as AccountBase,
      ],
      syncPages: [
        {
          added: [
            transaction(
              "replacement-provider-transaction",
              "replacement-provider-account",
              {
                name: "Transaction modified-transaction",
                merchant_name: "Merchant modified-transaction",
              },
            ),
          ],
          modified: [],
          removed: [],
          next_cursor: "reconnect-cursor",
          has_more: false,
        },
      ],
    });
    vi.mocked(reconnectClient.itemPublicTokenExchange).mockResolvedValueOnce({
      data: {
        access_token: TOKEN,
        item_id: "replacement-sandbox-item",
        request_id: "request-id",
      },
    } as never);
    await exchangePlaidPublicToken(
      ownerId,
      {
        publicToken: "replacement-public-token",
        linkSessionId: "link-session-2",
        institutionId: "sandbox-institution",
      },
      { plaid: reconnectClient, database: prisma },
    );
    const accounts = await prisma.account.findMany({
      where: { userId: ownerId, source: "SYNCED" },
    });
    expect(accounts).toHaveLength(1);
    expect(accounts[0]).toMatchObject({
      id: original.id,
      providerAccountId: "replacement-provider-account",
      isActive: true,
    });
    expect(await prisma.transaction.count({ where: { userId: ownerId } })).toBe(
      3,
    );
    expect(
      await prisma.transaction.findFirstOrThrow({
        where: { providerTransactionId: "replacement-provider-transaction" },
      }),
    ).toMatchObject({ id: originalTransaction.id });
  });

  it("reuses an active logical account across replacement Items and repeated syncs", async () => {
    const first = await connect();
    const original = await prisma.account.findFirstOrThrow({
      where: { providerAccountId: "account-available" },
    });
    const replacement = plaidClient({
      accounts: [
        {
          ...account("active-replacement-account", "Sandbox Checking", 725),
          mask: "1111",
        } as AccountBase,
      ],
      syncPages: [
        {
          added: [
            transaction(
              "active-replacement-transaction",
              "active-replacement-account",
              {
                name: "Transaction modified-transaction",
                merchant_name: "Merchant modified-transaction",
              },
            ),
          ],
          modified: [],
          removed: [],
          next_cursor: "active-replacement-cursor",
          has_more: false,
        },
      ],
    });
    vi.mocked(replacement.itemPublicTokenExchange).mockResolvedValueOnce({
      data: {
        access_token: TOKEN,
        item_id: "active-replacement-item",
        request_id: "request-id",
      },
    } as never);
    const second = await exchangePlaidPublicToken(
      ownerId,
      {
        publicToken: "active-replacement-token",
        linkSessionId: "active-replacement-link",
        institutionId: "sandbox-institution",
      },
      { plaid: replacement, database: prisma },
    );

    expect(
      await prisma.account.count({
        where: { userId: ownerId, source: "SYNCED" },
      }),
    ).toBe(1);
    expect(
      await prisma.account.findFirstOrThrow({
        where: { userId: ownerId, source: "SYNCED" },
      }),
    ).toMatchObject({
      id: original.id,
      institutionConnectionId: second.connectionId,
      providerAccountId: "active-replacement-account",
    });
    expect(
      await prisma.institutionConnection.findUniqueOrThrow({
        where: { id: first.connectionId },
      }),
    ).toMatchObject({ status: ConnectionStatus.DISCONNECTED });
    expect(
      await prisma.providerAccountLink.count({ where: { userId: ownerId } }),
    ).toBe(2);
    expect(
      await prisma.providerAccountLink.count({
        where: { userId: ownerId, isCurrent: true },
      }),
    ).toBe(1);
    expect(await prisma.transaction.count({ where: { userId: ownerId } })).toBe(
      3,
    );

    await syncPlaidConnection(ownerId, second.connectionId, {
      database: prisma,
      plaid: plaidClient({
        accounts: [
          account("active-replacement-account", "Sandbox Checking", 725),
        ],
        syncPages: [
          {
            added: [],
            modified: [],
            removed: [],
            next_cursor: "repeated-cursor",
            has_more: false,
          },
        ],
      }),
      now: new Date(NOW.getTime() + 1_000),
    });
    expect(
      await prisma.account.count({
        where: { userId: ownerId, source: "SYNCED" },
      }),
    ).toBe(1);
  });

  it("serializes concurrent replacement Item syncs without duplicate accounts", async () => {
    await connect();
    const clients = ["concurrent-a", "concurrent-b"].map((suffix) => {
      const client = plaidClient({
        accounts: [
          account(`${suffix}-provider-account`, "Sandbox Checking", 800),
        ],
        syncPages: [
          {
            added: [],
            modified: [],
            removed: [],
            next_cursor: `${suffix}-cursor`,
            has_more: false,
          },
        ],
      });
      vi.mocked(client.itemPublicTokenExchange).mockResolvedValueOnce({
        data: {
          access_token: TOKEN,
          item_id: `${suffix}-item`,
          request_id: "request-id",
        },
      } as never);
      return { client, suffix };
    });

    await Promise.all(
      clients.map(({ client, suffix }) =>
        exchangePlaidPublicToken(
          ownerId,
          {
            publicToken: `${suffix}-token`,
            linkSessionId: `${suffix}-link`,
            institutionId: "sandbox-institution",
          },
          { plaid: client, database: prisma },
        ),
      ),
    );

    expect(
      await prisma.account.count({
        where: { userId: ownerId, source: "SYNCED" },
      }),
    ).toBe(1);
    expect(
      await prisma.providerAccountLink.count({
        where: { userId: ownerId, isCurrent: true },
      }),
    ).toBe(1);
    expect(
      await prisma.institutionConnection.count({
        where: { userId: ownerId, status: ConnectionStatus.ACTIVE },
      }),
    ).toBe(1);
  });
});
