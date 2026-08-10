# Build Plan

## Cross-Milestone Visual Semantics and Theme Support

The application will use a shared semantic color system as a secondary visual cue.

Required meanings:

- Positive, income, assets, and paid: green
- Negative, spending, debt, and overdue: red
- Warning, predicted, stale, medium confidence, and needs attention: amber
- Informational, confirmed, and synced: blue
- Investments: purple
- Inactive, skipped, unavailable, and muted: gray

Rules:

- Color must never be the only way meaning is communicated.
- Every semantic state must also use text, signs, icons, labels, or another non-color cue.
- Semantic styles must be centralized in reusable theme tokens, utilities, variants, or shared components.
- Support light, dark, and system theme preferences.
- Respect the system theme when the user has not selected an explicit preference.
- Persist the user's explicit theme preference.
- Contrast must remain accessible in both light and dark themes.
- Charts, badges, forms, tables, alerts, and financial values must remain understandable in both themes.
- Milestone 5 introduces theme-aware semantic tokens.
- Milestone 9 extends semantic styling across Bills and Spending.
- Milestone 10 adds user-facing theme controls and completes dark-mode coverage across existing pages.
- Milestone 12 includes a final accessibility, contrast, and theme-persistence audit.

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
- Introduce theme-aware semantic color tokens and reusable variants
- Apply semantic styling to assets, debts, investments, freshness, and status labels
- Ensure every color-coded state also has text, a sign, an icon, or another non-color cue
- Ensure all new Milestone 5 components render correctly in light and dark themes
- Add accessibility and regression tests for semantic variants and theme behavior

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
- Extend semantic styling to spending, bills, overdue states, warnings, expense categories, and negative cash flow
- Keep status and category meaning understandable without color
- Standardize chart legends, labels, and accessible text equivalents in both themes

## Milestone 10: Net Worth and Investment Views

- Add net-worth calculation
- Add historical trend
- Add investment account list
- Add holdings display where available
- Add allocation view where available
- Add freshness indicators
- Make synced, imported, and manual values distinct
- Add a user-facing theme control with Light, Dark, and System options
- Persist the user's explicit theme preference
- Respect the system theme when no explicit preference is stored
- Complete dark-mode support across existing application pages
- Complete semantic styling across assets, debts, investments, and trend views
- Standardize positive and negative value presentation without relying on color alone
- Verify investment and net-worth charts use accessible legends and summaries in both themes

## Milestone 11: CSV Import

- Add import mapping
- Add validation
- Add duplicate detection
- Add import summary
- Add rejected-row reporting
- Support Fidelity positions CSV or statement-derived import
- Support generic balance snapshot import

## Milestone 11.5: UX/UI Audit and Product Polish

- Audit every owner-facing route and major user journey
- Replace developer-oriented UI copy with consumer-friendly language
- Standardize terminology across Overview, Accounts, Transactions, Bills,
  Calendar, Spending, Investments, Net Worth, Import, and Settings
- Add contextual help and progressive disclosure where financial concepts
  require explanation
- Improve navigation, orientation, detail-return flows, and action discoverability
- Standardize proven table/list/search/filter/sort interaction patterns
- Improve form clarity, validation feedback, confirmations, and save/reset behavior
- Improve empty, no-results, loading, partial, stale, and error states
- Audit visual hierarchy, information density, long-text handling, and readability
- Verify every major route at mobile, tablet, and desktop widths
- Perform full keyboard and accessibility usability testing
- Verify Light, Dark, and System experiences remain coherent
- Ensure provider/internal codes are not primary user-facing presentation when
  readable deterministic labels are available
- Preserve all existing financial calculations, provider data, overrides,
  owner scoping, session security, and auditability
- Document the UX audit, resolved findings, deferred findings, terminology,
  shared interaction patterns, and known limitations

## Milestone 12: Production Readiness

- Security review
- Backup strategy
- Observability
- Error tracking
- Rate limiting
- Production deployment
- Plaid Production Trial setup
- Connect real institutions only after Sandbox validation
- Audit semantic colors for accessible contrast in light and dark themes
- Verify no financial value, status, confidence level, or warning relies on color alone
- Verify charts, badges, forms, tables, alerts, and financial values remain readable in both themes
- Verify theme preference persistence and system-theme behavior
- Verify semantic styling remains consistent across responsive layouts
