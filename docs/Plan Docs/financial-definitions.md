# Financial Definitions

This document defines how the personal finance dashboard calculates and displays financial metrics. These rules are the source of truth for implementation.

## Product Scope

The app is a single-user, private personal-finance dashboard for personal use only.

The app is read-only with respect to real financial institutions. Imported or synced provider data must never be mutated directly. User corrections, category overrides, notes, exclusions, confirmed bill dates, and calendar overrides are stored separately as local app data.

## Core Metrics

### Total Cash

Total cash is the sum of current balances across depository accounts, including checking and savings accounts.

Available cash should be shown separately when the institution provides available balances.

```text
total_cash = sum(current_balance) for accounts where type is checking or savings
available_cash = sum(available_balance) for accounts where available_balance is present
```

### Total Debt

Total debt is the sum of outstanding balances across credit cards, loans, mortgages, and manually tracked debts.

Debt should be displayed as a positive amount owed.

```text
total_debt = sum(balance_owed) for debt accounts
```

### Total Investments

Total investments is the sum of current values across investment accounts, retirement accounts, 401(k) accounts, brokerage accounts, and other investment holdings.

Investment values may come from:

- Plaid or another supported provider
- CSV or statement import
- Manual balance entry

Known Fidelity investment accounts should be included even if they are manual or imported:

- Fidelity Individual TOD
- UnitedHealth Contribution
- UnitedHealth Group 401(k) Savings Plan

```text
total_investments = sum(current_value) for investment accounts and investment holdings
```

### Net Worth

Net worth is total assets minus total debts.

```text
net_worth = total_assets - total_debt
```

### Monthly Income

Monthly income includes posted inflows classified as genuine income during the selected calendar month.

Monthly income excludes transfers, credit-card payments, refunds, loan proceeds, investment sale proceeds, and ambiguous deposits unless confirmed as income.

Pending transactions are excluded from finalized income totals.

### Monthly Spending

Monthly spending includes posted outflows during the selected calendar month that represent actual expenses.

Monthly spending excludes transfers, credit-card payments, investment purchases, savings transfers, and pending transactions in finalized totals.

Credit-card purchases count as spending when the purchase posts. The later payment to the credit card is treated as a transfer, not a second expense.

### Net Cash Flow

```text
net_cash_flow = monthly_income - monthly_spending
```

### Credit Utilization

```text
credit_utilization = total_credit_card_balance / total_credit_limit
```

The app should show both total utilization and per-card utilization.

## Bill and Calendar Definitions

### Recurring Bill

A recurring bill is a repeating outflow associated with a merchant, biller, debt, subscription, or service.

### Predicted Charge Date

A predicted charge date is inferred from historical transaction timing.

It is not necessarily the contractual due date.

### Confirmed Due Date

A confirmed due date is a date entered or explicitly confirmed by the user, or obtained from a reliable liability or bill source.

When both exist, the app should show the confirmed due date as primary and may show the predicted posting date separately.

### Expected Amount

The expected amount may be derived from:

- Recent recurring amount
- Average historical amount
- User-entered fixed amount
- User-entered estimate

Variable bills should be clearly labeled as estimates.

### Prediction Confidence

Each inferred recurring event should have a confidence level such as:

- High
- Medium
- Low
- Needs confirmation

Confidence should consider:

- Number of matching historical occurrences
- Consistency of intervals
- Consistency of merchant identity
- Amount stability
- Day-of-month stability
- Weekend or holiday shifts
- Recent pattern changes

### Bill Status

Supported calendar states:

- Predicted
- Confirmed
- Paid
- Overdue
- Skipped
- Needs confirmation
- Inactive

A predicted item should become paid when a matching posted transaction is linked to it.

## Investment Classification

Investment purchases should not count as monthly spending. They are conversions from cash to investment assets.

Investment sales should not count as monthly income by default.

401(k) contributions should not be double-counted.

## Transaction Classification

Each transaction should be classified into one of the following financial roles:

- Income
- Expense
- Transfer
- Refund
- Credit-card payment
- Investment activity
- Debt payment
- Ignored
- Uncategorized

Provider category data may be used as a starting point, but local user overrides take precedence.

## Pending vs Posted Transactions

Pending transactions should appear in recent activity, account detail pages, and available-cash projections.

Pending transactions should not appear in finalized monthly income, spending, net cash flow, or historical reporting totals.

## Transfers

Transfers should appear in the transaction ledger but should not count as income or spending.

## Credit-Card Payments

Credit-card payments do not count as spending.

## Manual Overrides

The app must support local user overrides for:

- Merchant name
- Category
- Financial role
- Notes
- Excluded-from-reports flag
- Linked refund or reimbursement relationship
- Confirmed bill due date
- Expected bill amount
- Recurring frequency
- Recurring status
- Not-a-bill classification

Manual overrides must not modify original provider data.

## Data Freshness

Every dashboard using synced, imported, inferred, or manually entered data should show when its underlying data was last updated.

## MVP Defaults

- Current balances
- Current calendar month
- Posted transactions for finalized totals
- Pending transactions shown separately
- Upcoming bills for the next 14 days
- Calendar month view
- Net-worth trend for the last 30 days
- Spending compared with the previous month
- Investment balances included in net worth
