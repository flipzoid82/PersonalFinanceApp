# Milestone 9 — Bills and Spending Codex Prompt

## Objective

Implement Milestone 9: Bills and Spending for the Personal Finance App.

Milestone 9 completes the MVP Bills and Spending experiences on top of the recurring/calendar behavior established in Milestone 7 and the transaction/effective-value behavior established in Milestone 8.

The milestone must remain limited to the approved Bills and Spending scope. It must preserve all established financial definitions, provider/imported source-data immutability, local override precedence, owner scoping, session security, exact monetary arithmetic, recurring/calendar semantics, and existing Plaid behavior.

Do not implement Milestone 10 or later functionality.

If authoritative sources reveal a genuine conflict, stop and report the exact conflict before implementation. Do not silently invent a compromise.

---

## Read First / Source Hierarchy

Follow the repository's GPT/Codex Milestone Workflow SOP.

Read in this order:

1. `docs/Plan Docs/milestone-9-codex-prompt.md`
2. `docs/Plan Docs/build-plan.md`
3. `docs/product-requirements.md`
4. `docs/financial-definitions.md`
5. `docs/calendar-spec.md`
6. `docs/data-model.md`
7. `docs/plaid-integration.md`
8. `docs/overview-dashboard-spec.md`
9. `docs/Plan Docs/codex-build-brief.md`
10. `docs/architecture-milestone-8.md`
11. the merged architecture documents necessary to understand behavior M9 must preserve, especially:
    - `docs/architecture-milestone-7.md`
    - `docs/architecture-milestone-7-5.md`
    - `docs/architecture-milestone-6.md`
12. current implementation reality: only the code, schema, migrations, tests, and README sections needed for Milestone 9

Prefer canonical planning documents and merged architecture over historical milestone prompts.

Do not read old Milestone Codex prompts by default.

Consult a historical prompt only if a canonical plan, merged architecture document, or current implementation leaves a specific ambiguity unresolved.

---

## Branch and Git Hygiene

Milestone 8 is already merged and closed remotely and locally except for unrelated local planning-document edits that existed before Milestone 9 planning.

Before creating the Milestone 9 branch, confirm:

```text
git switch main
git pull --ff-only
git status --short --branch
git branch --list
git branch -r
```

Expected state before implementation begins:

- local branch is `main`
- `main` is current with `origin/main`
- no local `feature/milestone-8`
- no remote `feature/milestone-8`
- working tree is clean

The owner currently has unrelated local modifications to later-roadmap planning files. Do not discard them and do not carry them into Milestone 9. They must be preserved/resolved separately before the Milestone 9 branch is created.

Once `main` is clean:

```text
git switch -c feature/milestone-9
```

Work only on:

```text
feature/milestone-9
```

Do not:

- stage files
- commit
- push
- merge
- open a pull request
- modify unrelated planning documents

unless explicitly instructed after implementation review.

---

## Milestone Scope

Milestone 9 implements the approved Bills and Spending product surfaces.

### Bills

Implement:

- recurring-stream display
- upcoming activity
- active recurring outflows
- predicted next charge/posting date
- confirmed due date where available
- clear predicted-versus-confirmed distinction
- typical / expected amount
- amount-source explanation where relevant
- frequency
- merchant or biller
- account normally charged
- active / inactive state
- prediction confidence
- bill status
- separate Expected Income section
- reusable 14 / 30 / 60 / 90-day range selection
- 30-day default range

Bills must reuse existing recurring/calendar semantics and override precedence. Do not create a parallel bill model or a second correction system.

### Spending

Implement:

- spending by category
- month-over-month comparison
- income versus expenses
- merchant totals
- largest purchases
- unusual-spending indicators
- monthly trends

Spending must derive from the established effective transaction layer and canonical financial definitions.

### Semantic / Visual Requirements

Extend the existing semantic styling across Bills and Spending for:

- spending / expenses
- bills
- overdue
- warnings
- expense categories
- negative cash flow
- predicted / confirmed states
- inactive / skipped / unavailable states as applicable

Color is always secondary. Meaning must also be conveyed through visible text, signs, icons, labels, patterns, or other non-color cues.

Charts must use:

- readable legends
- explicit labels
- accessible text summaries or equivalent tabular/text representations
- theme-aware semantic tokens
- understandable presentation in both existing light and dark foundations

Do not add the Milestone 10 user-facing theme selector.

---

## Preserve Existing Behavior

Milestone 9 must preserve all established Milestone 6–8 behavior relevant to Bills and Spending.

### Transaction Effective-Value Precedence

Use the shared effective-value behavior established in Milestone 8.

Effective values remain:

1. local `TransactionOverride` value where explicitly supported
2. provider/normalized source value
3. existing presentation fallback where defined

