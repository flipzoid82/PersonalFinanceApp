import "server-only";

import {
  ClassificationRuleMatchType,
  EconomicDirection,
  FinancialRole,
  Prisma,
  TransactionCategoryKind,
} from "@prisma/client";
import { db } from "@/lib/db";
import { effectiveTransactionValues } from "./effective";
import { classifyStoredTransactions } from "./truth";
import { normalizeMatchValue } from "./taxonomy";
import { normalizeCategoryName } from "./taxonomy";
import { ruleMatchesTransaction } from "./classifier";

export type TransactionOverridePatch = {
  categoryOverride?: string | null;
  transactionCategoryId?: string | null;
  financialRoleOverride?: FinancialRole | null;
  economicDirectionOverride?: EconomicDirection | null;
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
      select: {
        id: true,
        classification: { select: { financialRole: true } },
        override: { select: { financialRoleOverride: true } },
      },
    });
    if (!source) throw new Error("Transaction not found.");
    if (patch.transactionCategoryId) {
      const category = await tx.transactionCategory.findFirst({
        where: {
          id: patch.transactionCategoryId,
          userId: ownerId,
          isActive: true,
        },
        select: { kind: true },
      });
      if (!category) throw new Error("Transaction category not found.");
      const role =
        patch.financialRoleOverride ??
        source.override?.financialRoleOverride ??
        source.classification?.financialRole ??
        null;
      if (
        role &&
        ((role === FinancialRole.INCOME &&
          category.kind !== TransactionCategoryKind.INCOME) ||
          (role === FinancialRole.EXPENSE &&
            category.kind !== TransactionCategoryKind.EXPENSE))
      )
        throw new Error(
          "Transaction category does not match the financial role.",
        );
    }
    const existing = await tx.transactionOverride.findUnique({
      where: { transactionId },
    });
    if (existing && existing.userId !== ownerId)
      throw new Error("Transaction not found.");

    const data: Prisma.TransactionOverrideUncheckedUpdateInput = {
      ...patch,
      reviewedAt: new Date(),
    };
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
            reviewedAt: new Date(),
          },
        });

    if (
      override.merchantNameOverride === null &&
      override.categoryOverride === null &&
      override.transactionCategoryId === null &&
      override.financialRoleOverride === null &&
      override.economicDirectionOverride === null &&
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

export type AllocationInput = {
  transactionCategoryId: string;
  amount: Prisma.Decimal;
};

export async function replaceTransactionAllocations(
  ownerId: string,
  transactionId: string,
  allocations: AllocationInput[],
) {
  if (allocations.length < 2 || allocations.length > 20)
    throw new Error("A split requires between 2 and 20 allocations.");
  return db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`hc1-split:${transactionId}`}, 0))`;
      const transaction = await tx.transaction.findFirst({
        where: { id: transactionId, userId: ownerId },
        include: {
          classification: {
            include: {
              transactionCategory: { select: { id: true, name: true } },
            },
          },
          override: {
            include: {
              transactionCategory: { select: { id: true, name: true } },
            },
          },
        },
      });
      if (!transaction) throw new Error("Transaction not found.");
      if (
        new Set(
          allocations.map(({ transactionCategoryId }) => transactionCategoryId),
        ).size !== allocations.length
      )
        throw new Error("Split categories must be unique.");
      if (allocations.some(({ amount }) => !amount.isPositive()))
        throw new Error("Split amounts must be positive.");
      const total = allocations.reduce(
        (sum, allocation) => sum.plus(allocation.amount),
        new Prisma.Decimal(0),
      );
      if (!total.equals(transaction.amount.abs()))
        throw new Error(
          "Split amounts must equal the transaction magnitude exactly.",
        );
      const effective = effectiveTransactionValues(transaction);
      const kind =
        effective.financialRole === FinancialRole.INCOME
          ? TransactionCategoryKind.INCOME
          : effective.financialRole === FinancialRole.EXPENSE
            ? TransactionCategoryKind.EXPENSE
            : null;
      if (!kind)
        throw new Error("Only income or expense transactions can be split.");
      const categories = await tx.transactionCategory.findMany({
        where: {
          userId: ownerId,
          isActive: true,
          kind,
          id: {
            in: allocations.map(
              ({ transactionCategoryId }) => transactionCategoryId,
            ),
          },
        },
        select: { id: true },
      });
      if (categories.length !== allocations.length)
        throw new Error(
          "A split category is unavailable or has the wrong kind.",
        );
      await tx.transactionAllocation.deleteMany({
        where: { userId: ownerId, transactionId },
      });
      await tx.transactionAllocation.createMany({
        data: allocations.map((allocation, displayOrder) => ({
          userId: ownerId,
          transactionId,
          transactionCategoryId: allocation.transactionCategoryId,
          amount: allocation.amount,
          displayOrder,
          reviewedAt: new Date(),
        })),
      });
      return tx.transactionAllocation.findMany({
        where: { userId: ownerId, transactionId },
        orderBy: { displayOrder: "asc" },
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function clearTransactionAllocations(
  ownerId: string,
  transactionId: string,
) {
  const result = await db.transactionAllocation.deleteMany({
    where: { userId: ownerId, transactionId, transaction: { userId: ownerId } },
  });
  return result.count;
}

export type ClassificationRulePatch = {
  matchType: ClassificationRuleMatchType;
  transactionId: string;
  transactionCategoryId: string | null;
  financialRole: FinancialRole | null;
  economicDirection: EconomicDirection | null;
};

export async function createFutureClassificationRule(
  ownerId: string,
  patch: ClassificationRulePatch,
) {
  return db.$transaction(async (tx) => {
    const transaction = await tx.transaction.findFirst({
      where: { id: patch.transactionId, userId: ownerId },
      select: {
        accountId: true,
        originalName: true,
        merchantName: true,
      },
    });
    if (!transaction) throw new Error("Transaction not found.");
    if (patch.transactionCategoryId) {
      const category = await tx.transactionCategory.findFirst({
        where: {
          id: patch.transactionCategoryId,
          userId: ownerId,
          isActive: true,
        },
        select: { id: true },
      });
      if (!category) throw new Error("Transaction category not found.");
    }
    const merchant = normalizeMatchValue(transaction.merchantName ?? "");
    const description = normalizeMatchValue(transaction.originalName);
    const normalizedValue =
      patch.matchType === ClassificationRuleMatchType.MERCHANT_EXACT ||
      patch.matchType === ClassificationRuleMatchType.MERCHANT_ACCOUNT
        ? merchant
        : description;
    if (!normalizedValue)
      throw new Error("The selected rule scope has no match value.");
    return tx.classificationRule.create({
      data: {
        userId: ownerId,
        matchType: patch.matchType,
        normalizedValue,
        accountId:
          patch.matchType === ClassificationRuleMatchType.MERCHANT_ACCOUNT
            ? transaction.accountId
            : null,
        transactionCategoryId: patch.transactionCategoryId,
        financialRole: patch.financialRole,
        economicDirection: patch.economicDirection,
        appliesFrom: new Date(),
      },
    });
  });
}

export async function previewHistoricalRuleApplication(
  ownerId: string,
  ruleId: string,
) {
  const rule = await db.classificationRule.findFirst({
    where: { id: ruleId, userId: ownerId },
  });
  if (!rule) throw new Error("Classification rule not found.");
  const candidates = await db.transaction.findMany({
    where: {
      userId: ownerId,
      createdAt: { lt: rule.appliesFrom },
      ...(rule.accountId ? { accountId: rule.accountId } : {}),
    },
    select: {
      id: true,
      accountId: true,
      originalName: true,
      merchantName: true,
      createdAt: true,
      amount: true,
      currency: true,
    },
    orderBy: { id: "asc" },
    take: 10_001,
  });
  if (candidates.length > 10_000)
    throw new Error(
      "Historical rule preview exceeds the 10,000 row scan limit.",
    );
  const transactions = candidates.filter((transaction) =>
    ruleMatchesTransaction(transaction, rule, true),
  );
  if (transactions.length > 1000)
    throw new Error(
      "Historical rule preview exceeds the 1,000 transaction limit.",
    );
  return {
    transactionIds: transactions.map(({ id }) => id),
    count: transactions.length,
    totalsByCurrency: transactions.reduce<Record<string, Prisma.Decimal>>(
      (totals, transaction) => ({
        ...totals,
        [transaction.currency]: (
          totals[transaction.currency] ?? new Prisma.Decimal(0)
        ).plus(transaction.amount.abs()),
      }),
      {},
    ),
  };
}

export async function confirmHistoricalRuleApplication(
  ownerId: string,
  ruleId: string,
  expectedTransactionIds: string[],
) {
  return db.$transaction(
    async (tx) => {
      const rule = await tx.classificationRule.findFirst({
        where: { id: ruleId, userId: ownerId },
      });
      if (!rule) throw new Error("Classification rule not found.");
      const candidates = await tx.transaction.findMany({
        where: {
          userId: ownerId,
          createdAt: { lt: rule.appliesFrom },
          ...(rule.accountId ? { accountId: rule.accountId } : {}),
        },
        select: {
          id: true,
          accountId: true,
          originalName: true,
          merchantName: true,
          createdAt: true,
        },
        orderBy: { id: "asc" },
        take: 10_001,
      });
      if (candidates.length > 10_000)
        throw new Error(
          "Historical rule application exceeds the 10,000 row scan limit.",
        );
      const current = candidates.filter((transaction) =>
        ruleMatchesTransaction(transaction, rule, true),
      );
      if (current.length > 1000)
        throw new Error(
          "Historical rule application exceeds the 1,000 transaction limit.",
        );
      const currentIds = current.map(({ id }) => id);
      if (
        currentIds.join("\u0000") !==
        [...expectedTransactionIds].sort().join("\u0000")
      )
        throw new Error(
          "Historical preview changed; review it again before confirming.",
        );
      const earliest = current.reduce<Date>(
        (date, transaction) =>
          transaction.createdAt < date ? transaction.createdAt : date,
        rule.appliesFrom,
      );
      await tx.classificationRule.update({
        where: { id: rule.id },
        data: { appliesFrom: earliest },
      });
      await classifyStoredTransactions(tx, ownerId, currentIds);
      return currentIds.length;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function createTransactionCategory(
  ownerId: string,
  kind: TransactionCategoryKind,
  name: string,
) {
  const trimmed = name.trim().replace(/\s+/g, " ");
  if (!trimmed || trimmed.length > 80)
    throw new Error("Category name is invalid.");
  const last = await db.transactionCategory.aggregate({
    where: { userId: ownerId, kind },
    _max: { displayOrder: true },
  });
  try {
    return await db.transactionCategory.create({
      data: {
        userId: ownerId,
        kind,
        name: trimmed,
        normalizedName: normalizeCategoryName(trimmed),
        displayOrder: (last._max.displayOrder ?? -1) + 1,
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    )
      throw new Error("A category with that name already exists.");
    throw error;
  }
}

export async function updateTransactionCategory(
  ownerId: string,
  categoryId: string,
  patch: { name: string; isActive: boolean; displayOrder: number },
) {
  const name = patch.name.trim().replace(/\s+/g, " ");
  if (!name || name.length > 80 || !Number.isSafeInteger(patch.displayOrder))
    throw new Error("Category values are invalid.");
  const updated = await db.transactionCategory.updateMany({
    where: { id: categoryId, userId: ownerId },
    data: {
      name,
      normalizedName: normalizeCategoryName(name),
      isActive: patch.isActive,
      displayOrder: Math.max(0, Math.min(10_000, patch.displayOrder)),
    },
  });
  if (updated.count !== 1) throw new Error("Transaction category not found.");
}
