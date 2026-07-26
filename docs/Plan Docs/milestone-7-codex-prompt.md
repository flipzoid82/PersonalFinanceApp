# Milestone 7 Codex Prompt

## Objective

Build Milestone 7 of the personal finance application: recurring transaction detection and calendar projection.

Do not proceed beyond Milestone 7.

## Read First

Before making changes, read every planning document under:

```text
docs/Plan Docs/
```

Also inspect:

- the merged Milestone 6 implementation
- the current Prisma schema and migrations
- existing recurring/calendar queries, actions, components, and tests
- Plaid transaction synchronization and reconciliation
- the Overview and Calendar behavior
- README and architecture notes
- Git history through the Milestone 6 merge

Treat the planning documents and current implementation as the source of truth.

If this prompt conflicts with a planning document or with established Milestone 4–6 behavior, stop and report the conflict before implementing.

## Branch and Git Hygiene

Start from updated `main`:

```text
git switch main
git pull --ff-only
git switch -c feature/milestone-7
```

Work only on:

```text
feature/milestone-7
```

Do not commit, push, or open a pull request unless explicitly asked.

Do not modify planning documents unless explicitly asked.

## Milestone Scope

Milestone 7 must:

- derive recurring candidates from transaction history
- calculate expected future dates and amounts
- assign confidence levels
- keep inferred posting dates separate from confirmed due dates
- create or update projected calendar events
- match eligible posted transactions to projected events
- prevent predicted-only events from becoming overdue
- preserve owner scoping, provider data, local overrides, and historical auditability
- remain idempotent across repeated runs and Plaid re-syncs

This milestone is the detection engine and Calendar integration. It is not the full Bills or Transactions product.

## Preserve Existing Behavior

Do not break or replace:

- owner-only authentication
- server-side route protection
- logout behavior
- manual accounts, assets, debts, and investments
- Overview totals and double-count prevention
- Plaid Link, exchange, encryption, sync, webhook, repair, disconnect, or reconnect
- transaction pending-to-posted reconciliation
- provider transaction history
- Calendar manual confirmation and correction flows
- Calendar override precedence
- existing semantic status styles
- dark-mode foundations
- mobile layouts
- PostgreSQL-backed CI tests

Pending transactions must remain excluded from finalized matching and paid status.

## Non-Negotiable Domain Rules

1. Original provider or imported transaction values are immutable.
2. User corrections remain in override records.
3. Transfers are not spending or income.
4. Credit-card payments are transfers.
5. Pending transactions are not eligible to satisfy projected events.
6. An inferred posting date is not a contractual due date.
7. A confirmed due date must come from an existing user confirmation/override path or another explicit trusted source.
8. Predicted-only events must never be marked overdue.
9. User-confirmed values and statuses take precedence over detection output.
10. A detection run must not erase, replace, or silently rewrite user-confirmed records.
11. Detection must be owner-scoped.
12. Re-running detection with unchanged history must not create duplicate streams or calendar events.

## Required Initial Analysis

Before implementation, report internally in the work log:

1. current `Transaction`, `TransactionOverride`, `RecurringStream`, `CalendarEvent`, and `CalendarOverride` fields
2. current enum values and constraints
3. current Calendar matching and overdue rules
4. current Plaid pending/posted and removed-transaction behavior
5. whether the current schema can support deterministic recurring detection
6. any migration that is genuinely required
7. the exact owner-scoping path for every query and mutation

Prefer no schema change.

If a schema change is required:

- explain why existing fields are insufficient
- add a forward-only Milestone 7 migration
- preserve all existing rows
- test upgrade of the current database
- test full migration replay into an empty database
- preserve exact monetary types
- avoid provider-specific schema design

## Detection Input

Use normalized local transaction records.

Only eligible transactions may participate in recurring detection:

- posted/finalized transactions
- active owner-owned accounts
- supported currencies
- records not marked removed/inactive by provider reconciliation
- records not excluded by an existing local override
- financial roles eligible for recurring bills, subscriptions, debt payments, transfers, or income

