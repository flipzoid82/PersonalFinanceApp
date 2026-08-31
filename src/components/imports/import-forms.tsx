import type { ImportType } from "@prisma/client";
import {
  mapCsvImportAction,
  resolveImportAccountAction,
  uploadImportAction,
} from "@/actions/imports";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { importTypeLabels } from "@/lib/imports/presentation";

const supportedTypes = [
  "FIDELITY_NETBENEFITS_STATEMENT",
  "FIDELITY_BROKERAGE_STATEMENT",
  "FIDELITY_TRADE_CONFIRMATION",
  "TSP_STATEMENT",
  "GENERIC_ACCOUNT_BALANCE_CSV",
  "GENERIC_INVESTMENT_HOLDINGS_CSV",
] as const satisfies readonly ImportType[];

const inputClass =
  "min-h-11 w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface-panel)] px-3 text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]";

const selectClass = `${inputClass} [&>option]:bg-[var(--surface-panel)] [&>option]:text-[var(--text-primary)]`;

export function ImportUploadForm({
  configured,
  fallback,
}: {
  configured: boolean;
  fallback?: "csv" | "pdf";
}) {
  if (!configured) {
    return (
      <Notice
        tone="warning"
        role="status"
        title="Encrypted import storage is unavailable"
      >
        Import controls are unavailable until server-side encryption is ready.
        Local developers should restart with pnpm dev:start. Production
        operators must explicitly configure a dedicated import encryption key.
        No key value is sent to or stored in the browser.
      </Notice>
    );
  }

  return (
    <form action={uploadImportAction} className="space-y-4">
      <div>
        <label htmlFor="import-file" className="text-sm font-semibold">
          Choose a statement or CSV
        </label>
        <input
          id="import-file"
          name="file"
          type="file"
          accept=".pdf,.csv,application/pdf,text/csv"
          required
          className={`${inputClass} mt-1 py-2`}
        />
        <p className="mt-1 text-xs text-[var(--text-secondary)]">
          We&apos;ll identify the file type for you. PDF or UTF-8 CSV, up to 8
          MB. The encrypted original is retained for 30 days unless you delete
          it sooner.
        </p>
      </div>
      {fallback ? (
        <div>
          <label htmlFor="import-type" className="text-sm font-semibold">
            Choose the closest match
          </label>
          <select
            id="import-type"
            name="importType"
            className={`${selectClass} mt-1`}
            defaultValue=""
            required
          >
            <option value="" disabled>
              Select a file type
            </option>
            {supportedTypes
              .filter((type) =>
                fallback === "csv"
                  ? type.endsWith("_CSV")
                  : !type.endsWith("_CSV"),
              )
              .map((type) => (
                <option key={type} value={type}>
                  {importTypeLabels[type]}
                </option>
              ))}
          </select>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            The app could not classify the previous file safely. Confirm only
            the closest plausible type, then select that file again.
          </p>
        </div>
      ) : null}
      <Button type="submit">Upload and review</Button>
    </form>
  );
}

function MappingSelect({
  name,
  label,
  headers,
  value,
  required,
}: {
  name: string;
  label: string;
  headers: string[];
  value?: string;
  required?: boolean;
}) {
  return (
    <label className="block text-sm font-semibold">
      {label}
      <select
        name={name}
        required={required}
        defaultValue={value ?? ""}
        className={`${selectClass} mt-1`}
      >
        <option value="">{required ? "Choose a column" : "Not mapped"}</option>
        {headers.map((header) => (
          <option key={header} value={header}>
            {header}
          </option>
        ))}
      </select>
    </label>
  );
}

export function CsvMappingForm({
  importId,
  importType,
  headers,
  detected,
}: {
  importId: string;
  importType: "GENERIC_ACCOUNT_BALANCE_CSV" | "GENERIC_INVESTMENT_HOLDINGS_CSV";
  headers: string[];
  detected: Record<string, string | undefined>;
}) {
  const holdings = importType === "GENERIC_INVESTMENT_HOLDINGS_CSV";
  return (
    <form action={mapCsvImportAction} className="space-y-4">
      <input type="hidden" name="importId" value={importId} />
      <input type="hidden" name="importType" value={importType} />
      <div className="grid gap-4 sm:grid-cols-2">
        <MappingSelect
          name="account"
          label="Account"
          headers={headers}
          value={detected.account}
          required
        />
        <MappingSelect
          name="asOfDate"
          label="As-of date"
          headers={headers}
          value={detected.asOfDate}
          required
        />
        <MappingSelect
          name="value"
          label={holdings ? "Holding value" : "Balance"}
          headers={headers}
          value={detected.value}
          required
        />
        <MappingSelect
          name="currency"
          label="Currency column"
          headers={headers}
          value={detected.currency}
        />
        {holdings ? (
          <>
            <MappingSelect
              name="securityName"
              label="Holding name column"
              headers={headers}
              value={detected.securityName}
              required
            />
            <MappingSelect
              name="tickerSymbol"
              label="Ticker symbol"
              headers={headers}
              value={detected.tickerSymbol}
            />
            <MappingSelect
              name="quantity"
              label="Quantity"
              headers={headers}
              value={detected.quantity}
            />
            <MappingSelect
              name="price"
              label="Price"
              headers={headers}
              value={detected.price}
            />
            <MappingSelect
              name="costBasis"
              label="Cost basis"
              headers={headers}
              value={detected.costBasis}
            />
          </>
        ) : null}
      </div>
      <label className="block max-w-xs text-sm font-semibold">
        Currency when no column is mapped
        <input
          name="defaultCurrency"
          defaultValue="USD"
          maxLength={3}
          className={`${inputClass} mt-1 uppercase`}
          aria-describedby="currency-help"
        />
      </label>
      <p id="currency-help" className="text-xs text-[var(--text-secondary)]">
        Confirm the three-letter currency. It is never guessed row by row.
      </p>
      <Button type="submit">Validate mapping</Button>
    </form>
  );
}

export function AccountMatchForm({
  importId,
  matchId,
  suggestedAccountId,
  accounts,
}: {
  importId: string;
  matchId: string;
  suggestedAccountId?: string;
  accounts: Array<{
    id: string;
    name: string;
    institutionName: string | null;
    currency: string;
  }>;
}) {
  return (
    <form
      action={resolveImportAccountAction}
      className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end"
    >
      <input type="hidden" name="importId" value={importId} />
      <input type="hidden" name="matchId" value={matchId} />
      <label className="min-w-0 flex-1 text-sm font-semibold">
        Existing account
        <select
          name="accountId"
          defaultValue={suggestedAccountId ?? ""}
          className={`${selectClass} mt-1`}
        >
          <option value="">Choose an account</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name} · {account.institutionName ?? "No institution"} ·{" "}
              {account.currency}
            </option>
          ))}
        </select>
      </label>
      <Button type="submit" name="decision" value="existing">
        Use selected account
      </Button>
      <Button type="submit" name="decision" value="create">
        Create new account
      </Button>
    </form>
  );
}
