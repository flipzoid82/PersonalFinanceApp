import { CalendarEventStatus, RecurringFrequency } from "@prisma/client";
import {
  acceptPaymentMatchAction,
  deactivateRecurringStreamAction,
  updateCalendarEventAction,
} from "@/actions/calendar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  themedFormControlClass,
  themedFormPanelClass,
} from "@/components/ui/form-controls";
import { semanticToneClasses } from "@/components/ui/semantic";
import type { EffectiveCalendarEvent, MatchCandidate } from "@/lib/calendar";
import { formatIsoDate } from "@/lib/calendar";
import {
  formatCurrency,
  formatDate,
  titleCaseEnum,
} from "@/lib/dashboard/formatters";
import { ConfidenceBadge, StatusBadge, TextBadge } from "./event-badges";

function HiddenFields({
  event,
  returnTo,
}: {
  event: EffectiveCalendarEvent;
  returnTo: string;
}) {
  return (
    <>
      <input type="hidden" name="eventId" value={event.id} />
      <input type="hidden" name="returnTo" value={returnTo} />
    </>
  );
}

export function EventDetails({
  event,
  candidate,
  returnTo,
}: {
  event: EffectiveCalendarEvent;
  candidate?: MatchCandidate;
  returnTo: string;
}) {
  const canEdit =
    event.status !== CalendarEventStatus.INACTIVE && !event.notABill;
  return (
    <Card id={`event-${event.id}`} className="scroll-mt-24 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold">{event.title}</h3>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            {titleCaseEnum(event.eventType)} · {formatDate(event.effectiveDate)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <TextBadge>{event.dateLabel} date</TextBadge>
          {event.isManual ? <TextBadge>Manual</TextBadge> : null}
          <StatusBadge status={event.status} />
          <ConfidenceBadge confidence={event.confidence} />
        </div>
      </div>

      <dl className="mt-4 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <dt className="font-semibold text-[var(--text-secondary)]">
            Expected amount
          </dt>
          <dd>
            {formatCurrency(event.expectedAmount, event.currency)} ·{" "}
            {event.amountLabel}
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-[var(--text-secondary)]">
            Account
          </dt>
          <dd>{event.accountName ?? "No account selected"}</dd>
        </div>
        <div>
          <dt className="font-semibold text-[var(--text-secondary)]">
            Frequency
          </dt>
          <dd>{titleCaseEnum(event.frequency)}</dd>
        </div>
        <div>
          <dt className="font-semibold text-[var(--text-secondary)]">
            Date source
          </dt>
          <dd>
            {event.dateLabel}; source {event.dateSourceLabel}
          </dd>
        </div>
        {event.actualAmount ? (
          <div>
            <dt className="font-semibold text-[var(--text-secondary)]">
              Actual paid amount
            </dt>
            <dd>{formatCurrency(event.actualAmount, event.currency)}</dd>
          </div>
        ) : null}
        <div>
          <dt className="font-semibold text-[var(--text-secondary)]">
            Last matching transaction
          </dt>
          <dd>
            {event.lastMatchingTransaction
              ? `${event.lastMatchingTransaction.merchantName ?? event.lastMatchingTransaction.originalName} · ${formatCurrency(event.lastMatchingTransaction.amount.abs(), event.currency)} · ${event.lastMatchingTransaction.postedAt ? formatDate(event.lastMatchingTransaction.postedAt) : "date unavailable"}`
              : "No accepted posted match"}
          </dd>
        </div>
        {event.dateLabel === "Confirmed" && event.predictedPostingDate ? (
          <div>
            <dt className="font-semibold text-[var(--text-secondary)]">
              Predicted posting date
            </dt>
            <dd>
              {formatDate(event.predictedPostingDate)} · prediction, not a due
              date
            </dd>
          </div>
        ) : null}
        <div className="sm:col-span-2 lg:col-span-3">
          <dt className="font-semibold text-[var(--text-secondary)]">Notes</dt>
          <dd>{event.notes || "No notes"}</dd>
        </div>
      </dl>

      {candidate && canEdit ? (
        <div
          className={`mt-4 rounded-lg border p-3 text-sm ${semanticToneClasses.warning}`}
        >
          <p className="font-semibold">
            Suggested posted match · {candidate.confidence} confidence
          </p>
          <p className="mt-1">
            {candidate.transaction.merchantName ??
              candidate.transaction.originalName}{" "}
            ·{" "}
            {formatCurrency(candidate.transaction.amount.abs(), event.currency)}{" "}
            ·{" "}
            {candidate.transaction.postedAt
              ? formatDate(candidate.transaction.postedAt)
              : "Date unavailable"}
          </p>
          <p className="mt-1 text-xs">
            Match evidence: {candidate.reasons.join(", ")}. Pending transactions
            are never candidates.
          </p>
          <form action={acceptPaymentMatchAction} className="mt-3">
            <HiddenFields event={event} returnTo={returnTo} />
            <input
              type="hidden"
              name="transactionId"
              value={candidate.transaction.id}
            />
            <input
              type="hidden"
              name="confirmLowConfidence"
              value={String(candidate.requiresConfirmation)}
            />
            <Button type="submit" className="min-h-9 px-3 py-1.5">
              {candidate.requiresConfirmation
                ? "Confirm suggested match"
                : "Accept high-confidence match"}
            </Button>
          </form>
        </div>
      ) : null}

      {canEdit ? (
        <details className="mt-4 rounded-lg border border-[var(--border-default)] p-3">
          <summary className="cursor-pointer font-semibold">
            Actions and corrections
          </summary>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {event.dateLabel === "Predicted" ? (
              <form
                action={updateCalendarEventAction}
                className={`${themedFormPanelClass} p-3`}
              >
                <HiddenFields event={event} returnTo={returnTo} />
                <input type="hidden" name="intent" value="confirm" />
                <label className="block text-sm font-semibold">
                  Confirmed due date
                  <input
                    className={themedFormControlClass}
                    type="date"
                    name="date"
                    required
                    defaultValue={formatIsoDate(event.effectiveDate)}
                  />
                </label>
                <Button type="submit" className="mt-3 min-h-9">
                  Confirm prediction
                </Button>
              </form>
            ) : null}
            <form
              action={updateCalendarEventAction}
              className={`${themedFormPanelClass} p-3`}
            >
              <HiddenFields event={event} returnTo={returnTo} />
              <input type="hidden" name="intent" value="correct-date" />
              <label className="block text-sm font-semibold">
                Correct confirmed due date
                <input
                  className={themedFormControlClass}
                  type="date"
                  name="date"
                  required
                  defaultValue={formatIsoDate(event.effectiveDate)}
                />
              </label>
              <Button type="submit" className="mt-3 min-h-9">
                Save due date
              </Button>
            </form>
            <form
              action={updateCalendarEventAction}
              className={`${themedFormPanelClass} p-3`}
            >
              <HiddenFields event={event} returnTo={returnTo} />
              <input type="hidden" name="intent" value="correct-amount" />
              <label className="block text-sm font-semibold">
                Correct expected amount
                <input
                  className={themedFormControlClass}
                  type="number"
                  name="amount"
                  min="0.0001"
                  step="0.0001"
                  required
                  defaultValue={event.expectedAmount?.toString() ?? ""}
                />
              </label>
              <Button type="submit" className="mt-3 min-h-9">
                Save amount
              </Button>
            </form>
            <form
              action={updateCalendarEventAction}
              className={`${themedFormPanelClass} p-3`}
            >
              <HiddenFields event={event} returnTo={returnTo} />
              <input type="hidden" name="intent" value="correct-frequency" />
              <label className="block text-sm font-semibold">
                Correct frequency
                <select
                  className={themedFormControlClass}
                  name="frequency"
                  defaultValue={event.frequency}
                >
                  {Object.values(RecurringFrequency).map((frequency) => (
                    <option key={frequency} value={frequency}>
                      {titleCaseEnum(frequency)}
                    </option>
                  ))}
                </select>
              </label>
              <Button type="submit" className="mt-3 min-h-9">
                Save frequency
              </Button>
            </form>
            <form
              action={updateCalendarEventAction}
              className={`${themedFormPanelClass} p-3 lg:col-span-2`}
            >
              <HiddenFields event={event} returnTo={returnTo} />
              <input type="hidden" name="intent" value="notes" />
              <label className="block text-sm font-semibold">
                Notes
                <textarea
                  className={`${themedFormControlClass} min-h-24 py-2`}
                  name="notes"
                  maxLength={1000}
                  defaultValue={event.notes ?? ""}
                />
              </label>
              <Button type="submit" className="mt-3 min-h-9">
                Update notes
              </Button>
            </form>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {event.status !== CalendarEventStatus.PAID ? (
              <form action={updateCalendarEventAction}>
                <HiddenFields event={event} returnTo={returnTo} />
                <input type="hidden" name="intent" value="mark-paid" />
                <Button type="submit" className="min-h-9">
                  Mark paid manually
                </Button>
              </form>
            ) : null}
            <form action={updateCalendarEventAction}>
              <HiddenFields event={event} returnTo={returnTo} />
              <input type="hidden" name="intent" value="mark-skipped" />
              <Button
                type="submit"
                className="min-h-9 bg-slate-600 hover:bg-slate-700"
              >
                Mark skipped
              </Button>
            </form>
            <form action={updateCalendarEventAction}>
              <HiddenFields event={event} returnTo={returnTo} />
              <input type="hidden" name="intent" value="not-a-bill" />
              <Button
                type="submit"
                className="min-h-9 bg-slate-600 hover:bg-slate-700"
              >
                Not a bill
              </Button>
            </form>
            {event.recurringStreamId ? (
              <form action={deactivateRecurringStreamAction}>
                <input
                  type="hidden"
                  name="streamId"
                  value={event.recurringStreamId}
                />
                <input type="hidden" name="returnTo" value={returnTo} />
                <Button
                  type="submit"
                  className="min-h-9 bg-rose-700 hover:bg-rose-800"
                >
                  Deactivate stream
                </Button>
              </form>
            ) : null}
          </div>
        </details>
      ) : null}
    </Card>
  );
}
