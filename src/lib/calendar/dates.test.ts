import { CalendarEventType } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  addUtcMonths,
  formatIsoDate,
  getMonthGridDates,
  upcomingWindow,
} from "./dates";
import { parseCalendarFilters } from "./filters";

const now = new Date("2026-01-31T18:00:00.000Z");

describe("calendar dates and filters", () => {
  it("navigates across year and short-month boundaries", () => {
    expect(addUtcMonths(now, 1).toISOString()).toBe("2026-02-01T00:00:00.000Z");
    expect(addUtcMonths(now, -1).toISOString()).toBe(
      "2025-12-01T00:00:00.000Z",
    );
    const grid = getMonthGridDates(new Date("2026-02-01T00:00:00.000Z"));
    expect(grid).toHaveLength(42);
    expect(formatIsoDate(grid[0])).toBe("2026-02-01");
    expect(formatIsoDate(grid[41])).toBe("2026-03-14");
  });

  it.each([14, 30, 60, 90] as const)(
    "builds the inclusive %i-day range",
    (days) => {
      const range = upcomingWindow(now, days);
      expect(formatIsoDate(range.start)).toBe("2026-01-31");
      const elapsed =
        (range.end.getTime() - range.start.getTime()) / 86_400_000;
      expect(elapsed).toBe(days);
    },
  );

  it("parses event, confirmation, view, and range filters", () => {
    const filters = parseCalendarFilters(
      {
        view: "upcoming",
        month: "2026-02",
        days: "60",
        types: [CalendarEventType.BILL, CalendarEventType.EXPECTED_INCOME],
        kind: "confirmed",
      },
      now,
    );
    expect(filters).toMatchObject({
      view: "upcoming",
      days: 60,
      eventTypes: [CalendarEventType.BILL, CalendarEventType.EXPECTED_INCOME],
      dateKind: "confirmed",
    });
    expect(formatIsoDate(filters.month)).toBe("2026-02-01");
  });

  it("falls back safely for invalid URL values", () => {
    const filters = parseCalendarFilters(
      { month: "bad", days: "45", kind: "bad" },
      now,
    );
    expect(filters.days).toBe(30);
    expect(filters.dateKind).toBe("all");
    expect(formatIsoDate(filters.month)).toBe("2026-01-01");
  });
});
