import "server-only";

import { TransactionStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { effectiveTransactionValues } from "@/lib/transactions/effective";
import { calculateSpending } from "./calculations";

export async function getSpendingViewModel(ownerId: string, now = new Date()) {
  const transactions = await db.transaction.findMany({
    where: {
      userId: ownerId,
      status: TransactionStatus.POSTED,
      postedAt: { not: null, lte: now },
      removedAt: null,
    },
    select: {
      id: true,
      originalName: true,
      merchantName: true,
      providerCategory: true,
      amount: true,
      currency: true,
      postedAt: true,
      account: { select: { name: true } },
      override: {
        select: {
          merchantNameOverride: true,
          categoryOverride: true,
          financialRoleOverride: true,
          excludedFromReports: true,
        },
      },
    },
    orderBy: [{ postedAt: "desc" }, { id: "desc" }],
  });
  const model = calculateSpending(
    transactions.flatMap((transaction) => {
      const effective = effectiveTransactionValues(transaction);
      return transaction.postedAt &&
        effective.financialRole &&
        !effective.excludedFromReports
        ? [
            {
              id: transaction.id,
              merchant: effective.merchant,
              category: effective.category,
              role: effective.financialRole,
              amount: transaction.amount,
              currency: transaction.currency,
              postedAt: transaction.postedAt,
              accountName: transaction.account.name,
            },
          ]
        : [];
    }),
    now,
  );
  return model;
}
