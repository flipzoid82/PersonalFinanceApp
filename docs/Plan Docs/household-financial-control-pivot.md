# Household Financial Control Pivot

**Approved:** 2026-08-30
**Status:** Governing forward product direction; Milestone 11 is stabilized, checkpointed, and frozen

## North star

> **What can we safely spend right now without creating a problem later?**

The application serves two complementary purposes: bounded complete financial awareness across approved financial domains and active income planning/budgeting. It is pivoting from a broad wealth-centered dashboard toward owner-only household financial control without discarding Accounts, Transactions, Investments, Net Worth, manual assets/debts, or frozen Settings-based imports.

“Complete” is bounded by the approved roadmap and does not silently add tax, insurance, estate, legal, trading, investment-advice, or another unapproved financial domain.

The product should continuously explain:

1. what happened;
2. what is happening;
3. what is about to happen; and
4. what the household can safely do next.

## First useful version

Household Control 1–4 together form the first useful version:

1. **Transaction Truth and Attention** — one auditable effective meaning per transaction, deterministic classification, Transaction Inbox, movement/refund links, and exact splits.
2. **Budget & Income Plan** — planned income, spending allocations, fixed obligations, protected reserves, generic planned saving, generic extra debt principal, intentionally unassigned income, live progress, and explicit reallocations. Zero-based budgeting is optional.
3. **Routed Cash Flow** — Calendar routing, income/payment account routing, reserve floors, planned transfers, dated account projections, funding states/gaps, pay-cycle boundaries, projection lineage, and freshness/confidence.
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
- Explicit owner decisions, owner-confirmed rules, and unambiguous versioned deterministic mappings may enter live totals; provider-only or structurally uncertain meaning enters the Inbox.
- Amount may prioritize attention but does not by itself block finalized reporting.
- Monthly category allocations, derived weekly pace, and pay-cycle projections.
- Planned or expected income does not become current liquidity merely because it appears in a plan.
- Planned saving is distinct from funded saving and requires approved funding evidence.
- HC1 transaction-purpose categories are distinct from HC2 planning destinations.
- Existing Bills behavior, recurring streams, and Calendar occurrences remain the obligation foundation; HC2 reconciles with them instead of creating a second obligation truth source.
- Explicit initial rollover and budget reallocations.
- Cash-based linked refund/reimbursement treatment.
- Transfer recommendations and acknowledgment only; no institution-initiated movement.
- Minor unresolved classification may produce a quantified, qualified result; materially unresolved or stale critical inputs fail closed.

## Milestone 11 disposition

Milestone 11 is **stabilized, checkpointed, and frozen**; retained, secondary, Settings-based, independent of Household Control milestones, and not a prerequisite for Household Control 1. Do not expand document families or parser scope.

## Later roadmap

5. **Goals, Irregular Expenses & Debt Tradeoffs**
6. **Warnings & Digest**
7. **Household Coordination**

HC5 owns the dedicated Debt Tracker experience for supported credit cards and loans, including source-qualified current balances, known contractual information, freshness, and balance/paydown progress where sufficient authoritative or historical evidence exists, with links into payoff planning. It may also add named goals, sinking funds, feasibility, payoff projections, and explicit debt-versus-saving tradeoffs. Unknown contractual facts and unsupported progress remain unknown rather than being invented. External warning delivery and multi-user permissions follow in HC6 and HC7 respectively.

## Future information architecture

1. Home
2. Transactions — Inbox + ledger
3. Budget & Plan — provisional label for budgets + bills + Calendar + cash-flow projections + goals
4. Accounts
5. Wealth — Investments + Net Worth
6. Settings — connections + imports + preferences

This is documented direction, not a current route change. Existing features and routes remain.

## Governing sources

For future work, use this hierarchy:

1. reconciled canonical Product Requirements, Build Plan, and Financial Definitions;
2. milestone-specific approved owner decisions and durable implementation contract;
3. supporting canonical Data Model, pivot, Overview, Calendar, and Plaid specifications;
4. current schema, implementation, tests, and preserved historical architecture records;
5. the Household Financial Control Pivot Assessment as rationale and historical context only.

Historical architecture documents remain records of what their milestones implemented and must not be rewritten to imply later product intent.

## Approved HC1 decisions

- Use the compact owner-friendly expense/income transaction-purpose taxonomy with rename, deactivate, add, stable identity, and idempotent bootstrap behavior.
- Auto-accept only explicit owner decisions, owner-confirmed deterministic rules, and unambiguous versioned system mappings.
- Apply new owner rules prospectively by default; historical application requires preview and confirmation.
- Suggest transfer and card-payment pairs initially; heuristic evidence does not auto-confirm.
- Use transaction amount for attention/order, not as an amount-only reporting blocker.

Later milestones still own default warning thresholds, reserve policies, and uncertain recurring-event inclusion policy.
