import {
  ImportCandidateKind,
  ImportCandidateStatus,
  ImportType,
} from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  detectStatementType,
  ImportParseError,
  parseStatementText,
} from "./parsers";

const common = `
Statement period: July 1, 2026 through July 31, 2026
As of: July 31, 2026
Account number: ****1234
Ending balance: $10,500.2500
HOLDING: Synthetic Target Fund | STFX | 100 | 95.0025 | 9500.25 | 8000 | 90.48
INFORMATIONAL: Employee contributions this period | $500.00
`;

describe("deterministic statement parsers", () => {
  it.each([
    [
      "Fidelity NetBenefits retirement statement\n401(k) Savings Plan",
      ImportType.FIDELITY_NETBENEFITS_STATEMENT,
    ],
    [
      "Fidelity brokerage account statement",
      ImportType.FIDELITY_BROKERAGE_STATEMENT,
    ],
    ["Fidelity trade confirmation", ImportType.FIDELITY_TRADE_CONFIRMATION],
    ["Thrift Savings Plan TSP account statement", ImportType.TSP_STATEMENT],
  ])("detects %s", (text, expected) => {
    expect(detectStatementType(text)).toBe(expected);
  });

  it.each([
    [
      ImportType.FIDELITY_NETBENEFITS_STATEMENT,
      "FidelityNetBenefitsParser",
      "Fidelity NetBenefits 401(k) Savings Plan",
    ],
    [
      ImportType.FIDELITY_BROKERAGE_STATEMENT,
      "FidelityBrokerageStatementParser",
      "Fidelity brokerage account statement",
    ],
    [
      ImportType.FIDELITY_TRADE_CONFIRMATION,
      "FidelityTradeConfirmationParser",
      "Fidelity trade confirmation",
    ],
    [
      ImportType.TSP_STATEMENT,
      "TspStatementParser",
      "Thrift Savings Plan TSP account statement",
    ],
  ])("extracts safe observations for %s", (type, family, sourceHeader) => {
    const result = parseStatementText(`${sourceHeader}\n${common}`, type);
    expect(result).toMatchObject({
      parserFamily: family,
      parserVersion: "1.0.0",
      asOfDate: "2026-07-31",
      currency: "USD",
    });
    expect(result.candidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: ImportCandidateKind.INVESTMENT_BALANCE_SNAPSHOT,
          status: ImportCandidateStatus.READY,
        }),
        expect.objectContaining({
          kind: ImportCandidateKind.HOLDING,
          status: ImportCandidateStatus.READY,
        }),
        expect.objectContaining({
          kind: ImportCandidateKind.INFORMATIONAL,
          status: ImportCandidateStatus.INFORMATIONAL,
        }),
      ]),
    );
  });

  it("imports explicit brokerage activity but never synthesizes aggregate contributions", () => {
    const result = parseStatementText(
      `Fidelity brokerage account statement\n${common}\nACTIVITY: 2026-07-12 | BUY | Synthetic Equity | SYNE | 2 | 50 | 100 | 0 | REF-001`,
      ImportType.FIDELITY_BROKERAGE_STATEMENT,
    );
    expect(
      result.candidates.filter(
        (item) => item.kind === ImportCandidateKind.INVESTMENT_TRANSACTION,
      ),
    ).toHaveLength(1);
    expect(
      result.candidates.find((item) =>
        item.sourceLabel?.includes("contribution"),
      ),
    ).toMatchObject({ status: ImportCandidateStatus.INFORMATIONAL });
  });

  it("does not synthesize projected cash flow or TSP loan activity", () => {
    const result = parseStatementText(
      `Thrift Savings Plan\n${common}\nProjected cash flow: $900\nPlan loan: $1200`,
      ImportType.TSP_STATEMENT,
    );
    expect(
      result.candidates.some(
        (item) => item.kind === ImportCandidateKind.INVESTMENT_TRANSACTION,
      ),
    ).toBe(false);
  });

  it("requests OCR for insufficient native text and rejects unknown structures", () => {
    expect(() =>
      detectStatementType("Unknown provider statement content"),
    ).toThrow(ImportParseError);
    expect(() =>
      parseStatementText("image only", ImportType.TSP_STATEMENT),
    ).toThrow("enough extractable text");
  });

  it("records OCR evidence explicitly without changing parser semantics", () => {
    const result = parseStatementText(
      `Fidelity brokerage account statement\n${common}`,
      ImportType.FIDELITY_BROKERAGE_STATEMENT,
      "ocr",
    );

    expect(result.usedOcr).toBe(true);
    expect(result.candidates).not.toHaveLength(0);
    expect(
      result.candidates.every(
        (candidate) => candidate.evidence.extractionMethod === "ocr",
      ),
    ).toBe(true);
  });

  it("rejects a selected document family that conflicts with source evidence", () => {
    expect(() =>
      parseStatementText(
        `Fidelity trade confirmation\n${common}`,
        ImportType.TSP_STATEMENT,
      ),
    ).toThrow("does not match");
  });

  it("parses the supplied NetBenefits layout without unnecessary OCR", () => {
    const result = parseStatementText(`
401(k) Savings Plan Account Statement
Your Account Summary Statement Period: 07/01/2026 to 07/31/2026
Ending Balance
$50,200.00
Your account is allocated among the asset classes specified below as of 07/31/2026.
Market Value of Your Account Statement Period: 07/01/2026 to 07/31/2026
Investment
Shares 06/30
Shares 07/31
Price 06/30
Price 07/31
Value 06/30
Value 07/31
Sample Target 2045
310.000
320.000
$154.8387
$156.8750
$48,000.00
$50,200.00
Account Totals
Employee Contributions
$500.00
Outstanding Loan Balance
$4,800.00`);
    expect(result).toMatchObject({
      importType: ImportType.FIDELITY_NETBENEFITS_STATEMENT,
      statementEndAt: "2026-07-31",
      usedOcr: false,
    });
    expect(result.candidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: ImportCandidateKind.INVESTMENT_BALANCE_SNAPSHOT,
          status: ImportCandidateStatus.READY,
        }),
        expect.objectContaining({
          kind: ImportCandidateKind.HOLDING,
          status: ImportCandidateStatus.READY,
        }),
        expect.objectContaining({
          sourceLabel: "Employee Contributions",
          status: ImportCandidateStatus.INFORMATIONAL,
        }),
      ]),
    );
    expect(
      result.candidates.some(
        (candidate) =>
          candidate.kind === ImportCandidateKind.INVESTMENT_TRANSACTION,
      ),
    ).toBe(false);
  });

  it("parses the supplied brokerage layout and explicit purchase", () => {
    const result = parseStatementText(`
INVESTMENT REPORT
July 1, 2026 - July 31, 2026
FIDELITY ACCOUNT SAMPLE TEST USER - INDIVIDUAL TOD
Account Number: TEST-123456789
Your Account Value
$15,750.50
Ending Account Value
$15,750.50
Account Holdings
Description
Quantity
Price Per Unit
Ending Market Value
Total Cost Basis
Unrealized Gain/Loss
CASH
750.500
$1.0000
$750.50
not applicable
not applicable
SAMPLE HEALTH CORP (SHC)
30.000
$500.0000
$15,000.00
$12,400.00
$2,600.00
Total Holdings
Securities Bought & Sold
Settlement Date
Security Name
Symbol/CUSIP
Description
Quantity
Price
Amount
07/17/2026
SAMPLE HEALTH CORP
SHC / TESTCUSIP001
You Bought
5.000
$480.00000
-$2,400.00`);
    expect(result).toMatchObject({
      importType: ImportType.FIDELITY_BROKERAGE_STATEMENT,
      statementEndAt: "2026-07-31",
    });
    expect(
      result.candidates.filter((candidate) => candidate.kind === "HOLDING"),
    ).toHaveLength(2);
    expect(result.candidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: ImportCandidateKind.INVESTMENT_TRANSACTION,
          status: ImportCandidateStatus.READY,
        }),
      ]),
    );
  });

  it("detects the supplied transaction-confirmation wording and two-digit dates", () => {
    const result = parseStatementText(`
TRANSACTION CONFIRMATION
Confirmation of purchase made through your SAMPLE STOCK PLAN on 07/15/26.
YOU PURCHASED 5.000 AT $480.0000 PURCHASE PRICE
SECURITY DESCRIPTION SYMBOL: SHC | SAMPLE HEALTH CORP TEST ESPP
BROKERAGE NO.
TRADE DATE
SETTLEMENT DATE
TRANS NO.
07-15-26
07-17-26
TESTTRANS777
Accumulated Contributions
$2,400.00`);
    expect(result.importType).toBe(ImportType.FIDELITY_TRADE_CONFIRMATION);
    expect(result.candidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: ImportCandidateKind.INVESTMENT_TRANSACTION,
          status: ImportCandidateStatus.READY,
          proposedData: expect.objectContaining({
            transactionDate: "2026-07-15",
            quantity: "5",
            price: "480",
            amount: "-2400",
          }),
        }),
      ]),
    );
  });

  it("parses clear OCR-derived TSP closing values conservatively", () => {
    const result = parseStatementText(
      `Thrift Savings Plan\nStatement Date July 31, 2026\nAccount Summary 07-01-2026 to 07-31-2026\nClosing Balance $36,000.00\nYour Balances As of 07-31-2026\nFund allocation\nL 2045 Fund 1800.0000 $20.0000 $36,000.00 100%`,
      undefined,
      "ocr",
    );
    expect(result).toMatchObject({
      importType: ImportType.TSP_STATEMENT,
      asOfDate: "2026-07-31",
      usedOcr: true,
    });
    expect(result.candidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: ImportCandidateKind.INVESTMENT_BALANCE_SNAPSHOT,
          status: ImportCandidateStatus.READY,
        }),
        expect.objectContaining({
          kind: ImportCandidateKind.HOLDING,
          status: ImportCandidateStatus.READY,
        }),
      ]),
    );
  });
});
