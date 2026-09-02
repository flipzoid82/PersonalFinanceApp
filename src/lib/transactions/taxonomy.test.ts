import { TransactionCategoryKind } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  normalizeCategoryName,
  STARTER_TRANSACTION_CATEGORIES,
} from "./taxonomy";

describe("starter transaction-purpose taxonomy", () => {
  it("has stable unique keys and normalized names for 17 expense and 4 income categories", () => {
    expect(STARTER_TRANSACTION_CATEGORIES).toHaveLength(21);
    expect(
      STARTER_TRANSACTION_CATEGORIES.filter(
        ([, kind]) => kind === TransactionCategoryKind.EXPENSE,
      ),
    ).toHaveLength(17);
    expect(
      STARTER_TRANSACTION_CATEGORIES.filter(
        ([, kind]) => kind === TransactionCategoryKind.INCOME,
      ),
    ).toHaveLength(4);
    expect(
      new Set(STARTER_TRANSACTION_CATEGORIES.map(([key]) => key)).size,
    ).toBe(21);
    expect(
      new Set(
        STARTER_TRANSACTION_CATEGORIES.map(([, , name]) =>
          normalizeCategoryName(name),
        ),
      ).size,
    ).toBe(21);
  });

  it("does not model saving, reserves, goals, or extra principal as spending purposes", () => {
    const names = STARTER_TRANSACTION_CATEGORIES.map(([, , name]) =>
      name.toLowerCase(),
    );
    expect(names).not.toContain("savings");
    expect(names).not.toContain("emergency fund");
    expect(names).not.toContain("reserve");
    expect(names).not.toContain("extra debt principal");
  });
});
