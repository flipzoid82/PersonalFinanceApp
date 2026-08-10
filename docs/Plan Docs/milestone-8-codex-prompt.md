# Milestone 8 Codex Prompt

## Objective

Build Milestone 8 of the personal finance application: Transactions and Overrides.

Milestone 8 turns the existing transaction surface into the owner-facing transaction ledger and local-override workflow defined by the planning documents.

Do not proceed beyond Milestone 8.

## Read First

Use the following source hierarchy. Do not indiscriminately load every historical Codex prompt.

### Tier 1: Current Milestone Instructions

Read this file first:

```text
docs/Plan Docs/milestone-8-codex-prompt.md
```

### Tier 2: Canonical Core Planning Documents

Read the current versions of these core planning documents:

```text
docs/Plan Docs/product-requirements.md
docs/Plan Docs/financial-definitions.md
docs/Plan Docs/data-model.md
docs/Plan Docs/plaid-integration.md
docs/Plan Docs/overview-dashboard-spec.md
docs/Plan Docs/calendar-spec.md
docs/Plan Docs/build-plan.md
docs/Plan Docs/codex-build-brief.md
```

These documents define intended product behavior, cross-milestone financial rules, milestone boundaries, provider behavior, and data-model expectations.

### Tier 3: Implemented Architecture

Read the architecture documents for the merged milestones through Milestone 7.5, including:

```text
docs/architecture-milestone-1.md
docs/architecture-milestone-2.md
docs/architecture-milestone-3.md
docs/architecture-milestone-4.md
docs/architecture-milestone-5.md
docs/architecture-milestone-6.md
docs/architecture-milestone-7.md
docs/architecture-milestone-7-5.md
```

Treat these as the concise record of what was actually implemented and verified in prior milestones.

### Tier 4: Current Implementation Reality

Inspect only the current code, schema, tests, README sections, and Git history needed to implement or verify Milestone 8, especially:

- the current Prisma schema and migrations
- current Transaction and TransactionOverride queries, actions, helpers, UI, and tests
- Plaid transaction synchronization and reconciliation
- recurring detection and Calendar matching behavior
- Overview transaction calculations
- account identity and disconnected-account behavior
- authentication/session validation and request-protection helpers
- shared semantic theme components and responsive patterns
- relevant README sections
- relevant Git history through the Milestone 7.5 and developer-workflow merges

Do not perform broad repository archaeology when focused inspection answers the question.

### Tier 5: Historical Codex Prompts Only When Needed

Previous milestone Codex prompts are historical execution instructions, not mandatory startup reading for Milestone 8.

Consult a specific prior milestone prompt only when:

- the canonical core plans are ambiguous
- an architecture document omits a decision needed for Milestone 8
- current implementation behavior cannot be explained confidently from the architecture and code
- a regression test or historical implementation boundary requires the original milestone instruction for clarification

When consulting a historical prompt, load only the relevant file/section needed to resolve that ambiguity.

### Source-of-Truth Precedence

Use this precedence when sources differ:

1. explicit current Milestone 8 requirements in this prompt, provided they do not conflict with canonical product rules
2. canonical core planning documents
3. merged architecture documents describing already-established behavior
4. current schema/code/tests as implementation reality
5. historical Codex prompts only as clarification evidence

If the sources reveal a genuine conflict rather than an implementation detail, stop and report the conflict before implementing.

Do not silently resolve source conflicts by inventing new product behavior.

## Branch and Git Hygiene

Start from updated `main`:

```text
git switch main
git pull --ff-only
git switch -c feature/milestone-8
```

Work only on:

```text
feature/milestone-8
```

Do not commit, push, merge, or open a pull request unless explicitly asked.

Do not modify planning documents unless explicitly asked.

The architecture document required by this milestone is implementation documentation, not a planning-document rewrite.

## Milestone Scope

Milestone 8 is **Transactions and Overrides**.

The Build Plan requires:

- transaction table
- filters and search
- transaction detail view
- category overrides
- financial-role overrides
- notes
- report exclusion
- preservation of original provider values

The Product Requirements additionally require the Transactions page to support:

- search by merchant or description
- filters for date, account, category, amount, and status
- pending and posted indicators
- transfer indicators

