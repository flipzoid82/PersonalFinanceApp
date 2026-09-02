import "server-only";

import {
  AccountType,
  ClassificationCertainty,
  ClassificationProvenance,
  EconomicDirection,
  FinancialRole,
  Prisma,
  TransactionRelationshipState,
  TransactionRelationshipType,
  TransactionStatus,
} from "@prisma/client";
import { db } from "@/lib/db";
import { effectiveTransactionValues } from "./effective";
import { isRelationshipEligible } from "./eligibility";
import { ensureTransactionTruthReady } from "./truth";

const SUGGESTION_WINDOW_DAYS = 7;

const relationshipInclude = {
  classification: {
    include: { transactionCategory: { select: { id: true, name: true } } },
  },
  override: {
    include: { transactionCategory: { select: { id: true, name: true } } },
  },
  account: { select: { id: true, accountType: true, userId: true } },
  allocations: {
    include: { transactionCategory: { select: { id: true, name: true } } },
    orderBy: [{ displayOrder: "asc" as const }, { id: "asc" as const }],
  },
} satisfies Prisma.TransactionInclude;

type RelationshipTransaction = Prisma.TransactionGetPayload<{
  include: typeof relationshipInclude;
}>;

const SUPPORTED_RELATIONSHIP_TYPES = new Set<TransactionRelationshipType>([
  TransactionRelationshipType.INTERNAL_TRANSFER,
  TransactionRelationshipType.CREDIT_CARD_PAYMENT,
  TransactionRelationshipType.REFUND,
  TransactionRelationshipType.REIMBURSEMENT,
]);

function resolutionEvidence(
  existing: Prisma.JsonValue | null,
  resolvedType: TransactionRelationshipType,
) {
  const prior =
    existing && typeof existing === "object" && !Array.isArray(existing)
      ? existing
      : {};
  return {
    ...prior,
    origin: "TRANSACTION_OVERRIDE_LINKED_TRANSACTION_ID",
    resolvedType,
  } satisfies Prisma.JsonObject;
}

function effectiveDate(transaction: {
  postedAt: Date | null;
  authorizedAt: Date | null;
  createdAt: Date;
}) {
  return (
    transaction.postedAt ?? transaction.authorizedAt ?? transaction.createdAt
  );
}

function suggestionType(
  first: Prisma.TransactionGetPayload<{ include: typeof relationshipInclude }>,
  second: Prisma.TransactionGetPayload<{ include: typeof relationshipInclude }>,
) {
  const firstRole = effectiveTransactionValues(first).financialRole;
  const secondRole = effectiveTransactionValues(second).financialRole;
  const movementRoles = new Set<FinancialRole>([
    FinancialRole.TRANSFER,
    FinancialRole.CREDIT_CARD_PAYMENT,
  ]);
  if (
    !firstRole ||
    !secondRole ||
    !movementRoles.has(firstRole) ||
    !movementRoles.has(secondRole)
  )
    return null;
  if (
    firstRole === FinancialRole.CREDIT_CARD_PAYMENT ||
    secondRole === FinancialRole.CREDIT_CARD_PAYMENT
  )
    return TransactionRelationshipType.CREDIT_CARD_PAYMENT;
  if (
    first.account.accountType === AccountType.CREDIT_CARD ||
    second.account.accountType === AccountType.CREDIT_CARD
  )
    return TransactionRelationshipType.CREDIT_CARD_PAYMENT;
  return TransactionRelationshipType.INTERNAL_TRANSFER;
}

