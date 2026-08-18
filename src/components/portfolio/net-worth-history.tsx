import Link from "next/link";
import { TrendingDown, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { SemanticBadge, SemanticValue } from "@/components/ui/semantic";
import {
  formatCurrency,
  formatDate,
  formatShortDate,
} from "@/lib/dashboard/formatters";
import {
  NET_WORTH_RANGES,
  type NetWorthHistory as NetWorthHistoryModel,
} from "@/lib/portfolio";

export function NetWorthHistory({
  history,
}: {
  history: NetWorthHistoryModel;
}) {
  const values = history.points.map(({ value }) => value.toNumber());
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 0);
  const span = Math.max(max - min, 1);
  const changeTone = history.change?.isNegative() ? "negative" : "positive";
  const ChangeIcon = history.change?.isNegative() ? TrendingDown : TrendingUp;

  return (
    <section aria-labelledby="net-worth-history-title" className="mt-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="net-worth-history-title" className="text-xl font-bold">
            Historical change
          </h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Stored account observations only. Current-only values are not copied
            backward into history.
          </p>
        </div>
        <nav
          aria-label="Net-worth history range"
          className="flex flex-wrap gap-2"
        >
          {NET_WORTH_RANGES.map(({ value, label }) => (
            <Link
              key={value}
              href={
                value === "30d" ? "/net-worth" : `/net-worth?range=${value}`
              }
              aria-current={history.range === value ? "page" : undefined}
              aria-label={`${label} net-worth history`}
              className={`inline-flex min-h-10 min-w-12 items-center justify-center rounded-lg border px-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)] ${history.range === value ? "border-[var(--semantic-info-border)] bg-[var(--semantic-info-bg)] text-[var(--semantic-info-text)]" : "border-[var(--border-default)] bg-[var(--surface-panel)] text-[var(--text-primary)]"}`}
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>

      {history.isPartial ? (
        <Notice
          tone="warning"
          title="Partial history"
          role="status"
          className="mt-4"
        >
          {history.partialReasons.join(" ")}
        </Notice>
      ) : null}

      <Card className="mt-4 overflow-hidden p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-[var(--text-secondary)]">
              Selected range
            </p>
            <p className="mt-1 text-lg font-bold">{history.rangeLabel}</p>
          </div>
          {history.change ? (
            <div className="text-right">
              <p className="text-sm text-[var(--text-secondary)]">
                Change between stored points
              </p>
              <SemanticValue tone={changeTone} label="Historical change">
                <ChangeIcon className="mr-1 inline size-4" aria-hidden="true" />
                {history.change.isNegative() ? "−" : "+"}
                {formatCurrency(history.change.abs())}
              </SemanticValue>
            </div>
          ) : (
            <SemanticBadge tone="muted">Change unavailable</SemanticBadge>
          )}
        </div>

        {history.points.length ? (
          <>
            <div
              className="mt-6 flex h-48 items-end gap-1 border-b border-[var(--border-default)]"
              role="img"
              aria-label={`Stored net worth from ${formatCurrency(history.points[0].value)} on ${formatDate(history.points[0].date)} to ${formatCurrency(history.points.at(-1)!.value)} on ${formatDate(history.points.at(-1)!.date)}.`}
            >
              {history.points.map((point) => {
                const height = Math.max(
                  4,
                  ((point.value.toNumber() - min) / span) * 100,
                );
                return (
                  <div
                    key={point.date.toISOString()}
                    className={`min-w-1 flex-1 rounded-t ${point.value.isNegative() ? "bg-[var(--semantic-negative-text)]" : "bg-[var(--semantic-positive-text)]"}`}
                    style={{ height: `${height}%` }}
                    title={`${formatDate(point.date)}: ${formatCurrency(point.value)}`}
                  />
                );
              })}
            </div>
            <div className="mt-2 flex justify-between text-xs text-[var(--text-secondary)]">
              <span>{formatShortDate(history.points[0].date)}</span>
              <span>{formatShortDate(history.points.at(-1)!.date)}</span>
            </div>
            <details className="mt-5">
              <summary className="cursor-pointer font-semibold">
                View accessible history table ({history.points.length} points)
              </summary>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-lg text-left text-sm">
                  <caption className="sr-only">
                    Stored net-worth history for {history.rangeLabel}
                  </caption>
                  <thead>
                    <tr>
                      <th className="py-2 pr-4">Date</th>
                      <th className="py-2 pr-4">Tracked assets</th>
                      <th className="py-2 pr-4">Tracked debts</th>
                      <th className="py-2">Tracked net worth</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {history.points.map((point) => (
                      <tr key={point.date.toISOString()}>
                        <td className="py-2 pr-4">{formatDate(point.date)}</td>
                        <td className="py-2 pr-4">
                          +{formatCurrency(point.assets)}
                        </td>
                        <td className="py-2 pr-4">
                          −{formatCurrency(point.debts)}
                        </td>
                        <td className="py-2">{formatCurrency(point.value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </>
        ) : (
          <p className="mt-5 text-sm text-[var(--text-secondary)]">
            No stored historical observations are available for this range.
          </p>
        )}
      </Card>
    </section>
  );
}
