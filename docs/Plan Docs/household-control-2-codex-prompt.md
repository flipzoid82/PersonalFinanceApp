# Household Control 2 — Budget & Income Plan

## Mode

IMPLEMENTATION

Implement Household Control 2 as one bounded product milestone. Do not stage,
commit, push, merge, or open a pull request unless the owner explicitly asks
after reviewing the completed work.

Work only on the owner-approved HC2 feature branch created from current clean
`main` after this documentation lock is merged.

## Objective

Build a monthly Budget & Income Plan that lets the owner decide what planned
income needs to accomplish, see intentionally unassigned income, and compare the
plan with reviewed actual spending. Preserve the distinction between a plan,
current bank liquidity, funded saving, routed cash flow, and Safe-to-Spend.

HC2 must reuse HC1 transaction truth and the existing recurrence/Calendar
obligation foundation. It must not build parallel financial truth.

## Source hierarchy

Read and apply sources in this order:

1. `docs/Plan Docs/product-requirements.md`,
   `docs/Plan Docs/build-plan.md`, and
   `docs/Plan Docs/financial-definitions.md`;
2. `docs/architecture-household-control-2.md` and the binding contract in this
   prompt;
3. `docs/Plan Docs/data-model.md`,
   `docs/Plan Docs/household-financial-control-pivot.md`,
   `docs/Plan Docs/overview-dashboard-spec.md`, and
   `docs/Plan Docs/calendar-spec.md`;
4. `docs/architecture-household-control-1.md`, current Prisma schema,
   migrations, implementation, services, components, and tests;
5. `docs/Plan Docs/household-financial-control-pivot-assessment.md` as rationale
   and historical context only.

Do not load prior milestone Codex prompts unless a specific ambiguity cannot be
resolved from the hierarchy above. Historical architecture documents remain
records of implemented behavior and must not be rewritten to imply later intent.

If authoritative sources conflict, an owner-level product decision is missing,
or a safe forward migration is impossible, stop and report the exact issue
before implementing a workaround.

## Mandatory preflight

Before editing:

1. confirm the expected HC2 feature branch and clean baseline;
2. inventory existing uncommitted/staged/untracked files and preserve unrelated
   work;
3. inspect the actual HC1 schema, migrations, resolver, eligibility predicates,
   exact allocations, relationships, and readiness behavior;
4. inspect current Spending, Overview, Bills, recurrence, Calendar effective
   values, Calendar queries/mutations, navigation, theme, and responsive shell;
5. inspect current database indexes and query shapes;
6. confirm the schema lacks required HC2 planning state before adding it;
7. report and stop on a genuine source, migration, privacy, or runtime conflict.

Do not reset, destructively migrate, or seed development owner data.

## Binding owner decisions

### Planned income

- Confirmed and predicted expected-income Calendar occurrences are suggestions
  only.
- Neither is inserted into a plan automatically.
- Inclusion requires an explicit owner action and approved exact amount.
- Predicted income retains its confidence and source labels.
- Manual planned income is supported.
- The plan stores approved source evidence and stable lineage.
- Later Calendar source changes produce a visible reconciliation state and do
  not silently mutate the approved plan.
- Planned, expected, and pending income never increase current liquidity or
  Safe-to-Spend in HC2.

### Rollover

- Rollover is explicit and category-specific.
- Store a prior surplus or deficit as a separate signed opening category
  balance in the next period.
- Positive rollover increases category availability; negative rollover reduces
  it.
- Rollover does not alter current-period planned income or its assignment
  equation.
- Positive rollover is owner-declared and funding-unverified through HC2.
- Rollover is not current liquidity, funded saving, or Safe-to-Spend.
- Record Carry and Do not carry decisions auditably and idempotently.
- Never rebalance, scale, or roll values automatically.

### Planning time zone

- Use one explicitly owner-confirmed valid IANA planning time zone.
- Use the same local-month boundaries for HC2, month-based Overview, and
  month-based Spending.
- A plan's time-zone snapshot controls that plan period. Existing plans are not
  silently rewritten when the profile changes.
- A Draft plan may migrate only through an explicit reviewed action. Active and
  Closed plans retain their snapshot; the new preference applies to later
  plans.
- Provider timestamps remain unchanged.
- Calendar date-only values remain civil dates and must not shift through time
  zone conversion.
- Reconcile every UTC-to-owner-local reporting difference before cutover; zero
  unexplained differences may remain.

### Fixed obligations

