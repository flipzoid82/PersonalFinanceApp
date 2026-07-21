import {
  AccountSource,
  AccountType,
  CalendarEventStatus,
  Prisma,
  TransactionStatus,
} from "@prisma/client";
import { Card } from "@/components/ui/card";
import {
  formatCurrency,
  formatDate,
  formatRelativeTime,
  formatShortDate,
  titleCaseEnum,
} from "@/lib/dashboard/formatters";
import type { DashboardViewModel } from "@/lib/dashboard/types";
import { cn } from "@/lib/utils";

function PanelHeader({ title, detail }: { title: string; detail: string }) {
  return (
    <div>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-slate-500">{detail}</p>
    </div>
  );
}

function sourceLabel(source: AccountSource) {
  return source === AccountSource.SYNCED
    ? "Synced"
    : source === AccountSource.IMPORTED
      ? "Imported"
      : "Manual";
}

function accountFreshness(
  account: DashboardViewModel["accounts"][number],
  now: Date,
) {
  const date =
    account.source === AccountSource.SYNCED
      ? account.lastSyncedAt
      : account.source === AccountSource.IMPORTED
        ? account.lastImportedAt
        : account.updatedAt;
  return formatRelativeTime(date, now);
}

function AccountBalances({
  dashboard,
  now,
}: {
  dashboard: DashboardViewModel;
  now: Date;
}) {
  const debtTypes = new Set<AccountType>([
    AccountType.CREDIT_CARD,
    AccountType.LOAN,
    AccountType.MORTGAGE,
    AccountType.MANUAL_DEBT,
  ]);
  return (
    <Card className="p-5 sm:p-6">
      <PanelHeader
        title="Account Balances"
        detail="Active normalized accounts; liabilities are labeled as amounts owed."
      />
      <ul
        className="mt-5 divide-y divide-slate-200"
        aria-label="Active account balances"
      >
        {dashboard.accounts.map((account) => {
          const isDebt = debtTypes.has(account.accountType);
          return (
            <li
              key={account.id}
              className="grid gap-2 py-4 sm:grid-cols-[1fr_auto] sm:gap-4"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate font-medium">{account.name}</p>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                    {sourceLabel(account.source)}
                  </span>
                  <span className="text-xs text-slate-500">
                    {isDebt ? "Debt" : "Asset"}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  {account.institutionName ?? account.dataSource.displayName} ·{" "}
                  {titleCaseEnum(account.accountType)}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {accountFreshness(account, now)}
                </p>
              </div>
              <div className="sm:text-right">
                <p className="font-semibold">
                  {formatCurrency(
                    account.currentBalance.abs(),
                    account.currency,
                  )}
                  {isDebt ? " owed" : ""}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {account.availableBalance
                    ? `${formatCurrency(account.availableBalance, account.currency)} available`
                    : account.creditLimit
                      ? `${formatCurrency(account.creditLimit, account.currency)} limit`
                      : "Secondary balance unavailable"}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function RecentTransactions({ dashboard }: { dashboard: DashboardViewModel }) {
  return (
    <Card className="p-5 sm:p-6">
      <PanelHeader
        title="Recent Transactions"
        detail="Posted and pending activity from the last 30 days."
      />
      {dashboard.recentTransactions.length ? (
        <ul
          className="mt-5 divide-y divide-slate-200"
          aria-label="Recent transactions"
        >
          {dashboard.recentTransactions.map((transaction) => (
            <li
              key={transaction.id}
              className="grid gap-2 py-4 sm:grid-cols-[1fr_auto] sm:gap-4"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate font-medium">{transaction.name}</p>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-semibold",
                      transaction.status === TransactionStatus.PENDING
                        ? "bg-amber-100 text-amber-900"
                        : "bg-emerald-100 text-emerald-900",
                    )}
                  >
                    {titleCaseEnum(transaction.status)}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  {transaction.accountName} · {transaction.category}
                  {transaction.role
                    ? ` · ${titleCaseEnum(transaction.role)}`
                    : ""}
                </p>
              </div>
              <div className="sm:text-right">
                <p className="font-semibold">
                  {formatCurrency(
                    transaction.amount.abs(),
                    transaction.currency,
                  )}
                </p>
                <time
                  className="text-xs text-slate-500"
                  dateTime={transaction.date.toISOString()}
                >
                  {formatDate(transaction.date)}
                </time>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-6 text-sm text-slate-500">
          No activity in the last 30 days.
        </p>
      )}
    </Card>
  );
}

function SpendingCategories({ dashboard }: { dashboard: DashboardViewModel }) {
  const maximum =
    dashboard.spendingCategories[0]?.amount.abs() ?? new Prisma.Decimal(0);
  return (
    <Card className="p-5 sm:p-6">
      <PanelHeader
        title="Spending by Category"
        detail="Posted expenses this month after overrides, refunds, and exclusions."
      />
      {dashboard.spendingCategories.length ? (
        <ol className="mt-6 space-y-5" aria-label="Monthly spending categories">
          {dashboard.spendingCategories.map(({ category, amount }) => {
            const width = maximum.isZero()
              ? 0
              : amount.abs().dividedBy(maximum).times(100).toNumber();
            return (
              <li key={category}>
                <div className="flex items-center justify-between gap-4 text-sm">
                  <span className="font-medium">{category}</span>
                  <span>{formatCurrency(amount)}</span>
                </div>
                <div
                  className="mt-2 h-3 overflow-hidden rounded-full bg-slate-100"
                  aria-hidden="true"
                >
                  <div
                    className={cn(
                      "h-full rounded-full",
                      amount.isNegative() ? "bg-emerald-600" : "bg-sky-600",
                    )}
                    style={{ width: `${Math.max(width, 3)}%` }}
                  />
                </div>
                <span className="sr-only">
                  {amount.isNegative() ? "Net refund" : "Spending"}:{" "}
                  {formatCurrency(amount)}
                </span>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="mt-6 text-sm text-slate-500">
          No posted spending this month.
        </p>
      )}
    </Card>
  );
}

function UpcomingActivity({ dashboard }: { dashboard: DashboardViewModel }) {
  return (
    <Card className="p-5 sm:p-6">
      <PanelHeader
        title="Upcoming Activity"
        detail="Existing expected outflows from today through the next 14 days."
      />
      {dashboard.upcoming.length ? (
        <ul
          className="mt-5 divide-y divide-slate-200"
          aria-label="Upcoming bills and activity"
        >
          {dashboard.upcoming.map((event) => (
            <li
              key={event.id}
              className="grid gap-2 py-4 sm:grid-cols-[1fr_auto] sm:gap-4"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{event.title}</p>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-semibold",
                      event.dateLabel === "Confirmed"
                        ? "bg-emerald-100 text-emerald-900"
                        : "bg-indigo-100 text-indigo-900",
                    )}
                  >
                    {event.dateLabel}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  {event.accountName ?? "Account unavailable"} ·{" "}
                  {event.amountLabel} · {titleCaseEnum(event.confidence)}{" "}
                  confidence
                </p>
                {event.dateLabel === "Confirmed" &&
                event.predictedPostingDate ? (
                  <p className="mt-1 text-xs text-slate-500">
                    Predicted posting{" "}
                    {formatShortDate(event.predictedPostingDate)}
                  </p>
                ) : null}
              </div>
              <div className="sm:text-right">
                <p className="font-semibold">
                  {formatCurrency(event.amount, event.currency)}
                </p>
                <time
                  className="text-xs text-slate-500"
                  dateTime={event.date.toISOString()}
                >
                  {event.dateLabel} date {formatShortDate(event.date)}
                </time>
                <p className="text-xs text-slate-500">
                  {titleCaseEnum(event.status)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-6 text-sm text-slate-500">
          No expected outflows in the next 14 days.
        </p>
      )}
    </Card>
  );
}

function InvestmentSummary({ dashboard }: { dashboard: DashboardViewModel }) {
  return (
    <Card className="p-5 sm:p-6">
      <PanelHeader
        title="Investment Summary"
        detail="Latest snapshot per account, falling back to its current normalized balance."
      />
      <p className="mt-5 text-3xl font-bold">
        {formatCurrency(dashboard.metrics.investments)}
      </p>
      {dashboard.investmentAccounts.length ? (
        <ul
          className="mt-4 divide-y divide-slate-200"
          aria-label="Investment accounts"
        >
          {dashboard.investmentAccounts.map((account) => (
            <li
              key={account.id}
              className="flex items-start justify-between gap-4 py-4"
            >
              <div>
                <p className="font-medium">{account.name}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {sourceLabel(account.source)} · {account.valueSource} · As of{" "}
                  {formatDate(account.asOfDate)}
                </p>
              </div>
              <p className="shrink-0 font-semibold">
                {formatCurrency(account.value, account.currency)}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-slate-500">
          Investment values unavailable.
        </p>
      )}
    </Card>
  );
}

function NetWorthTrend({ dashboard }: { dashboard: DashboardViewModel }) {
  const values = dashboard.netWorthTrend.map(({ value }) => value);
  const minimum = values.reduce(
    (min, value) => (value.lessThan(min) ? value : min),
    values[0] ?? new Prisma.Decimal(0),
  );
  const maximum = values.reduce(
    (max, value) => (value.greaterThan(max) ? value : max),
    values[0] ?? new Prisma.Decimal(0),
  );
  const range = maximum.minus(minimum);
  return (
    <Card className="p-5 sm:p-6">
      <PanelHeader
        title="Net Worth Trend"
        detail={
          dashboard.trendIsPartial
            ? "Partial 30-day trend from stored account and investment snapshots; manual asset history is unavailable."
            : "Last 30 days from stored balance and investment snapshots."
        }
      />
      {dashboard.netWorthTrend.length >= 2 ? (
        <>
          <div
            className="mt-7 flex h-44 items-end gap-2 border-b border-slate-300 px-1"
            role="img"
            aria-label={`Tracked net worth changed from ${formatCurrency(dashboard.netWorthTrend[0].value)} to ${formatCurrency(dashboard.netWorthTrend.at(-1)!.value)} over ${dashboard.netWorthTrend.length} stored dates.`}
          >
            {dashboard.netWorthTrend.map((point) => {
              const relative = range.isZero()
                ? new Prisma.Decimal(50)
                : point.value
                    .minus(minimum)
                    .dividedBy(range)
                    .times(70)
                    .plus(25);
              return (
                <div
                  key={point.date.toISOString()}
                  className="flex min-w-0 flex-1 flex-col items-center"
                >
                  <div
                    className="w-full max-w-12 rounded-t bg-slate-800"
                    style={{ height: `${relative.toNumber()}%` }}
                    aria-hidden="true"
                  />
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex justify-between text-xs text-slate-500">
            <span>{formatShortDate(dashboard.netWorthTrend[0].date)}</span>
            <span>{formatShortDate(dashboard.netWorthTrend.at(-1)!.date)}</span>
          </div>
          <table className="sr-only">
            <caption>Stored net-worth trend values</caption>
            <thead>
              <tr>
                <th>Date</th>
                <th>Tracked net worth</th>
              </tr>
            </thead>
            <tbody>
              {dashboard.netWorthTrend.map((point) => (
                <tr key={point.date.toISOString()}>
                  <td>{formatDate(point.date)}</td>
                  <td>{formatCurrency(point.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : (
        <p className="mt-6 text-sm text-slate-500">
          Trend unavailable — at least two stored snapshot dates are required.
        </p>
      )}
    </Card>
  );
}

function DataFreshness({
  dashboard,
  now,
}: {
  dashboard: DashboardViewModel;
  now: Date;
}) {
  return (
    <Card className="p-5 sm:p-6">
      <PanelHeader
        title="Data Freshness and Connection Status"
        detail="Provider-neutral source health. Synthetic records are not live connections."
      />
      <ul
        className="mt-5 divide-y divide-slate-200"
        aria-label="Data source health"
      >
        {dashboard.sourceHealth.map((source) => (
          <li key={source.id} className="py-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium">{source.name}</p>
              <div className="flex gap-2 text-xs font-semibold">
                <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">
                  {source.sourceLabel}
                </span>
                <span
                  className={cn(
                    "rounded-full px-2 py-1",
                    source.statusLabel === "Current"
                      ? "bg-emerald-100 text-emerald-900"
                      : source.statusLabel === "Stale"
                        ? "bg-amber-100 text-amber-900"
                        : "bg-rose-100 text-rose-900",
                  )}
                >
                  {source.statusLabel}
                </span>
              </div>
            </div>
            <p className="mt-2 text-sm text-slate-600">{source.detail}</p>
            <p className="mt-1 text-xs text-slate-500">
              {formatRelativeTime(source.updatedAt, now)}
            </p>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function OverviewPanels({
  dashboard,
  now,
}: {
  dashboard: DashboardViewModel;
  now: Date;
}) {
  return (
    <section aria-labelledby="details-title" className="mt-6">
      <h2 id="details-title" className="sr-only">
        Dashboard details
      </h2>
      <div className="grid items-start gap-4 xl:grid-cols-2">
        <NetWorthTrend dashboard={dashboard} />
        <AccountBalances dashboard={dashboard} now={now} />
        <RecentTransactions dashboard={dashboard} />
        <SpendingCategories dashboard={dashboard} />
        <UpcomingActivity dashboard={dashboard} />
        <InvestmentSummary dashboard={dashboard} />
        <div className="xl:col-span-2">
          <DataFreshness dashboard={dashboard} now={now} />
        </div>
      </div>
    </section>
  );
}
