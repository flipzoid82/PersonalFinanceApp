import { FinancialRole, Prisma } from "@prisma/client";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { calculateSpending } from "@/lib/spending";
import { SpendingPage } from "./spending-page";

describe("SpendingPage", () => {
  afterEach(cleanup);

  it("renders accessible equivalents, semantic cues, drill-downs, and resilient text", () => {
    const long =
      "A very long merchant value that must wrap without causing horizontal page overflow ".repeat(
        3,
      );
    const model = calculateSpending(
      [
        {
          id: "expense",
          merchant: long,
          category: "FOOD_AND_DRINK",
          role: FinancialRole.EXPENSE,
          amount: new Prisma.Decimal("123.45"),
          currency: "USD",
          postedAt: new Date("2026-08-05T00:00:00.000Z"),
          accountName: long,
        },
      ],
      new Date("2026-08-10T00:00:00.000Z"),
    );
    const { container } = render(<SpendingPage model={model} />);
    expect(
      screen.getByRole("heading", { name: "Spending" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Accessible spending by category values"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Food and Drink" }),
    ).toHaveAttribute("href", "/transactions?category=FOOD_AND_DRINK");
    expect(
      screen.getAllByRole("link", { name: /A very long merchant value/ })[0],
    ).toHaveAttribute("href", expect.stringContaining("search="));
    expect(container.querySelector(".break-words")).toBeTruthy();
    expect(
      [...container.querySelectorAll("span")].some((element) =>
        element.className.includes("semantic-negative-text"),
      ),
    ).toBe(true);
  });

  it("renders data-state messages through the shared warning notice", () => {
    const model = calculateSpending([], new Date("2026-08-10T00:00:00.000Z"));
    render(
      <SpendingPage
        model={{ ...model, stateMessages: ["Spending data may be partial."] }}
      />,
    );

    const notice = screen.getByRole("status");
    expect(notice).toHaveClass("bg-[var(--semantic-warning-bg)]");
    expect(
      screen.getByRole("heading", { name: "Spending data notice" }),
    ).toBeVisible();
    expect(screen.getByText("Spending data may be partial.")).toBeVisible();
  });
});
