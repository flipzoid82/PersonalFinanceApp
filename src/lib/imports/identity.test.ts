import { ImportCandidateKind, InvestmentTransactionType } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { candidateIdentity, sanitizeFilename } from "./identity";

const candidate = {
  kind: ImportCandidateKind.INVESTMENT_TRANSACTION,
  proposedData: {
    account: {
      sourceKey: "fidelity:1234",
      displayName: "Synthetic Brokerage",
      accountType: "BROKERAGE" as const,
      currency: "USD",
    },
    transactionDate: "2026-08-01",
    transactionType: InvestmentTransactionType.BUY,
    tickerSymbol: "TEST",
    quantity: "2",
    price: "10",
    amount: "20",
    sourceReference: "SAFE-REF",
  },
};

describe("import identities", () => {
  it("deduplicates the same Fidelity activity across monthly and confirmation parsers", () => {
    expect(
      candidateIdentity(
        "FidelityBrokerageStatementParser",
        candidate,
        "account-key",
      ),
    ).toBe(
      candidateIdentity(
        "FidelityTradeConfirmationParser",
        candidate,
        "account-key",
      ),
    );
  });

  it("keeps a different date distinct even when the amount is equal", () => {
    const later = {
      ...candidate,
      proposedData: {
        ...candidate.proposedData,
        transactionDate: "2026-08-02",
      },
    };
    expect(
      candidateIdentity(
        "FidelityBrokerageStatementParser",
        candidate,
        "account-key",
      ),
    ).not.toBe(
      candidateIdentity(
        "FidelityBrokerageStatementParser",
        later,
        "account-key",
      ),
    );
  });

  it("sanitizes paths, control characters, and long names", () => {
    const value = sanitizeFilename(`C:\\private\\${"a".repeat(200)}\u0000.pdf`);
    expect(value).not.toContain("private");
    expect(value).not.toContain("\u0000");
    expect(value.length).toBeLessThanOrEqual(160);
  });
});
