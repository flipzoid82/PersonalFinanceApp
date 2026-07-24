# Milestone 5 Architecture

## Scope and ownership

Milestone 5 turns Accounts, Investments, and Net Worth into authenticated server-rendered pages. Every query starts with the authenticated owner ID and every mutation verifies both the record ID and `userId`. Related snapshot queries additionally require the parent account to belong to the same owner. No browser storage or public financial API is used.

## Existing model usage and schema decision

The existing provider-neutral models cover nearly all required behavior:

- `Account` represents normalized manual and imported cash, debt, brokerage, retirement, and 401(k) accounts.
- `BalanceSnapshot` stores chronological non-investment balances.
- `InvestmentBalanceSnapshot` stores manual/imported investment values and optional vested values.
- `InvestmentHolding` provides detail without becoming a second account total.
- `ManualAsset` represents property, vehicles, private assets, mortgages, and other manual debts.
- `DataSource` supplies provider-neutral source and health context.

Two required states could not be represented safely. A forward-only migration adds nullable `Account.notes` and non-null `ManualAsset.isActive` with a default of `true`. The active index is extended accordingly. No existing column or history is removed.

## Current-value and net-worth precedence

Only one value is counted for each active account:

1. Latest investment snapshot at or before the calculation time for investment accounts.
2. Latest balance snapshot at or before the calculation time for other accounts.
3. Normalized account balance when no applicable snapshot exists.

Holdings are display/audit detail and are never added to an account total. Active manual assets use their current manual value. Active account and manual-asset debts are stored as positive amounts owed and subtracted. Inactive records stay visible but are excluded. Prisma `Decimal` is retained through calculation and only converted during locale-aware formatting.

Milestone 3 Overview queries now load the latest account snapshot and exclude inactive manual assets, so manual Milestone 5 changes flow into existing totals without duplicating snapshot, account, or holding values.

## Manual workflows and safe deletion

Server actions validate names, enums, three-letter currencies, exact money, dates, and notes before owner-scoped mutations. Successful mutations revalidate Accounts, Investments, Net Worth, and Overview. Error feedback uses an allowlist and never exposes raw database errors.

Manual accounts and assets can be created, updated, and deactivated. An account may be deleted only when it has no transactions, recurring streams, calendar events, holdings, investment history, investment transactions, or balance snapshots; otherwise the owner is directed to deactivate it. Manual assets have no dependent financial records and can be deleted after ownership verification. Snapshot timestamps use existing unique constraints for duplicate protection.

## Fidelity templates

Fidelity Individual TOD, UnitedHealth Contribution, and UnitedHealth Group 401(k) Savings Plan are static provider-neutral metadata templates. A URL selection prefills editable name, institution, account type, and subtype fields. Templates have no credential, login, token, or sync behavior.

## Freshness and states

The existing seven-day threshold is reused. Manual accounts use the latest applicable snapshot or record update, imported accounts prefer import/source time, and synced accounts prefer sync/source time. Values remain visible when stale and receive a textual `Stale` label. Sources in needs-attention or error state mark totals partial. Empty pages explain the missing data without displaying unknown values as zero. Route loading files and the shared error boundary cover loading and safe errors.

## Semantic colors and theme behavior

`globals.css` centralizes surface, text, border, focus, and semantic variables:

- green: positive, income, asset, paid
- red: negative, spending, debt, overdue
- amber: warning, predicted, stale, medium confidence, needs attention
- blue: informational, confirmed, synced
- purple: investments
- gray: inactive, skipped, unavailable, muted

Reusable semantic badges and values consume those variables. Every use also includes visible text, a plus/minus sign, an icon, or a screen-reader label. Variables have accessible light values, system-driven dark values, and explicit `.light`/`.dark` class foundations for the future Milestone 10 control. No theme selector or preference persistence UI is introduced in Milestone 5.

Shared cards, buttons, navigation, and the dashboard shell use surface variables so new pages render coherently in both themes. Calendar badges receive a narrow consistency update to the shared semantic variants.

## Accessibility and responsive behavior

Pages use ordered headings, semantic lists, form labels, status/alert roles, visible focus rings, descriptive action text, and explicit source/freshness/state labels. Financial meaning is expressed with words and signs as well as color. Layouts collapse to one column, form grids collapse naturally, and snapshot/history controls remain keyboard accessible at mobile widths.

## Testing

Pure tests cover Decimal precedence, debt subtraction, inactive exclusions, owner filtering, freshness, validation, Fidelity metadata, semantic variants, non-color cues, and light/dark foundations. PostgreSQL tests cover owner scoping, create/update/deactivate/delete flows, referentially safe deletion, exact snapshot persistence, duplicates, snapshot edits, Overview integration, and synthetic seed idempotency. Existing Calendar and authentication/logout suites remain part of the same CI run.

## Explicit omissions

There is no Plaid SDK, Fidelity authentication or automatic sync, CSV import, performance/return calculation, allocation analysis, trading, advice, theme selector, or production deployment. Those remain later milestones.
