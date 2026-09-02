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
import { isRecurrenceEligible } from "@/lib/transactions/eligibility";
import { TRANSACTION_CLASSIFIER_VERSION } from "@/lib/transactions/classifier";

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
    transaction.classification?.classifierVersion !==
      TRANSACTION_CLASSIFIER_VERSION ||
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
  if (!isRecurrenceEligible(transaction, effective)) return null;
  const financialRole = effective.financialRole;
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
