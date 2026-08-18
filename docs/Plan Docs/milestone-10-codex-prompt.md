# Milestone 10 Codex Prompt — Net Worth, Investments, and Theme Control

## Objective

Implement **Milestone 10: Net Worth and Investment Views** for the Personal Finance App.

This milestone must:

- expand the dedicated Net Worth experience
- expand the Investments experience
- preserve established financial calculations, owner scoping, security boundaries, and provider/import immutability
- add the user-facing Light / Dark / System theme control
- persist the user's explicit theme preference
- complete broad dark-mode support across existing application pages
- preserve centralized semantic styling and non-color meaning
- make investment concepts understandable to a user with little or no investment knowledge
- avoid pulling Milestone 11 import work forward

Do not invent product behavior when the sources or this prompt do not define it.

---

## 1. Workflow Authority and Source Hierarchy

Use the repository GPT/Codex milestone workflow SOP as workflow authority.

Read in this order:

1. `docs/Plan Docs/milestone-10-codex-prompt.md`
2. `docs/Plan Docs/build-plan.md`
3. canonical Product Requirements
4. canonical Financial Definitions
5. canonical Data Model
6. Plaid Integration documentation
7. Overview Dashboard Specification
8. Calendar Specification
9. Codex Build Brief
10. merged architecture documents through Milestone 9
11. `docs/audits/app-wide-notice-alert-audit.md`
12. current relevant code, schema, migrations, tests, and Git state

Prefer merged architecture documents over old milestone prompts. Do not read historical milestone prompts by default.

If sources genuinely conflict, stop, identify the exact conflict, do not invent a compromise, and report it before implementing that behavior.

---

## 2. Branch and Git Hygiene

Before coding, verify repository reality. Do not assume it.

Confirm:

- current branch
- `main` is clean
- `main` is up to date with `origin/main`
- Milestone 9 is merged
- the Milestone 11.5 planning-doc work is merged
- no unrelated worktree changes exist

Normal bootstrap:

```text
git switch main
git pull --ff-only
git switch -c feature/milestone-10
```

Work only on `feature/milestone-10`.

During implementation:

- do not stage
- do not commit
- do not push
- do not merge
- do not open a PR
- do not modify unrelated planning docs
- do not reset or destroy development data
- do not place secrets, financial credentials, tokens, encryption keys, account identifiers, or statement PII in source control, fixtures, logs, screenshots, or reports

Finish with nothing staged.

---

## 3. Requirement Provenance

Keep source-defined, established, and owner-approved behavior distinct.

### 3.1 Source-defined requirements

The Build Plan requires M10 to:

- add net-worth calculation
- add historical trend
- add investment account list
- add holdings where available
- add allocation where available
- add freshness indicators
- distinguish synced, imported, and manual values
- add Light / Dark / System theme controls
- persist explicit theme preference
- respect system theme when no explicit preference exists
- complete dark-mode support across existing pages
- complete semantic styling across assets, debts, investments, and trends
- standardize positive/negative presentation without color-only meaning
- provide accessible legends/summaries for investment and net-worth charts

The Product Requirements additionally require:

- total investment value
- investment accounts
- holdings where available
- manual balance snapshots
- imported Fidelity balances/holdings when import support exists
- allocation by account or holding where available
- contribution activity where available
- synced/imported/manual provenance
- current net worth and historical change

These requirements do not authorize M11 import work or investment-advice features.

### 3.2 Established behavior to preserve

#### Current-value/net-worth precedence

For active accounts, count one authoritative value:

1. latest applicable investment snapshot for investment accounts
2. latest applicable balance snapshot for other accounts
3. normalized account balance when no applicable snapshot exists

Also preserve:

- holdings are detail and never added again to account totals
- active manual assets use current manual value
- account/manual-asset debts are positive amounts owed and are subtracted
- inactive records do not contribute to current totals
- unavailable/disconnected current balances do not silently contribute
- use exact `Prisma.Decimal` arithmetic until display boundaries

#### Freshness

Preserve:

- current seven-day stale threshold
- manual freshness from latest applicable snapshot/record update
- imported freshness from import/source time
- synced freshness from sync/source time
- stale values stay visible with textual labeling
- sources needing attention/error can make totals partial
- unknown/unavailable is never shown as fake zero

#### Ownership/security

Preserve:

- authenticated owner scope on every server-side financial query
- relationship eligibility scoped to the same owner
- server-side trust boundaries
- safe allow-listed errors
- provider/imported source immutability
- local correction/override separation
- Plaid token/encryption boundaries
- session-security behavior
- historical auditability

#### Current vs historical eligibility

