# Milestone 11 Codex Prompt — CSV and Statement Import

## Status

**Approved implementation prompt for Milestone 11.**

Canonical roadmap placement:

```text
Milestone 10 — Net Worth and Investment Views
Milestone 11 — CSV Import
Milestone 11.5 — UX/UI Audit, Branding, and Product Polish
Milestone 12 — Production Readiness
```

This prompt elaborates the canonical Milestone 11 scope with owner-approved product decisions made before implementation.

---

# Objective

Implement a safe, auditable, owner-scoped import system for investment statements and generic balance/holding CSVs.

Milestone 11 must:

- add import mapping
- add validation
- add duplicate detection
- add import summary
- add rejected-row reporting
- support Fidelity positions CSV or statement-derived import
- support generic balance snapshot import
- support the owner-approved Fidelity and TSP statement families described below
- preserve provider/imported source immutability
- preserve exact money arithmetic and existing financial semantics
- make every committed import reversible as a unit
- retain uploaded source files only temporarily
- integrate committed imported data into existing Accounts, Investments, Net Worth, Overview, and freshness/provenance behavior without double counting

This is an import milestone, not a redesign milestone and not a new financial-classification system.

---

# Read First / Source Hierarchy

Follow the project workflow SOP.

Read in this order:

1. `docs/Plan Docs/milestone-11-codex-prompt.md`
2. `docs/Plan Docs/gpt-codex-milestone-workflow-sop.md`
3. `docs/Plan Docs/build-plan.md`
4. `docs/product-requirements.md`
5. `docs/financial-definitions.md`
6. `docs/data-model.md`
7. `docs/plaid-integration.md`
8. `docs/overview-dashboard-spec.md`
9. `docs/calendar-spec.md`
10. `docs/codex-build-brief.md`
11. merged architecture documents through Milestone 10
12. current Prisma schema, migrations, import-related code, investment/account code, tests, and relevant current Git state

Do not read historical milestone Codex prompts by default.

Use a historical prompt only if a current canonical document, merged architecture document, or current implementation leaves a specific ambiguity unresolved.

If sources genuinely conflict:

1. stop
2. identify the exact conflicting sources and behavior
3. do not invent a compromise
4. report the conflict for owner resolution before implementation

---

# Branch and Git Hygiene

Begin only after confirming `main` is clean and up to date.

Expected workflow:

```text
git switch main
git pull --ff-only
git switch -c feature/milestone-11
```

Work only on:

```text
feature/milestone-11
```

Do not:

- stage files
- commit
- push
- merge
- open a pull request
- modify unrelated planning documents
- commit generated/runtime artifacts
- commit any real user financial statement, screenshot, extracted raw text, account identifier, address, or other personal financial information

Finish with nothing staged.

---

# Source-Defined Milestone 11 Scope

The canonical Build Plan requires:

- import mapping
- validation
- duplicate detection
- import summary
- rejected-row reporting
- Fidelity positions CSV or statement-derived import
- generic balance snapshot import

The Product Requirements and Codex Build Brief also establish:

- Fidelity and Fidelity NetBenefits must not be assumed to work through Plaid
- Fidelity support must work through manual balance tracking and CSV or statement import
- imported values must map into the provider-neutral internal model
- investments are included in net worth
- imported/provider source values remain immutable
- user corrections remain local
- the app remains single-owner and private

---

# Owner-Approved Milestone 11 Product Decisions

The following decisions are approved scope for this milestone.

They are not suggestions.

## Decision 1 — Supported document families

Support these source families:

### Fidelity NetBenefits retirement statement

Purpose:

- retirement account balance snapshot
- trustworthy holding/fund detail
- allocation when explicitly stated
- aggregate contribution information as informational context only unless source rows provide stronger transaction-level evidence

The monthly retirement statement must be sufficient on its own for the retirement-account view.

### Fidelity brokerage monthly statement

Purpose:

- brokerage account balance snapshot
- holdings
- quantity
- price
- market value
- cost basis when supplied
- explicit transaction/activity rows where semantically safe
- statement period/as-of provenance

The monthly brokerage statement must be sufficient on its own for the brokerage/investment account view.

### Fidelity trade confirmation

Purpose:

- optional transaction-level enrichment
- explicit purchase/sale evidence when the confirmation identifies a real transaction

Trade confirmations must not be required when the monthly statement already provides sufficient account data.

The same underlying transaction appearing in both a monthly statement and a confirmation must not be double imported.

### TSP statement

Purpose:

- retirement account balance snapshot
- trustworthy fund/holding detail
- allocation when explicitly stated

Do not create synthetic transaction history, debt, loan activity, fees, gains/losses, or contribution transactions from statement aggregates merely because those values appear in the document.

### Generic CSV

Support:

1. generic balance snapshots
2. investment holdings when the structure is clear enough

Do not add a generic transaction CSV importer in Milestone 11.

---

## Decision 2 — Import workflow, duplicates, and Undo

Every import follows this conceptual flow:

```text
Upload
→ identify source/document type
→ preview extracted data
→ map when mapping is needed
→ validate
→ account matching
→ duplicate/reconciliation analysis
→ review proposed ImportPlan
→ confirm
→ transactional commit
→ completion summary
```

Nothing writes to normalized financial tables before confirmation.

