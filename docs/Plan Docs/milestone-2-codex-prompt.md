# Milestone 2 Codex Prompt

## Objective

Build Milestone 2 of the personal finance dashboard project.

Do not proceed beyond Milestone 2.

## Read First

Before making any changes, read every planning document under:

```text
docs/Plan Docs/
```

Also inspect the existing Milestone 1 implementation, current Prisma schema, migrations, tests, README, and Git history.

Treat the planning documents as the source of truth for product scope, financial definitions, provider-neutral architecture, calendar behavior, Plaid constraints, Fidelity constraints, and the build sequence.

If this prompt conflicts with a planning document or the current implementation, stop and report the conflict before implementing.

## Scope

Milestone 2 is the core data-model milestone.

Extend the existing PostgreSQL and Prisma foundation with normalized models for financial data.

Do not implement live integrations, business calculations, or functional dashboard features yet.

## Preserve Milestone 1

Do not break or replace:

- Owner-only authentication
- Existing `User` and `AuthSession` behavior
- Route protection
- Navigation
- Placeholder pages
- Environment validation
- CI
- Existing tests
- Current project structure

Modify existing files only where necessary.

## Required Models

Implement the data model described in:

```text
docs/Plan Docs/data-model.md
```

At minimum, add these Prisma models:

- DataSource
- InstitutionConnection
- Account
- Transaction
- TransactionOverride
- RecurringStream
- CalendarEvent
- CalendarOverride
- InvestmentHolding
- InvestmentBalanceSnapshot
- InvestmentTransaction
- ManualAsset
- BalanceSnapshot
- ImportJob

Keep the existing `User` and `AuthSession` models.

## Ownership

Every financial record must be associated with the single owner, directly through `userId` or safely through a parent relationship.

Requirements:

- No cross-user data leakage
- Appropriate foreign keys
- Clear ownership indexes
- Deliberate cascade, restrict, or set-null behavior
- No organizations, teams, households, invitations, or roles

## Provider-Neutral Design

The schema must support:

- Plaid
- CSV import
- Manual entry
- Fidelity CSV or statement import
- Future Fidelity-approved providers
- Other future providers

Provider identifiers and raw payloads should be optional. Dashboard code should eventually consume normalized records without depending on provider-specific fields.

## Monetary Data

Use an exact database type for money. Do not use floating-point types.

Document the chosen precision and scale. Use ISO-4217 currency codes where applicable. Document how debt balances are stored.

## Enums

Add stable, readable Prisma enums or equivalent constrained types for important domain concepts, including:

- Data source type and status
- Connection status
- Account type
- Transaction status
- Financial role
- Recurring flow type and frequency
- Confidence level
- Calendar event type
- Calendar date and amount source
- Calendar event status
- Investment transaction type
- Import type and status
- Manual asset type

Avoid overly narrow provider-specific enums.

## Account Requirements

Support:

- Checking
- Savings
- Credit cards
- Loans
- Mortgages
- Brokerage
- Retirement
- 401(k)
- Manual assets
- Manual debts
- Other accounts

Include provider IDs, institution name, current and available balance, credit limit, currency, active state, manual/synced source, last sync, and last import timestamps.

Do not implement balance calculations.

## Transaction Requirements

Preserve original source values.

Support provider ID, original name, merchant, exact amount, currency, authorized and posted timestamps, status, provider category and confidence, pending-to-posted linkage, and optional raw JSON payload.

Do not implement spending calculations or classification logic.

## Overrides

Keep user corrections separate from original transactions.

Support merchant-name override, category override, financial-role override, notes, excluded-from-reports flag, and linked transaction.

## Recurring Streams

Represent recurring bills, subscriptions, transfers, debt payments, credit-card payments, expected income, and other recurring activity.

Include description, merchant, flow type, frequency, average amount, last amount, first and last observed dates, predicted next date, predicted posting date, confirmed due date, date source, confidence, status, category, and typical account.

Do not implement detection.

## Calendar Models

`CalendarEvent` should support:

- Projected and confirmed occurrences
- Linked recurring stream
- Linked account
- Linked transaction
- Event type
- Event date
- Predicted posting date
- Expected and actual amount
- Date source
- Amount source
- Confidence
- Status
- User confirmation
- Notes

`CalendarOverride` must remain separate from inferred source data and support due-date, amount, frequency, status, not-a-bill, and notes overrides.

Do not implement event generation or payment matching.

## Investments

Support brokerage, retirement, 401(k), manual Fidelity accounts, imported Fidelity holdings, imported balance snapshots, and future synced providers.

`InvestmentHolding` should support security name, ticker, type, quantity, price, current value, cost basis, vested quantity, vested value, currency, and as-of date.

`InvestmentBalanceSnapshot` should support manual and imported values.

`InvestmentTransaction` should remain provider-neutral.

Do not implement performance, allocation, or advice.

## Manual Assets

Support homes, other real estate, vehicles, private assets, other assets, mortgages, auto loans, student loans, personal loans, and other debts.

