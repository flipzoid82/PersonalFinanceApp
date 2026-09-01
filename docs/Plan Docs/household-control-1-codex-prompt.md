# Household Control 1 Codex Prompt

## Objective

Implement **Household Control 1 — Transaction Truth and Attention**.

Every financially relevant transaction must be able to resolve to one auditable canonical effective interpretation. Ambiguity must be surfaced through a focused Transaction Inbox and resolved without mutating provider/source evidence.

HC1 is one product milestone delivered in reviewable internal slices. It does not implement budgets, planned-income allocation, projections, Safe-to-Spend, goals, warnings, debt-planning UI, or household membership.

## Work and Git boundaries

- Work only on a separately authorized HC1 feature branch created from the then-current approved `main`.
- Before changing files, confirm the branch, HEAD, clean baseline, and source hierarchy.
- Do not stage, commit, push, merge, or open a PR unless the owner separately authorizes that action.
- Do not rewrite historical milestone architecture documents.
- Preserve frozen Milestone 11 import behavior and scope.
- If a genuine source conflict, unresolved product decision, unsafe data migration, or runtime constraint prevents this contract, stop and report it before implementing a workaround.

## Source hierarchy

Use this authority order:

1. Current reconciled canonical contract:
   - `docs/Plan Docs/product-requirements.md`
   - `docs/Plan Docs/build-plan.md`
   - `docs/Plan Docs/financial-definitions.md`
2. This HC1 implementation contract.
3. Supporting canonical direction:
   - `docs/Plan Docs/data-model.md`
   - `docs/Plan Docs/household-financial-control-pivot.md`
   - `docs/Plan Docs/overview-dashboard-spec.md`
   - `docs/Plan Docs/calendar-spec.md`
   - `docs/Plan Docs/plaid-integration.md`
4. Current schema, migrations, implementation, services, actions, components, and tests.
5. Historical architecture documents only to understand implemented history when current code is ambiguous.
6. `docs/Plan Docs/household-financial-control-pivot-assessment.md` as historical rationale only.

This prompt is self-contained. Do not depend on an untracked Pass A report or a Downloads file. If implementation reality differs from intended canonical behavior, identify the gap rather than promoting the current behavior into a requirement.

## Approved owner decisions

### Starter transaction-purpose taxonomy

Expense categories:

- Housing
- Utilities
- Groceries
- Dining
- Transportation
- Health
- Insurance
- Household
- Personal
- Shopping
- Entertainment
- Subscriptions
- Education/Childcare
- Travel
- Taxes
- Fees & Interest
- Other Expense

Income categories:

- Payroll
- Benefits
- Interest Income
- Other Income

Requirements:

- stable owner-scoped identity;
- stable system keys for starter identities;
- owner rename, deactivate, add, and reorder support;
- provider categories remain evidence rather than becoming this taxonomy automatically;
- no permanent `Uncategorized` category used to conceal unresolved meaning;
- no fabricated `Mixed` category; use exact splits.

Category bootstrap must be idempotent. Repeated invocation must not duplicate categories, reactivate an owner-deactivated category, overwrite an owner-renamed label, reset owner ordering, or replace owner customization. This requirement does not authorize a whole-database bootstrap or classification backfill on every startup.

### Classification acceptance

Automatically resolved meaning is limited to:

- explicit owner overrides;
- active owner-confirmed deterministic rules;
- unambiguous versioned deterministic system mappings.

Provider-only, conflicting, unsupported, or structurally uncertain meaning requires review. Merchant text plus amount is never sufficient by itself. Do not invent opaque confidence percentages.

### Owner-rule history

New owner rules are future-only by default. Historical owner-rule application requires a preview of affected transactions and expected reporting impact plus explicit owner confirmation.

This policy does not prohibit the controlled initial deterministic system-classification backfill. System backfill is separate, bounded, versioned, idempotent, and may not overwrite owner decisions.

### Pair confirmation

Transfer and credit-card-payment heuristics are suggestion-first. Same amount, direction, date proximity, account compatibility, or text similarity are candidate signals and do not silently confirm a pair. Owner confirmation and unpairing remain available.

Automatic confirmation may be considered only when an authoritative source supplies a trustworthy explicit relationship identifier. Stop before expanding this policy on heuristic evidence.

### High-impact activity

Amount may affect attention, ordering, and visibility. Amount alone does not make a resolved transaction unresolved, remove it from finalized reporting, or create a mandatory blocking review. Configurable high-dollar warnings belong to HC6.

