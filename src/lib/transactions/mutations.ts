import "server-only";

import type { FinancialRole, Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export type TransactionOverridePatch = {
  categoryOverride?: string | null;
  financialRoleOverride?: FinancialRole | null;
  notes?: string | null;
  excludedFromReports?: boolean;
};

export async function updateTransactionOverride(
  ownerId: string,
  transactionId: string,
  patch: TransactionOverridePatch,
) {
  return db.$transaction(async (tx) => {
    const source = await tx.transaction.findFirst({
      where: { id: transactionId, userId: ownerId },
      select: { id: true },
    });
    if (!source) throw new Error("Transaction not found.");
    const existing = await tx.transactionOverride.findUnique({
      where: { transactionId },
    });
    if (existing && existing.userId !== ownerId)
      throw new Error("Transaction not found.");

    const data: Prisma.TransactionOverrideUncheckedUpdateInput = { ...patch };
    const override = existing
      ? await tx.transactionOverride.update({
          where: { id: existing.id },
          data,
        })
      : await tx.transactionOverride.create({
          data: {
            userId: ownerId,
            transactionId,
            ...patch,
          },
        });

    if (
      override.merchantNameOverride === null &&
      override.categoryOverride === null &&
      override.financialRoleOverride === null &&
      override.notes === null &&
      !override.excludedFromReports &&
      override.linkedTransactionId === null
    ) {
      await tx.transactionOverride.delete({ where: { id: override.id } });
      return null;
    }
    return override;
  });
}