Document how assets and debts are represented.

Do not implement net-worth calculations.

## Balance Snapshots

Support historical current and available balances with capture timestamps. Add practical uniqueness or indexing to reduce accidental duplicates.

## Import Jobs

Support:

- Bank transactions CSV
- Fidelity positions CSV
- Fidelity transactions CSV
- Manual balance snapshot
- Generic account balance CSV

Track source, source name, status, imported count, rejected count, creation time, and completion time.

Do not implement parsing.

## Relationships and Indexes

Add indexes for ownership, provider IDs, account lookup, transaction date and merchant, transaction status, recurring next date, calendar date and status, investment account and as-of date, balance snapshots, and import status.

Use uniqueness constraints only where identifiers are truly unique in context.

## Delete Behavior

Choose deliberate referential actions and document them.

Requirements:

- Deleting a user removes owned local data safely.
- Deleting a provider connection must not delete unrelated manual assets.
- Deleting an account must not silently corrupt historical data.
- Overrides must not outlive source records.

Do not add delete UI.

## Raw Data

Optional raw provider payloads must use JSON fields, contain no secrets or access tokens, remain server-only, and exist only for audit/debug purposes.

## Synthetic Seed Data

Add clearly fake development seed data for:

- One owner
- Multiple data sources
- Checking and savings
- Credit card
- Manual Fidelity 401(k)
- Brokerage account
- Manual home asset
- Mortgage debt
- Posted and pending transactions
- Transaction override
- Recurring bill
- Predicted calendar event
- Confirmed calendar event
- Investment holdings
- Investment balance snapshot
- Import job

Never use real personal information.

Do not overwrite the existing owner. Reuse the owner when present or provide an explicit development-only path.

## Migration

Create a new Milestone 2 Prisma migration.

Requirements:

- Preserve Milestone 1 migration history
- Do not squash migrations
- Use a clear migration name
- Apply to an empty database
- Apply to the current Milestone 1 database
- Generate Prisma client
- Validate schema

## Tests

Add meaningful database/model tests covering:

- Ownership relationships
- Exact monetary persistence
- Overrides separate from source data
- Provider-ID uniqueness
- Predicted and confirmed calendar concepts coexisting
- Manual and imported investments coexisting
- Referential actions
- Safe synthetic seeding
- Existing authentication behavior

Use isolated test data and do not damage the local development database.

## Documentation

Update the root README with:

- Milestone 2 status
- Data-model overview
- Migration command
- Seed command
- Local reset instructions
- Ownership strategy
- Monetary precision
- Explicit note that no live integrations or financial calculations exist yet

Add or update an architecture note covering provider-neutral modeling, ownership, exact currency storage, override strategy, calendar prediction versus confirmation, Fidelity manual/import support, and referential actions.

Do not modify planning documents unless a genuine conflict is found and reported.

## Required Checks

Run and pass:

```text
pnpm db:generate
pnpm lint
pnpm typecheck
pnpm test
pnpm format:check
pnpm build
```

Also validate the Prisma schema and apply the migration locally when PostgreSQL is available.

## Security

Do not expose secrets, add real provider tokens, use real financial data, log sensitive fields, store credentials, add public financial APIs, add multi-user access, or weaken authentication.

## Explicitly Out of Scope

Do not implement:

- Plaid SDK or Link
- Account or transaction syncing
- Webhooks
- Fidelity Access
- Automatic Fidelity syncing
- CSV parsing or import UI
- Manual asset UI
- Functional transaction UI
- Financial calculations
- Income or spending calculations
- Net worth or utilization calculations
- Recurring detection
- Bill prediction logic
- Calendar generation
- Payment matching
- Investment performance calculations
- Dashboard data wiring
- Production deployment

Placeholder pages should remain placeholders.

## Repository Hygiene

Before changes:

1. Confirm the working tree is clean.
2. Inspect schema and migrations.
3. Preserve `docs/Plan Docs/`.
4. Do not rewrite Milestone 1 history.
5. Avoid unrelated dependency upgrades.
6. Do not change Node, pnpm, or Next.js versions unless required and justified.
7. Follow existing generated-file conventions.

## Completion Criteria

Milestone 2 is complete only when:

- Required models exist
- Ownership is explicit
- Money uses exact storage
- Provider-neutral modeling is implemented
- Overrides remain separate
- Calendar predicted and confirmed concepts are distinct
- Manual and imported Fidelity data are supported
- Migration exists and validates
- Synthetic seed data exists
- Meaningful tests pass
- Existing authentication still works
- Lint, type-check, tests, formatting, and production build pass
- No out-of-scope features were added

## Final Response

When finished, stop and provide:

1. Summary of implementation
2. Models and enums added
3. Important files changed
4. Migration name and status
5. Seed-data summary
6. Commands and results
7. Tests added
8. Assumptions
9. Referential-action decisions
10. Unresolved issues
11. Confirmation that no work beyond Milestone 2 was performed

Do not begin Milestone 3.
