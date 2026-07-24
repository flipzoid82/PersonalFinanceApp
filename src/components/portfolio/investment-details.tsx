import Link from "next/link";
import {
  addInvestmentSnapshotAction,
  deleteInvestmentSnapshotAction,
  updateInvestmentSnapshotAction,
} from "@/actions/portfolio";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DeleteConfirmationDialog } from "@/components/ui/delete-confirmation-dialog";
import { SemanticBadge, SemanticValue } from "@/components/ui/semantic";
import {
  formatCurrency,
  formatDate,
  titleCaseEnum,
} from "@/lib/dashboard/formatters";
import { FIDELITY_TEMPLATES, type PortfolioAccount } from "@/lib/portfolio";
import { dateTimeInputValue, inputClass, panelClass } from "./form-controls";

export function FidelityTemplateLinks({ selected }: { selected?: string }) {
  return (
    <div>
      <p className="text-sm font-semibold">Known Fidelity templates</p>
      <p className="mt-1 text-sm text-[var(--text-secondary)]">
        Templates prefill editable metadata only. They never request
        credentials, log in, or start a sync.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {FIDELITY_TEMPLATES.map((template) => (
          <Link
            key={template.id}
            href={`/investments?template=${template.id}#add-investment`}
            aria-current={selected === template.id ? "true" : undefined}
            className="rounded-lg border border-[var(--semantic-investment-border)] bg-[var(--semantic-investment-bg)] px-3 py-2 text-sm font-semibold text-[var(--semantic-investment-text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
          >
            Use {template.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

export function InvestmentSnapshots({
  accounts,
  now,
}: {
  accounts: PortfolioAccount[];
  now: Date;
}) {
  const manualAccounts = accounts.filter(({ isManual }) => isManual);
  if (!accounts.length) return null;
  return (
    <section aria-labelledby="snapshot-title" className="mt-8">
      <h2 id="snapshot-title" className="text-xl font-bold">
        Investment balances and holdings
      </h2>
      <p className="mt-2 text-sm text-[var(--text-secondary)]">
        The latest account snapshot is authoritative. Holdings are detail only
        and are not added again.
      </p>
      <div className="mt-4 space-y-4">
        {accounts.map((account) => (
          <Card key={account.id} className="p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-bold">{account.name}</h3>
              <SemanticBadge tone="investment">
                Investment account
              </SemanticBadge>
            </div>
            {account.investmentSnapshots.length ? (
              <ol
                className="mt-4 divide-y"
                aria-label={`${account.name} balance history`}
              >
                {account.investmentSnapshots.slice(0, 8).map((snapshot) => (
                  <li key={snapshot.id} className="py-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <SemanticValue
                          tone="investment"
                          label="Investment value"
                        >
                          +
                          {formatCurrency(
                            snapshot.totalValue,
                            account.currency,
                          )}
                        </SemanticValue>
                        <p className="mt-1 text-xs text-[var(--text-secondary)]">
                          {titleCaseEnum(snapshot.source)} source · As of{" "}
                          {formatDate(snapshot.asOfDate)}
                          {snapshot.vestedValue
                            ? ` · ${formatCurrency(snapshot.vestedValue, account.currency)} vested`
                            : ""}
                        </p>
                        {snapshot.notes ? (
                          <p className="mt-2 text-sm">{snapshot.notes}</p>
                        ) : null}
                      </div>
                      {account.isManual && snapshot.source === "MANUAL" ? (
                        <details className="w-full sm:w-auto">
                          <summary className="cursor-pointer text-sm font-semibold">
                            Edit snapshot
                          </summary>
                          <form
                            action={updateInvestmentSnapshotAction}
                            className={`mt-3 grid gap-3 sm:min-w-96 ${panelClass}`}
                          >
                            <input
                              type="hidden"
                              name="snapshotId"
                              value={snapshot.id}
                            />
                            <input
                              type="hidden"
                              name="accountId"
                              value={account.id}
                            />
                            <input
                              type="hidden"
                              name="returnTo"
                              value="/investments"
                            />
                            <label className="text-sm font-semibold">
                              Total value
                              <input
                                className={inputClass}
                                name="totalValue"
                                type="number"
                                min="0"
                                step="0.0001"
                                required
                                defaultValue={snapshot.totalValue.toString()}
                              />
                            </label>
                            <label className="text-sm font-semibold">
                              Vested value
                              <input
                                className={inputClass}
                                name="vestedValue"
                                type="number"
                                min="0"
                                step="0.0001"
                                defaultValue={
                                  snapshot.vestedValue?.toString() ?? ""
                                }
                              />
                            </label>
                            <label className="text-sm font-semibold">
                              As-of date and time
                              <input
                                className={inputClass}
                                name="asOfDate"
                                type="datetime-local"
                                required
                                defaultValue={dateTimeInputValue(
                                  snapshot.asOfDate,
                                )}
                              />
                            </label>
                            <label className="text-sm font-semibold">
                              Notes
                              <textarea
                                className={`${inputClass} min-h-20 py-2`}
                                name="notes"
                                defaultValue={snapshot.notes ?? ""}
                              />
                            </label>
                            <div className="flex flex-wrap gap-2">
                              <Button type="submit">Save snapshot</Button>
                            </div>
                          </form>
                          <div className="mt-2">
                            <DeleteConfirmationDialog
                              recordName={`${account.name} investment snapshot from ${formatDate(snapshot.asOfDate)}`}
                              recordType="investment snapshot"
                              triggerLabel="Delete snapshot"
                              deleteAction={deleteInvestmentSnapshotAction}
                              deleteFields={[
                                { name: "snapshotId", value: snapshot.id },
                                {
                                  name: "returnTo",
                                  value: "/investments",
                                },
                              ]}
                            />
                          </div>
                        </details>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-4 text-sm text-[var(--text-secondary)]">
                No stored investment snapshots. The normalized account balance
                is used.
              </p>
            )}

            {account.investmentHoldings.length ? (
              <div className="mt-5 border-t pt-4">
                <h4 className="text-sm font-semibold">Available holdings</h4>
                <ul className="mt-2 divide-y" aria-label="Available holdings">
                  {account.investmentHoldings.map((holding) => (
                    <li
                      key={holding.id}
                      className="flex flex-wrap justify-between gap-3 py-3 text-sm"
                    >
                      <span>
                        {holding.securityName}
                        {holding.tickerSymbol
                          ? ` (${holding.tickerSymbol})`
                          : ""}
                        <span className="block text-xs text-[var(--text-secondary)]">
                          {titleCaseEnum(holding.source)} · As of{" "}
                          {formatDate(holding.asOfDate)}
                        </span>
                      </span>
                      <SemanticValue tone="investment" label="Holding value">
                        +
                        {formatCurrency(holding.currentValue, holding.currency)}
                      </SemanticValue>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </Card>
        ))}
      </div>

      {manualAccounts.length ? (
        <Card className="mt-4 p-5">
          <h3 className="font-bold">Add manual investment snapshot</h3>
          <form
            action={addInvestmentSnapshotAction}
            className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            <input type="hidden" name="returnTo" value="/investments" />
            <label className="text-sm font-semibold">
              Investment account
              <select className={inputClass} name="accountId">
                {manualAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-semibold">
              Total value
              <input
                className={inputClass}
                name="totalValue"
                type="number"
                min="0"
                step="0.0001"
                required
              />
            </label>
            <label className="text-sm font-semibold">
              Vested value (optional)
              <input
                className={inputClass}
                name="vestedValue"
                type="number"
                min="0"
                step="0.0001"
              />
            </label>
            <label className="text-sm font-semibold">
              As-of date and time
              <input
                className={inputClass}
                name="asOfDate"
                type="datetime-local"
                required
                defaultValue={dateTimeInputValue(now)}
              />
            </label>
            <label className="text-sm font-semibold sm:col-span-2">
              Notes
              <input className={inputClass} name="notes" maxLength={1000} />
            </label>
            <div className="sm:col-span-2 lg:col-span-3">
              <Button type="submit">Add investment snapshot</Button>
            </div>
          </form>
        </Card>
      ) : null}
    </section>
  );
}
