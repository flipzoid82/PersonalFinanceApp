import { Landmark, PieChart } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { SemanticBadge, SemanticValue } from "@/components/ui/semantic";
import {
  formatCurrency,
  formatDate,
  formatRelativeTime,
  titleCaseEnum,
} from "@/lib/dashboard/formatters";
import { freshnessState, type InvestmentInsights } from "@/lib/portfolio";

export function InvestmentComposition({
  insights,
}: {
  insights: InvestmentInsights;
}) {
  return (
    <section aria-labelledby="investment-composition-title" className="mt-8">
      <h2 id="investment-composition-title" className="text-xl font-bold">
        How your investments are spread out
      </h2>
      <p className="mt-2 text-sm text-[var(--text-secondary)]">
        Each account uses its latest authoritative value. Holdings are never
        added on top of these totals.
      </p>
      <Card className="mt-4 p-5 sm:p-6">
        {insights.accountAllocation.length ? (
          <>
            <ul
              className="space-y-4"
              aria-label="Investment allocation by account"
            >
              {insights.accountAllocation.map((item) => (
                <li key={item.id} className="min-w-0">
                  <div className="flex flex-wrap justify-between gap-2 text-sm">
                    <span className="min-w-0 font-semibold break-words">
                      {item.label}
                    </span>
                    <span>
                      {formatCurrency(item.value)} ·{" "}
                      {item.percentage?.toString() ?? "0"}%
                    </span>
                  </div>
                  <div className="mt-2 h-3 overflow-hidden rounded-full bg-[var(--semantic-muted-bg)]">
                    <div
                      className="h-full rounded-full bg-[var(--semantic-investment-text)]"
                      style={{
                        width: `${Math.max(item.percentage?.toNumber() ?? 0, 1)}%`,
                      }}
                      aria-hidden="true"
                    />
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-md text-left text-sm">
                <caption className="sr-only">
                  Investment allocation values and percentages by account
                </caption>
                <thead>
                  <tr>
                    <th className="py-2 pr-4">Account</th>
                    <th className="py-2 pr-4">Value</th>
                    <th className="py-2">Share</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {insights.accountAllocation.map((item) => (
                    <tr key={item.id}>
                      <td className="max-w-72 py-2 pr-4 break-words">
                        {item.label}
                      </td>
                      <td className="py-2 pr-4">
                        {formatCurrency(item.value)}
                      </td>
                      <td className="py-2">
                        {item.percentage?.toString() ?? "0"}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p className="text-sm text-[var(--text-secondary)]">
            Account allocation is unavailable until a current investment value
            is stored.
          </p>
        )}
      </Card>
    </section>
  );
}

export function InvestmentHoldings({
  insights,
  now,
}: {
  insights: InvestmentInsights;
  now: Date;
}) {
  return (
    <section aria-labelledby="investment-holdings-title" className="mt-8">
      <h2 id="investment-holdings-title" className="text-xl font-bold">
        What you own
      </h2>
      <p className="mt-2 text-sm text-[var(--text-secondary)]">
        Holdings are the identifiable investments inside an account. Missing
        detail does not mean the account has no investments.
      </p>
      <div className="mt-4 space-y-4">
        {insights.accounts.map((insight) => {
          const holdingsFreshness = freshnessState(insight.holdingsAsOf, now);
          return (
            <Card key={insight.account.id} className="min-w-0 p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-bold break-words">
                    {insight.account.name}
                  </h3>
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">
                    {insight.account.institutionName ??
                      insight.account.dataSource.displayName}
                  </p>
                </div>
                <SemanticValue tone="investment" label="Account value">
                  +
                  {formatCurrency(
                    insight.currentValue,
                    insight.account.currency,
                  )}
                </SemanticValue>
              </div>

              {insight.latestHoldings.length ? (
                <>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <SemanticBadge
                      tone={
                        insight.holdingsAlignedToValue
                          ? holdingsFreshness === "stale"
                            ? "warning"
                            : "investment"
                          : "warning"
                      }
                    >
                      {insight.holdingsAlignedToValue
                        ? holdingsFreshness === "stale"
                          ? "Stale holdings detail"
                          : "Current holdings detail"
                        : "Holdings date differs from account value"}
                    </SemanticBadge>
                    <span className="text-xs text-[var(--text-secondary)]">
                      {formatRelativeTime(insight.holdingsAsOf, now)}
                    </span>
                  </div>
                  <ul
                    className="mt-3 divide-y"
                    aria-label={`Known holdings in ${insight.account.name}`}
                  >
                    {insight.latestHoldings.map((holding) => (
                      <li
                        key={holding.id}
                        className="flex min-w-0 flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between"
                      >
                        <div className="min-w-0">
                          <p className="font-semibold break-words">
                            {holding.securityName}
                            {holding.tickerSymbol
                              ? ` (${holding.tickerSymbol})`
                              : ""}
                          </p>
                          <p className="mt-1 text-xs break-words text-[var(--text-secondary)]">
                            {holding.securityType
                              ? `${titleCaseEnum(holding.securityType)} · `
                              : ""}
                            {titleCaseEnum(holding.source)} source · As of{" "}
                            {formatDate(holding.asOfDate)}
                            {holding.quantity
                              ? ` · ${holding.quantity.toString()} units`
                              : ""}
                            {holding.price
                              ? ` at ${formatCurrency(holding.price, holding.currency)}`
                              : ""}
                          </p>
                        </div>
                        <SemanticValue
                          tone={
                            insight.holdingsAlignedToValue
                              ? "investment"
                              : "muted"
                          }
                          label={
                            insight.holdingsAlignedToValue
                              ? "Current holding value"
                              : "Stored holding value"
                          }
                        >
                          +
                          {formatCurrency(
                            holding.currentValue,
                            holding.currency,
                          )}
                        </SemanticValue>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <Notice tone="info" className="mt-4">
                  Holdings detail is unavailable for this account. Its current
                  account value is still included once in the investment total.
                </Notice>
              )}

              {insight.unallocatedValue.isPositive() ? (
                <p className="mt-4 text-sm text-[var(--text-secondary)]">
                  <strong className="text-[var(--text-primary)]">
                    {formatCurrency(
                      insight.unallocatedValue,
                      insight.account.currency,
                    )}
                  </strong>{" "}
                  of this account is not represented by current, aligned
                  holdings detail.
                </p>
              ) : null}
            </Card>
          );
        })}
      </div>
      {insights.unallocatedValue.isPositive() ? (
        <Notice
          tone="info"
          title="Some holdings detail is unavailable"
          icon={PieChart}
          className="mt-4"
        >
          {formatCurrency(insights.unallocatedValue)} of the current investment
          total is not assigned to trustworthy current holding records. It
          remains included in account totals.
        </Notice>
      ) : null}
    </section>
  );
}

export function InvestmentContributions({
  insights,
}: {
  insights: InvestmentInsights;
}) {
  return (
    <section aria-labelledby="investment-contributions-title" className="mt-8">
      <h2 id="investment-contributions-title" className="text-xl font-bold">
        Money added
      </h2>
      <p className="mt-2 text-sm text-[var(--text-secondary)]">
        Only source records explicitly identified as contributions appear here.
        Balance growth, gains, dividends, transfers, and fees are not treated as
        contributions.
      </p>
      {insights.contributions.length ? (
        <Card className="mt-4 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="font-semibold">Recorded contributions</span>
            <SemanticValue tone="positive" label="Recorded contributions">
              +{formatCurrency(insights.contributionTotal)}
            </SemanticValue>
          </div>
          <p className="mt-2 text-xs text-[var(--text-secondary)]">
            Current source data does not distinguish owner contributions from
            employer contributions, so no split is inferred.
          </p>
          <ul
            className="mt-4 divide-y"
            aria-label="Recorded investment contributions"
          >
            {insights.contributions.slice(0, 12).map((contribution) => (
              <li
                key={contribution.id}
                className="flex min-w-0 flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="font-semibold break-words">
                    {contribution.accountName}
                  </p>
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">
                    {formatDate(contribution.date)} ·{" "}
                    {titleCaseEnum(contribution.source)} source
                    {contribution.description
                      ? ` · ${contribution.description}`
                      : ""}
                  </p>
                </div>
                <SemanticValue tone="positive" label="Contribution amount">
                  +{formatCurrency(contribution.amount, contribution.currency)}
                </SemanticValue>
              </li>
            ))}
          </ul>
        </Card>
      ) : (
        <Notice tone="info" icon={Landmark} className="mt-4">
          Contribution activity is unavailable because no current source record
          explicitly identifies money added to these accounts.
        </Notice>
      )}
    </section>
  );
}
