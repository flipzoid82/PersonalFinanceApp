# Milestone 7 architecture: recurring detection

## Scope, ownership, and data flow

Milestone 7 derives recurring streams from normalized local transaction
history and projects them into the existing Calendar. It does not add the
Milestone 8 transaction-management product or the Milestone 9 Bills and
Spending product.

Every run receives the authenticated owner ID. Its transaction query requires
the same owner on both the transaction and active account. Stream, projection,
override, matching, and stale-state queries repeat that owner predicate.
Browser input never supplies an owner ID.

The server flow is:

1. Acquire an owner-specific PostgreSQL transaction advisory lock.
2. Read eligible posted transaction history.
3. Apply existing local overrides as effective detection inputs.
4. Normalize counterparties and group deterministic candidates.
5. Classify intervals, estimate amounts, and calculate confidence.
6. Upsert inferred streams and bounded projections.
7. Match eligible posted transactions to unmatched inferred projections.
8. Mark sufficiently stale inferred-only streams inactive.
9. Commit all stream, projection, and matching changes together.

## Eligible history and effective-value precedence

Detection includes only posted transactions on active owner-owned accounts
with a three-letter currency, a posting date, no provider-removal timestamp,
and an eligible financial role. Pending and canceled rows, provider removals,
report-excluded rows, refunds, cash withdrawals, investment activity,
unsupported fees and interest, and unclassified transactions do not
participate.

Effective values use:

1. `TransactionOverride` merchant, category, role, and report exclusion
2. normalized provider merchant/category data
3. original transaction name as the merchant fallback

No override is created automatically. Original provider values are never
rewritten. Provider categories are mapped conservatively to income, expense,
debt payment, credit-card payment, or transfer only when the category is
explicit. Generic transfers without a stable counterparty are excluded.
Credit-card payments can form their own transfer-like recurring stream but
never become spending.

## Counterparty normalization and grouping

Normalization uses Unicode compatibility normalization, trimming, lowercase,
collapsed whitespace, punctuation removal, conservative `.com`, `.net`, and
`.org` removal, and removal of a trailing numeric terminal/reference fragment
of at least four digits. Thus `NETFLIX.COM 12345`, `Netflix.com`, and `NETFLIX`
can group together. No fuzzy edit-distance matching is used, so `Amazon`,
`Amazon Web Services`, and `Amazon Fresh` remain distinct. This deliberately
accepts some false negatives to reduce false-positive bills.

The stable grouping identity contains owner, account, currency, inflow/outflow
direction, effective financial role, recurring flow type, and normalized
counterparty. Detection never groups across owners, accounts, currencies, or
directions.

## Frequency and interval classification

Supported inferred frequencies are weekly, biweekly, semimonthly, monthly,
quarterly, and annual. Daily, bimonthly, semiannual, and irregular schedules
are not guessed.

Minimum history is three occurrences except for an exceptionally clear annual
pair. Calendar-aware tolerances are:

- weekly: 7 days, plus or minus 2
- biweekly: 14 days, plus or minus 3
- monthly: one calendar month, plus or minus 5 days
- quarterly: three calendar months, plus or minus 10 days
- annual: twelve calendar months, plus or minus 14 days

One missing cycle is tolerated at reduced regularity. Month-end observations
remain month-end across 28/29/30/31-day months. Semimonthly classification
requires two separated day-of-month clusters and variable calendar spacing;
an exact 14-day series remains biweekly. Future semimonthly dates are generated
from the two anchors, never by repeatedly adding 15 days.

## Amount estimation and confidence

All money stays in `Prisma.Decimal`. Expected amount is the median absolute
observed amount. Observed variation is the median absolute deviation from that
median, so one outlier cannot dominate the result. A pattern is fixed when the
deviation is at most the greater of 2 currency units or 5 percent; otherwise it
is estimated/variable.

Confidence is deterministic:

- occurrences: 15 percent
- interval regularity: 30 percent
- amount regularity: 20 percent
- provider/override merchant quality: 10 percent
- account consistency: 10 percent
- recent continuity: 15 percent
- one missed cycle: minus 5 percent
- two or more missed cycles: minus 15 percent

High is `0.80` through `1.00`; medium is `0.55` through `0.7999`; lower is low.
Only high and medium candidates create projected events. A new low-confidence
candidate is not persisted. Explainable inputs, occurrence IDs/dates,
regularity, deviation, anchors, and missed-cycle count are stored as
server-side detection metadata.

## Schema, stream identity, and inactive patterns

The existing schema already separated manual and inferred provenance and had
confidence, prediction, confirmation, status, and override fields. It lacked
database-enforceable identities for inferred streams and occurrences.

The forward-only Milestone 7 migration adds nullable:

- `RecurringStream.detectionKey`, version, metadata, and last-detected time
- `CalendarEvent.projectionKey`