async function retireIneligibleSystemSuggestions(ownerId: string) {
  const suggestions = await db.transactionRelationship.findMany({
    where: {
      userId: ownerId,
      provenance: ClassificationProvenance.SYSTEM,
      state: TransactionRelationshipState.SUGGESTED,
    },
    include: {
      sourceTransaction: { include: relationshipInclude },
      targetTransaction: { include: relationshipInclude },
    },
  });
  for (const suggestion of suggestions) {
    const sourceEffective = effectiveTransactionValues(
      suggestion.sourceTransaction,
    );
    const targetEffective = effectiveTransactionValues(
      suggestion.targetTransaction,
    );
    const expectedType = suggestionType(
      suggestion.sourceTransaction,
      suggestion.targetTransaction,
    );
    if (
      sourceEffective.needsReview ||
      targetEffective.needsReview ||
      expectedType !== suggestion.type
    )
      await db.transactionRelationship.update({
        where: { id: suggestion.id },
        data: {
          state: TransactionRelationshipState.REJECTED,
          reasonCodes: [
            ...new Set([
              ...suggestion.reasonCodes,
              "NO_LONGER_ELIGIBLE_FOR_SUGGESTION",
            ]),
          ],
        },
      });
  }
}

export async function suggestMovementRelationships(ownerId: string) {
  await ensureTransactionTruthReady(ownerId);
  await retireIneligibleSystemSuggestions(ownerId);
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 120);
  const transactions = await db.transaction.findMany({
    where: {
      userId: ownerId,
      removedAt: null,
      status: { in: [TransactionStatus.POSTED, TransactionStatus.PENDING] },
      OR: [{ postedAt: { gte: since } }, { authorizedAt: { gte: since } }],
    },
    include: relationshipInclude,
    orderBy: [{ postedAt: "desc" }, { id: "desc" }],
    take: 500,
  });
  const groups = new Map<string, typeof transactions>();
  for (const transaction of transactions) {
    if (!isRelationshipEligible(transaction)) continue;
    if (effectiveTransactionValues(transaction).needsReview) continue;
    const key = `${transaction.currency}:${transaction.amount.abs().toFixed(4)}`;
    const group = groups.get(key) ?? [];
    group.push(transaction);
    groups.set(key, group);
  }
  let created = 0;
  for (const group of groups.values()) {
    for (let left = 0; left < group.length; left += 1) {
      for (let right = left + 1; right < group.length; right += 1) {
        const first = group[left];
        const second = group[right];
        if (first.accountId === second.accountId) continue;
        const firstEffective = effectiveTransactionValues(first);
        const secondEffective = effectiveTransactionValues(second);
        if (
          firstEffective.economicDirection === EconomicDirection.UNKNOWN ||
          secondEffective.economicDirection === EconomicDirection.UNKNOWN ||
          firstEffective.economicDirection === secondEffective.economicDirection
        )
          continue;
        const days =
          Math.abs(
            effectiveDate(first).getTime() - effectiveDate(second).getTime(),
          ) / 86_400_000;
        if (days > SUGGESTION_WINDOW_DAYS) continue;
        const type = suggestionType(first, second);
        if (!type) continue;
        const source =
          firstEffective.economicDirection === EconomicDirection.OUTFLOW
            ? first
            : second;
        const target = source.id === first.id ? second : first;
        const result = await db.transactionRelationship.createMany({
          data: {
            userId: ownerId,
            sourceTransactionId: source.id,
            targetTransactionId: target.id,
            type,
            appliedAmount: source.amount.abs(),
            provenance: ClassificationProvenance.SYSTEM,
            certainty: ClassificationCertainty.DETERMINISTIC,
            state: TransactionRelationshipState.SUGGESTED,
            reasonCodes: ["OPPOSITE_DIRECTION_EQUAL_AMOUNT_NEAR_DATE"],
            evidence: { suggestionWindowDays: SUGGESTION_WINDOW_DAYS },
          },
          skipDuplicates: true,
        });
        created += result.count;
      }
    }
  }
  return created;
}

