import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import CalendarError from "@/app/(dashboard)/error";
import CalendarLoading from "@/app/(dashboard)/calendar/loading";
import { CalendarPage } from "./calendar-page";
import type { CalendarViewModel } from "@/lib/calendar";

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
      screen.getByText(/Recurring-pattern detection is not implemented/),
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
    expect(screen.getByRole("alert")).toHaveTextContent("Amount is invalid.");
  });
});
