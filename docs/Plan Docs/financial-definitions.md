# Financial Definitions

This document is the canonical source of truth for financial meaning and calculations. It covers existing reporting behavior and the approved Household Financial Control direction. Planned concepts are definitions for future milestones, not claims that the current schema or UI already implements them.

## Product and trust boundary

The app is an owner-only, private household financial control system through Safe-to-Spend V1. It is read-only with respect to financial institutions.

Provider and imported source data must never be mutated to express local meaning. Owner corrections, classifications, allocations, links, rules, notes, exclusions, confirmed dates, and planning policies are separate local data. Owner corrections always take precedence over inferred or provider-derived meaning.

All monetary calculations use exact Decimal arithmetic. A consolidated V1 planning result uses USD only. Non-USD activity may remain visible but cannot silently enter a USD Safe-to-Spend result.

## Existing balance-sheet metrics

### Total Cash

Total cash is the sum of current balances across eligible current depository accounts, including checking and savings.

```text
total_cash = sum(current_balance) for current checking/savings accounts
```

This reporting metric is not Safe-to-Spend. It does not by itself account for pending outflows, future obligations, reserves, budgets, routing, or freshness.

### Available Cash

Available cash is the sum of institution-provided available balances where those balances are present and authoritative. It must be shown separately from total cash.

An authoritative available balance may already reflect pending authorizations. Liquidity planning must never subtract the same pending outflow again.

### Total Debt

Total debt is the sum of outstanding balances across credit cards, loans, mortgages, and active manually tracked debts. Debt is displayed as a positive amount owed.

```text
total_debt = sum(balance_owed) for eligible debt accounts
```

### Total Investments

Total investments is the sum of one authoritative current value per eligible investment account. A latest applicable investment balance snapshot takes precedence over an account balance. Holdings are explanatory detail and are not added again.

Investments may come from supported provider sync, import, or manual entry. Investments are wealth, not spendable cash.

### Net Worth

```text
net_worth = total_assets - total_debt
```

Net worth is a long-term balance-sheet metric. It must never be used as a substitute for liquidity or Safe-to-Spend.

### Credit Utilization

```text
credit_utilization = total_credit_card_balance / total_credit_limit
```

Credit capacity is not cash and does not increase Safe-to-Spend.

## Transaction source and effective meaning

### Source transaction

A source transaction is the provider/imported observation as received: identifier, original description, merchant, amount, currency, dates, status, category, confidence, and reconciliation relationships. Source values remain immutable from owner-facing correction flows.

### Canonical effective transaction classification

The canonical effective classification is the single owner-scoped interpretation used consistently by Transactions, Overview, Spending, recurrence, budgets, projections, and Safe-to-Spend.

It includes:

- effective merchant/description;
- effective household category;
- effective financial role;
- classification source and version;
- confidence and evidence/reason;
- review state;
- local exclusion and notes;
- movement/refund links and split allocations where applicable.

Precedence is:

1. explicit owner correction;
2. owner-approved deterministic rule;
3. high-confidence deterministic system classification;
4. provider evidence;
5. unresolved/uncategorized.

The canonical classification must not create a second contradictory interpretation for recurrence or reporting.

### Classification confidence and provenance

Confidence describes how strongly evidence supports the effective role/category. Provenance identifies whether the value came from owner review, an owner rule, deterministic inference, or provider data, plus the applicable version/reason.

High-confidence deterministic classifications may enter live totals without manual review. Low-confidence, conflicting, ambiguous, high-impact, or structurally uncertain activity enters the Transaction Inbox.

Confidence thresholds remain an implementation decision until Household Control 1, but they must be deterministic, tested, explainable, and versioned.

### Transaction Inbox

The Transaction Inbox is an exception queue for activity requiring owner attention. It is not a second ledger and does not require review of every transaction.

An Inbox item must state why attention is needed and support the applicable role/category correction, split, movement pair, refund/reimbursement link, exclusion, or future deterministic rule.

