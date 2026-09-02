# Product Requirements

## Product purpose

The application is an owner-only household financial control system with two complementary purposes:

1. bounded complete financial awareness across approved accounts, transactions, assets, debts, investments, obligations, imports, and planning information; and
2. active income planning and budgeting that helps the owner decide what available and expected money needs to accomplish.

“Complete” does not imply tax preparation, insurance or estate optimization, trading or investment advice, legal advice, or another financial domain that the approved roadmap does not include. The app helps the owner understand what happened, what is happening, what is about to happen, and what the household can safely do next.

The product's north-star question is:

> **What can we safely spend right now without creating a problem later?**

The app must be more than a passive transaction ledger or wealth dashboard. It should combine reviewed transaction meaning, realistic budgets, upcoming income and obligations, account routing, protected reserves, and data confidence into timely, explainable decisions.

## V1 user and security boundary

Safe-to-Spend V1 remains private and owner-only.

- One authenticated owner controls all financial data, planning choices, corrections, and acknowledgments.
- Multi-user household authorization, invitations, shared permissions, and member-specific visibility are later capabilities.
- “Household” describes the financial plan and outcome; it does not imply that multiple people can sign in during V1.
- The app remains read-only with respect to financial institutions. Transfer recommendations do not initiate money movement.

## Four awareness states

The application should continuously answer:

1. **What happened** — posted income, spending, transfers, refunds, and corrections.
2. **What is happening** — pending activity, current budget health, unresolved transactions, and current data freshness.
3. **What is about to happen** — expected income, bills, transfers, projected balances, and funding gaps.
4. **What can safely be done next** — explainable Safe-to-Spend and the actions or uncertainties that affect it.

## Primary owner outcomes

The first useful household-control version must answer:

1. Where did my money go?
2. What needs attention?
3. How much is left in each budget?
4. Am I spending too fast?
5. What income and bills are next?
6. Which account receives or pays each item?
7. Will that account have enough?
8. Do I need to move money?
9. What can I safely spend?
10. Why is that the number?

## Product principles

### Awareness before analysis

Important constraints and upcoming problems should be visible without requiring the owner to interpret a collection of charts.

### Forward-looking and account-specific

Historical reporting is necessary but insufficient. Upcoming activity must be routed to the account that receives or pays it so the app can identify a local funding problem even when total household cash appears adequate.

### Money in an account is not necessarily available money

The product must distinguish current balance, authoritative available balance, pending activity, future commitments, account and household reserve floors, and money that is genuinely safe to spend.

### Transaction truth before confident recommendations

Provider data is useful source evidence, not unquestioned financial meaning. The app must preserve source data, derive one auditable effective classification, ask for review when material uncertainty remains, and let owner corrections win.

### Useful under partial uncertainty

Minor unresolved activity should not make the product unusable. Safe-to-Spend may be shown with explicit coverage and reduced confidence when unresolved activity is immaterial. Critical stale, incomplete, unsupported-currency, or materially unresolved inputs must fail closed rather than create false precision.

### Explainability

Every budget state, projection, funding warning, and Safe-to-Spend result must identify the balances, transactions, obligations, income events, transfers, reserves, assumptions, freshness, and confidence that produced it.

### No double counting

Transfers, credit-card payments, pending-to-posted replacements, refunds, budget allocations, Calendar commitments, planned saving, funding transfers, and reserve protection must be reconciled so the same economic commitment reduces financial capacity at most once.

## Household-control capabilities

### Connected accounts and normalized activity

Plaid remains the primary provider for supported checking, savings, credit-card, and loan accounts. The app must preserve provider identifiers and values, reconcile pending and posted activity, retain disconnected history, prevent duplicate logical accounts, and clearly communicate freshness.

The owner opts specific checking and savings accounts into household planning. Investments, credit capacity, property, and unrelated debt capacity are never spendable cash.

### Transaction truth and review

Every eligible transaction should resolve through one canonical effective interpretation with provenance and deterministic certainty states:

- merchant or description;
- stable transaction-purpose category where its role requires one;
- financial role, including income, expense, transfer, refund-like reimbursement, credit-card payment, investment activity, debt payment, borrowing proceeds, ignored, or unresolved;
- source-aware account-level economic direction: inflow, outflow, or unknown;
- pending, posted, or canceled status;
- whether it is linked to another movement or refund;
- whether it has split category allocations;
- whether owner review is required.

