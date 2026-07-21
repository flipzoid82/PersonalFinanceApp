# Milestone 3 Codex Prompt

## Objective

Build Milestone 3: Demo Dashboard.

Implement the authenticated Overview dashboard using the synthetic Milestone 2 data already stored in PostgreSQL.

Do not proceed beyond Milestone 3.

## Read First

Before making changes:

1. Confirm the Git working tree is clean.
2. Read every planning document under `docs/Plan Docs/`.
3. Inspect the existing authentication, Prisma schema, migrations, seed, tests, architecture notes, current Overview placeholder, shared UI components, README, CI, and recent Git history.

Treat these planning documents as the source of truth:

- `build-plan.md`
- `product-requirements.md`
- `financial-definitions.md`
- `overview-dashboard-spec.md`
- `data-model.md`
- `calendar-spec.md`
- `codex-build-brief.md`

If the implementation conflicts with those documents, stop and report the conflict before changing code.

## Scope

Turn the Overview placeholder into a functional, read-only demo dashboard backed by the synthetic Milestone 2 database records.

Build:

- Primary metric cards
- Monthly metric cards
- Account balances summary
- Recent transactions
- Upcoming bills/activity
- Spending-by-category visualization
- Investment summary
- Net-worth trend
- Data freshness and source-status summary
- Loading, empty, stale, partial, and error states

This milestone may add read-only query and calculation logic required by Overview.

Do not implement editing, imports, provider integrations, recurring detection, calendar generation, or other feature pages.

## Preserve Existing Behavior

Do not break:

- Owner-only authentication
- Session persistence
- Sign out
- Protected-route redirects
- Existing Prisma models and migration history
- Seed idempotency
- Navigation
- Placeholder pages outside Overview
- Environment validation
- CI
- Existing tests
- Provider-neutral architecture

The Accounts, Transactions, Bills, Calendar, Spending, Investments, Net Worth, and Settings pages should remain placeholders.

## Data Source and Security

Use only the authenticated owner's normalized PostgreSQL records.

Requirements:

- Do not hard-code totals in React components.
- Do not use browser storage for financial data.
- Do not use real financial information.
- Do not add Plaid or external APIs.
- Do not expose raw provider payloads or secrets.
- Prevent cross-user records from entering queries or totals.
- Prefer server components and server-only query/calculation modules.
- Keep Prisma and financial calculations out of client bundles.

The seeded data should produce a meaningful dashboard after `pnpm db:seed`.

## Financial Calculation Rules

Follow `financial-definitions.md` exactly.

Use decimal-safe logic. Do not use JavaScript floating-point arithmetic for intermediate financial calculations. Document the chosen strategy, such as Prisma Decimal or integer minor units.

### Total Cash

Sum active checking and savings current balances only.

Calculate available cash separately from available balances when present.

Exclude investments, credit cards, loans, and manual property.

### Credit Card Debt

Sum active credit-card balances only and display the amount as a positive amount owed.

Do not include mortgages or other loans.

Where credit limits exist, calculate aggregate utilization safely. Handle missing or zero limits.

### Investments

Calculate total investment value without double-counting account balances, holdings, and snapshots that represent the same assets.

Inspect the Milestone 2 schema and seed, define one current-value precedence rule, document it, and test it.

Manual and imported Fidelity values must be included.

### Net Worth

Calculate total assets minus total debts.

Assets may include cash, investments, manual assets, and other active asset accounts. Debts may include cards, mortgages, loans, and manual debts.

Avoid double-counting records represented in multiple models. Document the exact precedence rule.

### Income This Month

Include current-month posted transactions classified as genuine income after applying local overrides and report exclusions.

Exclude pending transactions, transfers, credit-card payments, refunds unless explicitly overridden as income, debt proceeds, investment sales by default, ignored records, and ambiguous deposits not confirmed as income.

### Spending This Month

Include current-month posted expenses after overrides.

Exclude pending transactions, transfers, credit-card payments, investment activity, savings transfers, ignored records, and report-excluded records.

Do not count both a credit-card purchase and its later payment as spending.

Refunds should reduce the applicable category when supported safely by the current schema and seed.

### Net Cash Flow

Calculate monthly income minus monthly spending. Pending activity must not affect finalized cash flow.

### Upcoming Bills

Use today through the next 14 days.

Use existing recurring/calendar data only. Do not generate events or detect recurrence.

Requirements:

- Show confirmed dates as confirmed.
- Show predicted dates as predicted.
- Never present predictions as guaranteed due dates.
- Never mark predicted-only events overdue.
- Calculate total expected upcoming outflow, event count, nearest date, and confirmed/predicted composition.

