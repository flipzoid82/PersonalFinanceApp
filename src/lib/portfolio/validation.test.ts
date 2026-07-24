import { describe, expect, it } from "vitest";
import {
  accountSchema,
  investmentSnapshotSchema,
  manualAssetSchema,
} from "./validation";

describe("Milestone 5 validation", () => {
  it("preserves four-decimal exact money and normalizes currency", () => {
    const parsed = accountSchema.parse({
      name: "Manual checking",
      institutionName: "",
      accountType: "CHECKING",
      accountSubtype: "checking",
      currency: "usd",
      currentBalance: "12.3456",
      availableBalance: "",
      creditLimit: "",
      notes: "",
    });
    expect(parsed.currentBalance.toFixed(4)).toBe("12.3456");
    expect(parsed.currency).toBe("USD");
  });

  it("rejects excess precision and unsafe dates", () => {
    expect(
      manualAssetSchema.safeParse({
        name: "Asset",
        assetType: "HOME",
        currentValue: "1.23456",
        costBasis: "",
        currency: "USD",
        acquiredAt: "",
        notes: "",
      }).success,
    ).toBe(false);
    expect(
      investmentSnapshotSchema.safeParse({
        accountId: "account",
        totalValue: "1",
        vestedValue: "",
        asOfDate: "not-a-date",
        notes: "",
      }).success,
    ).toBe(false);
  });
});
