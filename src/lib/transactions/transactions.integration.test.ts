// @vitest-environment node

import {
  AccountSource,
  AccountType,
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

import { updateTransactionOverride } from "./mutations";
import { getTransactionDetail, getTransactionLedger } from "./queries";

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

async function fixture() {
  const owner = await prisma.user.create({
    data: { email: "m8-owner@example.test", passwordHash: "disabled" },
  });
  const other = await prisma.user.create({
    data: { email: "m8-other@example.test", passwordHash: "disabled" },
  });
  const source = await prisma.dataSource.create({
    data: {
      userId: owner.id,
      sourceType: DataSourceType.MANUAL,
      displayName: "Owner manual source",
    },
  });
  const account = await prisma.account.create({
    data: {
      userId: owner.id,
      dataSourceId: source.id,
      name: "Owner checking",
      accountType: AccountType.CHECKING,
      source: AccountSource.MANUAL,
      currentBalance: new Prisma.Decimal("1000.0000"),
      isManual: true,
    },
  });
  const plaidSource = await prisma.dataSource.create({
    data: {
      userId: owner.id,
      sourceType: DataSourceType.PLAID,
      displayName: "Historical Plaid source",
    },
  });
  const disconnected = await prisma.institutionConnection.create({
    data: {
      userId: owner.id,
      dataSourceId: plaidSource.id,
      provider: "PLAID",
      providerItemId: "historical-item",
      institutionName: "Historical Bank",
      status: ConnectionStatus.DISCONNECTED,
      disconnectedAt: new Date("2026-06-01T00:00:00Z"),
    },
  });
  const historicalAccount = await prisma.account.create({
    data: {
      userId: owner.id,
      dataSourceId: plaidSource.id,
      institutionConnectionId: disconnected.id,
      providerAccountId: "historical-account",
      providerIdentityKey: "a".repeat(64),
      name: "Historical checking",
      accountType: AccountType.CHECKING,
      source: AccountSource.SYNCED,
      currentBalance: new Prisma.Decimal("25.0000"),
      isManual: false,
      isActive: false,
    },
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
      name: "Other checking",
      accountType: AccountType.CHECKING,
      source: AccountSource.MANUAL,
      currentBalance: new Prisma.Decimal("1.0000"),
      isManual: true,
    },
  });
  const coffee = await prisma.transaction.create({
    data: {
      userId: owner.id,
      accountId: account.id,
      providerTransactionId: "coffee-posted",
      originalName: "ORIGINAL COFFEE SHOP",
      merchantName: "Provider Coffee",
      amount: new Prisma.Decimal("12.3400"),
      currency: "USD",
      authorizedAt: new Date("2026-07-02T12:00:00Z"),
      postedAt: new Date("2026-07-03T12:00:00Z"),
      status: TransactionStatus.POSTED,
      providerCategory: "Food",
      rawProviderPayload: { private: "not-for-ui" },
    },
  });
  const pending = await prisma.transaction.create({
    data: {
      userId: owner.id,
      accountId: account.id,
      providerTransactionId: "pending-transfer",
      originalName: "PENDING TRANSFER",
      amount: new Prisma.Decimal("-20.0000"),
      authorizedAt: new Date("2026-07-04T12:00:00Z"),
      status: TransactionStatus.PENDING,
      providerCategory: null,
    },
  });
  const historical = await prisma.transaction.create({
    data: {
      userId: owner.id,
      accountId: historicalAccount.id,
      providerTransactionId: "retained-history",
      originalName: "RETAINED HISTORY",
      amount: new Prisma.Decimal("4.5000"),
      postedAt: new Date("2026-06-15T12:00:00Z"),
      status: TransactionStatus.CANCELED,
      removedAt: new Date("2026-06-16T12:00:00Z"),
    },
  });
  const otherTransaction = await prisma.transaction.create({
    data: {
      userId: other.id,
      accountId: otherAccount.id,
      originalName: "OTHER OWNER SECRET",
      amount: new Prisma.Decimal("999.0000"),
      postedAt: new Date("2026-07-03T12:00:00Z"),
      status: TransactionStatus.POSTED,
    },
  });
  return {
    owner,
    other,
    account,
    historicalAccount,
    coffee,
    pending,
    historical,
    otherTransaction,
  };
}

