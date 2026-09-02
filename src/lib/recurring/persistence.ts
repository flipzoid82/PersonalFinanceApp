import "server-only";
import { createHash } from "node:crypto";
import {
  CalendarDateSource,
  CalendarEventStatus,
  ConfidenceLevel,
  Prisma,
  type PrismaClient,
  RecurringFrequency,
  RecurringStatus,
  TransactionStatus,
} from "@prisma/client";
import { db } from "@/lib/db";
import { currentAccountStateWhere } from "@/lib/accounts/current";
import { TRANSACTION_CLASSIFIER_VERSION } from "@/lib/transactions/classifier";
import { ensureTransactionTruthReady } from "@/lib/transactions/truth";
import {
  CONFIDENCE_THRESHOLDS,
  DETECTION_VERSION,
  INACTIVE_AFTER_MISSED_CYCLES,
  MATCHING_TOLERANCES,
} from "./constants";
import { buildRecurringCandidates, nextOccurrence } from "./detection";
import { effectiveDetectionTransaction } from "./normalization";
import type {
  DetectedRecurringCandidate,
  DetectionTransaction,
  RecurringDetectionResult,
} from "./types";

type Database = PrismaClient;
type TransactionClient = Prisma.TransactionClient;
const DAY_MS = 86_400_000;

function stableKey(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function isoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function startOfDay(value: Date) {
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
  );
}

function daysBetween(left: Date, right: Date) {
  return Math.abs(
    Math.round(
      (startOfDay(right).getTime() - startOfDay(left).getTime()) / DAY_MS,
    ),
  );
}

function weekKey(value: Date) {
  const day = startOfDay(value);
  const weekday = day.getUTCDay() || 7;
  day.setUTCDate(day.getUTCDate() - weekday + 1);
  return isoDate(day);
}

function projectionCycle(candidate: DetectedRecurringCandidate, date: Date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  switch (candidate.frequency) {
    case RecurringFrequency.WEEKLY:
      return `week:${weekKey(date)}`;
    case RecurringFrequency.BIWEEKLY:
      return `biweek:${Math.round(
        (startOfDay(date).getTime() -
          startOfDay(candidate.firstDate).getTime()) /
          DAY_MS /
          14,
      )}`;
    case RecurringFrequency.SEMIMONTHLY: {
      const firstAnchor = candidate.anchors?.[0] ?? 1;
      return `${year}-${month}:${date.getUTCDate() <= firstAnchor + 5 ? "a" : "b"}`;
    }
    case RecurringFrequency.QUARTERLY:
      return `${year}:q${Math.floor(date.getUTCMonth() / 3) + 1}`;
    case RecurringFrequency.ANNUAL:
      return `${year}`;
    default:
      return `${year}-${month}`;
  }
}

function projectionKey(
  candidate: DetectedRecurringCandidate,
  projectedDate: Date,
) {
  return stableKey(
    `${candidate.detectionKey}\u001f${projectionCycle(candidate, projectedDate)}`,
  );
}

function metadata(candidate: DetectedRecurringCandidate) {
  return {
    version: DETECTION_VERSION,
    normalizedMerchant: candidate.normalizedMerchant,
    financialRole: candidate.financialRole,
    flowDirection: candidate.direction,
    occurrenceCount: candidate.transactionIds.length,
    occurrenceTransactionIds: candidate.transactionIds,
    occurrenceDates: candidate.occurrenceDates.map(isoDate),
    intervalRegularity: candidate.intervalRegularity,
    amountDeviation: candidate.amountDeviation.toFixed(4),
    amountPattern: candidate.amountSource === "FIXED" ? "fixed" : "variable",
    anchors: candidate.anchors ?? null,
    missedCycles: candidate.missedCycles,
  } satisfies Prisma.InputJsonValue;
}

function overrideBlocksDetection(
  overrides: Array<{
    statusOverride: CalendarEventStatus | null;
    notABill: boolean;
  }>,
) {
  const current = overrides[0];
  return Boolean(
    current?.notABill ||
      current?.statusOverride === CalendarEventStatus.INACTIVE,
  );
}

