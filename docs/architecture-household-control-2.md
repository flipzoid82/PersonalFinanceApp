# Household Control 2 Architecture — Budget & Income Plan

## Status and purpose

This document locks the approved architecture for Household Control 2 before
implementation. It does not claim that HC2 schema, routes, or behavior already
exist.

HC2 gives the owner a monthly command center for deciding what planned income
needs to accomplish and for comparing that plan with reviewed actual spending.
It does not calculate current liquidity, route money between accounts, prove
that planned saving is funded, or calculate Safe-to-Spend.

## Source reconciliation

The canonical Product Requirements, Build Plan, Financial Definitions, Data
Model direction, Overview specification, Calendar specification, governing
pivot, implemented HC1 architecture, current Prisma schema, and current
Spending/Bills/Calendar services were reviewed.

No authoritative conflict was found. The historical pivot assessment retains
older milestone names and sequencing as rationale only and is not governing.
The current schema has no planning profile, monthly plan, planned-income entry,
planning allocation, reallocation audit, or rollover decision. A narrow
forward-only schema expansion is therefore justified.

## Approved owner decisions

### Planned income is explicitly included

Confirmed and predicted expected-income Calendar occurrences are suggestions.
Neither enters a plan automatically. The owner explicitly includes an
occurrence and approves its plan amount. Predicted income retains its confidence
label. Manual planned income remains supported.

An included source event establishes lineage; it does not make the plan amount
mutable source data. If the effective Calendar amount, date, certainty, or
status later changes, HC2 shows the difference and asks the owner to reconcile
it. It never silently rewrites the approved plan.

### Rollover is an opening category balance

An explicit rollover decision records a prior category surplus or deficit as a
separate signed opening category balance in the next period. It does not alter
current-period planned income or its assignment equation.

- positive carryover increases category availability;
- negative carryover reduces category availability;
- positive carryover is owner-declared and funding-unverified through HC2;
- rollover never creates current liquidity or Safe-to-Spend;
- no rollover occurs automatically;
- an explicit do-not-carry decision is auditable.

An overassigned plan means current-period assignments exceed current-period
planned income. Positive rollover alone does not make the plan overassigned
because it is disclosed separately from current income.

### One owner-local month boundary

The owner explicitly confirms one valid IANA planning time zone. HC2, Overview,
and Spending use that same zone for month-based transaction reporting so “this
month” has one meaning. The implementation derives exact UTC query boundaries
from the local calendar period and tests daylight-saving transitions.

Each plan's time-zone snapshot is authoritative for that plan period. Overview
and Spending use the selected period's plan snapshot when a plan exists and the
current profile otherwise. Changing the profile never silently rewrites an
existing plan: a Draft may be migrated explicitly, while an Active or Closed
plan retains its snapshot and the preference applies to later plans.

Provider instants remain unchanged. Calendar `@db.Date` values remain civil
dates and are not shifted through time-zone conversion.

### A fixed obligation is one commitment

A fixed plan allocation references one Calendar occurrence. If it also
references an HC1 transaction-purpose category, that fixed amount contributes
to the category's planned total once. Its matched posted transaction contributes
to actual category spending once when its canonical role is category-bearing.

Bills, Calendar, Budget, and payment fulfillment are views or stages of one
lineage. They do not create separate deductions. An additional flexible amount
in the same category is a distinct, intentional allocation.

## Reuse boundary

HC2 reuses:

- `Transaction` as immutable source evidence;
- HC1 effective role, category, direction, eligibility, allocation, refund,
  reimbursement, and exclusion semantics;
- `TransactionCategory` as the stable identity for actual spending purposes;
- `RecurringStream`, `CalendarEvent`, and `CalendarOverride` as the only
  recurring income and obligation foundation;
- Calendar payment matching and paid/skipped/inactive behavior;
- exact Prisma `Decimal` arithmetic;
- current owner authentication, authorization, semantic theme, responsive
  shell, form, Notice, confirmation, and accessibility foundations.

HC2 does not add a `Bill` table, duplicate source transaction meaning, or copy
Calendar events into a second obligation system.

## Durable target model

Exact Prisma naming may follow repository conventions, but the following
semantics and constraints are required.