In particular:

- local category override precedes provider category
- local financial-role override precedes provider/default classification
- local merchant override is honored where already supported
- `excludedFromReports` is honored
- original provider/imported transaction values remain unchanged

Do not introduce a second category/role interpretation layer for Spending.

### Provider / Imported Data Immutability

Never mutate original provider or imported source data to implement Bills or Spending.

User corrections remain local override records.

Plaid synchronization must continue updating provider-owned fields without deleting or overwriting local corrections.

### Owner Scoping

Every Bills and Spending query, mutation, drill-down, action, and helper must begin from the authenticated owner identity supplied by the server-side session boundary.

Do not trust browser-supplied owner IDs.

Cross-owner IDs must behave as missing/unavailable and must never leak another owner's data.

### Session Security

Preserve Milestone 7.5 session behavior.

Owner-facing navigation and mutations must continue using authoritative server-side session validation.

Do not weaken:

- idle timeout behavior
- absolute timeout behavior
- revocation
- expiration routing
- cookie security
- meaningful-activity semantics
- cross-tab security behavior

### Plaid

Preserve existing Plaid Sandbox behavior.

Do not:

- add new Plaid products
- add Production Plaid
- change access-token exposure/encryption rules
- change webhook trust boundaries
- change provider reconciliation behavior
- mutate local overrides during sync
- reintroduce duplicate logical-account behavior
- treat disconnected historical accounts as current contributors

### Recurring / Calendar

Preserve Milestone 7 recurring detection and existing Calendar semantics.

Do not introduce a second recurring engine.

Bills must read existing recurring streams and Calendar data using established effective precedence.

Preserve:

- inferred posting date versus confirmed due date separation
- user-confirmed/local override precedence
- predicted-only events never becoming overdue by default
- posted-only paid matching
- pending/canceled/removed transactions not satisfying projected events
- current `not_a_bill` semantics
- inactive stream semantics
- paid / skipped / confirmed / inactive historical preservation
- account, owner, currency, role, and direction safety boundaries
- idempotent projection/matching behavior
- recurring-detection recovery after local transaction corrections

---

## Non-Negotiable Financial Rules

These are source-of-truth requirements.

### Finalized Activity

Finalized Spending and Income analytics use only posted qualifying transactions.

Pending transactions may be visible as activity where appropriate but must not be included in finalized totals, comparisons, trends, merchant totals, largest-purchase reporting, or unusual-spending baselines.

Canceled and provider-removed transactions do not contribute to finalized reporting.

### Spending

Monthly Spending includes posted effective expenses for the selected calendar period.

Exclude:

- transfers
- credit-card payments
- investment purchases/activity
- savings transfers
- pending transactions
- canceled / removed transactions
- report-excluded transactions

Credit-card purchases count when the purchase posts. The later card payment is a transfer-like payment and is not a second expense.

### Income

Monthly Income includes posted effective genuine-income transactions.

Exclude:

- transfers
- credit-card payments
- refunds
- loan proceeds
- investment-sale proceeds
- ambiguous deposits unless already explicitly classified as income
- pending transactions
- report-excluded transactions

### Refunds

Preserve the existing established behavior: effective `REFUND` activity reduces spending rather than becoming ordinary income.

Do not redefine refund semantics in this milestone.

### Exact Monetary Arithmetic

Use exact monetary arithmetic throughout calculations.

Retain `Prisma.Decimal` or an equally exact established server-side representation through aggregation, comparison, thresholds, and derived values.

Do not use JavaScript floating-point arithmetic for financial totals or unusual-spending thresholds.

### Stored Amount Sign

Do not infer provider-neutral transaction direction from the stored amount sign.

The current repository contains different source sign conventions.

Use effective financial role for income/spending classification and absolute monetary magnitude for displayed/aggregated expense or income amounts where already established.

---

## Required Initial Analysis

Before modifying code, inspect current implementation reality and document the findings in the final report.

At minimum determine:

1. current Bills route implementation
2. current Spending route implementation
3. current recurring-stream query/projection helpers
4. current Calendar effective-value/override helpers
5. current transaction effective-value helper
6. current Overview monthly income/spending/category calculations
7. current Overview upcoming-activity calculations
8. current current-account eligibility predicates
9. current chart/presentation components and theme semantic tokens
10. current reusable range/filter/list/table/chart patterns
11. current tests that already cover:
    - reporting classifications
    - refunds
    - pending/posted behavior
    - recurring/calendar precedence
    - owner isolation
    - Plaid override survival
    - session security
    - responsive behavior
    - light/dark semantic foundations

Prefer reusing shared domain helpers rather than recreating financial rules inside page components.