- One fixed plan allocation references one Calendar occurrence.
- It may also reference an HC1 expense category for presentation.
- Its planned amount contributes once to assigned capacity and once to any
  category planned total.
- Its fulfilling posted transaction contributes once to actual category
  spending when category-bearing.
- Bills, Calendar, Budget, and fulfillment views do not create additional
  deductions.
- An additional flexible allocation in the same category is a separate explicit
  owner choice.

## Scope

Implement:

- Owner planning profile with explicit IANA time zone and USD V1 currency;
- one monthly plan per owner/period/currency;
- Draft, Active, and Closed lifecycle behavior;
- manual planned-income entries;
- explicit inclusion of Calendar expected-income suggestions;
- source drift and reconciliation workflow;
- HC1-category monthly spending allocations;
- Calendar-backed fixed obligations;
- protected planning allocations;
- generic planned saving;
- generic owner-entered extra debt principal;
- derived intentionally unassigned income and optional zero-based planning;
- Fixed, Flexible, and Protected policies;
- exact balanced append-only reallocations;
- explicit signed opening-balance rollover decisions;
- category spent, available, remaining, percentage, elapsed time, weekly pace,
  projected spending, and projected over/under;
- classification coverage, confidence, explanation, assumptions, and
  transaction drill-down;
- consistent owner-local month boundaries in HC2, Overview, and Spending;
- accessible, responsive, Light/Dark/System user experience.

## Explicit exclusions

Do not implement:

- HC3 planning-account inclusion, roles, routing, account/household reserve
  floors, planned transfers, projections, funding statuses, or pay-cycle logic;
- HC4 commitment ledger, Safe-to-Spend, proposed-purchase checking, or Home
  redesign;
- HC5 named goals, sinking funds, irregular-expense accumulation, Debt Tracker,
  payoff schedules, snowball/avalanche strategies, interest optimization, or
  debt-versus-saving recommendations;
- HC6 warnings, digest, or external notifications;
- HC7 household membership, invitations, roles, or permissions;
- automatic rollover or arbitrary custom budget calendars;
- bank-initiated transfers or payments;
- multi-currency conversion;
- ML/AI recommendations or unrelated UI cleanup;
- Milestone 11 import expansion.

## Required durable model

Implement the smallest normalized schema consistent with
`docs/architecture-household-control-2.md`.

At minimum it must represent:

1. `OwnerPlanningProfile`;
2. `BudgetPlan`;
3. `BudgetIncomeItem`;
4. `BudgetAllocation`;
5. `BudgetReallocation`;
6. `BudgetRolloverDecision`.

Names may follow established repository conventions, but semantics cannot be
collapsed into unstructured JSON or mutable aggregate balances.

### Database constraints

Use a new forward-only migration. Preserve all existing migrations.

Enforce where applicable:

- one profile per owner;
- valid bounded time-zone/currency storage, with IANA validation in the service;
- one plan per owner, local period key, and currency;
- unique owner-aware plan identity;
- unique Calendar income occurrence per plan;
- unique Calendar fixed-obligation occurrence per plan;
- owner-aware category, event, account, allocation, and plan references;
- exact nonnegative base allocations and positive income/reallocation amounts;
- distinct reallocation endpoints;
- same-plan source and destination reallocations;
- valid destination-kind/policy/reference combinations;
- unique idempotent rollover decision identity;
- a destination category allocation for Carry, while Do not carry remains
  recordable without one;
- stable indexes for owner-period, category, Calendar-source, reallocation, and
  rollover queries.

Where PostgreSQL check constraints or composite foreign keys cannot be expressed
fully in Prisma, add them explicitly in the forward migration and cover them in
isolated PostgreSQL tests. Do not weaken existing constraints to manufacture
test states.

## Profile and period behavior

If the owner has no planning profile, `/budget` must show a safe configuration
state rather than guessing an authoritative time zone. The browser may suggest
its IANA zone; saving it requires explicit owner confirmation.

Use a canonical `YYYY-MM` local period key and store the time-zone snapshot on
the plan. Derive exact inclusive-start/exclusive-end UTC instants through one
shared DST-safe utility. Do not hand-roll ad hoc time-zone offsets in multiple
consumers.

For a selected period, use its existing plan snapshot in Budget, Overview, and
Spending; otherwise use the current profile. A profile change cannot silently
reframe an existing plan. Support an explicit reviewed migration only for a
Draft plan. Active and Closed plans retain their snapshot and the changed
preference applies to later plans.

