import { CalendarEventStatus, DataSourceStatus, Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { deriveCalendarState } from "./state";
import type { RawCalendarData, RawCalendarEvent } from "./types";

const now = new Date("2026-07-21T12:00:00.000Z");

function data(event?: Partial<RawCalendarEvent>): RawCalendarData {
  return {
    ownerId: "owner",
    recurringStreamCount: event ? 1 : 0,
    accounts: [],
    transactions: [],
    events: event
      ? ([
          {
            id: "event",
            userId: "owner",
            status: CalendarEventStatus.PREDICTED,
            updatedAt: now,
            expectedAmount: new Prisma.Decimal("10"),
            overrides: [],
            recurringStream: null,
            account: null,
            ...event,
          },
        ] as RawCalendarEvent[])
      : [],
  };
}

describe("calendar data states", () => {
  it("distinguishes no recurring history from no events in a filtered range", () => {
    expect(deriveCalendarState(data(), [], now)).toMatchObject({
      isEmpty: true,
      noEventsInRange: true,
    });
    expect(deriveCalendarState(data({}), [], now)).toMatchObject({
      isEmpty: false,
      noEventsInRange: true,
    });
  });

  it("labels stale and partial source data", () => {
    const state = deriveCalendarState(
      data({
        account: {
          id: "account",
          userId: "owner",
          name: "Manual account",
          dataSource: {
            status: DataSourceStatus.NEEDS_ATTENTION,
            lastUpdatedAt: new Date("2026-07-01T00:00:00.000Z"),
          },
        },
      }),
      [],
      now,
    );
    expect(state.isStale).toBe(true);
    expect(state.isPartial).toBe(true);
    expect(state.stateMessages).toHaveLength(2);
  });

  it("recognizes when every prediction was dismissed", () => {
    const state = deriveCalendarState(
      data({
        overrides: [
          {
            id: "dismissed",
            confirmedDueDate: null,
            expectedAmountOverride: null,
            frequencyOverride: null,
            statusOverride: CalendarEventStatus.INACTIVE,
            notABill: true,
            notes: null,
            updatedAt: now,
          },
        ],
      }),
      [],
      now,
    );
    expect(state.allPredictionsDismissed).toBe(true);
  });
});
