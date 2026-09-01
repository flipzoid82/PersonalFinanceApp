# Calendar and Cash-Flow Specification

## Purpose

The Calendar helps the owner understand what is expected to happen, when it may happen, which account receives or pays it, and whether the account is projected to have enough money.

The existing Calendar is a strong prediction/correction foundation. Household Control 3 extends it into a routed account projection without weakening its existing certainty semantics.

## Core principles

- Historical posting patterns may predict activity but do not establish contractual due dates.
- Predicted dates must never be presented as guaranteed due dates.
- Expected income is not posted income.
- A routed obligation is not automatically funded merely because household cash is positive.
- Transfers affect account balances but are not household spending.
- Every projection change must have source, date, amount, certainty, and inclusion lineage.
- No event or commitment may affect a projection twice.
- Existing Bills behavior, recurring streams, owner-confirmed corrections, and Calendar occurrences are one obligation foundation. A future Budget & Income Plan may attach allocation/reservation metadata but must not create a second unrelated obligation truth source.

## Existing views

### Month view

A calendar grid showing events on their effective predicted or confirmed dates.

### Upcoming list

A chronological accessible list for 14, 30, 60, or 90 days. Calendar defaults to 30 days; Home uses the most relevant near-term subset.

### Future account projection ledger

For each opted-in planning account, show a dated sequence of:

- starting current or authoritative available balance;
- unreconciled pending outflows when not already reflected;
- expected income;
- routed bills and obligations;
- planned transfer outflows/inflows;
- projected balance after each event;
- reserve floor and any breach;
- confidence/freshness state.

## Event types

- Bill
- Subscription
- Debt payment
- Credit-card payment
- Expected income
- Planned/internal transfer
- Other recurring event
- Owner-created future obligation

Budget and pay-cycle boundaries may appear as context but are not transactions or cash-flow events.

## Event fields

Each event should retain or ultimately support:

- name;
- event type;
- predicted posting date;
- confirmed due date, if known;
- expected amount and amount source;
- frequency;
- confidence;
- status;
- paying account for obligations;
- destination account for income;
- transfer source/destination when applicable;
- funding status;
- effect on projected account balance;
- last matching transaction;
- source/projection lineage;
- notes.

## Existing statuses

- Predicted
- Confirmed
- Paid
- Overdue
- Skipped
- Needs confirmation
- Inactive

These describe Calendar occurrence state and remain distinct from funding status.

## Funding statuses

- **Funded**
- **Expected to be funded by income**
- **Transfer required**
- **At risk**
- **Unfunded**
- **Uncertain**

Funding state must identify the paying account, projected balance, reserve floor, relevant date, and assumptions.

## Date semantics

### Predicted posting date

An inferred date based on historical posting behavior.

### Confirmed due date

An owner-confirmed or reliable contractual date. When both dates exist, show confirmed due date as primary and predicted posting date as supplemental context.

### Pay-cycle boundary

A planning boundary derived from an eligible expected-income event. It defines a useful projection/Safe-to-Spend horizon but does not itself create income.

All owner-facing period boundaries use the owner's configured planning time zone. Provider instants and contractual date-only values remain unchanged at their source boundary.

## Prediction and confidence

Recurring detection may use merchant/description similarity, interval consistency, typical day, amount stability, category, account, weekend/holiday drift, and recent continuity.

Confidence remains High, Medium, Low, or Needs confirmation. The exact threshold for including uncertain recurring events as future commitments remains to be resolved in Household Control 3.

Low-confidence or ambiguous activity must not silently become a hard commitment. A projected/estimated event remains labeled throughout Bills, Calendar, funding, and Safe-to-Spend.

## Account routing

### Income destination

Every expected income event included in account projections requires a destination planning account.

### Obligation payment account

Every obligation included in funding analysis requires the planning account expected to pay it. Missing routing produces Uncertain, not a fabricated funded state.

### Planned transfer

A planned transfer includes source account, destination account, amount, required date, state, and reason. It is a recommendation plus owner acknowledgment only and never initiates money movement.

Both legs enter their account projections exactly once. The transfer does not enter household income/spending.

## Projection starting balance and pending treatment

For an eligible planning account:

1. use a fresh institution available balance when it is authoritative; otherwise
2. use current balance minus unreconciled pending outflows.

Never subtract a pending outflow twice. Pending income does not increase current Safe-to-Spend. An eligible separately modeled expected-income event may enter a future projection according to its confidence policy.

## Paid matching and commitment release

When a posted transaction appears, the system may match it to one compatible event using stream identity, owner/account, currency, role/direction, amount, and date proximity.

- Pending, canceled, or removed transactions cannot mark an event paid.
- One posted transaction may satisfy at most one occurrence.
- Ambiguous matches require owner confirmation.
- A matched event releases/reconciles its future commitment so it is not subtracted again.
- A credit-card payment affects cash projection but does not duplicate the original card-purchase spending.

`CalendarEvent.linkedTransactionId` represents fulfillment of an occurrence. It is conceptually distinct from an HC1 `TransactionRelationship`, which links two source transactions as an internal transfer, credit-card payment, refund, or reimbursement. Calendar keeps its own match evidence, confidence, and confirmation semantics while consuming the canonical HC1 role/direction interpretation where relevant.

Commitment lineage is conceptually:

```text
existing bill or recurring obligation
  -> planning allocation/reservation
  -> Calendar occurrence
  -> fulfilling transaction
```

These are stages or interpretations of one economic commitment where applicable, not independent amounts to subtract.

## Overdue rules

An event may be overdue only when:

- it has a confirmed due date;
- no matching payment has been found;
- it is not skipped/inactive; and
- the confirmed due date has passed.

Predicted-only events are not overdue by default.

## Manual actions

Existing actions remain:

- confirm a predicted event;
- change due date, expected amount, or frequency;
- mark paid or skipped;
- mark not a bill;
- deactivate a recurring stream;
- add a manual recurring/future event.

Future Household Control actions add:

- choose income destination account;
- choose obligation payment account;
- set/review planning-account reserve floor;
- acknowledge or edit a planned transfer;
- inspect projection lineage and funding state.

## Filters and context

Retain filters for bills, subscriptions, debt payments, credit-card payments, expected income, confirmed/predicted, and needs confirmation. Future views may add planning account, funding state, pay cycle, and transfer-required filters.

## Empty, partial, and uncertain states

- No transaction history
- No recurring patterns detected
- No upcoming events in range
- Missing account routing
- Planning account unavailable or stale
- Amount/date uncertain
- Transfer source unavailable
- All predicted items dismissed

Partial data should remain useful with explicit confidence. Missing critical routing or balance data produces Uncertain rather than false precision.

## Accessibility

- Never rely on color alone.
- Preserve explicit Predicted, Confirmed, Paid, and funding-status labels.
- Keep month and list alternatives keyboard accessible.
- Make projection lineage available as text/table, not chart only.
- Preserve visible focus, responsive containment, and Light/Dark/System readability.
