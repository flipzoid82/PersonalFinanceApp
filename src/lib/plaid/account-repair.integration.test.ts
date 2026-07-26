// @vitest-environment node

import {
  AccountSource,
  AccountType,
  CalendarAmountSource,
  CalendarDateSource,
  CalendarEventStatus,
  CalendarEventType,
  ConfidenceLevel,
  ConnectionStatus,
  DataSourceType,
  FinancialRole,
  Prisma,
  PrismaClient,
  RecurringFlowType,
  RecurringFrequency,
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

vi.mock("server-only", () => ({}));

import { currentAccountWhere } from "@/lib/accounts/current";
import { calculateDashboard } from "@/lib/dashboard/calculations";
import { getDashboardData } from "@/lib/dashboard/queries";
import { calculatePortfolio } from "@/lib/portfolio/calculations";
import { getPortfolioData } from "@/lib/portfolio/queries";
import { seedDevelopmentData } from "../../../prisma/seed";
import { repairPlaidAccountDuplicates } from "./account-repair";
import { getPlaidConnections } from "./queries";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeDatabase = testDatabaseUrl ? describe : describe.skip;
const NOW = new Date("2026-07-24T18:00:00.000Z");
const money = (value: string) => new Prisma.Decimal(value);
let prisma: PrismaClient;
let ownerId: string;

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
  await prisma.providerAccountLink.deleteMany();
  await prisma.accountMergeAudit.deleteMany();
  await prisma.importJob.deleteMany();
  await prisma.account.deleteMany();
  await prisma.institutionConnection.deleteMany();
  await prisma.dataSource.deleteMany();
  await prisma.manualAsset.deleteMany();
  await prisma.authSession.deleteMany();
  await prisma.user.deleteMany();
}

async function createConnection(
  suffix: string,
  status: ConnectionStatus = ConnectionStatus.ACTIVE,
) {
  const source = await prisma.dataSource.create({
    data: {
      userId: ownerId,
      sourceType: DataSourceType.PLAID,
      displayName: `Sandbox ${suffix}`,
    },
  });
  return prisma.institutionConnection.create({
    data: {
      userId: ownerId,
      dataSourceId: source.id,
      provider: "PLAID",
      providerItemId: `item-${suffix}`,
      institutionId: "ins-shared",
      institutionName: "First Sandbox Bank",
      status,
      lastSuccessfulSyncAt:
        suffix === "new" ? NOW : new Date(NOW.getTime() - 60_000),
      disconnectedAt:
        status === ConnectionStatus.DISCONNECTED
          ? new Date(NOW.getTime() - 30_000)
          : null,
    },
  });
}

async function createPlaidAccount(
  connection: Awaited<ReturnType<typeof createConnection>>,
  suffix: string,
  isActive = true,
) {
  return prisma.account.create({
    data: {
      userId: ownerId,
      dataSourceId: connection.dataSourceId,
      institutionConnectionId: connection.id,
      providerAccountId: `provider-account-${suffix}`,
      mask: "1111",
      name: "Sandbox Checking",
      officialName: "Sandbox Gold Checking",
      institutionName: "First Sandbox Bank",
      accountType: AccountType.CHECKING,
      accountSubtype: "checking",
      source: AccountSource.SYNCED,
      currentBalance: money("500"),
      currency: "USD",
      isActive,
      lastSyncedAt: suffix === "new" ? NOW : new Date(NOW.getTime() - 60_000),
      createdAt: suffix === "new" ? NOW : new Date(NOW.getTime() - 120_000),
    },
  });
}