### Financial roles

Effective roles include:

- Income
- Expense
- Transfer
- Refund or reimbursement
- Credit-card payment
- Investment activity
- Debt payment
- Ignored
- Uncategorized/unresolved

Roles determine financial meaning. Source amount sign alone is not a provider-neutral direction signal.

### Split transaction allocation

A split allocation assigns exact portions of one transaction to multiple household categories. In the transaction currency:

```text
sum(split allocation magnitudes) = reportable transaction magnitude
```

Splits do not create additional bank transactions or modify source data. Rounding remainders are not allowed to disappear; reconciliation must be exact at the supported currency precision.

### Internal transfer pair

An internal transfer pair links the outflow and inflow legs of money moved between household-owned accounts. The pair changes account balances but does not create household income or spending.

Unpaired or ambiguous movements remain visible and may require review. A paired transfer is counted once per account projection leg and zero times in household spending/income.

### Credit-card purchase and payment pair

A credit-card purchase creates spending when the purchase posts and is allocated to its expense category/categories.

The later checking-to-card payment is cash movement and debt settlement. It affects account projection and bill coverage but does not create the purchase expense again. Interest and fees are genuine expenses.

### Refund/reimbursement linkage

A linked refund or reimbursement reduces the relevant original allocation when the refund/reimbursement posts. V1 is cash-based: closed prior periods are not rewritten automatically, and reimbursements are not ordinary income by default.

If the original transaction was split, the owner/system must allocate the refund conservatively across the relevant original allocations. Unclear linkage enters review.

## Reporting activity

### Monthly Income

Monthly income includes posted inflows classified as genuine income during the selected calendar month in the planning time zone.

It excludes transfers, credit-card payments, refunds/reimbursements, loan proceeds, investment sale proceeds, ambiguous deposits, and pending income unless explicitly resolved under canonical classification.

### Monthly Spending

Monthly spending includes posted outflows classified as actual expenses during the selected calendar month, reduced by linked posted refunds/reimbursements under the cash-based policy.

It excludes internal transfers, credit-card payments, investment purchases, savings transfers, pending activity, and report-excluded activity.

### Net Cash Flow

```text
net_cash_flow = posted_income - posted_spending
```

This reporting metric is distinct from projected account cash flow and Safe-to-Spend.

### Pending versus posted

Pending transactions appear in activity and liquidity planning but not finalized income, spending, net cash flow, or historical reporting.

Liquidity planning applies this source-aware rule:

1. use a fresh authoritative institution available balance when appropriate; otherwise
2. use current balance minus unreconciled pending outflows.

Never subtract a pending outflow twice. Pending income never increases current Safe-to-Spend. Its posted replacement reconciles the pending item rather than creating another effect.

## Budget definitions

### Budget category

A budget category is a stable owner-controlled household purpose such as groceries, dining, utilities, or household essentials. It is independent of provider category codes, which may be evidence for classification.

The exact initial category taxonomy remains undecided.

### Budget allocation

A budget allocation is the exact amount assigned to a category for a defined period. V1 uses monthly allocations in the owner's planning time zone.

Budgets are plans, not bank balances. Allocating $500 to groceries does not move or reserve money at an institution.

### Fixed obligation

A fixed obligation is a non-discretionary or specifically dated commitment, such as rent, a mortgage, insurance, or a contractual debt payment. It is ordinarily represented through a routed Calendar event and must not also be subtracted as an indistinguishable flexible budget commitment.

### Flexible spending allocation

A flexible allocation is a category amount that may be consumed through discretionary transactions and may be explicitly reallocated when policy permits.

### Protected allocation and reserve

A protected allocation cannot be proposed as a source for a discretionary budget tradeoff. A reserve is protected liquidity retained in an account or at household level.

Neither a protected allocation nor a reserve is an expense. It reduces discretionary capacity without appearing as spending.

### Budget reallocation

A budget reallocation is an explicit, balanced, auditable movement of planned allowance from one category to another. It does not move bank money and does not create a transaction.

