# Milestone 3 Dashboard Architecture

Milestone 3 turns only the authenticated Overview into a read-only dashboard. The other financial routes remain placeholders, and no provider, import, editing, recurrence, or payment workflow is introduced.

## Boundaries and owner scoping

`src/lib/dashboard/queries.ts` is server-only and owns every Prisma read. Each financial root query requires the authenticated `userId`; nested override and connection reads are owner-filtered too. `src/lib/dashboard/calculations.ts` contains pure transformations and defensively rejects records whose direct or account ownership does not match the requested owner. `state.ts` derives freshness and partial-state signals, while formatter helpers and presentation components consume the resulting view model. Prisma, raw payloads, and calculations never enter a client component.

The Overview page calls `requireUser`, fetches that owner's normalized records, calculates one view model, and renders server components. It does not use browser storage or expose provider payloads.

## Decimal strategy

All balances, totals, refunds, ratios, category sums, and trend values use Prisma `Decimal`. Values convert to JavaScript numbers only at the final display boundary required by `Intl.NumberFormat` or CSS chart sizing. Dates and layout percentages are not financial arithmetic.

Transactions count in finalized monthly reporting only when they are posted, fall inside the current UTC calendar month, are not excluded, and have an explicit local financial-role override. This conservative rule prevents ambiguous deposits or provider categories from silently becoming income or spending. Expense and refund amounts use absolute source values after role classification; refunds reduce their effective category. Pending activity remains visible in recent transactions but never changes finalized metrics.

## Current-value precedence

Each active investment account contributes exactly once. Its latest balance snapshot at or before the dashboard timestamp wins; otherwise its normalized account balance is used. Holdings are never added to this total, which prevents the account, snapshot, and holding representations of the same assets from being counted repeatedly. This includes imported brokerage/Fidelity-style data and manual 401(k) balances.

Current net worth adds checking/savings cash, the single selected value for each investment account, other active asset-account balances, and non-debt `ManualAsset` records. It subtracts credit-card, loan, mortgage, and manual-account debts plus debt `ManualAsset` records. Debt values are normalized as positive amounts owed.

The 30-day trend is intentionally narrower: for each stored snapshot date it selects the latest account and investment snapshot available at that point, excludes duplicated investment account balances, and calculates tracked assets minus tracked debts. Manual assets have no historical snapshot model, so their current values are not fabricated backward. The chart explicitly labels the series partial whenever manual assets or required account history are unavailable.

## Calendar and state derivation

Upcoming activity uses existing calendar rows only, from the current UTC day through day 14 inclusive. A latest override may replace date, amount, or status or mark an event as not a bill. Confirmed due dates and user-confirmed events receive a Confirmed label; inferred dates remain Predicted. A predicted-only event carrying an overdue source status is displayed as Predicted, never Overdue.

Source health uses data-source status, connection status, sync/import/manual timestamps, and investment/manual dates. Seven days without a relevant timestamp is the stale threshold. Error, disconnected, needs-attention, inactive, or missing-timestamp sources remain visible and cause a partial-data warning rather than hiding available values.

## Accessible visualizations and responsive layout

Spending and net-worth charts use lightweight semantic HTML and CSS rather than a chart dependency. Spending bars have visible category/value labels and screen-reader descriptions. The trend has a concise accessible summary plus a hidden data table. Statuses always include text; color is supplemental. Metric links have visible focus states, lists use semantic markup, and the route-level skeleton exposes one loading status without announcing fake zeros.

The eight metric cards use explicit responsive order classes to meet the required mobile and desktop sequences. Detail panels collapse to one column and use wrapping grid/list layouts instead of wide tables.

## Tests and limitations

Pure calculation tests cover cash/debt classification, current-value and net-worth precedence, pending/transfer/card-payment exclusions, refunds, overrides, category grouping, upcoming-window boundaries, prediction safety, empty/stale/partial states, and cross-owner rejection. PostgreSQL integration tests run the seed twice, exercise owner-scoped queries, calculate known totals, and server-render the populated Overview. Component tests cover empty messaging and responsive structure. Existing authentication and logout tests remain part of the same suite, and CI supplies a non-optional PostgreSQL test database.

The owner profile currently has no time-zone setting, so reporting and upcoming windows use UTC. Seeded aggregates are USD; rows format their recorded currency, but cross-currency conversion is unavailable. Historical manual-asset values, investment performance, and full destination pages are intentionally deferred.