## Reuse map

### Keep

- `Transaction` as immutable provider/source observation;
- Account, source, and Plaid connection identity/history;
- provider category and raw evidence;
- transaction ledger/detail, URL-backed filters/search/sorting/pagination, and responsive presentation;
- owner-scoped correction workflow where its semantics remain valid;
- Overview and Spending UI structures;
- recurring detection/persistence infrastructure;
- Calendar prediction, correction, matching, paid, and overdue behavior;
- semantic Notice, status, badge, form, dialog, theme, and mobile foundations;
- owner-only server authorization patterns;
- Decimal/money utilities;
- PostgreSQL integration-test patterns;
- Milestone 11 imports as frozen independent functionality.

### Extend

- `TransactionOverride` for stable category and owner direction correction;
- Plaid sync for classification and pending-successor continuity;
- ledger/detail for provenance, Inbox, relationships, and splits;
- Overview, Spending, recurrence, and relevant Calendar matching to consume the canonical interpretation.

### Replace only the obsolete semantics

- replace the narrow `effectiveTransactionValues` contract with a canonical bulk-capable resolver while preserving owner precedence;
- remove recurrence's private provider-role interpretation only after canonical classification is ready;
- replace the singular untyped transaction-to-transaction link as the long-term relationship representation, subject to the complete legacy-link contract below.

### New durable concepts justified by HC1

- `TransactionCategory`
- `TransactionClassification`
- `ClassificationRule`
- `TransactionRelationship`
- `TransactionAllocation`

Do not add a separate Inbox table unless a genuinely durable queue concept cannot be represented by classification, relationship, split, and review state. Stop and explain that deviation before adding one.

## Canonical architecture

```text
immutable source Transaction
        -> versioned system/rule interpretation
        -> authoritative owner TransactionOverride
        -> canonical effective resolver/allocation API
        -> Transactions, Overview, Spending, recurrence, Calendar matching
```

Resolve each field independently using:

1. explicit owner override;
2. owner-confirmed deterministic rule;
3. unambiguous versioned deterministic system classification;
4. provider evidence where permitted;
5. unresolved.

`TransactionClassification` is system/rule interpretation, not competing final truth. `TransactionOverride` remains owner truth. No downstream consumer may reconstruct private financial meaning after cutover.

The effective result must expose:

- source and effective merchant/description;
- stable category identity/label when applicable;
- financial role;
- account-level economic direction;
- report exclusion and notes;
- effective allocations;
- relevant typed relationships;
- per-field provenance and certainty;
- review state and reason codes;
- source-versus-effective comparison.

## Financial role and category applicability

Preserve existing roles and add a role equivalent to `BORROWING_PROCEEDS`:

- cash was received;
- a liability was created or increased;
- it is not income;
- it is not an internal transfer.

Retain `UNCATEGORIZED` only where compatibility requires it. New unresolved role is unresolved state, not an economically meaningful role.

Role/category behavior:

- `EXPENSE`: normally requires an expense category.
- `INCOME`: normally requires an income category.
- `REFUND`: inherits or allocates against original expense purpose when reliable.
- reimbursement: uses refund-like role semantics initially; typed relationship is `REIMBURSEMENT`.
- `TRANSFER`: categoryless.
- `CREDIT_CARD_PAYMENT`: categoryless; purchases retain expense categories.
- `DEBT_PAYMENT`: normally categoryless; separately evidenced interest and fees are expenses.
- `BORROWING_PROCEEDS`: categoryless and excluded from income.
- `INVESTMENT_ACTIVITY`: categoryless in household spending.
- `IGNORED`: categoryless.
- unresolved role: category applicability remains unresolved.

Do not invent principal/interest splits. Do not add a standalone reimbursement role unless evidence proves a separate downstream economic calculation is required; stop and report before that deviation.

## Economic direction

Account-level direction is exactly:

- `INFLOW`
- `OUTFLOW`
- `UNKNOWN`

Household neutrality belongs to role/relationship semantics, not an account leg. A transfer normally has an outflow source leg and inflow destination leg while remaining household-neutral.

Direction must be deterministic, source-adapter-aware, versioned, auditable, efficiently queryable, owner-overridable, and reproducible after reruns. Persisting classified direction is recommended. A different representation is allowed only if it provides equivalent provenance, versioning, auditability, performance, and rerun behavior.

Plaid uses an explicit Plaid adapter plus account context. Future sources require explicit adapters. Never interpret raw amount sign as provider-neutral direction. Preserve the raw signed amount.

