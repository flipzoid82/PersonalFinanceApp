# Household Financial Control Pivot Assessment

**Status:** Planning and architecture assessment only
**Date:** 2026-08-30
**North star:** **What can we safely spend right now without creating a problem later?**

## 1. Executive recommendation

Pivot the product now from a broad personal-finance dashboard toward a household financial control system, but do not begin with a safe-to-spend number. The current application has strong foundations for connected accounts, auditable provider data, transaction correction, recurring detection, bills, and Calendar projections. It does not yet have several facts that a trustworthy safe-to-spend calculation requires: canonical effective transaction roles for all synced activity, transfer and credit-card-payment pairing, split transactions, budgets, protected reserves, income-to-account routing, account-level projected balances, and an explainable commitment ledger.

The safest sequence is:

1. establish transaction truth and a lightweight Transaction Inbox;
2. add a deliberately small budget model and live spending scoreboard;
3. extend existing recurring and Calendar data into account-specific cash-flow projections and funding gaps;
4. calculate explainable safe-to-spend from those reviewed inputs;
5. add proactive warnings, household coordination, and longer-range planning only after the core number is trustworthy.

The first new milestone should therefore be **Household Control 1 — Transaction Truth and Attention**, not a dashboard redesign and not safe-to-spend itself. This milestone closes the largest correctness gap: Plaid transactions currently preserve provider categories but do not receive a persisted canonical financial role unless the owner creates a local override. Overview and Spending finalized totals deliberately count only explicit effective roles. That conservative behavior is safe today, but it means current totals cannot yet serve as the basis for budgets or cash availability.

For the uncommitted Milestone 11 work, choose **B — stabilize as an explicit freeze point, then pause it**. Milestone 11 is substantially implemented and contains valuable owner-scoped provenance, idempotency, Undo, encrypted temporary retention, and account-matching work. Completing more document-family polish would follow the old product priority, while reverting everything would discard mature, isolated capability. A separately reviewed checkpoint preserves the work without making imports a prerequisite or a primary navigation concept. This assessment does not authorize or perform that checkpoint.

The existing canonical Product Requirements still define a single-user MVP and explicitly defer household sharing and advanced forecasting. The new owner requirements are an intentional product-direction change, not something implementation should quietly reconcile. Before pivot implementation begins, the owner should approve a future revision of the canonical Product Requirements and Build Plan. This document does not modify either source.

## 2. Sources and implementation inspected

### Owner direction

- `C:\Users\flipz\Downloads\household_financial_awareness_product_requirements.md` — read completely, including all 839 lines.
- The attached pivot request defining this assessment, required questions, and non-implementation boundary.

### Canonical planning and architecture

- `docs/Plan Docs/build-plan.md`
- `docs/Plan Docs/product-requirements.md`
- `docs/Plan Docs/financial-definitions.md`
- `docs/Plan Docs/data-model.md`
- `docs/Plan Docs/overview-dashboard-spec.md`
- `docs/Plan Docs/calendar-spec.md`
- `docs/Plan Docs/plaid-integration.md`
- `docs/Plan Docs/milestone-11-codex-prompt.md` — current scope and decision headings were inspected only to assess the active work; no older milestone prompt was loaded.
- `docs/architecture-milestone-6.md`
- `docs/architecture-milestone-7.md`
- `docs/architecture-milestone-7-5.md`
- `docs/architecture-milestone-8.md`
- `docs/architecture-milestone-10.md`
- `docs/architecture-milestone-11.md`

### Current schema, routes, services, UI, and tests

- `prisma/schema.prisma` and the model/enumeration relationships for users, sessions, data sources, Plaid Items, accounts, transactions, overrides, recurrence, Calendar, portfolios, and imports.
- Current protected routes: Overview, Accounts, Transactions, Bills, Calendar, Spending, Investments, Net Worth, Settings, and Settings → Data & imports.
- `src/components/navigation.tsx` and the dashboard route pages.
- Current-account eligibility: `src/lib/accounts/current.ts`.
- Plaid normalization, synchronization, replacement-Item identity, repair, disconnect history, and tests under `src/lib/plaid/`.
- Effective transaction values, URL-backed ledger queries, correction mutations, presentation, detail/ledger/search components, and tests under `src/lib/transactions/` and `src/components/transactions/`.
- Overview calculations/queries/components/tests under `src/lib/dashboard/` and `src/components/dashboard/`.
- Recurrence normalization, detection, persistence, confidence, matching triggers, and tests under `src/lib/recurring/`.
- Calendar precedence, status derivation, matching, queries, mutations, views, and tests under `src/lib/calendar/` and `src/components/calendar/`.
- Bills projections under `src/lib/bills/` and `src/components/bills/`.
- Spending calculations, queries, views, and tests under `src/lib/spending/` and `src/components/spending/`.
- Current portfolio/net-worth services and tests under `src/lib/portfolio/`.
- The uncommitted Milestone 11 import pipeline, UI, retention, OCR, parsing, storage, provenance, and tests under `src/lib/imports/`, `src/components/imports/`, `src/actions/imports.ts`, and Settings imports routes.
- Existing test inventory covering authentication, owner scoping, Plaid sync and reconciliation, recurrence, Calendar, transaction overrides, Overview, Bills, Spending, portfolio, theme/accessibility, and imports.

## 3. Current capability map

The labels below mean:

- **Strong:** implemented with appropriate ownership, persistence, and regression coverage.
- **Partial:** useful implementation exists, but it is not sufficient for the new product outcome.
- **Missing:** no durable product model or service currently supplies the capability.

