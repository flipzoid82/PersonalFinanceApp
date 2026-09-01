# Build Plan

## Governing forward roadmap

The Household Financial Control roadmap below governs future work after the Milestone 11 checkpoint/freeze. Milestones 1–10 remain completed historical foundations. Milestone 11 is stabilized, checkpointed, and frozen; retained, secondary, Settings-based, independent of Household Control milestones, and not a prerequisite for Household Control 1.

The product north star is:

> **What can we safely spend right now without creating a problem later?**

Safe-to-Spend V1 remains owner-only. Goals and debt tradeoffs, warnings, household sharing, and automation follow only in their approved sequence after the first useful household-control version is correct and explainable.

## Cross-milestone invariants

- Provider and imported source data remains immutable; local/effective meaning is stored separately.
- Owner corrections always take precedence.
- Financial calculations use exact Decimal arithmetic.
- Transfers and credit-card payments never duplicate spending.
- Pending and posted activity is reconciled without duplicate liquidity effects.
- Each commitment is subtracted at most once.
- Planned income is distinct from current liquidity, and planned saving is distinct from funded saving.
- HC1 transaction-purpose categories are distinct from HC2 planning destinations.
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

Every financially relevant transaction can resolve to one auditable effective interpretation, and ambiguous activity is easy to resolve.

### Scope

- explicit classification, finalized-reporting, Inbox, recurrence, relationship, allocation, and later-planning eligibility predicates;
- stable owner-scoped expense and income `TransactionCategory` identity;
- canonical source-aware economic direction: inflow, outflow, or unknown;
- canonical effective classification, deterministic certainty, and provenance;
- Transaction Inbox;
- deterministic classification rules;
- financial-role and category review;
- suggestion-first transfer and credit-card-payment pairing;
- typed transfer, credit-card-payment, refund, and reimbursement relationships;
- exact split transaction allocations;
- pending-to-posted owner-state continuity;
- compatibility inventory and deterministic migration for legacy `TransactionOverride.linkedTransactionId` values;
- one shared effective resolver and allocation abstraction for Transactions, Overview, Spending, recurrence, Calendar matching, and later budgets;
- owner corrections that always win without mutating provider data.

### Approved behavior

- explicit owner decisions, owner-confirmed rules, and unambiguous versioned system mappings may enter live totals automatically;
- provider-only, conflicting, ambiguous, unsupported, or structurally uncertain activity enters the Inbox;
- amount may prioritize attention but does not alone block reporting;
- newly created owner rules apply prospectively by default; historical owner-rule application requires preview and confirmation;
- controlled deterministic system backfill may classify historical activity without overwriting owner decisions;
- transfer and card-payment heuristics suggest pairs but do not auto-confirm them;
- materially unresolved coverage is visible and lowers confidence;
- minor unresolved coverage may coexist with qualified useful planning information;
- linked refunds/reimbursements reduce the relevant allocation when they post and are not ordinary income by default.

### Completion criteria

- all included posted activity has a reviewed or deterministically resolved effective role;
- every unresolved item has a visible reason;
- category-bearing activity resolves through stable transaction-purpose identity;
- source-aware direction is deterministic, versioned, auditable, efficiently queryable, and owner-overridable;
- split allocations reconcile exactly to the transaction magnitude;
- confirmed movement pairs do not change household income/spending;
- pending-to-posted replacement preserves nonconflicting owner state and does not duplicate classification, Inbox, Calendar, recurrence, or liquidity effects;
- sync and classification reruns are idempotent;
- starter-category bootstrap is idempotent and preserves owner rename, deactivation, and ordering choices;
- every legacy untyped transaction link is inventoried, safely converted or retained for explicit review, and never discarded merely because typed relationships exist;
- old/new reporting reconciliation has zero unexplained differences in totals, inclusion, classification, allocation, or relationship results before atomic owner-level cutover;
- bulk resolver paths avoid per-transaction query loops;
- owner-scoping, provenance, override precedence, and Decimal behavior have PostgreSQL coverage;
- shared calculations no longer depend on a recurrence-only classification path.

