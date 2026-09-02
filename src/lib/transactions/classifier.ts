import {
  AccountType,
  ClassificationCertainty,
  ClassificationProvenance,
  ClassificationReviewState,
  ClassificationRuleMatchType,
  EconomicDirection,
  FinancialRole,
  Prisma,
  TransactionStatus,
  type TransactionCategory,
} from "@prisma/client";
import { normalizeCategoryName, normalizeMatchValue } from "./taxonomy";

export const TRANSACTION_CLASSIFIER_VERSION = 1;
export const DIRECTION_ADAPTER_VERSION = 1;

export type ClassificationRuleInput = {
  id: string;
  matchType: ClassificationRuleMatchType;
  normalizedValue: string;
  accountId: string | null;
  transactionCategoryId: string | null;
  financialRole: FinancialRole | null;
  economicDirection: EconomicDirection | null;
  priority: number;
  appliesFrom: Date;
};

export type ClassifierTransaction = {
  id: string;
  accountId: string;
  originalName: string;
  merchantName: string | null;
  amount: Prisma.Decimal;
  providerCategory: string | null;
  providerCategoryConfidence?: Prisma.Decimal | null;
  status: TransactionStatus;
  removedAt?: Date | null;
  createdAt: Date;
  account: { accountType: AccountType };
};

type CategoryMap = Map<
  string,
  Pick<TransactionCategory, "id" | "systemKey" | "kind" | "name">
>;

const PROVIDER_MAPPINGS: Array<[RegExp, FinancialRole, string | null]> = [
  [/REFUND/, FinancialRole.REFUND, null],
  [/^INCOME_(WAGES|SALARY)/, FinancialRole.INCOME, "income.payroll"],
  [
    /^INCOME_(RETIREMENT|PENSION|BENEFITS)/,
    FinancialRole.INCOME,
    "income.benefits",
  ],
  [/^INCOME_INTEREST/, FinancialRole.INCOME, "income.interest"],
  [/^INCOME_/, FinancialRole.INCOME, "income.other"],
  [
    /^TRANSFER_IN_CASH_ADVANCES_AND_LOANS/,
    FinancialRole.BORROWING_PROCEEDS,
    null,
  ],
  [/^TRANSFER_/, FinancialRole.TRANSFER, null],
  [
    /^LOAN_PAYMENTS_CREDIT_CARD_PAYMENT/,
    FinancialRole.CREDIT_CARD_PAYMENT,
    null,
  ],
  [/^LOAN_PAYMENTS_/, FinancialRole.DEBT_PAYMENT, null],
  [
    /^(RENT_AND_UTILITIES_RENT|RENT_AND_UTILITIES_MORTGAGE)/,
    FinancialRole.EXPENSE,
    "expense.housing",
  ],
  [
    /^(RENT_AND_UTILITIES|HOME_IMPROVEMENT)_/,
    FinancialRole.EXPENSE,
    "expense.utilities",
  ],
  [/^FOOD_AND_DRINK_GROCERIES/, FinancialRole.EXPENSE, "expense.groceries"],
  [/^FOOD_AND_DRINK_/, FinancialRole.EXPENSE, "expense.dining"],
  [/^TRANSPORTATION_/, FinancialRole.EXPENSE, "expense.transportation"],
  [/^MEDICAL_/, FinancialRole.EXPENSE, "expense.health"],
  [/^GENERAL_SERVICES_INSURANCE/, FinancialRole.EXPENSE, "expense.insurance"],
  [/^GENERAL_MERCHANDISE_/, FinancialRole.EXPENSE, "expense.shopping"],
  [/^ENTERTAINMENT_/, FinancialRole.EXPENSE, "expense.entertainment"],
  [/^PERSONAL_CARE_/, FinancialRole.EXPENSE, "expense.personal"],
  [/^TRAVEL_/, FinancialRole.EXPENSE, "expense.travel"],
  [/^GOVERNMENT_AND_NON_PROFIT_TAX/, FinancialRole.EXPENSE, "expense.taxes"],
  [
    /^(BANK_FEES|LOAN_PAYMENTS_INTEREST)/,
    FinancialRole.EXPENSE,
    "expense.fees_interest",
  ],
];

