import { FinancialRole, TransactionStatus } from "@prisma/client";
import Link from "next/link";
import { updateTransactionOverrideAction } from "@/actions/transactions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SemanticBadge, SemanticValue } from "@/components/ui/semantic";
import {
  formatCurrency,
  formatDate,
  titleCaseEnum,
} from "@/lib/dashboard/formatters";
import { formatTransactionCategory } from "@/lib/transactions/presentation";

type DetailModel = NonNullable<
  Awaited<
    ReturnType<typeof import("@/lib/transactions/queries").getTransactionDetail>
  >
>;

function financialTone(role: FinancialRole | null) {
  switch (role) {
    case FinancialRole.INCOME:
    case FinancialRole.REFUND:
      return "positive" as const;
    case FinancialRole.EXPENSE:
    case FinancialRole.DEBT_PAYMENT:
      return "negative" as const;
    case FinancialRole.INVESTMENT_ACTIVITY:
      return "investment" as const;
    case FinancialRole.TRANSFER:
    case FinancialRole.CREDIT_CARD_PAYMENT:
      return "info" as const;
    default:
      return "muted" as const;
  }
}

function sourceName(transaction: DetailModel) {
  if (transaction.account.institutionConnection?.provider === "PLAID")
    return "Plaid Sandbox";
  return titleCaseEnum(transaction.account.source);
}

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-[var(--border-default)] py-3 last:border-0 sm:grid sm:grid-cols-[12rem_1fr] sm:gap-4">
      <dt className="text-sm font-semibold text-[var(--text-secondary)]">
        {label}
      </dt>
      <dd className="mt-1 min-w-0 [overflow-wrap:anywhere] sm:mt-0">
        {children}
      </dd>
    </div>
  );
}

