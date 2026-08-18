# Milestone 10 Architecture — Net Worth, Investments, and Theme Control

## Implemented scope and provenance

Milestone 10 expands the existing owner-only portfolio read model and adds a
browser-local Light / Dark / System preference. The canonical product,
financial-definition, data-model, Plaid, Overview, Calendar, and merged
architecture documents remain authoritative. The range choices, partial-history
rules, plain-language investment framing, control placement, and persistence
constraints are owner-approved Milestone 10 decisions.

No database or migration change was required. Existing `Account`,
`BalanceSnapshot`, `InvestmentBalanceSnapshot`, `InvestmentHolding`,
`InvestmentTransaction`, and `ManualAsset` records are sufficient. Milestone 11
import, statement parsing, and source-specific classification remain out of
scope.

## Current portfolio values

Current calculations continue to use one authoritative value per eligible
account:

1. the latest applicable investment snapshot for an investment account;
2. otherwise the latest applicable balance snapshot for a non-investment
   account;
3. otherwise the normalized account balance, when available.

Active manual assets and debts use their current manual value. Debt records are
stored and displayed as positive amounts owed, then subtracted with exact
`Prisma.Decimal` arithmetic. Holdings are detail and are never added to account
values. Inactive accounts, disconnected historical Plaid accounts, inactive
manual records, and unavailable current balances do not enter current totals.
Unavailable values are labeled rather than rendered as a plausible number.

The dedicated Net Worth page groups current values into cash, investments,
property and vehicles, other assets, credit cards/mortgages/loans, and other
debts. Plus/minus signs, Asset/Debt/Investment labels, and freshness text retain
meaning without color.

## Net-worth history

`calculateNetWorthHistory` derives history from stored account observations. It
supports URL-backed `30D`, `3M`, `6M`, `1Y`, and `All` ranges; `30D` is the
default. Month and year ranges use calendar subtraction with month-end clamping.
`All` has no lower bound.

Observation dates come only from stored balance and investment snapshot dates.
For each date, each account contributes its latest stored observation known on
that date. Multiple observations on the same UTC day resolve to the latest one
on that day. No synthetic daily points are inserted.

Current-only normalized balances and manual asset/debt values are never copied
backward. This means current net worth can be complete while historical coverage
is partial. The page labels **Partial history** when:

- an active manual asset or debt has no historical snapshot model;
- a current account has no stored history;
- current accounts do not cover every represented observation date; or
- the selected range contains no stored observation.

Historical and current eligibility are intentionally separate. A retained
disconnected account can contribute through its last legitimate stored
observation, preserving audit history, but is not carried forward beyond that
date and never enters current totals.

The visual trend has a programmatic summary plus an expandable data table with
date, tracked assets, tracked debts, and tracked net worth. The table, range
state, explicit signs, direction icon, and change text provide a non-chart and
non-color equivalent.

The compact Overview trend remains the established 30-day implementation; the
new range controls are confined to `/net-worth`.

## Investment read model

The Investments page uses the same authoritative account values as current net
worth. Its primary questions are phrased as “Where your investments are,” “What
you own,” “How your investments are spread out,” and “Money added.” Technical
provider metadata remains secondary.

Account allocation uses current eligible investment account values as its
denominator. It includes labels, values, percentages, bars, and a table
equivalent. Holdings retain their account context. A latest holding set is
considered aligned for composition only when:

- the authoritative account value is available;
- all holding currencies match the account currency;
- the holding date is the same UTC day as the authoritative value date; and
- the holding sum does not exceed the account value.

Aligned holding value is reported as known detail. The remainder of the
authoritative account value is explicitly **holdings detail unavailable** /
unallocated. Missing or date-misaligned holdings never imply zero holdings and
never silently alter the total denominator. Source-provided security type text
may be displayed, but the app does not infer stock/bond/sector/asset-class
classification from a name or ticker.

Long account, institution, holding, symbol, source, and metadata text uses
minimum-width containment and wrapping so cards and table-like views do not
force page overflow.

## Contribution activity

The current model safely supports only records whose
`InvestmentTransactionType` is explicitly `CONTRIBUTION` and whose amount is
present. Those records appear as “Money added.” BUY, SELL, DIVIDEND, INTEREST,
FEE, TRANSFER, LOAN, LOAN_REPAYMENT, and OTHER records are excluded.

No contribution is inferred from balance growth. Current data does not reliably
distinguish owner/employee from employer contributions, so the UI states that
no split is inferred. If there are no explicit contribution records, it reports
that contribution activity is unavailable rather than showing a fake zero.

## Provenance, freshness, ownership, and immutability

Portfolio queries start with the authenticated owner ID and scope accounts,
manual assets, nested snapshots, holdings, and investment transactions to that
owner. Calculation helpers apply an owner check again as a defense-in-depth
boundary. Relationship eligibility and current Plaid connection status retain
their existing rules.

Freshness continues to use the established seven-day threshold and the correct
manual/import/sync timestamps. Current, stale, unavailable, partial, and source
labels remain textual. Provider and imported records are read only here; no raw
payload, account, snapshot, holding, transaction, override, or Plaid behavior is
mutated.

## Theme architecture

Theme preference is one of `light`, `dark`, or `system`. A centralized client
`ThemeProvider` owns live state for both controls:

- the compact theme action in the top-right dashboard app bar near Sign out;
  and
- the descriptive radio group in Settings.

