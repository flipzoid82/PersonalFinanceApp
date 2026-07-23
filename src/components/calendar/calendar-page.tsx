import { Card } from "@/components/ui/card";
import type { CalendarViewModel } from "@/lib/calendar";
import { CalendarControls } from "./calendar-controls";
import { ManualEventForm } from "./manual-event-form";
import { MonthView } from "./month-view";
import { UpcomingList } from "./upcoming-list";

export function CalendarPage({
  model,
  now,
  returnTo,
  message,
  error,
}: {
  model: CalendarViewModel;
  now: Date;
  returnTo: string;
  message?: string;
  error?: string;
}) {
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header>
        <p className="text-sm font-semibold tracking-wide text-sky-700 uppercase">
          Milestone 4 · Synthetic data
        </p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">Calendar</h1>
        <p className="mt-2 max-w-3xl text-slate-600">
          Plan around confirmed due dates and historically predicted posting
          dates without treating predictions as guarantees.
        </p>
      </header>
      {message ? (
        <div
          role="status"
          tabIndex={-1}
          className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-900"
        >
          {message}
        </div>
      ) : null}
      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-900"
        >
          {error}
        </div>
      ) : null}
      {model.state.stateMessages.length ? (
        <Card className="border-amber-200 bg-amber-50 p-4" role="status">
          <h2 className="font-bold">Calendar data notice</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            {model.state.stateMessages.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </Card>
      ) : null}
      {model.state.isEmpty ? (
        <Card className="p-8 text-center">
          <h2 className="text-xl font-bold">No recurring history yet</h2>
          <p className="mt-2 text-slate-600">
            Add a manual recurring event or load the synthetic seed.
            Recurring-pattern detection is not implemented.
          </p>
        </Card>
      ) : (
        <>
          <CalendarControls filters={model.filters} now={now} />
          {model.state.allPredictionsDismissed ? (
            <Card className="p-5">
              <h2 className="font-bold">All predictions dismissed</h2>
              <p className="mt-1 text-sm text-slate-600">
                Predicted items marked as not bills stay outside the active
                calendar.
              </p>
            </Card>
          ) : null}
          {model.filters.view === "month" ? (
            <MonthView model={model} now={now} returnTo={returnTo} />
          ) : (
            <UpcomingList model={model} returnTo={returnTo} />
          )}
        </>
      )}
      <ManualEventForm model={model} now={now} returnTo={returnTo} />
    </div>
  );
}
