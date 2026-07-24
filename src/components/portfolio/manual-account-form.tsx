import { AccountType } from "@prisma/client";
import { createManualAccountAction } from "@/actions/portfolio";
import { Button } from "@/components/ui/button";
import {
  INVESTMENT_ACCOUNT_TYPES,
  MANUAL_ACCOUNT_OPTIONS,
  type InvestmentTemplate,
} from "@/lib/portfolio";
import type { PortfolioAccount } from "@/lib/portfolio";
import { inputClass } from "./form-controls";

export function ManualAccountForm({
  returnTo,
  investmentOnly = false,
  template,
  account,
}: {
  returnTo: "/accounts" | "/investments";
  investmentOnly?: boolean;
  template?: InvestmentTemplate | null;
  account?: PortfolioAccount;
}) {
  const options = MANUAL_ACCOUNT_OPTIONS.filter(
    ({ value }) => !investmentOnly || INVESTMENT_ACCOUNT_TYPES.has(value),
  );
  const defaultType =
    account?.accountType ??
    template?.accountType ??
    (investmentOnly ? AccountType.BROKERAGE : AccountType.CHECKING);
  return (
    <form
      key={account?.id ?? template?.id ?? "blank-manual-account"}
      action={createManualAccountAction}
      className="grid gap-4 sm:grid-cols-2"
    >
      <input type="hidden" name="returnTo" value={returnTo} />
      <label className="text-sm font-semibold">
        Account name
        <input
          className={inputClass}
          name="name"
          required
          maxLength={120}
          defaultValue={account?.name ?? template?.name ?? ""}
        />
      </label>
      <label className="text-sm font-semibold">
        Institution or source
        <input
          className={inputClass}
          name="institutionName"
          maxLength={120}
          defaultValue={
            account?.institutionName ?? template?.institutionName ?? ""
          }
        />
      </label>
      <label className="text-sm font-semibold">
        Account type
        <select
          className={inputClass}
          name="accountType"
          defaultValue={defaultType}
        >
          {options.map(({ value, label }) => (
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
          maxLength={120}
          placeholder={
            investmentOnly ? "Roth IRA, 403(b), HSA investment…" : "Optional"
          }
          defaultValue={
            account?.accountSubtype ?? template?.accountSubtype ?? ""
          }
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
          defaultValue={account?.currentBalance.toString() ?? ""}
        />
      </label>
      <label className="text-sm font-semibold">
        Currency
        <input
          className={inputClass}
          name="currency"
          required
          pattern="[A-Za-z]{3}"
          maxLength={3}
          defaultValue={account?.currency ?? "USD"}
        />
      </label>
      {!investmentOnly ? (
        <>
          <label className="text-sm font-semibold">
            Available balance (optional)
            <input
              className={inputClass}
              name="availableBalance"
              type="number"
              min="0"
              step="0.0001"
              defaultValue={account?.availableBalance?.toString() ?? ""}
            />
          </label>
          <label className="text-sm font-semibold">
            Credit limit (optional)
            <input
              className={inputClass}
              name="creditLimit"
              type="number"
              min="0"
              step="0.0001"
              defaultValue={account?.creditLimit?.toString() ?? ""}
            />
          </label>
        </>
      ) : (
        <>
          <input type="hidden" name="availableBalance" value="" />
          <input type="hidden" name="creditLimit" value="" />
        </>
      )}
      <label className="text-sm font-semibold sm:col-span-2">
        Notes (optional)
        <textarea
          className={`${inputClass} min-h-24 py-2`}
          name="notes"
          maxLength={1000}
          defaultValue={account?.notes ?? ""}
        />
      </label>
      <div className="sm:col-span-2">
        <Button type="submit">
          Create {investmentOnly ? "investment " : ""}account
        </Button>
      </div>
    </form>
  );
}