Every candidate must resolve to one of these user-facing states:

- Ready to import
- Duplicate — will skip
- Needs review
- Rejected
- Informational only, when appropriate

Every committed import must be reversible as a unit through **Undo import**.

Undo requirements:

- reverse only records/effects created by that ImportJob
- never delete records that existed before the import
- never remove overlapping records merely because another document contains similar information
- preserve the ImportJob audit trail
- mark the import as reverted rather than erasing history
- refuse destructive reversal when later records/dependencies make a safe rollback impossible
- explain why Undo is unavailable or blocked
- remain functional after the original uploaded source document has been deleted

Inspect the actual current schema first. If reliable per-import provenance does not exist, design the smallest safe forward-only schema extension required to make Undo deterministic.

Do not guess that the planning-model `ImportJob` is sufficient.

---

## Decision 3 — Partial imports and rejected data

Use record-level partial import by default.

Independently valid records may import even when other records from the same source are:

- duplicates
- ambiguous
- unsupported
- malformed
- rejected

Block the whole file only when document-level identity or integrity is uncertain, for example:

- source/document type cannot be safely established
- account identity cannot be resolved or reviewed
- statement/as-of period cannot be established
- currency cannot be established or confirmed where required
- the file is corrupted or unreadable
- parsing results are structurally unreliable enough that record isolation is unsafe

Never guess merely to increase the imported count.

---

## Decision 4 — Conservative account matching

Auto-link an import to an existing normalized account only when the match is deterministic enough to avoid cross-account contamination.

Strong matching may use trustworthy available attributes such as:

- authenticated owner
- source/institution
- normalized or masked account identifier when available
- account type/subtype
- known account name
- currency
- other stable source evidence already represented safely in the app

Possible review outcomes:

- Matched existing account
- Choose account
- Create new account

Rules:

- strong deterministic match → may auto-link
- ambiguous match → require owner selection
- no match → allow owner to create a new account during review
- never silently create a second account when a likely existing account is ambiguous
- never silently merge accounts
- never guess an account merely to complete an import
- new-account creation must show the prefilled trustworthy fields before confirmation

If an import was attached to the wrong account, the safe correction path should normally be Undo and re-import rather than silently rewriting source provenance.

---

## Decision 5 — Temporary source-file retention

Uploaded source files are temporary processing/audit inputs, not permanent document-vault content.

Retention rule:

- retain original uploaded files encrypted for 30 days
- show the owner the planned deletion date
- provide **Delete source now**
- delete immediately when an uncommitted import is canceled
- clean up failed/abandoned temporary sources safely
- after 30 days, automatically and irreversibly delete the source file
- retain import history, provenance, fingerprint, normalized records, parser metadata, and Undo history after deletion

Do not make Undo depend on the retained file.

Do not store full extracted document text in ordinary logs or broad database audit fields.

Do not expose stored source files to unauthenticated users or other owners.

Do not use this milestone to build a permanent document vault.

If encrypted temporary file storage requires a new key/configuration boundary, follow existing server-only secret practices and document the design. Never reuse Plaid token ciphertext/keys casually unless the current architecture explicitly supports safe key separation for this purpose.

---

## Decision 6 — Deterministic parsing and confidence

Do not implement “AI decides what the PDF means.”

Use deterministic, source-specific parsers that emit provider-neutral extraction candidates with evidence.

Suggested parser-family boundaries:

```text
FidelityNetBenefitsParser
FidelityBrokerageStatementParser
FidelityTradeConfirmationParser
TspStatementParser
GenericBalanceCsvParser
GenericHoldingCsvParser
```

Exact names are implementation choices.

Each extracted candidate/field should carry enough internal evidence to support audit/debugging, such as:

- parser family/version
- document type
- page/section when applicable
- source label or table context
- extraction method
- normalized destination concept
- review reason when applicable

User-facing review states should be explainable in plain language.

Do not expose opaque numeric confidence scores as the primary explanation.

### Extraction confidence is not financial meaning

Separate:

```text
Can the parser reliably read this field?
```

from:

```text
What normalized financial record is this field allowed to create?
```

A reliably extracted aggregate contribution total does not become a series of investment transactions.

A confidently read projected/estimated cash-flow number does not become a posted transaction.

Parser confidence must never upgrade weak financial semantics into stronger records.

---

## Decision 7 — Review-screen edit boundaries

The review UI may let the owner resolve ambiguity without rewriting source data.

Allowed examples:

- choose the correct existing account
- create a new account
- confirm a detected document type when ambiguous
- map CSV columns
- choose/confirm an import-level currency when allowed
- resolve a possible duplicate
- include or skip a reviewable candidate

Do not provide free-form editing of extracted Fidelity/TSP source amounts, quantities, dates, prices, or other source values as if the statement itself were editable.

If a source value is unsupported or parsed incorrectly:

- allow the candidate to be skipped/rejected
- preserve source/evidence information for audit where safe
- use existing local/manual correction mechanisms after import where appropriate
- do not rewrite the original imported source value

---

## Decision 8 — Import History and audit UI

`Settings → Data & imports` is the canonical home for:

- starting imports
- reviewing import history
- opening import details
- Undo
- source-retention status
- Delete source now

Relevant pages may have contextual Import actions:

- Investments → investment/Fidelity/TSP import
- Accounts → balance snapshot import

Those contextual actions must enter the same import system and may preselect the relevant import type.

Do not add Import as a new top-level navigation item in Milestone 11.

Each import-history entry should show consumer-friendly information such as:

- source/document type
- sanitized filename/display name
- import date/time
- statement/as-of period
- matched/created account(s)
- imported count
- duplicate/skipped count
- rejected count
- needs-review count if applicable
- current status
- Undo availability/status
- retained-source status and deletion date

Suggested user-facing statuses include:

- Completed
- Completed with issues
- Reverted
- Failed
- Canceled

Avoid surfacing raw internal enum names when a readable label exists.

Technical metadata such as:

- file fingerprint
- parser version
- internal candidate fingerprints
- extraction evidence
- reconciliation keys

should be secondary or server-side audit detail, not primary UI.

Deleting the retained source never deletes imported financial records.

Reverting an import never deletes its audit history.

---

## Decision 9 — Parser/version evolution

Every import records:

- parser family
- parser version
- document type
- file fingerprint
- relevant import/source metadata

A later parser may re-process:

- a still-retained source document, or
- a newly re-uploaded copy of a previously deleted source

Reprocessing must create a comparison/new proposed ImportPlan.

It must never silently rewrite earlier imported financial records.

Possible outcomes:

- no meaningful difference → no financial changes
- new safe information → proposed additive import after review
- conflicting interpretation → explicit comparison/review required

If the older import should be replaced and safe Undo is available, prefer:

```text
Undo old import
→ review new parser output
→ commit new import
```

If Undo is unsafe due to later dependencies, preserve history and require an explicit safe correction path.

Do not commit real user statements as parser fixtures.

Use synthetic or heavily redacted structure-preserving fixtures.

---

## Decision 10 — Parsing technology and failure strategy

Primary path:

1. native PDF text extraction
2. structured text/table/position extraction where available
3. source-specific deterministic parsing

OCR is a bounded fallback only when required for image-only/scanned content or when required fields are unavailable through native extraction.

OCR rules:

- use only where needed rather than automatically processing every page
- record that OCR was used
- treat OCR evidence conservatively
- apply the same semantic validation, account matching, duplicate checks, and review thresholds
- reject poor-quality/ambiguous extraction rather than guessing
- do not infer missing financial meaning from OCR context
- do not use third-party cloud OCR by default

If a local/server OCR dependency is added, justify it and keep the sensitive document boundary server-side.

---

## Decision 11 — Investment activity semantics

Explicit transaction-level investment activity may create `InvestmentTransaction` records when the source supports that meaning.

Examples of source-supported transaction-level activity may include:

- stock purchase
- stock sale
- dividend
- interest
- investment fee
- tax withholding
- other explicit investment-account transaction rows when the current normalized model can represent them safely

Rules:

- purchases remain investment activity, not monthly spending
- sales remain investment activity and are not monthly income by default
- dividends/interest imported into investment activity do not automatically redefine ordinary monthly-income calculations
- fees/taxes remain investment-account activity and do not automatically become ordinary consumer spending
- internal journal/stock-plan credits preserve source meaning and must not automatically become income or contributions
- aggregate retirement contribution summaries do not become synthetic transaction rows
- projected/estimated cash flow never becomes finalized transaction history
- the importer does not become a second financial-classification engine

Preserve existing Financial Definitions and reporting behavior.

---

## Decision 12 — Generic CSV scope

Generic CSV supports:

### Balance snapshots

Required semantic concepts should include:

- account
- as-of/captured date
- balance/current value
- currency or a safely confirmed import-level currency

Optional fields may include:

- available balance where the destination supports it
- source/display label
- notes where existing source semantics permit

### Investment holdings

Support only when the CSV structure can safely map to:

- account
- security name and/or trustworthy ticker/security identity
- as-of date
- value
- currency

Optional fields may include:

- quantity
- price
- cost basis
- other existing normalized holding fields when semantically clear

Column-name mapping may accept common header variations, but mapping must be confirmed before commit.

Unknown columns may be ignored.

Do not add generic transaction CSV import in this milestone.

Use exact Decimal handling. Do not use JavaScript floating point for monetary persistence or duplicate identity.

Dates must parse unambiguously.

Currency must be explicit or confirmed at an import level where safe; do not guess row-by-row.

---

## Decision 13 — Entry points and navigation

Canonical location:

```text
Settings
→ Data & imports
```

Provide:

- Import data
- Import History
- Import detail
- Undo
- source retention/delete controls

Contextual actions may appear on:

- Investments
- Accounts

They must route into the same pipeline.

Do not create parallel import implementations.

---

## Decision 14 — Downstream refresh and “What changed”

After a successful committed import, immediately revalidate/invalidate affected views, including as applicable:

- Accounts
- Investments
- Net Worth
- Overview
- Settings / Import History

Do not require a manual refresh to see imported financial data.

After Undo, refresh the same affected financial surfaces.

Deleting only the retained source file must not change financial totals.

The completion view should answer **What changed?**

Possible summary items:

- balance snapshots imported
- holdings imported
- investment transactions imported
- duplicates skipped
- rejected items
- affected accounts
- informational-only items
- before/after financial impact when directly and safely computable

