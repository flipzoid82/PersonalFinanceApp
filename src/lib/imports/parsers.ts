import {
  AccountType,
  ImportCandidateKind,
  ImportCandidateStatus,
  ImportType,
  InvestmentTransactionType,
} from "@prisma/client";
import { Prisma } from "@prisma/client";
import type {
  ImportAccountIdentity,
  ParsedImportCandidate,
  ParsedImportDocument,
} from "./types";

export class ImportParseError extends Error {
  constructor(
    message: string,
    readonly code = "UNSUPPORTED_DOCUMENT",
  ) {
    super(message);
  }
}

const FAMILY = {
  [ImportType.FIDELITY_NETBENEFITS_STATEMENT]: "FidelityNetBenefitsParser",
  [ImportType.FIDELITY_BROKERAGE_STATEMENT]: "FidelityBrokerageStatementParser",
  [ImportType.FIDELITY_TRADE_CONFIRMATION]: "FidelityTradeConfirmationParser",
  [ImportType.TSP_STATEMENT]: "TspStatementParser",
} as const;

function money(value: string | undefined) {
  if (!value) return null;
  const negative = /^\(.*\)$/.test(value.trim());
  const normalized = value
    .trim()
    .replace(/[\s,$]/g, "")
    .replace(/^\((.*)\)$/, "$1");
  if (!/^[-+]?\d+(?:\.\d{1,10})?$/.test(normalized)) return null;
  try {
    const decimal = new Prisma.Decimal(normalized);
    return (negative ? decimal.negated() : decimal).toFixed();
  } catch {
    return null;
  }
}

function date(value: string | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  const numeric = trimmed.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2}|\d{4})$/);
  const normalizedNumeric = numeric
    ? `${numeric[3].length === 2 ? `20${numeric[3]}` : numeric[3]}-${numeric[1].padStart(2, "0")}-${numeric[2].padStart(2, "0")}`
    : null;
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
    ? new Date(`${trimmed}T00:00:00.000Z`)
    : normalizedNumeric
      ? new Date(`${normalizedNumeric}T00:00:00.000Z`)
      : /[A-Za-z]/.test(trimmed)
        ? new Date(`${trimmed.replace(/,$/, "")} 00:00:00 UTC`)
        : null;
  return parsed && !Number.isNaN(parsed.getTime())
    ? parsed.toISOString().slice(0, 10)
    : null;
}

function valueAfter(text: string, labels: string[]) {
  for (const label of labels) {
    const match = text.match(
      new RegExp(`${label}\\s*[:\\-]?\\s*\\$?([()0-9,]+(?:\\.\\d+)?)`, "i"),
    );
    if (match) return money(match[1]);
  }
  return null;
}

function dateAfter(text: string, labels: string[]) {
  for (const label of labels) {
    const match = text.match(
      new RegExp(
        `${label}\\s*[:\\-]?\\s*([A-Za-z]+\\s+\\d{1,2},?\\s+\\d{4}|\\d{4}-\\d{2}-\\d{2}|\\d{1,2}[\\/-]\\d{1,2}[\\/-]\\d{2,4})`,
        "i",
      ),
    );
    if (match) return date(match[1]);
  }
  return null;
}

export function detectStatementType(text: string): ImportType {
  const normalized = text.toLocaleLowerCase();
  if (
    (normalized.includes("trade confirmation") ||
      normalized.includes("transaction confirmation")) &&
    (normalized.includes("fidelity") ||
      (normalized.includes("brokerage no") &&
        normalized.includes("settlement date")))
  )
    return ImportType.FIDELITY_TRADE_CONFIRMATION;
  if (
    normalized.includes("netbenefits") ||
    normalized.includes("401(k) savings plan")
  )
    return ImportType.FIDELITY_NETBENEFITS_STATEMENT;
  if (
    normalized.includes("thrift savings plan") ||
    normalized.includes("tsp account")
  )
    return ImportType.TSP_STATEMENT;
  if (
    normalized.includes("fidelity") &&
    (normalized.includes("brokerage") ||
      normalized.includes("account statement") ||
      (normalized.includes("investment report") &&
        normalized.includes("account holdings")))
  )
    return ImportType.FIDELITY_BROKERAGE_STATEMENT;
  throw new ImportParseError(
    "We could not safely identify this statement type.",
  );
}