async function persistCandidate(
  tx: TransactionClient,
  ownerId: string,
  candidate: DetectedRecurringCandidate,
  now: Date,
  result: RecurringDetectionResult,
) {
  const existing = await tx.recurringStream.findUnique({
    where: {
      userId_detectionKey: {
        userId: ownerId,
        detectionKey: candidate.detectionKey,
      },
    },
    include: {
      calendarOverrides: {
        where: { userId: ownerId },
        orderBy: { updatedAt: "desc" },
        take: 1,
        select: { statusOverride: true, notABill: true },
      },
    },
  });
  const isLow = candidate.confidenceScore.lessThan(
    CONFIDENCE_THRESHOLDS.medium,
  );
  if (!existing && isLow) return null;

  const blocked = existing
    ? overrideBlocksDetection(existing.calendarOverrides)
    : false;
  const stale =
    candidate.missedCycles >= INACTIVE_AFTER_MISSED_CYCLES && !blocked;
  const shared = {
    merchantName: candidate.displayName,
    description: `Inferred ${candidate.frequency.toLowerCase()} recurring activity for ${candidate.displayName}.`,
    flowType: candidate.flowType,
    frequency: candidate.frequency,
    averageAmount: candidate.expectedAmount,
    lastAmount: candidate.lastAmount,
    firstDate: candidate.firstDate,
    lastDate: candidate.lastDate,
    predictedNextDate: candidate.predictedNextDate,
    predictedPostingDate: candidate.predictedNextDate,
    dateSource: CalendarDateSource.INFERRED,
    confidenceLevel: candidate.confidenceLevel,
    confidenceScore: candidate.confidenceScore,
    category: candidate.category,
    typicalAccountId: candidate.accountId,
    detectionVersion: DETECTION_VERSION,
    detectionMetadata: metadata(candidate),
    lastDetectedAt: now,
  };

  if (existing) {
    result.streamsUpdated += 1;
    if (existing.dateSource !== CalendarDateSource.INFERRED || blocked) {
      return tx.recurringStream.update({
        where: { id: existing.id },
        data: {
          confidenceLevel: candidate.confidenceLevel,
          confidenceScore: candidate.confidenceScore,
          detectionVersion: DETECTION_VERSION,
          detectionMetadata: metadata(candidate),
          lastDetectedAt: now,
        },
      });
    }
    if (stale && existing.isActive) result.streamsMarkedInactive += 1;
    return tx.recurringStream.update({
      where: { id: existing.id },
      data: {
        ...shared,
        isActive: !stale,
        status: stale
          ? RecurringStatus.INACTIVE
          : isLow
            ? RecurringStatus.NEEDS_CONFIRMATION
            : RecurringStatus.ACTIVE,
      },
    });
  }

  result.streamsCreated += 1;
  return tx.recurringStream.create({
    data: {
      userId: ownerId,
      detectionKey: candidate.detectionKey,
      ...shared,
      isActive: !stale,
      status: stale ? RecurringStatus.INACTIVE : RecurringStatus.ACTIVE,
    },
  });
}

async function persistProjections(
  tx: TransactionClient,
  ownerId: string,
  stream: { id: string },
  candidate: DetectedRecurringCandidate,
  result: RecurringDetectionResult,
) {
  if (
    candidate.confidenceScore.lessThan(CONFIDENCE_THRESHOLDS.medium) ||
    candidate.missedCycles >= INACTIVE_AFTER_MISSED_CYCLES
  )
    return;

  for (const date of candidate.projectedDates) {
    const key = projectionKey(candidate, date);
    const existing = await tx.calendarEvent.findUnique({
      where: {
        userId_projectionKey: { userId: ownerId, projectionKey: key },
      },
      include: {
        overrides: {
          where: { userId: ownerId },
          orderBy: { updatedAt: "desc" },
          take: 1,
          select: { statusOverride: true, notABill: true },
        },
      },
    });
    const values = {
      recurringStreamId: stream.id,
      accountId: candidate.accountId,
      eventType: candidate.eventType,
      title: candidate.displayName,
      eventDate: date,
      predictedPostingDate: date,
      expectedAmount: candidate.expectedAmount,
      currency: candidate.currency,
      dateSource: CalendarDateSource.INFERRED,
      amountSource: candidate.amountSource,
      confidenceLevel: candidate.confidenceLevel,
      status: CalendarEventStatus.PREDICTED,
      isUserConfirmed: false,
    };
    if (!existing) {
      await tx.calendarEvent.create({
        data: { userId: ownerId, projectionKey: key, ...values },
      });
      result.projectionsCreated += 1;
      continue;
    }
    const protectedEvent =
      existing.linkedTransactionId ||
      existing.isUserConfirmed ||
      existing.dateSource !== CalendarDateSource.INFERRED ||
      existing.status === CalendarEventStatus.PAID ||
      existing.status === CalendarEventStatus.SKIPPED ||
      existing.status === CalendarEventStatus.CONFIRMED ||
      overrideBlocksDetection(existing.overrides);
    if (protectedEvent) continue;
    await tx.calendarEvent.update({
      where: { id: existing.id },
      data: values,
    });
    result.projectionsUpdated += 1;
  }
}

