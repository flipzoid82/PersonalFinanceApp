import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import CalendarError from "@/app/(dashboard)/error";
import CalendarLoading from "@/app/(dashboard)/calendar/loading";
import { CalendarPage } from "./calendar-page";
import type { CalendarViewModel } from "@/lib/calendar";

afterEach(cleanup);

const now = new Date("2026-07-21T12:00:00.000Z");

function model(overrides: Partial<CalendarViewModel> = {}): CalendarViewModel {
  return {
    filters: {
      view: "month",
      month: new Date("2026-07-01T00:00:00.000Z"),
      selectedDay: null,
      days: 30,
      eventTypes: [],
      dateKind: "all",
    },
    monthDates: Array.from(
      { length: 42 },
      (_, index) => new Date(Date.UTC(2026, 5, 28 + index)),
    ),
    monthEvents: [],
    selectedDayEvents: [],
    upcomingEvents: [],
    matchCandidates: {},
    accounts: [],
    state: {
      isEmpty: false,
      noEventsInRange: true,
      allPredictionsDismissed: false,
      isStale: false,
      isPartial: false,
      stateMessages: [],
    },
    ...overrides,
  };
}

describe("Calendar page states and structure", () => {
  it("renders a clear empty state without invented events", () => {
    const empty = model({ state: { ...model().state, isEmpty: true } });
    render(<CalendarPage model={empty} now={now} returnTo="/calendar" />);
    expect(
      screen.getByRole("heading", { name: "No recurring history yet" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/connect Plaid Sandbox, or refresh detection/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Refresh recurring detection" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/predicted-only items never become overdue/i),
    ).toBeInTheDocument();
  });

  it("provides a seven-column month grid and one-column-friendly detail structure", () => {
    const { container } = render(
      <CalendarPage model={model()} now={now} returnTo="/calendar" />,
    );
    expect(
      screen.getByRole("grid", { name: "Monthly financial calendar" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("gridcell")).toHaveLength(42);
    expect(container.querySelector(".grid-cols-7")).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "Accessible month event list" }),
    ).toBeInTheDocument();
  });

  it("renders loading and safe error states", () => {
    const { unmount } = render(<CalendarLoading />);
    expect(
      screen.getByRole("status", { name: "Loading calendar" }),
    ).toBeInTheDocument();
    unmount();
    render(
      <CalendarError
        error={new Error("secret database detail")}
        reset={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("heading", { name: "Something went wrong" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("secret database detail"),
    ).not.toBeInTheDocument();
  });

  it("announces accessible mutation feedback", () => {
    render(
      <CalendarPage
        model={model()}
        now={now}
        returnTo="/calendar"
        message="Due date corrected."
        error="Amount is invalid."
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Due date corrected.");
    expect(screen.getByRole("status")).toHaveClass(
      "bg-[var(--semantic-positive-bg)]",
      "text-[var(--semantic-positive-text)]",
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Amount is invalid.");
    expect(screen.getByRole("alert")).toHaveClass(
      "bg-[var(--semantic-negative-bg)]",
      "text-[var(--semantic-negative-text)]",
    );
  });

  it("uses shared warning tokens for the Calendar data notice", () => {
    render(
      <CalendarPage
        model={model({
          state: {
            ...model().state,
            stateMessages: [
              "Some calendar sources have not been updated in seven days.",
              "A calendar source needs attention, so results may be partial.",
            ],
          },
        })}
        now={now}
        returnTo="/calendar"
      />,
    );

    const notice = screen.getByRole("status");
    expect(notice).toHaveClass(
      "border-[var(--semantic-warning-border)]",
      "bg-[var(--semantic-warning-bg)]",
      "text-[var(--semantic-warning-text)]",
    );
    expect(notice).not.toHaveClass(
      "border-amber-200",
      "bg-amber-50",
      "text-amber-900",
    );
    expect(
      screen.getByRole("heading", { name: "Calendar data notice" }),
    ).toBeVisible();
    expect(screen.getByText(/not been updated in seven days/i)).toBeVisible();
    expect(screen.getByText(/results may be partial/i)).toBeVisible();
  });
});