async function createDuplicateFixture() {
  const oldConnection = await createConnection("old");
  const newConnection = await createConnection("new");
  const oldAccount = await createPlaidAccount(oldConnection, "old");
  const newAccount = await createPlaidAccount(newConnection, "new");

  const oldTransaction = await prisma.transaction.create({
    data: {
      userId: ownerId,
      accountId: oldAccount.id,
      providerTransactionId: "provider-transaction-old",
      originalName: "Sandbox Grocer",
      merchantName: "Sandbox Grocer",
      amount: money("25"),
      postedAt: new Date("2026-07-20T00:00:00.000Z"),
      status: TransactionStatus.POSTED,
      currency: "USD",
      providerCategory: "FOOD_AND_DRINK_GROCERIES",
      createdAt: new Date(NOW.getTime() - 120_000),
    },
  });
  await prisma.transactionOverride.create({
    data: {
      userId: ownerId,
      transactionId: oldTransaction.id,
      financialRoleOverride: FinancialRole.EXPENSE,
      notes: "Preserve this owner override",
    },
  });
  const newTransaction = await prisma.transaction.create({
    data: {
      userId: ownerId,
      accountId: newAccount.id,
      providerTransactionId: "provider-transaction-new",
      originalName: "Sandbox Grocer",
      merchantName: "Sandbox Grocer",
      amount: money("25"),
      postedAt: new Date("2026-07-20T00:00:00.000Z"),
      status: TransactionStatus.POSTED,
      currency: "USD",
      providerCategory: "FOOD_AND_DRINK_GROCERIES",
      createdAt: NOW,
    },
  });

  const oldStream = await prisma.recurringStream.create({
    data: {
      userId: ownerId,
      merchantName: "Sandbox Grocer",
      description: "Sandbox Grocer",
      flowType: RecurringFlowType.BILL,
      frequency: RecurringFrequency.MONTHLY,
      averageAmount: money("25"),
      lastAmount: money("25"),
      firstDate: new Date("2026-05-20T00:00:00.000Z"),
      lastDate: new Date("2026-07-20T00:00:00.000Z"),
      predictedNextDate: new Date("2026-08-20T00:00:00.000Z"),
      dateSource: CalendarDateSource.INFERRED,
      confidenceLevel: ConfidenceLevel.HIGH,
      typicalAccountId: oldAccount.id,
      detectionKey: "old-detection",
      createdAt: new Date(NOW.getTime() - 120_000),
    },
  });
  const newStream = await prisma.recurringStream.create({
    data: {
      userId: ownerId,
      merchantName: "Sandbox Grocer",
      description: "Sandbox Grocer",
      flowType: RecurringFlowType.BILL,
      frequency: RecurringFrequency.MONTHLY,
      averageAmount: money("25"),
      lastAmount: money("25"),
      firstDate: new Date("2026-05-20T00:00:00.000Z"),
      lastDate: new Date("2026-07-20T00:00:00.000Z"),
      predictedNextDate: new Date("2026-08-20T00:00:00.000Z"),
      dateSource: CalendarDateSource.INFERRED,
      confidenceLevel: ConfidenceLevel.HIGH,
      typicalAccountId: newAccount.id,
      detectionKey: "new-detection",
      createdAt: NOW,
    },
  });
  const calendarEvent = await prisma.calendarEvent.create({
    data: {
      userId: ownerId,
      recurringStreamId: oldStream.id,
      accountId: oldAccount.id,
      linkedTransactionId: oldTransaction.id,
      eventType: CalendarEventType.BILL,
      title: "Sandbox Grocer",
      eventDate: new Date("2026-07-20T00:00:00.000Z"),
      expectedAmount: money("25"),
      actualAmount: money("25"),
      dateSource: CalendarDateSource.INFERRED,
      amountSource: CalendarAmountSource.FIXED,
      confidenceLevel: ConfidenceLevel.HIGH,
      status: CalendarEventStatus.PAID,
      projectionKey: "old-projection",
    },
  });
  await prisma.calendarEvent.create({
    data: {
      userId: ownerId,
      recurringStreamId: newStream.id,
      accountId: newAccount.id,
      eventType: CalendarEventType.BILL,
      title: "Sandbox Grocer",
      eventDate: new Date("2026-08-20T00:00:00.000Z"),
      expectedAmount: money("25"),
      dateSource: CalendarDateSource.INFERRED,
      amountSource: CalendarAmountSource.FIXED,
      confidenceLevel: ConfidenceLevel.HIGH,
      status: CalendarEventStatus.PREDICTED,
      projectionKey: "new-projection",
    },
  });
  await prisma.balanceSnapshot.create({
    data: {
      userId: ownerId,
      accountId: oldAccount.id,
      currentBalance: money("500"),
      capturedAt: new Date("2026-07-23T00:00:00.000Z"),
    },
  });

  const manualSource = await prisma.dataSource.create({
    data: {
      userId: ownerId,
      sourceType: DataSourceType.MANUAL,
      displayName: "Manual",
    },
  });
  const manualAccount = await prisma.account.create({
    data: {
      userId: ownerId,
      dataSourceId: manualSource.id,
      name: "Manual Checking",
      accountType: AccountType.CHECKING,
      source: AccountSource.MANUAL,
      currentBalance: money("100"),
      isManual: true,
    },
  });
  return {
    oldConnection,
    newConnection,
    oldAccount,
    newAccount,
    oldTransaction,
    newTransaction,
    oldStream,
    newStream,
    calendarEvent,
    manualAccount,
  };
}

