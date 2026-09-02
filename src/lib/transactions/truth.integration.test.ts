// @vitest-environment node

import {
  AccountSource,
  AccountType,
  CalendarAmountSource,
  CalendarDateSource,
  CalendarEventStatus,
  CalendarEventType,
  ClassificationCertainty,
  ClassificationRuleMatchType,
  DataSourceType,
  EconomicDirection,
  FinancialRole,
  Prisma,
  PrismaClient,
  TransactionRelationshipState,
  TransactionRelationshipType,
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

import {
  confirmHistoricalRuleApplication,
  createFutureClassificationRule,
  previewHistoricalRuleApplication,
  replaceTransactionAllocations,
} from "./mutations";
import {
  createRefundRelationship,
  resolveLegacyRelationship,
  setRelationshipState,
  suggestMovementRelationships,
} from "./relationships";
import {
  backfillOwnerTransactionTruth,
  classifyStoredTransactions,
  ensureTransactionTruthReady,
  preservePendingOwnerState,
  TRANSACTION_TRUTH_BACKFILL_BATCH_SIZE,
  TRANSACTION_TRUTH_VERSION,
} from "./truth";
import { TRANSACTION_CLASSIFIER_VERSION } from "./classifier";
import { effectiveTransactionValues } from "./effective";
import { isFinalizedReportingEligible } from "./eligibility";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeDatabase = testDatabaseUrl ? describe : describe.skip;
let prisma: PrismaClient;

async function clearTestData() {
  await prisma.user.deleteMany();
}

async function fixture() {
  const owner = await prisma.user.create({
    data: {
      email: `hc1-owner-${crypto.randomUUID()}@example.test`,
      passwordHash: "disabled",
    },
  });
  const source = await prisma.dataSource.create({
    data: {
      userId: owner.id,
      sourceType: DataSourceType.MANUAL,
      displayName: "Synthetic HC1 source",
    },
  });
  const account = await prisma.account.create({
    data: {
      userId: owner.id,
      dataSourceId: source.id,
      name: "Synthetic checking",
      accountType: AccountType.CHECKING,
      source: AccountSource.MANUAL,
      currentBalance: new Prisma.Decimal("1000"),
      isManual: true,
    },
  });
  const secondAccount = await prisma.account.create({
    data: {
      userId: owner.id,
      dataSourceId: source.id,
      name: "Synthetic savings",
      accountType: AccountType.SAVINGS,
      source: AccountSource.MANUAL,
      currentBalance: new Prisma.Decimal("500"),
      isManual: true,
    },
  });
  return { owner, source, account, secondAccount };
}

function transactionData(
  ownerId: string,
  accountId: string,
  values: Partial<Prisma.TransactionUncheckedCreateInput> = {},
) {
  return {
    userId: ownerId,
    accountId,
    originalName: "EXAMPLE MARKET",
    merchantName: "Example Market",
    amount: new Prisma.Decimal("50.0000"),
    currency: "USD",
    postedAt: new Date("2026-08-15T00:00:00Z"),
    status: TransactionStatus.POSTED,
    providerCategory: "FOOD_AND_DRINK_GROCERIES",
    ...values,
  } satisfies Prisma.TransactionUncheckedCreateInput;
}

describeDatabase("Household Control 1 transaction truth", () => {
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

  it("bootstraps once, classifies deterministically, cuts over owner-scoped, and preserves customization", async () => {
    const { owner, account } = await fixture();
    const transaction = await prisma.transaction.create({
      data: transactionData(owner.id, account.id),
    });
    await backfillOwnerTransactionTruth(owner.id, prisma);
    const groceries = await prisma.transactionCategory.findFirstOrThrow({
      where: { userId: owner.id, systemKey: "expense.groceries" },
    });
    expect(
      await prisma.transactionCategory.count({ where: { userId: owner.id } }),
    ).toBe(21);
    expect(
      await prisma.transactionClassification.findUnique({
        where: { transactionId: transaction.id },
      }),
    ).toMatchObject({
      financialRole: FinancialRole.EXPENSE,
      transactionCategoryId: groceries.id,
      economicDirection: EconomicDirection.OUTFLOW,
    });
    await prisma.transactionCategory.update({
      where: { id: groceries.id },
      data: { name: "Food at home", isActive: false, displayOrder: 999 },
    });
    await prisma.user.update({
      where: { id: owner.id },
      data: { transactionTruthCutoverAt: null, transactionTruthVersion: null },
    });
    await backfillOwnerTransactionTruth(owner.id, prisma);
    expect(
      await prisma.transactionCategory.count({ where: { userId: owner.id } }),
    ).toBe(21);
    expect(
      await prisma.transactionCategory.findUnique({
        where: { id: groceries.id },
      }),
    ).toMatchObject({
      name: "Food at home",
      isActive: false,
      displayOrder: 999,
    });
  });

  it("repairs current readiness gaps in bounded resumable batches without redoing ready history", async () => {
    const { owner, account } = await fixture();
    const transactionCount = TRANSACTION_TRUTH_BACKFILL_BATCH_SIZE + 3;
    await prisma.transaction.createMany({
      data: Array.from({ length: transactionCount }, (_, index) =>
        transactionData(owner.id, account.id, {
          id: `${owner.id}-bounded-${String(index).padStart(4, "0")}`,
          postedAt: new Date(Date.UTC(2025, 0, 1 + index)),
        }),
      ),
    });
    await prisma.user.update({
      where: { id: owner.id },
      data: {
        transactionTruthVersion: TRANSACTION_TRUTH_VERSION,
        transactionTruthCutoverAt: new Date(),
      },
    });

    const findMany = vi.spyOn(prisma.transaction, "findMany");
    await ensureTransactionTruthReady(owner.id, prisma);
    const backfillReads = findMany.mock.calls
      .map(([args]) => args)
      .filter(
        (args) =>
          args?.take === TRANSACTION_TRUTH_BACKFILL_BATCH_SIZE &&
          args?.where &&
          "OR" in args.where,
      );
    expect(backfillReads).toHaveLength(3);
    expect(
      await prisma.transactionClassification.count({
        where: {
          userId: owner.id,
          classifierVersion: TRANSACTION_CLASSIFIER_VERSION,
        },
      }),
    ).toBe(transactionCount);

    const stale = await prisma.transactionClassification.findFirstOrThrow({
      where: { userId: owner.id },
      orderBy: { transactionId: "asc" },
    });
    await prisma.transactionClassification.update({
      where: { id: stale.id },
      data: { classifierVersion: TRANSACTION_CLASSIFIER_VERSION - 1 },
    });
    findMany.mockClear();
    await ensureTransactionTruthReady(owner.id, prisma);
    expect(
      await prisma.transactionClassification.findUniqueOrThrow({
        where: { id: stale.id },
        select: { classifierVersion: true },
      }),
    ).toEqual({ classifierVersion: TRANSACTION_CLASSIFIER_VERSION });
    expect(
      findMany.mock.calls.some(
        ([args]) => args?.take === TRANSACTION_TRUTH_BACKFILL_BATCH_SIZE,
      ),
    ).toBe(true);

    findMany.mockClear();
    await ensureTransactionTruthReady(owner.id, prisma);
    expect(findMany).not.toHaveBeenCalled();
    findMany.mockRestore();
  });

  it("preserves ambiguous legacy links as non-economic, idempotent review state", async () => {
    const { owner, account, secondAccount } = await fixture();
    const [expense, income] = await Promise.all([
      prisma.transaction.create({
        data: transactionData(owner.id, account.id, {
          amount: new Prisma.Decimal("100"),
          providerCategory: "FOOD_AND_DRINK_GROCERIES",
        }),
      }),
      prisma.transaction.create({
        data: transactionData(owner.id, secondAccount.id, {
          amount: new Prisma.Decimal("-100"),
          providerCategory: "INCOME_WAGES",
        }),
      }),
    ]);
    await prisma.transactionOverride.create({
      data: {
        userId: owner.id,
        transactionId: expense.id,
        linkedTransactionId: income.id,
      },
    });

    const first = await backfillOwnerTransactionTruth(owner.id, prisma);
    expect(first).toMatchObject({
      encountered: 1,
      legacyUntyped: 1,
      structurallyInvalid: 0,
      stillNonNull: 1,
      functionallyLegacyDependent: 1,
      correspondingTypedRelationships: 0,
      rerunDelta: 1,
      deterministicallyConverted: {
        INTERNAL_TRANSFER: 0,
        CREDIT_CARD_PAYMENT: 0,
        REFUND: 0,
        REIMBURSEMENT: 0,
      },
    });
    const relationship = await prisma.transactionRelationship.findFirstOrThrow({
      where: { userId: owner.id },
    });
    expect(relationship).toMatchObject({
      type: TransactionRelationshipType.LEGACY_UNTYPED,
      state: TransactionRelationshipState.NEEDS_REVIEW,
      certainty: ClassificationCertainty.UNKNOWN,
      reasonCodes: ["LEGACY_UNTYPED_LINK_REQUIRES_REVIEW"],
    });
    await expect(
      setRelationshipState(
        owner.id,
        relationship.id,
        TransactionRelationshipState.CONFIRMED,
      ),
    ).rejects.toThrow(/supported relationship type/i);

    const loaded = await prisma.transaction.findMany({
      where: { id: { in: [expense.id, income.id] } },
      include: {
        account: true,
        override: {
          include: {
            transactionCategory: { select: { id: true, name: true } },
          },
        },
        classification: {
          include: {
            transactionCategory: { select: { id: true, name: true } },
          },
        },
        allocations: {
          include: {
            transactionCategory: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { amount: "desc" },
    });
    const effects = loaded.map((transaction) => ({
      effective: effectiveTransactionValues(transaction),
      transaction,
    }));
    expect(effects.map(({ effective }) => effective.financialRole)).toEqual([
      FinancialRole.EXPENSE,
      FinancialRole.INCOME,
    ]);
    expect(
      effects.map(({ effective, transaction }) =>
        isFinalizedReportingEligible(transaction, effective),
      ),
    ).toEqual([true, true]);

    await prisma.user.update({
      where: { id: owner.id },
      data: { transactionTruthVersion: null, transactionTruthCutoverAt: null },
    });
    const second = await backfillOwnerTransactionTruth(owner.id, prisma);
    expect(second.rerunDelta).toBe(0);
    expect(
      await prisma.transactionRelationship.count({
        where: { userId: owner.id },
      }),
    ).toBe(1);
    expect(
      await prisma.transactionOverride.findUniqueOrThrow({
        where: { transactionId: expense.id },
        select: { linkedTransactionId: true },
      }),
    ).toEqual({ linkedTransactionId: income.id });
  });

  it("reports an explicit zero inventory and reuses an existing supported relationship", async () => {
    const empty = await fixture();
    const zero = await backfillOwnerTransactionTruth(empty.owner.id, prisma);
    expect(zero).toMatchObject({
      encountered: 0,
      legacyUntyped: 0,
      structurallyInvalid: 0,
      stillNonNull: 0,
      functionallyLegacyDependent: 0,
      correspondingTypedRelationships: 0,
      rerunDelta: 0,
    });

    const linked = await fixture();
    const [outflow, inflow] = await Promise.all([
      prisma.transaction.create({
        data: transactionData(linked.owner.id, linked.account.id, {
          amount: new Prisma.Decimal("100"),
          providerCategory: "TRANSFER_OUT_ACCOUNT_TRANSFER",
        }),
      }),
      prisma.transaction.create({
        data: transactionData(linked.owner.id, linked.secondAccount.id, {
          amount: new Prisma.Decimal("-100"),
          providerCategory: "TRANSFER_IN_ACCOUNT_TRANSFER",
        }),
      }),
    ]);
    await prisma.transactionOverride.create({
      data: {
        userId: linked.owner.id,
        transactionId: outflow.id,
        linkedTransactionId: inflow.id,
      },
    });
    const canonical = await prisma.transactionRelationship.create({
      data: {
        userId: linked.owner.id,
        sourceTransactionId: outflow.id,
        targetTransactionId: inflow.id,
        type: TransactionRelationshipType.INTERNAL_TRANSFER,
        state: TransactionRelationshipState.CONFIRMED,
        provenance: "OWNER_OVERRIDE",
        certainty: "CONFIRMED",
      },
    });
    const inventory = await backfillOwnerTransactionTruth(
      linked.owner.id,
      prisma,
    );
    expect(inventory).toMatchObject({
      encountered: 1,
      correspondingTypedRelationships: 1,
      legacyUntyped: 0,
      functionallyLegacyDependent: 0,
      rerunDelta: 0,
    });
    expect(
      await prisma.transactionRelationship.findMany({
        where: { userId: linked.owner.id },
        select: { id: true, type: true, state: true },
      }),
    ).toEqual([
      {
        id: canonical.id,
        type: TransactionRelationshipType.INTERNAL_TRANSFER,
        state: TransactionRelationshipState.CONFIRMED,
      },
    ]);
  });

  it("atomically resolves a legacy movement without duplicating its economic effect", async () => {
    const { owner, account, secondAccount } = await fixture();
    const [outflow, inflow] = await Promise.all([
      prisma.transaction.create({
        data: transactionData(owner.id, account.id, {
          amount: new Prisma.Decimal("100"),
          providerCategory: "TRANSFER_OUT_ACCOUNT_TRANSFER",
        }),
      }),
      prisma.transaction.create({
        data: transactionData(owner.id, secondAccount.id, {
          amount: new Prisma.Decimal("-100"),
          providerCategory: "TRANSFER_IN_ACCOUNT_TRANSFER",
        }),
      }),
    ]);
    await prisma.transactionOverride.create({
      data: {
        userId: owner.id,
        transactionId: outflow.id,
        linkedTransactionId: inflow.id,
      },
    });
    await backfillOwnerTransactionTruth(owner.id, prisma);
    const legacy = await prisma.transactionRelationship.findFirstOrThrow({
      where: { userId: owner.id },
    });

    const resolved = await resolveLegacyRelationship(
      owner.id,
      legacy.id,
      TransactionRelationshipType.INTERNAL_TRANSFER,
      new Prisma.Decimal("100"),
    );
    expect(resolved).toMatchObject({
      id: legacy.id,
      type: TransactionRelationshipType.INTERNAL_TRANSFER,
      state: TransactionRelationshipState.CONFIRMED,
      appliedAmount: new Prisma.Decimal("100"),
    });
    expect(
      await prisma.transactionRelationship.count({
        where: {
          userId: owner.id,
          sourceTransactionId: outflow.id,
          targetTransactionId: inflow.id,
        },
      }),
    ).toBe(1);
    expect(
      await prisma.transactionOverride.findMany({
        where: { transactionId: { in: [outflow.id, inflow.id] } },
        select: { financialRoleOverride: true },
        orderBy: { transactionId: "asc" },
      }),
    ).toEqual([
      { financialRoleOverride: FinancialRole.TRANSFER },
      { financialRoleOverride: FinancialRole.TRANSFER },
    ]);
    expect(
      await prisma.transactionOverride.findUniqueOrThrow({
        where: { transactionId: outflow.id },
        select: { linkedTransactionId: true },
      }),
    ).toEqual({ linkedTransactionId: inflow.id });
  });

  it("atomically retypes and applies an owner-resolved legacy refund", async () => {
    const { owner, account, secondAccount } = await fixture();
    const [original, refund] = await Promise.all([
      prisma.transaction.create({
        data: transactionData(owner.id, account.id, {
          amount: new Prisma.Decimal("100"),
          providerCategory: "FOOD_AND_DRINK_GROCERIES",
        }),
      }),
      prisma.transaction.create({
        data: transactionData(owner.id, secondAccount.id, {
          amount: new Prisma.Decimal("-40"),
          providerCategory: "INCOME_OTHER_INCOME",
        }),
      }),
    ]);
    await prisma.transactionOverride.create({
      data: {
        userId: owner.id,
        transactionId: refund.id,
        linkedTransactionId: original.id,
      },
    });
    await backfillOwnerTransactionTruth(owner.id, prisma);
    const legacy = await prisma.transactionRelationship.findFirstOrThrow({
      where: { userId: owner.id },
    });

    const resolved = await resolveLegacyRelationship(
      owner.id,
      legacy.id,
      TransactionRelationshipType.REFUND,
      new Prisma.Decimal("40"),
    );
    expect(resolved).toMatchObject({
      id: legacy.id,
      type: TransactionRelationshipType.REFUND,
      state: TransactionRelationshipState.CONFIRMED,
      appliedAmount: new Prisma.Decimal("40"),
    });
    expect(
      await prisma.transactionAllocation.findMany({
        where: { userId: owner.id, transactionId: refund.id },
        select: { amount: true },
      }),
    ).toEqual([{ amount: new Prisma.Decimal("40") }]);
    expect(
      await prisma.transactionOverride.findUniqueOrThrow({
        where: { transactionId: refund.id },
        select: {
          linkedTransactionId: true,
          financialRoleOverride: true,
        },
      }),
    ).toEqual({
      linkedTransactionId: original.id,
      financialRoleOverride: FinancialRole.REFUND,
    });
  });

  it("fails closed for structurally invalid legacy ownership and relies on the endpoint foreign key", async () => {
    const first = await fixture();
    const second = await fixture();
    const [source, foreignTarget] = await Promise.all([
      prisma.transaction.create({
        data: transactionData(first.owner.id, first.account.id),
      }),
      prisma.transaction.create({
        data: transactionData(second.owner.id, second.account.id),
      }),
    ]);
    await prisma.transactionOverride.create({
      data: {
        userId: first.owner.id,
        transactionId: source.id,
        linkedTransactionId: foreignTarget.id,
      },
    });
    const inventory = await backfillOwnerTransactionTruth(
      first.owner.id,
      prisma,
    );
    expect(inventory).toMatchObject({
      encountered: 1,
      structurallyInvalid: 1,
      legacyUntyped: 0,
      rerunDelta: 0,
    });
    expect(
      await prisma.transactionRelationship.count({
        where: { userId: first.owner.id },
      }),
    ).toBe(0);
    expect(
      await prisma.transactionClassification.findUniqueOrThrow({
        where: { transactionId: source.id },
        select: { reviewState: true, reasonCodes: true },
      }),
    ).toMatchObject({
      reviewState: "NEEDS_REVIEW",
      reasonCodes: expect.arrayContaining(["LEGACY_LINK_STRUCTURALLY_INVALID"]),
    });
    await expect(
      prisma.transactionOverride.update({
        where: { transactionId: source.id },
        data: { linkedTransactionId: "missing-synthetic-transaction" },
      }),
    ).rejects.toThrow();
  });

  it("stores only real exact splits and rejects imbalanced or cross-owner categories", async () => {
    const { owner, account } = await fixture();
    const transaction = await prisma.transaction.create({
      data: transactionData(owner.id, account.id, {
        amount: new Prisma.Decimal("50.0000"),
      }),
    });
    await backfillOwnerTransactionTruth(owner.id, prisma);
    const categories = await prisma.transactionCategory.findMany({
      where: { userId: owner.id, kind: "EXPENSE" },
      take: 2,
      orderBy: { displayOrder: "asc" },
    });
    await replaceTransactionAllocations(owner.id, transaction.id, [
      {
        transactionCategoryId: categories[0].id,
        amount: new Prisma.Decimal("20"),
      },
      {
        transactionCategoryId: categories[1].id,
        amount: new Prisma.Decimal("30"),
      },
    ]);
    expect(
      await prisma.transactionAllocation.aggregate({
        where: { transactionId: transaction.id },
        _sum: { amount: true },
      }),
    ).toMatchObject({ _sum: { amount: new Prisma.Decimal("50") } });
    await expect(
      replaceTransactionAllocations(owner.id, transaction.id, [
        {
          transactionCategoryId: categories[0].id,
          amount: new Prisma.Decimal("20"),
        },
        {
          transactionCategoryId: categories[1].id,
          amount: new Prisma.Decimal("29.9999"),
        },
      ]),
    ).rejects.toThrow(/exactly/i);
  });

  it("migrates a legacy refund purpose to a stable expense category with owner provenance", async () => {
    const { owner, account } = await fixture();
    const refund = await prisma.transaction.create({
      data: transactionData(owner.id, account.id, {
        originalName: "SYNTHETIC REFUND",
        merchantName: "Synthetic Refund",
        amount: new Prisma.Decimal("-25"),
        providerCategory: "Refund",
      }),
    });
    await prisma.transactionOverride.create({
      data: {
        userId: owner.id,
        transactionId: refund.id,
        categoryOverride: "Groceries",
        financialRoleOverride: FinancialRole.REFUND,
      },
    });
    await backfillOwnerTransactionTruth(owner.id, prisma);
    expect(
      await prisma.transactionOverride.findUniqueOrThrow({
        where: { transactionId: refund.id },
        select: {
          transactionCategoryId: true,
          transactionCategory: { select: { kind: true, name: true } },
          reviewedAt: true,
        },
      }),
    ).toMatchObject({
      transactionCategoryId: expect.any(String),
      transactionCategory: {
        kind: "EXPENSE",
        name: "Groceries",
      },
      reviewedAt: expect.any(Date),
    });
  });

  it("keeps owner rules prospective until a stable historical preview is confirmed", async () => {
    const { owner, account } = await fixture();
    const old = await prisma.transaction.create({
      data: transactionData(owner.id, account.id, {
        providerCategory: null,
        createdAt: new Date("2026-01-01T00:00:00Z"),
      }),
    });
    await backfillOwnerTransactionTruth(owner.id, prisma);
    const groceries = await prisma.transactionCategory.findFirstOrThrow({
      where: { userId: owner.id, systemKey: "expense.groceries" },
    });
    const rule = await createFutureClassificationRule(owner.id, {
      transactionId: old.id,
      matchType: ClassificationRuleMatchType.MERCHANT_EXACT,
      transactionCategoryId: groceries.id,
      financialRole: FinancialRole.EXPENSE,
      economicDirection: EconomicDirection.OUTFLOW,
    });
    const before = await prisma.transactionClassification.findUniqueOrThrow({
      where: { transactionId: old.id },
    });
    expect(before.financialRole).toBeNull();
    const preview = await previewHistoricalRuleApplication(owner.id, rule.id);
    expect(preview.transactionIds).toEqual([old.id]);
    await confirmHistoricalRuleApplication(
      owner.id,
      rule.id,
      preview.transactionIds,
    );
    expect(
      await prisma.transactionClassification.findUniqueOrThrow({
        where: { transactionId: old.id },
      }),
    ).toMatchObject({
      financialRole: FinancialRole.EXPENSE,
      transactionCategoryId: groceries.id,
    });
  });

  it("suggests movement pairs but changes reporting roles only after owner confirmation", async () => {
    const { owner, account, secondAccount } = await fixture();
    const now = new Date();
    const [outflow, inflow] = await Promise.all([
      prisma.transaction.create({
        data: transactionData(owner.id, account.id, {
          amount: new Prisma.Decimal("100"),
          postedAt: now,
          providerCategory: "TRANSFER_OUT_ACCOUNT_TRANSFER",
        }),
      }),
      prisma.transaction.create({
        data: transactionData(owner.id, secondAccount.id, {
          amount: new Prisma.Decimal("-100"),
          postedAt: now,
          providerCategory: "TRANSFER_IN_ACCOUNT_TRANSFER",
        }),
      }),
    ]);
    await backfillOwnerTransactionTruth(owner.id, prisma);
    expect(await suggestMovementRelationships(owner.id)).toBe(1);
    const suggestion = await prisma.transactionRelationship.findFirstOrThrow({
      where: {
        userId: owner.id,
        sourceTransactionId: outflow.id,
        targetTransactionId: inflow.id,
      },
    });
    expect(suggestion.state).toBe(TransactionRelationshipState.SUGGESTED);
    expect(
      await prisma.transactionOverride.count({
        where: { transactionId: { in: [outflow.id, inflow.id] } },
      }),
    ).toBe(0);
    await setRelationshipState(
      owner.id,
      suggestion.id,
      TransactionRelationshipState.CONFIRMED,
    );
    expect(
      await prisma.transactionOverride.findMany({
        where: { transactionId: { in: [outflow.id, inflow.id] } },
        select: { financialRoleOverride: true },
      }),
    ).toEqual([
      { financialRoleOverride: FinancialRole.TRANSFER },
      { financialRoleOverride: FinancialRole.TRANSFER },
    ]);
  });

  it("does not suggest arbitrary opposite-direction transactions as account movements", async () => {
    const { owner, account, secondAccount } = await fixture();
    const now = new Date();
    await Promise.all([
      prisma.transaction.create({
        data: transactionData(owner.id, account.id, {
          amount: new Prisma.Decimal("100"),
          postedAt: now,
          providerCategory: "TRANSFER_OUT_ACCOUNT_TRANSFER",
        }),
      }),
      prisma.transaction.create({
        data: transactionData(owner.id, secondAccount.id, {
          amount: new Prisma.Decimal("-100"),
          postedAt: now,
          providerCategory: "TRAVEL_FLIGHTS",
        }),
      }),
    ]);
    await backfillOwnerTransactionTruth(owner.id, prisma);

    expect(await suggestMovementRelationships(owner.id)).toBe(0);
    expect(
      await prisma.transactionRelationship.count({
        where: { userId: owner.id },
      }),
    ).toBe(0);
  });

  it("retires stale system movement suggestions that are no longer eligible", async () => {
    const { owner, account, secondAccount } = await fixture();
    const now = new Date();
    const [transfer, expense] = await Promise.all([
      prisma.transaction.create({
        data: transactionData(owner.id, account.id, {
          amount: new Prisma.Decimal("100"),
          postedAt: now,
          providerCategory: "TRANSFER_OUT_ACCOUNT_TRANSFER",
        }),
      }),
      prisma.transaction.create({
        data: transactionData(owner.id, secondAccount.id, {
          amount: new Prisma.Decimal("-100"),
          postedAt: now,
          providerCategory: "TRAVEL_FLIGHTS",
        }),
      }),
    ]);
    await backfillOwnerTransactionTruth(owner.id, prisma);
    const relationship = await prisma.transactionRelationship.create({
      data: {
        userId: owner.id,
        sourceTransactionId: transfer.id,
        targetTransactionId: expense.id,
        type: TransactionRelationshipType.INTERNAL_TRANSFER,
        appliedAmount: new Prisma.Decimal("100"),
        provenance: "SYSTEM",
        certainty: "DETERMINISTIC",
        state: TransactionRelationshipState.SUGGESTED,
        reasonCodes: ["OPPOSITE_DIRECTION_EQUAL_AMOUNT_NEAR_DATE"],
      },
    });

    expect(await suggestMovementRelationships(owner.id)).toBe(0);
    expect(
      await prisma.transactionRelationship.findUniqueOrThrow({
        where: { id: relationship.id },
        select: { state: true, reasonCodes: true },
      }),
    ).toEqual({
      state: TransactionRelationshipState.REJECTED,
      reasonCodes: [
        "OPPOSITE_DIRECTION_EQUAL_AMOUNT_NEAR_DATE",
        "NO_LONGER_ELIGIBLE_FOR_SUGGESTION",
      ],
    });
  });

  it("moves nonconflicting owner state, exact splits, relationships, and Calendar fulfillment to a posted replacement", async () => {
    const { owner, account, secondAccount } = await fixture();
    const [pending, posted, related] = await Promise.all([
      prisma.transaction.create({
        data: transactionData(owner.id, account.id, {
          postedAt: null,
          authorizedAt: new Date("2026-08-14T00:00:00Z"),
          status: TransactionStatus.PENDING,
        }),
      }),
      prisma.transaction.create({
        data: transactionData(owner.id, account.id),
      }),
      prisma.transaction.create({
        data: transactionData(owner.id, secondAccount.id, {
          amount: new Prisma.Decimal("-50"),
          providerCategory: "TRANSFER_IN_ACCOUNT_TRANSFER",
        }),
      }),
    ]);
    await backfillOwnerTransactionTruth(owner.id, prisma);
    const categories = await prisma.transactionCategory.findMany({
      where: { userId: owner.id, kind: "EXPENSE" },
      take: 2,
      orderBy: { displayOrder: "asc" },
    });
    await prisma.transactionOverride.create({
      data: {
        userId: owner.id,
        transactionId: pending.id,
        notes: "Synthetic pending note",
        excludedFromReports: true,
      },
    });
    await prisma.transactionAllocation.createMany({
      data: [
        {
          userId: owner.id,
          transactionId: pending.id,
          transactionCategoryId: categories[0].id,
          amount: new Prisma.Decimal("20"),
          displayOrder: 0,
        },
        {
          userId: owner.id,
          transactionId: pending.id,
          transactionCategoryId: categories[1].id,
          amount: new Prisma.Decimal("30"),
          displayOrder: 1,
        },
      ],
    });
    const relationship = await prisma.transactionRelationship.create({
      data: {
        userId: owner.id,
        sourceTransactionId: pending.id,
        targetTransactionId: related.id,
        type: "INTERNAL_TRANSFER",
        state: "NEEDS_REVIEW",
      },
    });
    const event = await prisma.calendarEvent.create({
      data: {
        userId: owner.id,
        linkedTransactionId: pending.id,
        eventType: CalendarEventType.BILL,
        title: "Synthetic bill",
        eventDate: new Date("2026-08-15T00:00:00Z"),
        expectedAmount: new Prisma.Decimal("50"),
        currency: "USD",
        dateSource: CalendarDateSource.USER_CONFIRMED,
        amountSource: CalendarAmountSource.MANUAL,
        confidenceLevel: "HIGH",
        status: CalendarEventStatus.PAID,
      },
    });
    await prisma.$transaction((tx) =>
      preservePendingOwnerState(tx, owner.id, pending.id, posted.id),
    );
    expect(
      await prisma.transactionOverride.findUnique({
        where: { transactionId: posted.id },
      }),
    ).toMatchObject({
      notes: "Synthetic pending note",
      excludedFromReports: true,
    });
    expect(
      await prisma.transactionAllocation.count({
        where: { transactionId: posted.id },
      }),
    ).toBe(2);
    expect(
      await prisma.transactionRelationship.findUnique({
        where: { id: relationship.id },
      }),
    ).toBeNull();
    expect(
      await prisma.transactionRelationship.count({
        where: {
          sourceTransactionId: posted.id,
          targetTransactionId: related.id,
        },
      }),
    ).toBe(1);
    expect(
      await prisma.calendarEvent.findUnique({ where: { id: event.id } }),
    ).toMatchObject({ linkedTransactionId: posted.id });
  });

  it("links and unlinks a partial refund across exact original allocations without losing source rows", async () => {
    const { owner, account } = await fixture();
    const [original, refund] = await Promise.all([
      prisma.transaction.create({
        data: transactionData(owner.id, account.id, {
          amount: new Prisma.Decimal("100"),
        }),
      }),
      prisma.transaction.create({
        data: transactionData(owner.id, account.id, {
          originalName: "EXAMPLE REFUND",
          merchantName: "Example Refund",
          amount: new Prisma.Decimal("-40"),
          providerCategory: "INCOME_OTHER_INCOME",
        }),
      }),
    ]);
    await backfillOwnerTransactionTruth(owner.id, prisma);
    const categories = await prisma.transactionCategory.findMany({
      where: { userId: owner.id, kind: "EXPENSE" },
      take: 2,
      orderBy: { displayOrder: "asc" },
    });
    await replaceTransactionAllocations(owner.id, original.id, [
      {
        transactionCategoryId: categories[0].id,
        amount: new Prisma.Decimal("25"),
      },
      {
        transactionCategoryId: categories[1].id,
        amount: new Prisma.Decimal("75"),
      },
    ]);
    const relationship = await createRefundRelationship(
      owner.id,
      refund.id,
      original.id,
      TransactionRelationshipType.REFUND,
      new Prisma.Decimal("40"),
    );
    expect(
      await prisma.transactionAllocation.findMany({
        where: { transactionId: refund.id },
        select: { amount: true },
        orderBy: { displayOrder: "asc" },
      }),
    ).toEqual([
      { amount: new Prisma.Decimal("10") },
      { amount: new Prisma.Decimal("30") },
    ]);
    await setRelationshipState(
      owner.id,
      relationship.id,
      TransactionRelationshipState.REJECTED,
    );
    expect(
      await prisma.transactionAllocation.count({
        where: { transactionId: refund.id },
      }),
    ).toBe(0);
    expect(
      await prisma.transaction.count({
        where: { id: { in: [original.id, refund.id] } },
      }),
    ).toBe(2);
  });

  it("rejects cross-owner relationship endpoints at the database boundary", async () => {
    const first = await fixture();
    const second = await fixture();
    const [source, target] = await Promise.all([
      prisma.transaction.create({
        data: transactionData(first.owner.id, first.account.id),
      }),
      prisma.transaction.create({
        data: transactionData(second.owner.id, second.account.id),
      }),
    ]);
    await expect(
      prisma.transactionRelationship.create({
        data: {
          userId: first.owner.id,
          sourceTransactionId: source.id,
          targetTransactionId: target.id,
          type: TransactionRelationshipType.INTERNAL_TRANSFER,
        },
      }),
    ).rejects.toThrow();
  });
});
