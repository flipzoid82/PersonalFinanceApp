import {
  CalendarEventType,
  FinancialRole,
  TransactionStatus,
} from "@prisma/client";
import type {
  CalendarTransaction,
  EffectiveCalendarEvent,
  MatchCandidate,
} from "./types";

const EXPECTED_ROLES: Record<CalendarEventType, FinancialRole[]> = {
  BILL: [FinancialRole.EXPENSE],
  SUBSCRIPTION: [FinancialRole.EXPENSE],
  DEBT_PAYMENT: [FinancialRole.DEBT_PAYMENT],
  CREDIT_CARD_PAYMENT: [FinancialRole.CREDIT_CARD_PAYMENT],
  EXPECTED_INCOME: [FinancialRole.INCOME],
  OTHER_RECURRING: [FinancialRole.EXPENSE],
};

function words(value: string) {
  return new Set(
    value
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 2 && word !== "synthetic"),
  );
}

export function textSimilarity(left: string, right: string) {
  const a = words(left);
  const b = words(right);
  if (!a.size || !b.size) return 0;
  const intersection = [...a].filter((word) => b.has(word)).length;
  const union = new Set([...a, ...b]).size;
  return intersection / union;
}

export function scoreTransactionMatch(
  event: EffectiveCalendarEvent,
  transaction: CalendarTransaction,
): MatchCandidate | null {
  if (
    transaction.status !== TransactionStatus.POSTED ||
    !transaction.postedAt ||
    transaction.userId !== event.source.userId ||
    transaction.currency !== event.currency
  )
    return null;
  const role = transaction.override
    ?.financialRoleOverride as FinancialRole | null;
  if (role && !EXPECTED_ROLES[event.eventType].includes(role)) return null;

  let score = 0;
  const reasons: string[] = [];
  const streamText = [
    event.title,
    event.source.recurringStream?.merchantName,
    event.source.recurringStream?.description,
  ]
    .filter(Boolean)
    .join(" ");
  const transactionText = transaction.merchantName ?? transaction.originalName;
  const similarity = textSimilarity(streamText, transactionText);
  if (similarity >= 0.2) {
    score += similarity >= 0.5 ? 0.35 : 0.2;
    reasons.push("merchant or description");
  }
  if (event.accountId && transaction.accountId === event.accountId) {
    score += 0.2;
    reasons.push("account");
  }
  if (event.expectedAmount) {
    const difference = transaction.amount
      .abs()
      .minus(event.expectedAmount.abs())
      .abs();
    const tolerance = event.expectedAmount.abs().times("0.10").greaterThan(5)
      ? event.expectedAmount.abs().times("0.10")
      : event.expectedAmount.abs().times(0).plus(5);
    if (difference.lessThanOrEqualTo(tolerance)) {
      score += difference.isZero() ? 0.25 : 0.15;
      reasons.push("amount");
    }
  }
  const targetDate = event.predictedPostingDate ?? event.effectiveDate;
  const dayDistance = Math.abs(
    Math.round(
      (transaction.postedAt.getTime() - targetDate.getTime()) / 86_400_000,
    ),
  );
  if (dayDistance <= 7) {
    score += dayDistance <= 2 ? 0.2 : 0.1;
    reasons.push("date proximity");
  }
  if (role && EXPECTED_ROLES[event.eventType].includes(role)) {
    score += 0.1;
    reasons.push("event type");
  }
  if (!role) score = Math.min(score, 0.79);
  score = Math.min(1, Number(score.toFixed(2)));
  const confidence = score >= 0.8 ? "HIGH" : score >= 0.55 ? "MEDIUM" : "LOW";
  return {
    transaction,
    score,
    confidence,
    reasons,
    requiresConfirmation: confidence !== "HIGH",
  };
}

export function findBestTransactionMatch(
  event: EffectiveCalendarEvent,
  transactions: CalendarTransaction[],
) {
  const candidates = transactions
    .map((transaction) => scoreTransactionMatch(event, transaction))
    .filter((candidate): candidate is MatchCandidate => Boolean(candidate))
    .filter(({ score }) => score >= 0.35)
    .sort((a, b) => b.score - a.score);
  if (
    candidates[0] &&
    candidates[1] &&
    Math.abs(candidates[0].score - candidates[1].score) <= 0.05
  )
    return undefined;
  return candidates[0];
}