### Owner-approved Milestone 9 implementation decisions

The following choices are approved Milestone 9 implementation decisions. They
complete details that were not fixed by the original Product Requirements and
must not be falsely attributed to that document:

- Bills supports 14 / 30 / 60 / 90-day ranges and defaults to 30 days.
- Spending shows a bounded 12-calendar-month historical trend ending in the
  current month.
- Unusual spending evaluates only a current posted effective `EXPENSE` at the
  same effective merchant, requires at least four prior qualifying
  observations, excludes the current transaction from its baseline, and uses
  exact Decimal median and median absolute deviation (MAD).
- The unusual indicator appears only when the amount is at least both
  `median + 3 × MAD` and `1.5 × median`.
- Unusual-spending copy is descriptive only and must never imply fraud,
  suspicious activity, security risk, or financial advice.

These approved choices supplement, but do not replace, canonical financial
definitions, provider-data immutability, owner scoping, Calendar precedence,
or established historical-audit behavior.

### Schema Decision

Start with the assumption that the existing provider-neutral schema is sufficient.

The current schema already contains:

- `Transaction`
- `TransactionOverride`
- `RecurringStream`
- `CalendarEvent`
- `CalendarOverride`

Do not add a schema migration merely to make querying or UI rendering convenient.

If a schema change is genuinely required:

1. explain why the existing model cannot represent the canonical requirement safely
2. stop if the change implies a product decision not approved here
3. use the smallest forward-only migration
4. preserve all existing data and auditability
5. never destructively reset the development database

---

# Functional Requirements

## 1. Bills Page

Replace the Bills placeholder with a real authenticated owner-scoped experience.

The page should help the owner answer:

- What recurring expenses are coming up?
- When are they expected?
- Which dates are confirmed versus predicted?
- How much is expected?
- Which account normally pays them?
- Which recurring items need attention?
- What expected income is coming in separately?

### Recurring Outflows

Show recurring streams that represent outflows, including appropriate existing types such as:

- bills
- subscriptions
- debt payments
- credit-card payments
- other qualifying recurring outflows

Do not treat expected income as a bill/outflow.

Transfers and credit-card payments may appear as recurring payment obligations where already modeled, but do not count them as Spending.

### Stream / Occurrence Information

Display consumer-friendly forms of:

- name / biller / merchant
- recurring type
- next effective date
- predicted versus confirmed label
- confirmed due date where available
- predicted posting date where useful
- expected / typical amount
- fixed / estimated / last-observed / manual source where relevant
- frequency
- typical account
- confidence level
- current status
- recent/last matching transaction where already safely available
- source/freshness context when meaningful

Do not expose internal provider IDs, raw payloads, detection metadata, tokens, or implementation codes as primary UI.

### Date Precedence

Reuse established Calendar precedence.

Do not silently reinterpret dates.

When both confirmed due date and predicted posting date exist:

- confirmed due date is primary
- predicted posting date may be shown as supplemental context

Predicted dates must be clearly labeled as predictions.

### Bill Status

Preserve the existing status vocabulary and semantics:

- Predicted
- Confirmed
- Paid
- Overdue
- Skipped
- Needs confirmation
- Inactive

Predicted-only events must not be labeled overdue by default.

### Overrides

Honor existing Calendar and recurring-stream overrides.

At minimum preserve:

1. event override
2. stream override
3. user-confirmed source value
4. source/inferred event
5. recurring-stream fallback

Honor:

- confirmed due-date override
- expected-amount override
- frequency override
- status override
- `not_a_bill`
- inactive state

Do not create a Bills-only duplicate override record or parallel precedence system.

### Editing / Actions

Calendar already owns the established recurring correction workflows.

Milestone 9 must not create a second financial correction model.

It is acceptable to:

- link/navigate to the existing Calendar correction experience
- reuse the same underlying owner-scoped Calendar actions/components where a Bills-specific surface materially improves usability

If actions are reused on Bills, they must write exactly the same existing local override records and preserve Calendar precedence.

Do not add new bill semantics simply because the Bills page exists.

### Upcoming Range

Reuse the existing Calendar range convention:

```text
14 days
30 days
60 days
90 days
```

Default:

```text
30 days
```

Use reusable parsing/query/UI behavior where practical rather than creating a Bills-specific range system.

### Expected Income Section

Show expected recurring income in a distinct section.

It must:

- never be visually mixed into Bills totals
- never be counted as an outflow
- use existing recurring/calendar `EXPECTED_INCOME` semantics
- retain predicted / confirmed distinction
- retain expected amount, account, frequency, confidence, and status where available

### Empty / Partial / Stale / Error States

Provide safe consumer-facing states for situations such as:

- no recurring history
- no detected recurring outflows
- no upcoming activity in the selected range
- all recurring outflows dismissed/inactive
- expected income absent
- stale underlying source
- partial source availability
- recoverable data failure

Do not display unknown financial totals as zero.

Where a source is stale or partial, explain the state without exposing provider internals or secrets.

---

## 2. Spending Page

Replace the Spending placeholder with a real authenticated owner-scoped analytics experience.

The page should help answer:

- How much have I spent this month?
- How does that compare with last month?
- Where is the money going?
- Which merchants account for the most spending?
- What are the largest purchases?
- Is any spending unusually high compared with my own history?
- How do income and expenses compare?
- How is spending changing over time?

### Default Period

Use the canonical current calendar month for current-month reporting.

Use the immediately previous calendar month for month-over-month comparison.

Preserve the application's existing UTC calendar-day/month semantics until a future owner-time-zone product decision changes them.

Do not silently introduce a new time-zone model in Milestone 9.

### Current Spending

Use posted, nonremoved, nonexcluded effective `EXPENSE` transactions plus established refund treatment.

Finalized historical reporting remains stable after account disconnection or
replacement. Do not exclude an otherwise qualifying owner-scoped posted
transaction merely because its source account is now inactive or belongs to a
disconnected historical Plaid Item. This historical reporting rule is distinct
from current balance/account-total eligibility and forward-looking Bills
eligibility.

Do not count:

- transfers
- credit-card payments
- investment activity
- debt-transfer-like internal movement that is not an expense
- ignored activity
- pending activity
- canceled/removed activity

### Spending by Category

Aggregate current-period finalized spending using effective category precedence.

Use local category override before provider category.

Use existing consumer-friendly category presentation.

Do not mutate or rewrite the exact stored provider category.

Refunds should reduce the corresponding effective category under the existing established behavior.

Provide an accessible chart plus a text/table equivalent or summary.

### Month-over-Month Comparison

Compare current calendar month Spending with the immediately previous calendar month.

Use exact Decimal calculations.

Clearly distinguish:

- current-month total
- previous-month total
- absolute difference
- direction of change
- percentage change only when mathematically meaningful and safely defined

Do not produce misleading percentages when the prior-period denominator is zero.

Use text/signs in addition to semantic color.

### Income Versus Expenses

Show finalized current-period:

- income
- spending/expenses
- net cash flow

Use established financial definitions.

Do not count transfer-like activity on either side.

Use exact arithmetic.

Negative cash flow must have a textual/sign cue and not rely on red color alone.

### Merchant Totals

Aggregate finalized effective expenses by effective merchant.

Effective merchant precedence must match Milestone 8.

Do not group by raw provider IDs.

Use deterministic presentation.

Consider retained long-text resilience from the Transactions work.

Merchant totals should support practical drill-down to underlying transaction history when the current route/filter model can be reused safely.

Do not implement a new transaction ledger.

### Largest Purchases

Show the largest finalized effective expense transactions for the selected/current period.

Use absolute exact magnitude for ranking.

Exclude:

- report-excluded transactions
- pending
- canceled/removed
- transfers
- card payments
- refunds as purchases
- investment activity
- ignored/unclassified non-expense activity

Provide safe links to existing owner-scoped transaction detail where useful.

### Monthly Trends

Provide a clear historical monthly spending trend based on finalized effective expense semantics.

Use a bounded, deterministic history window justified from available data and current query patterns.

Do not invent forecasting.

This is historical reporting only.

If the canonical sources/current data do not provide enough history for a meaningful trend, show an honest insufficient-history state rather than fabricated values.

Document the implemented history window in `docs/architecture-milestone-9.md`.

### Unusual Spending

Implement deterministic, explainable unusual-spending indicators.

This is not:

- fraud detection
- anomaly detection claiming suspicious behavior
- financial advice
- AI prediction
- a security alert

It is only a descriptive comparison against the owner's own historical merchant spending.

#### Eligibility

Evaluate only a current posted transaction whose effective financial role is:

```text
EXPENSE
```

The transaction must also:

- belong to the authenticated owner
- belong to an owner-owned account, including a retained inactive or
  disconnected historical account when the transaction otherwise qualifies
- not be provider-removed
- not be canceled
- not be excluded from reports

Do not evaluate:

- pending transactions
- transfers
- credit-card payments
- investment activity
- refunds
- income
- ignored activity
- unclassified non-expenses

#### Merchant Identity

Use the same effective merchant semantics established in Milestone 8.

Do not create a second fuzzy merchant-normalization model solely for unusual spending.

Historical comparison should remain consistent with the merchant identity the owner sees.

#### Minimum Prior History

Require at least:

```text
4 prior qualifying posted effective-expense transactions
```