const SIMPLE_CATEGORY_KEYS = new Map<string, string>([
  ["housing", "expense.housing"],
  ["utilities", "expense.utilities"],
  ["groceries", "expense.groceries"],
  ["dining", "expense.dining"],
  ["transportation", "expense.transportation"],
  ["health", "expense.health"],
  ["insurance", "expense.insurance"],
  ["household", "expense.household"],
  ["personal", "expense.personal"],
  ["shopping", "expense.shopping"],
  ["entertainment", "expense.entertainment"],
  ["subscriptions", "expense.subscriptions"],
  ["education/childcare", "expense.education_childcare"],
  ["travel", "expense.travel"],
  ["taxes", "expense.taxes"],
  ["fees & interest", "expense.fees_interest"],
  ["other expense", "expense.other"],
  ["payroll", "income.payroll"],
  ["benefits", "income.benefits"],
  ["interest income", "income.interest"],
  ["other income", "income.other"],
]);

export function sourceDirection(
  transaction: Pick<ClassifierTransaction, "amount">,
) {
  if (transaction.amount.isZero()) return EconomicDirection.UNKNOWN;
  // Current normalized Plaid/internal convention: positive is an account
  // outflow (or debt increase), negative is an inflow (or debt reduction).
  return transaction.amount.isPositive()
    ? EconomicDirection.OUTFLOW
    : EconomicDirection.INFLOW;
}

export function ruleMatchesTransaction(
  transaction: Pick<
    ClassifierTransaction,
    "accountId" | "merchantName" | "originalName" | "createdAt"
  >,
  rule: Pick<
    ClassificationRuleInput,
    "matchType" | "normalizedValue" | "accountId" | "appliesFrom"
  >,
  ignoreAppliesFrom = false,
) {
  const merchant = normalizeMatchValue(transaction.merchantName ?? "");
  const description = normalizeMatchValue(transaction.originalName);
  if (!ignoreAppliesFrom && rule.appliesFrom > transaction.createdAt)
    return false;
  if (rule.accountId && rule.accountId !== transaction.accountId) return false;
  switch (rule.matchType) {
    case ClassificationRuleMatchType.MERCHANT_EXACT:
      return merchant === rule.normalizedValue;
    case ClassificationRuleMatchType.DESCRIPTION_EXACT:
      return description === rule.normalizedValue;
    case ClassificationRuleMatchType.DESCRIPTION_PREFIX:
      return description.startsWith(rule.normalizedValue);
    case ClassificationRuleMatchType.DESCRIPTION_CONTAINS:
      return description.includes(rule.normalizedValue);
    case ClassificationRuleMatchType.MERCHANT_ACCOUNT:
      return Boolean(rule.accountId) && merchant === rule.normalizedValue;
  }
}

function matchingRules(
  transaction: ClassifierTransaction,
  rules: ClassificationRuleInput[],
) {
  return rules.filter((rule) => ruleMatchesTransaction(transaction, rule));
}

function sameRuleResult(
  a: ClassificationRuleInput,
  b: ClassificationRuleInput,
) {
  return (
    a.financialRole === b.financialRole &&
    a.transactionCategoryId === b.transactionCategoryId &&
    a.economicDirection === b.economicDirection
  );
}