It adds owner-scoped unique indexes for detection keys, projection keys, and
non-null linked transaction IDs. Nullable keys preserve every existing manual
and historical row.

The detection key hashes the complete grouping identity. Manual streams have
no detection key and are never selected for inferred upsert. Existing
inferred streams update only inferred fields. Confirmed due dates and Calendar
overrides remain untouched. A current inactive/not-a-bill stream override
prevents reactivation.

After two missed expected cycles, an inferred-only stream becomes inactive.
User-confirmed streams do not become inactive automatically. Historical
streams and occurrences are never deleted.

## Calendar projections and date precedence

High- and medium-confidence streams project every occurrence through 90 days.
An annual stream retains one next occurrence even when it falls beyond that
window. Projection identity is a stream/cycle key: calendar month or quarter,
year, week, anchored biweek, or semimonthly half. Posting drift therefore
updates an unmatched projection in the same cycle instead of creating a
duplicate.

Detection writes only inferred event and predicted-posting dates. It never
writes a confirmed due date. Existing Calendar precedence remains:

1. event override
2. stream override
3. user-confirmed event value
4. source/inferred event
5. recurring-stream fallback

Paid, skipped, confirmed, inactive, overridden, and transaction-linked
historical events are not rewritten.

## Posted matching and overdue safety

Matching uses owner, inferred stream identity, unused posted status, active
account, currency, role/direction, amount, and date. Pending, canceled, and
removed transactions cannot match. High-confidence projections use a
plus-or-minus 5-day window; medium uses 7 days. Fixed amounts use the greater
of 5 currency units or 10 percent. Variable amounts also consider twice the
median deviation, capped at 35 percent and 250 currency units.

Candidates are ranked deterministically by date and amount distance. Two
similarly plausible candidates remain unmatched. The unique linked-transaction
index and transaction-scoped update prevent one transaction from satisfying
two events. Accepted matches link the original normalized transaction, store
its absolute actual amount, and mark the occurrence paid without modifying the
transaction.

The Milestone 4 overdue derivation is unchanged: only a confirmed, unpaid,
past due occurrence can be overdue. Predicted-only, paid, skipped, inactive,
and not-a-bill events never become overdue.

## Concurrency and Plaid boundary

An owner-specific PostgreSQL advisory transaction lock serializes manual,
sync-driven, and webhook-driven runs across processes. Owner-scoped unique
constraints are a second database-level safeguard. Detection changes commit
atomically.

Plaid account and transaction persistence remains authoritative and commits
first. Initial exchange, manual sync, repair sync, and verified webhook sync
then invoke recurring detection. Detection failure is returned as a safe
secondary status and does not roll back or mark correctly persisted Plaid
history as failed. The Calendar refresh action provides an owner-only recovery
entry point.

### Replacement Item account identity

Plaid Item and provider account IDs are not assumed to remain stable across a
replacement Sandbox Item. A reliable logical identity is derived from the
owner, provider, institution, mask, normalized official/name, mapped account
type/subtype, and currency. The resulting key is unique per owner. A separate
provider-account link table retains every observed Item/account identity and
which link is current.

Sync takes an owner-scoped PostgreSQL advisory lock before resolving accounts.
It reuses an account by provider link or logical identity, reattaches it to the
new Item, and retires an earlier Item only after that Item has no remaining
current accounts. Shared current-balance queries additionally exclude accounts
attached only to disconnected Items.

The idempotent repair service uses the same lock and identity. It selects the
oldest normalized account as canonical, applies the newest current balance and
connection metadata, remaps transactions, streams, Calendar events, holdings,
and snapshots, records the removed account metadata in an audit row, and
retains historical provider links. Exact replacement transaction copies remain
as canceled history, and duplicate inferred streams remain inactive so they
cannot affect reports or projections. Dry-run mode executes the complete
repair and deliberately rolls back.

## States, accessibility, and limitations

No eligible history, insufficient history, low confidence, stale patterns,
ambiguous matching, and override conflicts all produce safe no-op or explicit
states. The Calendar explains that predictions are estimates, retains
Predicted/Confirmed text labels, uses semantic theme tokens, supports keyboard
operation, and keeps the existing one-column mobile behavior and accessible
list alternative.

Tests cover normalization, intervals, exact money, confidence boundaries,
eligibility, owner/account/currency/direction separation, PostgreSQL
idempotency and concurrency, precedence, projections, posted matching,
pending/removed exclusion, stale handling, Plaid failure isolation, webhook
triggering, existing Calendar overdue behavior, Overview calculations,
authentication, and seed idempotency.

Known limitations are deliberate: no fuzzy merchant model, holiday calendar,
cross-account grouping, low-confidence management UI, background job
infrastructure, transaction editing, full Bills page, or advanced forecast.
Milestone 8 was not started.