Exclude from candidate generation unless current product definitions explicitly permit them:

- pending transactions
- reversed or removed transactions
- duplicate records
- one-time refunds
- cash withdrawals
- generic internal transfers without a stable counterparty
- credit-card payments from spending detection
- investment trades
- fees or interest that do not demonstrate a stable pattern
- transactions whose override marks them as excluded or not recurring
- synthetic seed artifacts that are intentionally non-recurring

Do not invent Milestone 8 transaction-editing behavior.

## Effective Transaction Values

When local overrides already exist, detection may use effective local values only where the existing architecture defines them.

Rules:

- preserve original provider values unchanged
- do not create new transaction overrides automatically
- document whether merchant/category/financial-role overrides affect detection
- use the same effective-value precedence consistently in detection, matching, and tests
- never use a display-only transformed value as an untracked source of truth

## Merchant and Counterparty Normalization

Create a deterministic normalization layer for recurring grouping.

At minimum:

- prefer normalized merchant/counterparty fields already stored by the app
- fall back to original transaction name when needed
- trim whitespace
- normalize case
- collapse repeated whitespace
- remove clearly variable terminal/reference fragments only when the rule is conservative and tested
- do not merge distinct merchants merely because their names are similar
- include owner, account context, currency, flow direction, and financial role in the candidate identity as appropriate

Examples that may normalize together when supported by tests:

```text
NETFLIX.COM 12345
Netflix.com
NETFLIX
```

Examples that must not be merged without strong evidence:

```text
Amazon
Amazon Web Services
Amazon Fresh
```

Document every normalization rule and its false-positive tradeoff.

## Candidate Grouping

A recurring candidate should be based on a stable deterministic identity, such as:

- owner
- normalized merchant/counterparty
- account or account family where appropriate
- currency
- inflow/outflow direction
- financial role
- recurring type

Do not group across currencies.

Do not group inflows with outflows.

Do not group across accounts when doing so could combine unrelated obligations. If cross-account grouping is supported for a specific transfer or income case, make the rule explicit and tested.

## Minimum History

A recurring stream may be inferred only from sufficient posted history.

Implementation baseline:

- at least 3 eligible occurrences for monthly, weekly, biweekly, semimonthly, or quarterly inference
- at least 2 eligible occurrences for annual inference only when the interval and merchant identity are exceptionally clear
- fewer observations may remain unclassified and must not create a projected event

These are implementation requirements for this milestone because the planning documents do not prescribe thresholds. Keep the values centralized and documented.

## Supported Frequencies

Support only frequencies already represented by the current data model.

At minimum, where the existing enum permits:

- weekly
- biweekly
- semimonthly
- monthly
- quarterly
- annual

Do not add daily detection unless already required by the planning documents and current schema.

Do not guess an unsupported frequency. Leave ambiguous candidates undetected or mark them as needing confirmation only if the current model supports that without creating false certainty.

## Interval Detection

Use calendar-aware interval analysis rather than a single average-day calculation.

Requirements:

- sort eligible occurrences chronologically
- calculate consecutive intervals
- tolerate normal posting drift
- distinguish 14-day biweekly patterns from twice-monthly patterns
- recognize monthly patterns across 28/29/30/31-day months
- account for weekends and bank processing shifts
- tolerate a limited missing cycle without converting the frequency incorrectly
- reject patterns with excessive interval variance
- avoid using pending authorization dates as posted dates
- use posted date as the primary recurring observation unless existing definitions require another field

Centralize tolerances and document them.

Suggested starting tolerances:

- weekly: expected 7 days, tolerance ±2 days
- biweekly: expected 14 days, tolerance ±3 days
- monthly: calendar-month progression with day-of-month drift up to ±5 days
- quarterly: calendar-quarter progression with drift up to ±10 days
- annual: calendar-year progression with drift up to ±14 days

These are implementation choices, not source-document requirements. Adjust only when evidence from the current application or tests justifies it.

## Semimonthly Detection

Do not classify a 14-day pattern as semimonthly.