Milestone 8 should make the existing normalized transaction history useful for review and correction while preserving provider truth and all existing reporting, Plaid, recurring, Calendar, and security behavior.

This milestone is not the Spending product and is not the Bills product.

## Preserve Existing Behavior

Do not break or replace:

- owner-only authentication
- server-side route protection
- Milestone 7.5 session idle/absolute expiration behavior
- explicit logout behavior
- cross-tab session coordination
- manual accounts, assets, debts, and investments
- Overview totals and double-count prevention
- Calendar correction and paid-matching behavior
- recurring detection and projections
- Plaid Link, token exchange, encryption, sync, webhook, repair, disconnect, or reconnect
- Plaid pending-to-posted reconciliation
- Plaid provider transaction history
- Plaid canonical logical-account identity and provider-account history
- disconnected historical Plaid account protections
- existing semantic status styles
- light/dark foundations
- mobile layouts
- PostgreSQL-backed tests
- exact Decimal monetary arithmetic

Do not alter established transaction amount/sign semantics merely to simplify the UI.

Determine the current canonical convention from the implementation and document it.

## Non-Negotiable Domain Rules

1. The application is single-owner.
2. Original provider or imported transaction values are immutable.
3. User corrections remain separate local app data.
4. Synced or imported financial-institution data must never be rewritten by owner-facing edits.
5. `TransactionOverride` remains the local correction layer unless the current schema proves otherwise.
6. Provider category data may be a starting point; local category override takes precedence.
7. Local financial-role override takes precedence over ambiguous provider classification where established behavior defines it.
8. Transfers appear in the transaction ledger but are not income or spending.
9. Credit-card payments are transfers for spending purposes and must not become a second expense.
10. Pending transactions may be shown but do not enter finalized income, spending, cash-flow, or historical reporting totals.
11. Removed/reversed/canceled provider history remains historical provider data and must not be silently deleted.
12. Provider values and local effective values must remain distinguishable.
13. User-entered notes and report-exclusion state are local metadata.
14. Report exclusion must affect only calculations that already honor that field; Milestone 8 must not invent new reporting semantics.
15. Every read and mutation is owner-scoped.
16. Browser input never supplies trusted ownership.
17. Cross-owner IDs must behave as missing/unauthorized records without leaking existence.
18. Recurring detection remains posted-only where currently established.
19. Pending transactions cannot satisfy projected Calendar events.
20. Predicted-only Calendar events must never become overdue because of Milestone 8 changes.

## Required Initial Analysis

Before implementation, record in the work log:

1. current `Transaction` fields
2. current `TransactionOverride` fields
3. current transaction status enum values
4. current financial-role enum values
5. current category representation
6. current source/provenance representation
7. current account/source relationships
8. current provider-field versus override-field precedence
9. current transaction amount/sign convention
10. current pending/posted/canceled/removed reconciliation behavior
11. current linked refund/reimbursement representation, if any
12. current report-exclusion behavior
13. current note behavior
14. current owner-scoping path for every transaction read and mutation
15. current account filtering rules for active, inactive, connected, disconnected, manual, imported, and synced accounts
16. current transaction-page implementation and what Milestone 6 already exposed
17. current Overview transaction calculations and how overrides affect them
18. current recurring-detection effective-value rules
19. current Calendar matching transaction eligibility
20. whether any schema change is genuinely required

Prefer no schema change.

If a schema change is required:

- explain exactly why the existing model is insufficient
- add one forward-only Milestone 8 migration
- preserve all existing rows
- preserve exact monetary types
- preserve provider-neutral design
- test upgrade of the current database
- test full migration replay into an empty database
- do not reset the owner's development database

## Transaction Ledger

Replace or extend the existing read-only Transactions surface into the Milestone 8 transaction ledger.

The ledger must be owner-scoped.

At minimum, make the following understandable from the list/table presentation where data exists:

- transaction date
- effective merchant or description
- account
- category
- financial role
- amount
- pending versus posted state
- transfer/card-payment meaning where applicable
- source/provenance where useful
- local-override presence where useful

Do not expose:

- raw provider payloads
- access tokens
- encrypted provider tokens
- session tokens or digests
- webhook bodies
- secrets
- internal security metadata

