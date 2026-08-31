# Plaid Integration

## Purpose

Plaid is the primary integration for supported banks, credit cards, and loans.

Fidelity and Fidelity NetBenefits must not be assumed to work through Plaid.

## Plaid Responsibilities

- Account discovery
- Balance syncing
- Transaction syncing
- Supported liability data
- Recurring transaction candidates where available
- Webhook-driven updates

Plaid supplies source evidence. Provider categories and confidence may inform the canonical effective classification, but they do not overwrite owner corrections or establish a second reporting definition.

## Bill Calendar Inputs

Plaid transaction history may be used to infer recurring bills and posting patterns.

Plaid-derived dates should be labeled as predicted unless a reliable due date is explicitly provided.

The app must distinguish:

- Observed transaction posting date
- Predicted next posting date
- Confirmed contractual due date

Future routed cash-flow planning may use Plaid observations only through the same normalized, owner-scoped recurrence and Calendar semantics. Low-confidence provider evidence must not silently become a confirmed obligation or expected income commitment.

## Household planning boundary

- The owner explicitly opts current checking/savings accounts into planning.
- Investments, credit limits, property, and debt capacity do not increase Safe-to-Spend.
- Consolidated V1 planning is USD-only; non-USD Plaid activity remains visible but excluded from the consolidated result.
- A fresh authoritative available balance may be the liquidity starting point.
- Otherwise the current balance is reduced by unreconciled pending outflows.
- The same pending outflow must never be subtracted from an available balance twice.
- Pending income does not increase current Safe-to-Spend.
- Pending-to-posted reconciliation must preserve classification/allocation relationships without creating a second effect.
- Internal transfer and credit-card-payment pairing changes account projections but not household spending.
- Data freshness and connection health must qualify or block planning outputs when critical.

## Development Environments

### Sandbox

Use fake institutions and fake financial data during development and automated testing.

### Production Trial

Use real institutions only after the complete flow has been tested in Sandbox.

## Core Flow

1. Create a Link token.
2. Open Plaid Link.
3. Authenticate with an institution.
4. Receive a public token.
5. Exchange it server-side for an access token and Item ID.
6. Encrypt and store the access token.
7. Synchronize normalized account and transaction data.
8. Process webhooks.

## Security Requirements

- Never expose Plaid access tokens to the browser.
- Encrypt access tokens at rest.
- Store secrets only in server environment variables.
- Validate webhook authenticity.
- Avoid logging secrets.
- Provide repair mode for expired credentials.
- Avoid casually deleting Production Items.

## Fidelity / NetBenefits Decision

Known Fidelity accounts:

- Fidelity Individual TOD
- UnitedHealth Contribution
- UnitedHealth Group 401(k) Savings Plan

MVP path:

1. Manual balance entry
2. Fidelity CSV or statement import
3. Provider-neutral model for future automatic sync

## Fallbacks

- CSV imports
- Manual accounts
- Manual investment balances
- Manual assets and debts
- User-confirmed bill due dates
