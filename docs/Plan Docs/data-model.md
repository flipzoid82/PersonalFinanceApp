# Data Model

## Design Goal

Use a provider-neutral internal model.

Plaid, CSV imports, manual entries, future Fidelity integrations, and inferred recurring events should all map into normalized tables.

The current implemented schema remains the source of truth for existing records. The Household Financial Control sections below describe planned concepts for Household Control milestones; they do not claim those tables or fields exist yet. Exact schema design belongs to each owning milestone after the current implementation is re-inspected.

## Core Tables

### User

- id
- email
- display_name
- created_at
- updated_at

### DataSource

- id
- user_id
- source_type
- display_name
- status
- last_updated_at
- created_at
- updated_at

### InstitutionConnection

- id
- user_id
- data_source_id
- provider
- provider_item_id
- institution_id
- institution_name
- encrypted_access_token
- status
- last_successful_sync_at
- created_at
- updated_at

### Account

- id
- user_id
- data_source_id
- institution_connection_id, nullable
- provider_account_id, nullable
- name
- official_name, nullable
- institution_name, nullable
- account_type
- account_subtype
- currency
- current_balance
- available_balance, nullable
- credit_limit, nullable
- is_manual
- is_active
- last_synced_at, nullable
- last_imported_at, nullable
- created_at
- updated_at

### Transaction

- id
- user_id
- account_id
- provider_transaction_id, nullable
- original_name
- merchant_name, nullable
- amount
- currency
- authorized_at, nullable
- posted_at, nullable
- status
- provider_category, nullable
- provider_category_confidence, nullable
- pending_provider_transaction_id, nullable
- raw_provider_payload, nullable
- created_at
- updated_at

### TransactionOverride

- id
- transaction_id
- merchant_name_override, nullable
- category_override, nullable
- financial_role_override, nullable
- notes, nullable
- excluded_from_reports
- linked_transaction_id, nullable
- created_at
- updated_at

### RecurringStream

Represents a detected or manually created recurring bill, subscription, transfer, or income stream.

- id
- user_id
- merchant_name
- description
- flow_type
- frequency
- average_amount
- last_amount
- first_date
- last_date
- predicted_next_date
- predicted_posting_date, nullable
- confirmed_due_date, nullable
- date_source
- confidence_level
- confidence_score, nullable
- is_active
- status
- category
- typical_account_id, nullable
- created_at
- updated_at

### CalendarEvent

Represents one projected or confirmed occurrence.

- id
- user_id
- recurring_stream_id, nullable
- account_id, nullable
- linked_transaction_id, nullable
- event_type
- title
- event_date
- predicted_posting_date, nullable
- expected_amount, nullable
- actual_amount, nullable
- currency
- date_source
- amount_source
- confidence_level
- status
- is_user_confirmed
- notes, nullable
- created_at
- updated_at

Suggested event types:

- bill
- subscription
- debt_payment
- credit_card_payment
- expected_income
- other_recurring

Suggested date sources:

- inferred
- user_confirmed
- provider
- imported

Suggested statuses:

- predicted
- confirmed
- paid
- overdue
- skipped
- needs_confirmation
- inactive

### CalendarOverride

Stores user corrections without mutating inferred source data.

- id
- calendar_event_id, nullable
- recurring_stream_id, nullable
- confirmed_due_date, nullable
- expected_amount_override, nullable
- frequency_override, nullable
- status_override, nullable
- not_a_bill
- notes, nullable
- created_at
- updated_at

### InvestmentHolding

- id
- user_id
- account_id
- source
- security_name
- ticker_symbol, nullable
- security_type, nullable
- quantity, nullable
- price, nullable
- value
- cost_basis, nullable
- vested_quantity, nullable
- vested_value, nullable
- currency
- as_of_date
- created_at
- updated_at

### InvestmentBalanceSnapshot

- id
- user_id
- account_id
- total_value
- vested_value, nullable
- source
- as_of_date
- notes, nullable
- created_at

### InvestmentTransaction

- id
- user_id
- account_id
- source
- provider_investment_transaction_id, nullable
- transaction_date
- transaction_type
- security_name, nullable
- ticker_symbol, nullable
- amount, nullable
- quantity, nullable
- price, nullable
- fees, nullable
- currency
- raw_payload, nullable
- created_at
- updated_at

### ManualAsset

