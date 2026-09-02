import {
  FinancialRole,
  TransactionRelationshipState,
  TransactionStatus,
} from "@prisma/client";

type EligibilityTransaction = {
  status: TransactionStatus;
  removedAt?: Date | null;
  currency: string;
  pendingTransactionId?: string | null;
  postedTransactions?: Array<{ id: string }>;
  account?: {
    id?: string;
    name?: string;
    isActive?: boolean;
    userId?: string;
  };
};

type EffectiveEligibility = {
  financialRole: FinancialRole | null;
  excludedFromReports: boolean;
  needsReview: boolean;
  categoryId?: string | null;
  allocations?: Array<unknown>;
};

export function isClassificationEligible(transaction: EligibilityTransaction) {
  return (
    !transaction.removedAt && transaction.status !== TransactionStatus.CANCELED
  );
}

export function isFinalizedReportingEligible(
  transaction: EligibilityTransaction,
  effective: EffectiveEligibility,
) {
  return (
    transaction.status === TransactionStatus.POSTED &&
    !transaction.removedAt &&
    !effective.excludedFromReports &&
    !effective.needsReview &&
    effective.financialRole !== null &&
    effective.financialRole !== FinancialRole.UNCATEGORIZED
  );
}

export function isInboxEligible(
  transaction: EligibilityTransaction,
  effective: EffectiveEligibility,
) {
  return (
    isClassificationEligible(transaction) &&
    (effective.needsReview ||
      effective.financialRole === null ||
      effective.financialRole === FinancialRole.UNCATEGORIZED)
  );
}

export function isRecurrenceEligible(
  transaction: EligibilityTransaction,
  effective: EffectiveEligibility,
) {
  return (
    isFinalizedReportingEligible(transaction, effective) &&
    transaction.account?.isActive !== false &&
    effective.financialRole !== FinancialRole.INVESTMENT_ACTIVITY &&
    effective.financialRole !== FinancialRole.BORROWING_PROCEEDS &&
    effective.financialRole !== FinancialRole.REFUND &&
    effective.financialRole !== FinancialRole.IGNORED
  );
}

export function isRelationshipEligible(transaction: EligibilityTransaction) {
  return (
    !transaction.removedAt &&
    (transaction.status === TransactionStatus.POSTED ||
      transaction.status === TransactionStatus.PENDING) &&
    /^[A-Z]{3}$/.test(transaction.currency)
  );
}

export function isAllocationEligible(
  transaction: EligibilityTransaction,
  effective: EffectiveEligibility,
) {
  return (
    !transaction.removedAt &&
    !effective.excludedFromReports &&
    (effective.financialRole === FinancialRole.EXPENSE ||
      effective.financialRole === FinancialRole.INCOME)
  );
}

export function isLaterPlanningEligible(
  transaction: EligibilityTransaction,
  effective: EffectiveEligibility,
) {
  return (
    isFinalizedReportingEligible(transaction, effective) &&
    transaction.currency === "USD" &&
    transaction.account?.isActive !== false &&
    !effective.needsReview
  );
}

export function isConfirmedRelationship(state: TransactionRelationshipState) {
  return state === TransactionRelationshipState.CONFIRMED;
}