export function TransactionDetail({
  transaction,
  categories,
  message,
  error,
}: {
  transaction: DetailModel;
  categories: string[];
  message?: string;
  error?: string;
}) {
  const effectiveDate = transaction.postedAt ?? transaction.authorizedAt;
  const local = transaction.override;
  return (
    <div className="mx-auto max-w-5xl">
      <Link
        href="/transactions"
        className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4 focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
      >
        Back to transactions
      </Link>
      <p className="mt-4 text-sm font-semibold text-[var(--semantic-info-text)]">
        Transaction detail
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight break-words">
        {transaction.effective.merchant}
      </h1>
      <div className="mt-3 flex flex-wrap gap-2">
        <SemanticBadge
          tone={
            transaction.status === TransactionStatus.PENDING
              ? "warning"
              : transaction.status === TransactionStatus.POSTED
                ? "positive"
                : "muted"
          }
        >
          {transaction.removedAt
            ? "Removed by provider"
            : titleCaseEnum(transaction.status)}
        </SemanticBadge>
        <SemanticBadge tone="info">
          {titleCaseEnum(
            transaction.effective.financialRole ?? FinancialRole.UNCATEGORIZED,
          )}
        </SemanticBadge>
        {transaction.effective.excludedFromReports ? (
          <SemanticBadge tone="muted">Excluded from reports</SemanticBadge>
        ) : null}
      </div>

      {message ? (
        <p
          role="status"
          className="mt-5 rounded-lg border border-[var(--semantic-positive-border)] bg-[var(--semantic-positive-bg)] p-3 text-[var(--semantic-positive-text)]"
        >
          {message}
        </p>
      ) : null}
      {error ? (
        <p
          role="alert"
          className="mt-5 rounded-lg border border-[var(--semantic-negative-border)] bg-[var(--semantic-negative-bg)] p-3 text-[var(--semantic-negative-text)]"
        >
          {error}
        </p>
      ) : null}

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="min-w-0 p-5 sm:p-6">
          <h2 className="text-xl font-bold">Effective transaction</h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Local corrections take precedence where shown.
          </p>
          <dl className="mt-4">
            <DetailRow label="Display name">
              {transaction.effective.merchant}
            </DetailRow>
            <DetailRow label="Effective category">
              {formatTransactionCategory(transaction.effective.category)}
            </DetailRow>
            <DetailRow label="Financial role">
              {titleCaseEnum(
                transaction.effective.financialRole ??
                  FinancialRole.UNCATEGORIZED,
              )}
            </DetailRow>
            <DetailRow label="Amount">
              <SemanticValue
                tone={financialTone(transaction.effective.financialRole)}
                label="Transaction amount magnitude"
              >
                {formatCurrency(transaction.amount.abs(), transaction.currency)}
              </SemanticValue>
            </DetailRow>
            <DetailRow label="Effective date">
              {effectiveDate ? formatDate(effectiveDate) : "Unavailable"}
            </DetailRow>
            <DetailRow label="Notes">
              {transaction.effective.notes ?? "No local notes"}
            </DetailRow>
            <DetailRow label="Reporting">
              {transaction.effective.excludedFromReports
                ? "Excluded from calculations that honor report exclusion"
                : "Included where current reporting rules apply"}
            </DetailRow>
          </dl>
        </Card>

        <Card className="min-w-0 p-5 sm:p-6">
          <h2 className="text-xl font-bold">Source values</h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Read-only values retained from the source; raw provider payloads are
            not shown.
          </p>
          <dl className="mt-4">
            <DetailRow label="Original description">
              {transaction.originalName}
            </DetailRow>
            <DetailRow label="Provider merchant">
              {transaction.merchantName ?? "Not provided"}
            </DetailRow>
            <DetailRow label="Provider category">
              {transaction.providerCategory ?? "Not provided"}
            </DetailRow>
            <DetailRow label="Account">{transaction.account.name}</DetailRow>
            <DetailRow label="Source">{sourceName(transaction)}</DetailRow>
            <DetailRow label="Source detail">
              {transaction.account.institutionName ??
                transaction.account.dataSource.displayName}{" "}
              · {titleCaseEnum(transaction.account.dataSource.status)}
              {transaction.account.institutionConnection
                ? ` · ${titleCaseEnum(
                    transaction.account.institutionConnection.status,
                  )}`
                : ""}
            </DetailRow>
            <DetailRow label="Authorized date">
              {transaction.authorizedAt
                ? formatDate(transaction.authorizedAt)
                : "Not provided"}
            </DetailRow>
            <DetailRow label="Posted date">
              {transaction.postedAt
                ? formatDate(transaction.postedAt)
                : "Not posted"}
            </DetailRow>
            <DetailRow label="Currency">{transaction.currency}</DetailRow>
          </dl>
        </Card>
      </div>

      {transaction.pendingTransaction ||
      transaction.postedTransactions.length ? (
        <Card className="mt-6 p-5 sm:p-6">
          <h2 className="text-xl font-bold">Pending and posted history</h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Provider reconciliation is retained without duplicating finalized
            activity.
          </p>
          {transaction.pendingTransaction ? (
            <p className="mt-4">
              Pending predecessor:{" "}
              {transaction.pendingTransaction.merchantName ??
                transaction.pendingTransaction.originalName}
              {transaction.pendingTransaction.authorizedAt
                ? `, authorized ${formatDate(
                    transaction.pendingTransaction.authorizedAt,
                  )}`
                : ""}
            </p>
          ) : null}
          {transaction.postedTransactions.map((posted, index) => (
            <p key={`${posted.originalName}-${index}`} className="mt-3">
              Posted replacement: {posted.merchantName ?? posted.originalName}
              {posted.postedAt ? `, posted ${formatDate(posted.postedAt)}` : ""}
            </p>
          ))}
        </Card>
      ) : null}

      <Card className="mt-6 p-5 sm:p-6">
        <h2 className="text-xl font-bold">Local corrections</h2>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          These owner-only values do not rewrite institution data. Clearing
          restores source-derived values.
        </p>
        <form
          action={updateTransactionOverrideAction}
          className="mt-5 grid gap-5"
        >
          <input type="hidden" name="transactionId" value={transaction.id} />
          <input
            type="hidden"
            name="returnTo"
            value={`/transactions/${transaction.id}`}
          />
          <label htmlFor="categoryOverride">
            <span className="text-sm font-semibold">Category override</span>
            <input
              id="categoryOverride"
              aria-label="Category override"
              name="categoryOverride"
              list="transaction-category-options"
              defaultValue={local?.categoryOverride ?? ""}
              maxLength={120}
              placeholder={
                transaction.providerCategory ?? "Enter a local category"
              }
              className="mt-1 min-h-11 w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface-panel)] px-3"
            />
            <span className="mt-1 block text-xs text-[var(--text-secondary)]">
              Leave blank to use the provider category or Uncategorized.
            </span>
          </label>
          <datalist id="transaction-category-options">
            {categories.map((category) => (
              <option key={category} value={category} />
            ))}
          </datalist>
          <label htmlFor="financialRoleOverride">
            <span className="text-sm font-semibold">
              Financial role override
            </span>
            <select
              id="financialRoleOverride"
              aria-label="Financial role override"
              name="financialRoleOverride"
              defaultValue={local?.financialRoleOverride ?? ""}
              className="mt-1 min-h-11 w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface-panel)] px-3"
            >
              <option value="">Use current classification</option>
              {Object.values(FinancialRole).map((role) => (
                <option key={role} value={role}>
                  {titleCaseEnum(role)}
                </option>
              ))}
            </select>
          </label>
          <label htmlFor="transactionNotes">
            <span className="text-sm font-semibold">Owner notes</span>
            <textarea
              id="transactionNotes"
              aria-label="Owner notes"
              name="notes"
              defaultValue={local?.notes ?? ""}
              maxLength={1000}
              rows={4}
              className="mt-1 w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface-panel)] p-3"
            />
            <span className="mt-1 block text-xs text-[var(--text-secondary)]">
              Maximum 1,000 characters.
            </span>
          </label>
          <label
            htmlFor="excludedFromReports"
            className="flex min-h-11 items-start gap-3"
          >
            <input
              id="excludedFromReports"
              aria-label="Exclude from reports"
              type="checkbox"
              name="excludedFromReports"
              value="true"
              defaultChecked={local?.excludedFromReports ?? false}
              className="mt-1 size-5"
            />
            <span>
              <span className="font-semibold">Exclude from reports</span>
              <span className="block text-sm text-[var(--text-secondary)]">
                The transaction stays visible. Only existing calculations that
                honor this setting exclude it.
              </span>
            </span>
          </label>
          <div className="flex flex-wrap gap-3">
            <Button type="submit" name="intent" value="save">
              Save local corrections
            </Button>
            <Button
              type="submit"
              name="intent"
              value="clear"
              formNoValidate
              className="border border-[var(--border-default)] bg-transparent text-[var(--text-primary)] hover:bg-[var(--surface-subtle)] dark:bg-transparent dark:text-[var(--text-primary)]"
            >
              Clear editable overrides
            </Button>
          </div>
        </form>
        {local?.merchantNameOverride || local?.linkedTransactionId ? (
          <p className="mt-5 rounded-lg bg-[var(--surface-subtle)] p-3 text-sm text-[var(--text-secondary)]">
            Other retained local metadata exists for this transaction and is
            preserved by this form.
          </p>
        ) : null}
      </Card>
    </div>
  );
}