## Distinct eligibility predicates

Do not add one universal `reportable` Boolean. Implement and test distinct predicates:

### Classification eligibility

- current pending and posted transactions;
- retained historical transactions that require interpretation;
- canceled pending predecessors and removed records remain audit lineage but are not newly classified as independent current activity.

### Finalized-reporting eligibility

- posted;
- not removed;
- not owner-excluded;
- owner/account scope valid;
- effective role sufficiently resolved for the consumer;
- historical disconnected/inactive account activity remains valid historical activity;
- pending is excluded;
- non-USD remains separate and is not silently added to USD.

### Inbox eligibility

- current pending or posted source activity with unresolved/conflicting required role, category, direction, split, rule, or relationship state;
- no duplicate item for a canceled pending predecessor with a posted successor;
- amount alone is not a blocking reason.

### Recurrence eligibility

- posted, nonremoved, not excluded;
- current eligible account/source for new detection;
- canonical supported role and useful merchant/category evidence;
- historical disconnected activity may remain reporting history but does not generate new recurrence projections.

### Relationship eligibility

- posted, nonremoved, same-owner candidates;
- compatible direction, currency, accounts, dates, and amounts;
- pending may show a nondurable hint but cannot become a confirmed pair.

### Allocation eligibility

- category-bearing pending or posted transactions;
- pending owner splits must reconcile through posted replacement;
- non-USD splits remain exact in their own currency;
- categoryless roles do not receive fabricated allocations.

### Later-planning eligibility

Define only for future consumers: opted-in, current, sufficiently fresh USD cash accounts and canonically interpreted activity. Do not implement HC2/HC3 planning behavior.

M11 holdings, snapshots, import jobs, and investment transactions remain independent and do not become HC1 transactions implicitly.

## Exact effective allocations

Persist `TransactionAllocation` rows only for real splits unless repository evidence proves an equivalent safer representation.

- use positive `Decimal(19,4)` magnitudes;
- inherit transaction currency;
- require an owner-owned stable category;
- preserve stable ordering and provenance;
- sum exactly to the absolute transaction magnitude;
- reject incomplete, negative, overallocated, and concurrently conflicting sets;
- write under one owner-scoped transaction with source-row concurrency control.

An unsplit category-bearing transaction is returned by the same effective-allocation API as one synthesized allocation. Consumers must not care whether the allocation was physically stored.

## Pending-to-posted continuity

Reconcile pending replacement transactionally.

Normally preserve or move when safe:

- owner merchant correction;
- stable category or legacy category correction;
- role and direction correction;
- notes;
- exclusion;
- exact owner splits.

Recompute:

- provider evidence/confidence;
- deterministic system classification;
- owner-rule evaluation.

Repoint a confirmed relationship only if the posted successor still satisfies its invariants. Repoint a Calendar fulfillment link when safe. Rerun recurrence detection/matching rather than copying inferred state.

If pending and posted rows contain conflicting owner decisions, preserve both source facts, overwrite neither, and create an explicit conflict reason on the posted current item. The canceled predecessor remains audit lineage and does not create duplicate reporting or Inbox activity.

Use row locking, serializable mutation boundaries, optimistic versions, or an equally safe mechanism so concurrent owner edits and sync cannot lose state.

## Legacy `TransactionOverride.linkedTransactionId`

This field must not be silently dropped or repurposed.

### Inventory

Before replacement/removal, inventory every non-null link without exposing sensitive owner data. Reconcile owner scope, endpoint existence, source/target identities, effective roles/directions/accounts, and any code/test evidence of intended meaning. Do not assume all links share one relationship type.

### Deterministic conversion

Convert only when type and endpoints are established safely. Preserve owner, endpoints, known meaning, owner intent, and provenance. Do not infer type from equal amount/date proximity alone.

### Ambiguous links

Do not delete or silently convert them. Maintain deterministic compatibility reads and an explicit review reason. The owner must be able to resolve the relationship without losing the original linkage.

### Dual-read protection

Legacy and typed paths must not double-apply one relationship. Conversion and retry are idempotent.

### Proven-safe removal gate

Removal is permitted only after all links are inventoried; deterministic links converted; ambiguous links explicitly resolved or moved to a durable supported representation; owner counts reconcile; no read, write, or test depends on the field; typed parity is verified; retries are idempotent; and the full PostgreSQL suite passes with zero skipped database tests.

Prefer retaining the field through compatibility and removing it in a later explicit migration. Its safe retention does not block HC1 completion.

