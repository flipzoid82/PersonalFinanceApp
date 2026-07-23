# Milestone 4 Calendar Architecture

Milestone 4 turns only the authenticated Calendar route into an editable calendar and recurring-event experience. It does not detect recurring patterns, generate a schedule, sync providers, or implement Milestone 5 manual asset and investment workflows.

## Schema decision and ownership

The existing `RecurringStream`, `CalendarEvent`, `CalendarOverride`, and `Transaction` models are sufficient, so Milestone 4 adds no schema change or migration. `CalendarEvent.linkedTransactionId` and `actualAmount` represent an accepted payment, while `CalendarOverride` holds corrections. Manual recurring creation uses the existing `MANUAL` date and amount sources.

Every query starts with the authenticated `userId`. Included accounts, overrides, streams, historical matches, and transactions are owner-filtered. Every mutation first finds its event, stream, account, or transaction using both its ID and the authenticated owner ID. Cross-owner identifiers therefore behave as missing records. Server actions validate again on the server, revalidate Calendar and Overview, and return only allow-listed messages rather than raw database errors.

## Effective values and correction history

`src/lib/calendar/effective.ts` is the pure effective-value layer. Field precedence is:

1. newest event-level `CalendarOverride`
2. newest stream-level `CalendarOverride`
3. explicitly user-confirmed event fields
4. normalized source/inferred event fields
5. recurring-stream fallback where the occurrence lacks a value

Overrides are append-only snapshots. Each action copies the previous effective override fields and changes only the requested value. This retains correction history while allowing one newest row to represent a complete local correction. Provider/imported transaction values, event source dates, and stream prediction fields are not rewritten. Stream deactivation is a stream-level override; the source stream remains active, and both Calendar and Overview apply the override.

## Dates, statuses, and freshness

Dates use UTC because the owner model has no time-zone field. Month navigation uses actual UTC month boundaries and renders a fixed six-week grid. Upcoming windows are inclusive from today through day 14, 30, 60, or 90; 30 days is the Calendar default.

A confirmed due date is the effective primary date. A predicted posting date remains supplemental context and is explicitly called a prediction. Without a confirmed date, an occurrence remains predicted even if a source incorrectly supplies an overdue status. Overdue is derived only when a confirmed due date is before today, no posted transaction has been accepted, and the event is not paid, skipped, inactive, or dismissed. Accepted transaction links derive paid status. Skipped and inactive events remain historical month records but do not appear in the default upcoming list.

Confidence is displayed as High, Medium, Low, or Needs confirmation using text. Data is stale after seven days without the relevant source update. A source needing attention or an occurrence without an available amount produces a partial notice without hiding usable records.

## Deterministic paid matching

Matching is pure and testable in `matching.ts`. Pending and canceled transactions are rejected before scoring. Posted candidates are evaluated with these signals:

- normalized recurring-stream merchant/title/description similarity
- account equality
- same recorded currency and an amount difference within the greater of 5 currency units or 10 percent of the expected amount
- posting proximity within seven days of the predicted posting date, or the effective date when no posting prediction exists
- a financial role compatible with the event type

The stream’s normalized merchant identity is the provider-neutral recurring identity available in the current schema. A score of 0.80 or higher is High, 0.55–0.79 is Medium, and lower eligible scores are Low. An unclassified transaction is capped below High because event-type compatibility is unconfirmed. Only High suggestions can be accepted without an additional confirmation flag. Lower-confidence candidates require an explicit owner confirmation. Acceptance occurs transactionally, prevents transaction reuse, links the posted transaction, stores its absolute Decimal amount as actual, and appends a paid override. No transaction source field is changed.

## Validation and actions

Zod validates IDs, dates, positive Decimal-compatible amounts, ISO-style three-letter currencies, enum values, note length, and required manual-event values. Supported server actions are confirmation, due-date/amount/frequency corrections, notes, paid, skipped, not-a-bill, stream deactivation, payment acceptance, and manual recurring creation. An optional account must belong to the owner. Manual creation creates one stream and one occurrence only; schedule generation is intentionally absent.

## Presentation, states, and accessibility

The route is a server component. Querying, Prisma, effective calculations, matching, and mutations stay out of client bundles. Presentation is split into controls, month grid, upcoming list, event details/actions, badges, and the manual form.

The month grid supports keyboard links, visible focus, concise summaries, multiple events per day, text date/status labels, today indication, and a chronological semantic-list alternative. Upcoming entries expose all specified fields. Forms have associated labels and native constraints; mutation success uses a status region and errors use an alert. Status and confidence never rely on color alone. The layout uses wrapping controls, narrow month cells, and one-column detail/form flow on mobile with no fixed wide table.

Loading uses a route skeleton without fake values. Empty history, no events in range, all predictions dismissed, stale, partial, and safe error states each have distinct language. The existing dashboard error boundary hides exception details and keeps retry behavior.

## Tests

Pure tests cover month/year boundaries, every upcoming range, URL filters, override precedence, date separation, overdue safety, status exclusions, posted-only matching, score signals, and low-confidence confirmation. Component tests cover loading, empty, error, feedback, month-grid semantics, accessible list structure, and responsive classes. PostgreSQL tests cover owner-scoped queries and mutations, every correction/action, append-only history, manual creation, transaction linking and actual amount, seed idempotency, and unchanged Milestone 3 Overview totals. Existing authentication, Sign out, schema, and dashboard tests remain in the same CI suite; CI supplies `TEST_DATABASE_URL`, so database tests do not silently skip there.
