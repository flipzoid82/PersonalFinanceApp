import {
  AccountType,
  ImportCandidateKind,
  ImportCandidateStatus,
  ImportType,
} from "@prisma/client";
import { Prisma } from "@prisma/client";
import type {
  CsvMapping,
  ParsedImportCandidate,
  ParsedImportDocument,
} from "./types";

export const MAX_CSV_ROWS = 2_000;
export const MAX_CSV_COLUMNS = 80;

export class CsvParseError extends Error {}

export function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') quoted = false;
      else field += char;
      continue;
    }
    if (char === '"' && field.length === 0) quoted = true;
    else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field.replace(/\r$/, ""));
      if (row.some((value) => value.trim())) rows.push(row);
      if (rows.length > MAX_CSV_ROWS + 1)
        throw new CsvParseError(
          `CSV files are limited to ${MAX_CSV_ROWS} data rows.`,
        );
      row = [];
      field = "";
    } else field += char;
  }
  if (quoted)
    throw new CsvParseError("The CSV contains an unterminated quoted field.");
  row.push(field.replace(/\r$/, ""));
  if (row.some((value) => value.trim())) rows.push(row);
  if (!rows.length) throw new CsvParseError("The CSV is empty.");
  if (rows[0].length > MAX_CSV_COLUMNS)
    throw new CsvParseError(
      `CSV files are limited to ${MAX_CSV_COLUMNS} columns.`,
    );
  const headers = rows[0].map((header) => header.replace(/^\uFEFF/, "").trim());
  if (headers.some((header) => !header))
    throw new CsvParseError("Every CSV column must have a header.");
  const normalized = headers.map((header) => header.toLocaleLowerCase());
  if (new Set(normalized).size !== normalized.length)
    throw new CsvParseError("The CSV contains duplicate column headers.");
  return { headers, rows: rows.slice(1) };
}

function exactDecimal(value: string) {
  const trimmed = value.trim();
  const negative = /^\(.*\)$/.test(trimmed);
  const normalized = trimmed.replace(/[\s,$]/g, "").replace(/^\((.*)\)$/, "$1");
  if (!/^[-+]?\d+(?:\.\d{1,10})?$/.test(normalized)) return null;
  try {
    const decimal = new Prisma.Decimal(normalized);
    return (negative ? decimal.negated() : decimal).toFixed();
  } catch {
    return null;
  }
}

