import {
  CalendarAmountSource,
  CalendarDateSource,
  CalendarEventStatus,
  CalendarEventType,
  ConfidenceLevel,
  DataSourceStatus,
  Prisma,
  RecurringFlowType,
  RecurringFrequency,
  RecurringStatus,
} from "@prisma/client";
import { describe, expect, it } from "vitest";
import { getEffectiveCalendarEvent } from "./effective";
import type { RawCalendarEvent } from "./types";

const now = new Date("2026-07-21T12:00:00.000Z");
const date = (value: string) => new Date(`${value}T00:00:00.000Z`);
const money = (value: string) => new Prisma.Decimal(value);

function raw(options: Partial<RawCalendarEvent> = {}): RawCalendarEvent {
  return {
    id: "event",
    userId: "owner",
    recurringStreamId: "stream",
    accountId: "account",
    eventType: CalendarEventType.BILL,
    title: "Example bill",
    eventDate: date("2026-07-25"),
    predictedPostingDate: date("2026-07-26"),
    expectedAmount: money("100"),
    actualAmount: null,
    currency: "USD",
    dateSource: CalendarDateSource.INFERRED,
    amountSource: CalendarAmountSource.ESTIMATED,
    confidenceLevel: ConfidenceLevel.MEDIUM,
    status: CalendarEventStatus.PREDICTED,
    isUserConfirmed: false,
    notes: "source note",
    updatedAt: now,
    account: {
      id: "account",
      userId: "owner",
      name: "Checking",
      dataSource: { status: DataSourceStatus.ACTIVE, lastUpdatedAt: now },
    },
    linkedTransaction: null,
    recurringStream: {
      id: "stream",
      userId: "owner",
      merchantName: "Example",
      description: "stream note",
      flowType: RecurringFlowType.BILL,
      frequency: RecurringFrequency.MONTHLY,
      averageAmount: money("95"),
      lastAmount: money("98"),
      predictedNextDate: date("2026-07-25"),
      predictedPostingDate: date("2026-07-26"),
      confirmedDueDate: null,
      dateSource: CalendarDateSource.INFERRED,
      confidenceLevel: ConfidenceLevel.MEDIUM,
      isActive: true,
      status: RecurringStatus.ACTIVE,
      typicalAccountId: "account",
      updatedAt: now,
      calendarOverrides: [],
      calendarEvents: [],
    },
    overrides: [],
    ...options,
  };
}

function override(values: Partial<RawCalendarEvent["overrides"][number]> = {}) {
  return {
    id: "override",
    confirmedDueDate: null,
    expectedAmountOverride: null,
    frequencyOverride: null,
    statusOverride: null,
    notABill: false,
    notes: null,
    updatedAt: now,
    ...values,
  };
}

describe("effective calendar values", () => {
  it("uses event override before stream override, source event, and stream fallback", () => {
    const event = raw();
    event.recurringStream!.calendarOverrides = [
      override({
        id: "stream-override",
        confirmedDueDate: date("2026-07-24"),
        expectedAmountOverride: money("110"),
        frequencyOverride: RecurringFrequency.QUARTERLY,
        notes: "stream override",
      }),
    ];
    event.overrides = [
      override({
        confirmedDueDate: date("2026-07-23"),
        expectedAmountOverride: money("120"),
        frequencyOverride: RecurringFrequency.ANNUAL,
        notes: "event override",
      }),
    ];
    const result = getEffectiveCalendarEvent(event, now);
    expect(result.confirmedDueDate).toEqual(date("2026-07-23"));
    expect(result.expectedAmount?.toString()).toBe("120");
    expect(result.frequency).toBe(RecurringFrequency.ANNUAL);
    expect(result.notes).toBe("event override");
  });

  it("keeps confirmed due date primary and posting prediction supplemental", () => {
    const result = getEffectiveCalendarEvent(
      raw({
        isUserConfirmed: true,
        dateSource: CalendarDateSource.USER_CONFIRMED,
        eventDate: date("2026-07-24"),
        predictedPostingDate: date("2026-07-27"),
      }),
      now,
    );
    expect(result.effectiveDate).toEqual(date("2026-07-24"));
    expect(result.predictedPostingDate).toEqual(date("2026-07-27"));
    expect(result.dateLabel).toBe("Confirmed");
  });

  it("never makes a predicted-only event overdue", () => {
    const result = getEffectiveCalendarEvent(
      raw({
        eventDate: date("2026-07-01"),
        status: CalendarEventStatus.OVERDUE,
      }),
      now,
    );
    expect(result.status).toBe(CalendarEventStatus.PREDICTED);
  });

  it("derives overdue only for a confirmed unpaid past due date", () => {
    const event = raw({ eventDate: date("2026-07-01"), isUserConfirmed: true });
    expect(getEffectiveCalendarEvent(event, now).status).toBe(
      CalendarEventStatus.OVERDUE,
    );
  });

  it.each([CalendarEventStatus.SKIPPED, CalendarEventStatus.INACTIVE])(
    "does not make %s events overdue",
    (status) => {
      const event = raw({
        eventDate: date("2026-07-01"),
        isUserConfirmed: true,
        status,
      });
      expect(getEffectiveCalendarEvent(event, now).status).toBe(status);
    },
  );

  it("treats an accepted posted link as paid", () => {
    const event = raw();
    event.linkedTransaction = {
      id: "transaction",
      userId: "owner",
      accountId: "account",
      originalName: "EXAMPLE",
      merchantName: "Example",
      amount: money("100"),
      currency: "USD",
      postedAt: date("2026-07-25"),
      status: "POSTED",
      override: null,
    };
    expect(getEffectiveCalendarEvent(event, now).status).toBe(
      CalendarEventStatus.PAID,
    );
  });
});