Only one plan exists for a local month. Future plans may be Draft. An owner may
activate a reconciled Draft plan. Closed plans reject ordinary income,
allocation, and reallocation edits. Reopening, if supported, must be explicit
and auditable; otherwise omit it rather than silently mutating closed history.

## Planned-income behavior

Query bounded effective Calendar expected-income occurrences for the selected
period. Show date, amount source, confirmation/prediction state, confidence, and
current inclusion state.

On explicit inclusion, snapshot the effective source amount, effective date,
confidence, and relevant source version/update timestamp while retaining the
Calendar event ID. The owner may approve a different plan amount, which remains
clearly owner-entered.

Detect and explain at least:

- amount changed;
- date changed or moved outside the period;
- confidence/state changed;
- event paid, skipped, inactive, or unavailable;
- source no longer owner-valid or USD.

Reconciliation is explicit: keep the approved value, update to the current
source value, or remove the plan item. Never silently apply source drift.

## Allocation and obligation behavior

HC1 `TransactionCategory` remains actual-purpose identity. Do not create saving,
reserve, goal, or extra-principal transaction categories.

Support destination kinds and valid policy combinations defined by the HC2
architecture. A fixed obligation uses the existing effective Calendar
occurrence after owner overrides. It stores a plan amount and source snapshot
for reconciliation but does not replace the Calendar expected amount, date,
certainty, status, correction, or fulfillment data.

Do not infer fixed obligations from every recurring event automatically. Offer
eligible occurrences as suggestions and require explicit inclusion. Predicted
or needs-confirmation items retain those labels.

Debt/card-payment allocations are planning uses of income, not ordinary
spending. Never fabricate APR, minimum payment, contractual due date, statement
balance, original principal, term, or payoff result. Extra principal is a
generic owner-entered allocation only.

## Exact calculations

Implement the formulas in Financial Definitions and the HC2 architecture using
`Prisma.Decimal` from input parsing through persistence and aggregation.

```text
planned_income = sum(approved income items)

current_period_assigned = category base allocations
                          + fixed obligations
                          + protected planning allocations
                          + planned saving
                          + planned extra debt principal

intentionally_unassigned = planned_income
                           - current_period_assigned

category_spent = posted effective expense allocations
                   - linked posted refund/reimbursement allocations

category_current_assignment = category base allocation
                              + fixed category allocation components
                              + reallocation in
                              - reallocation out

category_available = category_current_assignment
                     + signed opening rollover

category_remaining = category_available - category_spent
```

Do not add rollover to planned income or current-period assigned income.
Do not store intentionally unassigned income as a mutable value.

Actual spending must use HC1 canonical role, stable category, exact split,
refund/reimbursement relationship, exclusion, posted-state, removed-state,
currency, and later-planning eligibility semantics. Never restore a private
provider-category or amount-sign heuristic.

## Reallocation and rollover safety

Perform reallocation in one owner-scoped serializable transaction with
deterministic locking. Require two distinct flexible allocations in the same
open plan and a positive exact amount. One immutable row supplies equal outgoing
and incoming effects. A correction is a reversing row, never destructive edit.

For rollover, show the prior period's exact remaining amount and require an
explicit Carry or Do not carry decision. Store the source snapshot and signed
opening balance. Carry requires an adjacent-period destination allocation with
matching stable category identity. Do not carry remains auditable when no target
allocation exists. Retrying the same decision must not duplicate its effect.

Do not call positive carryover funded. Do not convert it to income. Do not apply
it to an account balance, reserve floor, projection, or Safe-to-Spend.

## Pace, forecast, and coverage

Use owner-local calendar-day boundaries and expose the method.

Handle explicitly:

- the first day and very early period;
- zero or negative category availability;
- no posted category activity;
- net-negative spending after refunds;
- late and partial refunds;
- incomplete HC1 classification/split coverage;
- non-USD activity;
- closed and future periods.

Do not invent opaque confidence percentages. Report deterministic coverage from
the HC1 source population and the exact unresolved count/magnitude. When a
forecast lacks sufficient reviewed evidence, return an explicit insufficient or
qualified state rather than a confident number.

Do not introduce a general warning-record engine or HC6 thresholds. HC2 may use
direct mathematical states such as over allocation or projected over allocation
with accessible explanatory text.

## Query design

Do not reuse current broad owner-history queries unchanged.

- Push selected local-period boundaries into PostgreSQL.
- Use bounded comparison periods for pace/history where needed.
- Bulk-load page data and all needed allocations/relationships.
- Avoid N+1 query loops by category, transaction, income item, or obligation.
- Preserve stable sorting and pagination for transaction drill-down.
- Inspect representative sanitized PostgreSQL plans for plan lookup, category
  progress, Calendar suggestions, source drift, and drill-down.
