import {
  createManualAssetAction,
  deactivateManualAssetAction,
  deleteManualAssetAction,
  updateManualAssetAction,
} from "@/actions/portfolio";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DeleteConfirmationDialog } from "@/components/ui/delete-confirmation-dialog";
import { HelpTooltip } from "@/components/ui/help-tooltip";
import { SemanticBadge, SemanticValue } from "@/components/ui/semantic";
import {
  formatCurrency,
  formatRelativeTime,
  titleCaseEnum,
} from "@/lib/dashboard/formatters";
import {
  MANUAL_ASSET_OPTIONS,
  freshnessState,
  type PortfolioManualAsset,
} from "@/lib/portfolio";
import { dateInputValue, inputClass } from "./form-controls";
import { PORTFOLIO_HELP } from "./help-copy";

function AssetFields({ asset }: { asset?: PortfolioManualAsset }) {
  const fieldKey = asset?.id ?? "new";

  return (
    <>
      <label className="text-sm font-semibold">
        Name
        <input
          className={inputClass}
          name="name"
          required
          maxLength={120}
          defaultValue={asset?.name ?? ""}
        />
      </label>
      <div className="text-sm font-semibold">
        <div className="flex items-center gap-1">
          <label htmlFor={`asset-type-${fieldKey}`}>Asset or debt type</label>
          <HelpTooltip label="Asset or debt type">
            {PORTFOLIO_HELP.assetType}
          </HelpTooltip>
        </div>
        <select
          id={`asset-type-${fieldKey}`}
          className={inputClass}
          name="assetType"
          defaultValue={asset?.assetType}
        >
          {MANUAL_ASSET_OPTIONS.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <div className="text-sm font-semibold">
        <div className="flex items-center gap-1">
          <label htmlFor={`current-value-${fieldKey}`}>
            Current value or amount owed
          </label>
          <HelpTooltip label="Current value or amount owed">
            {PORTFOLIO_HELP.currentValue}
          </HelpTooltip>
        </div>
        <input
          id={`current-value-${fieldKey}`}
          className={inputClass}
          name="currentValue"
          type="number"
          min="0"
          step="0.0001"
          required
          defaultValue={asset?.currentValue.toString() ?? ""}
        />
      </div>
      <div className="text-sm font-semibold">
        <div className="flex items-center gap-1">
          <label htmlFor={`cost-basis-${fieldKey}`}>
            Cost basis (optional)
          </label>
          <HelpTooltip label="Cost basis">
            {PORTFOLIO_HELP.costBasis}
          </HelpTooltip>
        </div>
        <input
          id={`cost-basis-${fieldKey}`}
          className={inputClass}
          name="costBasis"
          type="number"
          min="0"
          step="0.0001"
          defaultValue={asset?.costBasis?.toString() ?? ""}
        />
      </div>
      <label className="text-sm font-semibold">
        Currency
        <input
          className={inputClass}
          name="currency"
          pattern="[A-Za-z]{3}"
          maxLength={3}
          required
          defaultValue={asset?.currency ?? "USD"}
        />
      </label>
      <div className="text-sm font-semibold">
        <div className="flex items-center gap-1">
          <label htmlFor={`acquired-date-${fieldKey}`}>
            Acquired date (optional)
          </label>
          <HelpTooltip label="Acquired date">
            {PORTFOLIO_HELP.acquiredDate}
          </HelpTooltip>
        </div>
        <input
          id={`acquired-date-${fieldKey}`}
          className={inputClass}
          name="acquiredAt"
          type="date"
          defaultValue={dateInputValue(asset?.acquiredAt ?? null)}
        />
      </div>
      <label className="text-sm font-semibold sm:col-span-2">
        Notes (optional)
        <textarea
          className={`${inputClass} min-h-24 py-2`}
          name="notes"
          maxLength={1000}
          defaultValue={asset?.notes ?? ""}
        />
      </label>
    </>
  );
}

export function CreateManualAssetForm() {
  return (
    <form
      action={createManualAssetAction}
      className="grid gap-4 sm:grid-cols-2"
    >
      <input type="hidden" name="returnTo" value="/accounts" />
      <AssetFields />
      <div className="sm:col-span-2">
        <Button type="submit">Create manual asset or debt</Button>
      </div>
    </form>
  );
}

export function ManualAssetList({
  assets,
  now,
}: {
  assets: PortfolioManualAsset[];
  now: Date;
}) {
  if (!assets.length)
    return (
      <Card className="p-6">
        <p className="font-semibold">No manual assets or debts yet</p>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          Add property, vehicles, private assets, mortgages, or loans below.
        </p>
      </Card>
    );
  return (
    <ul className="space-y-4" aria-label="Manual assets and debts">
      {assets.map((asset) => {
        const freshness = freshnessState(asset.updatedAt, now);
        return (
          <li key={asset.id}>
            <Card className="p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold">{asset.name}</h3>
                    <SemanticBadge
                      tone={
                        asset.isActive
                          ? asset.isDebt
                            ? "negative"
                            : "positive"
                          : "muted"
                      }
                    >
                      {asset.isActive
                        ? asset.isDebt
                          ? "Active debt"
                          : "Active asset"
                        : "Inactive"}
                    </SemanticBadge>
                    <span className="inline-flex items-center gap-1">
                      <SemanticBadge tone="muted">Manual source</SemanticBadge>
                      <HelpTooltip label="Manual source">
                        {PORTFOLIO_HELP.manualSource}
                      </HelpTooltip>
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <SemanticBadge
                        tone={freshness === "current" ? "info" : "warning"}
                      >
                        {freshness === "current" ? "Current" : "Stale"}
                      </SemanticBadge>
                      <HelpTooltip label="Freshness status">
                        {PORTFOLIO_HELP.freshness}
                      </HelpTooltip>
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-[var(--text-secondary)]">
                    {titleCaseEnum(asset.assetType)} ·{" "}
                    {formatRelativeTime(asset.updatedAt, now)}
                  </p>
                  {asset.notes ? (
                    <p className="mt-2 text-sm">{asset.notes}</p>
                  ) : null}
                </div>
                <SemanticValue
                  tone={
                    asset.isActive
                      ? asset.isDebt
                        ? "negative"
                        : "positive"
                      : "muted"
                  }
                  label={asset.isDebt ? "Amount owed" : "Asset value"}
                  className="text-xl"
                >
                  {asset.isDebt ? "−" : "+"}
                  {formatCurrency(asset.currentValue.abs(), asset.currency)}
                </SemanticValue>
              </div>
              <details className="mt-4 rounded-lg border p-4">
                <summary className="cursor-pointer font-semibold">
                  Edit and manage {asset.name}
                </summary>
                <form
                  action={updateManualAssetAction}
                  className="mt-4 grid gap-4 sm:grid-cols-2"
                >
                  <input type="hidden" name="assetId" value={asset.id} />
                  <input type="hidden" name="returnTo" value="/accounts" />
                  <AssetFields asset={asset} />
                  <div className="sm:col-span-2">
                    <Button type="submit">Save asset or debt</Button>
                  </div>
                </form>
                <div className="mt-4">
                  <DeleteConfirmationDialog
                    recordName={asset.name}
                    recordType={asset.isDebt ? "debt" : "manual asset"}
                    triggerLabel={`Delete ${asset.isDebt ? "debt" : "asset"}`}
                    deleteAction={deleteManualAssetAction}
                    deleteFields={[
                      { name: "assetId", value: asset.id },
                      { name: "returnTo", value: "/accounts" },
                    ]}
                    deactivateAction={
                      asset.isActive ? deactivateManualAssetAction : undefined
                    }
                    deactivateFields={[
                      { name: "assetId", value: asset.id },
                      { name: "returnTo", value: "/accounts" },
                    ]}
                  />
                </div>
              </details>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