## Typed relationships

Support:

- `INTERNAL_TRANSFER`: directed owner-controlled outflow leg to inflow leg; normally one confirmed relationship per endpoint.
- `CREDIT_CARD_PAYMENT`: payment-account outflow to card payment credit; never purchase to later payment.
- `REFUND`: refund to original expense; partial and multiple refunds allowed.
- `REIMBURSEMENT`: third-party reimbursement to original expense purpose; partial and multiple relationships allowed.

Store an applied exact magnitude where partial/multiple linkage requires it. Directed endpoints prevent reverse duplicates. Enforce same owner and currency at the database boundary where practical, plus type-specific account, direction, amount, and cardinality rules transactionally.

Candidate evidence may include direction, exact amount, currency, owner-controlled accounts, account type, posting/authorization proximity, provider evidence, normalized text, existing relationship state, and uniqueness. Explain suggestions. Do not confirm heuristic candidates automatically.

Unpairing preserves source data and auditable owner intent. Over-refund, incompatible split allocation, and ambiguous reimbursement require review. HC1 does not implement budget-period closure.

Calendar's transaction link remains separate event-fulfillment lineage.

## Classification rules

Allow only bounded deterministic scopes:

- exact normalized merchant;
- exact normalized description;
- escaped prefix;
- escaped contains;
- merchant plus account.

No arbitrary owner regular expressions. Rules are owner-scoped, active/inactive, versioned, and deterministically prioritized. Equal-priority conflict goes to Inbox rather than insertion-order selection. An explicit transaction override always wins.

Historical owner-rule application requires a preview, affected count/details, expected reporting effect, explicit confirmation, deterministic audit, and owner-safe execution.

## Transaction Inbox

Inbox is an exception view over durable unresolved state, not a second ledger.

At minimum support reason codes equivalent to:

- role unresolved;
- required category unresolved;
- direction unknown;
- rule conflict;
- pending/posted owner conflict;
- transfer ambiguity;
- card-payment ambiguity;
- refund/reimbursement ambiguity;
- incomplete split;
- relationship amount conflict;
- unsupported source semantics;
- ambiguous legacy link.

Provide focused quick actions. Blocking structural ambiguity cannot be permanently hidden; the owner resolves, excludes, or temporarily defers it. Deferred state re-enters when due or when evidence/classifier version changes. Exclusion preserves source and audit information.

## Provenance and certainty

Track role, category, direction, and relationship certainty separately. Use deterministic states such as high, review-required, and unknown rather than percentages.

Track provenance separately: owner override, owner rule, deterministic system, provider evidence, or unresolved. Missing provider category confidence is unknown, not zero. Automatic behavior must not depend on confidence the source does not reliably populate.

## Backfill, deployment, and cutover

Use:

1. forward-only compatible schema expansion;
2. nullable/compatible fields and required indexes;
3. canonical resolver with legacy read-through;
4. idempotent starter-category creation;
5. bounded idempotent classification/category/link backfill;
6. conservative migration of legacy owner category strings;
7. review for unknown category kind or other ambiguity;
8. old/new reporting reconciliation;
9. atomic owner-level consumer cutover;
10. later proven-safe compatibility cleanup.

Do not perform a giant data rewrite inside the migration or repeat whole-database backfill on every startup.

Backfill must support batching, short transactions, interruption recovery, deterministic retry, classifier versions, concurrent Plaid sync, concurrent owner edits, and fail-closed unresolved state.

Before cutover, compare legacy and canonical outputs. Classify every difference in financial totals, transaction inclusion, classification, allocation, or relationship results as:

- approved semantic correction;
- expected consequence of newly resolved activity;
- resolved implementation defect; or
- unexplained discrepancy.

Cutover requires zero unexplained differences in those financial results. It does not require identical totals when canonical semantics intentionally correct or complete legacy behavior. Tests and reconciliation output must record the reason for every expected changed result.

After cutover, no consumer may silently use mixed legacy and canonical semantics. Rollback/failure must retain source/owner data and fail closed rather than produce inconsistent reports.

## Query and performance contract

The resolver must be bulk-capable. Do not execute a Prisma query per transaction.

- Ledger: preserve server pagination, URL filters/search/sort, and efficient effective category/role filtering.
- Detail: load complete source/effective comparison, allocations, relationships, and evidence.
- Overview: aggregate canonical finalized income/spending with exact Decimal behavior.
- Spending: aggregate effective allocations by stable category and merchant.
- Recurrence: bulk-load canonical role/direction/category; remove the private provider-role heuristic after cutover.
- Calendar: bulk-load canonical matching fields without replacing Calendar's own match score.

