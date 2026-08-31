# Home / Overview Specification

## Purpose

The current `/overview` route remains valid. Its future conceptual destination is **Home / Today**: the primary household financial-control surface.

The page should answer, in priority order:

1. What can safely be spent now?
2. What needs attention?
3. What income and bills are next?
4. Are budgets and spending pace healthy?
5. Is an account underfunded or is a transfer needed?
6. How fresh, complete, and reliable is the answer?

Longer-term wealth and net-worth information remains available but secondary.

This specification documents direction only. It does not authorize navigation or implementation changes outside the owning Household Control milestone.

## Primary Home content after Household Control 4

### Safe to Spend

Display:

- amount;
- exact horizon, normally until the next relevant expected-income event;
- confidence/coverage state;
- number and amount of unresolved transactions when relevant;
- a concise explanation of eligible liquidity, commitments, reserves, and budget capacity;
- a link to the complete calculation lineage.

Example:

> **$640 safe to spend through Friday**<br>
> Based on 97% classified spending. Two transactions totaling $84 still need review.

If critical information is stale, materially unresolved, unsupported-currency, or missing routing, do not show a precise authoritative number. State what prevents it.

### Actions needed

Prioritize actionable exceptions rather than general reporting:

- transactions needing review;
- bills requiring a transfer;
- unfunded or at-risk obligations;
- missing account routing;
- stale planning-account data;
- materially incomplete classification/split coverage;
- budget categories projected to exceed their allocation.

Each action links to the surface where it can be resolved.

### Upcoming income and obligations

Show the next expected income, bills, subscriptions, debt/card payments, and planned transfers with:

- predicted or confirmed date;
- expected amount and amount source;
- receiving/paying account;
- funding status;
- projection effect;
- confidence and freshness.

### Budget health

Show a small set of categories that are at risk, over, or most relevant, including:

- spent / allocated;
- remaining amount;
- elapsed time;
- pace status;
- projected over/under amount;
- classification coverage.

### Funding gaps

Show account-specific shortfalls and transfer recommendations. A positive household cash total must not hide a payment-account gap.

### Transaction Inbox

Show unresolved item count, material unresolved amount, and the leading review reasons. Do not imply that every transaction requires review.

### Freshness and confidence

Show:

- last successful sync by critical planning source;
- whether current or available balances were used;
- stale or disconnected planning accounts;
- predicted/confirmed mix;
- classification/split coverage;
- whether the result is complete, qualified, or unavailable.

## Secondary content

The current balance-sheet and historical views remain useful secondary context:

- current cash and available cash;
- total debt and credit utilization;
- current investments;
- net worth and historical trend;
- account balances;
- recent transactions;
- spending by category;
- source health.

These metrics must not be presented as substitutes for Safe-to-Spend. Investments, property, credit capacity, and unrelated debt capacity never increase spendable cash.

## Current implementation continuity

Until the Household Control milestones implement the new Home experience, the existing Overview behavior remains valid:

- primary balance-sheet metrics;
- current-month income, spending, and net cash flow;
- recent transactions;
- upcoming 14-day activity;
- spending categories;
- investment summary;
- net-worth trend;
- stale, partial, empty, and error states.

Existing metric links and current responsive ordering remain unchanged by documentation reconciliation.

## Data-state rules

### Loading

Use skeletons without rendering plausible zero values.

### Empty

Explain which source, planning decision, or budget configuration is missing and provide the relevant next action.

### Partial / qualified

Keep useful information visible, quantify missing coverage, lower confidence, and identify unresolved inputs.

### Unavailable / fail closed

Withhold a precise Safe-to-Spend number when critical balances, routing, currency, or material transaction meaning is unresolved. Explain how to restore it.

### Stale

Show the last reliable update and the effect of staleness on planning confidence.

### Error

Keep previously loaded data visible where safe, label it as non-current, and show a non-destructive recovery action.

## Interaction and navigation direction

Future conceptual links:

- Safe-to-Spend explanation → Plan projection/commitment detail;
- Transaction attention → Transactions Inbox;
- budget health → Plan budgets;
- upcoming/funding item → Plan Calendar detail;
- account/freshness issue → Accounts;
- Investments/Net Worth → Wealth.

Do not implement or delete routes as part of this specification update.

## Accessibility and responsive behavior

- Use text, signs, icons, labels, and explanations in addition to color.
- Preserve keyboard navigation and visible focus.
- Make qualified/unavailable states programmatically discernible.
- Ensure the Safe-to-Spend explanation is not available only through a chart or tooltip.
- Keep primary actions and amounts readable without horizontal overflow at narrow widths.
- Preserve Light, Dark, and System theme semantics.