Use established server-rendered/query boundaries. Prisma and server-only provider details must not enter client bundles.

### Ordering

Use a deterministic default order suitable for a transaction ledger.

Prefer the current transaction date semantics and current implementation conventions.

If user-selectable sorting is added, keep it small, deterministic, URL-preservable where appropriate, and within Milestone 8 scope.

Do not add sorting merely for novelty.

### Bounded Querying

Do not introduce an unbounded browser-side load of arbitrarily large transaction history.

Inspect existing query and navigation patterns and choose a conservative bounded server-side strategy if needed.

If pagination is introduced:

- make ordering deterministic
- preserve active search/filter state
- keep controls accessible
- avoid infinite scroll unless an existing project convention strongly justifies it

Document the final choice in the architecture file.

## Search

Support search by merchant or description as required by the Product Requirements.

Search must:

- be owner-scoped
- be case-insensitive where the current database/query architecture supports it safely
- trim insignificant surrounding whitespace
- operate on appropriate effective/display merchant and description fields
- not expose provider payload text
- not use unsafe raw SQL interpolation
- provide a clear no-results state
- provide a clear way to remove/reset search
- preserve useful state across navigation/refresh where the existing app pattern supports URL query state

If current override precedence means merchant display can differ from provider merchant text, make search behavior deterministic and document whether search matches original, effective, or both.

## Filters

Support the transaction filters required by the Product Requirements:

- date
- account
- category
- amount
- status

Also make transfer meaning and pending/posted state understandable.

Filter values must be owner-scoped.

### Date Filter

Use the app's established UTC date convention unless the current merged implementation has introduced a newer canonical owner-time-zone rule.

Do not create timezone off-by-one regressions.

The planning documents do not prescribe exact date presets. Reuse an existing project pattern if one exists. Otherwise choose a conservative transaction-ledger design and document the implementation decision.

### Account Filter

Account options must respect current owner/account/source rules.

Do not reintroduce disconnected historical Plaid accounts into current active-account controls if established current-account queries intentionally exclude them.

Historical transactions from disconnected sources may remain visible when existing product behavior preserves them; label context clearly rather than pretending the account is currently connected.

Do not merge accounts by display name.

### Category Filter

Use the existing category architecture.

The effective category must follow the current provider/local-override precedence.

Do not introduce a Milestone 9 category analytics or category-management system.

### Amount Filter

The Product Requirements require filtering by amount but do not prescribe a control design.

Inspect current money/sign semantics and implement a conservative exact-money-safe amount filter.

Do not compare financial values through binary floating-point arithmetic.

Document whether the filter means exact amount, minimum/maximum, absolute amount, signed amount, or another clearly justified interpretation.

If the source documents and current implementation do not support a safe interpretation, stop and report the ambiguity before implementing that part.

### Status Filter

Use existing transaction statuses.

Do not invent statuses to serve UI convenience.

Pending, posted, canceled/removed, or other current statuses must retain their established semantics.

## Transaction Detail View

Add a transaction detail view.

The Overview specification establishes transaction-row navigation to transaction detail; preserve or complete that behavior where appropriate.

The detail view should show useful owner-facing transaction information, including where available:

- original transaction description/name
- effective merchant/display name
- account
- date fields relevant to the current model
- amount
- currency
- transaction status
- provider category
- effective category
- effective financial role
- notes
- report-exclusion state
- source/provenance
- pending-to-posted relationship where useful
- local override state

Clearly distinguish provider/source values from local corrected/effective values when they differ.

Do not dump raw JSON or internal provider payloads.

Do not expose internal provider IDs unless there is a specific owner-facing reason already established by the application.

The planning documents do not prescribe whether detail is a page, dialog, or drawer. Reuse the current navigation/component architecture and choose the least surprising implementation.

Document the choice.

## Transaction Overrides

Milestone 8 must implement the local override workflows explicitly assigned by the Build Plan:

- category override
- financial-role override
- notes
- excluded-from-reports state

These changes must update local override data and never modify original provider/imported transaction fields.

Use the current `TransactionOverride` relationship and effective-value precedence.

If the current model stores a one-to-one override row:

- create it only when local data is needed
- update it owner-safely
- preserve unrelated override fields when changing one field
- avoid accidentally replacing one correction while editing another
- delete or clear override data only when the owner's action explicitly requests clearing a local value
- preserve provider data unchanged

If the current implementation has established append-only or another override-history behavior for transactions, follow that instead and document it. Do not assume Calendar override history semantics automatically apply to TransactionOverride without inspecting the code/schema first.

### Category Override

Allow the owner to set or clear the local category override using the current category representation.

Requirements:

- validate on the server
- preserve provider category
- make the effective category deterministic
- ensure existing Overview and recurring-detection code sees the same effective category semantics
- do not add a category-management subsystem
- do not add Milestone 9 spending analytics

### Financial-Role Override

Allow the owner to set or clear the local financial-role override.

Supported values must come from the existing enum/model.

Financial definitions include:

- Income
- Expense
- Transfer
- Refund
- Credit-card payment
- Investment activity
- Debt payment
- Ignored
- Uncategorized

Use the actual current enum names in code.

Changing the role may affect existing finalized reporting and recurring eligibility according to established rules. Revalidate affected surfaces where the current architecture requires it.

Add explicit regression coverage that:

- transfers do not become income/spending
- credit-card payments do not become spending
- pending activity remains excluded from finalized totals
- investment activity remains excluded from spending/income under existing definitions
- ambiguous/unclassified behavior remains conservative

### Notes

Allow owner-local transaction notes using the existing notes field.

Requirements:

- validate length using current project conventions or a conservative bounded limit
- never write notes into provider payloads
- preserve notes through Plaid re-sync
- render safely
- do not introduce attachment/receipt functionality

### Excluded From Reports

Allow the owner to set or clear the existing report-exclusion flag.

Requirements:

- preserve the source transaction
- do not hide the transaction from the ledger merely because it is excluded from reports
- make the exclusion state understandable in detail and list contexts where appropriate
- ensure existing calculations that honor exclusion continue to do so
- do not invent new report types or reporting pages

## Merchant Override and Linked Refund/Reimbursement

The broader data model and financial definitions include local merchant-name correction and a linked refund/reimbursement relationship.

The Milestone 8 Build Plan explicitly names category override, financial-role override, notes, and report exclusion, but does not explicitly assign a merchant-edit UI or refund-linking workflow to Milestone 8.

Therefore:

1. inspect the current implementation and prior prompts
2. preserve any existing merchant override and linked-transaction behavior
3. make effective merchant display/search compatible with existing overrides
4. do not remove or corrupt those fields
5. do not add a new merchant-edit or refund-linking product workflow unless the planning documents/current merged behavior clearly establish it as Milestone 8 scope
6. if implementation cannot satisfy the required transaction experience without resolving this scope ambiguity, stop and report it before adding new behavior

Do not silently expand scope.

## Provider Values and Effective Values

Create or reuse one deterministic effective-transaction layer.

At minimum, document precedence for:

- merchant/display name
- category
- financial role
- notes
- report exclusion
- transaction status
- amount
- currency
- posting/authorization dates

Original provider/imported amount, currency, timestamps, status, IDs, and original names remain source truth unless the current architecture explicitly defines a local override field for that property.

Do not create untracked display-only transformations that become a second hidden source of truth.

The same effective-value semantics should be used consistently by:

- transaction ledger
- transaction detail
- search/filtering where applicable
- Overview calculations
- recurring detection where applicable
- tests

## Pending, Posted, Canceled, and Removed Behavior

Preserve existing Plaid reconciliation.

Requirements:

- pending transactions remain visible where existing product rules permit
- pending transactions remain excluded from finalized financial totals
- pending transactions cannot satisfy recurring Calendar events
- posted replacements remain distinct from their former pending record according to existing reconciliation
- canceled/removed provider history is preserved
- removed/canceled rows do not silently re-enter finalized reporting
- Milestone 8 UI must not create a second reconciliation system
- Milestone 8 overrides must survive a later Plaid sync
- Plaid sync must remain authoritative for provider-owned fields

Add regression tests for pending-to-posted behavior after local overrides exist.

## Transfer and Credit-Card-Payment Indicators

Transactions classified as transfers or credit-card payments must remain visible in the ledger.

The UI must make their financial meaning understandable without relying on color alone.