Do not conflate current-balance eligibility with historical-reporting eligibility.

Retained historical records may remain valid historically after disconnection/replacement, while obsolete current balances remain excluded from current totals.

#### Semantic styling

Preserve centralized semantics:

- green: positive, income, asset, paid
- red: negative, spending, debt, overdue
- amber: warning, predicted, stale, medium confidence, needs attention
- blue: informational, confirmed, synced
- purple: investments
- gray: inactive, skipped, unavailable, muted

Color is always secondary. Reuse shared semantic tokens/components and the shared `Notice` primitive where appropriate.

---

## 4. Owner-Approved M10 Decisions

These decisions supplement canonical sources and must be documented as owner-approved decisions.

### 4.1 Net-worth history

Dedicated Net Worth ranges:

```text
30D
3M
6M
1Y
All
```

Default: `30D`.

Requirements:

- historical values use only information actually known/stored for the relevant period
- do not backfill today's current-only manual asset/debt value into earlier dates
- do not fabricate observations
- label incomplete coverage as **Partial history**
- current net worth still includes all valid current assets/debts even when some lack history
- Overview keeps its existing compact 30-day behavior
- do not expand Overview into the full range-control experience

Inspect the current Overview trend before coding. Reuse established semantics where valid.

If current code leaves a material ambiguity about historical value handling between stored points, stop and report it rather than inventing a financial-history rule.

### 4.2 Investment UX for a non-investment expert

The Investments page must work for a user who does not know investment terminology.

It should plainly answer:

- How much is in my investment/retirement accounts?
- Where is the money?
- What am I invested in?
- How is it spread out?
- How much money was added, when trustworthy data exists?
- When was this updated and where did it come from?

Preferred plain-language framing may include:

```text
Where your investments are
What you own
How your investments are spread out
Money added
```

Do not require knowledge of terms such as asset allocation, security, position, NAV, or provider-specific codes before the page is useful. Technical details may be secondary.

### 4.3 Accounts, holdings, and allocation

Conceptual model:

- investment accounts = where money is held
- holdings = what identifiable investments are inside
- allocation/composition = how known investment value is spread out

Requirements:

- show investment accounts and current values
- show trustworthy holdings when they exist
- provide composition/allocation from trustworthy known data
- retain account context for holdings
- do not invent stock/bond/sector/asset-class classifications
- if some account value lacks holdings detail, do not hide it
- show unsupported portions plainly as holdings unavailable / unallocated / equivalent wording
- never add holding values on top of account balances
- do not introduce an external securities-classification service

Existing reliable source classification metadata may be used if provenance is proven and documented. Do not infer classifications from fund names alone unless an established rule already does so.

### 4.4 Contribution activity

Contribution activity is conditional: show it only when current trustworthy data supports it.

Plain-language goal: `Money added to investments`.

When trustworthy data supports the distinction, separate:

- owner/employee contributions
- employer contributions/match

Keep separate from:

- gains/losses
- dividends/interest unless separately and accurately presented
- loans
- loan repayments
- fees
- generic balance changes

Do not:

- infer contributions from balance growth
- call market gains contributions
- treat ambiguous transfers as contributions
- invent employer-match values
- build a new import/sync engine solely to populate this section

Inspect existing `InvestmentTransaction` usage. If it safely supports a small contribution/activity view, implement it. Otherwise omit/mark unavailable rather than guess.

### 4.5 Theme-control placement

Choices are exactly:

```text
Light
Dark
System
```

Placement:

- primary quick-access control in the **top-right app bar near Sign out**
- the same preference is also available in **Settings**

Requirements:

- current setting is understandable without relying on icon/color alone
- top-bar control stays compact
- both controls edit the same preference
- keyboard/screen-reader operation is correct
- theme switching never changes financial semantics

### 4.6 Theme persistence implementation

Do not assume the mechanism before inspecting the app.

Inspect:

- root layout
- dashboard shell
- auth/session architecture
- existing theme classes/tokens
- client/server boundaries
- Settings
- any existing browser-storage/cookie helpers

Choose the smallest correct mechanism satisfying:

- explicit Light/Dark/System persists across normal sessions
- System follows OS/browser preference
- no explicit choice means system preference is authoritative
- avoid visible wrong-theme flash where reasonably possible
- avoid hydration mismatch
- avoid unnecessary schema changes
- keep implementation centralized and testable

A database migration is not expected merely for theme preference. If a schema change appears necessary, stop and explain before creating it.

Document the final mechanism in `docs/architecture-milestone-10.md`.

---

## 5. Future Import Context — Do Not Implement in M10

The owner intends eventually to upload real retirement-account statements including:

- a Fidelity / NetBenefits 401(k) statement
- a Thrift Savings Plan (TSP) statement

Those formats may contain concepts such as:

- opening/ending/current balance
- employee/owner contributions
- employer contributions/match
- gains/losses or market-value change
- holdings/funds
- allocation/composition
- loan activity
- fees
- statement/freshness date

This is future-import context only.

M10 should avoid decisions that make those sources difficult to represent later, but must not implement:

- Fidelity/TSP PDF parsing
- statement upload
- CSV mapping
- import jobs
- duplicate detection
- rejected-row review
- source-specific statement parsers

M11 owns Fidelity positions/statement-derived import and generic balance-snapshot import. TSP-specific import may be decided during M11 if generic import is insufficient.

Never add real owner statements or PII to repository fixtures. Use synthetic fictional fixtures.

---

## 6. Required Initial Analysis

Before changing implementation, inspect and report:

### Net Worth

- `/net-worth`
- current query/calculation helpers
- Overview net-worth calculation
- Overview 30-day trend
- manual asset/debt behavior
- balance/investment snapshots
- partial/stale/unavailable handling
- owner scoping
- existing tests

Determine:

- what already exists
- what can be reused
- whether shared calculation should be extended
- whether range expansion needs schema change
- how partial history is represented

### Investments

Inspect:

- `/investments`
- investment-account queries
- `InvestmentBalanceSnapshot`
- `InvestmentHolding`
- `InvestmentTransaction`
- manual investment workflows
- Fidelity metadata templates
- investment tests
- source/freshness components

Determine:

- what holdings data is trustworthy
- what contribution/activity data is trustworthy
- available provenance fields
- whether allocation can be derived without guessing
- what must show unavailable

### Theme

Inspect:

- `globals.css`
- semantic utilities/components
- `Notice`
- dashboard shell/top app bar
- Settings
- login
- route loading/error/not-found
- dialogs/forms/tables/charts
- session-expiration UI
- system-driven dark-mode behavior
- explicit `.light` / `.dark` foundations
- tests

Identify remaining hard-coded light/dark styling that violates established tokens.

Prefer focused consolidation, not a design-system rewrite.

### Schema

Assume existing provider-neutral schema should be sufficient.

If a genuine model gap exists:

1. explain it,
2. explain why existing models cannot safely represent it,
3. stop for owner review before migration.

---

## 7. Net Worth Functional Requirements

The page must clearly show:

- current net worth
- total assets
- total debts
- major contributing groups
- historical change
- freshness/source limitations
- Partial history where applicable

Current net worth combines eligible current:

- cash
- investments
- property
- vehicles
- other assets
- credit-card debt
- mortgage
- loans
- other debts

Preserve established precedence.

### History controls

Implement:

```text
30D | 3M | 6M | 1Y | All
```

Default 30D.

Controls must be keyboard operable, accessible by name/state, responsive, and deterministic.

URL-backed state is optional unless current project patterns clearly justify it.

### Historical integrity

- never fabricate manual-asset/debt history
- never overwrite source history
- never use today's value as if it existed historically
- show incomplete coverage
- preserve legitimate history after account disconnection/replacement
- do not let obsolete/disconnected balances inflate current net worth
- never present partial history as complete

### Accessible historical presentation

Provide a text/table equivalent. A non-chart user must still be able to determine:

- selected range
- earliest represented date/value
- latest represented date/value
- direction/change where meaningful
- whether history is partial
- major source/freshness limitations

---

## 8. Investments Functional Requirements

### Summary

Show:

- total current investment value
- freshness/partial state
- source/provenance context

### Accounts

For each account show:

- account name
- institution/source
- consumer-readable account type
- current value
- synced/imported/manual provenance
- last updated/freshness
- unavailable/attention state when applicable

Do not expose raw provider enums as primary labels.

### Holdings

Where holdings exist:

- holding/fund name
- ticker/symbol when available/useful
- account context
- current value when trustworthy
- quantity/price only when available and not misleading
- source/freshness where useful

Where holdings do not exist:

- do not fabricate
- do not hide account value
- explain plainly that detail is unavailable

### Allocation / composition

Present only trustworthy known data.

Possible views:

- by known holding
- by investment account
- by source-provided classification when genuinely available

Do not guess asset classes.

If part of total value lacks holdings/classification detail, make that portion explicit instead of silently changing the denominator.

All charts need:

- text labels
- accessible legend/equivalent
- table/list equivalent
- understandable percentages/values
- light/dark readability
- non-color differentiation

### Contributions/activity

Use trustworthy existing investment transaction data only.

If reliable contribution categories exist, show a small plain-language summary. If not, omit/mark unavailable.