function amountTolerance(candidate: DetectedRecurringCandidate) {
  const fixed = Prisma.Decimal.max(
    new Prisma.Decimal(MATCHING_TOLERANCES.fixedAbsolute),
    candidate.expectedAmount.times(MATCHING_TOLERANCES.fixedPercent),
  );
  if (candidate.amountSource === "FIXED") return fixed;
  const variable = Prisma.Decimal.max(
    fixed,
    candidate.amountDeviation.times(2),
  );
  const cap = Prisma.Decimal.max(
    fixed,
    Prisma.Decimal.min(
      candidate.expectedAmount.times(MATCHING_TOLERANCES.variablePercentCap),
      new Prisma.Decimal(MATCHING_TOLERANCES.variableAbsoluteCap),
    ),
  );
  return Prisma.Decimal.min(variable, cap);
}

async function matchProjectedEvents(
  tx: TransactionClient,
  ownerId: string,
  rawTransactions: DetectionTransaction[],
  candidateByKey: Map<string, DetectedRecurringCandidate>,
  result: RecurringDetectionResult,
) {
  const used = new Set(
    (
      await tx.calendarEvent.findMany({
        where: { userId: ownerId, linkedTransactionId: { not: null } },
        select: { linkedTransactionId: true },
      })
    ).flatMap(({ linkedTransactionId }) =>
      linkedTransactionId ? [linkedTransactionId] : [],
    ),
  );
  const effectiveTransactions = new Map(
    rawTransactions
      .map(effectiveDetectionTransaction)
      .filter((value): value is NonNullable<typeof value> => Boolean(value))
      .map((value) => [value.id, value]),
  );
  const events = await tx.calendarEvent.findMany({
    where: {
      userId: ownerId,
      linkedTransactionId: null,
      dateSource: CalendarDateSource.INFERRED,
      status: {
        in: [
          CalendarEventStatus.PREDICTED,
          CalendarEventStatus.NEEDS_CONFIRMATION,
        ],
      },
      recurringStream: { is: { detectionKey: { not: null } } },
    },
    include: {
      overrides: {
        where: { userId: ownerId },
        orderBy: { updatedAt: "desc" },
        take: 1,
        select: { statusOverride: true, notABill: true },
      },
      recurringStream: {
        select: {
          detectionKey: true,
          calendarOverrides: {
            where: { userId: ownerId },
            orderBy: { updatedAt: "desc" },
            take: 1,
            select: { statusOverride: true, notABill: true },
          },
        },
      },
    },
    orderBy: { eventDate: "asc" },
  });

  for (const event of events) {
    if (
      overrideBlocksDetection(event.overrides) ||
      overrideBlocksDetection(event.recurringStream?.calendarOverrides ?? [])
    )
      continue;
    const key = event.recurringStream?.detectionKey;
    const candidate = key ? candidateByKey.get(key) : undefined;
    if (!candidate) continue;
    const windowDays =
      candidate.confidenceLevel === ConfidenceLevel.HIGH
        ? MATCHING_TOLERANCES.highConfidenceDays
        : MATCHING_TOLERANCES.mediumConfidenceDays;
    const tolerance = amountTolerance(candidate);
    const matches = candidate.transactionIds
      .flatMap((id) => {
        const transaction = effectiveTransactions.get(id);
        if (
          !transaction ||
          used.has(id) ||
          transaction.accountId !== event.accountId ||
          transaction.currency !== event.currency
        )
          return [];
        const dateDistance = daysBetween(
          event.eventDate,
          transaction.postedAt!,
        );
        const amountDistance = transaction.amount
          .abs()
          .minus(candidate.expectedAmount)
          .abs();
        if (dateDistance > windowDays || amountDistance.greaterThan(tolerance))
          return [];
        const rank =
          dateDistance +
          amountDistance
            .dividedBy(
              candidate.expectedAmount.isZero()
                ? new Prisma.Decimal(1)
                : candidate.expectedAmount,
            )
            .toNumber();
        return [{ transaction, rank, amountDistance }];
      })
      .sort(
        (a, b) =>
          a.rank - b.rank ||
          a.amountDistance.comparedTo(b.amountDistance) ||
          a.transaction.id.localeCompare(b.transaction.id),
      );
    if (!matches.length) continue;
    if (matches[1] && Math.abs(matches[0].rank - matches[1].rank) <= 0.25)
      continue;
    await tx.calendarEvent.update({
      where: { id: event.id },
      data: {
        linkedTransactionId: matches[0].transaction.id,
        actualAmount: matches[0].transaction.amount.abs(),
        status: CalendarEventStatus.PAID,
      },
    });
    used.add(matches[0].transaction.id);
    result.transactionsMatched += 1;
  }
}