at the same effective merchant before evaluating the current expense.

The current transaction is not part of its own baseline.

If fewer than 4 prior qualifying observations exist:

```text
show no unusual-spending flag
```

Do not guess and do not label the state suspicious/unknown.

#### Baseline

For the prior qualifying merchant expenses:

1. use exact absolute monetary magnitudes
2. compute the merchant median
3. compute the median absolute deviation (MAD) from that merchant median

Use exact Decimal-safe arithmetic.

#### Flag Rule

Flag the current expense as unusual only when both conditions are true:

```text
current_amount >= median + (3 × MAD)
```

and

```text
current_amount >= 1.5 × median
```

This dual threshold is intentional and conservative.

If the conditions are not both satisfied, show no unusual flag.

#### Presentation

Use explanatory consumer language, for example:

```text
Higher than your typical spending at this merchant.
```

The exact wording may be improved, but it must not imply:

- fraud
- wrongdoing
- a billing error
- a security problem
- financial advice

Where useful, secondary detail may explain the comparison basis without exposing implementation jargon.

#### Overrides and Recalculation

Unusual-spending evaluation must honor current effective merchant, category/role where relevant, and report exclusion.

A local correction that changes eligibility or merchant identity must cause the Spending result to reflect the corrected effective values.

Plaid sync must not erase those corrections.

---

## 3. Drill-Down and Navigation

Prefer links into existing owner-scoped transaction and Calendar/detail flows instead of duplicating functionality.

Examples that are appropriate when supported by the current route model:

- category → Transactions filtered to that category
- merchant → Transactions filtered/searched to that merchant
- largest purchase → transaction detail
- unusual purchase → transaction detail
- bill / recurring item → existing Calendar correction/detail context
- upcoming activity → Calendar where useful

Preserve URL-backed filters/sort semantics already established by Milestone 8.

Do not broaden or leak data when a stale/tampered filter value is supplied.

---

## 4. Reuse Existing Overview Logic Carefully

Overview already has established calculations for:

- monthly income
- monthly spending
- net cash flow
- spending by category
- upcoming bills/activity

Milestone 9 should avoid creating inconsistent duplicate definitions.

Where appropriate:

- extract/reuse shared server-side domain calculations
- keep the Overview and Spending/Bills results aligned
- add regression tests proving equivalent definitions remain equivalent

Do not refactor unrelated Overview code merely for aesthetics.

Preserve the Overview's existing:

- current calendar month semantics
- 14-day upcoming window
- effective transaction precedence
- posted-only finalized totals
- refund treatment
- Calendar override behavior

Bills' 30-day default must not change Overview's approved 14-day default.

---

# UI / UX Requirements

New user-facing copy must be for a normal personal-finance user, not a developer.

Prefer familiar labels such as:

- Bills
- Upcoming
- Confirmed
- Predicted
- Typical amount
- Expected amount
- Spending
- Income
- Expenses
- Category
- Merchant
- Largest purchases
- Monthly trend

Avoid implementation-oriented primary copy such as:

- normalized recurring stream
- effective category
- provider enum
- detection key
- MAD threshold
- projection key

Technical nuance may appear in concise help/secondary detail only when useful.

### Bills vs Calendar

The interface should make the distinction understandable:

- Bills focuses on recurring obligations and expected recurring income
- Calendar focuses on their timing/occurrences and existing correction workflow

Do not redesign the application's entire information architecture.

### Spending vs Transactions

The interface should make the distinction understandable:

- Spending is aggregated reporting/analysis
- Transactions is the detailed ledger and correction surface

Do not recreate transaction editing in Spending.

---

# Accessibility

All new Milestone 9 surfaces must:

- use semantic headings and landmarks
- use accessible table/list/chart labeling
- expose chart information through an accessible textual/table equivalent
- have keyboard-reachable controls
- have visible focus
- use meaningful accessible names
- not rely on color alone
- maintain readable financial signs and labels
- use semantic status text
- preserve touch-size conventions
- avoid inaccessible hover-only information
- provide an accessible alternative to visually dense chart treatments
- preserve understandable ordering on mobile

If contextual help is added, it must work with:

- keyboard
- touch
- screen-reader accessible naming

Do not add tooltips indiscriminately.

---

# Responsive Behavior

Physically verify at minimum:

```text
375 × 812
```

Also inspect representative desktop behavior.

Bills and Spending must avoid unintended horizontal scrolling.

Test resilience for:

- long merchant names
- long categories
- long account names
- long provider/source display names where shown
- large currency values
- negative values
- unusual-spending explanation text
- chart legends
- range selectors
- status labels

Use a mobile-friendly list/card alternative where a wide desktop data layout would otherwise overflow.