Do not attribute a change to “gain,” “income,” “spending,” or another financial cause unless the source and existing financial rules support that statement.

---

# Required Initial Analysis Before Coding

Before changing the schema or writing implementation code, inspect current Milestone 10 reality and record the findings in the work log/final report:

1. actual `ImportJob` schema and enums
2. current DataSource/import-related enums
3. actual ownership fields and referential actions on Account, BalanceSnapshot, InvestmentBalanceSnapshot, InvestmentHolding, and InvestmentTransaction
4. existing unique constraints relevant to snapshot/holding/transaction duplicate detection
5. current account current-value precedence
6. current investment current-value precedence
7. current holdings behavior and double-count protections
8. freshness/provenance behavior for imported accounts
9. current account-create/manual-account workflows
10. current Settings structure
11. current Investments/Accounts contextual action patterns
12. current server upload/body-size constraints and deployment-independent local storage possibilities
13. current environment-validation patterns
14. current session/owner-scoping patterns for mutations and APIs
15. existing encryption/key-management utilities and whether they are appropriate for temporary import-file encryption
16. current test database and migration conventions
17. whether the current app has any safe background/scheduled cleanup mechanism
18. current Next.js/server-runtime constraints relevant to local encrypted temporary file retention
19. current dependencies for PDF text/table extraction, CSV parsing, or OCR
20. existing synthetic import fixtures, if any

### Schema decision

Prefer no schema change if the existing schema can safely represent:

- deterministic import provenance
- Undo
- parser/version metadata
- file fingerprint
- temporary source retention metadata/status
- record-level import relationship
- import result/audit counts

If it cannot, introduce the **smallest forward-only migration** that safely represents the approved requirements.

Do not force the requirements into JSON blobs if relational provenance is needed for safe rollback, ownership, indexing, or referential integrity.

Do not reset development data.

Document the schema decision in `docs/architecture-milestone-11.md`.

---

# Import Architecture Requirements

## Provider-neutral intermediate representation

Source-specific parsers must not write directly to normalized financial tables.

Use a typed intermediate extraction/import-plan layer.

Conceptually separate:

```text
Raw uploaded source
→ Extracted fields/candidates
→ semantic validation
→ normalized proposed mutations
→ commit
```

The exact types are an implementation decision.

The design should support at least:

- balance snapshot candidate
- investment balance snapshot candidate
- holding candidate
- investment transaction candidate
- informational-only candidate
- rejected candidate
- possible duplicate
- account match/create proposal

## ImportPlan

Before commit, construct a complete server-authoritative ImportPlan containing the exact proposed mutations and review states.

Browser state must not become the source of truth for financial writes.

On confirmation:

- revalidate ownership
- revalidate source/import state
- revalidate reviewed decisions
- recheck duplicates where concurrency could matter
- apply only approved normalized mutations
- update ImportJob/provenance atomically

## Transactional commit

Use a database transaction for each committed ImportJob’s normalized effects where practical and correct.

Partial import means invalid/ambiguous candidates are excluded from the approved commit plan before the transaction.

It does not mean leave half of an approved plan committed after an unexpected database failure.

## Idempotency and concurrency

Import confirmation and retry must not create duplicate financial records.

Use database constraints and transactional checks where they provide reliable protection.

Do not rely only on browser disable-buttons.

---

# Duplicate Detection Requirements

Duplicate detection must operate at multiple levels.

## Exact file duplicate

Compute a non-reversible cryptographic fingerprint of the source bytes.

Uploading the same exact file again should be recognized.

The file fingerprint must not contain document contents.

## Statement/document duplicate

Recognize when the same document/account/statement period has already been imported when evidence is strong.

A changed source file with the same period is not automatically identical.

Route it through comparison/review.

## Balance snapshot duplicate

Prevent duplicate snapshots representing the same imported source observation.

Use current model constraints plus explicit import provenance/identity where required.

Do not suppress a genuinely newer/different source observation merely because the numeric balance is equal.

## Holding duplicate

Prevent duplicate holdings for the same imported source observation/account/security/as-of context.

Do not double count holdings into account totals.

## Cross-document investment transaction duplicate

Detect the same underlying investment transaction when it appears in multiple Fidelity document types.

Use trustworthy fields such as:

- owner
- normalized account
- source/provider family
- transaction type
- security identity
- trade/transaction date
- settlement date where available
- quantity
- price
- amount
- source transaction/reference identifiers where available

Do not use fragile approximate matching as the sole automatic-deduplication basis.

When evidence is not decisive, require review rather than auto-merge.

---

# Account Creation and DataSource Behavior

Imported data must remain provider-neutral downstream.

Inspect existing DataSource/Account source semantics before deciding whether:

- one imported DataSource should represent a provider family
- a DataSource should be created per import
- a stable source should be reused across imports

Choose the smallest design consistent with:

- provenance
- freshness
- owner scope
- imported-source status
- safe Undo
- future imports
- no double counting

Do not create new provider-specific normalized account models.

Do not implement Fidelity authentication or automatic synchronization.

---

# Temporary File Storage and Encryption

The 30-day retained source is highly sensitive.

Requirements:

- server-only storage
- authenticated owner access only
- encryption at rest
- integrity protection
- per-file fresh nonce/IV when using authenticated encryption
- safe filename handling
- no path traversal
- no raw source content in logs
- no secrets in Git
- no real statement fixtures in Git
- explicit retention timestamps
- idempotent deletion
- cleanup after cancellation/failure/expiration
- safe handling if a file is already missing at cleanup time

If the current runtime cannot support a safe durable local-file strategy consistent with the app's current development/deployment assumptions, stop and report the architectural conflict rather than silently using an unsafe workaround.

Milestone 12 owns production deployment/operations; Milestone 11 should not build unrelated cloud-storage infrastructure solely for future production.

---

# Parsing Requirements by Source

## Fidelity NetBenefits statement

Support the current representative statement family through deterministic structural parsing.

Expected usable concepts where explicitly present:

- account/plan identity
- statement period/as-of date
- ending/current balance
- retirement holding/fund
- holding/fund value where supplied
- allocation where explicitly stated
- aggregate employee/employer/other contribution summaries as informational data only unless the current model and source rows establish transaction-level meaning

Do not infer employee/employer transaction splits when source/model cannot represent them reliably.

Do not infer investment performance from balance differences.

Do not create loan/debt records from statement loan sections in this milestone.

## Fidelity brokerage monthly statement

Support:

- account identity
- statement period
- ending/current account value
- explicit holdings
- quantity
- price
- market value
- cost basis
- explicit investment activity rows
- source/freshness metadata

Be careful with:

- “Other Holdings”
- stock-plan balances
- informational values not custodied in the brokerage account
- internal journal credits
- projected cash flow
- estimated annual income/yield

Do not double count an account total plus a separately reported informational/other-holding total without explicit normalized account semantics.

## Fidelity trade confirmation

Support explicit transaction evidence such as:

- security
- ticker/CUSIP-derived identity where safely represented
- trade date
- settlement date
- purchase/sale type
- quantity
- price
- amount/cost
- stable source reference when safe/useful for duplicate identity

Use it as optional enrichment.

Deduplicate against monthly-statement activity.

Do not use trade-confirmation tax narrative to create tax/accounting advice or unsupported financial records.

## TSP statement

Support:

- account identity
- statement/as-of period
- ending/current balance
- fund holding(s)
- fund value where supplied
- explicit allocation

Do not automatically create:

- investment transactions from aggregate contributions
- debts from plan-loan sections
- gains/loss transactions
- fee transactions
- performance histories not represented as actual normalized source observations

If the generic normalized model cannot safely represent a TSP-specific detail, keep it informational/rejected rather than inventing a new financial semantic model without approval.

---

# Generic CSV Mapping

The mapping UI must:

- show detected headers
- require semantic mapping for required fields
- let the user choose the destination import type
- validate required mappings before review
- show sample values where safe/useful
- not expose raw implementation enum codes as primary labels
- allow unknown/unneeded columns to remain unmapped

Map values server-side again before commit.

CSV parsing must safely handle:

- quoted fields
- commas in quoted values
- line endings
- UTF-8
- blank lines
- bounded file size
- bounded row count
- malicious formulas as inert strings
- malformed rows
- duplicate headers
- unexpected columns

Do not execute spreadsheet formulas.

---

# File Validation and Resource Bounds

Establish explicit safe bounds for:

- file size
- PDF page count
- CSV row count
- filename length
- text extraction output
- review candidate count
- OCR page count per import
- parser timeouts where practical

Choose conservative values based on current runtime and representative document sizes.

Reject oversized/abusive inputs safely with consumer-friendly messages.

Do not reveal internal paths or parser stack traces.

---

# Ownership and Security

Every import query and mutation must be scoped to the authenticated owner.

The browser must never supply an authoritative owner ID.

ImportJob, retained source, candidate/review state, account matching, normalized mutations, Undo, and Import History must all verify ownership server-side.

Preserve Milestone 7.5 session-security behavior.

Import uploads and confirmations are meaningful owner actions under the established session model.

Do not weaken:

- idle timeout
- absolute timeout
- server-side session validation
- same-origin protections
- Plaid webhook boundary
- Plaid token encryption
- logout/expiration semantics

Do not place real credentials, Plaid secrets/tokens, encryption keys, real statements, full source documents, account numbers, user addresses, or tax identifiers in logs, fixtures, docs, screenshots committed to the repository, or final reports.

---

# Financial Integrity Rules

Preserve all existing Financial Definitions.

In particular:

- imported/provider values remain immutable
- local corrections remain separate
- exact monetary arithmetic remains `Decimal`
- transfers are not income or spending
- credit-card payments are not spending
- pending transactions are not finalized reporting
- investment purchases are not ordinary spending
- investment sales are not ordinary income by default
- 401(k) contributions must not be double-counted
- holdings are detail and must not be added on top of account totals
- net worth remains assets minus debt
- source freshness/provenance must remain visible
- disconnected historical data behavior must remain as already established
- no import may silently change existing monthly income/spending logic

---

# Current-Value / Net-Worth Integration

Preserve established Milestone 5/10 precedence unless a current merged source explicitly changed it.

Imported investment snapshots should participate in the same current-value rules as existing investment snapshots.

Imported non-investment balance snapshots should participate in existing balance precedence.

Holdings are explanatory detail only.

Do not:

- add holding values again on top of the account/investment snapshot
- backfill fabricated history
- use today's value to fabricate earlier history
- replace current manual values with stale imported values without following current as-of/source precedence
- erase retained historical observations during later imports

Net-worth history should incorporate genuine stored imported observations according to current history rules.

---

# Undo Semantics

Undo must be deterministic and auditable.

Before Undo:

1. authenticate owner
2. load ImportJob and exact provenance
3. determine exact effects created by the import
4. detect later dependencies or later records that make destructive reversal unsafe
5. produce a safe server-side reversal plan

If safe:

- reverse/delete only import-created effects
- preserve unrelated/pre-existing records
- preserve source-independent later history
- mark ImportJob reverted
- record reverted time/status
- revalidate affected financial pages

If unsafe:

- do not partially destroy data
- explain the blocking dependency in consumer language
- preserve the import and audit history

Do not implement Undo by re-parsing the original file.

Do not implement Undo by fuzzy matching current rows.

---

# Import History and Source Deletion

Import History must remain usable after source deletion.

Source deletion:

- deletes encrypted retained source only
- records deletion state/time
- leaves ImportJob
- leaves normalized records
- leaves parser/fingerprint/provenance metadata
- leaves Undo capability if otherwise safe

Delete-source action must clearly state that financial records remain.

Undo action must clearly state that the import's financial effects will be reversed when safe.

Use appropriate confirmation for destructive actions.

---

# UI / UX Requirements

Milestone 11 should follow the existing consumer-language baseline without attempting the full Milestone 11.5 UX audit.

Primary user flow should make these questions obvious:

- What file did I upload?
- What kind of document did the app identify?
- Which account will this affect?
- What did the app find?
- What will be imported?
- What will be skipped?
- What needs my review?
- What was rejected?
- What will change if I confirm?
- Can I undo this later?
- How long will the original document be retained?

Use consumer-friendly labels.

Avoid implementation copy such as normalized row, parser AST, source enum, database relation, reconciliation hash, or extraction confidence 0.83.

Prefer explanations such as:

- We found two possible accounts
- This transaction may already have been imported
- This value is shown on the statement but will not be imported
- We could not safely determine what this row represents

Use progressive disclosure for technical import details.

---

# Accessibility and Responsive Behavior

All new import screens must support:

- semantic headings
- programmatic labels
- keyboard-only operation
- visible focus
- clear status text
- non-color meaning
- accessible confirmation dialogs
- focus trapping/restoration for modal dialogs
- restrained live-region announcements
- usable long filenames/account names
- mobile layouts without horizontal overflow
- Light/Dark/System compatibility using the existing theme architecture
- touch-size controls where appropriate

Test at minimum:

```text
375 × 812
```

Also inspect representative tablet and desktop widths.

Do not redesign unrelated application surfaces.

---

# Error / Empty / Partial States

Support at least:

- no import history
- unsupported file type
- oversized file
- corrupt PDF
- image-only document requiring OCR
- OCR unavailable/failure
- parser unable to identify document
- document identified but account ambiguous
- all candidates duplicate
- some candidates rejected
- partial successful import
- database commit failure
- source retention write failure
- source deletion failure
- Undo unavailable due to dependency
- expired/deleted retained source
- parser-version reprocess with no change
- parser-version reprocess with differences

Errors must be safe and actionable.

Do not expose stack traces, raw provider payloads, filesystem paths, sensitive encryption metadata, secrets, or real internal IDs when not useful to the owner.

---

# Automated Testing Requirements

Add focused tests for the import system.

At minimum cover:

## Parsing

- each supported document family using synthetic/redacted fixtures
- known valid layout
- structurally changed/unsupported layout
- missing required fields
- statement/as-of date extraction
- balance extraction
- holding extraction
- explicit transaction extraction
- informational-only aggregate fields
- no transaction synthesis from aggregate contributions
- no projected cash-flow transaction creation
- OCR fallback path with synthetic image-only fixture where feasible
- poor OCR rejection path
- parser version metadata

## Generic CSV

- balance mapping
- holding mapping
- alternate header names
- quoted commas
- UTF-8
- blank rows
- invalid date
- invalid Decimal
- missing currency/default confirmation
- unmapped optional columns
- duplicate headers
- malformed rows
- row limits/file limits
- formula-like values treated as inert data

## Duplicate detection

- exact same file
- same statement observation
- equal amount but different as-of date is not falsely duplicate
- same holding observation
- same investment transaction in monthly statement and trade confirmation
- ambiguous near-match requires review
- concurrency/idempotent retry

## Account matching

- deterministic existing account
- two plausible accounts → review
- no match → create proposal
- cross-owner account cannot match
- no silent account duplication

## Import plan / review

- Ready
- Duplicate
- Needs review
- Rejected
- Informational-only
- reviewed selection revalidated server-side
- browser tampering cannot change owner/account/source semantics

## Commit

- atomic approved-plan commit
- rejected candidates excluded cleanly
- unexpected failure leaves approved financial writes uncommitted
- exact Decimal persistence
- source provenance retained
- freshness updated correctly
- downstream calculations do not double count holdings

## Undo

- safe complete reversal
- pre-existing record preserved
- unrelated later record preserved
- unsafe dependency blocks reversal
- ImportJob remains as Reverted
- Undo works after original source deletion
- owner isolation

