import {
  ClassificationCertainty,
  ClassificationProvenance,
  ClassificationReviewState,
  EconomicDirection,
  FinancialRole,
  Prisma,
  TransactionCategoryKind,
  TransactionRelationshipState,
  TransactionRelationshipType,
  type PrismaClient,
} from "@prisma/client";
import {
  classifyTransaction,
  TRANSACTION_CLASSIFIER_VERSION,
  type ClassificationRuleInput,
} from "./classifier";
import { effectiveTransactionValues } from "./effective";
import {
  normalizeCategoryName,
  STARTER_TRANSACTION_CATEGORIES,
} from "./taxonomy";

export const TRANSACTION_TRUTH_VERSION = 3;
export const TRANSACTION_TRUTH_BACKFILL_BATCH_SIZE = 250;

type TruthClient = Prisma.TransactionClient | PrismaClient;

export type LegacyLinkInventory = {
  encountered: number;
  deterministicallyConverted: Record<
    "INTERNAL_TRANSFER" | "CREDIT_CARD_PAYMENT" | "REFUND" | "REIMBURSEMENT",
    number
  >;
  legacyUntyped: number;
  structurallyInvalid: number;
  stillNonNull: number;
  functionallyLegacyDependent: number;
  correspondingTypedRelationships: number;
  rerunDelta: number;
};

function emptyLegacyLinkInventory(): LegacyLinkInventory {
  return {
    encountered: 0,
    deterministicallyConverted: {
      INTERNAL_TRANSFER: 0,
      CREDIT_CARD_PAYMENT: 0,
      REFUND: 0,
      REIMBURSEMENT: 0,
    },
    legacyUntyped: 0,
    structurallyInvalid: 0,
    stillNonNull: 0,
    functionallyLegacyDependent: 0,
    correspondingTypedRelationships: 0,
    rerunDelta: 0,
  };
}

export async function bootstrapTransactionCategories(
  client: TruthClient,
  ownerId: string,
) {
  await client.transactionCategory.createMany({
    data: STARTER_TRANSACTION_CATEGORIES.map(
      ([systemKey, kind, name], displayOrder) => ({
        userId: ownerId,
        systemKey,
        kind,
        name,
        normalizedName: normalizeCategoryName(name),
        displayOrder,
      }),
    ),
    skipDuplicates: true,
  });
  return client.transactionCategory.findMany({
    where: { userId: ownerId },
    orderBy: [{ kind: "asc" }, { displayOrder: "asc" }, { id: "asc" }],
  });
}

export async function migrateLegacyCategoryOverrides(
  client: TruthClient,
  ownerId: string,
) {
  const overrides = await client.transactionOverride.findMany({
    where: {
      userId: ownerId,
      transactionCategoryId: null,
      financialRoleOverride: {
        in: [FinancialRole.EXPENSE, FinancialRole.INCOME, FinancialRole.REFUND],
      },
    },
    select: {
      id: true,
      categoryOverride: true,
      financialRoleOverride: true,
      transaction: { select: { providerCategory: true } },
    },
  });
  for (const override of overrides) {
    if (!override.financialRoleOverride) continue;
    const legacyName =
      override.categoryOverride ?? override.transaction.providerCategory;
    if (!legacyName) continue;
    const normalizedName = normalizeCategoryName(legacyName);
    if (!normalizedName || normalizedName === "uncategorized") continue;
    const kind =
      override.financialRoleOverride === FinancialRole.INCOME
        ? TransactionCategoryKind.INCOME
        : TransactionCategoryKind.EXPENSE;
    const category = await client.transactionCategory.upsert({
      where: { userId_normalizedName: { userId: ownerId, normalizedName } },
      update: {},
      create: {
        userId: ownerId,
        kind,
        name: legacyName,
        normalizedName,
        displayOrder: STARTER_TRANSACTION_CATEGORIES.length + 100,
      },
      select: { id: true, kind: true },
    });
    if (category.kind !== kind) continue;
    await client.transactionOverride.update({
      where: { id: override.id },
      data: { transactionCategoryId: category.id, reviewedAt: new Date() },
    });
  }
}