function accountFor(type: ImportType, text: string): ImportAccountIdentity {
  const accountMatch = text.match(
    /(?:account|plan)(?:\s+(?:number|id))?\s*[:#-]?\s*([*xX•-]*\d{3,8})/i,
  );
  const maskedIdentifier = accountMatch?.[1]?.replace(/[^\d]/g, "").slice(-4);
  const institutionName =
    type === ImportType.TSP_STATEMENT ? "Thrift Savings Plan" : "Fidelity";
  const displayName =
    type === ImportType.FIDELITY_NETBENEFITS_STATEMENT
      ? "Fidelity NetBenefits retirement account"
      : type === ImportType.FIDELITY_BROKERAGE_STATEMENT ||
          type === ImportType.FIDELITY_TRADE_CONFIRMATION
        ? "Fidelity brokerage account"
        : "TSP retirement account";
  const accountType =
    type === ImportType.FIDELITY_BROKERAGE_STATEMENT ||
    type === ImportType.FIDELITY_TRADE_CONFIRMATION
      ? AccountType.BROKERAGE
      : type === ImportType.FIDELITY_NETBENEFITS_STATEMENT
        ? AccountType.FOUR_O_ONE_K
        : AccountType.RETIREMENT;
  return {
    sourceKey: `${institutionName.toLocaleLowerCase()}:${maskedIdentifier ?? displayName.toLocaleLowerCase()}`,
    displayName,
    institutionName,
    maskedIdentifier,
    accountType,
    currency: "USD",
  };
}

function structuredRows(text: string, label: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) =>
      line.toLocaleLowerCase().startsWith(`${label.toLocaleLowerCase()}:`),
    )
    .map((line) =>
      line
        .slice(line.indexOf(":") + 1)
        .split("|")
        .map((value) => value.trim()),
    );
}