Do not label a transfer or card payment as spending.

Do not calculate new spending analytics in this milestone.

## Owner Scoping and Security

Every transaction query and mutation must begin from the authenticated owner.

Use the established Milestone 7.5 server-authoritative session validator.

Protect:

- transaction ledger query
- search
- filters
- transaction detail
- category override mutation
- financial-role override mutation
- note mutation
- report-exclusion mutation
- any other existing transaction-local correction surfaced by this milestone

Do not trust:

- client-provided owner IDs
- client-provided account ownership
- client-provided transaction ownership
- client-provided data-source ownership

Cross-owner transaction IDs and account IDs must not reveal whether a record exists.

Preserve current same-origin/request-security patterns.

Session expiration on Transactions must continue to use the existing `/api/session/end` and `/login?reason=expired` behavior where applicable.

Do not add a transaction-specific authentication path.

## Plaid Compatibility

Do not regress:

- Sandbox-only configuration boundary
- Link token creation
- public-token exchange
- access-token encryption
- manual sync
- webhook verification
- cursor atomicity
- sync locking
- pending replacement
- removed history
- update/repair mode
- disconnect
- reconnect
- canonical logical account identity
- provider account identity history
- account repair audit history
- disconnected-account filtering

After an owner changes local overrides:

- a later Plaid sync must update provider-owned fields normally
- local overrides must remain intact
- no duplicate transaction should be created because an override exists
- recurring detection must continue using its established effective values

## Recurring Detection Compatibility

Milestone 7 behavior must remain intact:

- weekly detection
- biweekly detection
- semimonthly detection
- monthly detection
- quarterly detection
- annual detection
- deterministic confidence
- exact-money amount estimation
- posted-only eligibility
- provider/local effective-value precedence
- bounded Calendar projection
- posted transaction matching
- predicted-only never overdue
- owner-scoped concurrency protection
- idempotency

Because category and financial-role overrides can affect recurring eligibility and grouping under established Milestone 7 rules, explicitly test and document the intended interaction.

Do not create a second recurring engine in Milestone 8.

## Overview Compatibility

The Overview currently uses conservative finalized-transaction semantics.

Milestone 8 must preserve:

- posted-only finalized reporting
- pending exclusion
- report-exclusion behavior
- transfer exclusion
- credit-card-payment exclusion
- investment-activity exclusion where established
- exact Decimal calculations
- owner scoping
- recent-transaction display semantics

When a Milestone 8 override should affect an Overview calculation under existing rules, ensure revalidation/update behavior is correct.

Do not redesign the Overview in this milestone.

## UI Scope

Allowed:

- full Transactions ledger/table/list
- search
- required filters
- transaction detail
- category override
- financial-role override
- notes
- report exclusion
- pending/posted indicators
- transfer/card-payment indicators
- local/source distinction
- safe loading, empty, stale, partial, and error states
- accessible responsive transaction presentation

Not automatically allowed:

- manual transaction creation
- manual transaction deletion
- manual editing of provider-owned amount/date/status
- merchant-edit UI unless source review confirms M8 scope
- refund-linking UI unless source review confirms M8 scope
- spending analytics
- bills dashboard
- category management
- import workflows

Do not start Milestone 9 or later work.

## Empty, Loading, Partial, Stale, and Error States

Handle safely:

- no transactions
- no results for current search
- no results for current filters
- pending-only activity
- disconnected historical source
- stale synced source
- partial source availability
- unavailable account context
- override mutation failure
- safe transaction-detail lookup failure
- page/range state that no longer contains records if bounded navigation is used

Do not present missing data as zero unless zero is known.

Do not show stack traces or raw database/provider errors.

Where useful, direct the owner toward existing actions such as account connection or clearing filters.

Do not create new connection workflows in Transactions.

## Accessibility and Responsive Design

Preserve the established accessibility rules:

- semantic headings
- associated form labels
- visible focus
- keyboard operability
- accessible table semantics if a table is used
- non-color pending/posted/transfer/status cues
- non-color financial-role cues
- accessible success/error feedback
- touch-sized controls
- focus management for any dialog/drawer
- no horizontal page overflow at 375×812
- readable one-column or compact mobile presentation
- established light/dark semantic variables

