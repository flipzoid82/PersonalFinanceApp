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
import { getDashboardData } from "@/lib/dashboard/queries";
import { calculateMonthlyActivity } from "@/lib/dashboard/calculations";
import { getCalendarData } from "@/lib/calendar/queries";
import { buildBillsViewModel } from "@/lib/bills";
import { getSpendingViewModel } from "./queries";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeDatabase = testDatabaseUrl ? describe : describe.skip;
let prisma: PrismaClient;

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
  await prisma.providerAccountLink.deleteMany();
  await prisma.accountMergeAudit.deleteMany();
  await prisma.account.deleteMany();
  await prisma.institutionConnection.deleteMany();
  await prisma.dataSource.deleteMany();
  await prisma.manualAsset.deleteMany();
  await prisma.authSession.deleteMany();
  await prisma.user.deleteMany();
}

describeDatabase("Milestone 9 spending integration", () => {
  beforeAll(async () => {
    const url = new URL(testDatabaseUrl!);
    if (!url.pathname.toLowerCase().includes("test"))
      throw new Error("TEST_DATABASE_URL must name an isolated test database.");
    prisma = new PrismaClient({
      datasources: { db: { url: testDatabaseUrl } },
    });
    await prisma.$connect();
  });
  beforeEach(clearTestData);
  afterAll(async () => prisma?.$disconnect());

  it("keeps historical reporting auditable while current accounts and Bills exclude obsolete sources", async () => {
    const owner = await prisma.user.create({
      data: { email: "m9-owner@example.test", passwordHash: "disabled" },
    });
    const other = await prisma.user.create({
      data: { email: "m9-other@example.test", passwordHash: "disabled" },
    });
    const source = await prisma.dataSource.create({
      data: {
        userId: owner.id,
        sourceType: DataSourceType.MANUAL,
        displayName: "Manual",
      },
    });
    const account = await prisma.account.create({
      data: {
        userId: owner.id,
        dataSourceId: source.id,
        name: "Checking",
        accountType: AccountType.CHECKING,
        source: AccountSource.MANUAL,
        currentBalance: new Prisma.Decimal(0),
        isManual: true,
      },
    });
    const plaidSource = await prisma.dataSource.create({
      data: {
        userId: owner.id,
        sourceType: DataSourceType.PLAID,
        displayName: "Historical",
      },
    });
    const disconnected = await prisma.institutionConnection.create({
      data: {
        userId: owner.id,
        dataSourceId: plaidSource.id,
        provider: "PLAID",
        providerItemId: "historical",
        institutionName: "Old Bank",
        status: ConnectionStatus.DISCONNECTED,
      },
    });
    const oldAccount = await prisma.account.create({
      data: {
        userId: owner.id,
        dataSourceId: plaidSource.id,
        institutionConnectionId: disconnected.id,
        name: "Old checking",
        accountType: AccountType.CHECKING,
        source: AccountSource.SYNCED,
        currentBalance: new Prisma.Decimal(0),
        isActive: false,
      },
    });
    const historicalEvent = await prisma.calendarEvent.create({
      data: {
        id: "historical-upcoming-projection",
        userId: owner.id,
        accountId: oldAccount.id,
        eventType: CalendarEventType.BILL,
        title: "Historical projected bill",
        eventDate: new Date("2026-08-15T00:00:00.000Z"),
        expectedAmount: new Prisma.Decimal("999"),
        dateSource: CalendarDateSource.INFERRED,
        amountSource: CalendarAmountSource.ESTIMATED,
        confidenceLevel: ConfidenceLevel.HIGH,
        status: CalendarEventStatus.PREDICTED,
      },
    });
    const otherSource = await prisma.dataSource.create({
      data: {
        userId: other.id,
        sourceType: DataSourceType.MANUAL,
        displayName: "Other",
      },
    });
    const otherAccount = await prisma.account.create({
      data: {
        userId: other.id,
        dataSourceId: otherSource.id,
        name: "Other",
        accountType: AccountType.CHECKING,
        source: AccountSource.MANUAL,
        currentBalance: new Prisma.Decimal(0),
        isManual: true,
      },
    });
    const now = new Date("2026-08-10T12:00:00.000Z");
    const create = (
      id: string,
      accountId: string,
      amount: string,
      status: TransactionStatus = TransactionStatus.POSTED,
    ) =>
      prisma.transaction.create({
        data: {
          id,
          userId: accountId === otherAccount.id ? other.id : owner.id,
          accountId,
          originalName: id,
          merchantName: "Provider merchant",
          providerCategory: "Provider category",
          amount: new Prisma.Decimal(amount),
          postedAt: new Date("2026-08-05T00:00:00.000Z"),
          status,
        },
      });
    const expense = await create("expense", account.id, "100");
    await prisma.transactionOverride.create({
      data: {
        userId: owner.id,
        transactionId: expense.id,
        merchantNameOverride: "Local merchant",
        categoryOverride: "Local category",
        financialRoleOverride: FinancialRole.EXPENSE,
      },
    });
    const refund = await create("refund", account.id, "25");
    await prisma.transactionOverride.create({
      data: {
        userId: owner.id,
        transactionId: refund.id,
        categoryOverride: "Local category",
        financialRoleOverride: FinancialRole.REFUND,
      },
    });
    const excluded = await create("excluded", account.id, "500");
    await prisma.transactionOverride.create({
      data: {
        userId: owner.id,
        transactionId: excluded.id,
        financialRoleOverride: FinancialRole.EXPENSE,
        excludedFromReports: true,
      },
    });
    const removed = await create("removed", account.id, "600");
    await prisma.transaction.update({
      where: { id: removed.id },
      data: { removedAt: now },
    });
    await prisma.transactionOverride.create({
      data: {
        userId: owner.id,
        transactionId: removed.id,
        financialRoleOverride: FinancialRole.EXPENSE,
      },
    });
    const pending = await create(
      "pending",
      account.id,
      "700",
      TransactionStatus.PENDING,
    );
    await prisma.transactionOverride.create({
      data: {
        userId: owner.id,
        transactionId: pending.id,
        financialRoleOverride: FinancialRole.EXPENSE,
      },
    });
    const historical = await create("historical", oldAccount.id, "800");
    await prisma.transactionOverride.create({
      data: {
        userId: owner.id,
        transactionId: historical.id,
        financialRoleOverride: FinancialRole.EXPENSE,
      },
    });
    const foreign = await create("foreign", otherAccount.id, "900");
    await prisma.transactionOverride.create({
      data: {
        userId: other.id,
        transactionId: foreign.id,
        financialRoleOverride: FinancialRole.EXPENSE,
      },
    });

    const spending = await getSpendingViewModel(owner.id, now);
    expect(spending.currentMonth.spending.toString()).toBe("875");
    expect(spending.largestPurchases.map(({ id }) => id)).toContain(
      historical.id,
    );
    expect(spending.largestPurchases.map(({ id }) => id)).not.toContain(
      removed.id,
    );
    expect(
      spending.merchants.some(({ label }) => label === "Local merchant"),
    ).toBe(true);
    const dashboardData = await getDashboardData(owner.id, now);
    expect(dashboardData.accounts.map(({ id }) => id)).toContain(account.id);
    expect(dashboardData.accounts.map(({ id }) => id)).not.toContain(
      oldAccount.id,
    );
    expect(dashboardData.transactions.map(({ id }) => id)).toContain(
      historical.id,
    );
    expect(dashboardData.transactions.map(({ id }) => id)).not.toContain(
      removed.id,
    );
    const overview = calculateMonthlyActivity(dashboardData, now);
    expect(overview.spending.toString()).toBe(
      spending.currentMonth.spending.toString(),
    );
    const calendarData = await getCalendarData(owner.id, now);
    expect(calendarData.events.map(({ id }) => id)).toContain(
      historicalEvent.id,
    );
    const bills = buildBillsViewModel(calendarData, 30, now);
    expect(bills.bills.map(({ id }) => id)).not.toContain(historicalEvent.id);
    expect(bills.upcomingTotal.toString()).toBe("0");
  });
});
