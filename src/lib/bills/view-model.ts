import {
  CalendarEventStatus,
  CalendarEventType,
  ConnectionStatus,
  Prisma,
} from "@prisma/client";
import { addUtcDays, startOfUtcDay } from "@/lib/dashboard/dates";
import { getEffectiveCalendarEvent } from "@/lib/calendar/effective";
import { deriveCalendarState } from "@/lib/calendar/state";
import type { RawCalendarData } from "@/lib/calendar";
import type { BillRange, BillsViewModel } from "./types";

const ZERO = new Prisma.Decimal(0);
const OUTFLOW_TYPES = new Set<CalendarEventType>([
  CalendarEventType.BILL,
  CalendarEventType.SUBSCRIPTION,
  CalendarEventType.DEBT_PAYMENT,
  CalendarEventType.CREDIT_CARD_PAYMENT,
  CalendarEventType.OTHER_RECURRING,
]);

function belongsToCurrentAccount(event: RawCalendarData["events"][number]) {
  return (
    !event.account ||
    (event.account.isActive !== false &&
      event.account.institutionConnection?.status !==
        ConnectionStatus.DISCONNECTED)
  );
}

export function parseBillRange(
  value: string | string[] | undefined,
): BillRange {
  const parsed = Array.isArray(value) ? value[0] : value;
  return parsed === "14" || parsed === "60" || parsed === "90"
    ? (Number(parsed) as BillRange)
    : 30;
}

export function buildBillsViewModel(
  data: RawCalendarData,
  days: BillRange,
  now = new Date(),
): BillsViewModel {
  const rangeStart = startOfUtcDay(now);
  const rangeEnd = addUtcDays(rangeStart, days);
  const currentEvents = data.events.filter(
    (event) =>
      event.userId === data.ownerId &&
      (!event.account || event.account.userId === data.ownerId) &&
      belongsToCurrentAccount(event) &&
      (!event.recurringStream || event.recurringStream.userId === data.ownerId),
  );
  const effective = currentEvents
    .map((event) => getEffectiveCalendarEvent(event, now))
    .sort((a, b) => a.effectiveDate.getTime() - b.effectiveDate.getTime());
  const inRange = effective.filter(
    ({ effectiveDate }) =>
      effectiveDate >= rangeStart && effectiveDate <= rangeEnd,
  );
  const inactive = effective.filter(
    ({ status, notABill }) =>
      status === CalendarEventStatus.INACTIVE || notABill,
  );
  const bills = inRange.filter(
    ({ eventType, status, notABill }) =>
      OUTFLOW_TYPES.has(eventType) &&
      status !== CalendarEventStatus.INACTIVE &&
      !notABill,
  );
  const expectedIncome = inRange.filter(
    ({ eventType, status, notABill }) =>
      eventType === CalendarEventType.EXPECTED_INCOME &&
      status !== CalendarEventStatus.INACTIVE &&
      !notABill,
  );
  const state = deriveCalendarState(
    { ...data, events: currentEvents },
    [...bills, ...expectedIncome],
    now,
  );

  return {
    days,
    rangeStart,
    rangeEnd,
    bills,
    expectedIncome,
    inactive,
    upcomingTotal: bills
      .filter(
        ({ status }) =>
          status !== CalendarEventStatus.PAID &&
          status !== CalendarEventStatus.SKIPPED,
      )
      .reduce(
        (total, { expectedAmount }) =>
          expectedAmount ? total.plus(expectedAmount.abs()) : total,
        ZERO,
      ),
    confirmedCount: bills.filter(({ dateLabel }) => dateLabel === "Confirmed")
      .length,
    predictedCount: bills.filter(({ dateLabel }) => dateLabel === "Predicted")
      .length,
    needsConfirmationCount: bills.filter(
      ({ status }) => status === CalendarEventStatus.NEEDS_CONFIRMATION,
    ).length,
    stateMessages: state.stateMessages,
    isEmpty: state.isEmpty,
  };
}