No balance-growth inference.

---

## 9. Theme Functional Requirements

Use one shared preference model for:

- top-right app-bar control
- Settings control

### Light

Force light theme.

### Dark

Force dark theme.

### System

Follow current OS/browser color preference.

If OS/browser preference changes while System is active, follow it without requiring re-selection where supported by the chosen architecture.

### Persistence

Persist only what is needed for theme preference.

Do not put financial data into browser storage as part of this work.

Do not weaken session/auth behavior.

### Initial render

Prevent or minimize:

- wrong-theme flash
- hydration mismatch
- stale state between top-bar and Settings controls

Prefer a centralized implementation.

---

## 10. Complete Dark-Mode Coverage

M10 owns broad dark-mode completion across existing owner-facing pages:

```text
/login
/overview
/accounts
/transactions
/bills
/calendar
/spending
/investments
/net-worth
/settings
```

Also inspect important surfaces:

- transaction detail
- manual account/asset forms
- Plaid connection/repair/disconnect
- Calendar corrections
- dialogs
- session-expiration warning
- loading/empty/partial/stale/error states
- route error/not-found
- tables
- form controls
- tooltips/help if present

Use established tokens.

Do not turn this into the full M11.5 UX audit or final M12 contrast audit. Fix M10-relevant readability/theme regressions; defer unrelated information architecture, branding, broad UX polish, and generic framework work.

---

## 11. UI / UX Requirements

Write for a normal consumer.

For Investments:

- plain-language headings
- brief explanations
- progressive disclosure
- provider/technical details secondary
- no investment advice
- no expected-return claims
- no unsupported risk conclusions
- never imply missing holdings means zero holdings

For Net Worth:

- make assets vs debts obvious
- make signs/labels explicit
- debt must not look like positive wealth
- partial/stale history must be clear without alarmist language
- prefer simple labels over jargon

Use shared `Notice` for generic notices.

---

## 12. Accessibility

Require:

- semantic headings/landmarks
- accessible theme-control names and current state
- keyboard-only operation
- visible focus
- logical focus order
- no color-only meaning
- chart text/table equivalents
- meaningful legends/labels
- status text for stale/partial/unavailable
- screen-reader-compatible financial signs/values
- no inaccessible icon-only theme state
- reasonable reduced-motion behavior if animation is introduced

Automated tests do not replace physical keyboard testing.

---

## 13. Responsive Behavior

Verify at minimum:

```text
375 × 812
```

and representative desktop; inspect a tablet width if practical.

Check:

- no unintended page overflow
- history controls usable
- chart legends/equivalents readable
- holdings layouts usable
- theme control and Sign out coexist
- Settings theme controls usable
- long account/fund names handled safely
- financial values remain legible

---

## 14. Testing

Add focused coverage.

### Net Worth

- current-value precedence
- debt subtraction
- inactive/current eligibility
- unavailable current values
- owner scoping
- exact Decimal arithmetic
- 30D/3M/6M/1Y/All
- 30D default
- Partial history
- no fabricated manual history
- retained legitimate history after disconnect/replacement
- accessible chart/table summary

### Investments

- totals do not double-count holdings
- holdings only when available
- missing holdings explicit
- provenance
- freshness
- owner scoping
- trustworthy allocation denominator
- unsupported/unallocated portion
- no inferred classification without source support
- contribution activity only from trustworthy records
- gains are not contributions
- loans/repayments/fees are not mislabeled as contributions

### Theme

- Light
- Dark
- System
- persistence
- system fallback
- top-bar/Settings synchronization
- system preference response when testable
- no hydration/state mismatch in chosen architecture
- non-color semantic cues
- representative components under explicit light/dark

### Regression

Preserve:

- auth/session expiration
- Overview totals
- current-account balance eligibility
- Transactions search/filter/detail/overrides
- Bills
- Calendar predicted/confirmed behavior
- Spending
- Plaid local-override preservation
- shared Notice

Use the isolated PostgreSQL test DB for DB-backed behavior. No silent skips.

---

