import { TransactionCategoryKind } from "@prisma/client";

export const STARTER_TRANSACTION_CATEGORIES = [
  ["expense.housing", TransactionCategoryKind.EXPENSE, "Housing"],
  ["expense.utilities", TransactionCategoryKind.EXPENSE, "Utilities"],
  ["expense.groceries", TransactionCategoryKind.EXPENSE, "Groceries"],
  ["expense.dining", TransactionCategoryKind.EXPENSE, "Dining"],
  ["expense.transportation", TransactionCategoryKind.EXPENSE, "Transportation"],
  ["expense.health", TransactionCategoryKind.EXPENSE, "Health"],
  ["expense.insurance", TransactionCategoryKind.EXPENSE, "Insurance"],
  ["expense.household", TransactionCategoryKind.EXPENSE, "Household"],
  ["expense.personal", TransactionCategoryKind.EXPENSE, "Personal"],
  ["expense.shopping", TransactionCategoryKind.EXPENSE, "Shopping"],
  ["expense.entertainment", TransactionCategoryKind.EXPENSE, "Entertainment"],
  ["expense.subscriptions", TransactionCategoryKind.EXPENSE, "Subscriptions"],
  [
    "expense.education_childcare",
    TransactionCategoryKind.EXPENSE,
    "Education/Childcare",
  ],
  ["expense.travel", TransactionCategoryKind.EXPENSE, "Travel"],
  ["expense.taxes", TransactionCategoryKind.EXPENSE, "Taxes"],
  ["expense.fees_interest", TransactionCategoryKind.EXPENSE, "Fees & Interest"],
  ["expense.other", TransactionCategoryKind.EXPENSE, "Other Expense"],
  ["income.payroll", TransactionCategoryKind.INCOME, "Payroll"],
  ["income.benefits", TransactionCategoryKind.INCOME, "Benefits"],
  ["income.interest", TransactionCategoryKind.INCOME, "Interest Income"],
  ["income.other", TransactionCategoryKind.INCOME, "Other Income"],
] as const;

export type StarterCategoryKey =
  (typeof STARTER_TRANSACTION_CATEGORIES)[number][0];

export function normalizeCategoryName(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");
}

export function normalizeMatchValue(value: string) {
  return value
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("en-US");
}