Explicit owner decisions, owner-confirmed deterministic rules, and unambiguous versioned system mappings may enter live totals automatically. Provider-only, conflicting, ambiguous, unsupported, or structurally uncertain activity enters a lightweight Transaction Inbox. Amount may affect attention and ordering but does not by itself invalidate a resolved transaction or block reporting. Owner corrections always take precedence without mutating provider data.

The Inbox must support role/category review, exact split allocations, transfer and card-payment pairing, refund/reimbursement linkage, exclusion, and narrowly scoped deterministic rules for future similar activity.

### Budget and income planning

Household Control 2 provides a prominent planning command center, provisionally called **Budget & Plan**. It supports planned income, spending allocations, fixed obligations, protected planning allocations, generic planned saving, generic owner-entered extra debt-principal allocation, and intentionally unassigned income. Zero-based budgeting is supported but optional; the owner may retain an explicit buffer.

Expected or planned income supports a future plan but does not become current liquidity or increase current Safe-to-Spend. A planned savings allocation reduces discretionary planning capacity but does not prove that saving has been funded. Funding requires approved evidence such as an authoritative balance state, reconciled transfer, or explicit owner-confirmed funding event.

Calendar-backed expected-income occurrences are planning suggestions, not automatic plan entries. Confirmed and predicted income both require an explicit owner inclusion action, and predicted income retains its confidence label. A plan retains the owner-approved amount and source lineage; later Calendar changes are shown as reconciliation differences rather than silently rewriting the plan. Manual planned income remains supported.

Stable HC1 transaction-purpose categories describe what actual activity was for. HC2 planning destinations describe what planned income is intended to accomplish. Savings, reserves, goals, and extra debt principal are planning destinations, not fabricated spending categories.

V1 supports monthly allocations in one explicitly owner-confirmed IANA planning time zone. HC2 and existing month-based Overview and Spending reporting use the same owner-local month boundaries so “this month” has one meaning. Provider timestamps and Calendar date-only values remain unchanged at their source boundaries.

For each category, show:

- allocated amount;
- posted spending and linked refunds/reimbursements;
- amount remaining;
- percentage consumed;
- time remaining;
- weekly spending pace derived from the monthly plan;
- projected end-of-period spending and projected over/under amount;
- classification coverage and confidence;
- transactions that produced the result.

Allocations may be fixed, flexible, or protected. Reallocation between flexible categories is explicit and auditable. Rollover is explicit initially, not automatic. An accepted rollover is a separately identified signed opening category balance, not current-period planned income, current liquidity, or proof of funding. It changes category availability while leaving the current-period planned-income reconciliation unchanged. Positive carryover remains owner-declared and funding-unverified until later routing/funding work can establish it; negative carryover reduces category availability. Arbitrary custom budget calendars are outside V1.

### Recurring income and expenses

The existing recurring engine remains the basis for expected income, bills, subscriptions, debt payments, credit-card payments, and recurring transfers. HC2 planning must reuse or explicitly reconcile with existing Bills behavior, recurring streams, and Calendar occurrences rather than create a second independent obligation truth source.

A Calendar-backed fixed obligation is one planning commitment. When it also references an HC1 transaction-purpose category, its planned amount contributes to that category allocation once and its eventual posted transaction contributes to category spending once. Bills, Calendar, category presentation, and payment fulfillment are views or stages of that same lineage, not independent deductions.

Recurring items retain typical and expected amounts, frequency and expected date, prediction confidence, predicted posting date versus confirmed due date, active/inactive and review state, and owner correction precedence.

Predicted activity must never be presented as guaranteed. Low-confidence or ambiguous recurrence must not silently become a hard commitment.

### Routed financial Calendar

The Calendar should identify:

- the account expected to receive each income event;
- the account expected to pay each obligation;
- planned internal transfers and their source/destination accounts;
- budget and pay-cycle boundaries;
- current and projected balance changes by account;
- the source and certainty of each projected change.

Existing predicted-versus-confirmed, due-date-versus-posting-date, matching, paid, skipped, and overdue semantics remain authoritative.

### Projected balances and funding status

For each opted-in planning account, the app should project balances across upcoming dated activity using exact money arithmetic and an explicit pending-activity policy.

Every upcoming obligation should have one of these funding states:

- Funded
- Expected to be funded by income
- Transfer required
- At risk
- Unfunded
- Uncertain

A positive household total must not conceal an account-specific shortfall. Transfer recommendations identify a source, destination, amount, and required date, but movement remains an explicit owner action.

### Safe-to-Spend

Safe-to-Spend is the product's north-star output. It answers how much can be spent during a stated horizon without compromising routed obligations, protected reserves, or the household budget.