### Recent Transactions

Show the last 30 days, newest first, including posted and pending items.

Display effective merchant/description, account, date, amount, status, and useful category/role information.

Apply local display overrides without mutating source data.

Limit the Overview list to roughly 5–8 rows.

### Spending by Category

Use posted current-month expenses only. Apply overrides and exclusions. Exclude all non-spending roles.

Group by effective category and sort descending by absolute spend.

Use an accessible chart or visual representation. Avoid a new heavy chart dependency unless clearly justified. Provide accessible text/table equivalents and do not rely on color alone.

### Net-Worth Trend

Default to the last 30 days.

Use stored balance and investment snapshots. Do not fabricate values inside UI code.

The synthetic seed may be extended with additional historical snapshots if needed.

Prevent double-counting, label sparse data honestly, and include accessible summary text.

If the schema cannot support a sound trend without a migration, stop and report the limitation before changing the schema. Prefer seed changes over schema changes.

## Dashboard Layout

Follow `overview-dashboard-spec.md`.

### Header

Display:

- Overview title
- Concise description
- Latest-data timestamp
- Source-health or partial-data warning when appropriate

Do not implement live sync. A local revalidation control is optional, not required.

### Primary Metrics

1. Net Worth
2. Cash
3. Credit Card Debt
4. Investments

Cash should include available-cash support text. Card debt may include utilization support text.

### Monthly Metrics

1. Income This Month
2. Spending This Month
3. Net Cash Flow
4. Upcoming Bills

### Main Panels

- Net Worth Trend
- Account Balances
- Recent Transactions
- Spending by Category
- Upcoming Activity
- Data Freshness and Connection Status

### Mobile Order

1. Net Worth
2. Cash
3. Credit Card Debt
4. Upcoming Bills
5. Income This Month
6. Spending This Month
7. Net Cash Flow
8. Investments

Panels should collapse to one column. Avoid horizontal overflow and keep charts understandable on narrow screens.

## Formatting

Use shared locale-aware formatters.

Requirements:

- Default seeded demo to USD.
- Respect record currency where practical.
- Distinguish unavailable from zero.
- Display negative cash flow clearly without relying only on color.
- Use readable dates and relative freshness text.
- Avoid misleading decimal precision.

Use language such as `Unavailable`, `No posted spending this month`, `Partial total`, and `Updated 2 hours ago`.

Do not show `$0.00` for missing values unless zero is genuinely known.

## Account Balances Panel

Show active accounts with:

- account name
- institution or source
- account type
- current balance
- available balance or credit limit where relevant
- source label: Synced, Imported, or Manual
- freshness/update time

Clearly distinguish assets and debts. Do not add editing or account-detail functionality.

## Investment Summary

Show total investment value, investment accounts, source type, and latest as-of/update date.

Largest holdings are optional. Do not implement performance, returns, projections, advice, or tax information.

## Freshness and Status

Derive provider-neutral state from fields such as `lastSyncedAt`, `lastImportedAt`, snapshot dates, source status, connection status, and manual update dates.

Support labels for Synced, Imported, Manual, Stale, Partial, Disconnected, and Error where represented.

Define and document the stale threshold. Do not imply seed data is live-connected.

## Required Data States

### Loading

Add route-level `loading.tsx` or an equivalent skeleton. Do not flash zero values while loading.

### Empty

When the owner has no financial records, render safely, explain that no data is available, and do not show misleading zeros.

You may mention future manual/import/connection options without implementing them.

### Stale

Keep values visible, label affected data, and show last update time.

### Partial

When expected sources are missing, disconnected, errored, or lack required balances, label totals as partial and identify affected sources/accounts without hiding available values.

### Error

Provide non-destructive error handling through the existing error boundary or a narrow improvement. Do not expose stack traces or secrets. Provide retry behavior where appropriate.

Exercise these states with pure functions, fixtures, or controlled test inputs. Do not add secret debug URLs or production-facing state toggles.

## Architecture

Separate:

- database queries
- financial calculations
- display view models
- presentation components

A suggested structure is:

```text
src/lib/dashboard/
  queries.ts
  calculations.ts
  types.ts
  formatters.ts
  state.ts
```

An equivalent maintainable structure is acceptable.

Calculation functions should be pure where practical. Avoid a giant Overview file and unnecessary abstractions.

## Seed Enhancements

Enhance only synthetic seed data as needed for a useful demo.

Potential additions:

- current-month income
- multiple expense categories
- transfer
- credit-card payment
- refund
- pending activity
- 30 days of balance snapshots
- multiple upcoming events
- fresh, stale, imported, and manual source examples

Requirements:

- all data remains synthetic
- owner credentials remain unchanged
- seed remains idempotent
- no real account numbers or personal data
- records exercise financial-definition edge cases

Do not add a migration unless genuinely required.

## Tests

At minimum test:

1. Cash includes checking/savings only.
2. Card debt excludes mortgages and loans.
3. Investments are not double-counted.
4. Net worth includes investments/manual assets and subtracts debts.
5. Pending transactions do not affect finalized metrics.
6. Transfers do not count as income or spending.
7. Card payments do not count as spending.
8. Overrides take precedence.
9. Excluded transactions do not affect reports.
10. Upcoming bills use the 14-day window.
11. Confirmed and predicted labels stay distinct.
12. Predicted-only items are not overdue.
13. Categories use effective override values.
14. Empty state does not show misleading zeros.
15. Stale and partial states are labeled.
16. Seeded dashboard renders synthetic data.
17. Owner scoping blocks cross-user data.
18. Existing authentication/logout tests still pass.
19. Responsive/structural behavior is covered where practical.
20. Seed remains idempotent.

Use PostgreSQL integration tests where needed. Database-backed tests must not silently skip in CI.

## Accessibility

Use semantic headings, lists/tables, accessible chart labels, keyboard-accessible links, visible focus states, and non-color-only status communication.

Skeletons should be appropriately hidden from or labeled for assistive technology.

## Documentation

Update README with:

- Milestone 3 status
- Overview sections
- calculation treatment of pending items, transfers, card payments, and overrides
- demo seed instructions
- local run instructions
- full test instructions including `TEST_DATABASE_URL`
- known limitations
- explicit note that all financial data is synthetic and no institution is connected

Create `docs/architecture-milestone-3.md` documenting:

- query/calculation boundaries
- decimal strategy
- investment and net-worth precedence
- state derivation
- freshness threshold
- chart implementation
- server/client boundaries
- owner scoping
- test strategy

Do not modify planning documents.

## Required Verification

Run and pass:

```text
pnpm db:generate
pnpm lint
pnpm typecheck
pnpm test
pnpm format:check
pnpm build
```

Also:

- run the full PostgreSQL-backed test suite with `TEST_DATABASE_URL`
- validate Prisma schema
- verify migrations are up to date
- run seed twice successfully
- verify populated Overview
- verify empty-state tests
- verify protected routes and Sign out

Do not add a large end-to-end framework solely for this milestone unless clearly justified.

## Explicitly Out of Scope

Do not implement:

- Plaid SDK or Link
- institution connections or sync
- webhooks
- automatic Fidelity sync
- CSV parsing/import UI
- manual asset or investment forms
- transaction search/editing/override UI
- recurring detection
- calendar month view or corrections
- payment matching
- full Accounts, Transactions, Bills, Spending, Investments, or Net Worth pages
- production deployment
- bill payment, transfers, trading, advice, credit scoring, or advanced forecasting

Do not begin Milestone 4.

## Git Hygiene

Before changes:

1. Confirm `main` is synchronized with `origin/main`.
2. Confirm the working tree is clean.
3. Do not modify or squash existing migrations without a compelling reported reason.
4. Do not modify planning documents.
5. Do not upgrade Node, Next.js, Prisma, pnpm, or unrelated dependencies.
6. Avoid a heavy chart dependency.
7. Restore unrelated generated changes such as `next-env.d.ts` when appropriate.
8. Keep secrets and `.env` out of Git.

After verification, do not commit or push unless explicitly asked in the Codex conversation.

## Completion Criteria

Milestone 3 is complete only when:

- Overview uses the authenticated owner's seeded database data.
- Planned metric cards are accurate.
- Account balances render.
- Recent transactions include pending state.
- Upcoming activity distinguishes predicted and confirmed.
- Spending by category is accessible.
- Investment summary avoids double-counting.
- Net-worth trend uses stored snapshots.
- Freshness/source states render.
- Loading, empty, stale, partial, and error states exist.
- Calculations follow planning rules and use decimal-safe logic.
- Owner scoping is enforced.
- Seed remains synthetic and idempotent.
- Other pages remain out of scope.
- Authentication and logout remain intact.
- All checks and full database tests pass.
- No Milestone 4 work was performed.

## Final Response

When complete, stop and report:

1. Implementation summary
2. Dashboard sections implemented
3. Calculation and precedence decisions
4. Important files changed
5. Seed-data changes
6. Tests added and total passing
7. Loading/empty/stale/partial/error behavior
8. Accessibility decisions
9. Commands and results
10. Routes physically testable
11. Assumptions
12. Unresolved issues
13. Confirmation that no Milestone 4 work was performed

Do not begin Milestone 4.