function textLines(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function sliceBetween(lines: string[], start: string, end: string) {
  const startIndex = lines.findIndex((line) =>
    line.toLocaleLowerCase().includes(start.toLocaleLowerCase()),
  );
  if (startIndex < 0) return [];
  const endIndex = lines.findIndex(
    (line, index) =>
      index > startIndex &&
      line.toLocaleLowerCase().includes(end.toLocaleLowerCase()),
  );
  return lines.slice(startIndex + 1, endIndex < 0 ? undefined : endIndex);
}

type ProviderHolding = {
  securityName: string;
  tickerSymbol?: string;
  quantity?: string;
  price?: string;
  currentValue: string;
  costBasis?: string;
  allocationPercent?: string;
};

function providerHoldings(type: ImportType, text: string): ProviderHolding[] {
  const lines = textLines(text);
  if (type === ImportType.FIDELITY_BROKERAGE_STATEMENT) {
    const section = sliceBetween(lines, "Account Holdings", "Total Holdings");
    const firstData = section.findIndex((line) =>
      line.toLocaleLowerCase().includes("unrealized gain/loss"),
    );
    const data = firstData >= 0 ? section.slice(firstData + 1) : [];
    const result: ProviderHolding[] = [];
    for (let index = 0; index + 5 < data.length; index += 6) {
      const [name, quantity, price, value, basis] = data.slice(
        index,
        index + 5,
      );
      const currentValue = money(value);
      if (!name || !currentValue || !money(quantity) || !money(price)) break;
      const ticker = name.match(/\(([A-Z][A-Z0-9.-]{0,9})\)\s*$/)?.[1];
      result.push({
        securityName: name.replace(/\s*\([A-Z][A-Z0-9.-]{0,9}\)\s*$/, ""),
        tickerSymbol: ticker,
        quantity: money(quantity) ?? undefined,
        price: money(price) ?? undefined,
        currentValue,
        costBasis: money(basis) ?? undefined,
      });
    }
    if (result.length) return result;
    const sectionText = sliceBetween(
      lines,
      "Account Holdings",
      "Total Holdings",
    ).join("\n");
    const rowPattern =
      /^(.+?)\s+([0-9,.]+)\s+\$([0-9,.]+)\s+\$([0-9,.]+)\s+(\$[0-9,.]+|not applicable)\s+(?:\$?[()0-9,.-]+|not applicable)$/gim;
    for (const match of sectionText.matchAll(rowPattern)) {
      const ticker = match[1].match(/\(([A-Z][A-Z0-9.-]{0,9})\)\s*$/)?.[1];
      result.push({
        securityName: match[1].replace(/\s*\([A-Z][A-Z0-9.-]{0,9}\)\s*$/, ""),
        tickerSymbol: ticker,
        quantity: money(match[2]) ?? undefined,
        price: money(match[3]) ?? undefined,
        currentValue: money(match[4])!,
        costBasis: money(match[5]) ?? undefined,
      });
    }
    return result;
  }
  if (type === ImportType.FIDELITY_NETBENEFITS_STATEMENT) {
    const section = sliceBetween(
      lines,
      "Market Value of Your Account",
      "Account Totals",
    );
    const firstData = section.findIndex((line) =>
      line.toLocaleLowerCase().includes("value 07/31"),
    );
    const data = firstData >= 0 ? section.slice(firstData + 1) : [];
    const result: ProviderHolding[] = [];
    for (let index = 0; index + 6 < data.length; index += 7) {
      const [name, , quantity, , price, , value] = data.slice(index, index + 7);
      const currentValue = money(value);
      if (!name || !currentValue) break;
      result.push({
        securityName: name,
        quantity: money(quantity) ?? undefined,
        price: money(price) ?? undefined,
        currentValue,
      });
    }
    if (result.length) return result;
    const flattened = section
      .join(" ")
      .match(
        /Investment\s+Shares[^\n]*?Value\s+07\/31\s+(.+?)\s+([0-9,.]+)\s+([0-9,.]+)\s+\$([0-9,.]+)\s+\$([0-9,.]+)\s+\$([0-9,.]+)\s+\$([0-9,.]+)/i,
      );
    if (flattened)
      result.push({
        securityName: flattened[1],
        quantity: money(flattened[3]) ?? undefined,
        price: money(flattened[5]) ?? undefined,
        currentValue: money(flattened[7])!,
      });
    return result;
  }
  if (type === ImportType.TSP_STATEMENT) {
    const match = text
      .split(/\r?\n/)
      .map((line) => line.trim().replace(/\s+/g, " "))
      .map((line) =>
        line.match(
          /^((?:L|G|F|C|S|I)\s*(?:20\d{2})?\s*Fund)\s+([0-9,.]+)\s+\$?([0-9,.]+)\s+\$?([0-9,.]+)\s+(100(?:\.0+)?%|[0-9]{1,2}(?:\.\d+)?%)$/i,
        ),
      )
      .find(Boolean);
    if (match) {
      const currentValue = money(match[4]);
      if (!currentValue) return [];
      return [
        {
          securityName: match[1].replace(/\s+/g, " ").trim(),
          quantity: money(match[2]) ?? undefined,
          price: money(match[3]) ?? undefined,
          currentValue,
          allocationPercent: money(match[5].replace("%", "")) ?? undefined,
        },
      ];
    }
    const fund = text.match(
      /Fund Name\s+Current Allocation[^\n]*\n\s*((?:L|G|F|C|S|I)\s*(?:20\d{2})?)\s+(\d+(?:\.\d+)?%)/i,
    );
    const quantity = valueAfter(text, ["Closing Units"]);
    const price = valueAfter(text, ["Unit Price \\(NAV\\)"]);
    const currentValue = valueAfter(text, ["Closing Balance"]);
    if (!fund || !currentValue) return [];
    return [
      {
        securityName: `${fund[1].replace(/\s+/g, " ").trim()} Fund`,
        quantity: quantity ?? undefined,
        price: price ?? undefined,
        currentValue,
        allocationPercent: money(fund[2].replace("%", "")) ?? undefined,
      },
    ];
  }
  return [];
}

function providerActivities(type: ImportType, text: string) {
  if (type === ImportType.FIDELITY_TRADE_CONFIRMATION) {
    const purchased = text.match(
      /(?:you\s+)?purchased\s+([0-9,.]+)\s+at\s+\$?([0-9,.]+)\s+purchase price/i,
    );
    const security = text.match(
      /security description\s+symbol\s*:\s*([A-Z][A-Z0-9.-]*)\s*\|\s*([^\n]+)/i,
    );
    const tradeDate =
      dateAfter(text, ["trade date"]) ??
      date(text.match(/stock plan on\s+([0-9\/-]+)/i)?.[1]);
    const settlementDate = dateAfter(text, ["settlement date"]);
    const reference = text.match(
      /(?:trans no\.|transaction reference)\s*[:#-]?\s*([^\s]+)/i,
    )?.[1];
    const amount = valueAfter(text, ["accumulated contributions"]);
    if (!purchased || !security || !tradeDate) return [];
    return [
      {
        transactionDate: tradeDate,
        settlementDate: settlementDate ?? undefined,
        transactionType: InvestmentTransactionType.BUY,
        securityName: security[2].trim(),
        tickerSymbol: security[1],
        quantity: money(purchased[1]) ?? undefined,
        price: money(purchased[2]) ?? undefined,
        amount: amount
          ? new Prisma.Decimal(amount).negated().toFixed()
          : undefined,
        sourceReference: reference,
      },
    ];
  }
  if (type === ImportType.FIDELITY_BROKERAGE_STATEMENT) {
    const flattened = text.match(
      /(?:\n|^)\s*(\d{1,2}\/\d{1,2}\/\d{4})\s+(.+?)\s+([A-Z][A-Z0-9.-]*)\s+\/\s+\S+\s+You Bought\s+([0-9,.]+)\s+\$([0-9,.]+)\s+-\$([0-9,.]+)/i,
    );
    if (flattened)
      return [
        {
          transactionDate: date(flattened[1])!,
          transactionType: InvestmentTransactionType.BUY,
          securityName: flattened[2],
          tickerSymbol: flattened[3],
          quantity: money(flattened[4]) ?? undefined,
          price: money(flattened[5]) ?? undefined,
          amount: new Prisma.Decimal(money(flattened[6])!).negated().toFixed(),
        },
      ];
    const lines = textLines(text);
    const start = lines.findIndex(
      (line) => line === "Securities Bought & Sold",
    );
    if (start < 0) return [];
    const dateIndex = lines.findIndex(
      (line, index) => index > start && /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(line),
    );
    if (dateIndex < 0) return [];
    const [
      settled,
      securityName,
      symbol,
      description,
      quantity,
      price,
      amount,
    ] = lines.slice(dateIndex, dateIndex + 7);
    const transactionDate = date(settled);
    if (!transactionDate || !/bought/i.test(description ?? "")) return [];
    return [
      {
        transactionDate,
        transactionType: InvestmentTransactionType.BUY,
        securityName,
        tickerSymbol: symbol?.split(/\s*\/\s*/)[0],
        quantity: money(quantity) ?? undefined,
        price: money(price) ?? undefined,
        amount: money(amount) ?? undefined,
      },
    ];
  }
  return [];
}

export function parseStatementText(
  text: string,
  requestedType?: ImportType,
  extractionMethod: "native-pdf-text" | "ocr" = "native-pdf-text",
): ParsedImportDocument {
  if (text.length < 40)
    throw new ImportParseError(
      "This PDF does not contain enough extractable text.",
      "OCR_REQUIRED",
    );
  const detectedType = detectStatementType(text);
  if (requestedType && requestedType !== detectedType)
    throw new ImportParseError(
      "The selected document type does not match the statement content.",
      "DOCUMENT_TYPE_MISMATCH",
    );
  const importType = detectedType;
  if (!FAMILY[importType as keyof typeof FAMILY])
    throw new ImportParseError("The selected statement type is not supported.");
  const parserFamily = FAMILY[importType as keyof typeof FAMILY];
  const parserVersion = "1.0.0";
  const account = accountFor(importType, text);
  const labelledAsOfDate = dateAfter(text, [
    "as of",
    "ending date",
    "statement ending",
    "statement date",
  ]);
  const period =
    text.match(
      /statement period\s*[:\-]?\s*((?:[A-Za-z]+\s+\d{1,2},?\s+\d{4})|(?:\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})|(?:\d{4}-\d{2}-\d{2}))\s+(?:to|through|-)\s+((?:[A-Za-z]+\s+\d{1,2},?\s+\d{4})|(?:\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})|(?:\d{4}-\d{2}-\d{2}))/i,
    ) ??
    text.match(
      /([A-Za-z]+\s+\d{1,2},?\s+\d{4})\s+-\s+([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i,
    );
  const statementStartAt = date(period?.[1]);
  const statementEndAt = date(period?.[2]) ?? labelledAsOfDate;
  const asOfDate =
    labelledAsOfDate ??
    statementEndAt ??
    (importType === ImportType.FIDELITY_TRADE_CONFIRMATION
      ? date(text.match(/stock plan on\s+([0-9\/-]+)/i)?.[1])
      : null);
  const balance = valueAfter(text, [
    "ending account value",
    "ending balance",
    "total account value",
    "account balance",
    "your account value",
    "closing balance",
  ]);
  const candidates: ParsedImportCandidate[] = [];
  let ordinal = 1;
  const evidence = (section: string, concept: string) => ({
    parserFamily,
    parserVersion,
    documentType: importType,
    extractionMethod,
    section,
    normalizedConcept: concept,
  });
  if (balance && (asOfDate || statementEndAt))
    candidates.push({
      ordinal: ordinal++,
      kind: ImportCandidateKind.INVESTMENT_BALANCE_SNAPSHOT,
      status: ImportCandidateStatus.READY,
      sourceLabel: "Ending account value",
      evidence: evidence("Account summary", "investment balance snapshot"),
      proposedData: {
        account,
        asOfDate: asOfDate ?? statementEndAt!,
        totalValue: balance,
      },
    });
  else if (importType !== ImportType.FIDELITY_TRADE_CONFIRMATION)
    candidates.push({
      ordinal: ordinal++,
      kind: ImportCandidateKind.INVESTMENT_BALANCE_SNAPSHOT,
      status: ImportCandidateStatus.REJECTED,
      sourceLabel: "Account summary",
      evidence: evidence("Account summary", "investment balance snapshot"),
      reviewReason:
        "We could not safely read both an ending value and an as-of date.",
    });

  for (const row of structuredRows(text, "HOLDING")) {
    const [
      securityName,
      tickerSymbol,
      quantity,
      price,
      currentValue,
      costBasis,
      allocation,
    ] = row;
    const parsedValue = money(currentValue);
    if (!securityName || !parsedValue || !(asOfDate || statementEndAt)) {
      candidates.push({
        ordinal: ordinal++,
        kind: ImportCandidateKind.HOLDING,
        status: ImportCandidateStatus.REJECTED,
        sourceLabel: securityName || "Holding",
        evidence: evidence("Holdings", "investment holding"),
        reviewReason:
          "The holding is missing a safe name, value, or as-of date.",
      });
      continue;
    }
    candidates.push({
      ordinal: ordinal++,
      kind: ImportCandidateKind.HOLDING,
      status: ImportCandidateStatus.READY,
      sourceLabel: securityName,
      evidence: evidence("Holdings", "investment holding"),
      proposedData: {
        account,
        asOfDate: asOfDate ?? statementEndAt!,
        securityName,
        tickerSymbol: tickerSymbol || undefined,
        quantity: money(quantity) ?? undefined,
        price: money(price) ?? undefined,
        currentValue: parsedValue,
        costBasis: money(costBasis) ?? undefined,
        allocationPercent: money(allocation) ?? undefined,
      },
    });
  }

  if (!structuredRows(text, "HOLDING").length) {
    for (const holding of providerHoldings(importType, text)) {
      if (!(asOfDate || statementEndAt)) continue;
      candidates.push({
        ordinal: ordinal++,
        kind: ImportCandidateKind.HOLDING,
        status: ImportCandidateStatus.READY,
        sourceLabel: holding.securityName,
        evidence: evidence("Holdings", "investment holding"),
        proposedData: {
          account,
          asOfDate: asOfDate ?? statementEndAt!,
          ...holding,
        },
      });
    }
  }

  if (
    importType === ImportType.FIDELITY_BROKERAGE_STATEMENT ||
    importType === ImportType.FIDELITY_TRADE_CONFIRMATION
  ) {
    for (const row of structuredRows(text, "ACTIVITY")) {
      const [
        transactionDateValue,
        typeValue,
        securityName,
        tickerSymbol,
        quantity,
        price,
        amount,
        fees,
        reference,
      ] = row;
      const transactionDate = date(transactionDateValue);
      const transactionType =
        InvestmentTransactionType[
          typeValue?.toUpperCase() as keyof typeof InvestmentTransactionType
        ];
      if (
        !transactionDate ||
        !transactionType ||
        (!money(amount) && !money(quantity))
      ) {
        candidates.push({
          ordinal: ordinal++,
          kind: ImportCandidateKind.INVESTMENT_TRANSACTION,
          status: ImportCandidateStatus.REJECTED,
          sourceLabel: securityName || "Activity",
          evidence: evidence("Activity", "investment transaction"),
          reviewReason:
            "The activity row does not establish a safe date, type, or amount/quantity.",
        });
        continue;
      }
      candidates.push({
        ordinal: ordinal++,
        kind: ImportCandidateKind.INVESTMENT_TRANSACTION,
        status: ImportCandidateStatus.READY,
        sourceLabel: securityName || typeValue,
        evidence: evidence("Activity", "investment transaction"),
        proposedData: {
          account,
          transactionDate,
          transactionType,
          securityName: securityName || undefined,
          tickerSymbol: tickerSymbol || undefined,
          quantity: money(quantity) ?? undefined,
          price: money(price) ?? undefined,
          amount: money(amount) ?? undefined,
          fees: money(fees) ?? undefined,
          sourceReference: reference || undefined,
        },
      });
    }
    if (!structuredRows(text, "ACTIVITY").length) {
      for (const activity of providerActivities(importType, text)) {
        candidates.push({
          ordinal: ordinal++,
          kind: ImportCandidateKind.INVESTMENT_TRANSACTION,
          status: ImportCandidateStatus.READY,
          sourceLabel: activity.securityName ?? "Investment activity",
          evidence: evidence("Activity", "investment transaction"),
          proposedData: { account, ...activity },
        });
      }
    }
  }

  if (importType === ImportType.FIDELITY_NETBENEFITS_STATEMENT) {
    for (const label of [
      "Employee Contributions",
      "Employer Contributions",
      "Loan Repayments",
      "Outstanding Loan Balance",
    ]) {
      const value = valueAfter(text, [label]);
      if (!value) continue;
      candidates.push({
        ordinal: ordinal++,
        kind: ImportCandidateKind.INFORMATIONAL,
        status: ImportCandidateStatus.INFORMATIONAL,
        sourceLabel: label,
        evidence: evidence("Statement summary", "informational only"),
        proposedData: {
          account,
          informationalLabel: label,
          informationalValue: value,
        },
        reviewReason:
          "This statement aggregate is informational and will not create transaction or debt history.",
      });
    }
  }

  for (const row of structuredRows(text, "INFORMATIONAL")) {
    candidates.push({
      ordinal: ordinal++,
      kind: ImportCandidateKind.INFORMATIONAL,
      status: ImportCandidateStatus.INFORMATIONAL,
      sourceLabel: row[0] || "Statement information",
      evidence: evidence("Statement summary", "informational only"),
      proposedData: {
        account,
        informationalLabel: row[0],
        informationalValue: row[1],
      },
      reviewReason:
        "This statement aggregate is shown for context and will not create transaction history.",
    });
  }
  if (!candidates.length)
    throw new ImportParseError(
      "No supported financial observations were found in this statement.",
    );
  return {
    importType,
    parserFamily,
    parserVersion,
    statementStartAt: statementStartAt ?? undefined,
    statementEndAt: statementEndAt ?? undefined,
    asOfDate: asOfDate ?? undefined,
    currency: "USD",
    candidates,
    usedOcr: extractionMethod === "ocr",
  };
}