async function classificationContext(client: TruthClient, ownerId: string) {
  const [categories, rules] = await Promise.all([
    client.transactionCategory.findMany({ where: { userId: ownerId } }),
    client.classificationRule.findMany({
      where: { userId: ownerId, isActive: true },
      select: {
        id: true,
        matchType: true,
        normalizedValue: true,
        accountId: true,
        transactionCategoryId: true,
        financialRole: true,
        economicDirection: true,
        priority: true,
        appliesFrom: true,
      },
      orderBy: [{ priority: "asc" }, { id: "asc" }],
    }),
  ]);
  return {
    categories: new Map(
      categories.flatMap((category) =>
        category.systemKey ? [[category.systemKey, category] as const] : [],
      ),
    ),
    rules: rules satisfies ClassificationRuleInput[],
  };
}

export async function classifyStoredTransactions(
  client: TruthClient,
  ownerId: string,
  transactionIds: string[],
) {
  if (!transactionIds.length) return;
  const context = await classificationContext(client, ownerId);
  const transactions = await client.transaction.findMany({
    where: { userId: ownerId, id: { in: transactionIds } },
    select: {
      id: true,
      accountId: true,
      originalName: true,
      merchantName: true,
      amount: true,
      providerCategory: true,
      providerCategoryConfidence: true,
      status: true,
      removedAt: true,
      createdAt: true,
      account: { select: { accountType: true } },
    },
  });
  for (const transaction of transactions) {
    const result = classifyTransaction(
      transaction,
      context.categories,
      context.rules,
    );
    await client.transactionClassification.upsert({
      where: { transactionId: transaction.id },
      update: {
        ...result,
        classifierVersion: TRANSACTION_CLASSIFIER_VERSION,
        classifiedAt: new Date(),
      },
      create: {
        userId: ownerId,
        transactionId: transaction.id,
        ...result,
        classifierVersion: TRANSACTION_CLASSIFIER_VERSION,
      },
    });
  }
}

