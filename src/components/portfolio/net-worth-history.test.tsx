import { Prisma } from "@prisma/client";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NetWorthHistory } from "./net-worth-history";

const money = (value: string) => new Prisma.Decimal(value);

describe("NetWorthHistory", () => {
  it("renders range state, non-color direction, Partial history, and a table equivalent", () => {
    render(
      <NetWorthHistory
        history={{
          range: "3m",
          rangeLabel: "3M",
          isPartial: true,
          partialReasons: ["Current manual values have no history."],
          change: money("25"),
          points: [
            {
              date: new Date("2026-06-01T00:00:00.000Z"),
              assets: money("100"),
              debts: money("40"),
              value: money("60"),
            },
            {
              date: new Date("2026-08-01T00:00:00.000Z"),
              assets: money("130"),
              debts: money("45"),
              value: money("85"),
            },
          ],
        }}
      />,
    );

    expect(
      screen.getByRole("link", { name: "3M net-worth history" }),
    ).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("status")).toHaveTextContent("Partial history");
    expect(screen.getByText("+$25.00")).toBeVisible();
    expect(screen.getByRole("img")).toHaveAccessibleName(/Stored net worth/);
    fireEvent.click(
      screen.getByText("View accessible history table (2 points)"),
    );
    expect(screen.getByRole("table")).toHaveAccessibleName(
      "Stored net-worth history for 3M",
    );
    expect(screen.getByText("−$45.00")).toBeInTheDocument();
  });
});