| Capability                   | State                                        | Reusable implementation                                                                                                           | Gap relative to the north star                                                                                                                                                                      |
| ---------------------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Connected financial accounts | **Strong**                                   | `InstitutionConnection`, `Account`, `ProviderAccountLink`; Plaid Link/sync/repair/disconnect; `currentAccountWhere`               | Sandbox-only until production readiness. No notion of a cash-planning account role such as operating, reserve, or bill-pay account.                                                                 |
| Plaid transaction ingestion  | **Strong**                                   | `plaidTransactionData`, cursor-based atomic sync, pending-to-posted reconciliation, removals, provider IDs, owner scope           | Ingestion preserves source facts but does not persist a canonical inferred financial role.                                                                                                          |
| Transaction normalization    | **Partial**                                  | Provider-neutral `Transaction`, provider category/merchant, source preservation, `effectiveTransactionValues`                     | Amount-sign conventions differ by source; direction is intentionally not inferred from sign. There is no single reviewed classification record separate from a local override.                      |
| Financial roles              | **Partial / critical**                       | `FinancialRole` enum; `TransactionOverride.financialRoleOverride`; conservative recurring-only provider mapping                   | Overview and Spending count only an explicit effective role. Plaid sync does not create one. The enum also lacks a first-class reimbursement distinction and role confidence/evidence.              |
| Transfers                    | **Partial**                                  | `TRANSFER` role; excluded from income/spending; recurring transfer streams supported                                              | No debit/credit pair matching, no household-internal account topology, no unmatched-transfer review, and no planned transfer model.                                                                 |
| Credit-card payments         | **Partial**                                  | `CREDIT_CARD_PAYMENT` role; excluded from spending; recurring event type                                                          | No linkage of checking outflow to card inflow, statement balance/due amount, planned payment, or coverage calculation.                                                                              |
| Refunds/reimbursements       | **Partial**                                  | `REFUND` reduces spending; `TransactionOverride.linkedTransactionId` exists                                                       | No owner-facing linking workflow, no distinction between refund and reimbursement, no allocation across split categories, and no confidence/evidence.                                               |
| Merchant/category data       | **Partial-to-strong**                        | Provider values preserved; local merchant/category precedence; consumer formatter; search/filter/detail                           | Categories are free-form strings. There is no managed household category identity, rule table, classification confidence, or correction-learning model.                                             |
| Transaction correction       | **Strong foundation**                        | Owner-scoped override form for category, role, note, report exclusion; provider immutability; downstream revalidation             | Corrections are one transaction at a time. No reusable merchant/description rule and no Inbox workflow.                                                                                             |
| Split transactions           | **Missing**                                  | None                                                                                                                              | One transaction cannot allocate exact amounts across multiple categories. This blocks accurate mixed-merchant budgets.                                                                              |
| Recurring detection          | **Strong**                                   | Deterministic grouping, supported frequencies, Decimal median/deviation, confidence/evidence, owner locks, idempotent projections | Conservative by design; no owner review queue dedicated to candidate streams and no irregular/semiannual inference. This is acceptable for a first cash-flow version if confidence remains visible. |
| Bills and expected income    | **Strong foundation**                        | `RecurringStream`, `CalendarEvent`, overrides, Bills view, expected-income separation                                             | Events have one typical/account link, but income destination and obligation payment routing are not modeled as financial responsibilities.                                                          |
| Calendar                     | **Strong foundation**                        | Confirmed/predicted precedence, amount/date sources, status, paid matching, manual events, accessible views                       | Calendar shows events but does not carry forward per-account balances, funding state, budget/pay-cycle boundaries, or transfer plans.                                                               |
| Account routing              | **Partial**                                  | `RecurringStream.typicalAccountId`, `CalendarEvent.accountId`, account names on events                                            | One nullable account reference is insufficient to express “income lands here,” “bill pays there,” or “transfer from A to B before date.”                                                            |
| Budgets                      | **Missing**                                  | Spending categories and current/prior monthly aggregation only                                                                    | No budget plan, allocation, period, rollover, protection, reallocation, commitment, or status.                                                                                                      |
| Budget periods/pay cycles    | **Missing**                                  | UTC month helpers; recurring income dates can become inputs                                                                       | Current reporting is calendar-month-only. No owner time zone, pay-cycle boundary, weekly allowance, or custom period.                                                                               |
| Projected account balances   | **Missing**                                  | Current/available balance and future Calendar events are separately present                                                       | No projection ledger combines starting balance, pending activity, income, bills, and planned transfers by account/date.                                                                             |
| Bill funding/coverage gaps   | **Missing**                                  | Bills know expected amount/date/account; accounts know balances                                                                   | No funding state, reserve floor, “next income” horizon, or gap calculation.                                                                                                                         |
| Recommended transfers        | **Missing**                                  | Recurring transfers can be detected historically                                                                                  | No planned transfer entity, source/destination pair, recommendation, or acknowledgment. The app must remain read-only at institutions.                                                              |
| Safe-to-spend                | **Missing**                                  | Some inputs exist separately: cash/available cash, upcoming events, spending totals                                               | No commitments/reserves/budgets/projections. A current implementation would be misleading.                                                                                                          |
| Spending velocity/forecast   | **Missing**                                  | Spending month comparison, merchant/category totals, largest and unusual purchases                                                | Unusual purchase detection is historical. There is no budget denominator, elapsed-period comparison, pace forecast, or overage projection.                                                          |
| Warnings                     | **Missing product capability**               | Shared semantic `Notice`, status badges, stale/partial/error states                                                               | No financial warning engine, lifecycle, deduplication, acknowledgment, severity policy, delivery channel, or alert-fatigue controls.                                                                |
| Transaction Inbox            | **Missing**                                  | Ledger filters/detail/correction form are reusable                                                                                | No queue/reason/confidence/review-state model or fast batch interaction.                                                                                                                            |
| Sinking funds                | **Missing**                                  | Manual assets and Calendar manual future events exist separately                                                                  | No reserved amount, target, contribution schedule, or safe-to-spend exclusion.                                                                                                                      |
| Goals/debt planning          | **Missing**                                  | Debt accounts/net-worth/investment views                                                                                          | No payoff goals, extra-payment plans, or connection between category surplus and goals.                                                                                                             |
| Household sharing            | **Missing and canonically deferred**         | Owner-only authentication is intentionally strong                                                                                 | No household, membership, role, invitation, attribution, permission, or notification routing model.                                                                                                 |
| Weekly digest                | **Missing**                                  | Existing view models could provide future inputs                                                                                  | No scheduler/content snapshot/delivery preference.                                                                                                                                                  |
| Freshness                    | **Strong foundation**                        | Data-source, connection, account and view freshness; stale/partial text states                                                    | Safe-to-spend needs freshness policy by input and should fail closed or widen uncertainty when critical accounts are stale.                                                                         |
| Confidence                   | **Strong for recurrence; partial elsewhere** | Recurrence confidence/evidence; provider category confidence stored                                                               | Provider confidence is not integrated into a transaction review decision. Budgets/projections/safe-to-spend have no confidence model.                                                               |
| Explainability               | **Partial**                                  | Recurring detection metadata, predicted/confirmed labels, source/effective transaction detail, import evidence                    | No unified calculation lineage that explains each safe-to-spend subtraction, funding warning, or pace forecast.                                                                                     |