---

# Theme / Semantic Behavior

Milestone 9 extends, but does not replace, existing theme-aware semantic foundations.

Preserve centralized semantic meaning:

- positive / income / assets / paid → green
- negative / spending / debt / overdue → red
- warning / predicted / stale / needs attention → amber
- informational / confirmed / synced → blue
- investments → purple
- inactive / skipped / unavailable / muted → gray

Expense-category colors in charts may use a readable palette, but:

- category identity must also be conveyed by labels/legend text
- category meaning must not rely only on color
- status colors must retain their established semantic meaning
- branded/custom theme systems are not part of M9

Verify current light and dark foundations.

Do not implement Light/Dark/System controls; those remain Milestone 10.

---

# Data Freshness / Partial-State Requirements

Bills and Spending should reflect existing source health/freshness behavior where material.

If underlying synced/imported data is stale or incomplete:

- keep safely available historical values visible where appropriate
- label the state
- explain that totals/analytics may be incomplete when that is true
- identify affected source context when safe and useful
- do not expose raw provider errors or secrets

Do not treat retained historical source state by itself as making historical
transaction reporting partial. Spending and Overview retain otherwise
qualifying historical posted transactions after account disconnection or
replacement. Forward-looking Bills and current balance/account totals continue
to use current-account eligibility and may report partial current-source state
where material.

Reuse existing freshness/source helpers where possible.

---

# Testing

Add focused unit/component/integration coverage for the Milestone 9 behavior.

## Bills Tests

Cover at minimum:

- owner scoping
- current account eligibility where applicable
- outflow recurring types
- Expected Income separation
- 14 / 30 / 60 / 90 range parsing
- 30-day default
- confirmed-versus-predicted date precedence
- predicted posting date supplemental display
- expected amount precedence
- stream/event override precedence
- `not_a_bill`
- inactive streams
- paid/skipped/inactive state handling
- predicted-only overdue safety
- confidence/status labels
- empty/no-upcoming states
- source/freshness partial/stale states where implemented
- no provider/internal identifiers exposed in UI
- navigation/reuse of Calendar actions where applicable

## Spending Tests

Cover at minimum:

- effective role precedence
- effective category precedence
- effective merchant precedence
- report exclusion
- posted-only finalized reporting
- qualifying historical posted transactions retained after account
  inactivity/disconnection
- provider-removed historical transactions excluded
- current balance/account totals still restricted to current accounts
- pending exclusion
- canceled/removed exclusion
- transfer exclusion
- credit-card payment exclusion
- investment-activity exclusion
- income calculation
- expense calculation
- refund reducing spending
- category totals
- month-over-month totals
- zero-prior-period comparison safety
- income vs expenses
- net cash flow
- merchant totals
- largest purchases
- monthly trend aggregation
- exact Decimal behavior
- Bills excludes obsolete historical-account projections while Calendar keeps
  their history auditable
- repeated canonical seed runs remain idempotent and preserve established
  seeded Overview totals without permanent unusual-spending QA records

## Unusual-Spending Tests

Cover at minimum:

- requires 4 prior observations
- current transaction excluded from baseline
- same effective merchant only
- posted effective expenses only
- pending excluded
- canceled/removed excluded
- report-excluded excluded
- non-expense roles excluded
- exact median for odd/even counts
- exact MAD
- 3× MAD threshold
- 50% threshold
- both thresholds required
- MAD of zero
- negative/provider-sign source values handled through absolute magnitude
- local merchant override changes baseline identity
- local role override changes eligibility
- report exclusion changes eligibility
- owner isolation
- no flag for insufficient history
- no fraud/suspicion semantics in presentation

## Regression Tests

Retain/regress at minimum:

- Overview income/spending/net-cash-flow calculations
- Overview spending categories
- Overview 14-day upcoming bills
- Transactions effective-value behavior
- transaction override mutations
- recurring detection
- Calendar override precedence
- posted paid matching
- predicted-only overdue safety
- Plaid transaction reconciliation
- local override survival after Plaid sync
- replacement-Item account identity/current-account eligibility
- authentication/session expiration
- protected route behavior
- semantic/non-color cues
- responsive long-text behavior
- seed idempotency

Use the isolated PostgreSQL test database.

Database tests must not silently skip.

---

# Verification

Run the repository's established final verification gates.

At minimum:

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

Also run the full PostgreSQL-backed regression suite with the isolated test database and confirm:

```text
0 silently skipped database tests
```

If schema changes:

- run clean forward migration replay
- verify existing database upgrade
- verify migration status
- preserve seed idempotency
- do not reset development data destructively

Run an appropriate secret/security scan.

Remove temporary runtime/test artifacts before final reporting.

