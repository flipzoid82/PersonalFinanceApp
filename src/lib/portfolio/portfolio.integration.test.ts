// @vitest-environment node

import {
  AccountType,
  DataSourceType,
  InvestmentSource,
  InvestmentTransactionType,
  ManualAssetType,
  Prisma,
  PrismaClient,
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
import { seedDevelopmentData } from "../../../prisma/seed";

vi.mock("server-only", () => ({}));

import { calculateDashboard } from "@/lib/dashboard/calculations";
import { getDashboardData } from "@/lib/dashboard/queries";
import { calculatePortfolio } from "./calculations";
import { FIDELITY_TEMPLATES } from "./constants";
import {
  addBalanceSnapshot,
  addInvestmentSnapshot,
  createManualAccount,
  createManualAsset,
  deactivateManualAccount,
  deactivateManualAsset,
  deleteInvestmentSnapshot,
  deleteManualAccount,
  deleteManualAsset,
  updateInvestmentSnapshot,
  updateManualAccount,
  updateManualAsset,
} from "./mutations";
import { getPortfolioData } from "./queries";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeDatabase = testDatabaseUrl ? describe : describe.skip;
const REFERENCE = new Date("2026-07-22T12:00:00.000Z");
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
  await prisma.importJob.deleteMany();
  await prisma.account.deleteMany();
  await prisma.institutionConnection.deleteMany();
  await prisma.dataSource.deleteMany();
  await prisma.manualAsset.deleteMany();
  await prisma.authSession.deleteMany();
  await prisma.user.deleteMany();
}

const accountInput = {
  name: "Integration checking",
  institutionName: "Manual Test Source",
  accountType: AccountType.CHECKING,
  accountSubtype: "checking",
  currency: "USD",
  currentBalance: money("100.1234"),
  availableBalance: null,
  creditLimit: null,
  notes: "Initial note",
};