function isoDate(value: string) {
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  const date = new Date(`${trimmed}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== trimmed
    ? null
    : trimmed;
}

function currency(value: string | undefined) {
  const result = value?.trim().toUpperCase();
  return result && /^[A-Z]{3}$/.test(result) ? result : null;
}

function cell(headers: string[], row: string[], mapped: string | undefined) {
  if (!mapped) return undefined;
  const index = headers.indexOf(mapped);
  return index < 0 ? undefined : row[index]?.trim();
}

export function detectCommonCsvMapping(headers: string[]) {
  const byName = new Map(
    headers.map((header) => [header.toLowerCase(), header]),
  );
  const find = (...names: string[]) =>
    names.map((name) => byName.get(name)).find(Boolean);
  return {
    account: find("account", "account name", "account_name"),
    asOfDate: find("as of date", "as_of_date", "date", "captured at"),
    value: find("balance", "current value", "market value", "value", "amount"),
    currency: find("currency", "currency code"),
    securityName: find("security", "security name", "holding", "description"),
    tickerSymbol: find("ticker", "symbol"),
    quantity: find("quantity", "shares", "units"),
    price: find("price", "share price"),
    costBasis: find("cost basis", "cost_basis"),
  };
}

export type CsvImportDetection =
  | { confidence: "strong"; importType: "GENERIC_ACCOUNT_BALANCE_CSV" }
  | { confidence: "strong"; importType: "GENERIC_INVESTMENT_HOLDINGS_CSV" }
  | {
      confidence: "ambiguous";
      plausibleTypes: readonly [
        "GENERIC_ACCOUNT_BALANCE_CSV",
        "GENERIC_INVESTMENT_HOLDINGS_CSV",
      ];
    };

export function detectCsvImportType(headers: string[]): CsvImportDetection {
  const mapping = detectCommonCsvMapping(headers);
  const hasSharedShape = Boolean(mapping.account && mapping.asOfDate);
  const hasBalanceValue = Boolean(mapping.value);
  const hasHoldingIdentity = Boolean(mapping.securityName);
  const hasHoldingMeasure = Boolean(
    mapping.quantity || mapping.price || mapping.costBasis,
  );

  if (
    hasSharedShape &&
    hasHoldingIdentity &&
    (hasBalanceValue || hasHoldingMeasure)
  )
    return {
      confidence: "strong",
      importType: "GENERIC_INVESTMENT_HOLDINGS_CSV",
    };
  if (hasSharedShape && hasBalanceValue && !hasHoldingIdentity)
    return {
      confidence: "strong",
      importType: "GENERIC_ACCOUNT_BALANCE_CSV",
    };
  return {
    confidence: "ambiguous",
    plausibleTypes: [
      "GENERIC_ACCOUNT_BALANCE_CSV",
      "GENERIC_INVESTMENT_HOLDINGS_CSV",
    ],
  };
}

export function mapGenericCsv(
  text: string,
  mapping: CsvMapping,
): ParsedImportDocument {
  const { headers, rows } = parseCsv(text);
  for (const required of [mapping.account, mapping.asOfDate, mapping.value]) {
    if (!headers.includes(required))
      throw new CsvParseError("A required mapped column is unavailable.");
  }
  if (
    mapping.importType === "GENERIC_INVESTMENT_HOLDINGS_CSV" &&
    !mapping.securityName
  )
    throw new CsvParseError("Map a security or holding-name column.");
  const candidates: ParsedImportCandidate[] = rows.map((row, index) => {
    const accountName = cell(headers, row, mapping.account)?.trim();
    const date = isoDate(cell(headers, row, mapping.asOfDate) ?? "");
    const value = exactDecimal(cell(headers, row, mapping.value) ?? "");
    const rowCurrency = currency(
      cell(headers, row, mapping.currency) ?? mapping.defaultCurrency,
    );
    const securityName = cell(headers, row, mapping.securityName)?.trim();
    const errors = [
      !accountName && "account name",
      !date && "an unambiguous YYYY-MM-DD date",
      value === null && "a valid amount",
      !rowCurrency && "a confirmed three-letter currency",
      mapping.importType === "GENERIC_INVESTMENT_HOLDINGS_CSV" &&
        !securityName &&
        "a security name",
    ].filter(Boolean);
    const evidence = {
      parserFamily:
        mapping.importType === "GENERIC_ACCOUNT_BALANCE_CSV"
          ? "GenericBalanceCsvParser"
          : "GenericHoldingCsvParser",
      parserVersion: "1.0.0",
      documentType: mapping.importType as ImportType,
      extractionMethod: "csv" as const,
      section: `Row ${index + 2}`,
      normalizedConcept:
        mapping.importType === "GENERIC_ACCOUNT_BALANCE_CSV"
          ? "balance snapshot"
          : "investment holding",
    };
    if (errors.length)
      return {
        ordinal: index + 1,
        kind:
          mapping.importType === "GENERIC_ACCOUNT_BALANCE_CSV"
            ? ImportCandidateKind.BALANCE_SNAPSHOT
            : ImportCandidateKind.HOLDING,
        status: ImportCandidateStatus.REJECTED,
        sourceLabel: `Row ${index + 2}`,
        evidence,
        reviewReason: `Missing or invalid ${errors.join(", ")}.`,
      };
    const account = {
      sourceKey: accountName!.toLocaleLowerCase(),
      displayName: accountName!,
      accountType:
        mapping.importType === "GENERIC_ACCOUNT_BALANCE_CSV"
          ? AccountType.OTHER
          : AccountType.BROKERAGE,
      currency: rowCurrency!,
    };
    return {
      ordinal: index + 1,
      kind:
        mapping.importType === "GENERIC_ACCOUNT_BALANCE_CSV"
          ? ImportCandidateKind.BALANCE_SNAPSHOT
          : ImportCandidateKind.HOLDING,
      status: ImportCandidateStatus.READY,
      sourceLabel: `Row ${index + 2}`,
      evidence,
      proposedData:
        mapping.importType === "GENERIC_ACCOUNT_BALANCE_CSV"
          ? { account, asOfDate: date!, currentBalance: value! }
          : {
              account,
              asOfDate: date!,
              securityName: securityName!,
              tickerSymbol: cell(headers, row, mapping.tickerSymbol),
              currentValue: value!,
              quantity:
                exactDecimal(cell(headers, row, mapping.quantity) ?? "") ??
                undefined,
              price:
                exactDecimal(cell(headers, row, mapping.price) ?? "") ??
                undefined,
              costBasis:
                exactDecimal(cell(headers, row, mapping.costBasis) ?? "") ??
                undefined,
            },
    };
  });
  const type = mapping.importType as ImportType;
  return {
    importType: type,
    parserFamily:
      type === ImportType.GENERIC_ACCOUNT_BALANCE_CSV
        ? "GenericBalanceCsvParser"
        : "GenericHoldingCsvParser",
    parserVersion: "1.0.0",
    currency: currency(mapping.defaultCurrency) ?? undefined,
    candidates,
    usedOcr: false,
  };
}
