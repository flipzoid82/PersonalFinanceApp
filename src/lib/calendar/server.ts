import "server-only";
import { getCalendarData } from "./queries";
import type { CalendarFilters } from "./types";
import { buildCalendarViewModel } from "./view-model";

export async function getCalendarViewModel(
  ownerId: string,
  filters: CalendarFilters,
  now = new Date(),
) {
  return buildCalendarViewModel(
    await getCalendarData(ownerId, now),
    filters,
    now,
  );
}
