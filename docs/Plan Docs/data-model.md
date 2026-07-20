# Data Model

## Design Goal

Use a provider-neutral internal model.

Plaid, CSV imports, manual entries, future Fidelity integrations, and inferred recurring events should all map into normalized tables.

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

## Recurring Detection Rules

The system may infer recurring streams from:

- Similar merchant identity
- Repeating intervals
- Stable day of month
- Similar amounts
- Known subscription or bill categories

Inference must remain separate from user-confirmed due dates.

Original provider and imported data should remain unchanged.