### Important implementation reality

The current transaction path deliberately separates source data from owner changes:

1. Plaid sync writes merchant, category, amount, dates, status, and audit payload.
2. `effectiveTransactionValues` applies a local override when present.
3. `financialRole` is `financialRoleOverride ?? null`.
4. Overview and Spending ignore rows without an effective role.
5. Recurring detection has its own conservative provider-category-to-role inference, used only for detection.

This prevents unreviewed provider guesses from silently entering finalized reports, but it also creates two interpretations of the same transaction. The pivot must resolve that duplication through one canonical, auditable classification service before budgets or safe-to-spend depend on the data.

## 4. Semantic gaps and owner decisions they create

### Spending and income

The canonical definitions are sound: posted `EXPENSE` is spending, posted `INCOME` is income, `REFUND` reduces spending, and pending items are excluded from finalized totals. The gap is classification coverage, not the arithmetic. A new classification result must preserve provider data and should have provenance, confidence, reason, review state, and an optional owner correction. It should not overload the word “override” to mean both an automated result and an owner choice.

**Approved decision:** high-confidence deterministic classification may enter live totals with visible provenance. Low-confidence, conflicting, ambiguous, high-impact, or structurally uncertain cases enter the Inbox, and an owner correction always wins. Exact confidence thresholds remain for Household Control 1.

### Transfers and credit-card payments

Roles prevent obvious report double counting only when the roles are correct. The current model does not link the two legs of a household transfer or card payment. Cash-flow projections require both legs because the source account falls and the destination account rises, while household spending remains unchanged.

The first model should support a transfer pair with confidence and owner confirmation. A card purchase is the budget expense; the later card payment is a cash obligation and balance-sheet transfer, not a second expense. Interest and fees remain expenses.

**Decision needed:** whether the app may auto-pair exact high-confidence internal transfers. Recommendation: propose pairs automatically, auto-accept only exact account/date/amount matches with undoable review history, and route all ambiguous pairs to the Inbox.

### Refunds and reimbursements

The existing linked-transaction field is useful but unused by UI. A refund should ordinarily reduce the original category within a stated budget policy. A reimbursement may either reduce the reimbursed category or be shown separately depending on household intent.

**Approved decision:** V1 is cash-based. Linked refunds/reimbursements offset the relevant original allocations when they post, do not become ordinary income by default, and do not automatically rewrite closed periods.

### Pending activity

Pending transactions are correctly excluded from finalized monthly totals. Safe-to-spend cannot ignore them. Known pending expenses should reduce near-term available cash once, but must reconcile to the posted replacement without double subtraction. Pending income should not increase safe-to-spend by default because it is not settled.

**Approved decision:** use a fresh authoritative available balance when appropriate; otherwise subtract unreconciled pending outflows from current balance exactly once. Pending income does not increase current Safe-to-Spend. Separately modeled expected income may enter a future dated projection according to its confidence policy.

### Recurrence and Calendar certainty

The recurrence engine and confirmed/predicted distinction are unusually strong foundations. The missing semantic is financial commitment. A predicted subscription is not the same certainty as a confirmed mortgage, and neither is the same as an owner-created planned purchase. Projection inputs need certainty, inclusion policy, and the ability to explain why an event was reserved.

Recommendation: confirmed obligations always enter commitments; high/medium predicted obligations enter with an “estimated” label and configurable conservative amount; low/needs-confirmation events do not silently reduce safe-to-spend.

### Balances and eligible cash

The app already distinguishes current and available balances and excludes inactive/disconnected/unavailable accounts. Safe-to-spend also needs liquidity and purpose. Credit, investments, property, and debt capacity are not available cash. Some savings may be protected or intentionally excluded. Available balances may already include pending bank authorizations, creating double-subtraction risk if pending transactions are also deducted.

