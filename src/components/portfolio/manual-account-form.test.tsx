import { AccountType } from "@prisma/client";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { InvestmentTemplate } from "@/lib/portfolio";
import { ManualAccountForm } from "./manual-account-form";

vi.mock("@/actions/portfolio", () => ({
  createManualAccountAction: vi.fn(),
}));

const individualTod: InvestmentTemplate = {
  id: "fidelity-individual-tod",
  label: "Fidelity Individual TOD",
  name: "Fidelity Individual TOD",
  institutionName: "Fidelity Investments",
  accountType: AccountType.BROKERAGE,
  accountSubtype: "Taxable brokerage — individual TOD",
  source: "MANUAL",
};

const employer401k: InvestmentTemplate = {
  id: "unitedhealth-401k",
  label: "UnitedHealth Group 401(k) Savings Plan",
  name: "UnitedHealth Group 401(k) Savings Plan",
  institutionName: "Fidelity NetBenefits",
  accountType: AccountType.FOUR_O_ONE_K,
  accountSubtype: "401(k) savings plan",
  source: "MANUAL",
};

describe("ManualAccountForm", () => {
  it("remounts uncontrolled fields when the selected template changes", () => {
    const { rerender } = render(
      <ManualAccountForm
        returnTo="/investments"
        investmentOnly
        template={individualTod}
      />,
    );

    expect(screen.getByLabelText("Account name")).toHaveValue(
      "Fidelity Individual TOD",
    );

    rerender(
      <ManualAccountForm
        returnTo="/investments"
        investmentOnly
        template={employer401k}
      />,
    );

    expect(screen.getByLabelText("Account name")).toHaveValue(
      "UnitedHealth Group 401(k) Savings Plan",
    );
    expect(screen.getByLabelText("Institution or source")).toHaveValue(
      "Fidelity NetBenefits",
    );
    expect(screen.getByLabelText("Account type")).toHaveValue(
      AccountType.FOUR_O_ONE_K,
    );
  });
});
