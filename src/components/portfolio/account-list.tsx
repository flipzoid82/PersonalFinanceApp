import {
  addBalanceSnapshotAction,
  deactivateManualAccountAction,
  deleteBalanceSnapshotAction,
  deleteManualAccountAction,
  updateManualAccountAction,
} from "@/actions/portfolio";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DeleteConfirmationDialog } from "@/components/ui/delete-confirmation-dialog";
import { HelpTooltip } from "@/components/ui/help-tooltip";
import { SemanticBadge, SemanticValue } from "@/components/ui/semantic";
import {
  formatCurrency,
  formatDate,
  formatRelativeTime,
  titleCaseEnum,
} from "@/lib/dashboard/formatters";
import {
  DEBT_ACCOUNT_TYPES,
  INVESTMENT_ACCOUNT_TYPES,
  MANUAL_ACCOUNT_OPTIONS,
  accountTypeLabel,
  freshnessState,
  latestAccountValue,
  type PortfolioAccount,
} from "@/lib/portfolio";
import { dateTimeInputValue, inputClass, panelClass } from "./form-controls";
import { PORTFOLIO_HELP } from "./help-copy";

function sourceTone(source: string) {
  return source === "MANUAL"
    ? ("muted" as const)
    : source === "IMPORTED"
      ? ("warning" as const)
      : ("info" as const);
}