**Approved decision:** V1 uses owner-selected checking/savings accounts. For each account, use authoritative available balance when fresh and appropriate; otherwise use current balance minus unreconciled pending outflows, never both. Show the exact starting source and freshness.

### Committed cash and reserves

Neither concept exists. “Committed” must be an explainable set of future obligations and budget allocations, not one stored mutable total. A reserve is an owner policy, preferably per account with an optional household floor. The projection should reveal overlap rather than subtracting the same obligation through both a bill commitment and a category commitment.

Recommendation: define commitment sources explicitly and calculate them from immutable/reviewed inputs. Do not introduce a generic “spoken-for balance” field that can drift.

### Budgets and double counting

A monthly category limit can overlap upcoming recurring bills. If the system subtracts an entire remaining category budget and also subtracts an upcoming bill already included in that budget, safe-to-spend double counts. The model must distinguish:

- fixed obligations reserved as specific dated events;
- flexible category allowances remaining for discretionary use;
- protected reserves that are not spending allocations;
- transactions already posted or pending;
- planned transfers, which move cash but are not household consumption.

The projection should subtract each economic commitment once and retain a lineage key showing its source.

### Corrections, learning, and splits

Local correction precedence is established and should remain. The next layer needs a separate reusable classification rule with bounded scope: exact normalized merchant, description pattern, or one-time only. Split allocations must sum exactly to the transaction magnitude in the transaction currency. Refund splits must reference or recreate the relevant allocations conservatively.

Recommendation: do not build an opaque learning model. Start with deterministic rules generated only after an explicit owner choice such as “apply to similar future transactions.”

### Periods, time zones, and pay cycles

Current monthly logic uses UTC. Household planning is date-sensitive, and pay-cycle boundaries are local-calendar concepts. The product needs an owner time zone before authoritative daily pacing, due-date boundaries, or “until Friday” language.

**Approved decision:** use the owner's configured local planning time zone while keeping stored event dates/provider instants unchanged. Support monthly budgets first and a pay-cycle projection lens derived from recurring income. Defer arbitrary custom budget periods.

### Currency

The current product stores currency but has no exchange-rate engine. Adding multiple currencies to a single safe-to-spend number would be false precision.

**Approved decision:** consolidated V1 planning uses USD. Non-USD accounts/transactions remain visible but are excluded from the consolidated result and clearly identified.

## 5. Safe-to-spend dependency graph

```text
Current connected-account eligibility and freshness
                │
                ├──> Reliable starting liquid balance by account
                │
Plaid transactions ──> Canonical effective role/direction/classification
                │                    │
                │                    ├──> Transfer/card-payment pairing
                │                    ├──> Refund linkage
                │                    ├──> Split allocations
                │                    └──> Transaction Inbox/review
                │
Recurring detection + owner-confirmed Calendar events
                │
                └──> Income destination + bill payment-account routing
                                     │
Budget plan + category allocations ──┤
Protected reserve policies ──────────┤
Pending-transaction policy ──────────┤
Planned transfers ───────────────────┤
                                     v
                      Per-account projection ledger
                                     │
                         Funding gaps / transfer needs
                                     │
                                     v
                 Explainable safe-to-spend for a horizon
                                     │
                    Pace forecast and proactive warnings
```

### Hard prerequisites

These must be correct before displaying a household safe-to-spend number:

1. current connected-account eligibility and freshness;
2. owner-selected liquid accounts and reserve floors;
3. canonical effective role/direction for every included transaction;
4. pending-to-posted reconciliation without duplicate reservation;
5. transfer and credit-card-payment treatment;
6. split allocations for mixed purchases;
7. budget allocations with an explicit period and remaining amount;
8. upcoming obligation and income routing to accounts;
9. per-account dated projection with exact Decimal arithmetic;
10. commitment deduplication and calculation lineage;
11. a fail-closed policy for stale, incomplete, ambiguous, or unsupported-currency inputs.

### Useful enhancements, but not blockers for V1

- deterministic merchant/description rules learned from explicit corrections;
- medium-confidence recurring candidate review;
- flexible reserve suggestions;
- a weekly allowance derived from a monthly budget;
- a recommendation for which account should fund a gap;
- scenario comparison for a proposed purchase;
- unusual-spend context in the Inbox.

### Later sophistication

- probabilistic forecasting and seasonal models;
- authorized money movement or bill payment;
- multi-currency conversion;
- household membership and field-level permissions;
- push/email delivery and weekly digest;
- sinking funds, goal optimization, and debt-payoff strategies;
- custom budget calendars and advanced rollover policies;
- intelligent recommendations beyond transparent deterministic rules.

### Defensible V1 formula

The first safe-to-spend output should be a dated, explainable minimum across included liquid accounts, not simply total cash minus a few global numbers:

```text
starting spendable balance by account
− unreconciled pending outflows not already reflected in available balance
+ confirmed/eligible expected income before the horizon
− dated obligations before the horizon
± planned internal transfers by account
− protected reserve floor
− remaining flexible budget commitments for the horizon
= projected discretionary capacity
```

The household number is the sum of non-negative discretionary capacity that is actually movable/usable under the owner’s routing policy. If a required payment account falls below its floor, the product should report a funding gap even when another account makes the global sum positive. The output must list every included account, balance source, event, reserve, budget commitment, transfer, freshness timestamp, and assumption.

