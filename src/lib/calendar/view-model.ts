import { CalendarEventStatus } from "@prisma/client";
import {
  endOfUtcMonth,
  getMonthGridDates,
  startOfUtcDay,
  startOfUtcMonth,
  upcomingWindow,
} from "./dates";
import { filterEffectiveEvents, getEffectiveCalendarEvent } from "./effective";
import { findBestTransactionMatch } from "./matching";
import { deriveCalendarState } from "./state";
import type {
  CalendarFilters,
  CalendarViewModel,
  RawCalendarData,
} from "./types";

export function buildCalendarViewModel(
  data: RawCalendarData,
  filters: CalendarFilters,
  now = new Date(),
): CalendarViewModel {
  const effective = data.events
    .filter(
      (event) =>
        event.userId === data.ownerId &&
        (!event.account || event.account.userId === data.ownerId) &&
        (!event.recurringStream ||
          event.recurringStream.userId === data.ownerId),
    )
    .map((event) => getEffectiveCalendarEvent(event, now))
    .sort((a, b) => a.effectiveDate.getTime() - b.effectiveDate.getTime());
  const filtered = filterEffectiveEvents(
    effective,
    filters.eventTypes,
    filters.dateKind,
  );
  const monthStart = startOfUtcMonth(filters.month);
  const monthEnd = endOfUtcMonth(filters.month);
  const monthEvents = filtered.filter(
    ({ effectiveDate }) =>
      effectiveDate >= monthStart && effectiveDate <= monthEnd,
  );
  const selectedDayEvents = filters.selectedDay
    ? monthEvents.filter(
        ({ effectiveDate }) =>
          startOfUtcDay(effectiveDate).getTime() ===
          filters.selectedDay!.getTime(),
      )
    : [];
  const window = upcomingWindow(now, filters.days);
  const upcomingEvents = filtered.filter(
    ({ effectiveDate, status }) =>
      effectiveDate >= window.start &&
      effectiveDate <= window.end &&
      status !== CalendarEventStatus.INACTIVE &&
      status !== CalendarEventStatus.SKIPPED,
  );
  const visibleEvents = filters.view === "month" ? monthEvents : upcomingEvents;
  const matchCandidates = Object.fromEntries(
    visibleEvents
      .filter(
        ({ status, lastMatchingTransaction }) =>
          status !== CalendarEventStatus.PAID && !lastMatchingTransaction,
      )
      .map((event) => [
        event.id,
        findBestTransactionMatch(event, data.transactions),
      ]),
  );
  return {
    filters,
    monthDates: getMonthGridDates(filters.month),
    monthEvents,
    selectedDayEvents,
    upcomingEvents,
    matchCandidates,
    accounts: data.accounts
      .filter(({ userId }) => userId === data.ownerId)
      .map(({ id, name, currency }) => ({ id, name, currency })),
    state: deriveCalendarState(data, visibleEvents, now),
  };
}
