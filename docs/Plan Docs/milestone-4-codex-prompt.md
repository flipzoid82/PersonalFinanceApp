# Milestone 4 Codex Prompt

## Objective
Build Milestone 4: Calendar and Recurring Events. Do not begin Milestone 5.

## Read First
Before changes:
1. Confirm `main` matches `origin/main`.
2. Confirm a clean working tree.
3. Read every file in `docs/Plan Docs/`, especially `build-plan.md`, `calendar-spec.md`, `financial-definitions.md`, `product-requirements.md`, `data-model.md`, and `codex-build-brief.md`.
4. Inspect Milestone 3, Prisma schema/migrations/seed/tests, authentication/logout, README, CI, and recent Git history.
5. Stop and report any conflict before implementing.

## Scope
Replace the Calendar placeholder with an authenticated, owner-scoped Calendar experience backed by existing normalized records.

Implement:
- month view
- upcoming list
- 14/30/60/90-day ranges, default 30
- filters
- predicted vs confirmed labels
- confidence labels
- statuses
- confirmed due date vs predicted posting date
- manual confirmation/correction flows
- mark paid, skipped, not-a-bill
- deactivate recurring stream
- add manual recurring event
- paid matching using synthetic posted transactions
- loading, empty, stale, partial, and error states
- responsive and accessible behavior

Do not implement recurring-pattern detection. That belongs to Milestone 7.

## Preserve
Do not break:
- owner-only authentication
- session persistence and Sign out
- protected routes
- Milestone 3 Overview calculations
- migrations and seed idempotency
- provider-neutral architecture
- CI and existing tests
- pages outside Calendar

## Non-Negotiable Rules
- Predicted dates are never guaranteed due dates.
- Confirmed due date and predicted posting date are separate.
- When both exist, confirmed due date is primary.
- Predicted-only events are never overdue.
- Overdue requires a confirmed past due date, no accepted payment match, and not skipped/inactive.
- User corrections are stored separately in `CalendarOverride`.
- Never mutate original provider/imported data.
- Scope every query and mutation to the authenticated owner.
- Use Decimal-safe money handling.

## Month View
Build a traditional monthly calendar with:
- previous/next month
- today/current-month control
- month/year heading
- events on effective dates
- multiple events per day
- concise event summaries
- visible date source and status text
- selected-day details or equivalent
- keyboard access
- mobile usability
- no color-only meaning

Avoid a heavy calendar library unless clearly justified.

## Upcoming List
Show chronological events for 14, 30, 60, and 90 days.

Each item should show:
- title
- event type
- effective date
- predicted or confirmed label
- expected amount and amount source
- account
- frequency
- confidence
- status
- last matching transaction
- notes
- predicted posting date when a confirmed due date exists

## Filters
Support:
- bills
- subscriptions
- debt payments
- credit-card payments
- expected income
- other recurring
- confirmed only
- predicted only
- needs confirmation

Prefer URL search parameters where practical.

## Effective Values
Build a server-side effective-value layer.

Override precedence:
1. `CalendarOverride`
2. user-confirmed event fields
3. source/inferred event fields
4. recurring-stream fallback where appropriate

Support overrides for:
- confirmed due date
- expected amount
- frequency
- status
- not-a-bill
- notes

Document and test precedence.

## Manual Actions
Use secure server actions or equivalent for:
- confirm prediction
- correct due date
- correct expected amount
- correct frequency
- mark paid
- mark skipped
- mark not a bill
- deactivate recurring stream
- create manual recurring event
- update notes

Requirements:
- validate server-side
- verify ownership
- preserve source fields
- use overrides where appropriate
- revalidate routes
- give accessible success/error feedback
- never expose raw DB errors

## Manual Recurring Event
Allow:
- name
- event type
- date
- expected amount
- currency
- optional account
- frequency
- confirmed/predicted state
- optional notes

Label manual data clearly.

## Paid Matching
Implement deterministic matching against posted synthetic transactions using:
- recurring-stream identity
- merchant/description similarity
- account
- amount tolerance
- date proximity
- posted status

Rules:
- pending transactions never count
- high-confidence matches may be accepted
- low-confidence matches require confirmation
- accepted matches link the transaction and set actual amount
- do not mutate transaction source fields
- match event types appropriately
- keep matching logic pure/testable where practical

## Statuses
Support:
- Predicted
- Confirmed
- Paid
- Overdue
- Skipped
- Needs confirmation
- Inactive

