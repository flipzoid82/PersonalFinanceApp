import {
  ClassificationCertainty,
  ClassificationProvenance,
  ClassificationReviewState,
  EconomicDirection,
  FinancialRole,
  Prisma,
} from "@prisma/client";
import { sourceDirection } from "./classifier";

type CategoryValue = { id: string; name: string };

export type EffectiveTransactionInput = {
  originalName: string;
  merchantName: string | null;
  providerCategory: string | null;
  amount?: Prisma.Decimal;
  override?: {
    merchantNameOverride?: string | null;
    categoryOverride?: string | null;
    transactionCategoryId?: string | null;
    transactionCategory?: CategoryValue | null;
    financialRoleOverride?: FinancialRole | null;
    economicDirectionOverride?: EconomicDirection | null;
    reviewedAt?: Date | null;
    notes?: string | null;
    excludedFromReports?: boolean;
  } | null;
  classification?: {
    financialRole: FinancialRole | null;
    transactionCategoryId: string | null;
    transactionCategory?: CategoryValue | null;
    economicDirection: EconomicDirection;
    roleProvenance: ClassificationProvenance;
    categoryProvenance: ClassificationProvenance;
    directionProvenance: ClassificationProvenance;
    roleCertainty: ClassificationCertainty;
    categoryCertainty: ClassificationCertainty;
    directionCertainty: ClassificationCertainty;
    reviewState: ClassificationReviewState;
    reasonCodes: string[];
    deferredUntil?: Date | null;
  } | null;
  allocations?: Array<{
    id: string;
    transactionCategoryId: string;
    transactionCategory: CategoryValue;
    amount: Prisma.Decimal;
    displayOrder: number;
    provenance?: ClassificationProvenance;
  }>;
};

export type EffectiveAllocation = {
  id: string | null;
  categoryId: string;
  category: string;
  amount: Prisma.Decimal;
  displayOrder: number;
  provenance: ClassificationProvenance;
  synthetic: boolean;
};

function categoryBearing(role: FinancialRole | null) {
  return role === FinancialRole.EXPENSE || role === FinancialRole.INCOME;
}

