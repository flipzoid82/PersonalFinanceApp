import { CalendarEventStatus, Prisma } from "@prisma/client";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { BillsViewModel } from "@/lib/bills";
import { BillsPage } from "./bills-page";

describe("BillsPage", () => {
  afterEach(cleanup);

  it("provides URL-backed ranges and distinct empty bill/income states", () => {
    const model: BillsViewModel = {
      days: 30,
      rangeStart: new Date("2026-08-10T00:00:00.000Z"),
      rangeEnd: new Date("2026-09-09T00:00:00.000Z"),
      bills: [],
      expectedIncome: [],
      inactive: [],
      upcomingTotal: new Prisma.Decimal(0),
      confirmedCount: 0,
      predictedCount: 0,
      needsConfirmationCount: 0,
      stateMessages: [],
      isEmpty: true,
    };
    render(<BillsPage model={model} />);
    expect(screen.getByRole("heading", { name: "Bills" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "30 days" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "90 days" })).toHaveAttribute(
      "href",
      "/bills?days=90",
    );
    expect(
      screen.getByText("No recurring outflows are expected in this range."),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "No expected recurring income is available in this range.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(CalendarEventStatus.OVERDUE),
    ).not.toBeInTheDocument();
  });

  it("renders data-state messages through the shared warning notice", () => {
    const model: BillsViewModel = {
      days: 30,
      rangeStart: new Date("2026-08-10T00:00:00.000Z"),
      rangeEnd: new Date("2026-09-09T00:00:00.000Z"),
      bills: [],
      expectedIncome: [],
      inactive: [],
      upcomingTotal: new Prisma.Decimal(0),
      confirmedCount: 0,
      predictedCount: 0,
      needsConfirmationCount: 0,
      stateMessages: ["A bill source needs attention."],
      isEmpty: true,
    };
    render(<BillsPage model={model} />);

    const notice = screen.getByRole("status");
    expect(notice).toHaveClass("bg-[var(--semantic-warning-bg)]");
    expect(
      screen.getByRole("heading", { name: "Bill data notice" }),
    ).toBeVisible();
    expect(screen.getByText("A bill source needs attention.")).toBeVisible();
  });
});