---

# Physical Browser Verification

Physically test the materially affected flows plus critical regressions.

At minimum verify:

## Bills

- populated recurring outflows
- Expected Income separate section
- 30-day default
- 14 / 30 / 60 / 90 range changes
- confirmed date
- predicted-only date
- confirmed due date plus predicted posting context
- expected amount/source
- confidence
- paid/skipped/inactive/needs-confirmation behavior where represented
- `not_a_bill` exclusion
- no-upcoming state
- Calendar navigation/correction reuse
- long merchant/account text

## Spending

- current-month spending
- previous-month comparison
- income versus expenses
- net cash flow
- category breakdown
- merchant totals
- largest purchases
- monthly trend
- unusual-spending indicator
- transaction drill-down
- local transaction override reflected in analytics
- report exclusion reflected in analytics
- refund behavior
- transfer/card-payment exclusion

## Critical Regressions

- Overview agrees with the shared monthly definitions
- Overview still uses 14-day upcoming bills
- Transactions search/filter/detail remains functional
- transaction local corrections remain functional
- Calendar still distinguishes predicted/confirmed
- predicted-only items do not become overdue
- Plaid Sandbox manual sync preserves local overrides
- session expiration still routes safely
- owner login remains manual
- browser console has no application errors

## Responsive / Accessibility / Theme

Verify:

```text
375 × 812
```

and representative desktop.

Check:

- no horizontal overflow
- keyboard-only operation
- visible focus
- chart text equivalents
- non-color status meaning
- readable long text
- current light rendering where physically controllable
- current dark rendering where physically controllable

Where the browser automation environment cannot control viewport or color scheme, do not falsely claim physical verification. Report the limitation and supplement it with automated coverage.

Never expose owner credentials, Plaid secrets, access tokens, encryption keys, or session tokens during physical testing or reports.

---

# Documentation

Create:

```text
docs/architecture-milestone-9.md
```

The architecture document must describe final implemented truth, including:

- Bills data flow
- Spending data flow
- reused effective transaction precedence
- recurring/calendar precedence
- expected-income separation
- 14/30/60/90 Bills range behavior
- 30-day Bills default
- Overview 14-day preservation
- unusual-spending algorithm
- 4-prior-observation requirement
- median/MAD exact arithmetic
- dual unusual-spending threshold
- month-over-month semantics
- income/expense/refund semantics
- merchant aggregation
- largest-purchase semantics
- monthly trend history window
- owner-scoping/trust boundaries
- current-account eligibility
- Plaid/local override interaction
- schema/migration decision
- accessibility
- responsive behavior
- chart accessibility
- test strategy/results
- known limitations

Do not merely restate this prompt.

---

# Explicit Out of Scope

Do not implement:

- Milestone 10 net-worth expansion
- Milestone 10 investment expansion
- user-facing Light/Dark/System controls
- Milestone 11 CSV import
- Milestone 11.5 cross-app UX audit/branding
- Milestone 12 production readiness
- Production Plaid
- real-institution rollout
- new Plaid products
- automatic Fidelity sync
- bill payment
- money transfers
- notifications/reminders
- advanced forecasting
- budget creation
- spending targets
- AI financial advice
- fraud detection
- suspicious-transaction/security alerts
- credit-score monitoring
- tax features
- household/multi-user functionality
- merchant/category management systems
- merchant-name editing UI unless separately approved
- refund/reimbursement-link editing UI unless separately approved
- a new recurring-detection engine
- a second Bill/Calendar override model
- a large generic chart/data-grid/design-system rewrite
- arbitrary information-architecture redesign
- branding work

Do not move future milestone work into Milestone 9 merely because the affected data is nearby.

---

# Completion Criteria

Milestone 9 is complete only when all of the following are true.

## Git / Scope

- work occurred only on `feature/milestone-9`
- M9 started from a clean up-to-date `main`
- unrelated planning changes were not carried into the branch
- no future milestone functionality was introduced
- nothing is staged, committed, pushed, merged, or submitted

## Bills

- Bills placeholder is replaced
- owner-scoped recurring outflows are displayed
- predicted and confirmed dates are clearly distinct
- confirmed due dates take precedence
- predicted posting date remains supplemental where both exist
- expected amounts use established precedence
- frequency, account, confidence, and status are represented
- inactive / not-a-bill semantics are honored
- predicted-only items are not made overdue
- Expected Income is displayed separately
- 30-day default works
- 14 / 30 / 60 / 90 ranges work
- Calendar semantics/actions are reused rather than duplicated
- empty/no-upcoming/partial/stale/error states are understandable

## Spending