## 6. Product simplification and navigation assessment

The current nine-item navigation mirrors implementation milestones and separates reports that the new household-control workflow needs to combine mentally. No route should be removed during the pivot; simplify presentation only after the new information architecture is approved.

| Current surface    | Pivot assessment                                                                       | Recommended destination                                                                                                                                                                             |
| ------------------ | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Overview           | Best candidate for the control center, but currently retrospective and portfolio-heavy | Rename conceptually to **Home** or **Today**. Lead with safe-to-spend only when ready, then actions needed, upcoming cash flow, budget health, and freshness. Keep net worth/investments secondary. |
| Transactions       | Strong ledger and correction detail                                                    | Keep as a primary surface. Add an Inbox mode/count and fast review; preserve the full ledger as history.                                                                                            |
| Spending           | Historical analytics with no budgets                                                   | Combine into a **Plan** or **Budget & bills** workspace as the live category scoreboard. Retain deeper spending analysis as a secondary tab.                                                        |
| Bills              | Useful upcoming outflow/income list                                                    | Combine with Calendar and funding status inside the Plan workspace; do not maintain a separate top-level mental model for the same events.                                                          |
| Calendar           | Strong date/certainty engine                                                           | Make it the timeline tab of Plan, adding account projections and pay-cycle boundaries. Keep the accessible list view.                                                                               |
| Accounts           | Strong source/account health and balances                                              | Keep primary. Add planning roles, reserve floors, and routing configuration without turning it into the main daily decision screen.                                                                 |
| Investments        | Mature wealth detail but not central to near-term household control                    | Move under **Wealth** or a secondary “More” group. Preserve functionality and data.                                                                                                                 |
| Net Worth          | Useful long-range score, not a spendability signal                                     | Group with Investments under Wealth. Explicitly keep it separate from safe-to-spend.                                                                                                                |
| Settings / imports | Correct home for configuration and data operations                                     | Keep imports in Settings. Do not promote statement import to primary navigation.                                                                                                                    |

A compact future desktop/mobile information architecture could be:

1. **Home** — safe-to-spend, actions, upcoming, budget health;
2. **Transactions** — Inbox + ledger;
3. **Plan** — budgets, bills, Calendar, cash-flow projection;
4. **Accounts** — balances, health, planning roles;
5. **Wealth** — Investments + Net Worth;
6. **Settings** — connections, imports, preferences, later household administration.

This is an information-architecture recommendation, not authorization to delete, redirect, or hide current routes.

## 7. Minimum useful Transaction Inbox

The Inbox should be an exception queue, not a mandatory bookkeeping chore. Most high-confidence transactions should flow through automatically.

### Entry reasons

A transaction enters the Inbox when at least one deterministic reason applies:

- no reliable financial role;
- low/absent category confidence for a budget-relevant expense;
- broad mixed-purpose merchant likely to need owner classification;
- suspected internal transfer or card payment without a reliable pair;
- refund/reimbursement without a clear original transaction;
- amount is materially high under a transparent threshold;
- provider/source data conflicts with an existing rule;
- a split is explicitly requested or a prior merchant rule commonly uses splits.

### Minimum actions

- confirm or change financial role;
- confirm or change category;
- split exact amounts across categories;
- link transfer/card-payment legs;
- link refund/reimbursement to the original transaction;
- exclude from reports;
- mark the current choice as one-time or create a narrowly scoped future rule;
- skip/defer without losing the reason.

### State and audit

Use explicit states such as `NEEDS_REVIEW`, `REVIEWED`, `AUTO_ACCEPTED`, and `DEFERRED`, with reason codes, classifier version, confidence, reviewed timestamp, and owner correction precedence. Provider fields remain untouched. A classification rule should be a separate owner-scoped record rather than hidden mutation of past source data.

### Interaction

Reuse the current ledger, active search, transaction detail, effective/source comparison, semantic badges, and correction action. Add a count and a focused card/list workflow with keyboard-operable quick choices. Do not build chat, AI explanations, or a spreadsheet-like bulk editor in the first version.

### Completion criteria

- all reportable posted transactions have an effective reviewed or high-confidence role;
- every unresolved transaction has a visible reason;
- correction never mutates source data;
- paired movements and splits reconcile exactly;
- re-running sync/classification is idempotent;
- owner-scoping and Decimal behavior are covered in PostgreSQL tests;
- Overview and Spending use the same effective classification service as the Inbox and recurrence engine.

## 8. Recommended budget model

Avoid a full envelope-accounting system. The first model should represent a household plan and category limits while leaving bank balances authoritative.

### V1 concepts

- **Budget plan:** owner, planning currency, time zone, effective dates, active status.
- **Budget category:** stable category identity and consumer label, independent of provider category codes.
- **Period allocation:** category, period start/end, limit, amount reallocated in/out, and policy.
- **Policy:** `FIXED_OBLIGATION`, `FLEXIBLE`, or `PROTECTED`; optional warning thresholds.
- **Transaction allocation:** exact Decimal amount assigned to one category; one transaction may have multiple allocations whose signed magnitude reconciles to the transaction.
- **Reallocation:** an auditable balanced movement between period allocations, not a change to bank money.

### Period recommendation

Start with:

- monthly category allocations in the owner’s planning time zone;
- a weekly pace view calculated from the monthly allocation;
- a pay-cycle cash-flow lens derived from expected income events.

Do not initially support arbitrary custom periods, multiple overlapping budget plans, or category-specific calendars. Annual/irregular obligations should first be dated Calendar commitments; sinking-fund accumulation belongs later.