### Category spent and remaining

```text
category_spent = posted expense allocations
                   - linked posted refund/reimbursement allocations

category_remaining = allocation
                     + reallocation_in
                     - reallocation_out
                     - category_spent
```

### Spending pace

Spending pace compares budget consumption with elapsed time in the period.

```text
pace_ratio = percent_of_budget_consumed / percent_of_period_elapsed
```

The implementation must handle early-period instability, zero allocations, refunds, and incomplete classification coverage conservatively.

### Projected spending

Projected spending estimates end-of-period spending from reviewed/high-confidence activity and elapsed time. It must expose its method, coverage, and uncertainty and must not claim precision when data is insufficient.

### Budget period and rollover

V1 uses monthly allocations, weekly pace derived from the monthly plan, and pay-cycle cash-flow projections derived from expected income. Arbitrary custom calendars are deferred. Rollover requires an explicit owner action initially and is not automatic.

## Planning and cash-flow definitions

### Planning time zone

The planning time zone is the owner's configured local time zone used to derive budget periods, local due-date boundaries, pay-cycle horizons, and owner-facing date language. It does not rewrite provider timestamps or date-only contractual fields.

### Planning currency

The consolidated V1 planning currency is USD. Non-USD records remain visible but are excluded from consolidated budgets, projections, and Safe-to-Spend unless a future approved conversion model exists.

### Planning account

A planning account is an active, current checking or savings account the owner explicitly opts into household cash planning.

Investments, property, credit capacity, and unrelated debt capacity are never planning cash. A disconnected, inactive, unavailable, stale-critical, or non-USD account cannot silently contribute.

### Account reserve floor

An account reserve floor is the minimum protected balance the owner intends to retain in a planning account. An optional household reserve floor protects additional aggregate liquidity.

Default reserve amounts remain an owner/implementation decision; they must not be invented from account balances.

### Expected income

Expected income is a future Calendar event supported by recurring history, reliable provider data, import, or owner confirmation. It is distinct from posted income.

Pending income does not increase current Safe-to-Spend. Eligible expected income may enter a future dated projection according to its confidence/commitment policy. The exact uncertain-event threshold remains undecided.

### Routed obligation

A routed obligation is a bill, subscription, debt payment, credit-card payment, or other committed outflow assigned to the planning account expected to pay it.

It retains amount/date source, confidence, confirmed-versus-predicted state, and lineage. A predicted event is not equivalent to a confirmed obligation.

### Planned transfer

A planned transfer is an owner-acknowledged future movement with source account, destination account, amount, required date, status, and reason. It affects both account projections but not household income/spending.

V1 recommends and records acknowledgment only; it does not initiate the transfer.

### Projected account balance

A projected account balance is a dated sequence beginning from the eligible account's authoritative liquidity starting point and applying each included pending item, expected income event, routed obligation, and planned transfer exactly once.

Each projection row records source, amount, date, certainty, and whether it is included. A positive household total must not hide an account-specific deficit or reserve breach.

### Pay-cycle boundary

A pay-cycle boundary is derived from eligible expected income events and identifies the horizon until the next relevant income event. It is not a custom budget calendar and does not itself create income.

## Funding definitions

Every routed obligation receives one effective funding status:

- **Funded** — projected paying-account balance remains above required reserve after the obligation.
- **Expected to be funded by income** — an eligible expected income event reaches the relevant account before the obligation and supplies the needed capacity.
- **Transfer required** — another eligible account has capacity, but an explicit transfer is needed before the due date.
- **At risk** — projected funding is marginal, near a reserve floor, stale, or dependent on meaningful uncertainty.
- **Unfunded** — included accounts and eligible income cannot cover the obligation while preserving required reserves.
- **Uncertain** — critical routing, amount, date, freshness, classification, or currency information is missing or materially unresolved.

Funding status must identify the relevant account, date, projected balance, reserve, and assumptions.

## Commitments and deduplication

### Commitment

