// @vitest-environment node

import {
  AccountSource,
  AccountType,
  CalendarDateSource,
  CalendarEventStatus,
  ConfidenceLevel,
  DataSourceType,
  FinancialRole,
  Prisma,
  PrismaClient,
  RecurringFlowType,
  RecurringFrequency,
  RecurringStatus,
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

import { runRecurringDetection } from "./persistence";
import {
  ensureTransactionTruthReady,
  TRANSACTION_TRUTH_VERSION,
} from "@/lib/transactions/truth";
import { TRANSACTION_CLASSIFIER_VERSION } from "@/lib/transactions/classifier";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeDatabase = testDatabaseUrl ? describe : describe.skip;
const NOW = new Date("2026-04-02T12:00:00.000Z");
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

function day(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

async function ownerFixture(suffix: string) {
  const owner = await prisma.user.create({
    data: {
      email: `recurring-${suffix}@example.test`,
      passwordHash: "not-a-login",
    },
  });
  const source = await prisma.dataSource.create({
    data: {
      userId: owner.id,
      sourceType: DataSourceType.MANUAL,
      displayName: `Synthetic source ${suffix}`,
    },
  });
  const account = await prisma.account.create({
    data: {
      userId: owner.id,
      dataSourceId: source.id,
      name: `Synthetic checking ${suffix}`,
      accountType: AccountType.CHECKING,
      source: AccountSource.MANUAL,
      currency: "USD",
      currentBalance: new Prisma.Decimal("1000"),
      isManual: true,
    },
  });
  return { owner, source, account };
}

async function recurringHistory(
  fixture: Awaited<ReturnType<typeof ownerFixture>>,
  values: Array<{
    date: string;
    amount?: string;
    status?: TransactionStatus;
    removedAt?: Date | null;
  }> = [{ date: "2026-01-01" }, { date: "2026-02-01" }, { date: "2026-03-01" }],
) {
  for (const [index, value] of values.entries()) {
    const transaction = await prisma.transaction.create({
      data: {
        id: `${fixture.owner.id}-history-${index}`,
        userId: fixture.owner.id,
        accountId: fixture.account.id,
        originalName: "EXAMPLE INTERNET 12345",
        merchantName: "Example Internet",
        amount: new Prisma.Decimal(value.amount ?? "80"),
        currency: "USD",
        postedAt: day(value.date),
        status: value.status ?? TransactionStatus.POSTED,
        providerCategory: "UTILITIES_INTERNET",
        removedAt: value.removedAt ?? null,
      },
    });
    await prisma.transactionOverride.create({
      data: {
        userId: fixture.owner.id,
        transactionId: transaction.id,
        categoryOverride: "Internet",
        financialRoleOverride: FinancialRole.EXPENSE,
      },
    });
  }
}

describeDatabase("Milestone 7 recurring detection integration", () => {
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

  it("is owner scoped and safely handles no eligible history", async () => {
    const first = await ownerFixture("first");
    const second = await ownerFixture("second");
    await recurringHistory(first);
    await recurringHistory(second);

    const result = await runRecurringDetection(first.owner.id, {
      database: prisma,
      now: NOW,
    });
    expect(result.candidates).toBe(1);
    expect(
      await prisma.recurringStream.count({
        where: { userId: first.owner.id, detectionKey: { not: null } },
      }),
    ).toBe(1);
    expect(
      await prisma.recurringStream.count({
        where: { userId: second.owner.id, detectionKey: { not: null } },
      }),
    ).toBe(0);

    const empty = await ownerFixture("empty");
    await expect(
      runRecurringDetection(empty.owner.id, { database: prisma, now: NOW }),
    ).resolves.toMatchObject({
      eligibleTransactions: 0,
      candidates: 0,
      streamsCreated: 0,
      projectionsCreated: 0,
    });
  });

  it("repairs incremental readiness gaps before recurring detection", async () => {
    const fixture = await ownerFixture("incremental-readiness");
    await ensureTransactionTruthReady(fixture.owner.id, prisma);
    await recurringHistory(fixture);

    const first = await runRecurringDetection(fixture.owner.id, {
      database: prisma,
      now: NOW,
    });
    expect(first.candidates).toBe(1);
    expect(
      await prisma.transactionClassification.count({
        where: {
          userId: fixture.owner.id,
          classifierVersion: TRANSACTION_CLASSIFIER_VERSION,
        },
      }),
    ).toBe(3);

    const stale = await prisma.transactionClassification.findFirstOrThrow({
      where: { userId: fixture.owner.id },
    });
    await prisma.transactionClassification.update({
      where: { id: stale.id },
      data: { classifierVersion: TRANSACTION_CLASSIFIER_VERSION - 1 },
    });
    const second = await runRecurringDetection(fixture.owner.id, {
      database: prisma,
      now: NOW,
    });
    expect(second.candidates).toBe(1);
    expect(
      await prisma.transactionClassification.findUniqueOrThrow({
        where: { id: stale.id },
        select: { classifierVersion: true },
      }),
    ).toEqual({ classifierVersion: TRANSACTION_CLASSIFIER_VERSION });
    expect(
      await prisma.user.findUniqueOrThrow({
        where: { id: fixture.owner.id },
        select: { transactionTruthVersion: true },
      }),
    ).toEqual({ transactionTruthVersion: TRANSACTION_TRUTH_VERSION });
  });

  it("fails closed when a noncanonical transaction appears after readiness verification", async () => {
    const fixture = await ownerFixture("readiness-race");
    await ensureTransactionTruthReady(fixture.owner.id, prisma);
    let injected = false;
    const database = new Proxy(prisma, {
      get(target, property, receiver) {
        if (property === "$transaction")
          return async (...args: Parameters<PrismaClient["$transaction"]>) => {
            if (!injected) {
              injected = true;
              await recurringHistory(fixture);
            }
            return Reflect.apply(target.$transaction, target, args);
          };
        const value = Reflect.get(target, property, receiver);
        return typeof value === "function" ? value.bind(target) : value;
      },
    }) as PrismaClient;

    const result = await runRecurringDetection(fixture.owner.id, {
      database,
      now: NOW,
    });
    expect(result).toMatchObject({ eligibleTransactions: 0, candidates: 0 });
    expect(
      await prisma.transactionClassification.count({
        where: { userId: fixture.owner.id },
      }),
    ).toBe(0);
    expect(
      await prisma.recurringStream.count({
        where: { userId: fixture.owner.id },
      }),
    ).toBe(0);
  });

  it("upserts streams and bounded projections idempotently across repeated and concurrent runs", async () => {
    const fixture = await ownerFixture("idempotent");
    await recurringHistory(fixture);

    await runRecurringDetection(fixture.owner.id, {
      database: prisma,
      now: NOW,
    });
    await runRecurringDetection(fixture.owner.id, {
      database: prisma,
      now: NOW,
    });
    await Promise.all([
      runRecurringDetection(fixture.owner.id, {
        database: prisma,
        now: NOW,
      }),
      runRecurringDetection(fixture.owner.id, {
        database: prisma,
        now: NOW,
      }),
    ]);

    const streams = await prisma.recurringStream.findMany({
      where: { userId: fixture.owner.id, detectionKey: { not: null } },
    });
    const events = await prisma.calendarEvent.findMany({
      where: { userId: fixture.owner.id, projectionKey: { not: null } },
      orderBy: { eventDate: "asc" },
    });
    expect(streams).toHaveLength(1);
    expect(
      events.map(({ eventDate }) => eventDate.toISOString().slice(0, 10)),
    ).toEqual(["2026-05-01", "2026-06-01", "2026-07-01"]);
    expect(new Set(events.map(({ projectionKey }) => projectionKey)).size).toBe(
      events.length,
    );
  });

  it("preserves manual streams, confirmed dates, deactivation overrides, and skipped history", async () => {
    const fixture = await ownerFixture("precedence");
    await recurringHistory(fixture);
    await runRecurringDetection(fixture.owner.id, {
      database: prisma,
      now: NOW,
    });
    const inferred = await prisma.recurringStream.findFirstOrThrow({
      where: { userId: fixture.owner.id, detectionKey: { not: null } },
    });
    const confirmedDueDate = day("2026-05-05");
    await prisma.recurringStream.update({
      where: { id: inferred.id },
      data: { confirmedDueDate },
    });
    await prisma.calendarOverride.create({
      data: {
        userId: fixture.owner.id,
        recurringStreamId: inferred.id,
        statusOverride: CalendarEventStatus.INACTIVE,
      },
    });
    const skipped = await prisma.calendarEvent.findFirstOrThrow({
      where: {
        userId: fixture.owner.id,
        recurringStreamId: inferred.id,
        projectionKey: { not: null },
      },
    });
    await prisma.calendarEvent.update({
      where: { id: skipped.id },
      data: { status: CalendarEventStatus.SKIPPED },
    });
    const manual = await prisma.recurringStream.create({
      data: {
        userId: fixture.owner.id,
        merchantName: "Manual rent",
        description: "Owner-created stream",
        flowType: RecurringFlowType.BILL,
        frequency: RecurringFrequency.MONTHLY,
        averageAmount: new Prisma.Decimal("1000"),
        lastAmount: new Prisma.Decimal("1000"),
        firstDate: day("2026-01-01"),
        lastDate: day("2026-03-01"),
        predictedNextDate: day("2026-04-01"),
        confirmedDueDate: day("2026-04-01"),
        dateSource: CalendarDateSource.MANUAL,
        confidenceLevel: ConfidenceLevel.HIGH,
        status: RecurringStatus.ACTIVE,
      },
    });

    await runRecurringDetection(fixture.owner.id, {
      database: prisma,
      now: NOW,
    });

    expect(
      await prisma.recurringStream.findUniqueOrThrow({
        where: { id: inferred.id },
      }),
    ).toMatchObject({ confirmedDueDate });
    expect(
      await prisma.calendarOverride.count({
        where: {
          userId: fixture.owner.id,
          recurringStreamId: inferred.id,
          statusOverride: CalendarEventStatus.INACTIVE,
        },
      }),
    ).toBe(1);
    expect(
      await prisma.calendarEvent.findUniqueOrThrow({
        where: { id: skipped.id },
      }),
    ).toMatchObject({ status: CalendarEventStatus.SKIPPED });
    expect(
      await prisma.recurringStream.findUniqueOrThrow({
        where: { id: manual.id },
      }),
    ).toMatchObject({
      description: "Owner-created stream",
      detectionKey: null,
      dateSource: CalendarDateSource.MANUAL,
    });
  });

  it("matches only an eligible posted transaction and cannot reuse it", async () => {
    const fixture = await ownerFixture("matching");
    await recurringHistory(fixture);
    await runRecurringDetection(fixture.owner.id, {
      database: prisma,
      now: NOW,
    });
    const createTransaction = async (
      id: string,
      status: TransactionStatus,
      removedAt: Date | null,
      postedAt: string,
    ) => {
      const transaction = await prisma.transaction.create({
        data: {
          id,
          userId: fixture.owner.id,
          accountId: fixture.account.id,
          originalName: "EXAMPLE INTERNET",
          merchantName: "Example Internet",
          amount: new Prisma.Decimal("80"),
          currency: "USD",
          postedAt: day(postedAt),
          status,
          providerCategory: "UTILITIES_INTERNET",
          removedAt,
        },
      });
      await prisma.transactionOverride.create({
        data: {
          userId: fixture.owner.id,
          transactionId: transaction.id,
          financialRoleOverride: FinancialRole.EXPENSE,
        },
      });
      return transaction;
    };
    const pending = await createTransaction(
      "pending-near-event",
      TransactionStatus.PENDING,
      null,
      "2026-05-01",
    );
    await createTransaction(
      "removed-near-event",
      TransactionStatus.POSTED,
      day("2026-05-02"),
      "2026-05-01",
    );
    const posted = await createTransaction(
      "posted-near-event",
      TransactionStatus.POSTED,
      null,
      "2026-05-02",
    );
    await prisma.transaction.update({
      where: { id: posted.id },
      data: { pendingTransactionId: pending.id },
    });

    const result = await runRecurringDetection(fixture.owner.id, {
      database: prisma,
      now: new Date("2026-05-03T12:00:00.000Z"),
    });
    expect(result.transactionsMatched).toBe(1);
    const matched = await prisma.calendarEvent.findFirstOrThrow({
      where: {
        userId: fixture.owner.id,
        linkedTransactionId: posted.id,
      },
    });
    expect(matched).toMatchObject({
      status: CalendarEventStatus.PAID,
      actualAmount: new Prisma.Decimal("80"),
    });
    expect(matched.linkedTransactionId).toBe(posted.id);
    await expect(
      prisma.calendarEvent.create({
        data: {
          userId: fixture.owner.id,
          linkedTransactionId: posted.id,
          eventType: "BILL",
          title: "Duplicate payment link",
          eventDate: day("2026-06-01"),
          currency: "USD",
          dateSource: "INFERRED",
          amountSource: "FIXED",
          confidenceLevel: "HIGH",
          status: "PAID",
        },
      }),
    ).rejects.toMatchObject({ code: "P2002" });
  });

  it("does not persist an old low-confidence pattern", async () => {
    const fixture = await ownerFixture("low");
    await recurringHistory(fixture, [
      { date: "2025-01-01", amount: "80" },
      { date: "2025-02-01", amount: "200" },
      { date: "2025-03-01", amount: "400" },
    ]);
    const result = await runRecurringDetection(fixture.owner.id, {
      database: prisma,
      now: NOW,
    });
    expect(result.candidates).toBe(1);
    expect(result.streamsCreated).toBe(0);
    expect(
      await prisma.recurringStream.count({
        where: { userId: fixture.owner.id, detectionKey: { not: null } },
      }),
    ).toBe(0);
  });

  it("marks only inferred patterns inactive after two missed cycles without erasing history", async () => {
    const fixture = await ownerFixture("inactive");
    await recurringHistory(fixture);
    await runRecurringDetection(fixture.owner.id, {
      database: prisma,
      now: NOW,
    });
    const stream = await prisma.recurringStream.findFirstOrThrow({
      where: { userId: fixture.owner.id, detectionKey: { not: null } },
    });
    const historicalEventCount = await prisma.calendarEvent.count({
      where: { recurringStreamId: stream.id },
    });

    await runRecurringDetection(fixture.owner.id, {
      database: prisma,
      now: new Date("2026-09-01T12:00:00.000Z"),
    });

    expect(
      await prisma.recurringStream.findUniqueOrThrow({
        where: { id: stream.id },
      }),
    ).toMatchObject({
      isActive: false,
      status: RecurringStatus.INACTIVE,
    });
    expect(
      await prisma.calendarEvent.count({
        where: { recurringStreamId: stream.id },
      }),
    ).toBe(historicalEventCount);
  });
});
