import { InvestmentTransactionType, Prisma } from "@prisma/client";
import { latestAccountValue } from "./values";
import type {
  InvestmentAllocationItem,
  InvestmentInsights,
  PortfolioAccount,
  PortfolioViewModel,
} from "./types";

const ZERO = new Prisma.Decimal(0);

function percentage(value: Prisma.Decimal, total: Prisma.Decimal) {
  return total.isZero()
    ? null
    : value.dividedBy(total).times(100).toDecimalPlaces(1);
}

function sameUtcDay(left: Date | null, right: Date | null) {
  return Boolean(
    left &&
      right &&
      left.getUTCFullYear() === right.getUTCFullYear() &&
      left.getUTCMonth() === right.getUTCMonth() &&
      left.getUTCDate() === right.getUTCDate(),
  );
}

function latestHoldings(account: PortfolioAccount, now: Date) {
  const eligible = account.investmentHoldings.filter(
    ({ asOfDate }) => asOfDate <= now,
  );
  const latestDate = eligible
    .map(({ asOfDate }) => asOfDate)
    .sort((a, b) => b.getTime() - a.getTime())[0];
  return {
    date: latestDate ?? null,
    holdings: latestDate
      ? eligible.filter(
          ({ asOfDate }) => asOfDate.getTime() === latestDate.getTime(),
        )
      : [],
  };
}

export function calculateInvestmentInsights(
  portfolio: Pick<
    PortfolioViewModel,
    "investmentAccounts" | "totalInvestments"
  >,
  now = new Date(),
): InvestmentInsights {
  const accounts = portfolio.investmentAccounts.map((account) => {
    const latest = latestAccountValue(account, now);
    const holdings = latestHoldings(account, now);
    const holdingsTotal = holdings.holdings.reduce(
      (total, holding) => total.plus(holding.currentValue.abs()),
      ZERO,
    );
    const aligned =
      latest.isAvailable &&
      holdings.holdings.length > 0 &&
      holdings.holdings.every(
        ({ currency }) => currency === account.currency,
      ) &&
      sameUtcDay(holdings.date, latest.updatedAt) &&
      holdingsTotal.lessThanOrEqualTo(latest.value.abs());
    const knownHoldingsValue = aligned ? holdingsTotal : ZERO;
    return {
      account,
      currentValue: latest.value.abs(),
      valueUpdatedAt: latest.updatedAt,
      valueAvailable: latest.isAvailable,
      latestHoldings: holdings.holdings,
      holdingsAsOf: holdings.date,
      holdingsAlignedToValue: aligned,
      knownHoldingsValue,
      unallocatedValue: latest.isAvailable
        ? latest.value.abs().minus(knownHoldingsValue)
        : ZERO,
    };
  });

  const knownHoldingsValue = accounts.reduce(
    (total, account) => total.plus(account.knownHoldingsValue),
    ZERO,
  );
  const unallocatedValue = portfolio.totalInvestments.minus(knownHoldingsValue);
  const holdingAllocation: InvestmentAllocationItem[] = accounts.flatMap(
    (insight) => {
      const known = insight.holdingsAlignedToValue
        ? insight.latestHoldings.map((holding) => ({
            id: holding.id,
            label: holding.securityName,
            accountName: insight.account.name,
            value: holding.currentValue.abs(),
            percentage: percentage(
              holding.currentValue.abs(),
              portfolio.totalInvestments,
            ),
            kind: "holding" as const,
          }))
        : [];
      return insight.unallocatedValue.isPositive()
        ? [
            ...known,
            {
              id: `${insight.account.id}-unallocated`,
              label: "Holdings detail unavailable",
              accountName: insight.account.name,
              value: insight.unallocatedValue,
              percentage: percentage(
                insight.unallocatedValue,
                portfolio.totalInvestments,
              ),
              kind: "unallocated" as const,
            },
          ]
        : known;
    },
  );

  const contributions = accounts
    .flatMap(({ account }) =>
      account.investmentTransactions
        .filter(
          ({ transactionType, amount }) =>
            transactionType === InvestmentTransactionType.CONTRIBUTION &&
            amount !== null,
        )
        .map((transaction) => ({
          id: transaction.id,
          accountName: account.name,
          date: transaction.transactionDate,
          amount: transaction.amount!.abs(),
          currency: transaction.currency,
          source: transaction.source,
          description:
            transaction.securityName ?? transaction.tickerSymbol ?? null,
        })),
    )
    .sort((a, b) => b.date.getTime() - a.date.getTime());

  return {
    accounts,
    accountAllocation: accounts
      .filter(({ valueAvailable }) => valueAvailable)
      .map(({ account, currentValue }) => ({
        id: account.id,
        label: account.name,
        value: currentValue,
        percentage: percentage(currentValue, portfolio.totalInvestments),
      })),
    holdingAllocation,
    knownHoldingsValue,
    unallocatedValue,
    contributions,
    contributionTotal: contributions.reduce(
      (total, contribution) => total.plus(contribution.amount),
      ZERO,
    ),
  };
}