export async function preservePendingOwnerState(
  client: Prisma.TransactionClient,
  ownerId: string,
  pendingTransactionId: string,
  postedTransactionId: string,
) {
  if (pendingTransactionId === postedTransactionId) return;
  const [pending, posted] = await Promise.all([
    client.transaction.findFirst({
      where: { id: pendingTransactionId, userId: ownerId },
      include: { override: true, allocations: true },
    }),
    client.transaction.findFirst({
      where: { id: postedTransactionId, userId: ownerId },
      include: { override: true, allocations: true },
    }),
  ]);
  if (!pending || !posted || pending.currency !== posted.currency) return;

  let conflict = false;
  if (pending.override) {
    const inherited = {
      merchantNameOverride: pending.override.merchantNameOverride,
      categoryOverride: pending.override.categoryOverride,
      transactionCategoryId: pending.override.transactionCategoryId,
      financialRoleOverride: pending.override.financialRoleOverride,
      economicDirectionOverride: pending.override.economicDirectionOverride,
      notes: pending.override.notes,
      excludedFromReports: pending.override.excludedFromReports,
      linkedTransactionId:
        pending.override.linkedTransactionId === postedTransactionId
          ? null
          : pending.override.linkedTransactionId,
      reviewedAt: pending.override.reviewedAt,
    };
    if (!posted.override) {
      await client.transactionOverride.create({
        data: {
          userId: ownerId,
          transactionId: postedTransactionId,
          ...inherited,
        },
      });
    } else {
      const merge = <T>(postedValue: T | null, pendingValue: T | null) => {
        if (
          postedValue != null &&
          pendingValue != null &&
          postedValue !== pendingValue
        )
          conflict = true;
        return postedValue ?? pendingValue;
      };
      await client.transactionOverride.update({
        where: { id: posted.override.id },
        data: {
          merchantNameOverride: merge(
            posted.override.merchantNameOverride,
            inherited.merchantNameOverride,
          ),
          categoryOverride: merge(
            posted.override.categoryOverride,
            inherited.categoryOverride,
          ),
          transactionCategoryId: merge(
            posted.override.transactionCategoryId,
            inherited.transactionCategoryId,
          ),
          financialRoleOverride: merge(
            posted.override.financialRoleOverride,
            inherited.financialRoleOverride,
          ),
          economicDirectionOverride: merge(
            posted.override.economicDirectionOverride,
            inherited.economicDirectionOverride,
          ),
          notes: merge(posted.override.notes, inherited.notes),
          excludedFromReports:
            posted.override.excludedFromReports ||
            inherited.excludedFromReports,
          linkedTransactionId: merge(
            posted.override.linkedTransactionId,
            inherited.linkedTransactionId,
          ),
          reviewedAt: merge(posted.override.reviewedAt, inherited.reviewedAt),
        },
      });
    }
  }

  if (!posted.allocations.length && pending.allocations.length) {
    await client.transactionAllocation.updateMany({
      where: { userId: ownerId, transactionId: pendingTransactionId },
      data: { transactionId: postedTransactionId },
    });
  } else if (posted.allocations.length && pending.allocations.length) {
    conflict = true;
  }

  const relationships = await client.transactionRelationship.findMany({
    where: {
      userId: ownerId,
      OR: [
        { sourceTransactionId: pendingTransactionId },
        { targetTransactionId: pendingTransactionId },
      ],
    },
  });
  for (const relationship of relationships) {
    const sourceTransactionId =
      relationship.sourceTransactionId === pendingTransactionId
        ? postedTransactionId
        : relationship.sourceTransactionId;
    const targetTransactionId =
      relationship.targetTransactionId === pendingTransactionId
        ? postedTransactionId
        : relationship.targetTransactionId;
    if (sourceTransactionId === targetTransactionId) {
      conflict = true;
      continue;
    }
    await client.transactionRelationship.upsert({
      where: {
        userId_type_sourceTransactionId_targetTransactionId: {
          userId: ownerId,
          type: relationship.type,
          sourceTransactionId,
          targetTransactionId,
        },
      },
      update: {},
      create: {
        userId: ownerId,
        sourceTransactionId,
        targetTransactionId,
        type: relationship.type,
        appliedAmount: relationship.appliedAmount,
        provenance: relationship.provenance,
        certainty: relationship.certainty,
        state: relationship.state,
        reasonCodes: relationship.reasonCodes,
        evidence: relationship.evidence ?? undefined,
        confirmedAt: relationship.confirmedAt,
      },
    });
    await client.transactionRelationship.delete({
      where: { id: relationship.id },
    });
  }

  const postedCalendarLink = await client.calendarEvent.findFirst({
    where: { userId: ownerId, linkedTransactionId: postedTransactionId },
    select: { id: true },
  });
  if (!postedCalendarLink)
    await client.calendarEvent.updateMany({
      where: { userId: ownerId, linkedTransactionId: pendingTransactionId },
      data: { linkedTransactionId: postedTransactionId },
    });
  else if (
    await client.calendarEvent.count({
      where: { userId: ownerId, linkedTransactionId: pendingTransactionId },
    })
  )
    conflict = true;

  await client.transactionOverride.updateMany({
    where: {
      userId: ownerId,
      linkedTransactionId: pendingTransactionId,
      transactionId: { not: postedTransactionId },
    },
    data: { linkedTransactionId: postedTransactionId },
  });

  if (conflict) {
    const classification = await client.transactionClassification.findUnique({
      where: { transactionId: postedTransactionId },
      select: { reasonCodes: true },
    });
    if (classification)
      await client.transactionClassification.update({
        where: { transactionId: postedTransactionId },
        data: {
          reviewState: ClassificationReviewState.NEEDS_REVIEW,
          reasonCodes: [
            ...new Set([
              ...classification.reasonCodes,
              "PENDING_POSTED_OWNER_STATE_CONFLICT",
            ]),
          ],
        },
      });
  }
}

