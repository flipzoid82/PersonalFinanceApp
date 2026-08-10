import {
  AccountSource,
  FinancialRole,
  TransactionStatus,
} from "@prisma/client";
import Link from "next/link";
import { ActiveTransactionSearch } from "@/components/transactions/active-transaction-search";
import { Card } from "@/components/ui/card";
import {
  SemanticBadge,
  SemanticValue,
  type SemanticTone,
} from "@/components/ui/semantic";
import { SortableHeader } from "@/components/ui/sortable-header";
import {
  formatCurrency,
  formatDate,
  titleCaseEnum,
} from "@/lib/dashboard/formatters";
import {
  transactionFilterQuery,
  transactionSortQuery,
  type TransactionFilters,
  type TransactionSortKey,
} from "@/lib/transactions/filters";
import { formatTransactionCategory } from "@/lib/transactions/presentation";

type LedgerModel = Awaited<
  ReturnType<typeof import("@/lib/transactions/queries").getTransactionLedger>
>;

function roleTone(role: FinancialRole | null): SemanticTone {
  switch (role) {
    case FinancialRole.INCOME:
    case FinancialRole.REFUND:
      return "positive";
    case FinancialRole.EXPENSE:
    case FinancialRole.DEBT_PAYMENT:
      return "negative";
    case FinancialRole.INVESTMENT_ACTIVITY:
      return "investment";
    case FinancialRole.TRANSFER:
    case FinancialRole.CREDIT_CARD_PAYMENT:
      return "info";
    default:
      return "muted";
  }
}

function sourceLabel(transaction: LedgerModel["transactions"][number]) {
  if (transaction.account.institutionConnection?.provider === "PLAID")
    return "Plaid Sandbox";
  return titleCaseEnum(transaction.account.source as AccountSource);
}

function roleExplanation(role: FinancialRole | null) {
  switch (role) {
    case FinancialRole.INCOME:
      return "Income · inflow";
    case FinancialRole.EXPENSE:
      return "Expense · outflow";
    case FinancialRole.REFUND:
      return "Refund · reduces spending";
    case FinancialRole.DEBT_PAYMENT:
      return "Debt payment · outflow";
    case FinancialRole.TRANSFER:
      return "Transfer · not income or spending";
    case FinancialRole.CREDIT_CARD_PAYMENT:
      return "Card payment · not spending";
    case FinancialRole.INVESTMENT_ACTIVITY:
      return "Investment activity · not income or spending";
    case FinancialRole.IGNORED:
      return "Ignored · not included in reports";
    default:
      return "Uncategorized · direction not classified";
  }
}

function pageHref(filters: TransactionFilters, page: number) {
  const query = transactionFilterQuery(filters);
  if (page > 1) query.set("page", String(page));
  const value = query.toString();
  return value ? `/transactions?${value}` : "/transactions";
}

function sortHref(filters: TransactionFilters, sort: TransactionSortKey) {
  return `/transactions?${transactionSortQuery(filters, sort).toString()}`;
}

