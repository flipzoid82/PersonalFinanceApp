# Overview Dashboard Specification

## Purpose

The Overview page should answer the user's most important financial questions without requiring navigation.

## Desktop Layout

### Header

- App name
- Last refreshed time
- Refresh action
- Account connection warning when needed

### Primary Metrics Row

1. Net Worth
2. Cash
3. Credit Card Debt
4. Investments

### Monthly Metrics Row

1. Income This Month
2. Spending This Month
3. Net Cash Flow
4. Upcoming Bills

### Main Panels

- Net Worth Trend
- Account Balances
- Recent Transactions
- Spending by Category
- Upcoming Activity
- Data Freshness and Connection Status

## Mobile Layout

One card per row, ordered:

1. Net Worth
2. Cash
3. Credit Card Debt
4. Upcoming Bills
5. Income This Month
6. Spending This Month
7. Net Cash Flow
8. Investments

## Default Ranges

- Monthly metrics: current calendar month
- Upcoming activity: next 14 days
- Recent transactions: last 30 days
- Net-worth trend: last 30 days
- Spending comparison: current month versus previous month

## Click Behavior

- Net Worth → Net Worth page
- Cash → Accounts filtered to cash
- Credit Card Debt → Accounts filtered to credit cards
- Investments → Investments page
- Income, spending, or cash flow → Spending page with relevant filter
- Upcoming Bills → Calendar page in upcoming-list view
- Account row → Account detail
- Transaction row → Transaction detail

## Upcoming Bills Card

Show:

- Total expected amount in the next 14 days
- Number of upcoming events
- Nearest due or predicted date
- Confirmed versus predicted indicator
- Link to full calendar

## Data State Rules

### Loading

Use skeleton cards and panels without showing zero values.

### Empty

Explain what source is missing and provide the relevant action.

### Stale

Show the last successful sync, import, or manual update time.

### Partial

Label totals as incomplete and identify excluded or unavailable sources.

### Error

Keep previously loaded data visible where safe and show a non-destructive warning.

## Data Source Labels

- Synced
- Imported
- Manual
- Predicted
- Confirmed