If a desktop table is used, provide a responsive mobile treatment that does not require horizontal page scrolling.

Do not introduce a user-facing theme selector. That remains Milestone 10.

## Semantic Colors and Theme Behavior

Reuse the shared semantic system established in Milestone 5 and preserved through later work:

- positive/income/asset/paid: green
- negative/spending/debt/overdue: red
- warning/predicted/stale/medium/needs-attention: amber
- informational/confirmed/synced: blue
- investments: purple
- inactive/skipped/unavailable/muted: gray

Color is secondary only.

Every financial meaning must also use text, sign, icon, status label, or another non-color cue.

Milestone 8 must render correctly with current light/dark foundations but must not add theme preference controls.

## Seed Data

Extend deterministic synthetic seed data only if necessary to demonstrate or test Milestone 8.

Requirements:

- no real personal financial data
- no real credentials
- no real provider tokens
- deterministic dates and amounts
- idempotent repeated seed
- existing owner password unchanged
- preserve established Overview and Calendar fixture expectations unless intentionally updated and fully tested
- enough transaction variety to exercise required filters and overrides if current fixtures are insufficient

Do not make production behavior depend on seed-only flags.

Do not synthesize provider secrets or raw payloads unnecessarily.

## Tests

Add focused coverage for at least the following where applicable to the final implementation.

### Ledger and query behavior

1. owner-scoped transaction list
2. deterministic default ordering
3. merchant/description search
4. whitespace/case search behavior
5. date filtering
6. account filtering
7. category filtering using effective category semantics
8. amount filtering using exact-money semantics
9. status filtering
10. pending indicator behavior
11. posted indicator behavior
12. transfer indicator behavior
13. credit-card-payment indicator behavior
14. disconnected historical account behavior
15. no-results state
16. empty state
17. bounded navigation/pagination behavior if implemented
18. filter/search state preservation if implemented

### Detail behavior

19. owner-scoped transaction detail
20. cross-owner detail rejection
21. provider/original values displayed without raw payload exposure
22. effective/local values displayed deterministically
23. pending-to-posted relationship presentation where implemented
24. source/provenance presentation where implemented

### Overrides

25. category override create/update
26. category override clear
27. category provider value preserved
28. financial-role override create/update
29. financial-role override clear
30. notes create/update
31. notes clear
32. report exclusion set
33. report exclusion clear
34. unrelated override fields preserved during single-field mutation
35. cross-owner override mutation rejected
36. malformed transaction ID rejected safely
37. server validation rejects invalid category/role values
38. provider amount/date/status/ID cannot be mutated through owner actions
39. Plaid re-sync preserves local overrides

### Financial semantics

40. transfer not counted as income
41. transfer not counted as spending
42. credit-card payment not counted as spending
43. pending transaction excluded from finalized totals
44. excluded-from-reports transaction excluded where existing calculations honor it
45. investment activity treatment unchanged
46. effective category/role affects existing calculations only according to established rules
47. exact Decimal handling preserved

### Recurring and Calendar regressions

48. pending transaction remains ineligible for paid matching
49. posted-only recurring detection remains intact
50. category override interaction with recurring detection is deterministic
51. financial-role override interaction with recurring detection is deterministic
52. predicted-only event never becomes overdue
53. existing paid/skipped/inactive Calendar behavior unchanged
54. recurring detection remains idempotent

### Plaid regressions

55. pending-to-posted reconciliation remains correct
56. removed transaction history remains preserved
57. sync remains cursor-atomic
58. local overrides survive sync
59. reconnect remains duplicate-free
60. disconnected historical accounts do not re-enter current totals/filters incorrectly

### Security and session regressions

61. signed-out Transactions route protection
62. expired-session behavior
63. transaction mutations denied after session expiry
64. owner isolation
65. no client-supplied owner trust

### Presentation

66. populated transaction ledger
67. empty state
68. filtered no-results state
69. accessible search/filter labels
70. non-color status cues
71. transaction detail accessibility
72. override form feedback
73. responsive structure
74. 375×812 no-horizontal-overflow behavior
75. light/dark semantic rendering regression

### Repository quality

76. seed idempotency
77. migration replay if schema changes
78. PostgreSQL suite runs without silent skips
79. no Milestone 9+ scope introduced

