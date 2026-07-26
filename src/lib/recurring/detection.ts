import { createHash } from "node:crypto";
import {
  CalendarAmountSource,
  ConfidenceLevel,
  Prisma,
  RecurringFrequency,
} from "@prisma/client";
import {
  CONFIDENCE_THRESHOLDS,
  INTERVAL_TOLERANCES,
  MINIMUM_OCCURRENCES,
  PROJECTION_HORIZON_DAYS,
} from "./constants";
import { effectiveDetectionTransaction } from "./normalization";
import type {
  DetectedRecurringCandidate,
  DetectionTransaction,
  EffectiveDetectionTransaction,
  FrequencyAnalysis,
} from "./types";

const DAY_MS = 86_400_000;

function startOfDay(value: Date) {
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
  );
}

function addDays(value: Date, days: number) {
  const result = startOfDay(value);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function daysBetween(left: Date, right: Date) {
  return Math.round(
    (startOfDay(right).getTime() - startOfDay(left).getTime()) / DAY_MS,
  );
}

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

function addMonthsClamped(value: Date, months: number) {
  const year = value.getUTCFullYear();
  const month = value.getUTCMonth();
  const day = value.getUTCDate();
  const sourceLastDay = daysInMonth(year, month);
  const target = new Date(Date.UTC(year, month + months, 1));
  const targetLastDay = daysInMonth(
    target.getUTCFullYear(),
    target.getUTCMonth(),
  );
  target.setUTCDate(
    day >= sourceLastDay - 2 ? targetLastDay : Math.min(day, targetLastDay),
  );
  return target;
}

function monthDifference(left: Date, right: Date) {
  return (
    (right.getUTCFullYear() - left.getUTCFullYear()) * 12 +
    right.getUTCMonth() -
    left.getUTCMonth()
  );
}

function intervalRegularity(
  dates: Date[],
  expectedDays: number,
  tolerance: number,
  missingMultiplier = 2,
) {
  const intervals = dates.slice(1).map((date, index) => ({
    days: daysBetween(dates[index], date),
  }));
  let missing = 0;
  let accepted = 0;
  for (const interval of intervals) {
    if (Math.abs(interval.days - expectedDays) <= tolerance) {
      accepted += 1;
    } else if (
      Math.abs(interval.days - expectedDays * missingMultiplier) <= tolerance
    ) {
      missing += 1;
      accepted += 0.65;
    }
  }
  if (missing > 1) return 0;
  return intervals.length ? accepted / intervals.length : 0;
}

function calendarRegularity(dates: Date[], months: number, tolerance: number) {
  let missing = 0;
  let accepted = 0;
  for (let index = 1; index < dates.length; index += 1) {
    const previous = dates[index - 1];
    const current = dates[index];
    const monthGap = monthDifference(previous, current);
    const multiplier =
      monthGap === months ? 1 : monthGap === months * 2 ? 2 : 0;
    if (!multiplier) continue;
    if (multiplier === 2) missing += 1;
    const expected = addMonthsClamped(previous, months * multiplier);
    if (Math.abs(daysBetween(expected, current)) <= tolerance)
      accepted += multiplier === 1 ? 1 : 0.65;
  }
  if (missing > 1) return 0;
  return accepted / (dates.length - 1);
}

function semimonthlyAnalysis(dates: Date[]): FrequencyAnalysis | null {
  if (dates.length < MINIMUM_OCCURRENCES.standard) return null;
  const days = dates
    .map((date) => {
      const last = daysInMonth(date.getUTCFullYear(), date.getUTCMonth());
      return date.getUTCDate() >= last - 2 ? 31 : date.getUTCDate();
    })
    .sort((a, b) => a - b);
  let best: { left: number[]; right: number[]; gap: number } | undefined;
  for (let index = 1; index < days.length; index += 1) {
    const left = days.slice(0, index);
    const right = days.slice(index);
    const leftSpread = left.at(-1)! - left[0];
    const rightSpread = right.at(-1)! - right[0];
    const gap = right[0] - left.at(-1)!;
    if (
      leftSpread <= 4 &&
      rightSpread <= 4 &&
      gap >= 8 &&
      (!best || gap > best.gap)
    )
      best = { left, right, gap };
  }
  if (!best || (best.left.length === 1 && best.right.length === 1)) return null;

  const chronologicalIntervals = dates
    .slice(1)
    .map((date, index) => daysBetween(dates[index], date));
  if (
    Math.max(...chronologicalIntervals) - Math.min(...chronologicalIntervals) <
    2
  )
    return null;
  const accepted = chronologicalIntervals.filter(
    (interval) => interval >= 10 && interval <= 21,
  ).length;
  if (accepted / chronologicalIntervals.length < 0.8) return null;
  const medianAnchor = (values: number[]) =>
    values[Math.floor(values.length / 2)];
  return {
    frequency: RecurringFrequency.SEMIMONTHLY,
    regularity: accepted / chronologicalIntervals.length,
    anchors: [medianAnchor(best.left), medianAnchor(best.right)],
  };
}

export function classifyFrequency(
  datesInput: Date[],
): FrequencyAnalysis | null {
  const dates = [...datesInput]
    .map(startOfDay)
    .sort((a, b) => a.getTime() - b.getTime());
  if (dates.length < MINIMUM_OCCURRENCES.annual) return null;

  const semimonthly = semimonthlyAnalysis(dates);
  if (semimonthly) return semimonthly;

  if (dates.length >= MINIMUM_OCCURRENCES.standard) {
    const weekly = intervalRegularity(dates, 7, INTERVAL_TOLERANCES.weeklyDays);
    if (weekly >= 0.8)
      return { frequency: RecurringFrequency.WEEKLY, regularity: weekly };

    const biweekly = intervalRegularity(
      dates,
      14,
      INTERVAL_TOLERANCES.biweeklyDays,
    );
    if (biweekly >= 0.8)
      return { frequency: RecurringFrequency.BIWEEKLY, regularity: biweekly };

    const monthly = calendarRegularity(
      dates,
      1,
      INTERVAL_TOLERANCES.monthlyDays,
    );
    if (monthly >= 0.8)
      return { frequency: RecurringFrequency.MONTHLY, regularity: monthly };

    const quarterly = calendarRegularity(
      dates,
      3,
      INTERVAL_TOLERANCES.quarterlyDays,
    );
    if (quarterly >= 0.8)
      return {
        frequency: RecurringFrequency.QUARTERLY,
        regularity: quarterly,
      };
  }

  const annual = calendarRegularity(dates, 12, INTERVAL_TOLERANCES.annualDays);
  if (annual >= 0.95)
    return { frequency: RecurringFrequency.ANNUAL, regularity: annual };
  return null;
}

function median(values: Prisma.Decimal[]) {
  const sorted = [...values].sort((a, b) => a.comparedTo(b));
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : sorted[middle - 1].plus(sorted[middle]).dividedBy(2);
}

export function estimateAmount(values: Prisma.Decimal[]) {
  const absolute = values.map((value) => value.abs());
  const expectedAmount = median(absolute);
  const deviations = absolute.map((value) => value.minus(expectedAmount).abs());
  const amountDeviation = median(deviations);
  const fixedTolerance = Prisma.Decimal.max(
    new Prisma.Decimal(2),
    expectedAmount.times("0.05"),
  );
  const amountSource = amountDeviation.lessThanOrEqualTo(fixedTolerance)
    ? CalendarAmountSource.FIXED
    : CalendarAmountSource.ESTIMATED;
  return { expectedAmount, amountDeviation, amountSource };
}

function nextSemimonthlyDate(after: Date, anchors: [number, number]): Date {
  for (let monthOffset = 0; monthOffset <= 2; monthOffset += 1) {
    const month = addMonthsClamped(
      new Date(Date.UTC(after.getUTCFullYear(), after.getUTCMonth(), 1)),
      monthOffset,
    );
    const last = daysInMonth(month.getUTCFullYear(), month.getUTCMonth());
    for (const anchor of anchors) {
      const candidate = new Date(
        Date.UTC(
          month.getUTCFullYear(),
          month.getUTCMonth(),
          anchor === 31 ? last : Math.min(anchor, last),
        ),
      );
      if (candidate > after) return candidate;
    }
  }
  return addMonthsClamped(after, 1);
}

export function nextOccurrence(
  after: Date,
  frequency: RecurringFrequency,
  anchors?: [number, number],
) {
  switch (frequency) {
    case RecurringFrequency.WEEKLY:
      return addDays(after, 7);
    case RecurringFrequency.BIWEEKLY:
      return addDays(after, 14);
    case RecurringFrequency.SEMIMONTHLY:
      return nextSemimonthlyDate(after, anchors ?? [1, 15]);
    case RecurringFrequency.MONTHLY:
      return addMonthsClamped(after, 1);
    case RecurringFrequency.QUARTERLY:
      return addMonthsClamped(after, 3);
    case RecurringFrequency.ANNUAL:
      return addMonthsClamped(after, 12);
    default:
      return addMonthsClamped(after, 1);
  }
}

function futureOccurrences(
  lastDate: Date,
  frequency: RecurringFrequency,
  anchors: [number, number] | undefined,
  now: Date,
) {
  let next = nextOccurrence(lastDate, frequency, anchors);
  let missedCycles = 0;
  let guard = 0;
  while (next <= startOfDay(now) && guard < 200) {
    missedCycles += 1;
    next = nextOccurrence(next, frequency, anchors);
    guard += 1;
  }
  const horizon = addDays(now, PROJECTION_HORIZON_DAYS);
  const dates: Date[] = [];
  let current = next;
  while (current <= horizon && dates.length < 20) {
    dates.push(current);
    current = nextOccurrence(current, frequency, anchors);
  }
  if (frequency === RecurringFrequency.ANNUAL && dates.length === 0)
    dates.push(next);
  return { next, dates, missedCycles };
}

function confidence(
  transactions: EffectiveDetectionTransaction[],
  regularity: number,
  amountSource: CalendarAmountSource,
  expectedAmount: Prisma.Decimal,
  amountDeviation: Prisma.Decimal,
  missedCycles: number,
) {
  const occurrenceFactor = Math.min(transactions.length, 5) / 5;
  const amountRatio = expectedAmount.isZero()
    ? new Prisma.Decimal(0)
    : amountDeviation.dividedBy(expectedAmount);
  const amountFactor =
    amountSource === CalendarAmountSource.FIXED
      ? 1
      : Math.max(0.25, 1 - Math.min(1, amountRatio.toNumber() * 2));
  const identityFactor = transactions.every(({ merchantName, override }) =>
    Boolean(merchantName || override?.merchantNameOverride),
  )
    ? 1
    : 0.65;
  const recencyFactor = missedCycles === 0 ? 1 : missedCycles === 1 ? 0.55 : 0;
  const missedCyclePenalty =
    missedCycles >= 2 ? 0.15 : missedCycles === 1 ? 0.05 : 0;
  const score =
    occurrenceFactor * 0.15 +
    regularity * 0.3 +
    amountFactor * 0.2 +
    identityFactor * 0.1 +
    0.1 +
    recencyFactor * 0.15 -
    missedCyclePenalty;
  return new Prisma.Decimal(Math.max(0, Math.min(1, score)).toFixed(4));
}

export function confidenceLevelForScore(score: Prisma.Decimal) {
  if (score.greaterThanOrEqualTo(CONFIDENCE_THRESHOLDS.high))
    return ConfidenceLevel.HIGH;
  if (score.greaterThanOrEqualTo(CONFIDENCE_THRESHOLDS.medium))
    return ConfidenceLevel.MEDIUM;
  return ConfidenceLevel.LOW;
}

function stableKey(parts: string[]) {
  return createHash("sha256").update(parts.join("\u001f")).digest("hex");
}

function uniqueDailyOccurrences(values: EffectiveDetectionTransaction[]) {
  const byDate = new Map<string, EffectiveDetectionTransaction>();
  for (const value of [...values].sort(
    (a, b) => a.postedAt!.getTime() - b.postedAt!.getTime(),
  )) {
    const key = startOfDay(value.postedAt!).toISOString();
    if (!byDate.has(key)) byDate.set(key, value);
  }
  return [...byDate.values()];
}

export function buildRecurringCandidates(
  transactions: DetectionTransaction[],
  now = new Date(),
) {
  const eligible = transactions
    .map(effectiveDetectionTransaction)
    .filter(
      (transaction): transaction is EffectiveDetectionTransaction =>
        transaction !== null,
    );
  const groups = new Map<string, EffectiveDetectionTransaction[]>();
  for (const transaction of eligible) {
    const identity = [
      transaction.userId,
      transaction.accountId,
      transaction.currency,
      transaction.direction,
      transaction.financialRole,
      transaction.flowType,
      transaction.normalizedMerchant,
    ].join("\u001f");
    groups.set(identity, [...(groups.get(identity) ?? []), transaction]);
  }

  const candidates: DetectedRecurringCandidate[] = [];
  for (const group of groups.values()) {
    const occurrences = uniqueDailyOccurrences(group);
    const dates = occurrences.map(({ postedAt }) => postedAt!);
    const frequency = classifyFrequency(dates);
    if (!frequency) continue;
    const { expectedAmount, amountDeviation, amountSource } = estimateAmount(
      occurrences.map(({ amount }) => amount),
    );
    const future = futureOccurrences(
      dates.at(-1)!,
      frequency.frequency,
      frequency.anchors,
      now,
    );
    const score = confidence(
      occurrences,
      frequency.regularity,
      amountSource,
      expectedAmount,
      amountDeviation,
      future.missedCycles,
    );
    const first = occurrences[0];
    candidates.push({
      detectionKey: stableKey([
        first.userId,
        first.accountId,
        first.currency,
        first.direction,
        first.financialRole,
        first.flowType,
        first.normalizedMerchant,
      ]),
      normalizedMerchant: first.normalizedMerchant,
      displayName: first.effectiveMerchant,
      accountId: first.accountId,
      currency: first.currency,
      direction: first.direction,
      financialRole: first.financialRole,
      flowType: first.flowType,
      eventType: first.eventType,
      category: first.effectiveCategory,
      frequency: frequency.frequency,
      anchors: frequency.anchors,
      transactionIds: occurrences.map(({ id }) => id),
      occurrenceDates: dates,
      firstDate: dates[0],
      lastDate: dates.at(-1)!,
      lastAmount: occurrences.at(-1)!.amount.abs(),
      expectedAmount,
      amountDeviation,
      amountSource,
      confidenceScore: score,
      confidenceLevel: confidenceLevelForScore(score),
      intervalRegularity: frequency.regularity,
      missedCycles: future.missedCycles,
      predictedNextDate: future.next,
      projectedDates: future.dates,
    });
  }
  return {
    eligibleTransactions: eligible.length,
    candidates: candidates.sort((a, b) =>
      a.detectionKey.localeCompare(b.detectionKey),
    ),
  };
}
