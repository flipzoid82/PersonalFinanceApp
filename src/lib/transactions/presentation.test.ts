import { describe, expect, it } from "vitest";
import {
  formatTransactionCategory,
  isProviderCategoryCode,
} from "./presentation";

describe("transaction category presentation", () => {
  it("formats known provider-style categories for consumers", () => {
    expect(formatTransactionCategory("FOOD_AND_DRINK_COFFEE")).toBe(
      "Food and Drink · Coffee",
    );
    expect(formatTransactionCategory("TRANSFER_OUT_ACCOUNT_TRANSFER")).toBe(
      "Transfer Out · Account transfer",
    );
  });

  it("uses a readable lossless fallback for unknown codes", () => {
    expect(formatTransactionCategory("NEW_PROVIDER_CODE_X9")).toBe(
      "New Provider Code X9",
    );
    expect(isProviderCategoryCode("NEW_PROVIDER_CODE_X9")).toBe(true);
  });

  it("preserves owner-local labels and handles missing categories", () => {
    expect(formatTransactionCategory("Home Utilities")).toBe("Home Utilities");
    expect(formatTransactionCategory(null)).toBe("Uncategorized");
  });
});