Inactive streams are excluded from default upcoming results. Skipped and predicted-only events are not overdue.

## Confidence
Display:
- High
- Medium
- Low
- Needs confirmation

Use text, not color alone.

## Seed
Enhance only synthetic seed data as needed.

Include examples of:
- confirmed bill
- predicted bill
- subscription
- debt payment
- credit-card payment
- expected income
- needs-confirmation item
- paid matched item
- skipped item
- inactive stream
- manual event
- event with both due date and posting date
- estimated variable amount
- all confidence levels
- month-boundary event
- multiple events on one day

Seed must remain synthetic, owner-safe, and idempotent.

## Architecture
Separate:
- queries
- effective values
- date logic
- status derivation
- matching
- validation
- mutations
- presentation

Suggested structure:
```text
src/lib/calendar/
src/actions/calendar.ts
src/components/calendar/
```

Keep Prisma server-only. Avoid one giant page file.

## Schema
First determine whether existing `RecurringStream`, `CalendarEvent`, `CalendarOverride`, and `Transaction` models are sufficient.

Prefer no schema change. If one is genuinely required:
- explain why
- create a forward-only Milestone 4 migration
- preserve history
- test current-database upgrade
- test full migration replay

## States
Implement:
- loading skeleton
- no recurring history
- no events in range
- all predictions dismissed
- partial data
- stale data
- safe error state

Use the existing seven-day stale threshold unless planning docs require otherwise.

## Accessibility and Responsive Design
- accessible list alternative to month grid
- semantic headings/lists
- keyboard navigation
- visible focus
- labeled fields
- associated validation errors
- status/confidence not color-only
- no horizontal overflow
- one-column mobile layout
- usable month cells and forms at narrow widths

## Tests
At minimum test:
1. owner-scoped queries and mutations
2. month navigation and month boundaries
3. 14/30/60/90-day ranges
4. event-type filters
5. confirmed/predicted filters
6. override precedence
7. confirmed due date before predicted posting date
8. predicted-only never overdue
9. confirmed unpaid past-due may become overdue
10. skipped/inactive not overdue
11. pending does not satisfy matching
12. posted matching by merchant/account/amount/date
13. low-confidence requires confirmation
14. accepted match links transaction and actual amount
15. confirmation flow
16. date correction
17. amount correction
18. frequency correction
19. mark paid
20. mark skipped
21. not-a-bill
22. deactivate
23. manual creation
24. seed idempotency
25. loading/empty/error states
26. responsive structure
27. Overview remains correct
28. authentication/logout remain correct
29. PostgreSQL suite runs in CI without silent skips

## Documentation
Update README with Milestone 4 status, views, labels, status rules, paid matching, correction flows, test instructions, limitations, and explicit note that recurring detection/live sync are not implemented.

Create:
```text
docs/architecture-milestone-4.md
```

Document ownership, overrides, dates/statuses, matching tolerances, actions, states, accessibility, tests, and schema decision.

Do not modify planning documents.

## Verification
Run:
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
- run full PostgreSQL tests with `TEST_DATABASE_URL`
- run seed twice
- physically test month and upcoming views
- test all ranges and filters
- test confirmation/correction/paid/skipped/not-a-bill
- test Sign out and route protection
- test mobile layout
- check browser console
- run `git diff --check`
- restore unrelated generated changes such as `next-env.d.ts`

## Out of Scope
Do not implement:
- recurring detection from raw history
- Plaid
- sync/webhooks
- Fidelity automatic sync
- CSV import
- full Bills or Transactions pages
- manual assets/investments
- advanced forecasting
- bill payment
- transfers
- trading
- advice
- production deployment
- Milestone 5

## Git Hygiene
Work on `feature/milestone-4`. Do not commit or push when finished unless explicitly asked.

## Completion
Milestone 4 is complete only when the month view, upcoming ranges, filters, labels, corrections, matching, owner scoping, states, accessibility, tests, seed, Overview, and authentication all work and no Milestone 5 work was added.

## Final Report
Stop and report:
1. implementation summary
2. views
3. filters/actions
4. override precedence
5. status/overdue rules
6. matching algorithm
7. files changed
8. schema decision
9. seed changes
10. tests and totals
11. state behavior
12. accessibility/responsive behavior
13. commands/results
14. physically tested flows
15. assumptions
16. unresolved issues
17. confirmation that Milestone 5 was not started