export async function setRelationshipState(
  ownerId: string,
  relationshipId: string,
  state: TransactionRelationshipState,
) {
  return db.$transaction(
    async (tx) => {
      const relationship = await tx.transactionRelationship.findFirst({
        where: { id: relationshipId, userId: ownerId },
        include: {
          sourceTransaction: { include: relationshipInclude },
          targetTransaction: { include: relationshipInclude },
        },
      });
      if (!relationship) throw new Error("Transaction relationship not found.");
      const { sourceTransaction: source, targetTransaction: target } =
        relationship;
      if (
        relationship.type === TransactionRelationshipType.LEGACY_UNTYPED &&
        state === TransactionRelationshipState.CONFIRMED
      )
        throw new Error(
          "Select and validate a supported relationship type before confirmation.",
        );
      if (
        source.userId !== ownerId ||
        target.userId !== ownerId ||
        source.currency !== target.currency ||
        !isRelationshipEligible(source) ||
        !isRelationshipEligible(target)
      )
        throw new Error("Transaction relationship is not eligible.");
      if (
        (relationship.type === TransactionRelationshipType.INTERNAL_TRANSFER ||
          relationship.type ===
            TransactionRelationshipType.CREDIT_CARD_PAYMENT) &&
        source.accountId === target.accountId
      )
        throw new Error("A movement relationship requires distinct accounts.");
      if (
        state === TransactionRelationshipState.CONFIRMED &&
        (relationship.type === TransactionRelationshipType.REFUND ||
          relationship.type === TransactionRelationshipType.REIMBURSEMENT)
      )
        throw new Error(
          "Refund relationships must be confirmed with an exact applied amount.",
        );
      if (
        state === TransactionRelationshipState.CONFIRMED &&
        (relationship.type === TransactionRelationshipType.INTERNAL_TRANSFER ||
          relationship.type === TransactionRelationshipType.CREDIT_CARD_PAYMENT)
      ) {
        const sourceEffective = effectiveTransactionValues(source);
        const targetEffective = effectiveTransactionValues(target);
        if (
          sourceEffective.economicDirection !== EconomicDirection.OUTFLOW ||
          targetEffective.economicDirection !== EconomicDirection.INFLOW
        )
          throw new Error("Confirmed movement requires opposite directions.");
        const applied = relationship.appliedAmount ?? source.amount.abs();
        if (
          applied.greaterThan(source.amount.abs()) ||
          applied.greaterThan(target.amount.abs())
        )
          throw new Error(
            "Applied relationship amount exceeds a source transaction.",
          );
        const expectedRole =
          relationship.type === TransactionRelationshipType.CREDIT_CARD_PAYMENT
            ? FinancialRole.CREDIT_CARD_PAYMENT
            : FinancialRole.TRANSFER;
        for (const transaction of [source, target]) {
          if (
            transaction.override?.financialRoleOverride &&
            transaction.override.financialRoleOverride !== expectedRole
          )
            throw new Error(
              "An existing owner role conflicts with this relationship.",
            );
          await tx.transactionOverride.upsert({
            where: { transactionId: transaction.id },
            update: {
              financialRoleOverride: expectedRole,
              reviewedAt: new Date(),
            },
            create: {
              userId: ownerId,
              transactionId: transaction.id,
              financialRoleOverride: expectedRole,
              reviewedAt: new Date(),
            },
          });
        }
      }
      if (
        state === TransactionRelationshipState.REJECTED &&
        relationship.state === TransactionRelationshipState.CONFIRMED
      ) {
        if (
          relationship.type === TransactionRelationshipType.REFUND ||
          relationship.type === TransactionRelationshipType.REIMBURSEMENT
        ) {
          const evidence = relationship.evidence as {
            allocationAmounts?: Array<{ categoryId: string; amount: string }>;
          } | null;
          if (!evidence?.allocationAmounts?.length)
            throw new Error(
              "This legacy refund link needs review before it can be unlinked safely.",
            );
          for (const allocation of evidence.allocationAmounts) {
            const existing = await tx.transactionAllocation.findUnique({
              where: {
                transactionId_transactionCategoryId: {
                  transactionId: source.id,
                  transactionCategoryId: allocation.categoryId,
                },
              },
            });
            if (!existing || existing.userId !== ownerId)
              throw new Error("Refund allocation history is incomplete.");
            const remaining = existing.amount.minus(allocation.amount);
            if (remaining.isNegative())
              throw new Error("Refund allocation history is inconsistent.");
            if (remaining.isZero())
              await tx.transactionAllocation.delete({
                where: { id: existing.id },
              });
            else
              await tx.transactionAllocation.update({
                where: { id: existing.id },
                data: { amount: remaining, reviewedAt: new Date() },
              });
          }
          const remainingLinks = await tx.transactionRelationship.count({
            where: {
              id: { not: relationship.id },
              userId: ownerId,
              sourceTransactionId: source.id,
              type: {
                in: [
                  TransactionRelationshipType.REFUND,
                  TransactionRelationshipType.REIMBURSEMENT,
                ],
              },
              state: TransactionRelationshipState.CONFIRMED,
            },
          });
          if (
            remainingLinks === 0 &&
            source.override?.financialRoleOverride === FinancialRole.REFUND
          )
            await tx.transactionOverride.update({
              where: { transactionId: source.id },
              data: { financialRoleOverride: null, reviewedAt: new Date() },
            });
        } else {
          for (const transaction of [source, target]) {
            const otherConfirmed = await tx.transactionRelationship.count({
              where: {
                id: { not: relationship.id },
                userId: ownerId,
                state: TransactionRelationshipState.CONFIRMED,
                type: relationship.type,
                OR: [
                  { sourceTransactionId: transaction.id },
                  { targetTransactionId: transaction.id },
                ],
              },
            });
            const expectedRole =
              relationship.type ===
              TransactionRelationshipType.CREDIT_CARD_PAYMENT
                ? FinancialRole.CREDIT_CARD_PAYMENT
                : FinancialRole.TRANSFER;
            if (
              otherConfirmed === 0 &&
              transaction.override?.financialRoleOverride === expectedRole
            )
              await tx.transactionOverride.update({
                where: { transactionId: transaction.id },
                data: { financialRoleOverride: null, reviewedAt: new Date() },
              });
          }
        }
      }
      return tx.transactionRelationship.update({
        where: { id: relationship.id },
        data: {
          state,
          provenance:
            state === TransactionRelationshipState.CONFIRMED ||
            state === TransactionRelationshipState.REJECTED
              ? ClassificationProvenance.OWNER_OVERRIDE
              : relationship.provenance,
          certainty:
            state === TransactionRelationshipState.CONFIRMED ||
            state === TransactionRelationshipState.REJECTED
              ? ClassificationCertainty.CONFIRMED
              : relationship.certainty,
          confirmedAt:
            state === TransactionRelationshipState.CONFIRMED
              ? new Date()
              : null,
        },
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function createRefundRelationship(
  ownerId: string,
  refundTransactionId: string,
  originalTransactionId: string,
  type:
    | (typeof TransactionRelationshipType)["REFUND"]
    | (typeof TransactionRelationshipType)["REIMBURSEMENT"],
  appliedAmount: Prisma.Decimal,
) {
  if (!appliedAmount.isPositive())
    throw new Error("Applied amount must be positive.");
  return db.$transaction(
    async (tx) => {
      const transactions = await tx.transaction.findMany({
        where: {
          userId: ownerId,
          id: { in: [refundTransactionId, originalTransactionId] },
        },
        include: relationshipInclude,
      });
      const refund = transactions.find(({ id }) => id === refundTransactionId);
      const original = transactions.find(
        ({ id }) => id === originalTransactionId,
      );
      if (!refund || !original || refund.currency !== original.currency)
        throw new Error("Transactions are not eligible for linkage.");
      if (
        appliedAmount.greaterThan(refund.amount.abs()) ||
        appliedAmount.greaterThan(original.amount.abs())
      )
        throw new Error("Applied amount exceeds a source transaction.");
      const alreadyApplied = await tx.transactionRelationship.aggregate({
        where: {
          userId: ownerId,
          sourceTransactionId: refund.id,
          type: {
            in: [
              TransactionRelationshipType.REFUND,
              TransactionRelationshipType.REIMBURSEMENT,
            ],
          },
          state: TransactionRelationshipState.CONFIRMED,
        },
        _sum: { appliedAmount: true },
      });
      if (
        (alreadyApplied._sum.appliedAmount ?? new Prisma.Decimal(0))
          .plus(appliedAmount)
          .greaterThan(refund.amount.abs())
      )
        throw new Error(
          "Confirmed refund links exceed the refund transaction.",
        );
      if (
        refund.override?.financialRoleOverride &&
        refund.override.financialRoleOverride !== FinancialRole.REFUND
      )
        throw new Error(
          "An existing owner role conflicts with refund linkage.",
        );
      await tx.transactionOverride.upsert({
        where: { transactionId: refund.id },
        update: {
          financialRoleOverride: FinancialRole.REFUND,
          reviewedAt: new Date(),
        },
        create: {
          userId: ownerId,
          transactionId: refund.id,
          financialRoleOverride: FinancialRole.REFUND,
          reviewedAt: new Date(),
        },
      });
      const originalEffective = effectiveTransactionValues(original);
      if (!originalEffective.allocations.length)
        throw new Error(
          "The original transaction needs a resolved category before linkage.",
        );
      const originalTotal = originalEffective.allocations.reduce(
        (sum, allocation) => sum.plus(allocation.amount),
        new Prisma.Decimal(0),
      );
      const existingAllocationCount = await tx.transactionAllocation.count({
        where: { userId: ownerId, transactionId: refund.id },
      });
      let remainder = appliedAmount;
      const allocationAmounts: Array<{ categoryId: string; amount: string }> =
        [];
      for (const [
        index,
        allocation,
      ] of originalEffective.allocations.entries()) {
        const portion =
          index === originalEffective.allocations.length - 1
            ? remainder
            : appliedAmount
                .times(allocation.amount)
                .dividedBy(originalTotal)
                .toDecimalPlaces(4, Prisma.Decimal.ROUND_DOWN);
        remainder = remainder.minus(portion);
        allocationAmounts.push({
          categoryId: allocation.categoryId,
          amount: portion.toFixed(4),
        });
        await tx.transactionAllocation.upsert({
          where: {
            transactionId_transactionCategoryId: {
              transactionId: refund.id,
              transactionCategoryId: allocation.categoryId,
            },
          },
          update: { amount: { increment: portion }, reviewedAt: new Date() },
          create: {
            userId: ownerId,
            transactionId: refund.id,
            transactionCategoryId: allocation.categoryId,
            amount: portion,
            displayOrder: existingAllocationCount + index,
            provenance: ClassificationProvenance.OWNER_OVERRIDE,
            reviewedAt: new Date(),
          },
        });
      }
      return tx.transactionRelationship.create({
        data: {
          userId: ownerId,
          sourceTransactionId: refund.id,
          targetTransactionId: original.id,
          type,
          appliedAmount,
          provenance: ClassificationProvenance.OWNER_OVERRIDE,
          certainty: ClassificationCertainty.CONFIRMED,
          state: TransactionRelationshipState.CONFIRMED,
          reasonCodes: ["OWNER_CONFIRMED_LINK"],
          evidence: { allocationAmounts },
          confirmedAt: new Date(),
        },
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function resolveLegacyRelationship(
  ownerId: string,
  relationshipId: string,
  type: TransactionRelationshipType,
  appliedAmount: Prisma.Decimal,
) {
  if (!SUPPORTED_RELATIONSHIP_TYPES.has(type))
    throw new Error("Select a supported economic relationship type.");
  if (!appliedAmount.isPositive())
    throw new Error("Applied amount must be positive.");

  return db.$transaction(
    async (tx) => {
      const relationship = await tx.transactionRelationship.findFirst({
        where: { id: relationshipId, userId: ownerId },
        include: {
          sourceTransaction: { include: relationshipInclude },
          targetTransaction: { include: relationshipInclude },
        },
      });
      if (
        !relationship ||
        relationship.type !== TransactionRelationshipType.LEGACY_UNTYPED ||
        relationship.state !== TransactionRelationshipState.NEEDS_REVIEW
      )
        throw new Error("The legacy relationship is not awaiting resolution.");

      let source: RelationshipTransaction = relationship.sourceTransaction;
      let target: RelationshipTransaction = relationship.targetTransaction;
      if (
        source.userId !== ownerId ||
        target.userId !== ownerId ||
        source.currency !== target.currency ||
        source.id === target.id ||
        !isRelationshipEligible(source) ||
        !isRelationshipEligible(target)
      )
        throw new Error("The legacy relationship endpoints are not eligible.");

      const isMovement =
        type === TransactionRelationshipType.INTERNAL_TRANSFER ||
        type === TransactionRelationshipType.CREDIT_CARD_PAYMENT;
      if (isMovement) {
        const sourceDirection =
          effectiveTransactionValues(source).economicDirection;
        const targetDirection =
          effectiveTransactionValues(target).economicDirection;
        if (
          sourceDirection === EconomicDirection.INFLOW &&
          targetDirection === EconomicDirection.OUTFLOW
        )
          [source, target] = [target, source];
        if (
          effectiveTransactionValues(source).economicDirection !==
            EconomicDirection.OUTFLOW ||
          effectiveTransactionValues(target).economicDirection !==
            EconomicDirection.INFLOW ||
          source.accountId === target.accountId ||
          !source.amount.abs().equals(target.amount.abs())
        )
          throw new Error(
            "A movement resolution requires equal amounts, opposite directions, and separate accounts.",
          );
        if (
          type === TransactionRelationshipType.CREDIT_CARD_PAYMENT &&
          source.account.accountType !== AccountType.CREDIT_CARD &&
          target.account.accountType !== AccountType.CREDIT_CARD
        )
          throw new Error(
            "A card-payment resolution requires a credit-card account.",
          );
      } else {
        const sourceEffective = effectiveTransactionValues(source);
        const targetEffective = effectiveTransactionValues(target);
        if (
          sourceEffective.financialRole === FinancialRole.EXPENSE &&
          targetEffective.economicDirection === EconomicDirection.INFLOW
        )
          [source, target] = [target, source];
        const originalEffective = effectiveTransactionValues(target);
        if (
          effectiveTransactionValues(source).economicDirection !==
            EconomicDirection.INFLOW ||
          originalEffective.financialRole !== FinancialRole.EXPENSE ||
          originalEffective.economicDirection !== EconomicDirection.OUTFLOW
        )
          throw new Error(
            "A refund or reimbursement resolution requires an inflow linked to a resolved expense.",
          );
      }

      const duplicate = await tx.transactionRelationship.findFirst({
        where: {
          id: { not: relationship.id },
          userId: ownerId,
          type,
          sourceTransactionId: source.id,
          targetTransactionId: target.id,
        },
      });
      if (duplicate?.state === TransactionRelationshipState.CONFIRMED) {
        const canonical = await tx.transactionRelationship.update({
          where: { id: duplicate.id },
          data: {
            reasonCodes: [
              ...new Set([
                ...duplicate.reasonCodes,
                "LEGACY_LINK_RECONCILED_TO_EXISTING_RELATIONSHIP",
              ]),
            ],
            evidence: resolutionEvidence(duplicate.evidence, type),
          },
        });
        await tx.transactionRelationship.delete({
          where: { id: relationship.id },
        });
        return canonical;
      }
      if (duplicate)
        await tx.transactionRelationship.delete({
          where: { id: duplicate.id },
        });

      if (isMovement) {
        const expectedRole =
          type === TransactionRelationshipType.CREDIT_CARD_PAYMENT
            ? FinancialRole.CREDIT_CARD_PAYMENT
            : FinancialRole.TRANSFER;
        for (const transaction of [source, target]) {
          if (
            transaction.override?.financialRoleOverride &&
            transaction.override.financialRoleOverride !== expectedRole
          )
            throw new Error(
              "An existing owner role conflicts with this relationship.",
            );
          await tx.transactionOverride.upsert({
            where: { transactionId: transaction.id },
            update: {
              financialRoleOverride: expectedRole,
              reviewedAt: new Date(),
            },
            create: {
              userId: ownerId,
              transactionId: transaction.id,
              financialRoleOverride: expectedRole,
              reviewedAt: new Date(),
            },
          });
        }
        return tx.transactionRelationship.update({
          where: { id: relationship.id },
          data: {
            sourceTransactionId: source.id,
            targetTransactionId: target.id,
            type,
            appliedAmount: source.amount.abs(),
            provenance: ClassificationProvenance.OWNER_OVERRIDE,
            certainty: ClassificationCertainty.CONFIRMED,
            state: TransactionRelationshipState.CONFIRMED,
            reasonCodes: ["OWNER_RESOLVED_LEGACY_LINK"],
            evidence: resolutionEvidence(relationship.evidence, type),
            confirmedAt: new Date(),
          },
        });
      }

      if (
        appliedAmount.greaterThan(source.amount.abs()) ||
        appliedAmount.greaterThan(target.amount.abs())
      )
        throw new Error("Applied amount exceeds a source transaction.");
      const alreadyApplied = await tx.transactionRelationship.aggregate({
        where: {
          id: { not: relationship.id },
          userId: ownerId,
          sourceTransactionId: source.id,
          type: {
            in: [
              TransactionRelationshipType.REFUND,
              TransactionRelationshipType.REIMBURSEMENT,
            ],
          },
          state: TransactionRelationshipState.CONFIRMED,
        },
        _sum: { appliedAmount: true },
      });
      if (
        (alreadyApplied._sum.appliedAmount ?? new Prisma.Decimal(0))
          .plus(appliedAmount)
          .greaterThan(source.amount.abs())
      )
        throw new Error(
          "Confirmed refund links exceed the refund transaction.",
        );
      if (
        source.override?.financialRoleOverride &&
        source.override.financialRoleOverride !== FinancialRole.REFUND
      )
        throw new Error(
          "An existing owner role conflicts with refund linkage.",
        );
      await tx.transactionOverride.upsert({
        where: { transactionId: source.id },
        update: {
          financialRoleOverride: FinancialRole.REFUND,
          reviewedAt: new Date(),
        },
        create: {
          userId: ownerId,
          transactionId: source.id,
          financialRoleOverride: FinancialRole.REFUND,
          reviewedAt: new Date(),
        },
      });
      const originalEffective = effectiveTransactionValues(target);
      if (!originalEffective.allocations.length)
        throw new Error(
          "The original transaction needs a resolved category before linkage.",
        );
      const originalTotal = originalEffective.allocations.reduce(
        (sum, allocation) => sum.plus(allocation.amount),
        new Prisma.Decimal(0),
      );
      const existingAllocationCount = await tx.transactionAllocation.count({
        where: { userId: ownerId, transactionId: source.id },
      });
      let remainder = appliedAmount;
      const allocationAmounts: Array<{
        categoryId: string;
        amount: string;
      }> = [];
      for (const [
        index,
        allocation,
      ] of originalEffective.allocations.entries()) {
        const portion =
          index === originalEffective.allocations.length - 1
            ? remainder
            : appliedAmount
                .times(allocation.amount)
                .dividedBy(originalTotal)
                .toDecimalPlaces(4, Prisma.Decimal.ROUND_DOWN);
        remainder = remainder.minus(portion);
        allocationAmounts.push({
          categoryId: allocation.categoryId,
          amount: portion.toFixed(4),
        });
        await tx.transactionAllocation.upsert({
          where: {
            transactionId_transactionCategoryId: {
              transactionId: source.id,
              transactionCategoryId: allocation.categoryId,
            },
          },
          update: { amount: { increment: portion }, reviewedAt: new Date() },
          create: {
            userId: ownerId,
            transactionId: source.id,
            transactionCategoryId: allocation.categoryId,
            amount: portion,
            displayOrder: existingAllocationCount + index,
            provenance: ClassificationProvenance.OWNER_OVERRIDE,
            reviewedAt: new Date(),
          },
        });
      }
      return tx.transactionRelationship.update({
        where: { id: relationship.id },
        data: {
          sourceTransactionId: source.id,
          targetTransactionId: target.id,
          type,
          appliedAmount,
          provenance: ClassificationProvenance.OWNER_OVERRIDE,
          certainty: ClassificationCertainty.CONFIRMED,
          state: TransactionRelationshipState.CONFIRMED,
          reasonCodes: ["OWNER_RESOLVED_LEGACY_LINK"],
          evidence: {
            ...resolutionEvidence(relationship.evidence, type),
            allocationAmounts,
          },
          confirmedAt: new Date(),
        },
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}
