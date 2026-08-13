// @vitest-environment node

import { FinancialRole, Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { calculateSpending, findUnusualPurchases } from "./calculations";
import type { SpendingTransaction } from "./types";

const NOW = new Date("2026-08-10T12:00:00.000Z");
const money = (value: string) => new Prisma.Decimal(value);

function transaction(
  id: string,
  amount: string,
  role: FinancialRole,
  postedAt = new Date("2026-08-05T00:00:00.000Z"),
  merchant = "Market",
  category = "Groceries",
): SpendingTransaction {
  return {
    id,
    merchant,
    category,
    role,
    amount: money(amount),
    currency: "USD",
    postedAt,
    accountName: "Checking",
  };
}

describe("Milestone 9 spending calculations", () => {
  it("uses finalized roles and refunds for current/prior totals and categories", () => {
    const result = calculateSpending(
      [
        transaction("expense", "100.10", FinancialRole.EXPENSE),
        transaction("refund", "20.05", FinancialRole.REFUND),
        transaction("income", "500", FinancialRole.INCOME),
        transaction("transfer", "999", FinancialRole.TRANSFER),
        transaction(
          "prior",
          "40",
          FinancialRole.EXPENSE,
          new Date("2026-07-05T00:00:00.000Z"),
        ),
      ],
      NOW,
    );

    expect(result.currentMonth.spending.toString()).toBe("80.05");
    expect(result.currentMonth.income.toString()).toBe("500");
    expect(result.currentMonth.netCashFlow.toString()).toBe("419.95");
    expect(result.previousMonth.spending.toString()).toBe("40");
    expect(result.categories[0].amount.toString()).toBe("80.05");
    expect(result.largestPurchases.map(({ id }) => id)).toEqual(["expense"]);
  });

  it("does not invent a percentage when prior spending is zero", () => {
    const result = calculateSpending(
      [transaction("expense", "12", FinancialRole.EXPENSE)],
      NOW,
    );
    expect(result.spendingChange).toBeNull();
  });

  it("uses exact median and MAD with four prior merchant expenses", () => {
    const history = ["10", "10", "12", "8"].map((amount, index) =>
      transaction(
        `prior-${index}`,
        amount,
        FinancialRole.EXPENSE,
        new Date(Date.UTC(2026, 6, index + 1)),
      ),
    );
    const flagged = transaction("current", "20", FinancialRole.EXPENSE);
    const result = findUnusualPurchases([...history, flagged], NOW);
    expect(result).toHaveLength(1);
    expect(result[0].priorMedian.toString()).toBe("10");
    expect(result[0].threshold.toString()).toBe("15");
    expect(result[0].priorCount).toBe(4);
  });

  it("excludes the current purchase from its baseline and requires four prior observations", () => {
    const insufficient = ["10", "10", "10"].map((amount, index) =>
      transaction(
        `prior-${index}`,
        amount,
        FinancialRole.EXPENSE,
        new Date(Date.UTC(2026, 6, index + 1)),
      ),
    );
    expect(
      findUnusualPurchases(
        [...insufficient, transaction("current", "100", FinancialRole.EXPENSE)],
        NOW,
      ),
    ).toEqual([]);
  });

  it("requires both unusual thresholds", () => {
    const history = ["8", "10", "10", "12"].map((amount, index) =>
      transaction(
        `baseline-${index}`,
        amount,
        FinancialRole.EXPENSE,
        new Date(Date.UTC(2026, 6, index + 1)),
      ),
    );
    expect(
      findUnusualPurchases(
        [
          ...history,
          transaction("only-one-threshold", "14", FinancialRole.EXPENSE),
        ],
        NOW,
      ),
    ).toEqual([]);
  });

  it("groups using effective merchant/category inputs deterministically", () => {
    const result = calculateSpending(
      [
        transaction("b", "5", FinancialRole.EXPENSE, undefined, "B", "Dining"),
        transaction("a", "10", FinancialRole.EXPENSE, undefined, "A", "Dining"),
      ],
      NOW,
    );
    expect(result.categories.map(({ label }) => label)).toEqual(["Dining"]);
    expect(result.merchants.map(({ label }) => label)).toEqual(["A", "B"]);
  });
});
