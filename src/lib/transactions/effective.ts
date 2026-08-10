import type { FinancialRole } from "@prisma/client";

export type EffectiveTransactionInput = {
  originalName: string;
  merchantName: string | null;
  providerCategory: string | null;
  override?: {
    merchantNameOverride?: string | null;
    categoryOverride?: string | null;
    financialRoleOverride?: FinancialRole | null;
    notes?: string | null;
    excludedFromReports?: boolean;
  } | null;
};

export function effectiveTransactionValues(
  transaction: EffectiveTransactionInput,
) {
  const override = transaction.override;
  return {
    merchant:
      override?.merchantNameOverride ??
      transaction.merchantName ??
      transaction.originalName,
    category:
      override?.categoryOverride ??
      transaction.providerCategory ??
      "Uncategorized",
    financialRole: override?.financialRoleOverride ?? null,
    notes: override?.notes ?? null,
    excludedFromReports: override?.excludedFromReports ?? false,
    hasLocalOverride: Boolean(
      override &&
        (override.merchantNameOverride != null ||
          override.categoryOverride != null ||
          override.financialRoleOverride != null ||
          override.notes != null ||
          Boolean(override.excludedFromReports)),
    ),
  };
}
