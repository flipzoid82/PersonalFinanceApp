# Build Plan

## Governing forward roadmap

The Household Financial Control roadmap below governs future work after the Milestone 11 checkpoint/freeze. Milestones 1–10 remain completed historical foundations. Milestone 11 is stabilized, checkpointed, and frozen; retained, secondary, Settings-based, independent of Household Control milestones, and not a prerequisite for Household Control 1.

The product north star is:

> **What can we safely spend right now without creating a problem later?**

Safe-to-Spend V1 remains owner-only. Household sharing, external warnings, deeper goals, and automation follow only after the first useful household-control version is correct and explainable.

## Cross-milestone invariants

- Provider and imported source data remains immutable; local/effective meaning is stored separately.
- Owner corrections always take precedence.
- Financial calculations use exact Decimal arithmetic.
- Transfers and credit-card payments never duplicate spending.
- Pending and posted activity is reconciled without duplicate liquidity effects.
- Each commitment is subtracted at most once.
- Only opted-in checking/savings accounts contribute spendable cash.
- Investments, credit capacity, property, and debt capacity never increase Safe-to-Spend.
- Consolidated V1 planning uses USD and the owner's configured local planning time zone.
- Stale, materially incomplete, or unsupported inputs fail closed or visibly reduce confidence.
- Every financial state uses text, signs, icons, labels, or explanation in addition to semantic color.
- All owner reads and mutations remain server-authorized and owner-scoped.
- The app remains read-only with respect to real financial institutions.

## Historical foundation: Milestones 1–10

The implemented historical milestones remain preserved:

1. Project Foundation
2. Core Data Model
3. Demo Dashboard
4. Calendar and Recurring Events
5. Manual Assets and Investments
6. Plaid Sandbox
7. Recurring Detection
8. Session Security (Milestone 7.5)
9. Transactions and Overrides (Milestone 8)
10. Bills and Spending (Milestone 9)
11. Net Worth, Investments, and Theme Control (Milestone 10)

Their merged architecture documents remain historical records of implemented behavior and must not be rewritten to imply the pivot existed earlier.

## Milestone 11 checkpoint/freeze: Imports

Milestone 11 is **stabilized, checkpointed, and frozen**; retained, secondary, Settings-based, independent of Household Control milestones, and not a prerequisite for Household Control 1.

It remains retained, secondary to household financial control, located in Settings, independent of Household Control milestones, and bounded to its already approved document families and safety model.

Do not expand supported document families, add parser polish, or make import completion a dependency of Household Control 1. Investments, Net Worth, retirement tracking, and statement imports remain available but are no longer the product center.

## Pivot Preparation — Canonical Plan Reconciliation

### Outcome

Canonical Product Requirements, Financial Definitions, Build Plan, Overview direction, Calendar direction, and supporting planning documents describe one coherent owner-only household financial-control product.

### Scope

- approve and document the Safe-to-Spend north star;
- record the approved V1 decisions;
- reconcile transaction, budget, cash-flow, and planning definitions;
- replace the forward roadmap after the Milestone 11 freeze point;
- preserve historical architecture documents and existing features.

### Completion criteria

- Product Requirements, Financial Definitions, and Build Plan agree;
- the governing roadmap is explicit;
- Milestone 11 is clearly stabilized, checkpointed, frozen, and independent of Household Control work;
- no product implementation is performed in the reconciliation pass.

## Household Control 1 — Transaction Truth and Attention

### Outcome

Every reportable transaction has one auditable effective meaning, and ambiguous activity is easy to resolve.

### Scope

- canonical effective classification and provenance;
- classification confidence and coverage reporting;
- Transaction Inbox;
- deterministic classification rules;
- financial-role and category review;
- transfer and credit-card-payment pairing;
- refund/reimbursement linking;
- exact split transaction allocations;
- one shared effective classification service for Transactions, Overview, Spending, recurrence, and later budgets;
- owner corrections that always win without mutating provider data.

### Approved behavior

- high-confidence deterministic classification may enter live totals automatically;
- low-confidence, conflicting, ambiguous, high-impact, or structurally uncertain activity enters the Inbox;
- materially unresolved coverage is visible and lowers confidence;
- minor unresolved coverage may coexist with qualified useful planning information;
- linked refunds/reimbursements reduce the relevant allocation when they post and are not ordinary income by default.

### Completion criteria

- all included posted activity has a reviewed or high-confidence effective role;
- every unresolved item has a visible reason;
- split allocations reconcile exactly to the transaction magnitude;
- movement pairs do not change household income/spending;
- pending-to-posted replacement does not duplicate classification or liquidity effects;
- sync and classification reruns are idempotent;
- owner-scoping, provenance, override precedence, and Decimal behavior have PostgreSQL coverage;
- shared calculations no longer depend on a recurrence-only classification path.

### Explicitly deferred

- budgets;
- account projections;
- Safe-to-Spend;
- ML/AI classification;
- multi-user household accounts.

## Household Control 2 — Budget Plan and Live Scoreboard

### Outcome

The owner can see what was spent, what remains, and whether spending pace is safe.

### Scope