export function classifyTransaction(
  transaction: ClassifierTransaction,
  categories: CategoryMap,
  rules: ClassificationRuleInput[],
) {
  const direction = sourceDirection(transaction);
  const reasons: string[] = [];
  const candidates = matchingRules(transaction, rules).sort(
    (a, b) => a.priority - b.priority || a.id.localeCompare(b.id),
  );
  const bestPriority = candidates[0]?.priority;
  const best = candidates.filter((rule) => rule.priority === bestPriority);
  if (best.length && best.every((rule) => sameRuleResult(rule, best[0]))) {
    const rule = best[0];
    return {
      financialRole: rule.financialRole,
      transactionCategoryId: rule.transactionCategoryId,
      economicDirection: rule.economicDirection ?? direction,
      roleProvenance: rule.financialRole
        ? ClassificationProvenance.OWNER_RULE
        : ClassificationProvenance.UNRESOLVED,
      categoryProvenance: rule.transactionCategoryId
        ? ClassificationProvenance.OWNER_RULE
        : ClassificationProvenance.UNRESOLVED,
      directionProvenance: rule.economicDirection
        ? ClassificationProvenance.OWNER_RULE
        : ClassificationProvenance.SYSTEM,
      roleCertainty: rule.financialRole
        ? ClassificationCertainty.CONFIRMED
        : ClassificationCertainty.UNKNOWN,
      categoryCertainty: rule.transactionCategoryId
        ? ClassificationCertainty.CONFIRMED
        : ClassificationCertainty.UNKNOWN,
      directionCertainty:
        direction === EconomicDirection.UNKNOWN
          ? ClassificationCertainty.UNKNOWN
          : ClassificationCertainty.DETERMINISTIC,
      reviewState:
        rule.financialRole &&
        ((rule.financialRole !== FinancialRole.EXPENSE &&
          rule.financialRole !== FinancialRole.INCOME) ||
          rule.transactionCategoryId)
          ? ClassificationReviewState.RESOLVED
          : ClassificationReviewState.NEEDS_REVIEW,
      reasonCodes: ["OWNER_RULE_MATCH"],
      evidence: {
        ruleId: rule.id,
        directionAdapterVersion: DIRECTION_ADAPTER_VERSION,
      },
    };
  }
  if (best.length > 1) reasons.push("OWNER_RULE_CONFLICT");

  const provider = transaction.providerCategory?.trim().toUpperCase() ?? "";
  let mapped: [FinancialRole, string | null] | null = null;
  for (const [pattern, role, categoryKey] of PROVIDER_MAPPINGS) {
    if (pattern.test(provider)) {
      mapped = [role, categoryKey];
      break;
    }
  }
  if (!mapped && provider) {
    const simpleKey = SIMPLE_CATEGORY_KEYS.get(normalizeCategoryName(provider));
    if (simpleKey)
      mapped = [
        simpleKey.startsWith("income.")
          ? FinancialRole.INCOME
          : FinancialRole.EXPENSE,
        simpleKey,
      ];
  }

  const category = mapped?.[1] ? categories.get(mapped[1]) : null;
  const role = mapped?.[0] ?? null;
  if (!role)
    reasons.push(
      provider ? "PROVIDER_CATEGORY_UNMAPPED" : "MISSING_CATEGORY_EVIDENCE",
    );
  if (
    role &&
    (role === FinancialRole.EXPENSE || role === FinancialRole.INCOME) &&
    !category
  )
    reasons.push("CATEGORY_UNRESOLVED");
  if (direction === EconomicDirection.UNKNOWN)
    reasons.push("DIRECTION_UNKNOWN");
  if (transaction.status === TransactionStatus.PENDING)
    reasons.push("PENDING_ACTIVITY");
  const roleDirectionConflict =
    (role === FinancialRole.INCOME && direction !== EconomicDirection.INFLOW) ||
    (role === FinancialRole.EXPENSE &&
      direction !== EconomicDirection.OUTFLOW) ||
    (role === FinancialRole.REFUND && direction !== EconomicDirection.INFLOW) ||
    (role === FinancialRole.BORROWING_PROCEEDS &&
      direction !== EconomicDirection.INFLOW);
  if (roleDirectionConflict) reasons.push("ROLE_DIRECTION_CONFLICT");

  const resolved =
    Boolean(role) &&
    ((role !== FinancialRole.EXPENSE && role !== FinancialRole.INCOME) ||
      Boolean(category)) &&
    direction !== EconomicDirection.UNKNOWN &&
    !roleDirectionConflict &&
    !best.length;
  return {
    financialRole: role,
    transactionCategoryId: category?.id ?? null,
    economicDirection: direction,
    roleProvenance: role
      ? ClassificationProvenance.SYSTEM
      : ClassificationProvenance.UNRESOLVED,
    categoryProvenance: category
      ? ClassificationProvenance.SYSTEM
      : ClassificationProvenance.UNRESOLVED,
    directionProvenance:
      direction === EconomicDirection.UNKNOWN
        ? ClassificationProvenance.UNRESOLVED
        : ClassificationProvenance.SYSTEM,
    roleCertainty: role
      ? ClassificationCertainty.DETERMINISTIC
      : best.length
        ? ClassificationCertainty.CONFLICTING
        : ClassificationCertainty.UNKNOWN,
    categoryCertainty: category
      ? ClassificationCertainty.DETERMINISTIC
      : best.length
        ? ClassificationCertainty.CONFLICTING
        : ClassificationCertainty.UNKNOWN,
    directionCertainty:
      direction === EconomicDirection.UNKNOWN
        ? ClassificationCertainty.UNKNOWN
        : ClassificationCertainty.DETERMINISTIC,
    reviewState: resolved
      ? ClassificationReviewState.RESOLVED
      : ClassificationReviewState.NEEDS_REVIEW,
    reasonCodes: reasons,
    evidence: {
      providerCategory: transaction.providerCategory,
      classifierVersion: TRANSACTION_CLASSIFIER_VERSION,
      directionAdapterVersion: DIRECTION_ADAPTER_VERSION,
    },
  };
}
