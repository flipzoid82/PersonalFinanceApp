import {
  CalendarEventType,
  type CalendarEventType as EventType,
} from "@prisma/client";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import {
  addUtcMonths,
  formatMonth,
  type CalendarFilters,
} from "@/lib/calendar";
import { titleCaseEnum } from "@/lib/dashboard/formatters";
import { cn } from "@/lib/utils";

function url(
  filters: CalendarFilters,
  changes: Record<string, string | undefined>,
) {
  const params = new URLSearchParams();
  params.set("view", filters.view);
  params.set("month", formatMonth(filters.month));
  params.set("days", String(filters.days));
  if (filters.dateKind !== "all") params.set("kind", filters.dateKind);
  filters.eventTypes.forEach((type) => params.append("types", type));
  for (const [key, value] of Object.entries(changes)) {
    params.delete(key);
    if (value) params.set(key, value);
  }
  return `/calendar?${params.toString()}`;
}

const FILTER_TYPES: EventType[] = [
  CalendarEventType.BILL,
  CalendarEventType.SUBSCRIPTION,
  CalendarEventType.DEBT_PAYMENT,
  CalendarEventType.CREDIT_CARD_PAYMENT,
  CalendarEventType.EXPECTED_INCOME,
  CalendarEventType.OTHER_RECURRING,
];

export function CalendarControls({
  filters,
  now,
}: {
  filters: CalendarFilters;
  now: Date;
}) {
  const monthLabel = new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(filters.month);
  return (
    <Card className="space-y-4 p-4 sm:p-5">
      <nav aria-label="Calendar views" className="flex flex-wrap gap-2">
        {(["month", "upcoming"] as const).map((view) => (
          <Link
            key={view}
            href={url(filters, { view })}
            aria-current={filters.view === view ? "page" : undefined}
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900",
              filters.view === view
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200",
            )}
          >
            {view === "month" ? "Month view" : "Upcoming list"}
          </Link>
        ))}
      </nav>

      {filters.view === "month" ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Link
              href={url(filters, {
                month: formatMonth(addUtcMonths(filters.month, -1)),
                day: undefined,
              })}
              aria-label="Previous month"
              className="rounded-lg border p-2 hover:bg-slate-50 focus-visible:outline-2"
            >
              <ChevronLeft aria-hidden="true" size={20} />
            </Link>
            <h2 className="min-w-40 text-center text-lg font-bold">
              {monthLabel}
            </h2>
            <Link
              href={url(filters, {
                month: formatMonth(addUtcMonths(filters.month, 1)),
                day: undefined,
              })}
              aria-label="Next month"
              className="rounded-lg border p-2 hover:bg-slate-50 focus-visible:outline-2"
            >
              <ChevronRight aria-hidden="true" size={20} />
            </Link>
          </div>
          <Link
            href={url(filters, { month: formatMonth(now), day: undefined })}
            className="rounded-lg border px-3 py-2 text-sm font-semibold hover:bg-slate-50 focus-visible:outline-2"
          >
            Today / current month
          </Link>
        </div>
      ) : (
        <fieldset>
          <legend className="text-sm font-semibold">Upcoming range</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {[14, 30, 60, 90].map((days) => (
              <Link
                key={days}
                href={url(filters, { days: String(days), view: "upcoming" })}
                aria-current={filters.days === days ? "page" : undefined}
                className={cn(
                  "rounded-lg border px-3 py-2 text-sm font-medium focus-visible:outline-2",
                  filters.days === days
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "hover:bg-slate-50",
                )}
              >
                {days} days
              </Link>
            ))}
          </div>
        </fieldset>
      )}

      <details className="rounded-lg border p-3">
        <summary className="cursor-pointer font-semibold">Filters</summary>
        <form method="get" className="mt-4 space-y-4">
          <input type="hidden" name="view" value={filters.view} />
          <input
            type="hidden"
            name="month"
            value={formatMonth(filters.month)}
          />
          <input type="hidden" name="days" value={filters.days} />
          <fieldset>
            <legend className="text-sm font-semibold">Event types</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {FILTER_TYPES.map((type) => (
                <label
                  key={type}
                  className="flex min-h-10 items-center gap-2 text-sm"
                >
                  <input
                    type="checkbox"
                    name="types"
                    value={type}
                    defaultChecked={filters.eventTypes.includes(type)}
                    className="size-4"
                  />
                  {titleCaseEnum(type)}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="block max-w-sm text-sm font-semibold">
            Confirmation filter
            <select
              name="kind"
              defaultValue={filters.dateKind}
              className="mt-1 min-h-10 w-full rounded-lg border bg-white px-3 font-normal"
            >
              <option value="all">All dates and statuses</option>
              <option value="confirmed">Confirmed only</option>
              <option value="predicted">Predicted only</option>
              <option value="needs-confirmation">Needs confirmation</option>
            </select>
          </label>
          <button className="min-h-10 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white focus-visible:outline-2">
            Apply filters
          </button>
        </form>
      </details>
    </Card>
  );
}