export function AccountList({
  accounts,
  now,
  returnTo = "/accounts",
  investmentsOnly = false,
}: {
  accounts: PortfolioAccount[];
  now: Date;
  returnTo?: "/accounts" | "/investments";
  investmentsOnly?: boolean;
}) {
  const visible = accounts.filter(({ accountType }) =>
    investmentsOnly
      ? INVESTMENT_ACCOUNT_TYPES.has(accountType)
      : !INVESTMENT_ACCOUNT_TYPES.has(accountType),
  );
  if (!visible.length)
    return (
      <Card className="p-6">
        <p className="font-semibold">
          No {investmentsOnly ? "investment " : ""}accounts yet
        </p>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          Add a manual account below. Missing data is not displayed as zero.
        </p>
      </Card>
    );

  return (
    <ul className="space-y-4" aria-label="Financial accounts">
      {visible.map((account) => {
        const latest = latestAccountValue(account, now);
        const isDebt = DEBT_ACCOUNT_TYPES.has(account.accountType);
        const sourceLabel = titleCaseEnum(account.source);
        const freshness = latest.isAvailable
          ? freshnessState(latest.updatedAt, now)
          : "unavailable";
        return (
          <li key={account.id}>
            <Card className="p-5 sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold">{account.name}</h3>
                    <span className="inline-flex items-center gap-1">
                      <SemanticBadge tone={sourceTone(account.source)}>
                        {sourceLabel} source
                      </SemanticBadge>
                      {account.source === "MANUAL" ? (
                        <HelpTooltip label="Manual source">
                          {PORTFOLIO_HELP.manualSource}
                        </HelpTooltip>
                      ) : null}
                    </span>
                    <SemanticBadge
                      tone={
                        account.isActive
                          ? isDebt
                            ? "negative"
                            : investmentsOnly
                              ? "investment"
                              : "positive"
                          : "muted"
                      }
                    >
                      {account.isActive
                        ? isDebt
                          ? "Active debt"
                          : "Active asset"
                        : "Inactive"}
                    </SemanticBadge>
                    <span className="inline-flex items-center gap-1">
                      <SemanticBadge
                        tone={
                          freshness === "current"
                            ? "info"
                            : freshness === "stale"
                              ? "warning"
                              : "muted"
                        }
                      >
                        {freshness === "current"
                          ? "Current"
                          : freshness === "stale"
                            ? "Stale"
                            : "Update unavailable"}
                      </SemanticBadge>
                      <HelpTooltip label="Freshness status">
                        {PORTFOLIO_HELP.freshness}
                      </HelpTooltip>
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-[var(--text-secondary)]">
                    {account.institutionName ?? account.dataSource.displayName}{" "}
                    · {accountTypeLabel(account.accountType)}
                    {account.accountSubtype
                      ? ` · ${account.accountSubtype}`
                      : ""}
                  </p>
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">
                    {latest.source} ·{" "}
                    {formatRelativeTime(latest.updatedAt, now)}
                  </p>
                  {account.notes ? (
                    <p className="mt-2 text-sm">{account.notes}</p>
                  ) : null}
                </div>
                <div className="sm:text-right">
                  <p className="text-xl">
                    {latest.isAvailable ? (
                      <SemanticValue
                        tone={
                          account.isActive
                            ? isDebt
                              ? "negative"
                              : investmentsOnly
                                ? "investment"
                                : "positive"
                            : "muted"
                        }
                        label={isDebt ? "Amount owed" : "Current value"}
                      >
                        {isDebt ? "−" : "+"}
                        {formatCurrency(latest.value.abs(), account.currency)}
                      </SemanticValue>
                    ) : (
                      <SemanticValue tone="muted" label="Balance unavailable">
                        Unavailable
                      </SemanticValue>
                    )}
                  </p>
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">
                    {isDebt ? "Amount owed" : "Asset value"}
                  </p>
                </div>
              </div>

              {account.isManual ? (
                <details className="mt-5 rounded-lg border p-4">
                  <summary className="cursor-pointer font-semibold">
                    Edit and manage {account.name}
                  </summary>
                  <form
                    action={updateManualAccountAction}
                    className="mt-4 grid gap-4 sm:grid-cols-2"
                  >
                    <input type="hidden" name="accountId" value={account.id} />
                    <input type="hidden" name="returnTo" value={returnTo} />
                    <label className="text-sm font-semibold">
                      Account name
                      <input
                        className={inputClass}
                        name="name"
                        required
                        defaultValue={account.name}
                      />
                    </label>
                    <label className="text-sm font-semibold">
                      Institution or source
                      <input
                        className={inputClass}
                        name="institutionName"
                        defaultValue={account.institutionName ?? ""}
                      />
                    </label>
                    <label className="text-sm font-semibold">
                      Account type
                      <select
                        className={inputClass}
                        name="accountType"
                        defaultValue={account.accountType}
                      >
                        {MANUAL_ACCOUNT_OPTIONS.map(({ value, label }) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-sm font-semibold">
                      Account subtype
                      <input
                        className={inputClass}
                        name="accountSubtype"
                        defaultValue={account.accountSubtype ?? ""}
                      />
                    </label>
                    <label className="text-sm font-semibold">
                      Current balance
                      <input
                        className={inputClass}
                        name="currentBalance"
                        type="number"
                        min="0"
                        step="0.0001"
                        required
                        defaultValue={account.currentBalance.toString()}
                      />
                    </label>
                    <label className="text-sm font-semibold">
                      Currency
                      <input
                        className={inputClass}
                        name="currency"
                        pattern="[A-Za-z]{3}"
                        maxLength={3}
                        required
                        defaultValue={account.currency}
                      />
                    </label>
                    <label className="text-sm font-semibold">
                      Available balance
                      <input
                        className={inputClass}
                        name="availableBalance"
                        type="number"
                        min="0"
                        step="0.0001"
                        defaultValue={
                          account.availableBalance?.toString() ?? ""
                        }
                      />
                    </label>
                    <label className="text-sm font-semibold">
                      Credit limit
                      <input
                        className={inputClass}
                        name="creditLimit"
                        type="number"
                        min="0"
                        step="0.0001"
                        defaultValue={account.creditLimit?.toString() ?? ""}
                      />
                    </label>
                    <label className="text-sm font-semibold sm:col-span-2">
                      Notes
                      <textarea
                        className={`${inputClass} min-h-24 py-2`}
                        name="notes"
                        defaultValue={account.notes ?? ""}
                      />
                    </label>
                    <div className="sm:col-span-2">
                      <Button type="submit">Save account changes</Button>
                    </div>
                  </form>

                  {!investmentsOnly ? (
                    <form
                      action={addBalanceSnapshotAction}
                      className={`mt-5 grid gap-4 sm:grid-cols-3 ${panelClass}`}
                    >
                      <input
                        type="hidden"
                        name="accountId"
                        value={account.id}
                      />
                      <input type="hidden" name="returnTo" value={returnTo} />
                      <label className="text-sm font-semibold">
                        Snapshot balance
                        <input
                          className={inputClass}
                          name="currentBalance"
                          type="number"
                          min="0"
                          step="0.0001"
                          required
                        />
                      </label>
                      <label className="text-sm font-semibold">
                        Available balance
                        <input
                          className={inputClass}
                          name="availableBalance"
                          type="number"
                          min="0"
                          step="0.0001"
                        />
                      </label>
                      <label className="text-sm font-semibold">
                        As-of date and time
                        <input
                          className={inputClass}
                          name="capturedAt"
                          type="datetime-local"
                          required
                          defaultValue={dateTimeInputValue(now)}
                        />
                      </label>
                      <div className="sm:col-span-3">
                        <Button type="submit">Add balance snapshot</Button>
                      </div>
                    </form>
                  ) : null}

                  <div className="mt-5">
                    <DeleteConfirmationDialog
                      recordName={account.name}
                      recordType={
                        investmentsOnly
                          ? "investment account"
                          : isDebt
                            ? "debt account"
                            : "manual account"
                      }
                      triggerLabel={`Delete ${investmentsOnly ? "investment " : ""}account`}
                      deleteAction={deleteManualAccountAction}
                      deleteFields={[
                        { name: "accountId", value: account.id },
                        { name: "returnTo", value: returnTo },
                      ]}
                      deactivateAction={
                        account.isActive
                          ? deactivateManualAccountAction
                          : undefined
                      }
                      deactivateFields={[
                        { name: "accountId", value: account.id },
                        { name: "returnTo", value: returnTo },
                      ]}
                      dependencyWarning="If this account has transactions, recurring items, calendar events, holdings, investment history, or snapshots, deletion will be blocked. Deactivate it instead to preserve dependent records."
                    />
                  </div>
                </details>
              ) : null}

              {!investmentsOnly && account.balanceSnapshots.length ? (
                <details className="mt-4">
                  <summary className="cursor-pointer text-sm font-semibold">
                    Balance history ({account.balanceSnapshots.length})
                  </summary>
                  <ul className="mt-3 divide-y" aria-label="Balance history">
                    {account.balanceSnapshots.slice(0, 8).map((snapshot) => (
                      <li
                        key={snapshot.id}
                        className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"
                      >
                        <span>
                          {formatCurrency(
                            snapshot.currentBalance,
                            account.currency,
                          )}{" "}
                          · {formatDate(snapshot.capturedAt)}
                        </span>
                        {account.isManual ? (
                          <DeleteConfirmationDialog
                            recordName={`${account.name} balance snapshot from ${formatDate(snapshot.capturedAt)}`}
                            recordType="balance snapshot"
                            triggerLabel="Delete snapshot"
                            deleteAction={deleteBalanceSnapshotAction}
                            deleteFields={[
                              { name: "snapshotId", value: snapshot.id },
                              { name: "returnTo", value: returnTo },
                            ]}
                          />
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