export async function inventoryLegacyLinks(
  client: TruthClient,
  ownerId: string,
) {
  const inventory = emptyLegacyLinkInventory();
  const links = await client.transactionOverride.findMany({
    where: { userId: ownerId, linkedTransactionId: { not: null } },
    select: {
      transactionId: true,
      linkedTransactionId: true,
      transaction: { select: { currency: true, userId: true } },
      linkedTransaction: { select: { currency: true, userId: true } },
    },
  });
  inventory.encountered = links.length;
  for (const link of links) {
    const targetId = link.linkedTransactionId;
    if (
      !targetId ||
      targetId === link.transactionId ||
      link.transaction.userId !== ownerId ||
      link.linkedTransaction?.userId !== ownerId ||
      link.transaction.currency !== link.linkedTransaction?.currency
    ) {
      inventory.structurallyInvalid += 1;
      const classification = await client.transactionClassification.findUnique({
        where: { transactionId: link.transactionId },
        select: { reasonCodes: true },
      });
      if (classification)
        await client.transactionClassification.update({
          where: { transactionId: link.transactionId },
          data: {
            reviewState: ClassificationReviewState.NEEDS_REVIEW,
            reasonCodes: [
              ...new Set([
                ...classification.reasonCodes,
                "LEGACY_LINK_STRUCTURALLY_INVALID",
              ]),
            ],
          },
        });
      continue;
    }
    const supported = await client.transactionRelationship.findFirst({
      where: {
        userId: ownerId,
        sourceTransactionId: link.transactionId,
        targetTransactionId: targetId,
        type: { not: TransactionRelationshipType.LEGACY_UNTYPED },
      },
      select: { id: true },
    });
    if (supported) {
      inventory.correspondingTypedRelationships += 1;
      continue;
    }
    inventory.legacyUntyped += 1;
    const existing = await client.transactionRelationship.findUnique({
      where: {
        userId_type_sourceTransactionId_targetTransactionId: {
          userId: ownerId,
          type: TransactionRelationshipType.LEGACY_UNTYPED,
          sourceTransactionId: link.transactionId,
          targetTransactionId: targetId,
        },
      },
      select: { id: true },
    });
    if (!existing) {
      await client.transactionRelationship.create({
        data: {
          userId: ownerId,
          sourceTransactionId: link.transactionId,
          targetTransactionId: targetId,
          type: TransactionRelationshipType.LEGACY_UNTYPED,
          provenance: ClassificationProvenance.OWNER_OVERRIDE,
          certainty: ClassificationCertainty.UNKNOWN,
          state: TransactionRelationshipState.NEEDS_REVIEW,
          reasonCodes: ["LEGACY_UNTYPED_LINK_REQUIRES_REVIEW"],
          evidence: {
            origin: "TRANSACTION_OVERRIDE_LINKED_TRANSACTION_ID",
          },
        },
      });
      inventory.rerunDelta += 1;
    }
  }
  inventory.stillNonNull = await client.transactionOverride.count({
    where: { userId: ownerId, linkedTransactionId: { not: null } },
  });
  inventory.functionallyLegacyDependent =
    inventory.legacyUntyped + inventory.structurallyInvalid;
  return inventory;
}

async function verifyLegacyCompatibility(client: TruthClient, ownerId: string) {
  const transactions = await client.transaction.findMany({
    where: { userId: ownerId, override: { isNot: null } },
    select: {
      id: true,
      amount: true,
      originalName: true,
      merchantName: true,
      providerCategory: true,
      override: {
        include: { transactionCategory: { select: { id: true, name: true } } },
      },
      classification: {
        include: { transactionCategory: { select: { id: true, name: true } } },
      },
    },
  });
  for (const transaction of transactions) {
    const legacy = transaction.override;
    if (!legacy) continue;
    const current = effectiveTransactionValues(transaction);
    if (
      (legacy.financialRoleOverride &&
        current.financialRole !== legacy.financialRoleOverride) ||
      current.excludedFromReports !== legacy.excludedFromReports ||
      current.merchant !==
        (legacy.merchantNameOverride ??
          transaction.merchantName ??
          transaction.originalName) ||
      (legacy.categoryOverride && current.category !== legacy.categoryOverride)
    )
      throw new Error(
        "Legacy transaction reconciliation found an unexplained difference.",
      );
  }
}