Use PostgreSQL for database-dependent tests.

Do not silently skip database tests when the isolated test database is expected.

## Documentation

Update README only where appropriate.

Create:

```text
docs/architecture-milestone-8.md
```

This architecture document must record the final implemented truth, not merely repeat this prompt.

Document:

- Milestone 8 scope and explicit exclusions
- ownership and trust boundaries
- transaction data flow
- source/provider versus local override separation
- canonical transaction amount/sign semantics
- effective-value precedence
- transaction status semantics
- pending/posted/canceled/removed behavior
- search architecture
- filter architecture
- amount-filter interpretation
- account filtering and disconnected historical account behavior
- ordering and bounded-query/pagination decision
- transaction detail design
- category override behavior
- financial-role override behavior
- notes behavior
- report-exclusion behavior
- merchant override and linked refund/reimbursement decision
- transfer and credit-card-payment presentation
- Overview interaction
- recurring-detection interaction
- Calendar matching interaction
- Plaid sync/reconciliation interaction
- session/security behavior
- schema/migration decision
- accessibility
- responsive behavior
- light/dark semantic behavior
- errors/states
- tests
- physical verification
- known limitations
- explicit confirmation that Milestone 9 and later work was not started

If an implementation decision was required because the planning documents did not prescribe a detail, label it explicitly as an implementation decision and explain the evidence/rationale.

## Required Verification

Run and pass:

```text
pnpm db:generate
pnpm exec prisma validate
pnpm exec prisma migrate status
pnpm lint
pnpm typecheck
pnpm test
pnpm format:check
pnpm build
```

Also:

- run the full PostgreSQL-backed suite using the isolated test database
- report exact test files passed, tests passed, and skipped tests
- test migration upgrade and full replay if schema changes
- run seed twice if seed changes
- verify Plaid sync after local transaction overrides
- verify local overrides survive sync
- verify pending-to-posted reconciliation remains correct
- verify removed transaction history remains preserved
- verify recurring detection after category/role overrides
- verify predicted-only Calendar events never become overdue
- verify Overview finalized totals remain correct
- physically test `/transactions`
- physically test search
- physically test date filter
- physically test account filter
- physically test category filter
- physically test amount filter
- physically test status filter
- physically test pending/posted indicators
- physically test transfer/card-payment indicators
- physically test transaction detail
- physically test category override
- physically test financial-role override
- physically test notes
- physically test report exclusion
- physically test override clearing/reset behavior
- physically test no-results and empty states
- physically test disconnected/stale source presentation where practical
- physically test desktop layout
- physically test 375×812 with no horizontal page overflow
- physically test current light rendering
- physically test current dark rendering
- physically test keyboard navigation
- physically test session-expiration behavior on the Transactions surface
- inspect browser console
- run `git diff --check`
- run the repository's PowerShell developer-workflow tests if shared workflow code is touched
- restore unrelated generated changes such as `next-env.d.ts`
- remove temporary screenshots, logs, runtime state, and verification files
- scan for credentials, tokens, real financial data, and accidental environment-file changes
- confirm `.env` remains ignored
- confirm no Milestone 9+ code was added

Use the established developer workflow where appropriate:

```text
pnpm dev:start
```

and finish physical verification with:

```text
pnpm dev:stop
```

Do not leave `.dev-runtime` artifacts behind.

## Out of Scope

Do not implement:

- manual transaction creation unless an existing documented Milestone 8 requirement is found during source review
- manual transaction deletion unless an existing documented Milestone 8 requirement is found during source review
- editing provider-owned transaction amount
- editing provider-owned transaction date
- editing provider-owned transaction status
- editing provider IDs
- a new merchant-override UI unless source review clearly assigns it to Milestone 8
- a new refund/reimbursement-linking UI unless source review clearly assigns it to Milestone 8
- full Bills page
- recurring-stream management dashboard
- spending-by-category analytics page
- month-over-month spending comparison
- merchant totals
- largest-purchase analytics
- unusual-spending indicators
- monthly spending trends
- advanced forecasting
- receipt uploads
- receipt OCR
- CSV import
- statement import
- Fidelity automatic sync
- Plaid Production or real-institution onboarding
- bill payment
- money movement
- investment performance
- allocation advice
- debt payoff advice
- notifications
- category-management subsystem
- AI categorization
- machine-learning infrastructure
- user-facing theme selector
- theme preference persistence
- MFA
- passkeys
- password reset
- multi-user or household features
- production deployment
- Milestone 9 or later work