### OwnerPlanningProfile

- one row per owner;
- owner-confirmed IANA `planningTimeZone`;
- `planningCurrency`, constrained to USD for V1;
- effective period metadata for prospective preference changes;
- creation and update timestamps.

An absent profile produces a clear setup state. The browser may suggest a time
zone but cannot persist it without owner confirmation. HC3 owns planning-account
participation and account/household reserve floors; those fields are not added
by HC2.

### BudgetPlan

- owner;
- canonical period key in `YYYY-MM` form;
- planning time-zone snapshot;
- USD currency;
- lifecycle state: Draft, Active, or Closed;
- creation, activation/closure, and update timestamps;
- unique owner, period, and currency identity.

Only one plan exists for an owner/month/currency. Future plans may be Draft.
Closed plans reject ordinary edits. Period identity is a local-calendar key,
not a UTC timestamp pretending to be a month.

### BudgetIncomeItem

- owner and plan;
- source kind: Manual or Calendar occurrence;
- exact positive approved amount;
- owner-visible label;
- optional expected-income `CalendarEvent` reference;
- source amount/date/certainty snapshot required for Calendar-backed entries;
- order and timestamps.

The same Calendar occurrence can appear at most once in a plan. The referenced
event must belong to the owner, be USD, and be an expected-income occurrence.
Source drift is derived by comparing the approved snapshot with current
effective Calendar meaning.

### BudgetAllocation

- owner and plan;
- destination kind;
- policy;
- exact nonnegative current-period base amount;
- optional `TransactionCategory`, `CalendarEvent`, or supported debt `Account`
  reference according to destination kind;
- owner-visible label and stable display order;
- creation and update timestamps.

Destination kinds are:

- Category spending;
- Fixed obligation;
- Protected planning allocation;
- Planned saving;
- Extra debt principal.

Allowed combinations are enforced in the service and database:

- category spending requires an active owner expense category and uses a
  Flexible or Protected policy;
- fixed obligation requires one owner USD Calendar outflow occurrence and uses
  Fixed policy; an expense-category reference is optional;
- protected planning allocation is a household-plan destination, not an
  account reserve floor;
- planned saving has no target/date/progress model and is not funded saving;
- extra debt principal may optionally identify an existing owner debt account,
  but adds no contractual facts, payoff schedule, strategy, or recommendation.

One Calendar obligation occurrence can have at most one fixed allocation per
plan. `Intentionally unassigned` is derived and is not a mutable allocation row.

### BudgetReallocation

- owner and plan;
- source and destination flexible allocations from the same plan;
- exact positive amount;
- optional owner reason;
- immutable creation metadata.

A reallocation is balanced by construction: one row creates one equal outgoing
and incoming effect. It never moves bank money. It cannot be edited or deleted;
a correction uses an explicit reversing entry.

### BudgetRolloverDecision

- owner;
- adjacent source and destination plans;
- required source category allocation and optional destination category
  allocation;
- decision: Carry or Do not carry;
- prior remaining amount snapshot;
- signed opening balance applied to the destination when carried;
- decision timestamp and optional note.

Carry requires a destination allocation using the same stable transaction
category. Do not carry remains recordable even when the destination has no
allocation. A decision is idempotent and unique for its source allocation and
destination period. Replacing a decision requires an audited
reversal/replacement rather than destructive history loss.

## Exact calculations

All monetary operations use `Prisma.Decimal`.

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

Rollover is intentionally absent from planned income and
`current_period_assigned`. A negative `intentionally_unassigned` value is an
explicit overassigned state. A positive value is a valid intentional buffer;
zero supports optional zero-based planning.

### Pace and forecast

```text
pace_ratio = percent of category availability consumed
             / percent of local-calendar period elapsed

projected_spending = reviewed net spending / elapsed fraction
```

The service must handle zero availability, negative opening balances, refunds,
very early periods, missing activity, and incomplete classification without
division-driven nonsense. It preserves actual negative net spending after
refunds but does not extrapolate a misleading negative forecast. Insufficient
data produces an explicit unavailable/qualified state rather than false
precision.

