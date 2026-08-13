import { CalendarEventType, RecurringFrequency } from "@prisma/client";
import { createManualRecurringEventAction } from "@/actions/calendar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { themedFormControlClass } from "@/components/ui/form-controls";
import type { CalendarViewModel } from "@/lib/calendar";
import { formatIsoDate } from "@/lib/calendar";
import { titleCaseEnum } from "@/lib/dashboard/formatters";

export function ManualEventForm({
  model,
  now,
  returnTo,
}: {
  model: CalendarViewModel;
  now: Date;
  returnTo: string;
}) {
  return (
    <Card className="p-4 sm:p-5">
      <details>
        <summary className="cursor-pointer text-lg font-bold">
          Add manual recurring event
        </summary>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          Creates one manual occurrence and its recurring stream. It does not
          generate future events.
        </p>
        <form
          action={createManualRecurringEventAction}
          className="mt-4 grid gap-4 sm:grid-cols-2"
        >
          <input type="hidden" name="returnTo" value={returnTo} />
          <label className="text-sm font-semibold">
            Name
            <input
              className={themedFormControlClass}
              name="name"
              required
              maxLength={120}
            />
          </label>
          <label className="text-sm font-semibold">
            Event type
            <select
              className={themedFormControlClass}
              name="eventType"
              defaultValue={CalendarEventType.BILL}
            >
              {Object.values(CalendarEventType).map((value) => (
                <option key={value} value={value}>
                  {titleCaseEnum(value)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold">
            Date
            <input
              className={themedFormControlClass}
              type="date"
              name="date"
              required
              defaultValue={formatIsoDate(now)}
            />
          </label>
          <label className="text-sm font-semibold">
            Expected amount
            <input
              className={themedFormControlClass}
              type="number"
              name="amount"
              required
              min="0.0001"
              step="0.0001"
            />
          </label>
          <label className="text-sm font-semibold">
            Currency
            <input
              className={themedFormControlClass}
              name="currency"
              required
              minLength={3}
              maxLength={3}
              defaultValue="USD"
            />
          </label>
          <label className="text-sm font-semibold">
            Account (optional)
            <select
              className={themedFormControlClass}
              name="accountId"
              defaultValue=""
            >
              <option value="">No account</option>
              {model.accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name} ({account.currency})
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold">
            Frequency
            <select
              className={themedFormControlClass}
              name="frequency"
              defaultValue={RecurringFrequency.MONTHLY}
            >
              {Object.values(RecurringFrequency).map((value) => (
                <option key={value} value={value}>
                  {titleCaseEnum(value)}
                </option>
              ))}
            </select>
          </label>
          <fieldset className="text-sm font-semibold">
            <legend>Date state</legend>
            <div className="mt-2 flex flex-wrap gap-4 font-normal">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="dateKind"
                  value="confirmed"
                  defaultChecked
                />
                Confirmed due date
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" name="dateKind" value="predicted" />
                Predicted posting date
              </label>
            </div>
          </fieldset>
          <label className="text-sm font-semibold sm:col-span-2">
            Notes (optional)
            <textarea
              className={`${themedFormControlClass} min-h-24 py-2`}
              name="notes"
              maxLength={1000}
            />
          </label>
          <div className="sm:col-span-2">
            <Button type="submit">Create manual event</Button>
          </div>
        </form>
      </details>
    </Card>
  );
}
