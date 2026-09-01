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

Milestone 11 expanded this baseline with reviewed-plan, candidate, account-match, provenance, parser/version, deduplication, retention, result, and Undo audit data. `prisma/schema.prisma` and `docs/architecture-milestone-11.md` describe the stabilized checkpoint implementation. Household Control milestones do not depend on those import records.

## Household Financial Control model direction

The models in this section are planned architecture. `prisma/schema.prisma`, current migrations, and current implementation remain the truth about what exists until the owning Household Control milestone implements and verifies a change.

Household Control 1 preserves `Transaction` as immutable provider/source evidence. It extends the existing owner `TransactionOverride` and adds only durable interpretation, category, relationship, rule, and real-split concepts that the current schema cannot represent safely.

### TransactionCategory — planned for HC1

A stable owner-scoped transaction-purpose category, distinct from a future planning destination:

- owner_id
- stable category identity and optional system key
- kind: expense or income
- owner-visible label
- normalized identity
- active state and display order
- created_at / updated_at

The approved starter expense categories are Housing, Utilities, Groceries, Dining, Transportation, Health, Insurance, Household, Personal, Shopping, Entertainment, Subscriptions, Education/Childcare, Travel, Taxes, Fees & Interest, and Other Expense. Starter income categories are Payroll, Benefits, Interest Income, and Other Income.

Bootstrap uses stable system identity and is idempotent. A retry must not duplicate a category, reactivate an owner-deactivated category, overwrite an owner-renamed label, reset owner ordering, or replace another owner customization. This idempotency requirement does not authorize a whole-database bootstrap or classification backfill on every application startup.

Provider category codes remain immutable evidence and do not become owner taxonomy automatically. `Uncategorized` is unresolved state, not a permanent category. Mixed-purpose activity uses exact allocations rather than a fabricated `Mixed` category.

### TransactionClassification — planned for HC1

Represents the current versioned system/rule interpretation without mutating `Transaction` and without competing with owner truth:

- owner_id
- transaction_id
- proposed financial role
- proposed transaction_category_id when applicable
- source-adapted economic direction
- separate role/category/direction certainty
- provenance, classifier/rule version, evidence, and reason codes
- review/conflict state and timestamps

Canonical direction must be deterministic, source-adapter-aware, versioned, auditable, efficiently queryable, reproducible after reruns, and owner-overridable. Persisting classified direction is recommended; an equivalent representation is acceptable only if it preserves those properties.

One current classification exists per owner transaction. Reclassification is idempotent and must never overwrite an explicit owner decision.

### TransactionOverride — planned narrow HC1 extension

The existing one-to-one owner correction remains authoritative. HC1 may add:

- stable transaction_category_id override;
- economic_direction override;
- review/confirmation metadata necessary to preserve an explicit owner decision.

Field-level effective precedence is owner override, owner-confirmed rule, deterministic versioned system mapping, permitted provider evidence, then unresolved. Legacy free-form category text remains readable during controlled migration and cannot be discarded when kind or identity is ambiguous.

The existing untyped `TransactionOverride.linkedTransactionId` is not silently repurposed or dropped. Every non-null value must be inventoried owner-safely. Only deterministically understood links may convert to typed relationships. Ambiguous links retain a compatibility read path and explicit review state. A later removal requires proof that no unresolved value, read/write path, test, or owner intent depends on the field; safe retention is permitted through HC1 completion.

### ClassificationRule — planned for HC1

An owner-confirmed deterministic rule for similar activity:

- owner_id
- bounded match scope and normalized value
- optional account scope
- resulting category and/or financial role
- active state and deterministic priority
- provenance/version and timestamps

Supported matching is bounded to exact normalized merchant/description, escaped prefix/contains, and merchant plus account. Arbitrary owner regular expressions are excluded. Equal-priority conflicts resolve to review, never insertion order.

New owner rules are future-only by default. Historical owner-rule application requires preview, affected transactions, expected reporting impact, and explicit confirmation. This does not prohibit the separate controlled, versioned, deterministic initial system-classification backfill.

### TransactionAllocation — planned for HC1

Persisted only for real splits:

- owner_id
- transaction_id
- transaction_category_id
- positive exact Decimal magnitude
- stable display order
- provenance/review metadata

All allocations inherit the transaction currency and must sum exactly to its absolute magnitude. A category-bearing unsplit transaction is exposed as one allocation by the canonical effective-allocation API without requiring redundant storage. Split writes use one owner-scoped transaction and concurrency control so partial or conflicting allocation sets never become effective.

### TransactionRelationship — planned for HC1

