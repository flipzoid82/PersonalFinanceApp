# Calendar Specification

## Purpose

The Calendar page helps the user understand when bills, subscriptions, debt payments, and expected income are likely to occur.

## Core Principle

Historical transactions can predict when a charge is likely to post, but they do not always reveal the contractual due date.

Predicted dates must never be presented as guaranteed due dates.

## Views

### Month View

A traditional monthly calendar showing events on their expected or confirmed dates.

### Upcoming List

A chronological list for the next:

- 14 days
- 30 days
- 60 days
- 90 days

Default: 30 days on the Calendar page and 14 days on Overview.

## Event Types

- Bill
- Subscription
- Debt payment
- Credit-card payment
- Expected income
- Other recurring event

## Event Fields

Each event should display:

- Name
- Event type
- Date
- Date label: predicted or confirmed
- Expected amount
- Amount label: fixed, estimated, or last observed
- Account normally charged or credited
- Frequency
- Confidence level
- Status
- Last matching transaction
- Notes

## Statuses

- Predicted
- Confirmed
- Paid
- Overdue
- Skipped
- Needs confirmation
- Inactive

## Prediction Inputs

The recurring engine may consider:

- Merchant similarity
- Transaction description similarity
- Historical interval consistency
- Typical day of month
- Amount stability
- Category
- Account charged
- Weekend and holiday shifts
- Recent schedule changes

## Confidence Levels

### High

Use when multiple occurrences show a consistent merchant, interval, and date pattern.

### Medium

Use when the pattern is likely recurring but has date or amount variability.

### Low

Use when there are too few occurrences or substantial inconsistency.

### Needs Confirmation

Use when the system cannot safely distinguish a bill from another repeated transaction.

## Due Date vs Posting Date

The UI should support both:

- Confirmed due date
- Predicted posting date

When both exist, display the confirmed due date prominently and the predicted posting date as supplemental context.

## Manual Actions

The user can:

- Confirm a predicted bill
- Change the due date
- Change the expected amount
- Change frequency
- Mark as paid
- Mark as skipped
- Mark as not a bill
- Deactivate a recurring stream
- Add a manual recurring event

## Paid Matching

When a posted transaction appears, the system should attempt to match it to an event using:

- Merchant
- Amount tolerance
- Account
- Date proximity
- Recurring stream identity

Low-confidence matches require confirmation.

## Overdue Rules

An event may be marked overdue only when:

- It has a confirmed due date, and
- No matching payment has been found, and
- The due date has passed

Predicted-only events should not be labeled overdue by default.

## Filters

- Bills
- Subscriptions
- Debt payments
- Credit-card payments
- Expected income
- Confirmed only
- Predicted only
- Needs confirmation

## Empty States

- No history yet
- No recurring patterns detected
- No upcoming events in selected range
- All predicted items dismissed

## Accessibility

- Do not rely on color alone
- Use text labels and icons for status
- Ensure keyboard navigation
- Provide list view as an accessible alternative to the month grid