describeDatabase("Plaid logical account repair", () => {
  beforeAll(async () => {
    const url = new URL(testDatabaseUrl!);
    if (!url.pathname.toLocaleLowerCase("en-US").includes("test"))
      throw new Error("TEST_DATABASE_URL must name an isolated test database.");
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
          email: "repair-owner@example.test",
          passwordHash: "disabled",
        },
      })
    ).id;
  });

  afterAll(async () => prisma?.$disconnect());

  it("rolls back a dry run, then repairs duplicates without losing dependents or manual accounts", async () => {
    const fixture = await createDuplicateFixture();
    const dryRun = await repairPlaidAccountDuplicates(ownerId, {
      database: prisma,
      now: NOW,
      dryRun: true,
    });
    expect(dryRun).toMatchObject({
      dryRun: true,
      accountsBefore: 2,
      accountsAfter: 1,
      accountsMerged: 1,
    });
    expect(
      await prisma.account.count({
        where: {
          userId: ownerId,
          institutionConnection: { provider: "PLAID" },
        },
      }),
    ).toBe(2);
    expect(await prisma.accountMergeAudit.count()).toBe(0);

    const report = await repairPlaidAccountDuplicates(ownerId, {
      database: prisma,
      now: NOW,
    });
    expect(report).toMatchObject({
      dryRun: false,
      accountsBefore: 2,
      accountsAfter: 1,
      duplicateGroups: 1,
      accountsMerged: 1,
      transactionsPreserved: 2,
      duplicateTransactionsCanceled: 1,
      recurringStreamsPreserved: 2,
      duplicateStreamsDeactivated: 1,
      calendarEventsPreserved: 2,
      connectionsRetired: 1,
    });

    const canonical = await prisma.account.findFirstOrThrow({
      where: {
        userId: ownerId,
        institutionConnection: { provider: "PLAID" },
      },
    });
    expect(canonical).toMatchObject({
      id: fixture.oldAccount.id,
      institutionConnectionId: fixture.newConnection.id,
      providerAccountId: "provider-account-new",
      isActive: true,
    });
    expect(canonical.providerIdentityKey).toMatch(/^plaid:v1:[0-9a-f]{64}$/);
    expect(
      await prisma.transaction.count({
        where: { accountId: canonical.id },
      }),
    ).toBe(2);
    expect(
      await prisma.transaction.count({
        where: {
          accountId: canonical.id,
          status: TransactionStatus.POSTED,
        },
      }),
    ).toBe(1);
    expect(
      await prisma.transactionOverride.findFirstOrThrow({
        where: { userId: ownerId },
      }),
    ).toMatchObject({
      transactionId: fixture.newTransaction.id,
      notes: "Preserve this owner override",
    });
    expect(
      await prisma.calendarEvent.findUniqueOrThrow({
        where: { id: fixture.calendarEvent.id },
      }),
    ).toMatchObject({
      accountId: canonical.id,
      linkedTransactionId: fixture.newTransaction.id,
    });
    expect(
      await prisma.recurringStream.count({
        where: { typicalAccountId: canonical.id },
      }),
    ).toBe(2);
    expect(
      await prisma.recurringStream.count({
        where: { typicalAccountId: canonical.id, isActive: true },
      }),
    ).toBe(1);
    expect(
      await prisma.balanceSnapshot.findFirstOrThrow({
        where: { userId: ownerId },
      }),
    ).toMatchObject({ accountId: canonical.id });
    expect(
      await prisma.account.findUniqueOrThrow({
        where: { id: fixture.manualAccount.id },
      }),
    ).toMatchObject({ currentBalance: money("100"), isActive: true });
    expect(await prisma.accountMergeAudit.count()).toBe(1);
    expect(await prisma.providerAccountLink.count()).toBe(2);
    expect(
      await prisma.providerAccountLink.count({ where: { isCurrent: true } }),
    ).toBe(1);
    expect(
      await prisma.institutionConnection.findUniqueOrThrow({
        where: { id: fixture.oldConnection.id },
      }),
    ).toMatchObject({ status: ConnectionStatus.DISCONNECTED });

    const repeated = await repairPlaidAccountDuplicates(ownerId, {
      database: prisma,
      now: new Date(NOW.getTime() + 1_000),
    });
    expect(repeated.accountsMerged).toBe(0);
    expect(
      await prisma.account.count({
        where: { userId: ownerId, providerIdentityKey: { not: null } },
      }),
    ).toBe(1);
  });

  it("excludes disconnected-only rows, includes the canonical current row once, and keeps Accounts and Overview totals aligned", async () => {
    const fixture = await createDuplicateFixture();
    await repairPlaidAccountDuplicates(ownerId, {
      database: prisma,
      now: NOW,
    });
    const disconnectedSource = await prisma.dataSource.create({
      data: {
        userId: ownerId,
        sourceType: DataSourceType.PLAID,
        displayName: "Historical",
      },
    });
    const disconnected = await prisma.institutionConnection.create({
      data: {
        userId: ownerId,
        dataSourceId: disconnectedSource.id,
        provider: "PLAID",
        providerItemId: "historical-item",
        institutionId: "ins-historical",
        institutionName: "Historical Bank",
        status: ConnectionStatus.DISCONNECTED,
        disconnectedAt: NOW,
      },
    });
    await prisma.account.create({
      data: {
        userId: ownerId,
        dataSourceId: disconnectedSource.id,
        institutionConnectionId: disconnected.id,
        providerAccountId: "historical-account",
        name: "Stale Historical Account",
        accountType: AccountType.CHECKING,
        source: AccountSource.SYNCED,
        currentBalance: money("9999"),
        isActive: true,
      },
    });

    const current = await prisma.account.findMany({
      where: currentAccountWhere(ownerId),
    });
    expect(current.map(({ name }) => name)).toEqual(
      expect.arrayContaining(["Sandbox Checking", "Manual Checking"]),
    );
    expect(current.map(({ name }) => name)).not.toContain(
      "Stale Historical Account",
    );

    const portfolio = calculatePortfolio(await getPortfolioData(ownerId), NOW);
    const dashboard = calculateDashboard(
      await getDashboardData(ownerId, NOW),
      NOW,
    );
    expect(portfolio.totalAssets.toString()).toBe("600");
    expect(portfolio.netWorth.equals(dashboard.metrics.netWorth)).toBe(true);
    expect(
      portfolio.accounts.filter(
        ({ institutionConnection }) =>
          institutionConnection?.id === fixture.newConnection.id,
      ),
    ).toHaveLength(1);

    const connections = await getPlaidConnections(ownerId);
    const currentConnection = connections.find(
      ({ id }) => id === fixture.newConnection.id,
    );
    const historicalConnection = connections.find(
      ({ id }) => id === fixture.oldConnection.id,
    );
    expect(currentConnection?._count.accounts).toBe(1);
    expect(currentConnection?._count.providerAccountLinks).toBe(1);
    expect(historicalConnection?._count.accounts).toBe(0);
    expect(historicalConnection?._count.providerAccountLinks).toBe(1);
  });

  it("scopes repair to one owner", async () => {
    await createDuplicateFixture();
    const otherOwner = await prisma.user.create({
      data: {
        email: "other-repair-owner@example.test",
        passwordHash: "disabled",
      },
    });
    const otherSource = await prisma.dataSource.create({
      data: {
        userId: otherOwner.id,
        sourceType: DataSourceType.PLAID,
        displayName: "Other",
      },
    });
    const otherConnection = await prisma.institutionConnection.create({
      data: {
        userId: otherOwner.id,
        dataSourceId: otherSource.id,
        provider: "PLAID",
        providerItemId: "other-item",
        institutionId: "ins-shared",
        institutionName: "First Sandbox Bank",
      },
    });
    await prisma.account.create({
      data: {
        userId: otherOwner.id,
        dataSourceId: otherSource.id,
        institutionConnectionId: otherConnection.id,
        providerAccountId: "other-account",
        mask: "1111",
        name: "Sandbox Checking",
        officialName: "Sandbox Gold Checking",
        institutionName: "First Sandbox Bank",
        accountType: AccountType.CHECKING,
        accountSubtype: "checking",
        source: AccountSource.SYNCED,
        currentBalance: money("700"),
      },
    });

    await repairPlaidAccountDuplicates(ownerId, {
      database: prisma,
      now: NOW,
    });
    expect(
      await prisma.account.count({ where: { userId: otherOwner.id } }),
    ).toBe(1);
    expect(
      await prisma.accountMergeAudit.count({
        where: { userId: otherOwner.id },
      }),
    ).toBe(0);
  });

  it("keeps deterministic seed Plaid rows unique across two runs", async () => {
    await seedDevelopmentData(prisma, NOW);
    await seedDevelopmentData(prisma, NOW);
    expect(
      await prisma.account.count({
        where: {
          id: {
            in: [
              "seed_account_checking",
              "seed_account_savings",
              "seed_account_credit",
            ],
          },
        },
      }),
    ).toBe(3);
    expect(
      await prisma.institutionConnection.count({
        where: { id: "seed_connection_bank" },
      }),
    ).toBe(1);
  });
});