## Source retention

- encryption/decryption
- tamper/wrong-key failure
- delete now
- canceled import cleanup
- 30-day expiration cleanup
- idempotent missing-file cleanup
- no source content in logs
- owner-only access
- no path traversal

## Downstream regression

- Investments current total
- Net Worth current total
- Net Worth history
- Overview investment/net-worth values
- freshness/provenance labels
- holdings remain non-additive
- existing manual values
- existing Plaid behavior
- existing transaction income/spending semantics
- session expiration behavior

---

# PostgreSQL Integration Tests

Because this milestone affects persistent financial data and may require schema changes, run the full isolated PostgreSQL suite with no silent skips.

Add database-backed coverage for:

- owner scoping
- import-job lifecycle
- provenance
- duplicate uniqueness/identity
- import commit atomicity
- Undo
- referential safety
- account creation/matching
- current-value precedence
- historical snapshot behavior
- source deletion metadata
- parser metadata persistence
- migration replay/status if schema changes
- seed idempotency where relevant

Never target the development database for test mutation.

---

# Physical Browser Verification

Physical verification should cover materially affected flows plus critical regressions.

At minimum:

## Settings / Data & imports

- empty Import History
- start import
- import history after completion
- open import detail
- source-retention status
- Delete source now
- Undo import
- Reverted history entry

## Fidelity NetBenefits representative flow

- upload
- source detection
- account matching
- extracted balance/holding review
- aggregate informational values not promoted to transactions
- confirm
- Investments/Net Worth/Overview update
- Undo

## Fidelity brokerage representative flow

- upload
- account balance
- holdings
- explicit activity
- cost basis/quantity/price display where applicable
- confirm
- downstream refresh

## Trade confirmation overlap

- import corresponding monthly brokerage statement
- import a trade confirmation describing an already imported transaction
- verify strong duplicate is skipped rather than double counted

## TSP representative flow

- balance/holding/allocation extraction
- no synthetic loan/debt or aggregate contribution transactions
- confirm
- downstream refresh

## Generic CSV

- balance snapshot mapping
- holding mapping
- validation failure
- rejected row
- partial import
- duplicate import

## Account identity

- strong existing match
- ambiguous match review
- new-account creation

## Parser/error states

- unsupported/corrupt file
- all-duplicate import
- needs-review candidate
- rejected candidate

## Responsive/accessibility

- keyboard-only primary import flow
- focus behavior in confirmations
- 375×812
- representative tablet
- representative desktop
- Light
- Dark
- System where physically controllable
- long filename/account/security names
- clean browser console

Do not claim a physical condition was tested if the automation/browser environment cannot control it.

Real owner statements may be used manually for owner acceptance, but must never be copied into repository fixtures, screenshots committed to Git, or final reports containing personal details.

---

# Required Verification Commands

Use current repository commands and established workflow.

At minimum:

```text
pnpm db:generate
pnpm exec prisma validate
pnpm exec prisma migrate status
pnpm lint
pnpm typecheck
pnpm test
pnpm format:check
pnpm build
git diff --check
```

Also run the full PostgreSQL-backed suite using the isolated test database with **0 silently skipped database tests**.

If schema changes:

- create the smallest forward-only migration
- do not reset development data
- verify migration status
- verify migration replay against the isolated test database as established by repository practice
- verify seed behavior if affected

Inspect final Git diff for generated/runtime pollution.

Restore generated `next-env.d.ts` or similar files if build tooling modifies them unintentionally.

Remove temporary test/runtime artifacts.

---

# Documentation

Create:

```text
docs/architecture-milestone-11.md
```

It must describe final implemented truth, including:

- supported import formats
- parser architecture
- parser versions
- extraction evidence model
- ImportPlan
- validation
- account matching
- duplicate identity rules
- cross-document transaction deduplication
- schema/migration decision
- ImportJob/provenance model
- Undo behavior
- temporary file storage/encryption
- 30-day retention/cleanup
- source deletion behavior
- generic CSV mapping
- Fidelity statement behavior
- TSP statement behavior
- investment-activity semantics
- current-value/downstream integration
- owner/security boundaries
- responsive/accessibility behavior
- tests/verification
- known limitations
- deferred items

Do not put real statement content or personal financial information in the architecture document.

---

# Explicit Out of Scope

Do not add:

- Fidelity authentication
- automatic Fidelity sync
- direct TSP integration/authentication
- generic transaction CSV import
- permanent financial document vault
- tax preparation
- tax-lot accounting beyond existing safe source fields
- investment advice
- performance forecasting
- retirement projections
- automatic debt creation from TSP/401(k) loans
- new income/spending classifications
- new Plaid products
- production Plaid rollout
- production deployment
- cloud document-storage infrastructure solely for future production
- broad UX redesign
- branding work
- Milestone 11.5 full UX audit
- Milestone 12 production/security work
- multi-user/household functionality
- notification system
- background-job framework unrelated to the minimum safe retention cleanup requirement

Do not infer financial meaning not supported by the source.

---

# Completion Criteria

Milestone 11 is complete only when all of the following are true.

## Core import workflow

