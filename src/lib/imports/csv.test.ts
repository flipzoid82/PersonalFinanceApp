import { ImportCandidateStatus, ImportType } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  CsvParseError,
  detectCommonCsvMapping,
  detectCsvImportType,
  mapGenericCsv,
  parseCsv,
} from "./csv";

describe("generic CSV imports", () => {
  it("parses quoted commas, UTF-8, CRLF, and blank rows", () => {
    expect(
      parseCsv(
        'Account,Date,Balance\r\n"Café, Savings",2026-08-01,"1,234.56"\r\n\r\n',
      ),
    ).toEqual({
      headers: ["Account", "Date", "Balance"],
      rows: [["Café, Savings", "2026-08-01", "1,234.56"]],
    });
  });

  it("rejects duplicate headers and malformed quoted rows", () => {
    expect(() => parseCsv("Account,account\na,b")).toThrow(CsvParseError);
    expect(() => parseCsv('Account,Date\n"unfinished,2026-01-01')).toThrow(
      "unterminated",
    );
  });

  it("detects common balance and holding header variants", () => {
    expect(
      detectCommonCsvMapping([
        "Account Name",
        "As Of Date",
        "Market Value",
        "Symbol",
        "Shares",
      ]),
    ).toMatchObject({
      account: "Account Name",
      asOfDate: "As Of Date",
      value: "Market Value",
      tickerSymbol: "Symbol",
      quantity: "Shares",
    });
  });

  it("routes structurally clear balance and holdings CSVs without a manual taxonomy choice", () => {
    expect(
      detectCsvImportType([
        "Account Name",
        "As Of Date",
        "Current Value",
        "Currency",
      ]),
    ).toEqual({
      confidence: "strong",
      importType: "GENERIC_ACCOUNT_BALANCE_CSV",
    });
    expect(
      detectCsvImportType([
        "Account",
        "Date",
        "Security",
        "Market Value",
        "Shares",
      ]),
    ).toEqual({
      confidence: "strong",
      importType: "GENERIC_INVESTMENT_HOLDINGS_CSV",
    });
  });

  it("limits ambiguous CSV confirmation to balance versus holdings", () => {
    expect(detectCsvImportType(["Account", "Date", "Notes"])).toEqual({
      confidence: "ambiguous",
      plausibleTypes: [
        "GENERIC_ACCOUNT_BALANCE_CSV",
        "GENERIC_INVESTMENT_HOLDINGS_CSV",
      ],
    });
  });

  it("maps exact balance snapshots and treats formula-like cells as inert rejected data", () => {
    const result = mapGenericCsv(
      "Account,Date,Balance,Currency,Ignored\nEmergency Fund,2026-08-01,1234.5678,USD,=2+2\nEmergency Fund,08/02/2026,=9+9,USD,unused",
      {
        importType: "GENERIC_ACCOUNT_BALANCE_CSV",
        account: "Account",
        asOfDate: "Date",
        value: "Balance",
        currency: "Currency",
      },
    );
    expect(result.importType).toBe(ImportType.GENERIC_ACCOUNT_BALANCE_CSV);
    expect(result.candidates[0].proposedData?.currentBalance).toBe("1234.5678");
    expect(result.candidates[1]).toMatchObject({
      status: ImportCandidateStatus.REJECTED,
    });
  });

  it("requires a confirmed currency and unambiguous date", () => {
    const result = mapGenericCsv(
      "Account,Date,Balance\nSavings,2026-08-01,100",
      {
        importType: "GENERIC_ACCOUNT_BALANCE_CSV",
        account: "Account",
        asOfDate: "Date",
        value: "Balance",
      },
    );
    expect(result.candidates[0].reviewReason).toContain("currency");
  });

  it("maps holdings with optional exact quantity, price, and cost basis", () => {
    const result = mapGenericCsv(
      "Account,As Of Date,Security,Value,Currency,Quantity,Price,Cost Basis\nBrokerage,2026-08-01,Synthetic Index Fund,2500.00,USD,10.5,238.0952,2000",
      {
        importType: "GENERIC_INVESTMENT_HOLDINGS_CSV",
        account: "Account",
        asOfDate: "As Of Date",
        securityName: "Security",
        value: "Value",
        currency: "Currency",
        quantity: "Quantity",
        price: "Price",
        costBasis: "Cost Basis",
      },
    );
    expect(result.candidates[0].proposedData).toMatchObject({
      securityName: "Synthetic Index Fund",
      currentValue: "2500",
      quantity: "10.5",
      price: "238.0952",
      costBasis: "2000",
    });
  });
});