Coverage uses the existing canonical HC1 interpretation and separately reports
unresolved count, unresolved magnitude, resolved percentage, currency, and the
effect on confidence. Amount may prioritize attention but does not itself make
resolved activity unresolved.

## Calendar reconciliation

HC2 queries effective Calendar occurrences for the selected local month. It
does not use raw event values when an owner override exists.

Plan rows retain an approved snapshot and stable source ID. Current Calendar
meaning remains authoritative for event presentation and fulfillment, while
the owner-approved plan amount remains authoritative for the plan until an
explicit reconciliation action. Paid, skipped, inactive, corrected, deleted,
or materially changed sources produce a visible reconciliation state.

An obligation's plan allocation, Calendar occurrence, and fulfilling
transaction retain enough identity to prove one planned commitment and one
actual effect. HC4 may later consume this lineage but HC2 does not implement a
general commitment ledger.

## Query and concurrency design

- Derive selected-period UTC boundaries once from the owner-local month.
- Query only the selected period plus explicitly bounded comparison data.
- Do not reuse current owner-history-wide Spending or Calendar loads for HC2.
- Bulk-load effective transactions, allocations, refund relationships,
  Calendar sources, reallocations, and rollover decisions.
- Avoid per-category, per-event, or per-transaction query loops.
- Index owner/period plan lookup, plan allocations, source Calendar IDs,
  category IDs, reallocation endpoints, and rollover source/destination.
- Use owner-scoped composite references where supported.
- Perform plan mutation, reallocation, rollover, activation, and closure under
  one owner/plan transaction with deterministic locking and retry behavior.

Concurrent edits must never create two active representations, partial
reallocations, duplicate event inclusion, or stale silent overwrites.

## Product surface

The provisional navigation label is **Budget & Plan** and the recommended route
is `/budget`. Existing Spending, Bills, and Calendar routes remain available.

The initial surface contains:

- local month selector and plan lifecycle state;
- planned income with Calendar suggestions and manual entry;
- current-period assigned and intentionally unassigned summary;
- category allocation scoreboard;
- fixed obligations with Calendar lineage and reconciliation state;
- protected planning, planned saving, and extra-principal destinations;
- spending, remaining, elapsed time, weekly pace, projected over/under, and
  coverage/confidence;
- transaction and assumption drill-down;
- explicit balanced reallocation;
- explicit prior-period rollover decisions.

Every state uses text, signs, icons, labels, and explanations in addition to
semantic color. Keyboard operation, visible focus, confirmation behavior,
Light/Dark/System rendering, long-text containment, and 375×812 usability are
required.

## Migration and compatibility

HC2 uses a new forward-only migration. It must not edit HC1 migrations, rewrite
provider/imported records, reset or seed owner data, or run a whole-history
backfill at startup.

Existing owners receive no guessed profile or plan. The owner configures the
planning time zone and creates a plan explicitly. Existing UTC reporting is
reconciled against owner-local boundaries before Overview and Spending cut
over. Every changed boundary result must be explained by the configured zone;
zero unexplained differences may remain.

Seed/demo additions, if needed, use stable synthetic identities and remain
idempotent across repeated runs.

## Explicitly deferred

HC2 does not implement:

- planning-account participation, roles, or routing;
- account or household reserve floors;
- planned transfers or account projections;
- funding status or gaps;
- pay-cycle projections;
- Safe-to-Spend or a commitment ledger;
- named goals, sinking funds, debt payoff modeling, or Debt Tracker UI;
- automatic rollover;
- arbitrary custom budget calendars;
- warning records, notifications, or household membership.

## Required verification

Implementation must cover exact reconciliation, owner scope, cross-owner
database rejection, current-account and USD planning eligibility, source
immutability, Calendar override precedence, source drift, fixed-obligation
deduplication, refund/split handling, rollover signs and non-funding language,
balanced reallocations, concurrency, local-month/DST boundaries, pace and
forecast qualification, query cardinality, migration replay, and repeated seed
idempotency.

Physical acceptance must exercise plan setup, income inclusion, category and
obligation allocation, source reconciliation, reallocation, rollover, drill-down,
Overview/Spending agreement, keyboard/focus behavior, responsive layout,
Light/Dark/System, and a clean browser console.
