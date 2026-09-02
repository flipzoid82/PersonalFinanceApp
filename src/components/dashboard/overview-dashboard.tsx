import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { MetricCard } from "./metric-card";
import { OverviewPanels } from "./overview-panels";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import {
  formatCurrency,
  formatDate,
  formatPercent,
  formatRelativeTime,
} from "@/lib/dashboard/formatters";
import type { DashboardViewModel } from "@/lib/dashboard/types";

export function OverviewDashboard({
  dashboard,
  now,
}: {
  dashboard: DashboardViewModel;
  now: Date;
}) {
  if (dashboard.isEmpty) {
    return (
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-bold tracking-tight">Overview</h1>
        <Card className="mt-8 p-8 text-center sm:p-12">
          <h2 className="text-xl font-semibold">No financial data available</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-[var(--text-secondary)]">
            This owner has no normalized accounts, transactions, assets, or
            calendar records yet. Load the synthetic demo seed to preview the
            dashboard. Future milestones will add connection, import, and
            manual-entry workflows.
          </p>
          <p className="mt-5 rounded-lg bg-[var(--surface-subtle)] px-4 py-3 font-mono text-sm">
            pnpm db:seed
          </p>
        </Card>
      </div>
    );
  }

  const metrics = [
    {
      label: "Net Worth",
      value: formatCurrency(dashboard.metrics.netWorth),
      support: dashboard.isPartial
        ? "Partial total from available sources"
        : "Assets minus debts",
      href: "/net-worth",
      order: "order-1",
      tone: dashboard.metrics.netWorth.isNegative()
        ? ("negative" as const)
        : ("positive" as const),
    },
    {
      label: "Cash",
      value: formatCurrency(dashboard.metrics.cash),
      support:
        dashboard.metrics.availableCash === null
          ? "Available cash unavailable"
          : `${formatCurrency(dashboard.metrics.availableCash)} available`,
      href: "/accounts?type=cash",
      order: "order-2",
      tone: "positive" as const,
    },
    {
      label: "Credit Card Debt",
      value: formatCurrency(dashboard.metrics.cardDebt),
      support:
        dashboard.metrics.creditUtilization === null
          ? "Credit utilization unavailable"
          : `${formatPercent(dashboard.metrics.creditUtilization)} utilization`,
      href: "/accounts?type=credit-card",
      order: "order-3",
      tone: "negative" as const,
    },
    {
      label: "Investments",
      value: formatCurrency(dashboard.metrics.investments),
      support: `${dashboard.investmentAccounts.length} investment account${dashboard.investmentAccounts.length === 1 ? "" : "s"}`,
      href: "/investments",
      order: "order-8 xl:order-4",
      tone: "investment" as const,
    },
    {
      label: "Income This Month",
      value: formatCurrency(dashboard.metrics.income),
      support: "Posted, owner-reviewed or deterministically resolved income",
      href: "/transactions",
      order: "order-5",
      tone: "positive" as const,
    },
    {
      label: "Spending This Month",
      value: formatCurrency(dashboard.metrics.spending),
      support: "Posted expenses after refunds and exclusions",
      href: "/spending?view=expenses",
      order: "order-6",
      tone: "negative" as const,
    },
    {
      label: "Net Cash Flow",
      value: formatCurrency(dashboard.metrics.cashFlow),
      support: dashboard.metrics.cashFlow.isNegative()
        ? "Net outflow this month"
        : "Income minus spending",
      href: "/spending?view=cash-flow",
      order: "order-7",
      tone: dashboard.metrics.cashFlow.isNegative()
        ? ("negative" as const)
        : ("positive" as const),
    },
    {
      label: "Upcoming Bills",
      value: formatCurrency(dashboard.upcomingTotal),
      support: dashboard.upcoming.length
        ? `${dashboard.upcoming.length} in 14 days · ${dashboard.upcomingConfirmedCount} confirmed, ${dashboard.upcomingPredictedCount} predicted`
        : "No expected outflows in the next 14 days",
      href: "/calendar?view=upcoming&days=14",
      order: "order-4 xl:order-8",
      tone: "warning" as const,
    },
  ];

  return (
    <div className="mx-auto max-w-7xl">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Overview</h1>
          <p className="mt-2 max-w-2xl text-[var(--text-secondary)]">
            A read-only snapshot built from normalized synthetic financial
            records.
          </p>
        </div>
        <p className="text-sm text-[var(--text-secondary)]">
          {dashboard.latestDataAt
            ? `${formatRelativeTime(dashboard.latestDataAt, now)} · ${formatDate(dashboard.latestDataAt)}`
            : "Latest update unavailable"}
        </p>
      </header>

      {dashboard.isPartial ? (
        <Notice
          tone="warning"
          title="Partial totals"
          icon={AlertTriangle}
          role="status"
          className="mt-5"
        >
          {dashboard.partialReasons.join(" ")}
        </Notice>
      ) : null}

      {dashboard.transactionCoverage.some(
        ({ unresolvedCount }) => unresolvedCount > 0,
      ) ? (
        <Notice
          tone="warning"
          title="Transaction classification coverage"
          icon={AlertTriangle}
          role="status"
          className="mt-5"
        >
          {dashboard.transactionCoverage
            .filter(({ unresolvedCount }) => unresolvedCount > 0)
            .map((coverage) => (
              <span key={coverage.currency} className="block">
                {coverage.unresolvedCount} {coverage.currency} transaction
                {coverage.unresolvedCount === 1 ? "" : "s"} totaling{" "}
                {formatCurrency(coverage.unresolvedAmount, coverage.currency)}{" "}
                need review. {formatPercent(coverage.resolvedPercent)} of
                current-month magnitude is resolved.{" "}
                <Link
                  href="/transactions?view=inbox"
                  className="font-semibold underline"
                >
                  Open Transaction Inbox
                </Link>
              </span>
            ))}
        </Notice>
      ) : null}

      <section aria-labelledby="metrics-title" className="mt-8">
        <h2 id="metrics-title" className="sr-only">
          Dashboard metrics
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric) => (
            <MetricCard key={metric.label} {...metric} />
          ))}
        </div>
      </section>

      <OverviewPanels dashboard={dashboard} now={now} />
    </div>
  );
}