describeDatabase("Milestone 5 portfolio integration", () => {
  beforeAll(async () => {
    const url = new URL(testDatabaseUrl!);
    if (!url.pathname.toLowerCase().includes("test"))
      throw new Error("TEST_DATABASE_URL must name an isolated test database.");
    prisma = new PrismaClient({
      datasources: { db: { url: testDatabaseUrl } },
    });
    await prisma.$connect();
  });

  beforeEach(async () => {
    await clearTestData();
    ownerId = (await seedDevelopmentData(prisma, REFERENCE)).ownerId;
  });

  afterAll(async () => prisma?.$disconnect());

  it("scopes queries and mutations to the owner", async () => {
    const other = await prisma.user.create({
      data: { email: "portfolio-other@example.test", passwordHash: "disabled" },
    });
    const otherSource = await prisma.dataSource.create({
      data: {
        userId: other.id,
        sourceType: DataSourceType.MANUAL,
        displayName: "Other source",
      },
    });
    const otherAccount = await prisma.account.create({
      data: {
        userId: other.id,
        dataSourceId: otherSource.id,
        name: "Other owner account",
        accountType: AccountType.CHECKING,
        source: "MANUAL",
        currentBalance: money("999999"),
        isManual: true,
      },
    });
    const data = await getPortfolioData(ownerId);
    expect(data.accounts.every(({ userId }) => userId === ownerId)).toBe(true);
    expect(data.accounts.some(({ id }) => id === otherAccount.id)).toBe(false);
    await expect(
      updateManualAccount(ownerId, otherAccount.id, accountInput, prisma),
    ).rejects.toThrow("Manual account not found.");
  });

  it("uses latest authoritative snapshots without double-counting holdings", async () => {
    const raw = await getPortfolioData(ownerId);
    const portfolio = calculatePortfolio(raw, REFERENCE);
    expect(portfolio.totalInvestments.toFixed(4)).toBe("191352.4521");
    expect(portfolio.netWorth.toFixed(4)).toBe("396632.7341");
    expect(
      portfolio.items.find(
        ({ name }) => name === "Archived Synthetic Brokerage",
      )?.isActive,
    ).toBe(false);
    expect(
      portfolio.items.find(({ name }) => name === "UnitedHealth Contribution")
        ?.freshness,
    ).toBe("stale");

    const dashboard = calculateDashboard(
      await getDashboardData(ownerId, REFERENCE),
      REFERENCE,
    );
    expect(dashboard.metrics.netWorth.toFixed(4)).toBe("396632.7341");
  });

  it("queries only owner investment activity and reports explicit contributions", async () => {
    const initial = await getPortfolioData(ownerId);
    const investment = initial.accounts.find(
      ({ accountType }) => accountType === AccountType.BROKERAGE,
    );
    expect(investment).toBeDefined();
    const other = await prisma.user.create({
      data: {
        email: "portfolio-activity-other@example.test",
        passwordHash: "disabled",
      },
    });
    await prisma.investmentTransaction.createMany({
      data: [
        {
          userId: ownerId,
          accountId: investment!.id,
          source: InvestmentSource.IMPORTED,
          providerInvestmentTransactionId: "synthetic-contribution",
          transactionDate: REFERENCE,
          transactionType: InvestmentTransactionType.CONTRIBUTION,
          amount: money("125.4321"),
        },
        {
          userId: ownerId,
          accountId: investment!.id,
          source: InvestmentSource.IMPORTED,
          providerInvestmentTransactionId: "synthetic-dividend",
          transactionDate: REFERENCE,
          transactionType: InvestmentTransactionType.DIVIDEND,
          amount: money("25.0000"),
        },
        {
          userId: other.id,
          accountId: investment!.id,
          source: InvestmentSource.IMPORTED,
          providerInvestmentTransactionId: "cross-owner-contribution",
          transactionDate: REFERENCE,
          transactionType: InvestmentTransactionType.CONTRIBUTION,
          amount: money("999999.0000"),
        },
      ],
    });

    const portfolio = calculatePortfolio(
      await getPortfolioData(ownerId),
      REFERENCE,
    );
    expect(portfolio.investmentInsights.contributions).toHaveLength(1);
    expect(portfolio.investmentInsights.contributionTotal.toFixed(4)).toBe(
      "125.4321",
    );
    expect(portfolio.totalInvestments.toFixed(4)).toBe("191352.4521");
  });

  it("creates, updates, safely deletes, and deactivates manual accounts", async () => {
    const disposable = await createManualAccount(ownerId, accountInput, prisma);
    await updateManualAccount(
      ownerId,
      disposable.id,
      {
        ...accountInput,
        currentBalance: money("101.2345"),
        notes: "Updated note",
      },
      prisma,
    );
    expect(
      await prisma.account.findUniqueOrThrow({ where: { id: disposable.id } }),
    ).toMatchObject({ notes: "Updated note" });
    await deleteManualAccount(ownerId, disposable.id, prisma);
    expect(
      await prisma.account.findUnique({ where: { id: disposable.id } }),
    ).toBeNull();

    const historical = await createManualAccount(
      ownerId,
      { ...accountInput, name: "Historical account" },
      prisma,
    );
    await addBalanceSnapshot(
      ownerId,
      {
        accountId: historical.id,
        currentBalance: money("102.3456"),
        availableBalance: money("100.0000"),
        capturedAt: REFERENCE,
      },
      prisma,
    );
    await expect(
      deleteManualAccount(ownerId, historical.id, prisma),
    ).rejects.toThrow(
      "This account cannot be deleted because it has 1 balance snapshot. Deactivate it instead.",
    );
    await deactivateManualAccount(ownerId, historical.id, prisma);
    expect(
      await prisma.account.findUniqueOrThrow({ where: { id: historical.id } }),
    ).toMatchObject({ isActive: false });
  });

  it("creates, updates, deactivates, and deletes manual assets and debts", async () => {
    const input = {
      name: "Integration vehicle",
      assetType: ManualAssetType.VEHICLE,
      currentValue: money("25000.1234"),
      costBasis: money("30000"),
      currency: "USD",
      acquiredAt: new Date("2025-01-01T00:00:00.000Z"),
      notes: "Synthetic vehicle",
    };
    const asset = await createManualAsset(ownerId, input, prisma);
    await updateManualAsset(
      ownerId,
      asset.id,
      {
        ...input,
        assetType: ManualAssetType.AUTO_LOAN,
        currentValue: money("12345.6789"),
      },
      prisma,
    );
    expect(
      await prisma.manualAsset.findUniqueOrThrow({ where: { id: asset.id } }),
    ).toMatchObject({ isDebt: true });
    await deactivateManualAsset(ownerId, asset.id, prisma);
    expect(
      await prisma.manualAsset.findUniqueOrThrow({ where: { id: asset.id } }),
    ).toMatchObject({ isActive: false });
    await deleteManualAsset(ownerId, asset.id, prisma);
    expect(
      await prisma.manualAsset.findUnique({ where: { id: asset.id } }),
    ).toBeNull();
  });

  it("persists exact investment snapshots, prevents duplicates, and supports edits", async () => {
    const account = await createManualAccount(
      ownerId,
      {
        ...accountInput,
        name: "Integration Roth IRA",
        accountType: AccountType.RETIREMENT,
        accountSubtype: "Roth IRA",
      },
      prisma,
    );
    const input = {
      accountId: account.id,
      totalValue: money("12345.6789"),
      vestedValue: null,
      asOfDate: REFERENCE,
      notes: "Exact snapshot",
    };
    const snapshot = await addInvestmentSnapshot(ownerId, input, prisma);
    expect(snapshot.totalValue.toFixed(4)).toBe("12345.6789");
    await expect(addInvestmentSnapshot(ownerId, input, prisma)).rejects.toThrow(
      "already exists",
    );
    await updateInvestmentSnapshot(
      ownerId,
      snapshot.id,
      {
        ...input,
        totalValue: money("12346.7890"),
        notes: "Corrected snapshot",
      },
      prisma,
    );
    expect(
      await prisma.investmentBalanceSnapshot.findUniqueOrThrow({
        where: { id: snapshot.id },
      }),
    ).toMatchObject({ notes: "Corrected snapshot" });
    await deleteInvestmentSnapshot(ownerId, snapshot.id, prisma);
    expect(
      await prisma.investmentBalanceSnapshot.findUnique({
        where: { id: snapshot.id },
      }),
    ).toBeNull();
  });

  it("provides only editable metadata in all known Fidelity templates", () => {
    expect(FIDELITY_TEMPLATES.map(({ label }) => label)).toEqual([
      "Fidelity Individual TOD",
      "UnitedHealth Contribution",
      "UnitedHealth Group 401(k) Savings Plan",
    ]);
    for (const template of FIDELITY_TEMPLATES) {
      expect(template).not.toHaveProperty("credentials");
      expect(template).not.toHaveProperty("accessToken");
      expect(template.source).toBe("MANUAL");
    }
  });
});