async function markDisappearingStreams(
  tx: TransactionClient,
  ownerId: string,
  candidates: Map<string, DetectedRecurringCandidate>,
  now: Date,
  result: RecurringDetectionResult,
) {
  const streams = await tx.recurringStream.findMany({
    where: {
      userId: ownerId,
      detectionKey: { not: null },
      dateSource: CalendarDateSource.INFERRED,
    },
    include: {
      calendarOverrides: {
        where: { userId: ownerId },
        orderBy: { updatedAt: "desc" },
        take: 1,
        select: {
          confirmedDueDate: true,
          statusOverride: true,
          notABill: true,
        },
      },
    },
  });
  for (const stream of streams) {
    if (
      !stream.detectionKey ||
      stream.confirmedDueDate ||
      stream.calendarOverrides[0]?.confirmedDueDate ||
      overrideBlocksDetection(stream.calendarOverrides)
    )
      continue;
    let missed = candidates.get(stream.detectionKey)?.missedCycles ?? 0;
    if (!candidates.has(stream.detectionKey)) {
      let expected = stream.predictedNextDate;
      while (expected <= now && missed < 10) {
        missed += 1;
        expected = nextOccurrence(expected, stream.frequency);
      }
    }
    if (
      missed >= INACTIVE_AFTER_MISSED_CYCLES &&
      (stream.isActive || stream.status !== RecurringStatus.INACTIVE)
    ) {
      await tx.recurringStream.update({
        where: { id: stream.id },
        data: {
          isActive: false,
          status: RecurringStatus.INACTIVE,
          confidenceLevel: ConfidenceLevel.LOW,
        },
      });
      result.streamsMarkedInactive += 1;
    }
  }
}

export async function runRecurringDetection(
  ownerId: string,
  options: { database?: Database; now?: Date } = {},
) {
  const database = options.database ?? db;
  const now = options.now ?? new Date();
  await ensureTransactionTruthReady(ownerId, database);
  return database.$transaction(
    async (tx) => {
      await tx.$queryRaw<
        Array<{ locked: number }>
      >`SELECT 1::int AS locked FROM pg_advisory_xact_lock(hashtextextended(${`recurring-detection:${ownerId}`}, 7))`;
      const rawTransactions = (await tx.transaction.findMany({
        where: {
          userId: ownerId,
          status: TransactionStatus.POSTED,
          postedAt: { not: null },
          removedAt: null,
          account: {
            userId: ownerId,
            ...currentAccountStateWhere(),
          },
          classification: {
            is: { classifierVersion: TRANSACTION_CLASSIFIER_VERSION },
          },
        },
        include: {
          account: {
            select: {
              id: true,
              userId: true,
              isActive: true,
              accountType: true,
            },
          },
          override: {
            select: {
              merchantNameOverride: true,
              categoryOverride: true,
              transactionCategoryId: true,
              transactionCategory: { select: { id: true, name: true } },
              financialRoleOverride: true,
              economicDirectionOverride: true,
              reviewedAt: true,
              excludedFromReports: true,
            },
          },
          classification: {
            include: {
              transactionCategory: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: [{ postedAt: "asc" }, { id: "asc" }],
      })) as DetectionTransaction[];
      const detected = buildRecurringCandidates(rawTransactions, now);
      const result: RecurringDetectionResult = {
        eligibleTransactions: detected.eligibleTransactions,
        candidates: detected.candidates.length,
        streamsCreated: 0,
        streamsUpdated: 0,
        projectionsCreated: 0,
        projectionsUpdated: 0,
        transactionsMatched: 0,
        streamsMarkedInactive: 0,
      };
      const persistedCandidates = new Map<string, DetectedRecurringCandidate>();
      for (const candidate of detected.candidates) {
        const stream = await persistCandidate(
          tx,
          ownerId,
          candidate,
          now,
          result,
        );
        if (!stream) continue;
        persistedCandidates.set(candidate.detectionKey, candidate);
        await persistProjections(tx, ownerId, stream, candidate, result);
      }
      await matchProjectedEvents(
        tx,
        ownerId,
        rawTransactions,
        persistedCandidates,
        result,
      );
      await markDisappearingStreams(
        tx,
        ownerId,
        persistedCandidates,
        now,
        result,
      );
      return result;
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
    },
  );
}
