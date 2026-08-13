import { refreshRecurringDetectionAction } from "@/actions/recurring";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
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
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold tracking-wide text-sky-700 uppercase">
            Milestone 7 · Recurring detection
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Calendar</h1>
          <p className="mt-2 max-w-3xl text-slate-600 dark:text-slate-300">
            Plan around confirmed due dates and inferred posting predictions
            without treating predictions as guarantees.
          </p>
        </div>
        <form action={refreshRecurringDetectionAction}>
          <input type="hidden" name="returnTo" value={returnTo} />
          <button className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-50 dark:hover:bg-slate-800">
            Refresh recurring detection
          </button>
        </form>
      </header>
      <p className="text-sm text-slate-600 dark:text-slate-300">
        Predictions use posted transaction history. They are estimates, not
        contractual due dates, and predicted-only items never become overdue.
      </p>
      {message ? (
        <Notice tone="positive" role="status" tabIndex={-1}>
          {message}
        </Notice>
      ) : null}
      {error ? (
        <Notice tone="negative" role="alert">
          {error}
        </Notice>
      ) : null}
      {model.state.stateMessages.length ? (
        <Notice tone="warning" title="Calendar data notice" role="status">
          <ul className="list-disc space-y-1 pl-5">
            {model.state.stateMessages.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </Notice>
      ) : null}
      {model.state.isEmpty ? (
        <Card className="p-8 text-center">
          <h2 className="text-xl font-bold">No recurring history yet</h2>
          <p className="mt-2 text-slate-600">
            Add a manual recurring event, connect Plaid Sandbox, or refresh
            detection after loading synthetic history.
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
