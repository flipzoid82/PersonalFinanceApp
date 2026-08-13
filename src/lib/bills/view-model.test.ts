// @vitest-environment node

import {
  CalendarAmountSource,
  CalendarDateSource,
  CalendarEventStatus,
  CalendarEventType,
  ConfidenceLevel,
  ConnectionStatus,
  DataSourceStatus,
  Prisma,
  RecurringFlowType,
  RecurringFrequency,
  RecurringStatus,
} from "@prisma/client";
import { describe, expect, it } from "vitest";
import type { RawCalendarData, RawCalendarEvent } from "@/lib/calendar";
import { buildBillsViewModel, parseBillRange } from "./view-model";

const NOW = new Date("2026-08-10T12:00:00.000Z");

function event(
  id: string,
  type: CalendarEventType,
  options: Partial<RawCalendarEvent> = {},
): RawCalendarEvent {
  return {
    id,
    userId: "owner",
    recurringStreamId: `stream-${id}`,
    accountId: "account",
    eventType: type,
    title: id,
    eventDate: new Date("2026-08-20T00:00:00.000Z"),
    predictedPostingDate: new Date("2026-08-21T00:00:00.000Z"),
    expectedAmount: new Prisma.Decimal("100"),
    actualAmount: null,
    currency: "USD",
    dateSource: CalendarDateSource.INFERRED,
    amountSource: CalendarAmountSource.ESTIMATED,
    confidenceLevel: ConfidenceLevel.HIGH,
    status: CalendarEventStatus.PREDICTED,
    isUserConfirmed: false,
    notes: null,
    updatedAt: NOW,
    account: {
      id: "account",
      userId: "owner",
      name: "Checking",
      dataSource: { status: DataSourceStatus.ACTIVE, lastUpdatedAt: NOW },
    },
    linkedTransaction: null,
    overrides: [],
    recurringStream: {
      id: `stream-${id}`,
      userId: "owner",
      merchantName: id,
      description: id,
      flowType:
        type === CalendarEventType.EXPECTED_INCOME
          ? RecurringFlowType.EXPECTED_INCOME
          : RecurringFlowType.BILL,
      frequency: RecurringFrequency.MONTHLY,
      averageAmount: new Prisma.Decimal("100"),
      lastAmount: new Prisma.Decimal("100"),
      predictedNextDate: new Date("2026-08-20T00:00:00.000Z"),
      predictedPostingDate: new Date("2026-08-21T00:00:00.000Z"),
      confirmedDueDate: null,
      dateSource: CalendarDateSource.INFERRED,
      confidenceLevel: ConfidenceLevel.HIGH,
      isActive: true,
      status: RecurringStatus.ACTIVE,
      typicalAccountId: "account",
      updatedAt: NOW,
      calendarOverrides: [],
      calendarEvents: [],
    },
    ...options,
  };
}

function data(events: RawCalendarEvent[]): RawCalendarData {
  return {
    ownerId: "owner",
    events,
    transactions: [],
    accounts: [],
    recurringStreamCount: events.length,
  };
}

describe("Milestone 9 bills view", () => {
  it("defaults invalid ranges to 30 days and accepts canonical ranges", () => {
    expect(parseBillRange(undefined)).toBe(30);
    expect(parseBillRange("unexpected")).toBe(30);
    expect(parseBillRange("14")).toBe(14);
    expect(parseBillRange("60")).toBe(60);
    expect(parseBillRange("90")).toBe(90);
  });

  it("separates expected income and excludes it from bill totals", () => {
    const result = buildBillsViewModel(
      data([
        event("bill", CalendarEventType.BILL),
        event("income", CalendarEventType.EXPECTED_INCOME, {
          expectedAmount: new Prisma.Decimal("500"),
        }),
      ]),
      30,
      NOW,
    );
    expect(result.bills.map(({ id }) => id)).toEqual(["bill"]);
    expect(result.expectedIncome.map(({ id }) => id)).toEqual(["income"]);
    expect(result.upcomingTotal.toString()).toBe("100");
  });

  it("honors not-a-bill and inactive overrides while retaining audit visibility", () => {
    const dismissed = event("dismissed", CalendarEventType.BILL, {
      overrides: [
        {
          id: "override",
          confirmedDueDate: null,
          expectedAmountOverride: null,
          frequencyOverride: null,
          statusOverride: null,
          notABill: true,
          notes: null,
          updatedAt: NOW,
        },
      ],
    });
    const result = buildBillsViewModel(data([dismissed]), 30, NOW);
    expect(result.bills).toEqual([]);
    expect(result.inactive.map(({ id }) => id)).toEqual(["dismissed"]);
  });

  it("never makes a predicted-only event overdue", () => {
    const predicted = event("old-prediction", CalendarEventType.BILL, {
      eventDate: new Date("2026-08-01T00:00:00.000Z"),
      status: CalendarEventStatus.OVERDUE,
    });
    const result = buildBillsViewModel(
      data([predicted]),
      30,
      new Date("2026-07-31T00:00:00.000Z"),
    );
    expect(result.bills[0].status).toBe(CalendarEventStatus.PREDICTED);
  });

  it("rejects records outside owner scope", () => {
    const foreign = event("foreign", CalendarEventType.BILL, {
      userId: "other",
    });
    expect(buildBillsViewModel(data([foreign]), 30, NOW).bills).toEqual([]);
  });

  it("excludes occurrences belonging only to a disconnected historical account", () => {
    const historical = event("historical", CalendarEventType.BILL);
    historical.account = {
      ...historical.account!,
      isActive: false,
      institutionConnection: { status: ConnectionStatus.DISCONNECTED },
    };
    const result = buildBillsViewModel(data([historical]), 30, NOW);
    expect(result.bills).toEqual([]);
    expect(result.upcomingTotal.toString()).toBe("0");
  });
});