### Remaining, pace, and forecast

```text
category spent = posted expenses − posted linked refunds
                 allocated to category in the period

category remaining = limit + reallocations in − reallocations out − spent

pace ratio = percentage of budget consumed / percentage of period elapsed

forecast = current spend / elapsed fraction
```

Forecasting must handle very early periods, zero limits, refunds, missing classifications, and incomplete data without division-driven nonsense. Show “insufficient reviewed data” rather than a confident forecast when coverage is inadequate.

### Hard, soft, protected, rollover

- **Fixed obligation:** reserved through a dated event; not available for category tradeoffs.
- **Flexible:** owner may reallocate explicitly.
- **Protected:** cannot be used as a suggested source for reallocation.
- **Hard vs soft enforcement:** V1 is advisory. A hard policy means the UI requires an explicit reallocation/acknowledgment before marking a proposed plan as acceptable; it does not decline transactions.
- **Rollover:** defer automatic rollover. First show the prior surplus/deficit and let the owner explicitly carry it forward. Automation can follow once period close semantics are proven.

This model supports the requested live scoreboard and tradeoffs without creating a shadow ledger that competes with actual bank balances.

## 9. Cash-flow and Calendar reuse plan

The existing Calendar stack should be extended rather than replaced.

### Reuse directly

- `RecurringStream` detection identity, frequency, expected amount, confidence, and active state;
- `CalendarEvent` occurrence identity, date/amount provenance, status, linked posted transaction, and account reference;
- `CalendarOverride` precedence for owner-confirmed date, amount, status, and not-a-bill decisions;
- posted matching, ambiguity handling, predicted-only overdue protection, and current-account eligibility;
- manual event creation and accessible month/list views;
- Bills’ 14/30/60/90-day view model and expected-income separation.

### Extend deliberately

- distinguish an income destination account from an obligation payment account;
- add an explicit planned internal transfer with source, destination, amount, due date, and status;
- record whether an event is included in commitments and why;
- add owner reserve floors/planning roles to eligible liquid accounts;
- generate a dated per-account projection ledger from the effective event sequence;
- produce `FUNDED`, `EXPECTED_INCOME`, `TRANSFER_REQUIRED`, `AT_RISK`, `UNFUNDED`, and `UNCERTAIN` coverage states;
- expose budget/pay-cycle boundaries as calendar context, not fake transactions;
- link each projection row to the source event, transaction, transfer, reserve, or budget assumption.

### Preserve

- predicted dates remain predictions;
- contractual due dates remain distinct from observed posting dates;
- a posted transaction satisfies at most one occurrence;
- transfers and card payments affect account cash flow but not household spending;
- provider/imported source data remains immutable;
- low-confidence matches require review;
- inactive/disconnected accounts do not enter current projections.

## 10. Household features: now versus later

### Design for now

- use neutral “household plan” language where it does not misrepresent current access;
- avoid schema assumptions that every object will forever belong directly to one user;
- keep calculation inputs and warnings attributable and permission-ready;
- make category limits, safe-to-spend, and funding actions understandable without exposing full wealth detail;
- keep notification/warning records separable from delivery channels.

### Implement now

- remain owner-only while transaction truth, budgets, projections, and safe-to-spend are proven;
- optionally allow transaction attribution values such as `HOUSEHOLD`, `OWNER`, or `UNASSIGNED` only if the owner has an immediate use for them; do not imply another person can sign in.

### Defer

- household entities and invitations;
- multiple authenticated members;
- granular permissions and hidden balances;
- member attribution and personal allowances;
- shared warning routing;
- push/email delivery;
- digest recipients and preferences.

Adding multi-user authorization while the core financial calculation is still changing would multiply ownership, privacy, and test complexity. The first shared artifact can be a carefully scoped read-only summary after safe-to-spend is stable, not full account access.

## 11. Milestone 11 disposition

### Recommendation: B — stabilize as a checkpoint, then freeze

The current uncommitted Milestone 11 work includes substantial, isolated value:

- owner-scoped import jobs, candidates, and account decisions;
- record-level provenance and deterministic Undo;
- exact duplicate identities and serializable commit behavior;
- encrypted retained-source storage and in-process retention cleanup;
- native PDF/CSV parsing and bounded local OCR;
- conservative account matching and explicit review;
- normalized investment snapshot/holding/activity persistence;
- accessible import history, review, confirmation, deletion, and Undo surfaces.

It also carries meaningful maintenance cost:

- a large schema/migration expansion;
- PDF/OCR dependencies and native/runtime resource limits;
- temporary encrypted file lifecycle and operational configuration;
- source-specific parsers vulnerable to provider layout changes;
- a large acceptance/testing surface centered on investments rather than household cash control.

### Why not the other options

- **A — finish as originally planned:** not recommended. It spends more time optimizing a secondary workflow before the pivot’s critical transaction and cash-flow gaps.
- **C — split reusable infrastructure from investment-specific features:** not recommended now. The generic infrastructure is tightly justified by the concrete import pipeline; extracting it creates another project without a near-term cash-control consumer.
- **D — revert and defer entirely:** not recommended unless the checkpoint cannot pass security/migration review. It discards mature, owner-safe functionality and makes later recovery expensive.

### Freeze-point conditions

If the owner later authorizes a checkpoint, it should:

1. preserve the current work on its own branch/commit without merging by implication;
2. pass the existing isolated PostgreSQL, security, migration, build, and source-retention checks;
3. clearly label imports as secondary Settings functionality;
4. record known acceptance limitations without expanding parser scope;
5. stop all M11 enhancement work after the checkpoint;
6. keep the pivot milestones independent of import schemas and OCR runtime.

