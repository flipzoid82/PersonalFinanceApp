import { CalendarEventStatus, DataSourceStatus } from "@prisma/client";
import { addUtcDays } from "./dates";
import type {
  CalendarState,
  EffectiveCalendarEvent,
  RawCalendarData,
} from "./types";

export const CALENDAR_STALE_DAYS = 7;

export function deriveCalendarState(
  data: RawCalendarData,
  visibleEvents: EffectiveCalendarEvent[],
  now: Date,
): CalendarState {
  const owned = data.events.filter(({ userId }) => userId === data.ownerId);
  const cutoff = addUtcDays(now, -CALENDAR_STALE_DAYS);
  const isStale = owned.some((event) => {
    const updated = event.account?.dataSource.lastUpdatedAt ?? event.updatedAt;
    return updated < cutoff;
  });
  const unavailableSource = owned.some(
    (event) =>
      event.account &&
      event.account.dataSource.status !== DataSourceStatus.ACTIVE,
  );
  const missingValues = owned.some((event) => {
    const amount =
      event.overrides[0]?.expectedAmountOverride ??
      event.expectedAmount ??
      event.recurringStream?.averageAmount;
    return amount == null;
  });
  const dismissedPredictions = owned.filter(
    (event) =>
      event.status === CalendarEventStatus.PREDICTED ||
      event.status === CalendarEventStatus.NEEDS_CONFIRMATION,
  );
  const allPredictionsDismissed =
    dismissedPredictions.length > 0 &&
    dismissedPredictions.every(
      (event) =>
        event.overrides[0]?.notABill ||
        event.recurringStream?.calendarOverrides[0]?.notABill,
    );
  const messages: string[] = [];
  if (isStale)
    messages.push("Some calendar sources have not been updated in seven days.");
  if (unavailableSource)
    messages.push(
      "A calendar source needs attention, so results may be partial.",
    );
  if (missingValues)
    messages.push("Some occurrences do not have an expected amount.");
  return {
    isEmpty: data.recurringStreamCount === 0 && owned.length === 0,
    noEventsInRange: visibleEvents.length === 0,
    allPredictionsDismissed,
    isStale,
    isPartial: unavailableSource || missingValues,
    stateMessages: messages,
  };
}
