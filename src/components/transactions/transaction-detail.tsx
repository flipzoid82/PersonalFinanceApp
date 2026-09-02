import {
  ClassificationRuleMatchType,
  ClassificationProvenance,
  EconomicDirection,
  FinancialRole,
  Prisma,
  TransactionCategoryKind,
  TransactionStatus,
  TransactionRelationshipState,
  TransactionRelationshipType,
} from "@prisma/client";
import Link from "next/link";
import {
  createClassificationRuleAction,
  createRefundRelationshipAction,
  deferTransactionReviewAction,
  replaceTransactionSplitAction,
  resolveLegacyRelationshipAction,
  setRelationshipStateAction,
  updateTransactionOverrideAction,
} from "@/actions/transactions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
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

type RefundCandidate = Awaited<
  ReturnType<
    typeof import("@/lib/transactions/queries").getRefundLinkCandidates
  >
>[number];

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
  refundCandidates = [],
  message,
  error,
}: {
  transaction: DetailModel;
  categories: Array<{
    id: string;
    name: string;
    kind: TransactionCategoryKind;
  }>;
  refundCandidates?: RefundCandidate[];
  message?: string;
  error?: string;
}) {
  const effectiveDate = transaction.postedAt ?? transaction.authorizedAt;
  const local = transaction.override;
  const categoryKind =
    transaction.effective.financialRole === FinancialRole.INCOME
      ? TransactionCategoryKind.INCOME
      : TransactionCategoryKind.EXPENSE;
  const splitCategories = categories.filter(
    ({ kind }) => kind === categoryKind,
  );
  const relationships = [
    ...(transaction.outgoingRelationships ?? []).map((relationship) => ({
      ...relationship,
      other: relationship.targetTransaction,
    })),
    ...(transaction.incomingRelationships ?? []).map((relationship) => ({
      ...relationship,
      other: relationship.sourceTransaction,
    })),
  ];
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
        <Notice tone="positive" role="status" className="mt-5">
          {message}
        </Notice>
      ) : null}
      {error ? (
        <Notice tone="negative" role="alert" className="mt-5">
          {error}
        </Notice>
      ) : null}
      {transaction.effective.needsReview ? (
        <Notice tone="warning" role="status" className="mt-5">
          <span className="font-semibold">This transaction needs review.</span>{" "}
          {(transaction.effective.reasonCodes ?? [])
            .map((reason) => titleCaseEnum(reason))
            .join(" · ")}
        </Notice>
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
            <DetailRow label="Account direction">
              {titleCaseEnum(
                transaction.effective.economicDirection ??
                  EconomicDirection.UNKNOWN,
              )}
            </DetailRow>
            <DetailRow label="Classification source">
              Role:{" "}
              {titleCaseEnum(
                transaction.effective.roleProvenance ??
                  ClassificationProvenance.UNRESOLVED,
              )}{" "}
              · category:{" "}
              {titleCaseEnum(
                transaction.effective.categoryProvenance ??
                  ClassificationProvenance.UNRESOLVED,
              )}
              {" · "}direction:{" "}
              {titleCaseEnum(
                transaction.effective.directionProvenance ??
                  ClassificationProvenance.UNRESOLVED,
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
          <input type="hidden" name="categoryOverride" value="" />
          <label htmlFor="transactionCategoryId">
            <span className="text-sm font-semibold">Transaction purpose</span>
            <select
              id="transactionCategoryId"
              aria-label="Transaction purpose category"
              name="transactionCategoryId"
              defaultValue={
                local?.transactionCategoryId ??
                transaction.effective.categoryId ??
                ""
              }
              className="mt-1 min-h-11 w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface-panel)] px-3"
            >
              <option value="">Needs category review</option>
              <optgroup label="Expense categories">
                {categories
                  .filter(
                    ({ kind }) => kind === TransactionCategoryKind.EXPENSE,
                  )
                  .map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
              </optgroup>
              <optgroup label="Income categories">
                {categories
                  .filter(({ kind }) => kind === TransactionCategoryKind.INCOME)
                  .map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
              </optgroup>
            </select>
            <span className="mt-1 block text-xs text-[var(--text-secondary)]">
              Categories describe actual transaction purpose. Saving and debt
              plans are not spending categories.
            </span>
          </label>
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
          <label htmlFor="economicDirectionOverride">
            <span className="text-sm font-semibold">
              Account-level direction
            </span>
            <select
              id="economicDirectionOverride"
              aria-label="Account-level economic direction"
              name="economicDirectionOverride"
              defaultValue={local?.economicDirectionOverride ?? ""}
              className="mt-1 min-h-11 w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface-panel)] px-3"
            >
              <option value="">Use source-adapted direction</option>
              {Object.values(EconomicDirection).map((direction) => (
                <option key={direction} value={direction}>
                  {titleCaseEnum(direction)}
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
      {transaction.effective.needsReview ? (
        <Card className="mt-6 p-5 sm:p-6">
          <h2 className="text-xl font-bold">Review attention</h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Defer this item without removing it from the ledger. It re-enters
            the Inbox automatically at the selected time.
          </p>
          <form
            action={deferTransactionReviewAction}
            className="mt-4 flex flex-wrap items-end gap-3"
          >
            <input type="hidden" name="transactionId" value={transaction.id} />
            <input
              type="hidden"
              name="returnTo"
              value={`/transactions/${transaction.id}`}
            />
            <label>
              <span className="text-sm font-semibold">Remind me in</span>
              <select
                name="days"
                className="mt-1 min-h-11 rounded-lg border border-[var(--border-default)] bg-[var(--surface-panel)] px-3"
              >
                <option value="1">1 day</option>
                <option value="7">7 days</option>
                <option value="30">30 days</option>
              </select>
            </label>
            <Button type="submit">Defer review</Button>
          </form>
        </Card>
      ) : null}

      {transaction.effective.financialRole === FinancialRole.EXPENSE ||
      transaction.effective.financialRole === FinancialRole.INCOME ? (
        <Card className="mt-6 p-5 sm:p-6">
          <h2 className="text-xl font-bold">Exact category split</h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Split magnitudes must be positive and total exactly{" "}
            {formatCurrency(transaction.amount.abs(), transaction.currency)}.
            Unsplit transactions use one synthetic effective allocation and do
            not store redundant rows.
          </p>
          <form
            action={replaceTransactionSplitAction}
            className="mt-5 grid gap-3"
          >
            <input type="hidden" name="transactionId" value={transaction.id} />
            <input
              type="hidden"
              name="returnTo"
              value={`/transactions/${transaction.id}`}
            />
            {[0, 1, 2].map((index) => {
              const allocation = (transaction.effective.allocations ?? [])[
                index
              ];
              return (
                <div
                  key={index}
                  className="grid gap-3 sm:grid-cols-[1fr_12rem]"
                >
                  <label>
                    <span className="sr-only">Split {index + 1} category</span>
                    <select
                      name="splitCategoryId"
                      aria-label={`Split ${index + 1} category`}
                      defaultValue={
                        allocation?.synthetic
                          ? ""
                          : (allocation?.categoryId ?? "")
                      }
                      required={index < 2}
                      className="min-h-11 w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface-panel)] px-3"
                    >
                      <option value="">
                        {index < 2 ? "Choose category" : "Optional third split"}
                      </option>
                      {splitCategories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span className="sr-only">Split {index + 1} amount</span>
                    <input
                      name="splitAmount"
                      aria-label={`Split ${index + 1} amount`}
                      inputMode="decimal"
                      pattern="\d{1,15}(\.\d{1,4})?"
                      defaultValue={
                        allocation && !allocation.synthetic
                          ? allocation.amount.toFixed(4)
                          : ""
                      }
                      required={index < 2}
                      className="min-h-11 w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface-panel)] px-3"
                    />
                  </label>
                </div>
              );
            })}
            <Button type="submit" className="justify-self-start">
              Save exact split
            </Button>
          </form>
        </Card>
      ) : null}

      <Card className="mt-6 p-5 sm:p-6">
        <h2 className="text-xl font-bold">Future similar activity</h2>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Create a bounded deterministic rule. New rules are future-only;
          historical application requires a separate preview and confirmation.
        </p>
        <form
          action={createClassificationRuleAction}
          className="mt-5 grid gap-4 sm:grid-cols-2"
        >
          <input type="hidden" name="transactionId" value={transaction.id} />
          <input
            type="hidden"
            name="returnTo"
            value={`/transactions/${transaction.id}`}
          />
          <input
            type="hidden"
            name="transactionCategoryId"
            value={transaction.effective.categoryId ?? ""}
          />
          <input
            type="hidden"
            name="financialRole"
            value={transaction.effective.financialRole ?? ""}
          />
          <input
            type="hidden"
            name="economicDirection"
            value={
              transaction.effective.economicDirection ??
              EconomicDirection.UNKNOWN
            }
          />
          <label>
            <span className="text-sm font-semibold">
              Match future transactions by
            </span>
            <select
              name="matchType"
              className="mt-1 min-h-11 w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface-panel)] px-3"
            >
              {Object.values(ClassificationRuleMatchType).map((matchType) => (
                <option key={matchType} value={matchType}>
                  {titleCaseEnum(matchType)}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit" className="self-end justify-self-start">
            Create future-only rule
          </Button>
        </form>
      </Card>

      {(transaction.effective.financialRole === FinancialRole.REFUND ||
        transaction.effective.economicDirection === EconomicDirection.INFLOW) &&
      refundCandidates.length ? (
        <Card className="mt-6 p-5 sm:p-6">
          <h2 className="text-xl font-bold">Link an expense refund</h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Confirm the original expense and exact applied magnitude. Source
            transactions stay unchanged, and the original purpose allocation is
            applied proportionally.
          </p>
          <form
            action={createRefundRelationshipAction}
            className="mt-5 grid gap-4 sm:grid-cols-2"
          >
            <input
              type="hidden"
              name="refundTransactionId"
              value={transaction.id}
            />
            <input
              type="hidden"
              name="returnTo"
              value={`/transactions/${transaction.id}`}
            />
            <label className="sm:col-span-2">
              <span className="text-sm font-semibold">Original expense</span>
              <select
                name="originalTransactionId"
                required
                className="mt-1 min-h-11 w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface-panel)] px-3"
              >
                <option value="">Choose an eligible expense</option>
                {refundCandidates.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.merchantName ?? candidate.originalName} ·{" "}
                    {formatCurrency(candidate.amount.abs(), candidate.currency)}
                    {candidate.postedAt
                      ? ` · ${formatDate(candidate.postedAt)}`
                      : ""}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="text-sm font-semibold">Relationship type</span>
              <select
                name="type"
                className="mt-1 min-h-11 w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface-panel)] px-3"
              >
                <option value={TransactionRelationshipType.REFUND}>
                  Refund
                </option>
                <option value={TransactionRelationshipType.REIMBURSEMENT}>
                  Reimbursement
                </option>
              </select>
            </label>
            <label>
              <span className="text-sm font-semibold">Applied amount</span>
              <input
                name="appliedAmount"
                required
                inputMode="decimal"
                pattern="\d{1,15}(\.\d{1,4})?"
                defaultValue={transaction.amount.abs().toFixed(4)}
                className="mt-1 min-h-11 w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface-panel)] px-3"
              />
            </label>
            <Button type="submit" className="justify-self-start sm:col-span-2">
              Link expense
            </Button>
          </form>
        </Card>
      ) : null}

      {relationships.length ? (
        <Card className="mt-6 p-5 sm:p-6">
          <h2 className="text-xl font-bold">Related movements and refunds</h2>
          <div className="mt-4 grid gap-4">
            {relationships.map((relationship) => (
              <div
                key={relationship.id}
                className="rounded-lg border border-[var(--border-default)] p-4"
              >
                <p className="font-semibold [overflow-wrap:anywhere]">
                  {relationship.type ===
                  TransactionRelationshipType.LEGACY_UNTYPED
                    ? "Legacy untyped link"
                    : titleCaseEnum(relationship.type)}{" "}
                  ·{" "}
                  {relationship.other.merchantName ??
                    relationship.other.originalName}
                </p>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                  {titleCaseEnum(relationship.state)} ·{" "}
                  {formatCurrency(
                    relationship.appliedAmount ??
                      relationship.other.amount.abs(),
                    relationship.other.currency,
                  )}{" "}
                  applied
                </p>
                {relationship.type ===
                  TransactionRelationshipType.LEGACY_UNTYPED &&
                relationship.state ===
                  TransactionRelationshipState.NEEDS_REVIEW ? (
                  <div className="mt-3">
                    <Notice tone="warning" title="Relationship type required">
                      This retained owner-local link has no established economic
                      type. Choose a supported type before confirming it. It has
                      no financial effect while unresolved.
                    </Notice>
                    <form
                      action={resolveLegacyRelationshipAction}
                      className="mt-3 grid gap-3 sm:grid-cols-2"
                    >
                      <input
                        type="hidden"
                        name="relationshipId"
                        value={relationship.id}
                      />
                      <input
                        type="hidden"
                        name="returnTo"
                        value={`/transactions/${transaction.id}`}
                      />
                      <label>
                        <span className="text-sm font-semibold">
                          Economic relationship type
                        </span>
                        <select
                          name="type"
                          required
                          defaultValue=""
                          className="mt-1 min-h-11 w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface-panel)] px-3"
                        >
                          <option value="" disabled>
                            Select a type
                          </option>
                          <option
                            value={
                              TransactionRelationshipType.INTERNAL_TRANSFER
                            }
                          >
                            Internal transfer
                          </option>
                          <option
                            value={
                              TransactionRelationshipType.CREDIT_CARD_PAYMENT
                            }
                          >
                            Credit-card payment
                          </option>
                          <option value={TransactionRelationshipType.REFUND}>
                            Refund
                          </option>
                          <option
                            value={TransactionRelationshipType.REIMBURSEMENT}
                          >
                            Reimbursement
                          </option>
                        </select>
                      </label>
                      <label>
                        <span className="text-sm font-semibold">
                          Applied amount
                        </span>
                        <input
                          name="appliedAmount"
                          required
                          inputMode="decimal"
                          pattern="\d{1,15}(\.\d{1,4})?"
                          defaultValue={Prisma.Decimal.min(
                            transaction.amount.abs(),
                            relationship.other.amount.abs(),
                          ).toFixed(4)}
                          aria-describedby={`legacy-amount-${relationship.id}`}
                          className="mt-1 min-h-11 w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface-panel)] px-3"
                        />
                        <span
                          id={`legacy-amount-${relationship.id}`}
                          className="mt-1 block text-xs text-[var(--text-secondary)]"
                        >
                          Used directly for refunds and reimbursements; movement
                          types require equal transaction amounts.
                        </span>
                      </label>
                      <div className="flex flex-wrap gap-2 sm:col-span-2">
                        <Button type="submit">Resolve and confirm</Button>
                      </div>
                    </form>
                    <form action={setRelationshipStateAction} className="mt-2">
                      <input
                        type="hidden"
                        name="relationshipId"
                        value={relationship.id}
                      />
                      <input
                        type="hidden"
                        name="returnTo"
                        value={`/transactions/${transaction.id}`}
                      />
                      <Button
                        type="submit"
                        name="state"
                        value={TransactionRelationshipState.REJECTED}
                        className="border border-[var(--border-default)] bg-transparent text-[var(--text-primary)] hover:bg-[var(--surface-subtle)]"
                      >
                        Reject legacy link
                      </Button>
                    </form>
                  </div>
                ) : relationship.state ===
                    TransactionRelationshipState.SUGGESTED ||
                  relationship.state ===
                    TransactionRelationshipState.NEEDS_REVIEW ? (
                  <form
                    action={setRelationshipStateAction}
                    className="mt-3 flex flex-wrap gap-2"
                  >
                    <input
                      type="hidden"
                      name="relationshipId"
                      value={relationship.id}
                    />
                    <input
                      type="hidden"
                      name="returnTo"
                      value={`/transactions/${transaction.id}`}
                    />
                    <Button
                      type="submit"
                      name="state"
                      value={TransactionRelationshipState.CONFIRMED}
                    >
                      Confirm relationship
                    </Button>
                    <Button
                      type="submit"
                      name="state"
                      value={TransactionRelationshipState.REJECTED}
                      className="border border-[var(--border-default)] bg-transparent text-[var(--text-primary)] hover:bg-[var(--surface-subtle)]"
                    >
                      Reject suggestion
                    </Button>
                  </form>
                ) : relationship.state ===
                  TransactionRelationshipState.CONFIRMED ? (
                  <form action={setRelationshipStateAction} className="mt-3">
                    <input
                      type="hidden"
                      name="relationshipId"
                      value={relationship.id}
                    />
                    <input
                      type="hidden"
                      name="returnTo"
                      value={`/transactions/${transaction.id}`}
                    />
                    <Button
                      type="submit"
                      name="state"
                      value={TransactionRelationshipState.REJECTED}
                      className="border border-[var(--border-default)] bg-transparent text-[var(--text-primary)] hover:bg-[var(--surface-subtle)]"
                    >
                      Unpair relationship
                    </Button>
                  </form>
                ) : null}
              </div>
            ))}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