export function effectiveTransactionValues(
  transaction: EffectiveTransactionInput,
) {
  const override = transaction.override;
  const classification = transaction.classification;
  const ownerCategory = override?.transactionCategory ?? null;
  const classifiedCategory = classification?.transactionCategory ?? null;
  const financialRole =
    override?.financialRoleOverride ?? classification?.financialRole ?? null;
  const resolvedCategoryId =
    override?.transactionCategoryId ??
    ownerCategory?.id ??
    classification?.transactionCategoryId ??
    classifiedCategory?.id ??
    null;
  const category =
    ownerCategory?.name ??
    classifiedCategory?.name ??
    override?.categoryOverride ??
    transaction.providerCategory ??
    "Uncategorized";
  const categoryId =
    resolvedCategoryId ??
    (override?.categoryOverride
      ? `legacy:${override.categoryOverride.trim().toLocaleLowerCase("en-US")}`
      : null);
  const economicDirection =
    override?.economicDirectionOverride ??
    classification?.economicDirection ??
    (transaction.amount
      ? sourceDirection({ amount: transaction.amount })
      : EconomicDirection.UNKNOWN);
  const roleProvenance = override?.financialRoleOverride
    ? ClassificationProvenance.OWNER_OVERRIDE
    : (classification?.roleProvenance ?? ClassificationProvenance.UNRESOLVED);
  const categoryProvenance =
    ownerCategory || override?.categoryOverride
      ? ClassificationProvenance.OWNER_OVERRIDE
      : (classification?.categoryProvenance ??
        ClassificationProvenance.UNRESOLVED);
  const directionProvenance = override?.economicDirectionOverride
    ? ClassificationProvenance.OWNER_OVERRIDE
    : (classification?.directionProvenance ??
      (transaction.amount && !transaction.amount.isZero()
        ? ClassificationProvenance.SYSTEM
        : ClassificationProvenance.UNRESOLVED));
  const reasonCodes = [...(classification?.reasonCodes ?? [])];
  if (!financialRole || financialRole === FinancialRole.UNCATEGORIZED)
    reasonCodes.push("ROLE_UNRESOLVED");
  if (categoryBearing(financialRole) && !categoryId)
    reasonCodes.push("CATEGORY_UNRESOLVED");
  if (economicDirection === EconomicDirection.UNKNOWN)
    reasonCodes.push("DIRECTION_UNKNOWN");
  const roleDirectionConflict =
    (financialRole === FinancialRole.INCOME &&
      economicDirection !== EconomicDirection.INFLOW) ||
    (financialRole === FinancialRole.EXPENSE &&
      economicDirection !== EconomicDirection.OUTFLOW) ||
    (financialRole === FinancialRole.REFUND &&
      economicDirection !== EconomicDirection.INFLOW) ||
    (financialRole === FinancialRole.DEBT_PAYMENT &&
      economicDirection !== EconomicDirection.OUTFLOW) ||
    (financialRole === FinancialRole.BORROWING_PROCEEDS &&
      economicDirection !== EconomicDirection.INFLOW);
  if (roleDirectionConflict) reasonCodes.push("ROLE_DIRECTION_CONFLICT");
  const explicitOwnerDecision = Boolean(
    override?.financialRoleOverride ||
      override?.transactionCategoryId ||
      override?.categoryOverride ||
      override?.economicDirectionOverride,
  );
  const needsReview =
    (!explicitOwnerDecision &&
      !override?.reviewedAt &&
      classification?.reviewState !== ClassificationReviewState.RESOLVED) ||
    !financialRole ||
    financialRole === FinancialRole.UNCATEGORIZED ||
    (categoryBearing(financialRole) && !categoryId) ||
    economicDirection === EconomicDirection.UNKNOWN ||
    roleDirectionConflict;

  const storedAllocations = [...(transaction.allocations ?? [])]
    .sort((a, b) => a.displayOrder - b.displayOrder || a.id.localeCompare(b.id))
    .map<EffectiveAllocation>((allocation) => ({
      id: allocation.id,
      categoryId: allocation.transactionCategoryId,
      category: allocation.transactionCategory.name,
      amount: allocation.amount,
      displayOrder: allocation.displayOrder,
      provenance:
        allocation.provenance ?? ClassificationProvenance.OWNER_OVERRIDE,
      synthetic: false,
    }));
  const allocations =
    storedAllocations.length ||
    !transaction.amount ||
    !categoryId ||
    !categoryBearing(financialRole)
      ? storedAllocations
      : [
          {
            id: null,
            categoryId,
            category,
            amount: transaction.amount.abs(),
            displayOrder: 0,
            provenance: categoryProvenance,
            synthetic: true,
          } satisfies EffectiveAllocation,
        ];

  return {
    merchant:
      override?.merchantNameOverride ??
      transaction.merchantName ??
      transaction.originalName,
    category,
    categoryId,
    financialRole,
    economicDirection,
    notes: override?.notes ?? null,
    excludedFromReports: override?.excludedFromReports ?? false,
    roleProvenance,
    categoryProvenance,
    directionProvenance,
    roleCertainty: override?.financialRoleOverride
      ? ClassificationCertainty.CONFIRMED
      : (classification?.roleCertainty ?? ClassificationCertainty.UNKNOWN),
    categoryCertainty:
      ownerCategory || override?.categoryOverride
        ? ClassificationCertainty.CONFIRMED
        : (classification?.categoryCertainty ??
          ClassificationCertainty.UNKNOWN),
    directionCertainty: override?.economicDirectionOverride
      ? ClassificationCertainty.CONFIRMED
      : (classification?.directionCertainty ??
        (transaction.amount && !transaction.amount.isZero()
          ? ClassificationCertainty.DETERMINISTIC
          : ClassificationCertainty.UNKNOWN)),
    reviewState:
      classification?.reviewState ?? ClassificationReviewState.NEEDS_REVIEW,
    deferredUntil: classification?.deferredUntil ?? null,
    reasonCodes: [...new Set(reasonCodes)],
    needsReview,
    allocations,
    hasLocalOverride: Boolean(
      override &&
        (override.merchantNameOverride != null ||
          override.transactionCategoryId != null ||
          override.categoryOverride != null ||
          override.financialRoleOverride != null ||
          override.economicDirectionOverride != null ||
          override.notes != null ||
          Boolean(override.excludedFromReports)),
    ),
  };
}