describeDatabase("Milestone 8 transaction persistence", () => {
  beforeAll(async () => {
    const url = new URL(testDatabaseUrl!);
    if (!url.pathname.toLowerCase().includes("test"))
      throw new Error("TEST_DATABASE_URL must name an isolated test database.");
    if (process.env.DATABASE_URL !== testDatabaseUrl)
      throw new Error(
        "DATABASE_URL and TEST_DATABASE_URL must match for transaction integration tests.",
      );
    prisma = new PrismaClient({
      datasources: { db: { url: testDatabaseUrl } },
    });
    await prisma.$connect();
  });

  beforeEach(clearTestData);
  afterAll(async () => prisma?.$disconnect());

  it("lists only owner history in deterministic order and keeps historical accounts out of filter options", async () => {
    const data = await fixture();
    const ledger = await getTransactionLedger(data.owner.id, {});

    expect(ledger.transactions.map(({ id }) => id)).toEqual([
      data.pending.id,
      data.coffee.id,
      data.historical.id,
    ]);
    expect(
      ledger.transactions.find(({ id }) => id === data.historical.id),
    ).toMatchObject({ isHistorical: true });
    expect(ledger.accounts.map(({ id }) => id)).toEqual([data.account.id]);
    expect(
      ledger.transactions.some(({ id }) => id === data.otherTransaction.id),
    ).toBe(false);
  });

  it("sorts Date, Transaction, and displayed Amount in both directions with filters", async () => {
    const data = await fixture();
    await prisma.transactionOverride.create({
      data: {
        userId: data.owner.id,
        transactionId: data.coffee.id,
        categoryOverride: "Owner dining",
        merchantNameOverride: "Aardvark Coffee",
      },
    });

    expect(
      (
        await getTransactionLedger(data.owner.id, {
          sort: "date",
          direction: "asc",
        })
      ).transactions.map(({ id }) => id),
    ).toEqual([data.historical.id, data.coffee.id, data.pending.id]);
    expect(
      (
        await getTransactionLedger(data.owner.id, {
          sort: "date",
          direction: "desc",
        })
      ).transactions.map(({ id }) => id),
    ).toEqual([data.pending.id, data.coffee.id, data.historical.id]);
    expect(
      (
        await getTransactionLedger(data.owner.id, {
          sort: "transaction",
          direction: "asc",
        })
      ).transactions.map(({ id }) => id),
    ).toEqual([data.coffee.id, data.pending.id, data.historical.id]);
    expect(
      (
        await getTransactionLedger(data.owner.id, {
          sort: "transaction",
          direction: "desc",
        })
      ).transactions.map(({ id }) => id),
    ).toEqual([data.historical.id, data.pending.id, data.coffee.id]);
    expect(
      (
        await getTransactionLedger(data.owner.id, {
          sort: "amount",
          direction: "asc",
        })
      ).transactions.map(({ id }) => id),
    ).toEqual([data.historical.id, data.coffee.id, data.pending.id]);
    expect(
      (
        await getTransactionLedger(data.owner.id, {
          sort: "amount",
          direction: "desc",
        })
      ).transactions.map(({ id }) => id),
    ).toEqual([data.pending.id, data.coffee.id, data.historical.id]);

    const filtered = await getTransactionLedger(data.owner.id, {
      category: "Owner dining",
      sort: "transaction",
      direction: "desc",
    });
    expect(filtered.transactions.map(({ id }) => id)).toEqual([data.coffee.id]);
  });

  it("applies effective search/category, UTC date, account, status, and exact absolute amount filters", async () => {
    const data = await fixture();
    await updateTransactionOverride(data.owner.id, data.coffee.id, {
      categoryOverride: "Owner dining",
      financialRoleOverride: FinancialRole.EXPENSE,
    });
    expect(
      (await getTransactionLedger(data.owner.id, { search: "coffee shop" }))
        .total,
    ).toBe(1);
    expect(
      (await getTransactionLedger(data.owner.id, { category: "owner DINING" }))
        .total,
    ).toBe(1);
    expect(
      (
        await getTransactionLedger(data.owner.id, {
          dateFrom: "2026-07-03",
          dateTo: "2026-07-03",
          accountId: data.account.id,
          status: TransactionStatus.POSTED,
          amountMin: "12.3400",
          amountMax: "12.3400",
        })
      ).transactions.map(({ id }) => id),
    ).toEqual([data.coffee.id]);
  });

  it("bounds history to 50 rows and provides deterministic pagination", async () => {
    const data = await fixture();
    await prisma.transaction.createMany({
      data: Array.from({ length: 50 }, (_, index) => ({
        userId: data.owner.id,
        accountId: data.account.id,
        providerTransactionId: `page-${index}`,
        originalName: `PAGE ITEM ${index}`,
        amount: new Prisma.Decimal(index + 1),
        postedAt: new Date(
          `2026-05-${String((index % 28) + 1).padStart(2, "0")}T00:00:00Z`,
        ),
        status: TransactionStatus.POSTED,
      })),
    });
    const first = await getTransactionLedger(data.owner.id, {
      sort: "amount",
      direction: "asc",
    });
    const second = await getTransactionLedger(data.owner.id, {
      sort: "amount",
      direction: "asc",
      page: "2",
    });

    expect(first.total).toBe(53);
    expect(first.transactions).toHaveLength(50);
    expect(first.pageCount).toBe(2);
    expect(second.transactions).toHaveLength(3);
    expect(
      new Set(
        [...first.transactions, ...second.transactions].map(({ id }) => id),
      ).size,
    ).toBe(53);
    const orderedAmounts = [...first.transactions, ...second.transactions].map(
      ({ amount }) => amount.abs(),
    );
    expect(
      orderedAmounts.every(
        (amount, index) =>
          index === 0 || amount.greaterThanOrEqualTo(orderedAmounts[index - 1]),
      ),
    ).toBe(true);
  });

  it("treats an owner historical account ID as unavailable rather than exposing it as a filter", async () => {
    const data = await fixture();
    const ledger = await getTransactionLedger(data.owner.id, {
      accountId: data.historicalAccount.id,
    });
    expect(ledger.selectedAccountUnavailable).toBe(true);
    expect(ledger.total).toBe(0);
  });

  it("creates, updates, and clears editable overrides without changing provider fields or unrelated local metadata", async () => {
    const data = await fixture();
    await prisma.transactionOverride.create({
      data: {
        userId: data.owner.id,
        transactionId: data.coffee.id,
        merchantNameOverride: "Retained merchant",
        linkedTransactionId: data.pending.id,
      },
    });
    await updateTransactionOverride(data.owner.id, data.coffee.id, {
      categoryOverride: "Dining",
      financialRoleOverride: FinancialRole.EXPENSE,
      notes: "Owner-only note",
      excludedFromReports: true,
    });
    await updateTransactionOverride(data.owner.id, data.coffee.id, {
      categoryOverride: null,
      financialRoleOverride: null,
      notes: null,
      excludedFromReports: false,
    });

    expect(
      await prisma.transaction.findUniqueOrThrow({
        where: { id: data.coffee.id },
      }),
    ).toMatchObject({
      originalName: "ORIGINAL COFFEE SHOP",
      merchantName: "Provider Coffee",
      amount: new Prisma.Decimal("12.3400"),
      status: TransactionStatus.POSTED,
      providerCategory: "Food",
    });
    expect(
      await prisma.transactionOverride.findUniqueOrThrow({
        where: { transactionId: data.coffee.id },
      }),
    ).toMatchObject({
      merchantNameOverride: "Retained merchant",
      linkedTransactionId: data.pending.id,
      categoryOverride: null,
      financialRoleOverride: null,
      notes: null,
      excludedFromReports: false,
    });
  });

  it("deletes an empty override row and rejects cross-owner mutations as missing", async () => {
    const data = await fixture();
    await updateTransactionOverride(data.owner.id, data.pending.id, {
      notes: "temporary",
    });
    await updateTransactionOverride(data.owner.id, data.pending.id, {
      notes: null,
    });
    expect(
      await prisma.transactionOverride.findUnique({
        where: { transactionId: data.pending.id },
      }),
    ).toBeNull();
    await expect(
      updateTransactionOverride(data.owner.id, data.otherTransaction.id, {
        notes: "leak",
      }),
    ).rejects.toThrow("Transaction not found.");
  });

  it("returns owner-scoped detail with effective values and never selects raw payloads", async () => {
    const data = await fixture();
    await updateTransactionOverride(data.owner.id, data.coffee.id, {
      categoryOverride: "Local category",
      notes: "Safe note",
    });
    const detail = await getTransactionDetail(data.owner.id, data.coffee.id);

    expect(detail).toMatchObject({
      id: data.coffee.id,
      effective: { category: "Local category", notes: "Safe note" },
    });
    expect(detail).not.toHaveProperty("rawProviderPayload");
    expect(
      await getTransactionDetail(data.other.id, data.coffee.id),
    ).toBeNull();
    expect(
      await getTransactionDetail(data.owner.id, "x".repeat(129)),
    ).toBeNull();
  });
});
