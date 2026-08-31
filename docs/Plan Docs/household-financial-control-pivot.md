# Household Financial Control Pivot

**Approved:** 2026-08-30
**Status:** Governing forward product direction; Milestone 11 is stabilized, checkpointed, and frozen

## North star

> **What can we safely spend right now without creating a problem later?**

The application is pivoting from a broad personal-finance and wealth-centered dashboard toward owner-only household financial control.

The product should continuously explain:

1. what happened;
2. what is happening;
3. what is about to happen; and
4. what the household can safely do next.

## First useful version

Household Control 1–4 together form the first useful version:

1. **Transaction Truth and Attention** — one auditable effective meaning per transaction, deterministic classification, Transaction Inbox, movement/refund links, and exact splits.
2. **Budget Plan and Live Scoreboard** — monthly allocations, weekly pace, remaining amounts, projected over/under, and explicit reallocations.
3. **Routed Calendar and Account Projections** — income/payment account routing, reserve floors, planned transfers, dated balances, and funding gaps.
4. **Explainable Safe to Spend** — a dated, reproducible household/account result with commitment deduplication, coverage, freshness, and confidence.

This version must answer:

- Where did my money go?
- What needs attention?
- How much remains in each budget?
- Am I spending too fast?
- What income and bills are next?
- Which account receives or pays them?
- Will that account have enough?
- Is a transfer needed?
- What can I safely spend?
- Why?

## Approved V1 boundaries

- Owner-only through Safe-to-Spend V1.
- Owner-configured local planning time zone.
- USD-only consolidated planning.
- Owner-selected checking/savings planning accounts.
- Per-account reserve floors and optional household reserve floor.
- Source-aware pending-outflow treatment without double subtraction.
- Pending income does not increase current Safe-to-Spend.
- High-confidence deterministic classification may enter live totals; material uncertainty enters the Inbox.
- Monthly category allocations, derived weekly pace, and pay-cycle projections.
- Explicit initial rollover and budget reallocations.
- Cash-based linked refund/reimbursement treatment.
- Transfer recommendations and acknowledgment only; no institution-initiated movement.
- Minor unresolved classification may produce a quantified, qualified result; materially unresolved or stale critical inputs fail closed.

## Milestone 11 disposition

Milestone 11 is **stabilized, checkpointed, and frozen**; retained, secondary, Settings-based, independent of Household Control milestones, and not a prerequisite for Household Control 1. Do not expand document families or parser scope.

## Later roadmap

5. **Early Warnings and Digest**
6. **Household Coordination**
7. **Irregular Expenses, Goals, and Debt Tradeoffs**

External delivery, multi-user permissions, sinking funds, goals, and deeper forecasts follow only after explainable Safe-to-Spend is stable.

## Future information architecture

1. Home
2. Transactions — Inbox + ledger
3. Plan — budgets + bills + Calendar + cash-flow projections
4. Accounts
5. Wealth — Investments + Net Worth
6. Settings — connections + imports + preferences

This is documented direction, not a current route change. Existing features and routes remain.

## Governing sources

For future work, use this hierarchy:

1. approved Household Financial Awareness & Budget Enforcement requirements;
2. the Household Financial Control Pivot Assessment;
3. canonical Product Requirements, Financial Definitions, Build Plan, and supporting specifications as reconciled for this pivot;
4. current schema, implementation, tests, and preserved historical architecture records.

Historical architecture documents remain records of what their milestones implemented and must not be rewritten to imply later product intent.

## Remaining decisions

- initial household category taxonomy;
- default warning thresholds;
- exact classification confidence thresholds;
- default reserve amounts;
- uncertain recurring-event inclusion threshold.
