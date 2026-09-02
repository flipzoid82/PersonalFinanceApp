import {
  AccountType,
  ClassificationCertainty,
  ClassificationProvenance,
  ClassificationReviewState,
  EconomicDirection,
  ConfidenceLevel,
  FinancialRole,
  Prisma,
  RecurringFlowType,
  RecurringFrequency,
  TransactionStatus,
} from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  buildRecurringCandidates,
  classifyFrequency,
  confidenceLevelForScore,
  estimateAmount,
} from "./detection";
import {
  effectiveDetectionTransaction,
  normalizeCounterparty,
} from "./normalization";
import type { DetectionTransaction } from "./types";
import { TRANSACTION_CLASSIFIER_VERSION } from "@/lib/transactions/classifier";

const NOW = new Date("2026-04-01T12:00:00.000Z");

function date(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function transaction(
  id: string,
  postedAt: string,
  options: Partial<DetectionTransaction> & {
    role?: FinancialRole;
    category?: string;
  } = {},
): DetectionTransaction {
  const { role = FinancialRole.EXPENSE, category, ...changes } = options;
  return {
    id,
    userId: "owner-a",
    accountId: "account-a",
    originalName: "NETFLIX.COM 12345",
    merchantName: "Netflix.com",
    amount: new Prisma.Decimal("15.9900"),
    currency: "USD",
    postedAt: date(postedAt),
    status: TransactionStatus.POSTED,
    providerCategory: category ?? "ENTERTAINMENT_SUBSCRIPTION",
    removedAt: null,
    account: {
      id: "account-a",
      userId: "owner-a",
      isActive: true,
      accountType: AccountType.CHECKING,
    },
    override: {
      merchantNameOverride: null,
      categoryOverride: null,
      transactionCategoryId:
        role === FinancialRole.EXPENSE || role === FinancialRole.INCOME
          ? `${role.toLowerCase()}-category`
          : null,
      transactionCategory:
        role === FinancialRole.EXPENSE || role === FinancialRole.INCOME
          ? {
              id: `${role.toLowerCase()}-category`,
              name: category ?? "Subscriptions",
            }
          : null,
      financialRoleOverride: role,
      excludedFromReports: false,
    },
    classification: {
      classifierVersion: TRANSACTION_CLASSIFIER_VERSION,
      financialRole: role,
      transactionCategoryId:
        role === FinancialRole.EXPENSE || role === FinancialRole.INCOME
          ? `${role.toLowerCase()}-category`
          : null,
      transactionCategory:
        role === FinancialRole.EXPENSE || role === FinancialRole.INCOME
          ? {
              id: `${role.toLowerCase()}-category`,
              name: category ?? "Subscriptions",
            }
          : null,
      economicDirection:
        role === FinancialRole.INCOME ||
        role === FinancialRole.BORROWING_PROCEEDS ||
        role === FinancialRole.REFUND
          ? EconomicDirection.INFLOW
          : EconomicDirection.OUTFLOW,
      roleProvenance: ClassificationProvenance.SYSTEM,
      categoryProvenance: ClassificationProvenance.SYSTEM,
      directionProvenance: ClassificationProvenance.SYSTEM,
      roleCertainty: ClassificationCertainty.DETERMINISTIC,
      categoryCertainty: ClassificationCertainty.DETERMINISTIC,
      directionCertainty: ClassificationCertainty.DETERMINISTIC,
      reviewState: ClassificationReviewState.RESOLVED,
      reasonCodes: [],
      deferredUntil: null,
    },
    ...changes,
  };
}

function dates(values: string[]) {
  return values.map(date);
}

describe("merchant and eligibility normalization", () => {
  it("normalizes conservative domain and terminal fragments", () => {
    expect(normalizeCounterparty(" NETFLIX.COM 12345 ")).toBe("netflix");
    expect(normalizeCounterparty("Netflix.com")).toBe("netflix");
    expect(normalizeCounterparty("NETFLIX")).toBe("netflix");
  });

  it("does not merge distinct merchants that merely share a word", () => {
    expect(normalizeCounterparty("Amazon")).not.toBe(
      normalizeCounterparty("Amazon Web Services"),
    );
    expect(normalizeCounterparty("Amazon Fresh")).not.toBe(
      normalizeCounterparty("Amazon Web Services"),
    );
  });

  it.each([
    ["pending", { status: TransactionStatus.PENDING }],
    ["removed", { removedAt: NOW }],
    [
      "inactive account",
      {
        account: {
          id: "account-a",
          userId: "owner-a",
          isActive: false,
          accountType: AccountType.CHECKING,
        },
      },
    ],
    [
      "report exclusion",
      {
        override: {
          merchantNameOverride: null,
          categoryOverride: null,
          financialRoleOverride: FinancialRole.EXPENSE,
          excludedFromReports: true,
        },
      },
    ],
  ])("excludes %s transactions", (_label, changes) => {
    expect(
      effectiveDetectionTransaction(
        transaction(
          "tx",
          "2026-03-01",
          changes as Partial<DetectionTransaction>,
        ),
      ),
    ).toBeNull();
  });

  it("uses local role and merchant overrides without changing source values", () => {
    const source = transaction("tx", "2026-03-01", {
      originalName: "Provider original",
      merchantName: "Provider merchant",
      override: {
        merchantNameOverride: "Owner merchant",
        categoryOverride: "Utilities",
        financialRoleOverride: FinancialRole.DEBT_PAYMENT,
        excludedFromReports: false,
      },
    });
    const effective = effectiveDetectionTransaction(source);
    expect(effective).toMatchObject({
      effectiveMerchant: "Owner merchant",
      financialRole: FinancialRole.DEBT_PAYMENT,
      flowType: RecurringFlowType.DEBT_PAYMENT,
    });
    expect(source.originalName).toBe("Provider original");
  });

  it("fails closed when canonical classification is missing or outdated", () => {
    expect(
      effectiveDetectionTransaction(
        transaction("missing", "2026-03-01", { classification: null }),
      ),
    ).toBeNull();
    expect(
      effectiveDetectionTransaction(
        transaction("outdated", "2026-03-01", {
          classification: {
            ...transaction("base", "2026-03-01").classification!,
            classifierVersion: TRANSACTION_CLASSIFIER_VERSION - 1,
          },
        }),
      ),
    ).toBeNull();
  });

  it("keeps generic transfers out but supports stable transfer and card-payment streams", () => {
    expect(
      effectiveDetectionTransaction(
        transaction("generic", "2026-03-01", {
          merchantName: "Transfer",
          originalName: "Transfer",
          role: FinancialRole.TRANSFER,
        }),
      ),
    ).toBeNull();
    expect(
      effectiveDetectionTransaction(
        transaction("stable", "2026-03-01", {
          merchantName: "Example Savings",
          role: FinancialRole.TRANSFER,
        }),
      )?.flowType,
    ).toBe(RecurringFlowType.TRANSFER);
    expect(
      effectiveDetectionTransaction(
        transaction("card", "2026-03-01", {
          merchantName: "Example Rewards Card",
          role: FinancialRole.CREDIT_CARD_PAYMENT,
        }),
      )?.flowType,
    ).toBe(RecurringFlowType.CREDIT_CARD_PAYMENT);
  });
});

describe("calendar-aware interval classification", () => {
  it.each([
    [
      "weekly",
      ["2026-03-02", "2026-03-09", "2026-03-16"],
      RecurringFrequency.WEEKLY,
    ],
    [
      "biweekly",
      ["2026-02-02", "2026-02-16", "2026-03-02"],
      RecurringFrequency.BIWEEKLY,
    ],
    [
      "quarterly",
      ["2025-07-15", "2025-10-14", "2026-01-16"],
      RecurringFrequency.QUARTERLY,
    ],
    ["annual", ["2025-03-15", "2026-03-16"], RecurringFrequency.ANNUAL],
  ])("detects %s", (_label, values, expected) => {
    expect(classifyFrequency(dates(values))?.frequency).toBe(expected);
  });

  it("recognizes monthly drift across short months", () => {
    expect(
      classifyFrequency(dates(["2026-01-31", "2026-02-28", "2026-03-31"]))
        ?.frequency,
    ).toBe(RecurringFrequency.MONTHLY);
  });

  it("uses stable calendar anchors for semimonthly and does not call a 14-day series semimonthly", () => {
    expect(
      classifyFrequency(
        dates(["2026-01-01", "2026-01-15", "2026-02-01", "2026-02-15"]),
      )?.frequency,
    ).toBe(RecurringFrequency.SEMIMONTHLY);
    expect(
      classifyFrequency(dates(["2026-01-01", "2026-01-15", "2026-01-29"]))
        ?.frequency,
    ).toBe(RecurringFrequency.BIWEEKLY);
  });

  it("rejects insufficient history except for a clear annual pair", () => {
    expect(classifyFrequency(dates(["2026-02-01", "2026-03-01"]))).toBeNull();
    expect(
      classifyFrequency(dates(["2025-03-01", "2026-03-01"]))?.frequency,
    ).toBe(RecurringFrequency.ANNUAL);
  });
});

describe("candidate grouping, money, and confidence", () => {
  const monthly = ["2026-01-01", "2026-02-01", "2026-03-01"];

  it("separates owners, accounts, currencies, and flow directions", () => {
    const input = monthly.flatMap((postedAt, index) => [
      transaction(`a-${index}`, postedAt),
      transaction(`b-${index}`, postedAt, {
        accountId: "account-b",
        account: {
          id: "account-b",
          userId: "owner-a",
          isActive: true,
          accountType: AccountType.CHECKING,
        },
      }),
      transaction(`cad-${index}`, postedAt, { currency: "CAD" }),
      transaction(`income-${index}`, postedAt, {
        role: FinancialRole.INCOME,
        amount: new Prisma.Decimal("-15.9900"),
      }),
      transaction(`owner-${index}`, postedAt, {
        userId: "owner-b",
        account: {
          id: "account-c",
          userId: "owner-b",
          isActive: true,
          accountType: AccountType.CHECKING,
        },
        accountId: "account-c",
      }),
    ]);
    const result = buildRecurringCandidates(input, NOW);
    expect(result.candidates).toHaveLength(5);
    expect(
      new Set(result.candidates.map(({ detectionKey }) => detectionKey)).size,
    ).toBe(5);
  });

  it("uses exact Decimal median estimation and resists one outlier", () => {
    const estimate = estimateAmount([
      new Prisma.Decimal("10.0001"),
      new Prisma.Decimal("10.0001"),
      new Prisma.Decimal("999.9999"),
    ]);
    expect(estimate.expectedAmount.toFixed(4)).toBe("10.0001");
    expect(estimate.amountDeviation.toFixed(4)).toBe("0.0000");
    expect(estimate.amountSource).toBe("FIXED");
  });

  it("marks genuinely variable amounts as estimated", () => {
    const estimate = estimateAmount([
      new Prisma.Decimal("80"),
      new Prisma.Decimal("120"),
      new Prisma.Decimal("200"),
      new Prisma.Decimal("240"),
    ]);
    expect(estimate.expectedAmount.toFixed(4)).toBe("160.0000");
    expect(estimate.amountSource).toBe("ESTIMATED");
  });

  it("assigns stable confidence boundaries", () => {
    expect(confidenceLevelForScore(new Prisma.Decimal("0.8000"))).toBe(
      ConfidenceLevel.HIGH,
    );
    expect(confidenceLevelForScore(new Prisma.Decimal("0.7999"))).toBe(
      ConfidenceLevel.MEDIUM,
    );
    expect(confidenceLevelForScore(new Prisma.Decimal("0.5500"))).toBe(
      ConfidenceLevel.MEDIUM,
    );
    expect(confidenceLevelForScore(new Prisma.Decimal("0.5499"))).toBe(
      ConfidenceLevel.LOW,
    );
  });

  it("builds one deterministic monthly candidate and bounded projections", () => {
    const result = buildRecurringCandidates(
      monthly.map((postedAt, index) => transaction(`tx-${index}`, postedAt)),
      NOW,
    );
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]).toMatchObject({
      frequency: RecurringFrequency.MONTHLY,
      confidenceLevel: ConfidenceLevel.HIGH,
      currency: "USD",
      accountId: "account-a",
    });
    expect(result.candidates[0].predictedNextDate).toEqual(date("2026-05-01"));
    expect(result.candidates[0].projectedDates.map(isoDate)).toEqual([
      "2026-05-01",
      "2026-06-01",
    ]);
  });
});

function isoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}
