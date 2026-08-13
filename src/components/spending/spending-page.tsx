import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { SemanticBadge, SemanticValue } from "@/components/ui/semantic";
import {
  formatCurrency,
  formatDate,
  formatPercent,
} from "@/lib/dashboard/formatters";
import type { SpendingBreakdown, SpendingViewModel } from "@/lib/spending";

function transactionHref(key: "category" | "search", value: string) {
  const params = new URLSearchParams({ [key]: value });
  return `/transactions?${params.toString()}`;
}

function Breakdown({
  title,
  values,
  filter,
}: {
  title: string;
  values: SpendingBreakdown[];
  filter: "category" | "search";
}) {
  const maximum = values.reduce(
    (largest, { amount }) => (amount.gt(largest) ? amount : largest),
    values[0]?.amount ?? null,
  );
  return (
    <Card className="min-w-0 p-5">
      <h2 className="text-xl font-bold">{title}</h2>
      {values.length ? (
        <>
          <div className="mt-4 space-y-3" aria-hidden="true">
            {values.slice(0, 8).map(({ label, filterValue, amount }) => (
              <div key={filterValue} className="min-w-0">
                <div className="flex min-w-0 justify-between gap-3 text-sm">
                  <span className="truncate" title={label}>
                    {label}
                  </span>
                  <span className="shrink-0 font-semibold">
                    {formatCurrency(amount)}
                  </span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-[var(--surface-subtle)]">
                  <div
                    className="h-full rounded-full bg-sky-600 dark:bg-sky-400"
                    style={{
                      width: `${maximum && maximum.isPositive() ? amount.dividedBy(maximum).times(100).toDecimalPlaces(2).toString() : "0"}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">
                Accessible {title.toLowerCase()} values
              </caption>
              <thead>
                <tr>
                  <th className="py-2 pr-3">Name</th>
                  <th className="py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {values.map(({ label, filterValue, amount, share }) => (
                  <tr key={filterValue} className="border-t">
                    <td className="max-w-0 py-2 pr-3">
                      <Link
                        className="inline-flex min-h-11 items-center font-medium break-words underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
                        href={transactionHref(filter, filterValue)}
                      >
                        {label}
                      </Link>
                    </td>
                    <td className="py-2 text-right whitespace-nowrap">
                      {formatCurrency(amount)} ({formatPercent(share)})
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <p className="mt-4 text-sm text-[var(--text-secondary)]">
          No finalized spending is available for this month.
        </p>
      )}
    </Card>
  );
}

function monthLabel(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function SpendingPage({ model }: { model: SpendingViewModel }) {
  const difference = model.currentMonth.spending.minus(
    model.previousMonth.spending,
  );
  const increased = difference.isPositive();
  const trendMaximum = model.monthlyTrend.reduce(
    (largest, month) => (month.spending.gt(largest) ? month.spending : largest),
    model.monthlyTrend[0]?.spending ?? model.currentMonth.spending,
  );
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header>
        <p className="text-sm font-semibold tracking-wide text-sky-700 uppercase dark:text-sky-300">
          Milestone 9 · Bills and spending
        </p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">Spending</h1>
        <p className="mt-2 max-w-3xl text-[var(--text-secondary)]">
          Finalized current-month activity, using your local transaction
          corrections and excluding internal movement.
        </p>
      </header>
      {model.latestPostedAt ? (
        <section
          aria-labelledby="spending-summary"
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          <h2 id="spending-summary" className="sr-only">
            Current month summary
          </h2>
          <Card className="p-4">
            <p className="text-sm text-[var(--text-secondary)]">
              Spent this month
            </p>
            <SemanticValue
              tone="negative"
              label="Spent this month"
              className="mt-1 block text-2xl"
            >
              −{formatCurrency(model.currentMonth.spending)}
            </SemanticValue>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-[var(--text-secondary)]">
              Income this month
            </p>
            <SemanticValue
              tone="positive"
              label="Income this month"
              className="mt-1 block text-2xl"
            >
              +{formatCurrency(model.currentMonth.income)}
            </SemanticValue>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-[var(--text-secondary)]">
              Net cash flow
            </p>
            <SemanticValue
              tone={
                model.currentMonth.netCashFlow.isNegative()
                  ? "negative"
                  : "positive"
              }
              label="Net cash flow"
              className="mt-1 block text-2xl"
            >
              {model.currentMonth.netCashFlow.isNegative() ? "−" : "+"}
              {formatCurrency(model.currentMonth.netCashFlow.abs())}
            </SemanticValue>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-[var(--text-secondary)]">
              Compared with last month
            </p>
            <SemanticValue
              tone={increased ? "negative" : "positive"}
              label="Month over month change"
              className="mt-1 block text-lg"
            >
              {difference.isZero()
                ? "No change"
                : `${increased ? "+" : "−"}${formatCurrency(difference.abs())}`}
            </SemanticValue>
            <p className="text-xs text-[var(--text-secondary)]">
              {model.spendingChange === null
                ? "Percentage unavailable because prior spending was zero."
                : `${model.spendingChange.isPositive() ? "+" : ""}${formatPercent(model.spendingChange)} versus ${monthLabel(model.previousMonth.month)}`}
            </p>
          </Card>
        </section>
      ) : null}
      {model.stateMessages.length ? (
        <Notice tone="warning" title="Spending data notice" role="status">
          <ul className="list-disc space-y-1 pl-5">
            {model.stateMessages.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </Notice>
      ) : null}
      {model.isEmpty ? (
        <Card className="p-8 text-center">
          <h2 className="text-xl font-bold">
            No finalized activity this month
          </h2>
          <p className="mt-2 text-[var(--text-secondary)]">
            Pending, removed, report-excluded, and unclassified transactions are
            not included.
          </p>
        </Card>
      ) : null}
      <section className="grid min-w-0 gap-6 lg:grid-cols-2">
        <Breakdown
          title="Spending by category"
          values={model.categories}
          filter="category"
        />
        <Breakdown
          title="Top merchants"
          values={model.merchants}
          filter="search"
        />
      </section>
      <section aria-labelledby="largest-heading" className="space-y-3">
        <h2 id="largest-heading" className="text-xl font-bold">
          Largest purchases
        </h2>
        {model.largestPurchases.length ? (
          <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {model.largestPurchases.map((transaction) => (
              <li key={transaction.id}>
                <Card className="h-full min-w-0 p-4">
                  <Link
                    href={`/transactions/${transaction.id}`}
                    className="inline-flex min-h-11 items-center font-bold break-words underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
                  >
                    {transaction.merchant}
                  </Link>
                  <p className="mt-2">
                    <SemanticValue tone="negative" label="Expense">
                      −
                      {formatCurrency(
                        transaction.amount.abs(),
                        transaction.currency,
                      )}
                    </SemanticValue>
                  </p>
                  <p className="mt-1 text-sm break-words text-[var(--text-secondary)]">
                    {transaction.category} · {transaction.accountName} ·{" "}
                    {formatDate(transaction.postedAt)}
                  </p>
                </Card>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-[var(--text-secondary)]">
            No expense purchases are available.
          </p>
        )}
      </section>
      <section aria-labelledby="unusual-heading" className="space-y-3">
        <div>
          <h2 id="unusual-heading" className="text-xl font-bold">
            Higher than typical purchases
          </h2>
          <p className="text-sm text-[var(--text-secondary)]">
            Descriptive comparisons with your own prior spending—not fraud or
            security alerts.
          </p>
        </div>
        {model.unusualPurchases.length ? (
          <ol className="grid gap-3 lg:grid-cols-2">
            {model.unusualPurchases.map((transaction) => (
              <li key={transaction.id}>
                <Card className="min-w-0 border-[var(--semantic-warning-border)] p-4">
                  <div className="flex flex-wrap justify-between gap-2">
                    <Link
                      href={`/transactions/${transaction.id}`}
                      className="inline-flex min-h-11 items-center font-bold break-words underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
                    >
                      {transaction.merchant}
                    </Link>
                    <SemanticBadge tone="warning">
                      Higher than typical
                    </SemanticBadge>
                  </div>
                  <p className="mt-2">
                    {formatCurrency(
                      transaction.amount.abs(),
                      transaction.currency,
                    )}{" "}
                    compared with a typical{" "}
                    {formatCurrency(
                      transaction.priorMedian,
                      transaction.currency,
                    )}{" "}
                    across {transaction.priorCount} prior purchases.
                  </p>
                </Card>
              </li>
            ))}
          </ol>
        ) : (
          <p className="rounded-lg bg-[var(--surface-subtle)] p-4 text-sm text-[var(--text-secondary)]">
            No current purchase meets the conservative higher-than-typical rule.
          </p>
        )}
      </section>
      <section aria-labelledby="trend-heading">
        <Card className="min-w-0 p-5">
          <h2 id="trend-heading" className="text-xl font-bold">
            12-month spending history
          </h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Historical finalized spending only; no forecast.
          </p>
          <div
            aria-hidden="true"
            className="mt-5 flex h-36 items-end gap-2 border-b px-1"
          >
            {model.monthlyTrend.map((month) => (
              <div
                key={month.month.toISOString()}
                className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1"
                title={`${monthLabel(month.month)}: ${formatCurrency(month.spending)}`}
              >
                <div
                  className="w-full min-w-2 rounded-t bg-sky-600 dark:bg-sky-400"
                  style={{
                    height: `${trendMaximum.isPositive() ? Math.max(2, month.spending.dividedBy(trendMaximum).times(100).toNumber()) : 2}%`,
                  }}
                />
                <span className="hidden text-[0.625rem] sm:block">
                  {new Intl.DateTimeFormat("en-US", {
                    month: "narrow",
                    timeZone: "UTC",
                  }).format(month.month)}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[32rem] text-left text-sm">
              <thead>
                <tr>
                  <th className="py-2">Month</th>
                  <th className="py-2 text-right">Income</th>
                  <th className="py-2 text-right">Spending</th>
                  <th className="py-2 text-right">Net cash flow</th>
                </tr>
              </thead>
              <tbody>
                {model.monthlyTrend.map((month) => (
                  <tr key={month.month.toISOString()} className="border-t">
                    <th className="py-2 font-medium">
                      {monthLabel(month.month)}
                    </th>
                    <td className="py-2 text-right">
                      +{formatCurrency(month.income)}
                    </td>
                    <td className="py-2 text-right">
                      −{formatCurrency(month.spending)}
                    </td>
                    <td className="py-2 text-right">
                      {month.netCashFlow.isNegative() ? "−" : "+"}
                      {formatCurrency(month.netCashFlow.abs())}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </section>
      <p className="text-xs text-[var(--text-secondary)]">
        Includes {model.transactionCount} classified posted transaction
        {model.transactionCount === 1 ? "" : "s"} this month
        {model.latestPostedAt
          ? ` · latest posted ${formatDate(model.latestPostedAt)}`
          : ""}
        .
      </p>
    </div>
  );
}
