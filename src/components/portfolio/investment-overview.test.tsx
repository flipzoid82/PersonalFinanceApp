import { Prisma } from "@prisma/client";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  InvestmentComposition,
  InvestmentContributions,
} from "./investment-overview";
import type { InvestmentInsights } from "@/lib/portfolio";

const money = (value: string) => new Prisma.Decimal(value);
const insights = {
  accounts: [],
  accountAllocation: [
    {
      id: "one",
      label: "A very long retirement account name that must wrap safely",
      value: money("75"),
      percentage: money("75"),
    },
  ],
  holdingAllocation: [],
  knownHoldingsValue: money("0"),
  unallocatedValue: money("75"),
  contributions: [],
  contributionTotal: money("0"),
} satisfies InvestmentInsights;

describe("investment overview", () => {
  it("renders an accessible account-allocation equivalent with long-text containment", () => {
    const { container } = render(<InvestmentComposition insights={insights} />);
    expect(screen.getByRole("table")).toHaveAccessibleName(
      "Investment allocation values and percentages by account",
    );
    expect(
      screen.getAllByText(/very long retirement account name/)[0],
    ).toHaveClass("break-words");
    expect(container.querySelector("[aria-hidden='true']")).toBeInTheDocument();
  });

  it("explains unavailable contributions instead of inferring balance growth", () => {
    render(<InvestmentContributions insights={insights} />);
    expect(
      screen.getByText(/no current source record explicitly identifies/i),
    ).toBeVisible();
    expect(
      screen.getByText(
        /Balance growth, gains, dividends, transfers, and fees/i,
      ),
    ).toBeVisible();
  });
});