- id
- user_id
- name
- asset_type
- current_value
- cost_basis, nullable
- currency
- acquired_at, nullable
- is_debt
- notes, nullable
- updated_at

### BalanceSnapshot

- id
- account_id
- current_balance
- available_balance, nullable
- captured_at

### ImportJob

- id
- user_id
- data_source_id
- source_name
- import_type
- status
- imported_row_count
- rejected_row_count
- created_at
- completed_at, nullable

The current Milestone 11 work expands this baseline with reviewed-plan, candidate, account-match, provenance, parser/version, deduplication, retention, result, and Undo audit data. `prisma/schema.prisma` and `docs/architecture-milestone-11.md` describe the stabilized pre-checkpoint implementation. Household Control milestones do not depend on those import records.

## Household Financial Control model direction

### OwnerPlanningProfile

Planned for the household-control roadmap:

- owner_id
- planning_time_zone
- planning_currency, USD for V1
- optional_household_reserve_floor
- effective dates / updated timestamps

The profile is owner-only through Safe-to-Spend V1. It is not a multi-user household model.

### PlanningAccountPolicy

Extends an existing current checking/savings account with planning policy rather than duplicating the account:

- owner_id
- account_id
- included_in_planning
- planning_role, such as operating, bill-pay, reserve, or other
- account_reserve_floor
- effective dates / updated timestamps

Investments, property, credit capacity, and unrelated debt capacity are not eligible planning cash.

### TransactionClassification

Represents the canonical effective interpretation without mutating the source transaction:

- owner_id
- transaction_id
- effective_merchant/category/financial_role
- provenance and classifier/rule version
- confidence and reason codes
- review state
- reviewed_at, nullable
- created_at / updated_at

An owner correction has precedence. Household Control 1 must reconcile this concept with the existing one-to-one `TransactionOverride` rather than introduce two competing effective-value paths.

### ClassificationRule

An explicit owner-scoped deterministic rule for similar future activity:

- owner_id
- match scope and normalized match value
- resulting category/financial role
- active state and priority
- provenance and timestamps

V1 does not require an opaque ML model.

### TransactionAllocation

Allocates a reportable transaction across one or more stable household budget categories:

- owner_id
- transaction_id
- budget_category_id
- exact amount
- currency
- provenance/review metadata

Allocations for one transaction must reconcile exactly to its reportable magnitude.

### TransactionRelationship

Links economically related transactions while retaining each source record:

- owner_id
- source_transaction_id
- related_transaction_id
- relationship type: internal transfer, credit-card payment, refund, reimbursement
- confidence/provenance
- review state

Database constraints and commit logic must prevent ambiguous duplicate pairing.

### BudgetCategory and BudgetAllocation

Stable household-purpose categories and their monthly plan:

- owner_id
- category identity, label, active state
- period start/end in the planning time zone
- allocated amount and currency
- policy: fixed, flexible, or protected
- warning thresholds where configured
- explicit rollover/reallocation metadata

Budgets are plans, not account balances.

### BudgetReallocation

An exact, balanced, auditable movement between period allocations. It does not create a bank transaction or move institution funds.

### PlannedTransfer

A recommended/owner-acknowledged future movement:

- owner_id
- source_account_id
- destination_account_id
- amount/currency
- required date
- status/reason
- related obligation/projection lineage

V1 never initiates the transfer.

### Projection and commitment lineage

Household Control 3–4 require a deterministic projection/commitment representation. Whether projection rows are stored or derived must be decided by the owning milestone. The design must retain:

- owner and planning account
- starting balance source/freshness
- event/transaction/transfer/reserve/budget source identity
- dated exact amount and direction
- confidence/inclusion decision
- balance after event
- commitment identity used for deduplication
- funding status and explanation

A derived cache must never become a second mutable source of financial truth.

### Future household membership

Household/member/permission models are explicitly deferred until after Safe-to-Spend V1. Current ownership remains `User`-scoped. New V1 models should avoid unnecessary assumptions that prevent a later household boundary, but must not weaken present owner isolation.

## Recurring Detection Rules

The system may infer recurring streams from:

- Similar merchant identity
- Repeating intervals
- Stable day of month
- Similar amounts
- Known subscription or bill categories

Inference must remain separate from user-confirmed due dates.

Original provider and imported data should remain unchanged.
