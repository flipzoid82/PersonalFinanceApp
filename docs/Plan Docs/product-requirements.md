# Product Requirements

## Product Summary

A single-user, private personal-finance web app that provides an at-a-glance view of accounts, balances, debt, spending, bills, cash flow, investments, bill timing, and net worth.

## Primary User

The app is designed for one person using their own financial data. Multi-user access, household sharing, invitations, and role permissions are outside the MVP.

## Primary Questions the App Must Answer

1. How much cash is available?
2. How much debt is outstanding?
3. What bills are coming up and when?
4. Where is money being spent?
5. What are the user's investments worth?
6. Is the user's financial position improving or getting worse?

## MVP Navigation

- Overview
- Accounts
- Transactions
- Bills
- Calendar
- Spending
- Investments
- Net Worth
- Settings

## MVP Data Sources

The first version should support a mix of automatic, manual, and imported data sources.

### Automatic via Plaid

Plaid is the primary provider for supported banks, credit cards, and loans.

Expected Plaid-connected institutions:

- Navy Federal Credit Union
- CIT Bank
- U.S. Bank

### Manual or Imported Fidelity Data

Fidelity and Fidelity NetBenefits should not be assumed to work through Plaid.

The MVP must support Fidelity investment accounts through manual balance tracking and CSV or statement import.

Known Fidelity accounts to support:

- Fidelity Individual TOD
- UnitedHealth Contribution
- UnitedHealth Group 401(k) Savings Plan

Automatic Fidelity syncing is a future enhancement unless an approved provider is confirmed.

### Manual Assets and Debts

The MVP should support manual entry for assets and debts that are not available through Plaid or import.

Examples:

- Home value
- Vehicles
- Mortgage
- Private loans
- Other manually tracked assets or debts

## Overview Requirements

The Overview page should display:

- Net worth
- Total cash
- Available cash
- Total debt
- Credit utilization
- Total investments
- Income this month
- Spending this month
- Net cash flow
- Upcoming bills
- Recent transactions
- Spending by category
- Account sync status
- Data freshness indicators

## Recommended Overview Layout

### Top Row

- Net Worth
- Cash
- Credit Card Debt
- Investments

### Second Row

- Income This Month
- Spending This Month
- Net Cash Flow
- Upcoming Bills

### Main Content

- Net Worth Trend
- Account Balances
- Recent Transactions
- Spending by Category
- Upcoming Activity
- Data Freshness and Connection Status

## Accounts Requirements

The Accounts page should support:

- Checking
- Savings
- Credit cards
- Loans
- Investment accounts
- 401(k) accounts
- Mortgage
- Property
- Vehicles
- Other assets and debts

Each account should show:

- Account name
- Institution or data source
- Account type
- Current balance
- Available balance where applicable
- Credit limit where applicable
- Last updated time
- Connection or import status
- Recent activity where available

## Transactions Requirements

The Transactions page should support:

- Search by merchant or description
- Filters for date, account, category, amount, and status
- Pending and posted indicators
- Transfer indicators
- Notes
- Category overrides
- Financial-role overrides
- Exclusion from reporting

## Bills Requirements

The Bills page should show:

- Active recurring outflows
- Predicted next charge date
- Confirmed due date where available
- Typical amount
- Frequency
- Merchant or biller
- Account charged
- Active or inactive status
- Prediction confidence
- Expected income in a separate section

## Calendar Requirements

The Calendar page should provide:

- Month view
- Upcoming-list view
- Predicted bills based on historical transaction patterns
- Confirmed due dates entered by the user
- Expected charge amounts
- Predicted versus confirmed labels
- Confidence levels
- Paid, overdue, skipped, and needs-confirmation states
- Filters for bills, subscriptions, debt payments, and expected income
- Manual corrections for date and amount
- A distinction between contractual due dates and historically observed posting dates

The calendar must never present inferred dates as guaranteed due dates.

## Spending Requirements

The Spending page should show:

- Spending by category
- Monthly comparisons
- Income versus expenses
- Merchant totals
- Largest purchases
- Unusual spending
- Monthly trends

## Investments Requirements

The Investments page should show:

- Total investment value
- Investment accounts
- Holdings where available
- Manual balance snapshots
- Imported Fidelity balances and holdings
- Allocation by account or holding where available
- Contribution activity where available
- Whether each value is synced, imported, or manually entered

The MVP does not need to support trading, retirement projections, tax optimization, or investment advice.

## Net Worth Requirements

The Net Worth page should combine:

- Cash accounts
- Investments
- Property
- Vehicles
- Other assets
- Credit cards
- Mortgage
- Loans
- Other debts

It should show current net worth and historical change.

## Product Principles

- Read-only with respect to financial institutions
- Private by default
- Clear data freshness indicators
- Pending transactions handled separately
- Transfers not double-counted
- Credit-card payments not counted as spending
- Investments included in net worth
- Inferred bill dates clearly labeled as predictions
- Useful even when some accounts are disconnected
- User overrides stored separately from provider data
- Provider-specific integrations hidden behind a normalized internal model

## Out of Scope for MVP

- Tax preparation
- Bill payment
- Money transfers
- Automated investing
- Full accounting or bookkeeping
- Shared household accounts
- AI financial advice
- Credit-score monitoring
- Advanced forecasting
- Direct Fidelity Access integration unless approval is already confirmed