- Treat a newly introduced unbounded owner-history load or material HC2 query
  regression as a blocking contract defect.

Use synthetic PostgreSQL data for query-plan evidence. Do not report owner
financial values or identifiers.

## Overview and Spending cutover

Replace UTC month boundaries only where a consumer means the owner's reporting
month. Use the shared planning-period service in Budget & Plan, Overview, and
Spending.

Before cutover, reconcile synthetic old/new results and classify every
difference as the expected effect of the owner time zone or a corrected defect.
Zero unexplained differences may remain. Outside period-boundary differences,
Overview, Spending, and HC2 must agree on effective category totals.

Do not change Calendar date-only display or recurring projection identities as
a side effect of the time-zone work.

## UI and navigation

Add the provisional **Budget & Plan** navigation entry and `/budget` route.
Do not remove or redesign existing Spending, Bills, or Calendar routes.

The page must support:

- profile/time-zone setup;
- URL-backed month selection and Back/Forward behavior;
- plan creation and lifecycle state;
- income suggestions, inclusion, manual entry, and drift reconciliation;
- exact assignment/unassigned summary;
- category allocation creation/editing and progress;
- fixed-obligation suggestions and source detail;
- protected planning, planned saving, and extra-principal entries;
- explicit reallocation with confirmation;
- prior-period rollover review with Carry/Do not carry;
- transaction and assumption drill-down;
- useful empty, partial, unavailable, stale-source, overassigned, and error
  states.

No essential requirement, source, confidence, or validation information may be
hidden only in a tooltip. Do not rely on color alone. Preserve clear signs,
labels, icons, and text explanations.

All controls require keyboard access and visible focus. Dialogs require correct
labeling, initial focus, focus trapping, Escape cancellation where safe, and
focus restoration. Verify long labels, merchant names, source names, and amounts
without horizontal overflow.

## Security and privacy

- Require the authenticated owner for every page, query, and mutation.
- Verify owner scope for every referenced plan, category, event, account,
  allocation, reallocation, and rollover source.
- Preserve server-side protected-route enforcement.
- Preserve provider/imported source immutability and owner-override precedence.
- Never expose source payloads, provider identifiers, owner transaction detail,
  account identifiers, financial totals, credentials, tokens, encryption keys,
  cookies, or connection-string passwords in logs, tests, migration output,
  query-plan evidence, or reports.
- Use synthetic fixtures for numeric reconciliation and performance evidence.

## Migration and seed requirements

- Add one or more clearly named forward-only HC2 migrations.
- Do not edit previously applied migrations.
- Do not reset the development database.
- Prove migration replay against an isolated PostgreSQL database.
- Existing owners receive no guessed planning profile or plan.
- No whole-history planning backfill runs at startup.
- If seed data is updated for the demo experience, use stable synthetic keys and
  prove two runs create no duplicate HC2 records or overwrite owner choices.

Before applying a repair to development data, back it up safely or prove it in a
transaction that can be rolled back. HC2 should not require destructive owner
data repair merely to introduce empty planning state.

## Required automated coverage

Add focused unit, component, action, server, and isolated PostgreSQL integration
tests for at least:

1. profile ownership, valid IANA time zone, and USD restriction;
2. one plan per owner/month/currency;
3. explicit Calendar-income inclusion and no automatic inclusion;
4. predicted-income labels and manual planned income;
5. income source drift without silent plan mutation;
6. exact planned-income assignment and derived unassigned amount;
7. positive, zero, and negative unassigned states;
8. stable HC1 category references and inactive-category behavior;
9. exact split spending;
10. linked partial/multiple refunds and reimbursements;
11. report exclusions, pending, canceled, removed, unresolved, and non-USD
    treatment;
12. one fixed allocation per Calendar occurrence;
13. Calendar override precedence and source drift;
14. fixed-obligation/category planned amount counted once;
15. fulfillment transaction actual spending counted once;
16. protected planning allocation is not an account reserve floor;
17. planned saving is not funded saving;
18. generic extra principal adds no invented debt facts;
19. balanced append-only reallocations;
20. invalid/cross-plan/cross-owner reallocation rejection;
21. concurrent reallocation safety and idempotent retries;
22. positive and negative opening rollover;
23. explicit Do not carry and repeated-rollover idempotency;
24. rollover excluded from planned income and current assigned amount;
25. rollover funding-unverified presentation;
26. local-month boundaries in multiple positive and negative UTC offsets;
27. daylight-saving transitions and year boundaries;
28. profile changes preserving Active/Closed snapshots and explicit Draft
    migration;