### Explicitly deferred

- budgets;
- account projections;
- Safe-to-Spend;
- ML/AI classification;
- multi-user household accounts.

## Household Control 2 — Budget & Income Plan

### Outcome

The owner can plan what expected income needs to accomplish, see what remains intentionally unassigned, and understand live spending progress without treating expected money as current liquidity.

### Scope

- planned and expected income for the planning period;
- monthly spending allocations that reference stable HC1 transaction-purpose categories;
- fixed obligations reconciled with existing Bills behavior, recurring streams, and Calendar occurrences rather than duplicated as a second obligation truth source;
- protected reserves;
- generic planned saving;
- generic owner-entered extra debt-principal allocation;
- intentionally unassigned income and optional zero-based budgeting;
- fixed, flexible, and protected policies;
- explicit auditable reallocations;
- category spending and remaining amount;
- weekly pace derived from the monthly plan;
- projected end-of-period spending and over/under amount;
- classification coverage, confidence, explanation, and transaction drill-down;
- explicit initial rollover decisions.

### Completion criteria

- planned income, assigned amounts, protected amounts, planned saving, planned extra debt reduction, and unassigned income reconcile exactly;
- expected or pending income does not become current available liquidity;
- planned saving is not presented as funded without approved evidence;
- one existing obligation reduces capacity at most once across Bills, recurrence, Calendar, and the plan;
- category totals reconcile exactly to classified transaction allocations;
- refunds/reimbursements and exclusions follow canonical definitions;
- spending pace handles partial periods and incomplete coverage conservatively;
- reallocation is balanced and auditable;
- every number drills down to its transactions and assumptions;
- no budget state relies on color alone.

### Explicitly deferred

- automatic rollover;
- arbitrary custom budget calendars;
- named savings goals and sinking funds;
- payoff schedules, snowball/avalanche analysis, interest-savings optimization, and debt-versus-saving recommendations;
- external notifications.

## Household Control 3 — Routed Cash Flow

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
- Home, Transactions, Budget & Plan, and Accounts answer all ten first-use questions.

This milestone completes the **first useful household-control version**.

## Household Control 5 — Goals, Irregular Expenses & Debt Tradeoffs

### Scope

- dedicated Debt Tracker experience for supported credit cards and loans, including source-qualified current balance, known contractual information, freshness, and balance/paydown progress where sufficient authoritative or historical data exists, with links into payoff planning;
- named savings and debt goals;
- target amount and date;
- required contribution calculations;
- progress and funding evidence;
- feasibility and explicit scenario comparisons;
- sinking funds and irregular expenses;
- debt payoff projections;
- debt-versus-saving tradeoffs;
- source-qualified debt balances and contractual facts;
- no invented APR, minimum payment, original principal, due date, maturity, payoff term, or statement balance.

Current Accounts and Net Worth may continue showing supported debt balances. If source or historical evidence is insufficient to calculate paydown progress reliably, HC5 shows the available balance/history without fabricating progress or contractual facts.

## Household Control 6 — Warnings & Digest

### Scope

- warning records and lifecycle;
- informational, watch, warning, and critical severity;
- deduplication, acknowledgment, and quieting;
- spending-pace warnings;
- reserve and funding-gap warnings;
- stale-data warnings;
- weekly household summary;
- external delivery only after scheduler, privacy, and security design.

## Household Control 7 — Household Coordination

### Scope

- household/member model;
- roles and granular permissions;
- shared category allowances;
- selected warning routing;
- privacy-safe summaries;
- transaction attribution where appropriate.

## Future information architecture

Documented direction, not current implementation:

1. Home
2. Transactions — Inbox + ledger
3. Budget & Plan — provisional label for budgets + bills + Calendar + cash-flow projections + goals
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