Add owner/status/date, classification review, category identity, allocation, relationship endpoint/type/state, rule, and pending-successor indexes supported by actual query plans. Use PostgreSQL joins/CTEs or shared query fragments where filtering/sorting requires them. Application-side Decimal aggregation may remain for bounded queries when correct and measured. Do not add caching without measured need and a safe invalidation design.

Add a query-count or equivalent N+1 regression test where practical.

## Coverage metrics

Keep populations and currencies separate:

- finalized spending classification;
- finalized income classification;
- split-allocation completeness;
- transfer/card-payment relationship resolution;
- refund/reimbursement linkage;
- pending unresolved exposure;
- currency-specific populations.

Report resolved/unresolved exact magnitude and count. Prioritize amount-weighted coverage where meaningful. Do not let a transfer dominate spending classification coverage, and never combine USD and EUR into one monetary result.

## Security and integrity

No cross-owner category, classification, allocation, relationship, rule application, or review state may be valid.

Prefer owner-aware composite database references for new models, backed by server authorization. Enforce classification uniqueness, category identity, endpoint uniqueness, reverse-duplicate prevention, and type-specific cardinality at the database boundary where expressible.

Enforce allocation reconciliation, relationship compatibility, owner precedence, pending conflict resolution, rule conflicts, and classifier reruns through owner-scoped transactional services and concurrency controls.

Provider/source fields remain immutable outside approved sync adapters. Preserve exact Decimal arithmetic. Never expose source payloads, provider identifiers, owner financial data, or secrets in diagnostics, tests, migration output, or reports.

## Downstream consolidation

### Transactions

Reuse ledger/detail and responsive behavior. Add Inbox state, stable categories, per-field provenance/certainty, split editing, relationship suggestions/confirmation, and owner direction correction. Preserve URL-backed ledger behavior and keyboard accessibility.

### Overview

Use finalized-reporting eligibility plus the canonical resolver. Borrowing proceeds are not income. Transfers/card payments do not duplicate income/spending. Unresolved coverage remains visible.

### Spending

Aggregate canonical expense/refund effective allocations by stable transaction-purpose category. Preserve exact totals, filters, drill-down, and exclusions.

### Recurrence

Replace the private provider-category role heuristic only after canonical cutover. Preserve current stream correction, Calendar projection, and matching behavior.

### Calendar

Use canonical role/direction/category where relevant to matching. Preserve Calendar's separate match confidence, owner confirmation, event fulfillment link, paid/overdue semantics, and existing behavior. Do not implement HC3 routing/projections.

## Later commitment-lineage boundary

Do not implement an HC4 commitment ledger or HC2 plan tables.

Preserve stable transaction/category IDs, pending-successor lineage, typed relationships, exact allocations, provenance, and Calendar fulfillment so later milestones can reconcile:

```text
existing bill/recurring obligation
  -> future plan allocation/reservation
  -> Calendar occurrence
  -> fulfilling transaction
```

and:

```text
planned saving
  -> funding transfer
  -> destination reserve/goal evidence
```

One economic commitment reduces capacity at most once. Existing Bills is a surface/domain backed by approved recurring and Calendar concepts; do not infer or add a separate `Bill` model in HC1.

## Implementation slices

Implement in this dependency order or stop and justify an equally safe alternative:

1. eligibility, direction, `BORROWING_PROCEEDS`, and stable-category foundation;
2. classification persistence and pure canonical resolver;
3. compatibility reads, bounded backfill, reconciliation, and atomic cutover;
4. pending-to-posted owner-state continuity;
5. derived Inbox and bounded owner rules;
6. transfer/card-payment suggestions and typed relationships;
7. refunds/reimbursements and exact splits;
8. Transactions, Overview, Spending, recurrence, and Calendar consolidation;
9. coverage, query performance, concurrency, and security hardening;
10. automated gates and physical acceptance.

Each slice must be independently testable, preserve owner isolation, and leave reporting coherent. Do not knowingly leave different consumers on contradictory semantics.

## Required automated coverage

At minimum cover:

- resolver precedence and complete role/category/direction matrix;
- source-adapter direction and unknown-source behavior;
- owner override precedence and source immutability;
- owner isolation and owner-aware reference rejection;
- exact approved category bootstrap;
- repeated bootstrap, duplicate prevention, rename/deactivation/order preservation, and stable system identity;
- category applicability and categoryless roles;
- borrowing proceeds excluded from income;
- missing provider confidence treated as unknown;
- pending-to-posted success and every owner-state continuity field;
- pending/posted owner conflict with no lost decisions or duplicate Inbox/reporting;
- repeated/concurrent Plaid sync idempotency;
- owner-rule precedence/conflict/future-only behavior;
- explicit historical rule preview/confirmation;
- transfer and card-payment suggestions without heuristic auto-confirmation;
- relationship cardinality, reverse duplicates, owner/currency/account constraints, confirm/unpair;
- full, partial, multiple, split, over-, unlink, and relink refund/reimbursement behavior;
- exact split arithmetic, invalid sets, refund compatibility, and concurrent writes;
- legacy link inventory, deterministic conversion, ambiguity compatibility, dual-read no-double-application, retry, and no data loss;
- bounded backfill interruption/retry and concurrent owner/sync behavior;
- old/new reconciliation with zero unexplained financial differences;
- atomic cutover and fail-closed partial state;
- cross-consumer semantic agreement;
- Overview/Spending exact totals and drill-down;
- recurrence canonicalization without private role inference;
- Calendar matching/fulfillment regression;
- coverage populations and currency separation;
- query-count/N+1 regression where practical;
- keyboard, accessible names/status, focus, mobile containment, long text, and Light/Dark/System theme behavior;
- full isolated PostgreSQL suite with zero skipped database tests.

Use synthetic data only. Do not copy real owner financial records into fixtures or reports.

## Physical acceptance

Using the established development workflow and an owner-authenticated controlled browser, physically verify affected flows without exposing credentials or financial details:

- Transactions Inbox empty, resolved, deferred, excluded, and conflict states;
- category rename, deactivate, add, and preserved bootstrap customization;
- role/category/direction owner corrections and provenance display;
- pending-to-posted continuity where reproducible with Plaid Sandbox;
- transfer and card-payment suggestion, confirm, and unpair;
- refund/reimbursement full/partial/multiple behavior;
- exact split editing and invalid-sum prevention;
- legacy-link compatibility/review using synthetic development data;
- Overview and Spending agreement and intended reconciled changes;
- recurrence and Calendar behavior after canonicalization;
- repeated sync/backfill producing no duplicates;
- keyboard-only primary workflows, focus, dialog behavior, and accessible labels;
- 375×812, representative tablet, and desktop widths;
- Light, Dark, and System;
- long merchant/category/account/source values with no horizontal overflow;
- clean browser console.

State exact browser/tool limitations instead of claiming checks that were not observed.

## Required final gates

Run the repository's established safe workflows:

- Prisma client generation;
- Prisma schema validation;
- migration status;
- forward migration replay against an isolated database;
- seed/bootstrap twice where applicable, proving owner customization is preserved;
- focused unit/component/integration tests;
- full isolated PostgreSQL-backed suite with zero skipped database tests;
- lint;
- typecheck;
- format check;
- production build;
- `git diff --check`;
- security/PII/secret scan;
- generated/runtime artifact cleanup;
- final staged/unstaged/untracked inventory.

Do not reset, seed, or destructively migrate owner development data. Back up or prove data repair/migration in a rollback-capable transaction before applying it to development data.

## Required architecture documentation

Create or update `docs/architecture-household-control-1.md` so it records implemented truth, final schema/migration behavior, resolver precedence, eligibility predicates, pending continuity, legacy-link disposition, backfill/cutover, query design, security invariants, test totals, and physical verification. Do not rewrite historical milestone architecture records.

## Final report

Report:

1. branch and final Git inventory;
2. implementation summary and exact files changed;
3. final schema/migration and why each addition is necessary;
4. reuse map and semantic replacements;
5. category, classification, direction, allocation, and relationship behavior;
6. pending-to-posted continuity;
7. legacy-link before/after inventory and disposition without sensitive data;
8. backfill/cutover and old/new reconciliation, including every intended changed result and zero unexplained differences;
9. query/index/performance result;
10. downstream Overview, Spending, recurrence, and Calendar result;
11. owner/security/immutability result;
12. automated test totals and every gate;
13. physical acceptance performed and limitations;
14. defects found/fixed and remaining known limitations;
15. confirmation no HC2+ feature was implemented;
16. confirmation nothing was staged, committed, pushed, merged, or submitted unless separately authorized.

Stop after the required verification and report. Do not publish Git state without explicit owner authorization.