## 15. Verification Gates

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
git diff --check
```

Run the full PostgreSQL suite and report exact:

- test-file count
- test count
- skipped count

If an approved schema change occurs, also require a forward-only migration, no destructive reset, migration verification, diff sanity check, and seed verification where relevant.

---

## 16. Physical Browser Verification

### Theme

Verify:

- top-right Light/Dark/System
- Settings Light/Dark/System
- controls synchronized
- explicit preference survives reload/navigation
- System works where environment permits
- representative Light
- representative Dark
- no application console errors

Inspect all major routes for obvious M10 theme/readability regressions.

Do not falsely claim physical System switching if the environment cannot control OS/browser preference; report the limitation and supplement with automated coverage.

### Net Worth

Verify:

- current total
- assets/debts
- 30D default
- 3M
- 6M
- 1Y
- All
- Partial history
- accessible equivalent
- responsive behavior

### Investments

Verify:

- total investment value
- account list
- source/freshness
- holdings when present
- missing-holdings explanation
- allocation/composition
- contribution/activity when available
- no double counting
- plain-language comprehension
- responsive behavior

### Critical smoke checks

Verify representative:

- Overview
- Transactions
- Bills
- Calendar
- Spending
- Accounts
- Plaid connection status
- session expiration/login safety

Manual login remains manual. Never expose credentials/secrets.

---

## 17. Documentation

Create:

```text
docs/architecture-milestone-10.md
```

Describe final implemented truth:

- requirement provenance
- schema/migration decision
- current net-worth precedence
- historical query/calculation semantics
- range behavior
- Partial history semantics
- manual asset/debt historical treatment
- current-vs-historical eligibility
- Investments data flow
- account/holding/allocation semantics
- missing-holdings/unallocated behavior
- contribution/activity semantics and limits
- provenance/freshness
- theme persistence mechanism
- Light/Dark/System behavior
- top-bar + Settings control architecture
- dark-mode completion work
- semantic token/component reuse
- accessibility/chart equivalents
- owner/security boundaries
- tests and exact totals
- physical verification
- known limitations
- M11 import boundary

Do not merely restate this prompt.

---

## 18. Explicit Out of Scope

Do not implement:

- M11 CSV import
- Fidelity statement/PDF parsing
- TSP statement/PDF parsing
- generic statement upload
- import mapping
- import duplicate detection/rejected rows
- automatic Fidelity sync
- TSP provider integration
- external securities/market-data classification
- live prices unless already part of an approved existing source
- trading/automated investing
- rebalancing recommendations
- retirement projections
- tax optimization
- investment advice
- unsupported risk scoring
- market benchmark performance
- future-return forecasts
- new Plaid products
- Production Plaid
- real-institution rollout
- bill payment/money transfers
- notifications/reminders
- budgeting
- advanced forecasting
- credit-score monitoring
- household/multi-user support
- branding
- full M11.5 UX audit
- large design-system rewrite
- final M12 contrast/accessibility/theme audit

Do not pull future work into M10 because the affected page is nearby.

---

## 19. Completion Criteria

### Git/scope

- only `feature/milestone-10`
- started from clean up-to-date `main`
- no unrelated work
- nothing staged/committed/pushed/merged/submitted
- no secrets/PII/generated junk

### Net Worth

- dedicated page implemented
- current precedence preserved
- assets/debts understandable
- 30D/3M/6M/1Y/All work
- 30D default
- no fabricated history
- current-only manual values not backfilled
- Partial history explicit
- current vs historical eligibility correct
- accessible history equivalent
- freshness/source limitations clear

### Investments

- total correct
- account list
- holdings where trustworthy
- missing holdings explicit
- allocation where trustworthy
- unknown/unallocated value not hidden
- no double counting
- provenance/freshness clear
- contribution/activity only when trustworthy
- gains/loans/fees not mislabeled
- primary UI understandable without investment expertise

### Theme

- Light works
- Dark works
- System works
- explicit preference persists
- no explicit preference follows system
- top-right control works
- Settings control works
- both share one preference
- broad existing-page dark regressions found in M10 are fixed
- no color-only meaning
- charts understandable in both themes

### Quality

- focused tests pass
- full PostgreSQL suite passes
- no silent skips
- lint/typecheck/format/build pass
- Prisma validation/migration status pass
- `git diff --check` passes
- physical verification completed or limitations reported
- architecture doc reflects final truth

---

## 20. Final Report

Return:

1. implementation summary
2. sources reviewed
3. requirement-provenance summary
4. files changed
5. schema/migration decision
6. net-worth history/range semantics
7. Investments implementation/plain-language UX
8. contribution/activity decision based on actual data
9. theme persistence mechanism and rationale
10. dark-mode fixes
11. owner/security/financial-integrity review
12. focused test results
13. full PostgreSQL totals: files/tests/skipped
14. every verification command and result
15. physical browser verification
16. physical-verification limitations
17. defects found/fixed
18. known limitations/deferred M11 or M11.5 work
19. secret/PII scan result
20. cleanup/artifact result
21. confirmation nothing was staged/committed/pushed/merged/submitted
22. recommendation: `READY FOR OWNER REVIEW` or `BLOCKED`

Do not claim completion if any required gate or behavior is unresolved.
