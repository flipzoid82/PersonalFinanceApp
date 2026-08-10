import { FinancialRole } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { effectiveTransactionValues } from "./effective";

describe("effective transaction values", () => {
  it("uses local values ahead of provider values", () => {
    expect(
      effectiveTransactionValues({
        originalName: "ORIGINAL NAME",
        merchantName: "Provider merchant",
        providerCategory: "Provider category",
        override: {
          merchantNameOverride: "Owner merchant",
          categoryOverride: "Owner category",
          financialRoleOverride: FinancialRole.REFUND,
          notes: "Owner note",
          excludedFromReports: true,
        },
      }),
    ).toMatchObject({
      merchant: "Owner merchant",
      category: "Owner category",
      financialRole: FinancialRole.REFUND,
      notes: "Owner note",
      excludedFromReports: true,
      hasLocalOverride: true,
    });
  });

  it("falls back deterministically without inventing classification", () => {
    expect(
      effectiveTransactionValues({
        originalName: "Original",
        merchantName: null,
        providerCategory: null,
        override: null,
      }),
    ).toEqual({
      merchant: "Original",
      category: "Uncategorized",
      financialRole: null,
      notes: null,
      excludedFromReports: false,
      hasLocalOverride: false,
    });
  });
});