29. Overview, Spending, and Budget agreement;
30. old/new UTC boundary reconciliation with zero unexplained differences;
31. pace and forecast for first day, zero availability, refunds, and incomplete
    coverage;
32. transaction and assumption drill-down lineage;
33. plan lifecycle mutation restrictions;
34. database check/composite-owner constraint rejection;
35. bounded bulk query behavior and representative PostgreSQL plans;
36. repeated seed idempotency where seed changes;
37. protected-route behavior and owner isolation;
38. keyboard, accessible labels, non-color meaning, theme classes, responsive
    containment, and long-text handling;
39. regression coverage for HC1 Transactions/Inbox, Calendar matching,
    Bills, Overview, Spending, Plaid sync, imports, session security, theme, and
    current-account behavior.

Tests must not use real owner records, statements, descriptions, balances,
account identifiers, or provider identifiers.

## Physical verification

Using synthetic data and the established development workflow, verify:

- profile setup and explicit time-zone confirmation;
- `/budget` empty and configured states;
- current, prior, and future month navigation plus Back/Forward;
- manual and Calendar-backed planned income;
- confirmed and predicted suggestion behavior;
- source-drift reconciliation;
- category, fixed, protected, saving, and extra-principal allocations;
- exact assignment/unassigned totals;
- posted split/refund/exclusion effects and transaction drill-down;
- fixed obligation visible across Budget/Bills/Calendar without duplicate plan
  effect;
- balanced reallocation and confirmation behavior;
- positive/negative/declined rollover;
- Overview, Spending, and Budget local-month agreement;
- Light, Dark, and System rendering;
- keyboard-only primary flow, visible focus, dialog focus behavior;
- 375×812, representative tablet, and desktop widths;
- long labels and no horizontal overflow;
- clean browser console;
- logout and direct protected-route redirects.

Do not expose owner financial information in the physical-verification report.

## Verification gates

Run:

- focused HC2 tests during implementation;
- Prisma generation;
- Prisma validation;
- Prisma migration status;
- forward migration replay on isolated PostgreSQL;
- repeated seed idempotency if seed changes;
- PowerShell helper tests if the development workflow changes;
- lint;
- typecheck;
- format check;
- full isolated PostgreSQL-backed suite with zero skipped database tests;
- production build;
- `git diff --check`;
- security/PII scan;
- generated/runtime-artifact cleanup;
- final status with zero staged files.

Do not treat `.env.example` as runtime configuration. Do not print or commit
secrets. Do not stage, commit, push, merge, or open a PR.

## Architecture documentation

At completion, update `docs/architecture-household-control-2.md` from approved
target architecture to implemented truth. Record:

- exact schema and migration justification;
- owner decisions and boundaries;
- time-zone implementation and reporting reconciliation;
- planned-income inclusion and source-drift behavior;
- allocation, obligation, reallocation, and rollover semantics;
- exact formulas;
- query/index/concurrency design;
- owner/security invariants;
- automated totals and physical verification;
- limitations and explicit HC3+ exclusions.

Do not rewrite prior architecture records.

## Stop conditions

Stop before a workaround if implementation discovers:

- a conflict in authoritative financial meaning;
- a requirement to mutate provider/imported source data;
- an inability to preserve owner scope or exact Decimal behavior;
- an unsafe migration or destructive owner-data requirement;
- no reliable way to distinguish one obligation from multiple presentations;
- a rollover design that changes planned income or claims unproven funding;
- a time-zone cutover with unexplained financial differences;
- an unbounded owner-history query introduced by HC2;
- required HC3+ behavior to make HC2 appear complete.

## Final report

Report:

1. implementation summary;
2. exact files changed;
3. final schema and migration rationale;
4. reuse of HC1 and Calendar truth;
5. planned-income and source-drift behavior;
6. rollover and reallocation behavior;
7. time-zone and old/new reconciliation result;
8. obligation/category deduplication result;
9. exact calculation behavior;
10. query/index/concurrency evidence;
11. automated command results and test totals;
12. physical verification;
13. defects found and fixed;
14. limitations and HC3+ exclusions;
15. security/PII and repository hygiene result;
16. confirmation nothing was staged, committed, pushed, merged, or submitted.

Return either **READY FOR STAGING REVIEW** or **BLOCKED**.