Links economically related source transactions without changing either source record:

- owner_id
- directed source_transaction_id and target_transaction_id
- type: internal transfer, credit-card payment, refund, or reimbursement
- applied exact magnitude where partial/multiple linkage requires it
- provenance and separate certainty
- review/confirmation state and timestamps

Directed endpoints and type-specific database/service constraints prevent reverse duplicates and invalid cardinality. Confirmed endpoints must share an owner and currency and satisfy type-specific direction, account, and amount invariants. Transfer and card-payment heuristics are suggestion-first; amount/date similarity alone never confirms a pair.

Calendar's transaction link remains separate because it records event fulfillment, not a transaction-to-transaction economic relationship. Initial reimbursement uses refund-like financial-role semantics while relationship type distinguishes reimbursement from merchant refund.

### Explicit HC1 eligibility predicates

HC1 must not collapse meaning into one `reportable` boolean. It defines separate classification, finalized-reporting, Inbox, recurrence, relationship/pairing, allocation, and later-planning eligibility predicates. Historical disconnected activity may remain valid reporting history while being ineligible for current liquidity or new recurrence generation. Non-USD populations remain separate. Pending, canceled-successor, removed, owner-excluded, investment, borrowing, unresolved, and unsupported cases have predicate-specific treatment.

### HC1 backfill and cutover

HC1 uses forward-only compatible schema expansion, bounded idempotent backfill, legacy read-through, and an atomic owner-level consumer cutover. Before cutover, legacy and canonical results are reconciled. Every difference in financial totals, transaction inclusion, classification, allocation, or relationship results must be an approved semantic correction, expected consequence of newly resolved activity, or resolved defect; zero unexplained differences may remain.

Backfill supports interruption recovery, classifier versioning, concurrent Plaid sync, concurrent owner edits, and fail-closed unresolved state. It does not run a giant data rewrite inside the schema migration or repeat a whole-database backfill at every startup.

### OwnerPlanningProfile — planned for HC2+

- owner_id
- planning_time_zone
- planning_currency, USD for V1
- optional_household_reserve_floor
- effective dates / updated timestamps

The profile is owner-only through Safe-to-Spend V1. It is not a multi-user household model.

### PlanningAccountPolicy — planned for HC3

Extends an existing current checking/savings account with planning policy rather than duplicating the account:

- owner_id
- account_id
- included_in_planning
- planning_role, such as operating, bill-pay, reserve, or other
- account_reserve_floor
- effective dates / updated timestamps

Investments, property, credit capacity, and unrelated debt capacity are not eligible planning cash.

### Budget & Income Plan boundary — planned for HC2

HC2 may add durable plan and allocation concepts for planned income, category spending, fixed obligations, protected reserves, generic saving, generic extra debt principal, and intentionally unassigned income. Exact table design belongs to HC2.

HC2 fixed obligations reuse or explicitly reconcile existing Bills behavior, `RecurringStream`, `CalendarEvent`, and owner-confirmed corrections. “Bills” describes the existing product surface/domain and does not imply a separate `Bill` model. HC2 may attach planning metadata but must not create an unrelated second obligation truth source.

HC1 `TransactionCategory` describes actual transaction purpose. HC2 planning destinations are broader. HC5 owns named goals, sinking funds, irregular expenses, payoff projections, and debt-versus-saving tradeoffs.

### PlannedTransfer — planned for HC3

A recommended/owner-acknowledged future movement retains owner, source/destination account, exact amount/currency, required date, state/reason, and obligation/projection lineage. The application never initiates the transfer.

### Projection and commitment lineage — planned for HC3–HC4

Whether projection rows are stored or derived is decided by the owning milestone. The design must retain owner and planning account, starting-balance source/freshness, event/transaction/transfer/reserve/plan source identity, dated amount/direction, certainty/inclusion, balance after event, commitment identity, funding status, and explanation.

One economic commitment reduces capacity at most once. Existing Bills/recurrence/Calendar obligations, future plan allocations, actual transactions, transfers, saving funding, reserves, and goals must reconcile through lineage rather than subtract independently. A derived cache never becomes a second mutable source of financial truth.

### Future household membership

Household/member/permission models are deferred until HC7. Current ownership remains `User`-scoped. New owner-only models must preserve strict isolation without unnecessarily preventing a later household boundary.

## Recurring Detection Rules

The system may infer recurring streams from:

- Similar merchant identity
- Repeating intervals
- Stable day of month
- Similar amounts
- Known subscription or bill categories

Inference must remain separate from user-confirmed due dates.

Original provider and imported data should remain unchanged.