This assessment performs none of those Git or implementation actions.

## 12. Proposed roadmap from the current state

### Pivot preparation — Canonical plan reconciliation

**Outcome:** owner-approved product contract for household financial control.

**Scope:** revise the canonical Product Requirements, Build Plan, primary questions, navigation intent, and financial definitions after this assessment is accepted. Resolve the owner decisions below.

**Reuse:** this assessment and all existing merged architecture documents.

**New work:** documentation only.

**Completion criteria:** no unresolved conflict between the single-user MVP contract and the approved household-control roadmap; financial terms have one source of truth.

**Dependency:** owner approval.

**Deferred:** product code and schema changes.

### Household Control 1 — Transaction Truth and Attention

**Outcome:** every transaction that affects household reporting has one auditable effective meaning, and ambiguous activity is easy to resolve.

**Scope:** canonical classification result/provenance, deterministic category/role rules, Transaction Inbox, transfer/card-payment pairing, refund linking, exact split allocations, shared effective-value service, owner corrections, review coverage metrics.

**Reuse:** Plaid reconciliation, `Transaction`, `TransactionOverride`, ledger/detail/search, provider-category confidence, recurrence normalization, semantic UI, owner-scoped actions/tests.

**New:** classification/review state, rules, split allocations, movement links, Inbox query and UI.

**Decisions:** auto-accept confidence policy; refund timing; rule scope; initial category taxonomy.

**Completion criteria:** Overview, Spending, recurrence, and Inbox share one effective classification; pending/posted replacement and paired movements never double count; splits reconcile exactly; all included activity is reviewed or high-confidence; source immutability and owner scope remain intact.

**Dependency:** canonical plan reconciliation.

**Deferred:** budgets, projections, safe-to-spend, ML classification, household users.

### Household Control 2 — Budget Plan and Live Scoreboard

**Outcome:** the owner can see where money went, what remains by category, and whether spending pace is safe.

**Scope:** category identities, monthly plan/allocations, fixed/flexible/protected policies, explicit reallocations, live remaining amount, elapsed-time pace, forecast, threshold states, explanation and drill-down.

**Reuse:** Spending queries/components, exact Decimal arithmetic, effective categories/splits, transaction links, semantic statuses, Overview panels.

**New:** budget plan, allocations, period derivation in owner time zone, pace/forecast service, reallocation audit.

**Decisions:** planning currency/time zone; initial categories; default warning thresholds; explicit carry-forward behavior.

**Completion criteria:** budget totals reconcile to transaction allocations; period and pace math is deterministic; refunds and exclusions are correct; incomplete classification is visible; no category state relies on color alone.

**Dependencies:** Household Control 1.

**Deferred:** automatic rollover, custom periods, sinking funds, notifications.

### Household Control 3 — Routed Calendar and Account Projections

**Outcome:** the app shows which account receives income, pays each obligation, and whether it will have enough on the relevant date.

**Scope:** account planning roles, income destination, obligation payment account, reserve floors, planned transfers, per-account dated projection ledger, funding states and gaps, pay-cycle boundaries.

**Reuse:** recurring detection, Calendar events/overrides/matching, Bills, current-account eligibility, current/available balances, freshness states.

**New:** route semantics, transfer plan, reserve policy, projection engine and explanation rows.

**Decisions:** available-balance/pending policy; treatment of uncertain recurring events; transfer recommendation policy.

**Completion criteria:** each projected change is attributable; card payments and internal transfers affect the correct accounts without becoming spending; stale/incomplete inputs produce uncertainty, not false certainty; funding gaps are reproduced by tests.

**Dependencies:** Household Control 1; time-zone and account-scope decisions. Household Control 2 improves but is not required for the base account projection.

**Deferred:** initiating transfers, automated bill payment, long-range stochastic forecasts.

### Household Control 4 — Explainable Safe to Spend

**Outcome:** Home answers what can safely be spent before the next relevant income event and why.

**Scope:** commitment ledger, budget/obligation deduplication, household and account-level safe-to-spend, “until next income” horizon, proposed-purchase check, funding-action summary, freshness/confidence, calculation drill-down.

**Reuse:** liquid balances, budgets, routed projections, reserves, semantic Notice/value components, Overview/Home cards.

**New:** safe-to-spend policy service, lineage/deduplication keys, confidence/fail-closed state, concise Home experience.

**Decisions:** whether negative account capacity blocks global spendability; uncertain-event reserve policy; minimum cash cushion.

**Completion criteria:** the number reconciles exactly to visible inputs; no commitment is counted twice; an account funding gap cannot be hidden by unrelated wealth; pending/stale/unsupported-currency states are explicit; all ten first-use questions are answerable through Home, Transactions, Plan, and Accounts.

**Dependencies:** Household Control 1–3.

**Deferred:** automated advice, authorized payments, multi-currency.

### Household Control 5 — Early Warnings and Digest

**Outcome:** actionable problems surface before the owner discovers them manually.

**Scope:** in-app warning records, severity, deduplication/acknowledgment, budget-pace risk, reserve breach, funding gap, stale-data warnings, weekly summary preview. Add email/push only within a separately secured production-delivery decision.

**Reuse:** budget pace, projections, safe-to-spend lineage, shared notices, future operational scheduling.

**New:** warning lifecycle and channel preferences.

**Decisions:** thresholds, quieting, delivery channels, scheduler operations.