- stable household budget categories;
- monthly allocations in the owner's planning time zone;
- fixed, flexible, and protected policies;
- exact transaction allocations and splits;
- explicit auditable reallocations;
- category spending and remaining amount;
- weekly pace derived from the monthly plan;
- projected end-of-period spending and over/under amount;
- classification coverage, confidence, explanation, and transaction drill-down;
- explicit initial rollover decisions.

### Completion criteria

- category totals reconcile exactly to classified transaction allocations;
- refunds/reimbursements and exclusions follow canonical definitions;
- spending pace handles partial periods and incomplete coverage conservatively;
- reallocation is balanced and auditable;
- every number drills down to its transactions and assumptions;
- no budget state relies on color alone.

### Explicitly deferred

- automatic rollover;
- arbitrary custom budget calendars;
- sinking funds;
- external notifications.

## Household Control 3 — Routed Calendar and Account Projections

### Outcome

The owner knows which account receives income, which account pays each obligation, and whether that account will have enough money.

### Scope

- planning-account participation and roles;
- per-account reserve floors and optional household reserve floor;
- income destination routing;
- bill/obligation payment routing;
- planned transfer source, destination, amount, and date;
- per-account dated projection ledger;
- Funded, Expected to be funded by income, Transfer required, At risk, Unfunded, and Uncertain states;
- pay-cycle boundaries derived from expected income;
- freshness, confidence, and projection lineage.

### Approved behavior

- fresh authoritative available balance is used when appropriate;
- otherwise current balance is reduced by unreconciled pending outflows;
- a pending outflow is never subtracted twice;
- pending income does not increase current Safe-to-Spend;
- separately modeled expected income may enter a future dated projection according to confidence/commitment policy;
- transfers are recommendations plus owner acknowledgment only.

### Completion criteria

- every projected balance change has a source and certainty label;
- internal transfers affect both accounts but not household spending;
- card payments affect cash routing but do not duplicate purchase spending;
- account-specific shortfalls remain visible even if household cash is positive;
- stale or incomplete critical inputs produce Uncertain rather than a precise funded result;
- exact Decimal projection and owner-scoping have PostgreSQL coverage.

### Explicitly deferred

- bank-initiated transfers;
- automated bill payment;
- stochastic long-range forecasting.

## Household Control 4 — Explainable Safe to Spend

### Outcome

The app answers what can safely be spent before the next relevant income event and exactly why.

### Scope

- commitment ledger;
- commitment deduplication;
- household and account-level Safe-to-Spend;
- next-relevant-income horizon;
- proposed-purchase check;
- funding-action summary;
- balance, pending, income, obligation, transfer, reserve, and budget lineage;
- classification coverage, freshness, and confidence;
- Home/Today primary experience.

### Completion criteria

- only opted-in USD checking/savings accounts enter the consolidated number;
- every included amount is visible and attributable;
- no economic commitment is subtracted twice;
- per-account funding gaps cannot be hidden by unrelated household wealth;
- materially unresolved, stale, or unsupported critical inputs fail closed;
- immaterial unresolved activity is quantified and clearly qualifies the result;
- the owner can reproduce the number from its explanation;
- Home, Transactions, Plan, and Accounts answer all ten first-use questions.

This milestone completes the **first useful household-control version**.

## Household Control 5 — Early Warnings and Digest

### Scope

- warning records and lifecycle;
- informational, watch, warning, and critical severity;
- deduplication, acknowledgment, and quieting;
- spending-pace warnings;
- reserve and funding-gap warnings;
- stale-data warnings;
- weekly household summary;
- external delivery only after scheduler, privacy, and security design.

## Household Control 6 — Household Coordination

### Scope

- household/member model;
- roles and granular permissions;
- shared category allowances;
- selected warning routing;
- privacy-safe summaries;
- transaction attribution where appropriate.

## Household Control 7 — Irregular Expenses, Goals, and Debt Tradeoffs

### Scope

- sinking funds;
- annual and irregular obligations;
- reserve progress;
- unused-budget surplus allocation;
- debt and savings goals;
- explicit scenario tradeoffs.

## Future information architecture

Documented direction, not current implementation:

1. Home
2. Transactions — Inbox + ledger
3. Plan — budgets + bills + Calendar + cash-flow projections
4. Accounts
5. Wealth — Investments + Net Worth
6. Settings — connections + imports + preferences

Existing routes and features remain until a separately approved implementation changes them.

## Superseded legacy forward milestones

The former forward plan placed a broad UX/UI audit and production-readiness milestone after Milestone 11. Those concerns are not discarded, but their old sequence no longer governs product development:

- route-specific usability, terminology, responsive, accessibility, and theme quality are completion requirements of each Household Control milestone rather than a separate product-direction milestone;
- production security, backup, observability, rate limiting, durable scheduling, provider production approval, and final accessibility review remain required before deployment and are retained under Later production and quality work.

This preserves the historical intent without allowing the legacy wealth-centered roadmap to supersede Household Control 1–7.

## Later production and quality work

Production readiness remains required before real-world deployment, including security review, backup and recovery, observability, error tracking, rate limiting, durable scheduling, Plaid Production Trial, accessibility/contrast review, privacy-safe notification delivery, and operational validation of retention and warning jobs.
