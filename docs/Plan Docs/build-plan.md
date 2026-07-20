# Build Plan

## Milestone 1: Project Foundation

- Create Next.js application with TypeScript
- Configure linting and formatting
- Add Tailwind CSS and UI component library
- Configure PostgreSQL
- Add Prisma
- Add environment-variable validation
- Add authentication
- Create base dashboard layout
- Add test framework
- Add CI checks

Do not implement Plaid in this milestone.

## Milestone 2: Core Data Model

- Implement User
- Implement DataSource
- Implement InstitutionConnection
- Implement Account
- Implement Transaction
- Implement TransactionOverride
- Implement RecurringStream
- Implement CalendarEvent
- Implement CalendarOverride
- Implement InvestmentHolding
- Implement InvestmentBalanceSnapshot
- Implement InvestmentTransaction
- Implement ManualAsset
- Implement BalanceSnapshot
- Implement ImportJob
- Add migrations and seed data
- Add model-level tests

## Milestone 3: Demo Dashboard

- Build Overview using seeded data
- Add metric cards
- Add account summary
- Add recent transactions
- Add upcoming bills card
- Add spending-by-category chart
- Add investment summary card
- Add net-worth trend
- Add loading, empty, stale, partial, and error states

## Milestone 4: Calendar and Recurring Events

- Build month view
- Build upcoming-list view
- Add seeded recurring bills
- Add predicted and confirmed labels
- Add confidence levels
- Add statuses
- Add filters
- Add manual confirmation and correction flows
- Add due-date versus posting-date display
- Add paid matching logic with test data

## Milestone 5: Manual Assets and Investments

- Add manual accounts
- Add manual assets and debts
- Add manual investment accounts
- Add manual balance snapshots
- Add known Fidelity account setup
- Include manual investments in net worth
- Show data source and last updated time

## Milestone 6: Plaid Sandbox

- Add Plaid SDK
- Create Link-token endpoint
- Implement public-token exchange
- Encrypt stored access tokens
- Implement account sync
- Implement transaction sync
- Add webhook endpoint
- Add repair flow
- Add integration tests with Sandbox

## Milestone 7: Recurring Detection

- Derive recurring candidates from transaction history
- Calculate expected dates and amounts
- Assign confidence levels
- Keep inferred dates distinct from confirmed due dates
- Match posted transactions to projected events
- Prevent predicted-only items from being marked overdue

## Milestone 8: Transactions and Overrides

- Build transaction table
- Add filters and search
- Add transaction detail view
- Add category and financial-role overrides
- Add notes
- Add report exclusion
- Preserve original provider values

## Milestone 9: Bills and Spending

- Implement recurring-stream display
- Add upcoming activity
- Add spending categories
- Add month-over-month comparison
- Add merchant totals
- Add unusual-spending indicators

## Milestone 10: Net Worth and Investment Views

- Add net-worth calculation
- Add historical trend
- Add investment account list
- Add holdings display where available
- Add allocation view where available
- Add freshness indicators
- Make synced, imported, and manual values distinct

## Milestone 11: CSV Import

- Add import mapping
- Add validation
- Add duplicate detection
- Add import summary
- Add rejected-row reporting
- Support Fidelity positions CSV or statement-derived import
- Support generic balance snapshot import

## Milestone 12: Production Readiness

- Security review
- Backup strategy
- Observability
- Error tracking
- Rate limiting
- Production deployment
- Plaid Production Trial setup
- Connect real institutions only after Sandbox validation