**Completion criteria:** every warning is explainable and actionable; repeated runs are idempotent; warning fatigue controls exist; no sensitive content leaks through a delivery channel.

**Dependencies:** Household Control 2–4 and production scheduling/security.

**Deferred:** SMS and automated recommendations.

### Household Control 6 — Household Coordination

**Outcome:** selected household members can see and act on the shared plan without receiving unnecessary private financial data.

**Scope:** household/member model, invitations, roles, granular views, shared category allowances, warning routing, attribution, audit, read-only summary first.

**Reuse:** owner authentication/session security, safe-to-spend summaries, warning records.

**New:** multi-user authorization and privacy model.

**Decisions:** membership roles, visibility matrix, attribution expectations, recovery/admin model.

**Completion criteria:** cross-household isolation, least-privilege permissions, invitation/revocation/session tests, and privacy-safe notifications.

**Dependencies:** stable safe-to-spend semantics and a dedicated security design.

**Deferred:** competitive scoring, blame-oriented analytics, external money movement.

### Household Control 7 — Irregular Expenses, Goals, and Debt Tradeoffs

**Outcome:** predictable infrequent costs and longer-term goals inform today’s spending decision.

**Scope:** sinking funds, irregular Calendar obligations, reserve progress, unused-budget disposition, debt/savings goals, scenario tradeoffs.

**Reuse:** budgets, Calendar, projections, safe-to-spend, net-worth/debt views.

**New:** goal/reserve contribution plans and explicit surplus allocation.

**Decisions:** account-backed versus virtual reserves; priority rules; debt strategy boundaries.

**Completion criteria:** reserved money is excluded once, goal progress reconciles to contributions, and no feature claims investment or debt advice.

**Dependencies:** Household Control 2–4.

**Deferred:** optimization, tax advice, trading, autonomous transfers.

## 13. First useful-version coverage

The first useful household-control release is complete after Household Control 4. It should answer:

1. **Where did money go?** — reviewed transaction allocations and category drill-down.
2. **What needs attention?** — Transaction Inbox, funding gaps, stale inputs, and budget risk.
3. **How much is left in each budget?** — live category remaining amounts.
4. **Are we spending too fast?** — elapsed-time pace and forecast.
5. **What checks/income and bills are next?** — routed Calendar timeline.
6. **Which account receives/pays them?** — explicit income and obligation routing.
7. **Will that account have enough?** — per-account projected balance and reserve floor.
8. **Is a transfer needed?** — explicit funding-gap and planned-transfer recommendation.
9. **What is safe to spend now?** — dated household/account discretionary capacity.
10. **Why?** — calculation lineage showing balances, pending items, bills, income, transfers, reserves, budgets, freshness, and assumptions.

It should not require household sharing, external notifications, a digest, sinking funds, goals, debt optimization, or investment-import expansion to answer those questions.

## 14. Decision register

### Approved for V1

The owner approved these decisions on 2026-08-30:

1. Pivot to Household Financial Control while remaining owner-only through Safe-to-Spend V1.
2. Stabilize/checkpoint/freeze Milestone 11; keep imports secondary, Settings-based, and independent of Household Control work.
3. Use the owner's configured local planning time zone and USD as the single consolidated V1 planning currency.
4. Let the owner opt specific checking/savings accounts into planning, with per-account reserve floors and an optional household floor.
5. Use fresh authoritative available balance when appropriate; otherwise subtract unreconciled pending outflows from current balance exactly once. Pending income does not increase current Safe-to-Spend.
6. Permit high-confidence deterministic classification in live totals; route low-confidence, conflicting, ambiguous, high-impact, or structurally uncertain activity to the Transaction Inbox. Owner corrections always win.
7. Use monthly category allocations, derived weekly pace, and pay-cycle cash projections. Rollover is explicit initially; arbitrary custom calendars are deferred.
8. Use cash-based refund/reimbursement handling: linked refunds reduce the relevant allocation when posted, do not become ordinary income by default, and do not automatically rewrite closed periods.
9. Recommend transfers and record owner acknowledgment only; do not initiate bank movement.

### Owner decisions still required

Only these implementation-level decisions remain unresolved:

1. **Initial household category taxonomy** — the stable V1 categories and any protected/fixed defaults.
2. **Default warning thresholds** — percentage/pace/severity defaults for Household Control 2 and 5.
3. **Precise classification confidence thresholds** — the tested deterministic boundaries for auto-acceptance, Inbox routing, and high-impact review.
4. **Default reserve amounts** — whether new planning accounts start at zero, require explicit owner entry, or receive a clearly disclosed suggested amount. No amount may be inferred silently.
5. **Uncertain recurring-event inclusion threshold** — which predicted confidence states may enter future commitments and with what conservative amount policy.

## 15. Conclusion

The existing application is not a failed starting point; it has more of the difficult integrity foundation than the current navigation suggests. Plaid reconciliation, current-account eligibility, exact money, immutable provider data, owner-scoped corrections, recurring confidence, Calendar precedence, and posted matching are directly reusable.

The pivot’s main risk is not lack of UI. It is combining individually reasonable numbers into a precise-looking safe-to-spend result before transaction meaning, budget commitments, routing, pending treatment, and reserves are unified. The roadmap above deliberately closes those semantic gaps first.

The original assessment was planning-only. The subsequently approved documentation-reconciliation pass updates canonical planning documents while leaving product code, Prisma schema, migrations, routes, features, data, and historical architecture records unchanged. No file was staged, committed, pushed, merged, or submitted.
