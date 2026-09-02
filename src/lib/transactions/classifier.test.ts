import {
  AccountType,
  ClassificationReviewState,
  ClassificationRuleMatchType,
  EconomicDirection,
  FinancialRole,
  Prisma,
  TransactionCategoryKind,
  TransactionStatus,
} from "@prisma/client";
import { describe, expect, it } from "vitest";
import { classifyTransaction } from "./classifier";

const categories = new Map([
  [
    "expense.groceries",
    {
      id: "groceries",
      systemKey: "expense.groceries",
      kind: TransactionCategoryKind.EXPENSE,
      name: "Groceries",
    },
  ],
  [
    "income.payroll",
    {
      id: "payroll",
      systemKey: "income.payroll",
      kind: TransactionCategoryKind.INCOME,
      name: "Payroll",
    },
  ],
]);

function transaction(providerCategory: string | null, amount = "25.0000") {
  return {
    id: "transaction-1",
    accountId: "account-1",
    originalName: "EXAMPLE MARKET 12345",
    merchantName: "Example Market",
    amount: new Prisma.Decimal(amount),
    providerCategory,
    providerCategoryConfidence: null,
    status: TransactionStatus.POSTED,
    removedAt: null,
    createdAt: new Date("2026-08-31T00:00:00Z"),
    account: { accountType: AccountType.CHECKING },
  };
}

describe("canonical transaction classifier", () => {
  it("uses an unambiguous versioned mapping and source-adapted direction", () => {
    expect(
      classifyTransaction(
        transaction("FOOD_AND_DRINK_GROCERIES"),
        categories,
        [],
      ),
    ).toMatchObject({
      financialRole: FinancialRole.EXPENSE,
      transactionCategoryId: "groceries",
      economicDirection: EconomicDirection.OUTFLOW,
      reviewState: ClassificationReviewState.RESOLVED,
    });
  });

  it("keeps unsupported provider evidence unresolved instead of guessing", () => {
    const result = classifyTransaction(
      transaction("PROVIDER_FUTURE_UNKNOWN_CODE"),
      categories,
      [],
    );
    expect(result.financialRole).toBeNull();
    expect(result.reviewState).toBe(ClassificationReviewState.NEEDS_REVIEW);
    expect(result.reasonCodes).toContain("PROVIDER_CATEGORY_UNMAPPED");
  });

  it("distinguishes borrowing proceeds from income and transfer", () => {
    expect(
      classifyTransaction(
        transaction("TRANSFER_IN_CASH_ADVANCES_AND_LOANS", "-500.0000"),
        categories,
        [],
      ),
    ).toMatchObject({
      financialRole: FinancialRole.BORROWING_PROCEEDS,
      economicDirection: EconomicDirection.INFLOW,
      reviewState: ClassificationReviewState.RESOLVED,
    });
  });

  it("fails conflicting equal-priority owner rules to review deterministically", () => {
    const base = {
      matchType: ClassificationRuleMatchType.MERCHANT_EXACT,
      normalizedValue: "example market",
      accountId: null,
      economicDirection: null,
      priority: 10,
      appliesFrom: new Date("2026-01-01T00:00:00Z"),
    };
    const result = classifyTransaction(transaction(null), categories, [
      {
        ...base,
        id: "rule-a",
        financialRole: FinancialRole.EXPENSE,
        transactionCategoryId: "groceries",
      },
      {
        ...base,
        id: "rule-b",
        financialRole: FinancialRole.TRANSFER,
        transactionCategoryId: null,
      },
    ]);
    expect(result.reviewState).toBe(ClassificationReviewState.NEEDS_REVIEW);
    expect(result.reasonCodes).toContain("OWNER_RULE_CONFLICT");
  });

  it("does not apply a future-only owner rule to older activity", () => {
    const result = classifyTransaction(transaction(null), categories, [
      {
        id: "rule-future",
        matchType: ClassificationRuleMatchType.MERCHANT_EXACT,
        normalizedValue: "example market",
        accountId: null,
        financialRole: FinancialRole.EXPENSE,
        transactionCategoryId: "groceries",
        economicDirection: null,
        priority: 10,
        appliesFrom: new Date("2026-09-01T00:00:00Z"),
      },
    ]);
    expect(result.financialRole).toBeNull();
    expect(result.reviewState).toBe(ClassificationReviewState.NEEDS_REVIEW);
  });
});
