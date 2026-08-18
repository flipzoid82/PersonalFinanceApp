import Link from "next/link";
import { Card } from "@/components/ui/card";
import type { CalendarViewModel } from "@/lib/calendar";
import { formatIsoDate, formatMonth } from "@/lib/calendar";
import { formatCurrency } from "@/lib/dashboard/formatters";
import { cn } from "@/lib/utils";
import { EventDetails } from "./event-details";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function eventUrl(model: CalendarViewModel, date: Date) {
  const params = new URLSearchParams({
    view: "month",
    month: formatMonth(model.filters.month),
    day: formatIsoDate(date),
    days: String(model.filters.days),
  });
  if (model.filters.dateKind !== "all")
    params.set("kind", model.filters.dateKind);
  model.filters.eventTypes.forEach((type) => params.append("types", type));
  return `/calendar?${params.toString()}#selected-day`;
}

export function MonthView({
  model,
  now,
  returnTo,
}: {
  model: CalendarViewModel;
  now: Date;
  returnTo: string;
}) {
  const today = formatIsoDate(now);
  return (
    <section aria-labelledby="month-view-heading" className="space-y-4">
      <div>
        <h2 id="month-view-heading" className="text-xl font-bold">
          Monthly calendar
        </h2>
        <p className="text-sm text-[var(--text-secondary)]">
          Confirmed due dates are primary. Predicted dates remain explicitly
          labeled.
        </p>
      </div>
      <Card className="overflow-hidden">
        <div
          className="grid grid-cols-7 border-b bg-[var(--surface-subtle)]"
          role="row"
        >
          {WEEKDAYS.map((day) => (
            <div
              key={day}
              role="columnheader"
              className="p-1.5 text-center text-xs font-bold text-[var(--text-secondary)] sm:p-2 sm:text-sm"
            >
              {day}
            </div>
          ))}
        </div>
        <div
          className="grid grid-cols-7"
          role="grid"
          aria-label="Monthly financial calendar"
        >
          {model.monthDates.map((date) => {
            const iso = formatIsoDate(date);
            const events = model.monthEvents.filter(
              ({ effectiveDate }) => formatIsoDate(effectiveDate) === iso,
            );
            const inMonth =
              date.getUTCMonth() === model.filters.month.getUTCMonth();
            return (
              <div
                key={iso}
                role="gridcell"
                aria-label={`${iso}, ${events.length} event${events.length === 1 ? "" : "s"}`}
                className={cn(
                  "min-h-24 min-w-0 border-r border-b p-1 sm:min-h-32 sm:p-2",
                  !inMonth &&
                    "bg-[var(--surface-subtle)] text-[var(--semantic-muted-text)]",
                  iso === today &&
                    "ring-2 ring-[var(--semantic-info-border)] ring-inset",
                )}
              >
                <Link
                  href={eventUrl(model, date)}
                  className="inline-flex size-7 items-center justify-center rounded-full text-xs font-bold hover:bg-[var(--surface-subtle)] focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]"
                  aria-label={`View details for ${iso}`}
                >
                  {date.getUTCDate()}
                </Link>
                <ul className="mt-1 space-y-1">
                  {events.slice(0, 3).map((event) => (
                    <li key={event.id}>
                      <Link
                        href={`${eventUrl(model, date)}`}
                        className="block rounded border border-[var(--semantic-muted-border)] bg-[var(--semantic-muted-bg)] p-1 text-[10px] leading-tight text-[var(--semantic-muted-text)] focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)] sm:text-xs"
                      >
                        <span className="block truncate font-semibold">
                          {event.title}
                        </span>
                        <span className="block truncate">
                          {event.dateLabel} ·{" "}
                          {formatCurrency(event.expectedAmount, event.currency)}
                        </span>
                        <span className="block truncate">
                          {event.status.replaceAll("_", " ")}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
                {events.length > 3 ? (
                  <p className="mt-1 text-[10px] font-semibold">
                    +{events.length - 3} more
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      </Card>

      <section
        id="selected-day"
        aria-labelledby="selected-day-heading"
        className="scroll-mt-24 space-y-3"
      >
        <h2 id="selected-day-heading" className="text-xl font-bold">
          {model.filters.selectedDay
            ? `Selected day: ${new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone: "UTC" }).format(model.filters.selectedDay)}`
            : "Accessible month event list"}
        </h2>
        <p className="text-sm text-[var(--text-secondary)]">
          {model.filters.selectedDay
            ? "Details for the selected date."
            : "This chronological list is an accessible alternative to the month grid."}
        </p>
        {(model.filters.selectedDay
          ? model.selectedDayEvents
          : model.monthEvents
        ).length ? (
          <ul className="space-y-3">
            {(model.filters.selectedDay
              ? model.selectedDayEvents
              : model.monthEvents
            ).map((event) => (
              <li key={event.id}>
                <EventDetails
                  event={event}
                  candidate={model.matchCandidates[event.id]}
                  returnTo={returnTo}
                />
              </li>
            ))}
          </ul>
        ) : (
          <Card className="p-6 text-center text-[var(--text-secondary)]">
            No events on this selected day.
          </Card>
        )}
      </section>
    </section>
  );
}
