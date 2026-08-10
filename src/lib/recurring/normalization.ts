import {
  CalendarEventType,
  FinancialRole,
  RecurringFlowType,
} from "@prisma/client";
import type {
  DetectionTransaction,
  EffectiveDetectionTransaction,
} from "./types";
import { effectiveTransactionValues } from "@/lib/transactions/effective";

const GENERIC_IDENTITIES = new Set([
  "ach",
  "bank transfer",
  "cash withdrawal",
  "check",
  "credit",
  "debit",
  "deposit",
  "payment",
  "transfer",
  "withdrawal",
]);

const EXCLUDED_CATEGORY_PARTS = [
  "CASH_WITHDRAWAL",
  "REFUND",
  "INVESTMENT",
  "SECURITIES",
  "BANK_FEES",
  "INTEREST_CHARGED",
];

export function normalizeCounterparty(value: string) {
  return value
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/\b([a-z0-9-]+)\.(?:com|net|org)\b/g, "$1")
    .replace(/\s+(?:#|ref(?:erence)?\s*)?\d{4,}\s*$/i, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function providerRole(category: string | null) {
  const value = category?.toUpperCase() ?? "";
  if (!value || EXCLUDED_CATEGORY_PARTS.some((part) => value.includes(part)))
    return null;
  if (value.includes("CREDIT_CARD_PAYMENT"))
    return FinancialRole.CREDIT_CARD_PAYMENT;
  if (value.includes("LOAN_PAYMENT") || value.includes("DEBT_PAYMENT"))
    return FinancialRole.DEBT_PAYMENT;
  if (value.includes("TRANSFER")) return FinancialRole.TRANSFER;
  if (
    value.includes("INCOME") ||
    value.includes("PAYROLL") ||
    value.includes("DIRECT_DEPOSIT")
  )
    return FinancialRole.INCOME;
  if (
    value.includes("RENT") ||
    value.includes("UTILIT") ||
    value.includes("FOOD") ||
    value.includes("ENTERTAINMENT") ||
    value.includes("GENERAL_MERCHANDISE") ||
    value.includes("MEDICAL") ||
    value.includes("TRANSPORTATION") ||
    value.includes("TRAVEL") ||
    value.includes("PERSONAL_CARE") ||
    value.includes("SUBSCRIPTION")
  )
    return FinancialRole.EXPENSE;
  return null;
}

function recurringKinds(role: FinancialRole, category: string | null) {
  const value = category?.toUpperCase() ?? "";
  switch (role) {
    case FinancialRole.INCOME:
      return {
        direction: "inflow" as const,
        flowType: RecurringFlowType.EXPECTED_INCOME,
        eventType: CalendarEventType.EXPECTED_INCOME,
      };
    case FinancialRole.DEBT_PAYMENT:
      return {
        direction: "outflow" as const,
        flowType: RecurringFlowType.DEBT_PAYMENT,
        eventType: CalendarEventType.DEBT_PAYMENT,
      };
    case FinancialRole.CREDIT_CARD_PAYMENT:
      return {
        direction: "outflow" as const,
        flowType: RecurringFlowType.CREDIT_CARD_PAYMENT,
        eventType: CalendarEventType.CREDIT_CARD_PAYMENT,
      };
    case FinancialRole.TRANSFER:
      return {
        direction: "outflow" as const,
        flowType: RecurringFlowType.TRANSFER,
        eventType: CalendarEventType.OTHER_RECURRING,
      };
    case FinancialRole.EXPENSE:
      return value.includes("SUBSCRIPTION")
        ? {
            direction: "outflow" as const,
            flowType: RecurringFlowType.SUBSCRIPTION,
            eventType: CalendarEventType.SUBSCRIPTION,
          }
        : {
            direction: "outflow" as const,
            flowType: RecurringFlowType.BILL,
            eventType: CalendarEventType.BILL,
          };
    default:
      return null;
  }
}

export function effectiveDetectionTransaction(
  transaction: DetectionTransaction,
): EffectiveDetectionTransaction | null {
  if (
    transaction.status !== "POSTED" ||
    !transaction.postedAt ||
    transaction.removedAt ||
    !transaction.account.isActive ||
    transaction.userId !== transaction.account.userId ||
    transaction.override?.excludedFromReports ||
    !/^[A-Z]{3}$/.test(transaction.currency)
  )
    return null;

  const effective = effectiveTransactionValues(transaction);
  const financialRole =
    effective.financialRole ?? providerRole(transaction.providerCategory);
  if (!financialRole) return null;
  const kinds = recurringKinds(financialRole, transaction.providerCategory);
  if (!kinds) return null;

  const effectiveMerchant = effective.merchant;
  const normalizedMerchant = normalizeCounterparty(effectiveMerchant);
  if (
    !normalizedMerchant ||
    (financialRole === FinancialRole.TRANSFER &&
      GENERIC_IDENTITIES.has(normalizedMerchant))
  )
    return null;

  return {
    ...transaction,
    effectiveMerchant: effectiveMerchant.trim(),
    normalizedMerchant,
    effectiveCategory:
      effective.category === "Uncategorized" ? null : effective.category,
    financialRole,
    ...kinds,
  };
}
