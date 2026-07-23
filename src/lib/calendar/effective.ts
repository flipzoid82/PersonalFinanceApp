import {
  CalendarAmountSource,
  CalendarDateSource,
  CalendarEventStatus,
  RecurringFrequency,
} from "@prisma/client";
import { startOfUtcDay } from "./dates";
import type {
  CalendarOverrideValue,
  EffectiveCalendarEvent,
  RawCalendarEvent,
} from "./types";

const AMOUNT_LABELS: Record<CalendarAmountSource, string> = {
  FIXED: "Fixed",
  ESTIMATED: "Estimated",
  LAST_OBSERVED: "Last observed",
  PROVIDER: "Provider",
  IMPORTED: "Imported",
  MANUAL: "Manual",
};

function latest(values: CalendarOverrideValue[]) {
  return [...values].sort(
    (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
  )[0];
}

export function deriveCalendarStatus(
  event: RawCalendarEvent,
  confirmedDueDate: Date | null,
  overrideStatus: CalendarEventStatus | null,
  notABill: boolean,
  now: Date,
) {
  const streamOverride = latest(event.recurringStream?.calendarOverrides ?? []);
  if (
    notABill ||
    overrideStatus === CalendarEventStatus.INACTIVE ||
    streamOverride?.statusOverride === CalendarEventStatus.INACTIVE ||
    event.recurringStream?.isActive === false
  )
    return CalendarEventStatus.INACTIVE;
  if (event.linkedTransaction) return CalendarEventStatus.PAID;

  const baseStatus =
    overrideStatus ??
    streamOverride?.statusOverride ??
    event.status ??
    CalendarEventStatus.PREDICTED;
  if (
    baseStatus === CalendarEventStatus.PAID ||
    baseStatus === CalendarEventStatus.SKIPPED ||
    baseStatus === CalendarEventStatus.INACTIVE
  )
    return baseStatus;
  if (baseStatus === CalendarEventStatus.NEEDS_CONFIRMATION) return baseStatus;
  if (!confirmedDueDate) return CalendarEventStatus.PREDICTED;
  if (startOfUtcDay(confirmedDueDate) < startOfUtcDay(now))
    return CalendarEventStatus.OVERDUE;
  return CalendarEventStatus.CONFIRMED;
}

export function getEffectiveCalendarEvent(
  event: RawCalendarEvent,
  now = new Date(),
): EffectiveCalendarEvent {
  const eventOverride = latest(event.overrides);
  const streamOverride = latest(event.recurringStream?.calendarOverrides ?? []);
  const userConfirmedDate =
    event.isUserConfirmed ||
    event.dateSource === CalendarDateSource.USER_CONFIRMED
      ? event.eventDate
      : null;
  const confirmedDueDate =
    eventOverride?.confirmedDueDate ??
    streamOverride?.confirmedDueDate ??
    userConfirmedDate ??
    event.recurringStream?.confirmedDueDate ??
    null;
  const predictedPostingDate =
    event.predictedPostingDate ??
    event.recurringStream?.predictedPostingDate ??
    (confirmedDueDate
      ? (event.recurringStream?.predictedNextDate ?? null)
      : event.eventDate);
  const effectiveDate = confirmedDueDate ?? event.eventDate;
  const notABill = eventOverride?.notABill ?? streamOverride?.notABill ?? false;
  const overrideStatus = eventOverride?.statusOverride ?? null;
  const expectedAmount =
    eventOverride?.expectedAmountOverride ??
    streamOverride?.expectedAmountOverride ??
    event.expectedAmount ??
    event.recurringStream?.averageAmount ??
    event.recurringStream?.lastAmount ??
    null;
  const frequency =
    eventOverride?.frequencyOverride ??
    streamOverride?.frequencyOverride ??
    event.recurringStream?.frequency ??
    RecurringFrequency.IRREGULAR;
  const lastMatchingTransaction =
    event.linkedTransaction ??
    event.recurringStream?.calendarEvents?.find(
      ({ linkedTransaction }) => linkedTransaction,
    )?.linkedTransaction ??
    null;

  return {
    id: event.id,
    recurringStreamId: event.recurringStreamId,
    title: event.title,
    eventType: event.eventType,
    effectiveDate,
    confirmedDueDate,
    predictedPostingDate,
    dateLabel: confirmedDueDate ? "Confirmed" : "Predicted",
    dateSourceLabel:
      eventOverride?.confirmedDueDate || streamOverride?.confirmedDueDate
        ? "Local override"
        : event.isUserConfirmed
          ? "User confirmed"
          : event.dateSource
              .toLowerCase()
              .split("_")
              .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
              .join(" "),
    expectedAmount,
    actualAmount: event.actualAmount,
    currency: event.currency,
    amountLabel:
      eventOverride?.expectedAmountOverride ||
      streamOverride?.expectedAmountOverride
        ? "Manual override"
        : AMOUNT_LABELS[event.amountSource],
    frequency,
    confidence: event.confidenceLevel,
    status: deriveCalendarStatus(
      event,
      confirmedDueDate,
      overrideStatus,
      notABill,
      now,
    ),
    accountId: event.accountId,
    accountName: event.account?.name ?? null,
    notes:
      eventOverride?.notes ??
      streamOverride?.notes ??
      event.notes ??
      event.recurringStream?.description ??
      null,
    isManual:
      event.dateSource === CalendarDateSource.MANUAL ||
      event.amountSource === CalendarAmountSource.MANUAL,
    notABill,
    lastMatchingTransaction,
    source: event,
  };
}

export function filterEffectiveEvents(
  events: EffectiveCalendarEvent[],
  eventTypes: EffectiveCalendarEvent["eventType"][],
  dateKind: "all" | "confirmed" | "predicted" | "needs-confirmation",
) {
  return events.filter((event) => {
    if (event.notABill) return false;
    if (eventTypes.length && !eventTypes.includes(event.eventType))
      return false;
    if (dateKind === "confirmed" && event.dateLabel !== "Confirmed")
      return false;
    if (dateKind === "predicted" && event.dateLabel !== "Predicted")
      return false;
    if (
      dateKind === "needs-confirmation" &&
      event.status !== CalendarEventStatus.NEEDS_CONFIRMATION &&
      event.confidence !== "NEEDS_CONFIRMATION"
    )
      return false;
    return true;
  });
}
