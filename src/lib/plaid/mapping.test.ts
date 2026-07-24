import { AccountType } from "@prisma/client";
import { describe, expect, it } from "vitest";
import type { AccountBase } from "plaid";
import { mapPlaidAccountType, plaidAccountData } from "./mapping";

function account(input: Partial<AccountBase>): AccountBase {
  return {
    account_id: "sandbox-account",
    balances: {
      available: null,
      current: 100,
      iso_currency_code: "USD",
      limit: null,
      unofficial_currency_code: null,
    },
    mask: "0000",
    name: "Sandbox account",
    official_name: null,
    type: "depository",
    subtype: "checking",
    ...input,
  } as AccountBase;
}

describe("Plaid account mapping", () => {
  it.each([
    ["depository", "checking", AccountType.CHECKING],
    ["depository", "savings", AccountType.SAVINGS],
    ["credit", "credit card", AccountType.CREDIT_CARD],
    ["loan", "mortgage", AccountType.MORTGAGE],
    ["loan", "student", AccountType.LOAN],
    ["investment", "401k", AccountType.FOUR_O_ONE_K],
    ["investment", "brokerage", AccountType.BROKERAGE],
  ])("maps %s/%s into a provider-neutral type", (type, subtype, expected) => {
    expect(mapPlaidAccountType(account({ type, subtype } as never))).toBe(
      expected,
    );
  });

  it("marks a missing current balance unavailable instead of known zero", () => {
    const data = plaidAccountData(
      account({
        balances: {
          available: null,
          current: null,
          iso_currency_code: "USD",
          limit: null,
          unofficial_currency_code: null,
        },
      }),
      "Sandbox Bank",
      new Date(),
    );
    expect(data.balanceAvailable).toBe(false);
    expect(data.currentBalance.toString()).toBe("0");
  });
});
