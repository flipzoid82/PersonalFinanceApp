// @vitest-environment node

import {
  AccountSource,
  AccountType,
  DataSourceType,
  PrismaClient,
} from "@prisma/client";
import { renderToStaticMarkup } from "react-dom/server";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { seedDevelopmentData } from "../../../prisma/seed";

vi.mock("server-only", () => ({}));

import { OverviewDashboard } from "@/components/dashboard/overview-dashboard";
import { calculateDashboard } from "./calculations";
import { getDashboardData } from "./queries";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeDatabase = testDatabaseUrl ? describe : describe.skip;
const REFERENCE_DATE = new Date("2026-07-21T12:00:00.000Z");
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
  await prisma.account.deleteMany();
  await prisma.institutionConnection.deleteMany();
  await prisma.dataSource.deleteMany();
  await prisma.manualAsset.deleteMany();
  await prisma.authSession.deleteMany();
  await prisma.user.deleteMany();
}

describeDatabase("seeded Overview integration", () => {
  beforeAll(async () => {
    const url = new URL(testDatabaseUrl!);
    if (!url.pathname.toLowerCase().includes("test"))
      throw new Error("TEST_DATABASE_URL must name an isolated test database.");
    if (process.env.DATABASE_URL !== testDatabaseUrl)
      throw new Error(
        "DATABASE_URL and TEST_DATABASE_URL must match for dashboard integration tests.",
      );
    prisma = new PrismaClient({
      datasources: { db: { url: testDatabaseUrl } },
    });
    await prisma.$connect();
  });

  beforeEach(clearTestData);
  afterAll(async () => prisma?.$disconnect());

  it("queries only the authenticated owner and renders the populated synthetic dashboard", async () => {
    const { ownerId } = await seedDevelopmentData(prisma, REFERENCE_DATE);
    const other = await prisma.user.create({
      data: {
        email: "other-owner@example.test",
        passwordHash: "disabled",
      },
    });
    const otherSource = await prisma.dataSource.create({
      data: {
        userId: other.id,
        sourceType: DataSourceType.MANUAL,
        displayName: "Other Owner Source",
      },
    });
    await prisma.account.create({
      data: {
        userId: other.id,
        dataSourceId: otherSource.id,
        name: "Other Owner Account",
        accountType: AccountType.CHECKING,
        source: AccountSource.MANUAL,
        currentBalance: "999999.0000",
        isManual: true,
      },
    });

    const raw = await getDashboardData(ownerId, REFERENCE_DATE);
    const dashboard = calculateDashboard(raw, REFERENCE_DATE);
    const html = renderToStaticMarkup(
      <OverviewDashboard dashboard={dashboard} now={REFERENCE_DATE} />,
    );

    expect(other.id).not.toBe(ownerId);
    expect(raw.accounts.every(({ userId }) => userId === ownerId)).toBe(true);
    expect(
      raw.accounts.some(({ name }) => name === "Other Owner Account"),
    ).toBe(false);
    expect(dashboard.metrics.cash.toFixed(4)).toBe("16821.9876");
    expect(dashboard.metrics.investments.toFixed(4)).toBe("89951.0200");
    expect(dashboard.metrics.netWorth.toFixed(4)).toBe("280930.8576");
    expect(dashboard.metrics.income.toFixed(4)).toBe("4250.0000");
    expect(dashboard.metrics.spending.toFixed(4)).toBe("344.6021");
    expect(dashboard.upcoming).toHaveLength(2);
    expect(dashboard.netWorthTrend.length).toBeGreaterThanOrEqual(7);
    expect(html).toContain("Synthetic Individual Brokerage");
    expect(html).toContain("Example Electric (predicted)");
    expect(html).not.toContain("Other Owner Account");
  });

  it("keeps the expanded dashboard seed idempotent", async () => {
    await seedDevelopmentData(prisma, REFERENCE_DATE);
    const before = {
      users: await prisma.user.count(),
      transactions: await prisma.transaction.count(),
      balanceSnapshots: await prisma.balanceSnapshot.count(),
      investmentSnapshots: await prisma.investmentBalanceSnapshot.count(),
    };

    await seedDevelopmentData(prisma, REFERENCE_DATE);

    expect({
      users: await prisma.user.count(),
      transactions: await prisma.transaction.count(),
      balanceSnapshots: await prisma.balanceSnapshot.count(),
      investmentSnapshots: await prisma.investmentBalanceSnapshot.count(),
    }).toEqual(before);
  });
});