Semimonthly detection requires evidence of two stable monthly anchors, such as:

- approximately the 1st and 15th
- approximately the 15th and final business/calendar days
- another stable pair of day-of-month clusters

The expected dates should be generated from the detected calendar anchors rather than by repeatedly adding 15 days.

## Amount Estimation

Calculate an expected amount using exact decimal arithmetic.

Requirements:

- never use binary floating point for stored or compared money
- use the current exact-money conventions
- keep income and outflow sign semantics consistent with the existing model
- calculate a robust central estimate, preferably median
- calculate observed spread or deviation
- distinguish fixed from variable amount patterns
- avoid a single outlier dominating the expected amount
- keep currency unchanged
- do not create a range field unless the schema and UI genuinely require it

Suggested behavior:

- fixed amount: low variation, use median or stable last amount according to documented rule
- variable amount: use median as expected amount and reduce confidence
- unusually large recent change: reduce confidence rather than silently replacing the established pattern
- user-confirmed amount override takes precedence for the affected event/stream

Document the exact amount tolerance used for detection and matching.

## Confidence Scoring

Assign both a human-readable confidence level and a deterministic score if the current schema supports a score.

Confidence must be explainable.

Use factors such as:

- number of occurrences
- interval regularity
- stable calendar position
- amount regularity
- merchant identity quality
- account consistency
- missing cycles
- outliers
- recent pattern continuity
- eligibility certainty of the financial role

Do not use opaque machine learning.

Suggested score bands:

- high: 0.80–1.00
- medium: 0.55–0.79
- low: below 0.55

Only high- and medium-confidence candidates should create projected calendar events by default.

Low-confidence candidates may be stored only if the current product model has a safe `needs_confirmation` representation. Otherwise, do not persist them.

Centralize score weights and thresholds. Add unit tests at every boundary.

## Recurring Stream Identity and Upsert

Detection must be idempotent.

For each inferred stream:

- use a stable deterministic matching identity
- update the existing inferred stream rather than creating a duplicate
- preserve user-created/manual streams
- preserve confirmed dates and overrides
- preserve user-deactivated or not-a-bill decisions
- do not reactivate a stream the user deactivated
- do not overwrite user-provided descriptions, frequencies, due dates, amounts, or statuses
- keep inferred fields updated only where no higher-precedence value exists
- record the latest eligible observation date
- update predicted next date and expected amount consistently

If current schema cannot distinguish an inferred stream from a manual stream safely, stop and explain the schema gap before implementing.

## Inactive and Disappearing Patterns

A pattern that stops appearing should not be deleted.

Requirements:

- preserve historical streams and linked events
- lower confidence or mark the inferred stream inactive/stale only after a documented number of missed expected cycles
- do not mark user-confirmed streams inactive automatically
- do not erase calendar history
- do not mark missed predicted-only events overdue

Suggested baseline:

- after 2 missed expected cycles, reduce confidence or mark inferred-only stream stale/inactive
- annual streams require a longer tolerance appropriate to their frequency

Document and test the policy.

## Date Semantics

Maintain strict separation among:

- observed posted date
- inferred next posting date
- confirmed due date
- event display date
- provider date, where applicable

Rules:

- inferred history updates `predictedPostingDate` or the equivalent inferred field
- detection must not populate `confirmedDueDate`
- a user-confirmed due date always overrides an inferred posting date for due-date presentation
- projections must clearly retain `dateSource = inferred` unless a higher-precedence source exists
- changing a prediction must not mutate a confirmed date
- Calendar labels must continue to distinguish “Predicted” from “Confirmed”

## Calendar Projection

Create or update projected events for eligible inferred streams.

Requirements:

- project only a bounded future window
- avoid unbounded event creation
- use deterministic event identity
- update existing unmatched inferred projections instead of duplicating them
- never overwrite historical paid/skipped/confirmed events
- preserve Calendar overrides
- retain links to recurring streams
- use expected amount and inferred date source
- use the current event type mapping
- retain owner and account scoping
- avoid generating duplicate events after repeated detection runs, syncs, or webhook processing

