import Link from "next/link";
import { CalendarEventStatus } from "@prisma/client";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import {
  SemanticBadge,
  SemanticValue,
  type SemanticTone,
} from "@/components/ui/semantic";
import {
  formatCurrency,
  formatDate,
  titleCaseEnum,
} from "@/lib/dashboard/formatters";
import type { BillsViewModel } from "@/lib/bills";
import type { EffectiveCalendarEvent } from "@/lib/calendar";

function statusTone(status: CalendarEventStatus): SemanticTone {
  if (status === CalendarEventStatus.PAID) return "positive";
  if (status === CalendarEventStatus.OVERDUE) return "negative";
  if (status === CalendarEventStatus.NEEDS_CONFIRMATION) return "warning";
  if (status === CalendarEventStatus.PREDICTED) return "warning";
  if (status === CalendarEventStatus.CONFIRMED) return "info";
  return "muted";
}

function BillList({
  events,
  empty,
  days,
}: {
  events: EffectiveCalendarEvent[];
  empty: string;
  days: number;
}) {
  if (!events.length)
    return (
      <p className="rounded-lg bg-[var(--surface-subtle)] p-4 text-sm text-[var(--text-secondary)]">
        {empty}
      </p>
    );
  return (
    <ol className="grid gap-3 lg:grid-cols-2">
      {events.map((event) => (
        <li
          key={event.id}
          className="min-w-0 rounded-lg border bg-[var(--surface-panel)] p-4"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="font-bold break-words">{event.title}</h3>
              <p className="text-sm text-[var(--text-secondary)]">
                {titleCaseEnum(event.eventType)} ·{" "}
                {titleCaseEnum(event.frequency)}
              </p>
            </div>
            <SemanticBadge tone={statusTone(event.status)}>
              {titleCaseEnum(event.status)}
            </SemanticBadge>
          </div>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-[var(--text-secondary)]">
                {event.dateLabel} date
              </dt>
              <dd className="font-semibold">
                {formatDate(event.effectiveDate)}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--text-secondary)]">Expected amount</dt>
              <dd className="font-semibold">
                {formatCurrency(event.expectedAmount, event.currency)} ·{" "}
                {event.amountLabel}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--text-secondary)]">Typical account</dt>
              <dd className="break-words">
                {event.accountName ?? "Not available"}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--text-secondary)]">Confidence</dt>
              <dd>{titleCaseEnum(event.confidence)}</dd>
            </div>
          </dl>
          {event.confirmedDueDate && event.predictedPostingDate ? (
            <p className="mt-3 text-xs text-[var(--text-secondary)]">
              Predicted posting: {formatDate(event.predictedPostingDate)}{" "}
              (estimate)
            </p>
          ) : null}
          {event.lastMatchingTransaction ? (
            <p className="mt-3 text-xs break-words text-[var(--text-secondary)]">
              Last matched:{" "}
              {event.lastMatchingTransaction.merchantName ??
                event.lastMatchingTransaction.originalName}
              {event.lastMatchingTransaction.postedAt
                ? ` on ${formatDate(event.lastMatchingTransaction.postedAt)}`
                : ""}
            </p>
          ) : null}
          <Link
            className="mt-4 inline-flex min-h-11 items-center font-semibold text-sky-700 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)] dark:text-sky-300"
            href={`/calendar?view=upcoming&days=${days}`}
          >
            Review in Calendar
          </Link>
        </li>
      ))}
    </ol>
  );
}

export function BillsPage({ model }: { model: BillsViewModel }) {
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header>
        <p className="text-sm font-semibold tracking-wide text-sky-700 uppercase dark:text-sky-300">
          Milestone 9 · Bills and spending
        </p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">Bills</h1>
        <p className="mt-2 max-w-3xl text-[var(--text-secondary)]">
          Review recurring outflows using the same confirmed dates, predictions,
          and local corrections as Calendar.
        </p>
      </header>
      <nav aria-label="Upcoming bill range" className="flex flex-wrap gap-2">
        {[14, 30, 60, 90].map((days) => (
          <Link
            key={days}
            href={`/bills?days=${days}`}
            aria-current={model.days === days ? "page" : undefined}
            className={`inline-flex min-h-11 items-center rounded-lg border px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)] ${model.days === days ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900" : "bg-[var(--surface-panel)]"}`}
          >
            {days} days
          </Link>
        ))}
      </nav>
      {model.isEmpty ? (
        <Card className="p-8 text-center">
          <h2 className="text-xl font-bold">No recurring history yet</h2>
          <p className="mt-2 text-[var(--text-secondary)]">
            Add a recurring item in Calendar or refresh recurring detection
            after transaction history is available.
          </p>
        </Card>
      ) : (
        <section
          aria-labelledby="bill-summary"
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          <h2 id="bill-summary" className="sr-only">
            Bill summary
          </h2>
          <Card className="p-4">
            <p className="text-sm text-[var(--text-secondary)]">
              Upcoming outflows
            </p>
            <SemanticValue
              tone="negative"
              label="Upcoming outflows"
              className="mt-1 block text-2xl"
            >
              −{formatCurrency(model.upcomingTotal)}
            </SemanticValue>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-[var(--text-secondary)]">
              Confirmed dates
            </p>
            <p className="mt-1 text-2xl font-bold">{model.confirmedCount}</p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-[var(--text-secondary)]">
              Predicted dates
            </p>
            <p className="mt-1 text-2xl font-bold">{model.predictedCount}</p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-[var(--text-secondary)]">
              Needs confirmation
            </p>
            <SemanticValue
              tone="warning"
              label="Needs confirmation"
              className="mt-1 block text-2xl"
            >
              {model.needsConfirmationCount}
            </SemanticValue>
          </Card>
        </section>
      )}
      <p className="text-sm text-[var(--text-secondary)]">
        Predicted dates are estimates and never become overdue unless a due date
        has been confirmed.
      </p>
      {model.stateMessages.length ? (
        <Notice tone="warning" title="Bill data notice" role="status">
          <ul className="list-disc space-y-1 pl-5">
            {model.stateMessages.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </Notice>
      ) : null}
      <section aria-labelledby="outflows-heading" className="space-y-3">
        <div>
          <h2 id="outflows-heading" className="text-xl font-bold">
            Recurring outflows · next {model.days} days
          </h2>
          <p className="text-sm text-[var(--text-secondary)]">
            Paid and skipped occurrences remain visible for context but are not
            included in the upcoming total.
          </p>
        </div>
        <BillList
          events={model.bills}
          empty="No recurring outflows are expected in this range."
          days={model.days}
        />
      </section>
      <section aria-labelledby="income-heading" className="space-y-3">
        <div>
          <h2 id="income-heading" className="text-xl font-bold">
            Expected income
          </h2>
          <p className="text-sm text-[var(--text-secondary)]">
            Shown separately and never included in bill totals.
          </p>
        </div>
        <BillList
          events={model.expectedIncome}
          empty="No expected recurring income is available in this range."
          days={model.days}
        />
      </section>
      {model.inactive.length ? (
        <details className="rounded-xl border bg-[var(--surface-panel)] p-4">
          <summary className="min-h-11 cursor-pointer font-semibold">
            Inactive and dismissed recurring items ({model.inactive.length})
          </summary>
          <ul className="mt-3 space-y-2 text-sm text-[var(--text-secondary)]">
            {model.inactive.map((event) => (
              <li key={event.id} className="break-words">
                {event.title} · Inactive
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