## Final Milestone 8 Usability Extension

Before finalizing Milestone 8, add:

- sortable Date, Transaction, and Amount columns
- ascending/descending sort indicators
- URL-backed deterministic sorting compatible with filters and pagination
- active debounced merchant/description search
- dedicated Date column
- consumer-friendly display formatting for provider category codes
- preservation of original provider category values
- long-text overflow protection
- corresponding automated and physical verification

## Completion Criteria

Milestone 8 is complete only when:

- the Transactions surface provides the required owner-scoped transaction ledger
- merchant/description search works
- required date, account, category, amount, and status filters work
- pending and posted states are clearly distinguishable
- transfers and credit-card payments are clearly represented without becoming spending
- transaction detail exists
- category override works without mutating provider data
- financial-role override works without mutating provider data
- notes work as local metadata
- report exclusion works as local metadata
- original provider/imported values remain preserved
- effective-value precedence is deterministic and documented
- local overrides survive Plaid re-sync
- pending-to-posted and removed-history behavior remain correct
- Overview finalized reporting remains correct
- recurring detection remains correct and idempotent
- Calendar matching and overdue rules remain correct
- owner scoping and Milestone 7.5 session behavior remain correct
- the transaction ledger supports deterministic sorting by Date, Transaction, and Amount
- sortable column headers clearly indicate the active sort column and ascending/descending direction without relying on color alone
- sorting remains URL-backed and works correctly with pagination and all existing filters
- merchant/description search updates results as the user types using a short debounce
- active search preserves URL state and browser Back/Forward behavior
- stale or racing active-search updates cannot replace newer search results
- the desktop transaction ledger includes a dedicated Date column
- provider-style category codes are presented with consumer-friendly display labels where a safe deterministic label can be derived
- original provider category values remain unchanged and available as source information
- unknown or unmapped provider categories fall back safely without losing the original value
- long merchant, category, account, and source values do not cause horizontal overflow
- sortable headers and active search remain keyboard accessible
- the updated transaction ledger and detail views remain usable at 375x812 without horizontal overflow
- the sorting/search/category-display additions remain reusable enough to inform future table-like pages without introducing a large generic data-grid framework
- accessibility and responsive behavior are verified
- existing light/dark semantic foundations remain correct
- migrations, if any, are forward-only and fully tested
- full PostgreSQL tests run without silent skips
- lint, typecheck, formatting, and build pass
- architecture documentation is complete
- no Milestone 9 or later work is included

## Final Report

Stop and report:

1. implementation summary
2. files changed
3. source documents reviewed, including any historical prompt consulted and why
4. preflight findings
5. schema and migration decision
6. canonical transaction amount/sign semantics
7. transaction source/provenance model
8. provider versus effective-value precedence
9. transaction ledger behavior
10. ordering and bounded-query/pagination decision
11. search behavior
12. date filter behavior
13. account filter behavior
14. category filter behavior
15. amount filter interpretation
16. status filter behavior
17. transaction detail design
18. category override behavior
19. financial-role override behavior
20. notes behavior
21. report-exclusion behavior
22. merchant override decision
23. linked refund/reimbursement decision
24. pending/posted/canceled/removed behavior
25. transfer and credit-card-payment behavior
26. disconnected Plaid-account behavior
27. Overview interaction
28. recurring-detection interaction
29. Calendar matching/overdue interaction
30. Plaid sync/reconciliation regression status
31. owner/security/session behavior
32. accessibility/theme/responsive behavior
33. seed changes
34. tests and exact totals
35. commands and results
36. physically tested flows
37. implementation decisions made because the plans were silent
38. known limitations
39. unresolved issues or source conflicts
40. confirmation no credentials, tokens, real financial data, or environment secrets were added
41. confirmation temporary verification artifacts were removed
42. confirmation nothing was committed, pushed, merged, or submitted
43. confirmation Milestone 9 and later work was not started

Do not commit, push, merge, or open a pull request.