Suggested projection horizon:

- create the next occurrence and enough future events to cover the existing Calendar maximum upcoming range
- do not project beyond 90 days unless the current Calendar architecture already requires more
- annual streams may need one next occurrence even when it falls outside 90 days; document the decision

## Matching Posted Transactions to Projected Events

Reuse or extend the existing Milestone 4 matching logic rather than creating a conflicting second system.

Only posted/finalized transactions may satisfy an event.

Matching should consider:

1. owner
2. unmatched transaction status
3. recurring stream identity or normalized merchant/counterparty
4. account consistency
5. currency
6. flow direction and financial role
7. amount tolerance
8. date window
9. event state and override state

Requirements:

- pending transactions never satisfy events
- removed/reversed transactions never satisfy events
- one transaction cannot satisfy multiple events
- one event cannot link to multiple transactions
- user-accepted/manual links take precedence
- exact or strongest deterministic match wins
- ambiguous matches must remain unmatched or require confirmation
- accepted matching links the transaction, records actual amount, and sets the appropriate paid/completed state
- matching must be idempotent
- a later Plaid sync must not duplicate or relink an already valid historical match
- pending-to-posted replacement must retain or correctly establish the match using the finalized transaction

Suggested matching windows:

- high-confidence fixed schedule: ±5 days
- medium-confidence or variable schedule: ±7 days
- annual/quarterly patterns may use a larger documented window

Suggested amount tolerance:

- fixed pattern: max of a small absolute tolerance and 10%
- variable pattern: wider tolerance based on observed spread, with an absolute cap
- transfers and income may require stricter account/direction checks

Centralize and test every tolerance.

## Ambiguous Matches

When two or more transactions are similarly plausible:

- do not auto-match
- leave the event predicted/needs confirmation
- expose the state through existing Calendar behavior if supported
- do not add a Milestone 8 transaction management UI
- document the reason in server-side detection metadata or tests if the schema supports it safely

## Overdue Rules

Preserve and enforce:

- predicted-only events are never overdue
- inferred posting dates alone cannot create overdue state
- confirmed unpaid events may become overdue only under the existing Milestone 4 rules
- paid, skipped, inactive, dismissed, or not-a-bill events are not overdue
- pending transactions do not prevent or satisfy overdue evaluation
- detection must not downgrade or override a user-confirmed paid/skipped status

Add explicit regression tests.

## Triggering Detection

Implement a clear server-side detection entry point.

It must support:

- owner-scoped full recomputation
- safe invocation after successful Plaid transaction sync
- safe invocation after relevant webhook-driven sync
- manual development/test invocation if appropriate
- transaction boundaries or sequencing that prevent partial stream/event state
- failure isolation so Plaid transaction persistence is not corrupted if detection fails

Do not make webhook responses unnecessarily slow.

Preferred design:

- transaction sync remains authoritative for provider records
- recurring detection runs after a successful committed sync
- detection failure is recorded/reported safely without rolling back correctly persisted Plaid transaction history
- repeated invocation remains idempotent

If using background jobs would require new infrastructure outside the project’s current architecture, do not introduce it in this milestone.

## Concurrency

Protect against concurrent detection for the same owner.

Requirements:

- avoid duplicate streams/events when manual sync and webhook sync overlap
- use database constraints, transactions, advisory locking, or another PostgreSQL-safe approach
- do not rely only on in-memory locks
- test at least the deterministic uniqueness/idempotency behavior
- document the concurrency strategy

## UI Scope

Milestone 7 may update existing Calendar and Overview surfaces only as needed to display detected recurring projections correctly.

Allowed:

- predicted recurring events appearing in Calendar
- confidence and predicted labels
- expected amount and predicted posting date
- safe empty/loading/error states
- a minimal owner-only “Refresh recurring detection” control only if needed for testing or recovery
- accessible explanation text for inferred predictions

Not allowed:

- full Bills page
- recurring-stream management dashboard
- transaction table/search/detail UI
- category-editing UI
- notes UI
- report-exclusion UI
- unusual-spending UI
- advanced forecasting
- notifications
- bill payment