A commitment is a future or remaining amount deliberately excluded from discretionary capacity. It may arise from a routed obligation, remaining flexible budget allowance for the Safe-to-Spend horizon, planned transfer requirement, or protected reserve policy.

A commitment is not necessarily an expense or transaction.

### Commitment deduplication

Each economic commitment must have lineage and a stable identity sufficient to prevent double subtraction.

Examples:

- a mortgage cannot be subtracted once as a Calendar obligation and again as the same fixed budget amount;
- a pending card purchase cannot be subtracted from an authoritative available balance and again as a pending outflow;
- both legs of a transfer cannot reduce household cash;
- a posted transaction cannot remain reserved as an unmatched future occurrence;
- a protected reserve is subtracted once, not per overlapping view.

## Safe-to-Spend

### Definition

Safe-to-Spend is the maximum discretionary amount the household can spend during a stated horizon without causing a routed obligation to become unfunded, violating account/household reserve floors, or exceeding the applicable household budget commitments.

It is not total cash, available cash, net worth, credit capacity, or a bank balance.

### Safe-to-Spend horizon

The primary V1 horizon is until the next relevant eligible expected-income event. The result must state its exact through-date and the event/assumption defining that boundary.

### Conceptual calculation

```text
eligible starting liquidity by planning account
- pending outflows not already reflected in authoritative available balance
+ eligible expected income before the horizon
- routed obligations before the horizon
± planned internal transfers by account
- account and household reserve floors
- remaining flexible budget commitments for the horizon
= projected discretionary capacity
```

The consolidated household result must respect account routing. Capacity in one account does not cure a paying-account gap unless an achievable planned transfer is included.

### Coverage and partial uncertainty

Minor unresolved classification or split coverage does not automatically prohibit a useful result. The app may present a qualified result with explicit classified percentage, unresolved count/amount, and confidence when the unresolved exposure is not material.

Material unresolved activity, missing critical routing, stale critical balances, unsupported currency, or an unreconciled funding gap must fail closed or produce a clearly non-authoritative state. The product must not create false precision.

### Explainability

The owner must be able to inspect every included balance, pending item, income event, obligation, transfer, reserve, budget commitment, excluded item, freshness timestamp, confidence, and deduplication decision. The displayed result must be reproducible from that lineage.

## Calendar and recurring definitions

### Recurring bill or income stream

A recurring stream is a detected or owner-created repeating bill, subscription, transfer, debt/card payment, income source, or other event. It retains frequency, typical amount, expected date, confidence, and active state.

### Predicted posting date

A predicted posting date is inferred from historical transaction timing. It is not a contractual due date.

### Confirmed due date

A confirmed due date is explicitly entered/confirmed by the owner or obtained from a reliable contractual source. It takes presentation precedence over a predicted posting date while both remain auditable.

### Expected amount

An expected amount may be fixed, estimated, last observed, provider supplied, imported, or owner entered. Variable/estimated values remain labeled.

### Paid matching and overdue

A posted transaction may satisfy at most one compatible Calendar occurrence. Pending or canceled activity cannot satisfy it. Predicted-only events are not marked overdue merely because their inferred date passed; overdue requires a confirmed due date and no matched payment.

## Freshness and confidence rules

- Every synced, imported, inferred, manual, projected, or calculated value identifies its source and last relevant update.
- Current, available, pending, expected, projected, predicted, confirmed, reviewed, and estimated states remain distinct.
- Critical stale planning-account data reduces confidence or prevents authoritative Safe-to-Spend.
- Predicted Calendar events are not equivalent to confirmed obligations.
- Expected income is not posted income.
- Budgets are not bank balances.
- Reserves are not expenses.
- A commitment is never subtracted twice.
- Every warning and recommendation states what evidence and assumptions produced it.

The precise freshness windows, classification thresholds, warning thresholds, default reserve amounts, and uncertain recurring-event inclusion threshold are resolved in their owning implementation milestones and must be documented and tested before use.