- upload works for approved file types
- source/document type detection works safely
- preview exists before financial writes
- mapping exists where required
- validation exists
- account matching exists
- duplicate analysis exists
- ImportPlan exists before commit
- review states are clear
- confirmation commits only approved candidates
- completion summary exists
- rejected-row/candidate reporting exists
- partial import works safely

## Supported formats

- Fidelity NetBenefits representative statement supported
- Fidelity brokerage monthly statement supported
- Fidelity trade confirmation supported as optional enrichment
- TSP representative statement supported
- generic balance snapshot CSV supported
- structurally clear generic investment holding CSV supported
- generic transaction CSV not introduced

## Financial semantics

- aggregate contribution totals do not synthesize transactions
- projected/estimated values do not synthesize posted transactions
- explicit investment activity preserves source meaning
- investment activity does not silently change monthly income/spending behavior
- holdings do not double count account totals
- current-value precedence remains correct
- imported observations integrate into net worth/history correctly
- exact Decimal arithmetic is preserved

## Duplicate behavior

- exact-file duplicates detected
- repeated statement observations do not duplicate snapshots/holdings
- monthly-statement/trade-confirmation overlap does not duplicate a transaction
- ambiguous matches require review
- retries are idempotent

## Account safety

- strong account match may auto-link
- ambiguous account match requires review
- new-account creation is explicit
- no silent account duplication/merge
- owner isolation passes

## Undo

- every committed import has deterministic provenance
- safe import can be undone as a unit
- pre-existing records are preserved
- unsafe dependency blocks destructive reversal
- ImportJob audit remains
- Undo works after source-file deletion

## Retention/privacy

- source file encrypted at rest
- source visible only to authenticated owner
- retention defaults to 30 days
- deletion date visible
- Delete source now works
- canceled/failed sources clean up safely
- expiration cleanup works
- source deletion does not change financial totals
- audit/provenance remains after deletion
- no real statements or PII in repository fixtures/docs/logs

## Parser evolution

- parser family/version recorded
- file fingerprint recorded
- reprocessing creates comparison/new plan
- no silent rewrite of old imported records

## UI/accessibility

- Settings → Data & imports is canonical entry/history
- contextual Accounts/Investments import action uses the same pipeline where implemented
- no top-level Import nav item added
- consumer-friendly review messages
- technical metadata secondary
- keyboard operation passes
- focus behavior passes
- non-color meaning passes
- 375×812 passes
- representative tablet/desktop pass
- Light/Dark/System remain coherent

## Downstream integration

- Accounts updates where relevant
- Investments updates
- Net Worth updates
- Overview updates
- freshness/provenance updates
- Undo refreshes affected views
- source-only deletion does not alter financial data

## Quality gates

- Prisma generation passes
- Prisma validation passes
- migration status passes
- full PostgreSQL regression suite passes
- database tests are not silently skipped
- lint passes
- typecheck passes
- format check passes
- build passes
- `git diff --check` passes
- browser console has no application errors in tested flows
- temporary artifacts removed
- secret/security scan clean
- nothing staged/committed/pushed/merged/submitted

## Documentation

- `docs/architecture-milestone-11.md` exists and reflects final implementation
- limitations and deferred behavior documented

---

# Final Report

Codex must provide a detailed final report containing:

1. overall PASS or BLOCKED
2. source documents reviewed
3. current-code/schema analysis performed before implementation
4. files changed
5. schema/migration decision and rationale
6. new/changed models, fields, indexes, or constraints
7. supported import formats
8. parser architecture
9. parser family/version strategy
10. native PDF extraction strategy
11. OCR strategy and whether it was needed/implemented
12. generic CSV mapping behavior
13. ImportPlan design
14. account-matching behavior
15. duplicate identity strategy
16. cross-document Fidelity deduplication behavior
17. partial-import behavior
18. rejected/needs-review behavior
19. ImportJob/provenance design
20. Undo behavior and dependency blocking
21. encrypted retained-source design
22. 30-day cleanup mechanism
23. Delete source now behavior
24. parser-reprocessing/version behavior
25. Fidelity NetBenefits behavior
26. Fidelity brokerage statement behavior
27. Fidelity trade-confirmation behavior
28. TSP statement behavior
29. investment transaction/activity semantics
30. confirmation aggregate contributions do not synthesize transactions
31. confirmation projected values do not synthesize posted activity
32. confirmation existing income/spending definitions were preserved
33. current-value/net-worth integration
34. Import History UI
35. Settings/Accounts/Investments entry points
36. responsive/accessibility behavior
37. physical browser flows tested
38. exact viewport/theme conditions physically tested
39. defects found and fixed
40. automated test totals
41. PostgreSQL test totals and skipped count
42. Prisma generation/validation/migration results
43. lint result
44. typecheck result
45. format-check result
46. build result
47. `git diff --check` result
48. browser-console result
49. security/secret/PII scan result
50. temporary-artifact cleanup result
51. confirmation no real owner statements/PII were added to the repository
52. known limitations
53. unresolved issues/conflicts
54. confirmation nothing was staged, committed, pushed, merged, or submitted
55. recommendation: ready for review or blocked

---

# Core Principle

> Parse deterministically, preserve evidence, separate extraction from financial meaning, show the proposed financial effects before commit, never guess through ambiguity, deduplicate at the underlying-record level, and retain enough provenance to explain and safely undo every import.
