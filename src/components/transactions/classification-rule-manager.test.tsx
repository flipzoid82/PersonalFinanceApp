import {
  ClassificationRuleMatchType,
  EconomicDirection,
  FinancialRole,
} from "@prisma/client";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/actions/transactions", () => ({
  confirmHistoricalRuleAction: vi.fn(),
}));

import { ClassificationRuleManager } from "./classification-rule-manager";

afterEach(cleanup);

describe("ClassificationRuleManager", () => {
  const rule = {
    id: "rule-1",
    matchType: ClassificationRuleMatchType.MERCHANT_EXACT,
    normalizedValue: "example market",
    accountId: null,
    account: null,
    transactionCategory: { name: "Groceries" },
    financialRole: FinancialRole.EXPENSE,
    economicDirection: EconomicDirection.OUTFLOW,
    priority: 100,
    isActive: true,
    appliesFrom: new Date("2026-08-31T00:00:00Z"),
  };

  it("keeps historical application behind a separate preview and confirmation", () => {
    render(
      <ClassificationRuleManager
        rules={[rule]}
        preview={{
          ruleId: rule.id,
          transactionIds: ["transaction-1", "transaction-2"],
          totalsByCurrency: { USD: "75.0000" },
        }}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Preview historical impact" }),
    ).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent(
      "2 historical transactions",
    );
    expect(
      screen.getByRole("button", {
        name: "Confirm historical application",
      }),
    ).toBeVisible();
  });
});
