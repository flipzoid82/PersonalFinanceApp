export const CALENDAR_RANGES = [14, 30, 60, 90] as const;
export type CalendarRange = (typeof CALENDAR_RANGES)[number];

export function startOfUtcDay(date: Date) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

export function addUtcDays(date: Date, days: number) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

export function startOfUtcMonth(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

export function addUtcMonths(date: Date, months: number) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1),
  );
}

export function endOfUtcMonth(date: Date) {
  return addUtcDays(addUtcMonths(startOfUtcMonth(date), 1), -1);
}

export function parseIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || formatIsoDate(date) !== value
    ? null
    : date;
}

export function formatIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function parseMonth(value: string | undefined, fallback: Date) {
  if (!value || !/^\d{4}-\d{2}$/.test(value)) return startOfUtcMonth(fallback);
  const parsed = parseIsoDate(`${value}-01`);
  return parsed ?? startOfUtcMonth(fallback);
}

export function formatMonth(date: Date) {
  return date.toISOString().slice(0, 7);
}

export function getMonthGridDates(month: Date) {
  const start = startOfUtcMonth(month);
  const gridStart = addUtcDays(start, -start.getUTCDay());
  return Array.from({ length: 42 }, (_, index) => addUtcDays(gridStart, index));
}

export function upcomingWindow(now: Date, days: CalendarRange) {
  const start = startOfUtcDay(now);
  return { start, end: addUtcDays(start, days) };
}