Changes update both controls immediately, toggle only the root `light` / `dark`
classes, and persist the preference in the non-sensitive `finance-theme`
cookie. The cookie contains no user, session, or financial data. `system`
removes both explicit classes, so the existing
`prefers-color-scheme: dark` media query follows live browser/OS preference.

The server root layout reads the same cookie and emits the explicit root class
on the initial HTML response. A missing or invalid cookie resolves to `system`.
This keeps server and client initial state aligned and avoids an unnecessary
database preference or client-only wrong-theme flash.

## Dark-mode and semantic completion

Existing centralized surface, text, border, focus, and semantic CSS variables
remain the styling boundary. The M10 audit replaced light-only utilities in the
login form, Overview cards/panels/statuses/trends, Calendar navigation/grid and
empty states, shared skeleton, and route fallback/placeholder surfaces. The
shared `Notice`, `SemanticBadge`, and `SemanticValue` primitives remain the
standard for financial status meaning.

Positive/asset/income, negative/debt/spending, warning/predicted/stale,
informational/confirmed/synced, investment, and muted/unavailable meanings keep
their established tokens. Every financial state also retains a label, sign,
icon, status, or explanation; color is never the sole cue.

## Accessibility and responsive behavior

The Settings theme control uses native radio semantics, visible text choices,
focus styling, and normal keyboard behavior. The app-bar theme button has an
accessible action name and a state-specific icon. Net-worth and investment
charts provide labeled list/table equivalents. Range links expose the active
state with `aria-current`. Content uses wrapping and horizontally contained
tables for the 375 × 812 layout while preserving readable values and reachable
controls.

### Mobile drawer acceptance correction

Manual acceptance at approximately 375 × 812 exposed a shared shell defect.
The mobile drawer was rendered inside the sticky app bar. Because the app bar
uses `backdrop-filter`, it established the containing block for the supposedly
fixed drawer. The drawer surface was therefore constrained to the app-bar
height while its navigation links overflowed over page headings and cards.

The mobile drawer now renders through a portal attached to `document.body`,
outside the sticky header's containing block. It is a full-viewport modal layer
with an opaque, bounded, independently scrollable sheet and backdrop. The sheet
uses a viewport-relative maximum width so it cannot create horizontal overflow.
Opening it locks body scrolling and moves focus to the labeled Close control;
Tab and Shift+Tab remain trapped within the drawer, Escape or the backdrop
closes it, navigation closes it, and focus returns to the menu trigger. The
desktop `lg` sidebar remains unchanged.

The mobile app bar now uses explicit three-column sizing for the menu trigger,
optional owner label, and a nonshrinking Theme/Sign out action group. This keeps
both controls reachable without overlapping the page at narrow widths. Because
the correction is in the shared dashboard shell, it applies consistently to
Net Worth, Investments, Overview, Calendar, Settings, and the other protected
routes.

### Final app-bar theme refinement

Manual acceptance replaced the app-bar Light/Dark/System select with one compact
theme action while retaining the full three-choice Settings control. With an
explicit Light preference the action shows a moon and is named “Switch to Dark
theme.” With explicit Dark it shows a sun and is named “Switch to Light theme.”
Neither action relies on its icon for its accessible meaning.

When System is active, the button visibly says **System**, uses the system icon,
and is named “System theme active. Activate to switch to Dark theme.” Activating
it selects explicit Dark; Settings remains the canonical surface for explicitly
choosing System or any of the three modes. Both surfaces still update the same
`ThemeProvider` state and cookie, so switching in Settings immediately updates
the app-bar action and vice versa. System still removes explicit root classes
and follows the browser/OS media query.

On desktop, the signed-in identity is explicitly aligned to the start of the
center app-bar column, while the compact theme action and Sign out group align
to the far right. The accepted mobile drawer implementation is unchanged.

## Testing boundaries

Focused unit/component coverage verifies range parsing and all ranges, exact
historical debt subtraction, no current-value backfill, partial history,
disconnected-history retention, owner scoping, allocation denominators,
unallocated/missing holdings, contribution filtering, accessible chart/table
equivalents, theme parsing/persistence/synchronization, and shared semantic
tokens. PostgreSQL-backed portfolio coverage verifies owner-scoped investment
activity and confirms that explicit contributions do not change investment
account totals.

The final isolated PostgreSQL run passed **76 test files / 341 tests / 0
skipped**. Prisma generation, schema validation, migration status, lint,
typecheck, format check, production build, and `git diff --check` also passed.

The verified development workflow started the local app and confirmed that
`/login` responded. The available in-app browser then blocked localhost
interaction under its URL security policy and explicitly prohibited switching
surfaces as a workaround. Physical theme, keyboard, responsive, and authenticated
route checks therefore remain an owner-review limitation; no physical pass is
claimed by this document.

## Known limits and future boundary

- Historical coverage is constrained to stored snapshot dates; there is no
  manual-asset historical snapshot model.
- Account values in different currencies retain the application's established
  display assumption; M10 adds no exchange-rate engine.
- Holding composition requires date/currency alignment and deliberately leaves
  unmatched value unallocated.
- Current data does not reliably split employee and employer contributions.
- Fidelity/TSP uploads, parsing, mapping, duplicate review, and broader import
  workflows remain Milestone 11 work.
- Broad information-architecture polish remains M11.5, and final contrast and
  accessibility audit work remains M12.