Do not start Milestone 8 or 9.

## Accessibility and Responsive Design

Preserve:

- semantic headings and labels
- visible focus
- keyboard operability
- confidence/status meaning that is not color-only
- accessible text for predicted versus confirmed
- mobile one-column behavior
- no horizontal overflow at 375×812
- readable dark rendering
- semantic color tokens rather than one-off colors

Do not add a user-facing theme switcher; that remains later scope.

## Error and Empty States

Handle safely:

- no eligible transactions
- insufficient history
- no recurring patterns detected
- only low-confidence candidates
- stale/disconnected Plaid source
- partial transaction history
- detection failure
- projection conflict with an override
- ambiguous matching
- inactive recurring pattern

Do not claim completeness when account history is partial.

If transaction history coverage is insufficient, reduce confidence or avoid creating predictions.

## Schema and Migration Requirements

Prefer existing models.

A migration is acceptable only when necessary for one or more of:

- deterministic inferred-stream identity
- safe projection uniqueness
- detection timestamps/version
- explainable confidence metadata
- concurrency-safe uniqueness
- preserving manual versus inferred provenance

Do not add fields merely for convenience.

Any new uniqueness constraint must account for nullable fields and existing historical data.

## Tests

At minimum add tests for:

1. owner-scoped detection
2. no eligible transactions
3. pending transactions excluded
4. removed/reversed transactions excluded
5. three monthly occurrences detected
6. monthly calendar drift across short months
7. weekly detection
8. biweekly detection
9. semimonthly versus biweekly distinction
10. quarterly detection
11. annual detection threshold
12. insufficient history rejected
13. currency separation
14. inflow/outflow separation
15. account separation
16. conservative merchant normalization
17. distinct merchants not merged
18. transfer and credit-card-payment treatment
19. exact decimal amount handling
20. fixed amount estimation
21. variable amount estimation
22. outlier resistance
23. confidence score boundaries
24. low-confidence persistence policy
25. stable recurring-stream upsert
26. repeated detection idempotency
27. concurrent/repeated invocation uniqueness
28. manual stream preservation
29. user-deactivated stream not reactivated
30. not-a-bill override preservation
31. confirmed due date preservation
32. inferred date never written as confirmed due date
33. bounded calendar projection
34. repeated projection idempotency
35. historical paid/skipped events preserved
36. posted transaction matching
37. pending transaction not matched
38. removed transaction not matched
39. amount tolerance
40. date tolerance
41. account/currency/role matching
42. ambiguous match remains unmatched
43. one transaction cannot satisfy two events
44. pending-to-posted replacement matching
45. predicted-only never overdue
46. confirmed unpaid past-due behavior unchanged
47. paid/skipped/inactive not overdue
48. Plaid sync remains correct when detection succeeds
49. Plaid transaction history remains persisted when detection fails
50. reconnect remains duplicate-free
51. Overview remains correct
52. Calendar filters/ranges remain correct
53. authentication/logout remain correct
54. signed-out route protection remains correct
55. responsive structure
56. dark semantic rendering regression
57. seed idempotency
58. migration replay if schema changes
59. PostgreSQL test suite runs without silent skips
60. Milestone 8/9 scope not introduced

Use PostgreSQL for database-dependent tests.

Do not silently skip tests when `TEST_DATABASE_URL` is missing in CI.

## Seed Data

Extend synthetic seed data only if necessary to demonstrate recurring detection.

Requirements:

- no real financial data
- no real credentials or provider tokens
- deterministic dates and amounts
- examples for fixed monthly, variable monthly, income, biweekly, and non-recurring lookalikes
- pending transaction that must not match
- transfer/credit-card payment that must not become spending
- repeated seed remains idempotent
- existing owner password remains unchanged

Avoid making production behavior depend on seed-only flags.

## Documentation

Update README with:

- Milestone 7 status
- detection input and exclusions
- supported frequencies
- normalization policy
- interval and amount tolerances
- confidence calculation
- inferred versus confirmed dates
- projection horizon
- matching behavior
- overdue safety rule
- trigger behavior after Plaid sync/webhook
- limitations and false-positive safeguards
- test commands
- explicit note that Milestone 8 and 9 are not implemented

Create:

```text
docs/architecture-milestone-7.md
```

Document:

- ownership
- data flow
- eligible transaction rules
- effective-value precedence
- normalization
- grouping identity
- interval classification
- amount estimation
- confidence scoring
- stream upsert
- inactive-pattern policy
- projection identity and horizon
- matching precedence and tolerances
- overdue rules
- concurrency
- Plaid integration boundary
- schema decision
- errors/states
- tests
- limitations
- confirmation that Milestone 8 was not started

## Required Verification

Run and pass:

```text
pnpm db:generate
pnpm exec prisma validate
pnpm exec prisma migrate status
pnpm lint
pnpm typecheck
pnpm test
pnpm format:check
pnpm build
```

Also:

- run the full PostgreSQL suite using the isolated test database
- test migration upgrade and full replay if schema changes
- run seed twice
- run recurring detection twice and prove no duplicates
- run detection after manual Plaid sync
- run detection after webhook-driven sync or its integration-test equivalent
- verify pending transactions never match
- verify predicted-only events never become overdue
- verify reconnect remains duplicate-free
- physically test Calendar month view
- physically test 14/30/60/90-day upcoming views
- physically test predicted versus confirmed labels
- physically test a matched posted transaction
- physically test ambiguous/no-pattern states
- physically test dark rendering
- physically test 375×812 without horizontal overflow
- test logout and signed-out route protection
- inspect browser console where available
- run `git diff --check`
- restore unrelated generated changes such as `next-env.d.ts`
- remove temporary verification files and logs
- scan for credentials and real financial data
- confirm no Milestone 8 or 9 code was added

## Out of Scope

Do not implement:

- full Transactions page
- transaction search or filters
- transaction detail view
- transaction category/role editing UI
- transaction notes
- report exclusion controls beyond honoring existing fields
- full Bills page
- recurring-stream management dashboard
- spending categories or reports
- merchant totals
- month-over-month spending comparisons
- unusual-spending indicators
- CSV/PDF import
- Fidelity automatic sync
- Plaid Production or real institutions
- bill payment
- money movement
- investment performance
- allocation advice
- debt payoff advice
- notifications
- advanced forecasting
- machine-learning infrastructure
- multi-user or household features
- production deployment
- Milestone 8 or later work

## Completion Criteria

Milestone 7 is complete only when:

- eligible posted history produces deterministic recurring candidates
- supported frequencies are classified conservatively
- expected dates and amounts are calculated with exact arithmetic
- confidence is deterministic and explainable
- inferred streams upsert without duplication
- confirmed/manual values and overrides are preserved
- projected events are bounded and idempotent
- eligible posted transactions match safely
- pending/removed transactions cannot satisfy events
- predicted-only events never become overdue
- Plaid sync/reconnect behavior remains correct
- owner scoping, accessibility, responsive behavior, tests, seed, migrations, lint, typecheck, formatting, and build all pass
- no Milestone 8 or 9 work is included

## Final Report

Stop and report:

1. implementation summary
2. files changed
3. schema and migration decision
4. eligible transaction rules
5. normalization rules
6. grouping identity
7. supported frequencies
8. interval tolerances
9. amount estimation
10. confidence formula and thresholds
11. recurring-stream upsert and idempotency
12. inactive-pattern policy
13. calendar projection behavior
14. transaction matching algorithm
15. inferred versus confirmed precedence
16. overdue rules
17. concurrency strategy
18. Plaid sync/webhook integration
19. seed changes
20. tests and totals
21. accessibility/theme/responsive behavior
22. commands and results
23. physically tested flows
24. assumptions
25. unresolved issues
26. confirmation no credentials or real financial data were added
27. confirmation nothing was committed or pushed
28. confirmation Milestone 8 and 9 were not started
