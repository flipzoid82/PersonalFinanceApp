export const inputClass =
  "mt-1 min-h-10 w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface-panel)] px-3 text-sm text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--focus-ring)]";

export const panelClass =
  "rounded-lg border border-[var(--border-default)] bg-[var(--surface-subtle)] p-4";

export function dateTimeInputValue(date = new Date()) {
  const pad = (value: number) => value.toString().padStart(2, "0");

  return [
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    `${pad(date.getHours())}:${pad(date.getMinutes())}`,
  ].join("T");
}

export function dateInputValue(date: Date | null) {
  return date ? date.toISOString().slice(0, 10) : "";
}