function FilterForm({ ledger }: { ledger: LedgerModel }) {
  const { filters } = ledger;
  return (
    <Card className="mt-6 p-4 sm:p-5">
      <form method="get" className="grid gap-4 lg:grid-cols-6">
        <label className="lg:col-span-2">
          <span className="text-sm font-semibold">Merchant or description</span>
          <ActiveTransactionSearch initialValue={filters.search} />
        </label>
        <input type="hidden" name="sort" value={filters.sort} />
        <input type="hidden" name="direction" value={filters.direction} />
        <label>
          <span className="text-sm font-semibold">From date</span>
          <input
            name="dateFrom"
            type="date"
            defaultValue={filters.dateFrom}
            className="mt-1 min-h-11 w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface-panel)] px-3"
          />
        </label>
        <label>
          <span className="text-sm font-semibold">Through date</span>
          <input
            name="dateTo"
            type="date"
            defaultValue={filters.dateTo}
            className="mt-1 min-h-11 w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface-panel)] px-3"
          />
        </label>
        <label>
          <span className="text-sm font-semibold">Account</span>
          <select
            name="accountId"
            defaultValue={filters.accountId}
            className="mt-1 min-h-11 w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface-panel)] px-3"
          >
            <option value="">All accounts</option>
            {ledger.selectedAccountUnavailable ? (
              <option value={filters.accountId}>Unavailable account</option>
            ) : null}
            {ledger.accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
                {account.institutionName ? ` · ${account.institutionName}` : ""}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="text-sm font-semibold">Effective category</span>
          <select
            name="category"
            defaultValue={filters.category}
            className="mt-1 min-h-11 w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface-panel)] px-3"
          >
            <option value="">All categories</option>
            {ledger.categories.map((category) => (
              <option key={category} value={category}>
                {formatTransactionCategory(category)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="text-sm font-semibold">Minimum amount</span>
          <input
            name="amountMin"
            inputMode="decimal"
            defaultValue={filters.amountMin}
            pattern="\d{1,15}(\.\d{1,4})?"
            placeholder="0.00"
            className="mt-1 min-h-11 w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface-panel)] px-3"
          />
        </label>
        <label>
          <span className="text-sm font-semibold">Maximum amount</span>
          <input
            name="amountMax"
            inputMode="decimal"
            defaultValue={filters.amountMax}
            pattern="\d{1,15}(\.\d{1,4})?"
            placeholder="No maximum"
            className="mt-1 min-h-11 w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface-panel)] px-3"
          />
        </label>
        <label>
          <span className="text-sm font-semibold">Status</span>
          <select
            name="status"
            defaultValue={filters.status}
            className="mt-1 min-h-11 w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface-panel)] px-3"
          >
            <option value="">All statuses</option>
            {Object.values(TransactionStatus).map((status) => (
              <option key={status} value={status}>
                {titleCaseEnum(status)}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-wrap items-end gap-3 lg:col-span-3">
          <button className="min-h-11 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)] dark:bg-slate-100 dark:text-slate-950">
            Apply filters
          </button>
          <Link
            href="/transactions"
            className="inline-flex min-h-11 items-center rounded-lg border border-[var(--border-default)] px-4 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
          >
            Clear filters
          </Link>
        </div>
      </form>
      <p className="mt-3 text-xs text-[var(--text-secondary)]">
        Amount bounds use absolute transaction magnitude with exact decimal
        comparisons. Dates use UTC posting date, then authorization date.
      </p>
    </Card>
  );
}

function TransactionBadges({
  transaction,
}: {
  transaction: LedgerModel["transactions"][number];
}) {
  const removed = Boolean(transaction.removedAt);
  return (
    <div className="flex flex-wrap gap-2">
      <SemanticBadge
        tone={
          removed || transaction.status === TransactionStatus.CANCELED
            ? "muted"
            : transaction.status === TransactionStatus.PENDING
              ? "warning"
              : "positive"
        }
      >
        {removed ? "Removed by provider" : titleCaseEnum(transaction.status)}
      </SemanticBadge>
      <SemanticBadge tone={roleTone(transaction.effective.financialRole)}>
        {roleExplanation(transaction.effective.financialRole)}
      </SemanticBadge>
      {transaction.effective.hasLocalOverride ? (
        <SemanticBadge tone="info">Local override</SemanticBadge>
      ) : null}
      {transaction.effective.excludedFromReports ? (
        <SemanticBadge tone="muted">Excluded from reports</SemanticBadge>
      ) : null}
      {transaction.isHistorical ? (
        <SemanticBadge tone="muted">Historical account</SemanticBadge>
      ) : null}
    </div>
  );
}

function TransactionSummary({
  transaction,
}: {
  transaction: LedgerModel["transactions"][number];
}) {
  const date = transaction.postedAt ?? transaction.authorizedAt;
  return (
    <>
      <div className="min-w-0">
        <Link
          href={`/transactions/${transaction.id}`}
          className="font-semibold [overflow-wrap:anywhere] underline-offset-4 hover:underline focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
        >
          {transaction.effective.merchant}
        </Link>
        <p className="mt-1 text-sm [overflow-wrap:anywhere] text-[var(--text-secondary)]">
          {transaction.account.name} ·{" "}
          {formatTransactionCategory(transaction.effective.category)}
          {date ? ` · ${formatDate(date)}` : " · Date unavailable"}
        </p>
        <p className="mt-1 text-xs [overflow-wrap:anywhere] text-[var(--text-secondary)]">
          {sourceLabel(transaction)}
          {transaction.isHistorical
            ? " · Retained history; account is not currently connected"
            : ""}
        </p>
        <div className="mt-2">
          <TransactionBadges transaction={transaction} />
        </div>
      </div>
      <div className="shrink-0 sm:text-right">
        <p className="text-xs font-semibold tracking-wide text-[var(--text-secondary)] uppercase">
          Amount
        </p>
        <SemanticValue
          tone={roleTone(transaction.effective.financialRole)}
          label="Transaction amount magnitude"
        >
          {formatCurrency(transaction.amount.abs(), transaction.currency)}
        </SemanticValue>
      </div>
    </>
  );
}

export function TransactionLedger({ ledger }: { ledger: LedgerModel }) {
  const activeFilters = Object.entries(ledger.filters).some(
    ([key, value]) =>
      key !== "page" && key !== "sort" && key !== "direction" && Boolean(value),
  );
  return (
    <>
      <FilterForm ledger={ledger} />
      {ledger.selectedAccountUnavailable ? (
        <p
          role="alert"
          className="mt-4 text-sm text-[var(--semantic-warning-text)]"
        >
          The selected account is unavailable for this owner or is no longer a
          current account. Clear the account filter to continue.
        </p>
      ) : null}
      {!ledger.transactions.length ? (
        <Card className="mt-6 p-6">
          <p className="font-semibold">
            {activeFilters ? "No transactions match" : "No transactions yet"}
          </p>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            {activeFilters
              ? "Try removing one or more search or filter values."
              : "Connect a Plaid Sandbox institution or add imported activity when that workflow becomes available. Missing activity is never represented as zero."}
          </p>
          {activeFilters ? (
            <Link
              href="/transactions"
              className="mt-4 inline-flex min-h-11 items-center font-semibold underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
            >
              Clear all filters
            </Link>
          ) : null}
        </Card>
      ) : (
        <Card className="mt-6 overflow-hidden">
          <div className="border-b border-[var(--border-default)] px-4 py-3 text-sm text-[var(--text-secondary)] sm:px-5">
            Showing {(ledger.page - 1) * 50 + 1}–
            {Math.min(ledger.page * 50, ledger.total)} of {ledger.total}
          </div>
          <ul className="divide-y md:hidden" aria-label="Transactions">
            {ledger.transactions.map((transaction) => (
              <li key={transaction.id} className="grid gap-3 p-4">
                <TransactionSummary transaction={transaction} />
              </li>
            ))}
          </ul>
          <div className="hidden md:block">
            <table className="w-full table-fixed text-left text-sm">
              <caption className="sr-only">Owner transaction ledger</caption>
              <thead className="bg-[var(--surface-subtle)] text-[var(--text-secondary)]">
                <tr>
                  <SortableHeader
                    label="Date"
                    href={sortHref(ledger.filters, "date")}
                    active={ledger.filters.sort === "date"}
                    direction={ledger.filters.direction}
                    className="w-[13%] px-4 py-2"
                  />
                  <SortableHeader
                    label="Transaction"
                    href={sortHref(ledger.filters, "transaction")}
                    active={ledger.filters.sort === "transaction"}
                    direction={ledger.filters.direction}
                    className="w-[27%] px-4 py-2"
                  />
                  <th scope="col" className="w-1/4 px-4 py-3">
                    Status and role
                  </th>
                  <th scope="col" className="w-[17%] px-4 py-3">
                    Source
                  </th>
                  <SortableHeader
                    label="Amount"
                    href={sortHref(ledger.filters, "amount")}
                    active={ledger.filters.sort === "amount"}
                    direction={ledger.filters.direction}
                    align="right"
                    className="w-[18%] px-4 py-2 text-right"
                  />
                </tr>
              </thead>
              <tbody className="divide-y">
                {ledger.transactions.map((transaction) => {
                  const date = transaction.postedAt ?? transaction.authorizedAt;
                  return (
                    <tr key={transaction.id}>
                      <td className="px-4 py-4 align-top text-[var(--text-secondary)]">
                        {date ? formatDate(date) : "Unavailable"}
                      </td>
                      <td className="min-w-0 px-4 py-4 align-top">
                        <Link
                          href={`/transactions/${transaction.id}`}
                          className="font-semibold [overflow-wrap:anywhere] underline-offset-4 hover:underline focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
                        >
                          {transaction.effective.merchant}
                        </Link>
                        <p className="mt-1 [overflow-wrap:anywhere] text-[var(--text-secondary)]">
                          {transaction.account.name} ·{" "}
                          {formatTransactionCategory(
                            transaction.effective.category,
                          )}
                        </p>
                      </td>
                      <td className="min-w-0 px-4 py-4 align-top">
                        <TransactionBadges transaction={transaction} />
                      </td>
                      <td className="min-w-0 px-4 py-4 align-top [overflow-wrap:anywhere] text-[var(--text-secondary)]">
                        {sourceLabel(transaction)}
                        {transaction.isHistorical ? (
                          <span className="mt-1 block text-xs">
                            Retained historical activity
                          </span>
                        ) : null}
                      </td>
                      <td className="min-w-0 px-4 py-4 text-right align-top [overflow-wrap:anywhere]">
                        <span className="block text-xs text-[var(--text-secondary)] uppercase">
                          Amount
                        </span>
                        <SemanticValue
                          tone={roleTone(transaction.effective.financialRole)}
                          label="Transaction amount magnitude"
                        >
                          {formatCurrency(
                            transaction.amount.abs(),
                            transaction.currency,
                          )}
                        </SemanticValue>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      {ledger.pageCount > 1 ? (
        <nav
          aria-label="Transaction pages"
          className="mt-5 flex items-center justify-between gap-4"
        >
          {ledger.page > 1 ? (
            <Link
              href={pageHref(ledger.filters, ledger.page - 1)}
              className="inline-flex min-h-11 items-center rounded-lg border border-[var(--border-default)] px-4 font-semibold"
            >
              Previous
            </Link>
          ) : (
            <span />
          )}
          <span className="text-sm text-[var(--text-secondary)]">
            Page {ledger.page} of {ledger.pageCount}
          </span>
          {ledger.page < ledger.pageCount ? (
            <Link
              href={pageHref(ledger.filters, ledger.page + 1)}
              className="inline-flex min-h-11 items-center rounded-lg border border-[var(--border-default)] px-4 font-semibold"
            >
              Next
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </>
  );
}