V1 supports household Safe-to-Spend, account-level projected discretionary capacity, Safe-to-Spend until the next relevant income event, a proposed-purchase check, and a complete explanation of available cash, commitments, reserves, budget allowances, planned transfers, unresolved coverage, freshness, and confidence.

The calculation must use only opted-in USD planning accounts. Non-USD activity may remain visible but must not silently enter the consolidated result.

If unresolved classification or split coverage is not material, the app may show a useful number with clear qualification, for example:

> Safe to spend: $640<br>
> Based on 97% classified spending. Two transactions totaling $84 still need review.

If critical data is stale, account routing is missing, or unresolved activity is material, the app must withhold or qualify the number and explain what must be resolved.

### Freshness, confidence, and lineage

The owner must be able to distinguish institution current versus available balance, pending versus posted transaction, expected versus posted income, predicted versus confirmed obligation, fresh versus stale account data, reviewed versus inferred classification, and complete versus partial calculation coverage.

No recommendation may present estimated, stale, or incomplete inputs as certain.

## Future Home / Today direction

The primary future landing experience should emphasize:

1. Safe to Spend
2. Actions needed
3. Upcoming income and bills
4. Budget health and spending pace
5. Funding gaps and transfer needs
6. Transactions needing review
7. Freshness, confidence, and calculation coverage

Longer-term wealth and net-worth information remains available but secondary to near-term household control.

## Intended future information architecture

The intended direction is:

1. **Home** — Safe-to-Spend, actions, upcoming activity, budget health, and confidence.
2. **Transactions** — Transaction Inbox and complete ledger.
3. **Budget & Plan** — provisional label for budgets, bills, Calendar, cash-flow projections, goals, and funding gaps. Final navigation wording remains a later UX decision.
4. **Accounts** — balances, connection health, planning participation, routing, and reserves.
5. **Wealth** — Investments and Net Worth.
6. **Settings** — connections, imports, theme, session, and preferences.

Existing routes remain valid until a separately approved implementation milestone changes navigation.

## Secondary retained capabilities

### Investments and Net Worth

Investment accounts, holdings, balance snapshots, contribution activity, allocation, current net worth, and historical net-worth views remain supported. They are valuable long-term context but do not increase Safe-to-Spend.

The product does not provide trading, tax optimization, retirement advice, or investment recommendations.

### Imports

Milestone 11 statement/CSV imports remain secondary Settings functionality. Milestone 11 is stabilized, checkpointed, and frozen; retained, secondary, Settings-based, independent of Household Control milestones, and not a prerequisite for Household Control 1. Do not add document families or expand import scope.

### Manual assets and debts

Manual property, vehicles, assets, mortgages, loans, debts, accounts, and snapshots remain available for wealth reporting. They do not become spendable cash unless represented by an opted-in liquid planning account.

Debt tracking is an approved later capability for credit cards, auto loans, mortgages, student loans, personal loans, manual debts, and other approved debt types. Current Accounts and Net Worth may continue showing supported debt balances. HC5 owns the dedicated Debt Tracker experience, balance/paydown progress where sufficient authoritative or historical evidence exists, named payoff goals, payoff projections, and debt-versus-saving tradeoffs. Provider balances, owner-entered contractual facts, calculated projections, estimates, confirmed values, and freshness must remain visibly distinct. If evidence is insufficient to calculate progress reliably, show the available balance/history without fabricating progress. The app must never invent APR, interest rate, minimum payment, original principal, due date, maturity, payoff term, statement balance, or another contractual fact.

## Later capabilities

The following follow the first useful Safe-to-Spend version:

- named savings and debt goals;
- sinking funds and irregular-expense planning;
- target amounts and dates, required contributions, progress, feasibility, and scenario tradeoffs;
- debt payoff projections and explicit debt-versus-saving tradeoffs;
- in-app warning records and lifecycle;
- budget-pace, reserve, funding, and stale-data warnings;
- weekly household digest;
- external warning delivery after scheduler and security design;
- household membership, permissions, and privacy-safe summaries;
- deeper forecasting and recommendations.

## Out of scope through Safe-to-Spend V1

- multi-user household authentication or invitations;
- automated bank transfers or bill payments;
- automatic budget rollover;
- arbitrary custom budget calendars;
- ML/AI financial classification or advice;
- multi-currency conversion in consolidated planning;
- push/email delivery before operational scheduling and security approval;
- tax preparation, bookkeeping, trading, or automated investing;
- stochastic long-range forecasting;
- new Milestone 11 document families or parser expansion.
