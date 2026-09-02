import {
  ClassificationProvenance,
  EconomicDirection,
  FinancialRole,
  Prisma,
} from "@prisma/client";
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
      categoryProvenance: ClassificationProvenance.OWNER_OVERRIDE,
      notes: "Owner note",
      excludedFromReports: true,
      hasLocalOverride: true,
    });
  });

  it("requires review when an effective owner role conflicts with source-adapted direction", () => {
    expect(
      effectiveTransactionValues({
        originalName: "Refund",
        merchantName: "Example merchant",
        providerCategory: "Refund",
        amount: new Prisma.Decimal("25"),
        override: {
          categoryOverride: "Groceries",
          financialRoleOverride: FinancialRole.REFUND,
        },
      }),
    ).toMatchObject({
      economicDirection: EconomicDirection.OUTFLOW,
      needsReview: true,
      reasonCodes: expect.arrayContaining(["ROLE_DIRECTION_CONFLICT"]),
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
    ).toMatchObject({
      merchant: "Original",
      category: "Uncategorized",
      financialRole: null,
      notes: null,
      excludedFromReports: false,
      hasLocalOverride: false,
      needsReview: true,
    });
  });
});
