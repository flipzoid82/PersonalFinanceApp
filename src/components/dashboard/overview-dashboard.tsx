import { AlertTriangle } from "lucide-react";
import { MetricCard } from "./metric-card";
import { OverviewPanels } from "./overview-panels";
import { Card } from "@/components/ui/card";
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
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-600">
            This owner has no normalized accounts, transactions, assets, or
            calendar records yet. Load the synthetic demo seed to preview the
            dashboard. Future milestones will add connection, import, and
            manual-entry workflows.
          </p>
          <p className="mt-5 rounded-lg bg-slate-100 px-4 py-3 font-mono text-sm">
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
    },
    {
      label: "Investments",
      value: formatCurrency(dashboard.metrics.investments),
      support: `${dashboard.investmentAccounts.length} investment account${dashboard.investmentAccounts.length === 1 ? "" : "s"}`,
      href: "/investments",
      order: "order-8 xl:order-4",
    },
    {
      label: "Income This Month",
      value: formatCurrency(dashboard.metrics.income),
      support: "Posted, explicitly classified income",
      href: "/transactions",
      order: "order-5",
    },
    {
      label: "Spending This Month",
      value: formatCurrency(dashboard.metrics.spending),
      support: "Posted expenses after refunds and exclusions",
      href: "/spending?view=expenses",
      order: "order-6",
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
        : undefined,
    },
    {
      label: "Upcoming Bills",
      value: formatCurrency(dashboard.upcomingTotal),
      support: dashboard.upcoming.length
        ? `${dashboard.upcoming.length} in 14 days · ${dashboard.upcomingConfirmedCount} confirmed, ${dashboard.upcomingPredictedCount} predicted`
        : "No expected outflows in the next 14 days",
      href: "/calendar?view=upcoming&days=14",
      order: "order-4 xl:order-8",
    },
  ];

  return (
    <div className="mx-auto max-w-7xl">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Overview</h1>
          <p className="mt-2 max-w-2xl text-slate-600">
            A read-only snapshot built from normalized synthetic financial
            records.
          </p>
        </div>
        <p className="text-sm text-slate-500">
          {dashboard.latestDataAt
            ? `${formatRelativeTime(dashboard.latestDataAt, now)} · ${formatDate(dashboard.latestDataAt)}`
            : "Latest update unavailable"}
        </p>
      </header>

      {dashboard.isPartial ? (
        <div
          role="status"
          className="mt-5 flex gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"
        >
          <AlertTriangle
            className="mt-0.5 size-5 shrink-0"
            aria-hidden="true"
          />
          <div>
            <p className="font-semibold">Partial totals</p>
            <p className="mt-1">{dashboard.partialReasons.join(" ")}</p>
          </div>
        </div>
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
