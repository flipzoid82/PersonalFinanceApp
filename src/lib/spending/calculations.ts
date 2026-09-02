import { FinancialRole, Prisma } from "@prisma/client";
import { startOfNextUtcMonth, startOfUtcMonth } from "@/lib/dashboard/dates";
import { formatTransactionCategory } from "@/lib/transactions/presentation";
import type {
  SpendingBreakdown,
  SpendingMonth,
  SpendingTransaction,
  SpendingViewModel,
  UnusualPurchase,
} from "./types";

const ZERO = new Prisma.Decimal(0);

function previousMonth(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - 1, 1));
}

function sum(values: Prisma.Decimal[]) {
  return values.reduce((total, value) => total.plus(value), ZERO);
}

function monthSummary(
  transactions: SpendingTransaction[],
  month: Date,
): SpendingMonth {
  const start = startOfUtcMonth(month);
  const end = startOfNextUtcMonth(month);
  const current = transactions.filter(
    ({ postedAt }) => postedAt >= start && postedAt < end,
  );
  const income = sum(
    current
      .filter(({ role }) => role === FinancialRole.INCOME)
      .map(({ amount }) => amount.abs()),
  );
  const spending = current.reduce((total, transaction) => {
    if (transaction.role === FinancialRole.EXPENSE)
      return total.plus(transaction.amount.abs());
    if (transaction.role === FinancialRole.REFUND)
      return total.minus(transaction.amount.abs());
    return total;
  }, ZERO);
  return {
    month: start,
    income,
    spending,
    netCashFlow: income.minus(spending),
  };
}

function breakdown(
  transactions: SpendingTransaction[],
  key: (transaction: SpendingTransaction) => string,
  display: (value: string) => string = (value) => value,
) {
  const amounts = new Map<string, Prisma.Decimal>();
  for (const transaction of transactions) {
    const direction =
      transaction.role === FinancialRole.EXPENSE
        ? transaction.amount.abs()
        : transaction.role === FinancialRole.REFUND
          ? transaction.amount.abs().negated()
          : ZERO;
    if (direction.isZero()) continue;
    const label = key(transaction);
    amounts.set(label, (amounts.get(label) ?? ZERO).plus(direction));
  }
  const total = sum([...amounts.values()]);
  return [...amounts.entries()]
    .filter(([, amount]) => !amount.isZero())
    .map<SpendingBreakdown>(([label, amount]) => ({
      label: display(label),
      filterValue: label,
      amount,
      share: total.isZero() ? ZERO : amount.dividedBy(total).times(100),
    }))
    .sort((a, b) => b.amount.comparedTo(a.amount));
}

function median(values: Prisma.Decimal[]) {
  const sorted = [...values].sort((a, b) => a.comparedTo(b));
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : sorted[middle - 1].plus(sorted[middle]).dividedBy(2);
}

function sourceTransactions(transactions: SpendingTransaction[]) {
  const grouped = new Map<string, SpendingTransaction>();
  for (const transaction of transactions) {
    const existing = grouped.get(transaction.id);
    grouped.set(
      transaction.id,
      existing
        ? {
            ...existing,
            amount: existing.amount.plus(transaction.amount.abs()),
          }
        : { ...transaction, amount: transaction.amount.abs() },
    );
  }
  return [...grouped.values()];
}

export function findUnusualPurchases(
  all: SpendingTransaction[],
  currentMonth: Date,
): UnusualPurchase[] {
  const start = startOfUtcMonth(currentMonth);
  const end = startOfNextUtcMonth(currentMonth);
  return all
    .filter(
      ({ role, postedAt }) =>
        role === FinancialRole.EXPENSE && postedAt >= start && postedAt < end,
    )
    .flatMap((transaction) => {
      const history = all
        .filter(
          (candidate) =>
            candidate.role === FinancialRole.EXPENSE &&
            candidate.merchant === transaction.merchant &&
            candidate.postedAt < transaction.postedAt,
        )
        .map(({ amount }) => amount.abs());
      if (history.length < 4) return [];
      const priorMedian = median(history);
      const mad = median(
        history.map((amount) => amount.minus(priorMedian).abs()),
      );
      const threshold = Prisma.Decimal.max(
        priorMedian.plus(mad.times(3)),
        priorMedian.times("1.5"),
      );
      return transaction.amount.abs().gte(threshold)
        ? [
            {
              ...transaction,
              priorCount: history.length,
              priorMedian,
              threshold,
            },
          ]
        : [];
    })
    .sort((a, b) => b.amount.abs().comparedTo(a.amount.abs()));
}

export function calculateSpending(
  transactions: SpendingTransaction[],
  now = new Date(),
): SpendingViewModel {
  const currentStart = startOfUtcMonth(now);
  const currentEnd = startOfNextUtcMonth(now);
  const currentTransactions = transactions.filter(
    ({ postedAt }) => postedAt >= currentStart && postedAt < currentEnd,
  );
  const currentSourceTransactions = sourceTransactions(currentTransactions);
  const allSourceTransactions = sourceTransactions(transactions);
  const reportableCurrent = currentTransactions.filter(
    ({ role }) =>
      role === FinancialRole.EXPENSE || role === FinancialRole.REFUND,
  );
  const currentMonth = monthSummary(transactions, now);
  const priorStart = previousMonth(now);
  const previous = monthSummary(transactions, priorStart);
  const spendingChange = previous.spending.isZero()
    ? null
    : currentMonth.spending
        .minus(previous.spending)
        .dividedBy(previous.spending.abs())
        .times(100);
  const trendStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1),
  );
  const months: Date[] = [];
  for (
    let month = trendStart;
    month <= currentStart;
    month = startOfNextUtcMonth(month)
  )
    months.push(month);

  return {
    currentMonth,
    previousMonth: previous,
    spendingChange,
    categories: breakdown(
      reportableCurrent,
      ({ category }) => category,
      formatTransactionCategory,
    ),
    merchants: breakdown(
      sourceTransactions(reportableCurrent),
      ({ merchant }) => merchant,
    ),
    largestPurchases: currentSourceTransactions
      .filter(({ role }) => role === FinancialRole.EXPENSE)
      .sort((a, b) => b.amount.abs().comparedTo(a.amount.abs()))
      .slice(0, 10),
    unusualPurchases: findUnusualPurchases(allSourceTransactions, now),
    monthlyTrend: months.map((month) => monthSummary(transactions, month)),
    transactionCount: currentSourceTransactions.length,
    latestPostedAt:
      [...transactions].sort(
        (a, b) => b.postedAt.getTime() - a.postedAt.getTime(),
      )[0]?.postedAt ?? null,
    stateMessages: [],
    isEmpty: currentTransactions.length === 0,
  };
}
