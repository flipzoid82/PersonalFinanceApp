import { CalendarEventType } from "@prisma/client";
import {
  CALENDAR_RANGES,
  parseIsoDate,
  parseMonth,
  type CalendarRange,
} from "./dates";
import type { CalendarFilters } from "./types";

type SearchValue = string | string[] | undefined;

function first(value: SearchValue) {
  return Array.isArray(value) ? value[0] : value;
}

export function parseCalendarFilters(
  params: Record<string, SearchValue>,
  now = new Date(),
): CalendarFilters {
  const rawDays = Number(first(params.days));
  const days = CALENDAR_RANGES.includes(rawDays as CalendarRange)
    ? (rawDays as CalendarRange)
    : 30;
  const rawTypeValues = Array.isArray(params.types)
    ? params.types
    : (first(params.types) ?? "").split(",");
  const rawTypes = rawTypeValues.filter((value): value is CalendarEventType =>
    Object.values(CalendarEventType).includes(value as CalendarEventType),
  );
  const kind = first(params.kind);
  return {
    view: first(params.view) === "upcoming" ? "upcoming" : "month",
    month: parseMonth(first(params.month), now),
    selectedDay: parseIsoDate(first(params.day) ?? ""),
    days,
    eventTypes: [...new Set(rawTypes)],
    dateKind:
      kind === "confirmed" ||
      kind === "predicted" ||
      kind === "needs-confirmation"
        ? kind
        : "all",
  };
}