async function applicationDatabase() {
  return (await import("@/lib/db")).db;
}

export async function backfillOwnerTransactionTruth(
  ownerId: string,
  suppliedDatabase?: PrismaClient,
) {
  const database = suppliedDatabase ?? (await applicationDatabase());
  const owner = await database.user.findUnique({
    where: { id: ownerId },
    select: { id: true },
  });
  if (!owner) throw new Error("Owner not found.");

  await database.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`hc1-bootstrap:${ownerId}`}, 0))`;
    await bootstrapTransactionCategories(tx, ownerId);
    await migrateLegacyCategoryOverrides(tx, ownerId);
  });

  while (true) {
    const batch = await database.transaction.findMany({
      where: {
        userId: ownerId,
        OR: [
          { classification: null },
          {
            classification: {
              is: {
                classifierVersion: { not: TRANSACTION_CLASSIFIER_VERSION },
              },
            },
          },
        ],
      },
      select: { id: true },
      orderBy: { id: "asc" },
      take: TRANSACTION_TRUTH_BACKFILL_BATCH_SIZE,
    });
    if (!batch.length) break;
    await database.$transaction(async (tx) => {
      await classifyStoredTransactions(
        tx,
        ownerId,
        batch.map(({ id }) => id),
      );
    });
  }

  return database.$transaction(async (tx) => {
    const legacyLinkInventory = await inventoryLegacyLinks(tx, ownerId);
    await verifyLegacyCompatibility(tx, ownerId);
    const missing = await tx.transaction.count({
      where: { userId: ownerId, classification: null },
    });
    if (missing) throw new Error("Transaction truth backfill is incomplete.");
    await tx.user.update({
      where: { id: ownerId },
      data: {
        transactionTruthVersion: TRANSACTION_TRUTH_VERSION,
        transactionTruthCutoverAt: new Date(),
      },
    });
    return legacyLinkInventory;
  });
}

export async function ensureTransactionTruthReady(
  ownerId: string,
  suppliedDatabase?: PrismaClient,
) {
  const database = suppliedDatabase ?? (await applicationDatabase());
  const [owner, missingClassification, outdatedClassification] =
    await Promise.all([
      database.user.findUnique({
        where: { id: ownerId },
        select: {
          transactionTruthVersion: true,
          transactionTruthCutoverAt: true,
        },
      }),
      database.transaction.findFirst({
        where: { userId: ownerId, classification: null },
        select: { id: true },
        orderBy: { id: "asc" },
      }),
      database.transactionClassification.findFirst({
        where: {
          userId: ownerId,
          classifierVersion: { not: TRANSACTION_CLASSIFIER_VERSION },
        },
        select: { id: true },
        orderBy: { id: "asc" },
      }),
    ]);
  if (
    owner?.transactionTruthVersion === TRANSACTION_TRUTH_VERSION &&
    owner.transactionTruthCutoverAt &&
    !missingClassification &&
    !outdatedClassification
  )
    return;
  await backfillOwnerTransactionTruth(ownerId, database);
}

export async function deferTransactionReview(
  ownerId: string,
  transactionId: string,
  until: Date | null,
) {
  const database = await applicationDatabase();
  const updated = await database.transactionClassification.updateMany({
    where: { transactionId, userId: ownerId },
    data: {
      reviewState: until
        ? ClassificationReviewState.DEFERRED
        : ClassificationReviewState.NEEDS_REVIEW,
      deferredUntil: until,
    },
  });
  if (updated.count !== 1) throw new Error("Transaction not found.");
}

export function ownerDirectionProvenance(direction: EconomicDirection | null) {
  return direction
    ? ClassificationProvenance.OWNER_OVERRIDE
    : ClassificationProvenance.UNRESOLVED;
}