- Spending placeholder is replaced
- finalized current-month Spending is correct
- spending by category is correct
- month-over-month comparison is correct
- income versus expenses is correct
- net cash flow is correct
- merchant totals are correct
- largest purchases are correct
- monthly trend is correct
- unusual-spending indicators use the approved deterministic algorithm
- transaction drill-down/reuse works where implemented
- local transaction corrections immediately affect analytics
- report exclusion is honored
- refund semantics are preserved
- transfer/card-payment/investment/pending activity is excluded as required

## Unusual Spending

- only posted effective expenses are eligible
- 4 prior same-effective-merchant qualifying expenses are required
- current transaction is excluded from its baseline
- median is exact
- MAD is exact
- current amount must be at least median + 3×MAD
- current amount must also be at least 1.5×median
- both conditions are required
- insufficient history produces no flag
- presentation does not imply fraud/suspicion/advice
- local merchant/role/report corrections are respected

## Financial Integrity

- provider/imported data remains immutable
- local overrides remain separate
- exact monetary arithmetic is preserved
- pending is not finalized
- transfers are not spending/income
- credit-card payments are not spending
- investment activity remains excluded from ordinary income/spending
- refunds retain established treatment
- historical financial records remain auditable
- Overview definitions remain aligned
- Overview 14-day upcoming behavior is unchanged

## Security / Ownership / Provider Integrity

- owner scoping remains mandatory
- browser owner identity is never trusted
- server-side session validation remains authoritative
- session security behavior remains unchanged
- Plaid tokens/secrets remain server-only
- Plaid reconciliation remains intact
- local overrides survive Plaid sync
- current-account/disconnected-account eligibility remains intact
- qualifying historical posted transactions remain reportable after their
  source account becomes inactive or disconnected
- no raw provider payload/secret/internal ID leaks into primary UI

## UI / Accessibility / Responsive

- semantic styling is extended to Bills and Spending
- meaning never relies on color alone
- charts have accessible legends/labels/text equivalents
- keyboard operation passes
- focus is visible
- 375×812 passes
- representative desktop passes
- no unintended horizontal overflow
- long merchant/category/account text remains usable
- current light/dark foundations remain coherent

## Verification

- Prisma generate passes
- Prisma validate passes
- migration status passes
- lint passes
- typecheck passes
- full test suite passes
- full isolated PostgreSQL suite passes
- no database tests silently skip
- format check passes
- production build passes
- `git diff --check` passes
- browser console is clean of application errors
- secret/security scan passes
- temporary artifacts are removed

## Documentation

- `docs/architecture-milestone-9.md` exists
- it describes implemented truth
- schema decision is documented
- unusual-spending implementation is documented
- known limitations are documented

---

# Final Report

At completion, report:

1. overall `PASS` or `BLOCKED`
2. implementation summary
3. exact files changed
4. source documents reviewed
5. confirmation historical prompts were or were not needed, with reason if used
6. initial implementation analysis findings
7. schema/migration decision
8. Bills implementation details
9. Expected Income behavior
10. Bills 14/30/60/90 range behavior
11. Spending-category implementation
12. month-over-month implementation
13. income-versus-expenses implementation
14. merchant-total implementation
15. largest-purchase implementation
16. monthly-trend implementation and exact history window
17. unusual-spending implementation
18. confirmation of 4-prior-observation rule
19. confirmation of exact median/MAD arithmetic
20. confirmation of dual threshold
21. effective-value/local-override reuse
22. refund treatment
23. pending/transfer/card-payment/investment exclusions
24. Overview alignment/regressions
25. recurring/Calendar preservation
26. Plaid preservation and sync/override result
27. owner-scoping result
28. session-security regression result
29. accessibility behavior
30. responsive behavior
31. theme/semantic behavior
32. focused tests added/updated
33. exact automated test totals
34. exact PostgreSQL test totals and skipped count
35. Prisma generate result
36. Prisma validation result
37. migration-status result
38. lint result
39. typecheck result
40. format-check result
41. build result
42. `git diff --check` result
43. physical browser flows tested
44. exact physical viewport/theme conditions actually tested
45. browser-console result
46. defects found and fixed during implementation/verification
47. unresolved limitations
48. unresolved source conflicts, if any
49. secret/security scan result
50. temporary-artifact cleanup result
51. confirmation provider/imported source data remained immutable
52. confirmation local overrides remained intact
53. confirmation exact monetary arithmetic was preserved
54. confirmation nothing was staged
55. confirmation nothing was committed
56. confirmation nothing was pushed
57. confirmation nothing was merged
58. confirmation no pull request was opened
59. recommendation: `ready for review` or `blocked`

If any authoritative source conflicts with this prompt or current implementation reality in a way that changes product behavior, stop and report the conflict instead of silently choosing a new rule.
