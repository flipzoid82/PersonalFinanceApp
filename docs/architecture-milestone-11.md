# Milestone 11 Architecture — CSV and Statement Import

## Scope and source review

Milestone 11 adds an authenticated, owner-scoped import pipeline for generic
balance and holding CSVs, Fidelity NetBenefits statements, Fidelity brokerage
monthly statements, Fidelity trade confirmations, and TSP statements. It does
not add Fidelity/TSP authentication, automatic sync, a generic transaction CSV
importer, tax accounting, a permanent document vault, or a second financial
classification system.

The Milestone 11 prompt, workflow SOP, canonical Build Plan, Product
Requirements, Financial Definitions, Data Model, Plaid Integration, Overview,
Calendar and Codex Build Brief, merged architecture documents through
Milestone 10, and current schema/code/tests were reviewed in the required
order. No historical milestone prompt was needed and no authoritative-source
conflict was found.

## Initial implementation-reality audit

The pre-code audit found:

1. `ImportJob` had only owner/source/type/status and two result counts; it could
   not support reviewed plans, record provenance, parser versions, retention,
   or deterministic Undo.
2. `DataSourceType` already distinguished Plaid, CSV import, Fidelity import,
   manual, and other sources. Normalized account and investment source enums
   already had imported states.
3. Account, balance, holding, investment snapshot, and investment transaction
   records have direct owner fields. Account deletion is protected by
   `NO ACTION` for historical dependents.
4. Balance snapshots are unique by account/time and investment snapshots by
   account/source/time. Holdings had no source-observation uniqueness, and
   investment transactions only had a nullable provider-ID uniqueness rule.
5. Current non-investment values use the latest balance snapshot, then account
   balance. Current investment values use the latest investment snapshot, then
   account balance.
6. Holdings are explanatory detail and are never added to account totals.
7. Imported freshness uses `Account.lastImportedAt` and
   `DataSource.lastUpdatedAt`; the existing seven-day freshness rule remains.
8. Existing manual-account creation and Fidelity metadata templates are
   owner-scoped server mutations and do not authenticate to Fidelity.
9. Settings contained theme and session sections. Accounts and Investments
   already used contextual action/card patterns.
10. Next.js runs in the Node server runtime. Server Actions had the default
    body bound; Milestone 11 raises it only to 9 MB while independently
    enforcing an 8 MB import limit.
11. Environment validation is Zod-based and server-only. Import configuration
    is optional for the rest of the app and fails closed at the import boundary.
12. Dashboard pages and all meaningful mutations use database-backed
    `requireUser`; the browser never provides an owner ID.
13. Plaid already used AES-256-GCM, but its key is provider-token-specific.
    Import files therefore use a new dedicated key boundary rather than
    reusing Plaid or general token keys.
14. Tests use Vitest and an isolated PostgreSQL database whose name must contain
    `test`. Migrations are forward-only and seed execution is idempotent.
15. There was no durable background-job scheduler. Next.js instrumentation now
    starts a process-owned retention loop: it sweeps at server startup and
    every 15 minutes while the long-lived Node runtime is active. Startup
    catches up after downtime without requiring owner dashboard activity.
16. Local encrypted retention can safely use the ignored `.dev-runtime`
    boundary for the current local/private deployment. A production shared or
    ephemeral filesystem decision remains Milestone 12 work.
    The established `pnpm dev:start` workflow now creates a cryptographically
    random, dedicated development-only key in that ignored boundary when no
    explicit import key exists. It passes the value only to the verified Next.js
    process, never prints it or rewrites `.env`, and reuses it across stop/start
    cycles. Production still requires explicit secure configuration and the
    application import boundary fails closed without it.
17. No PDF, CSV, or OCR dependency existed. Milestone 11 adds `pdf-parse` for
    native PDF text/metadata/raster extraction, `tesseract.js` with bundled
    English language data for local OCR, and a bounded CSV parser. Cloud OCR is
    not introduced.
18. No existing synthetic import fixtures existed; new tests use only inline,
    clearly synthetic structure-preserving content.

## Schema and migration decision

The existing schema could not meet deterministic provenance and Undo safely, so
the forward-only `20260818120000_milestone_11_imports` migration is required.
It preserves every existing row.

`ImportJob` now records sanitized source metadata, SHA-256 file fingerprint,
parser family/version, statement/as-of dates, currency, plan version and
fingerprint, temporary-source state/retention timestamps, detailed result
counts, failure code, completion, and reversion. Statuses add Needs review,
Ready, Canceled, and Reverted without removing legacy values.

`ImportAccountMatch` stores each source account identity, conservative match
state, owner-reviewed destination, and proposed account metadata.
`ImportCandidate` stores typed, ordered extraction candidates, user-facing
state, a non-reversible source-candidate fingerprint, bounded proposed data,
and extraction evidence. Candidate and match rows are relational rather than
browser state.

Nullable `importJobId` and deterministic `importIdentityKey` fields on
`BalanceSnapshot`, `InvestmentBalanceSnapshot`, `InvestmentHolding`, and
`InvestmentTransaction` provide exact record-level provenance and
database-enforced owner-scoped idempotency. `Account.createdByImportJobId`
identifies accounts created by a confirmed import. Existing manual, Plaid, and
legacy imported rows remain nullable and unchanged.

## Parsing and intermediate representation

Source-specific parsers produce a provider-neutral typed representation; they
never write financial tables. Candidate kinds are balance snapshot, investment
balance snapshot, holding, investment transaction, and informational-only.
Evidence records parser family/version, document type, extraction method,
section/row, source label where useful, and destination concept.

Parser families and current version are:

- `FidelityNetBenefitsParser` 1.0.0
- `FidelityBrokerageStatementParser` 1.0.0
- `FidelityTradeConfirmationParser` 1.0.0
- `TspStatementParser` 1.0.0
- `GenericBalanceCsvParser` 1.0.0
- `GenericHoldingCsvParser` 1.0.0

PDF processing uses `pdf-parse` in the server runtime, validates a 100-page
limit, bounds extracted text at two million characters, and always destroys
parser resources. Source-family detection is deterministic. Source-specific
parsing accepts only explicit balance, holding, and activity structures. It
does not infer transactions from aggregates, performance, loan sections, or
projected cash flow.

Native PDF text remains primary. When native text is insufficient, cannot
identify the document safely, or omits the required balance/date observation,
the server renders the PDF locally and runs bundled English Tesseract OCR. No
document bytes, page images, or extracted text are sent to a third party.

OCR is limited to 10 pages, 1,600 × 2,400 pixels and 3.84 million pixels per
page, 30 million pixels per import, 500,000 output characters, and a 90-second
processing deadline. Every OCR page must meet a confidence threshold of 75.
Low-confidence, oversized, timed-out, ambiguous, or insufficient output is
rejected. Accepted OCR text enters the same source-specific parser, semantic
validation, account matching, deduplication, and review pipeline as native
text. Candidate evidence records `extractionMethod: ocr`, the plan records the
OCR page count and minimum confidence, and the review UI displays an explicit
verification warning. OCR never upgrades aggregates, projections, or inferred
context into financial activity.

## Generic CSV mapping and bounds

CSV upload first stores only headers and common-header suggestions in the
server-authoritative plan. The owner maps required account/date/value concepts
and, for holdings, a security name. Currency must come from a mapped column or
an explicitly confirmed import-level value. Optional ticker, quantity, price,
and cost-basis columns may remain unmapped.

The parser supports UTF-8, CRLF/LF, quoted commas and escaped quotes, blank
rows, and at most 2,000 data rows and 80 columns. It rejects duplicate/blank
headers, malformed quoting, ambiguous non-ISO generic dates, invalid Decimal
values, and missing currency. Unknown columns are inert. Formula-like values
are plain strings and are never executed. Generic transaction CSV remains
unsupported.

## Account matching and ImportPlan

Account matching considers only current owner accounts. A unique match may use
institution, masked identifier, account type/subtype, exact name, and currency.
Multiple plausible matches require owner selection. No match also requires an
explicit owner decision between an existing account and creation of the shown
prefilled imported account; account creation is never implicit.

The database candidates, account decisions, parser metadata, plan version, and
plan fingerprint form the server-authoritative ImportPlan. Browser confirmation
sends only the import ID. Confirmation reloads owner-scoped state, requires the
Ready status, rechecks every account, rechecks deterministic identities, and
executes inside a serializable PostgreSQL transaction protected by an
owner-specific advisory lock. Unexpected failure commits none of the approved
financial records.

## Validation, partial imports, and duplicate identity

Each candidate is Ready, Duplicate, Needs review, Rejected, Informational only,
or Skipped. Structurally independent valid candidates can commit while invalid
rows remain in the audit summary. A document-level parse or identity failure
blocks the file.

Exact source bytes use SHA-256. Logical balance/holding identity uses provider
family, stable source-account identity, record kind, as-of date, and security
identity where applicable. Values are compared separately: equal values are
duplicates; same observation identity with changed values requires review and
cannot silently replace history. Explicit investment transactions use account,
provider family, type, trade/settlement date, security, quantity, price, amount,
fees, and stable source reference. Fidelity monthly-statement and confirmation
parsers share the same provider family, so strong overlap resolves to the same
identity. Ambiguous conflicts must be skipped or corrected through Undo and a
new reviewed import.

Database unique indexes on owner/import identity and the commit lock make
retry/concurrent confirmation idempotent. Existing account/date uniqueness is
also rechecked after owner account selection.

## Financial persistence and downstream behavior

Imported balance candidates create `BalanceSnapshot`; investment balances
create `InvestmentBalanceSnapshot`; holdings create `InvestmentHolding`; and
explicit supported activity creates `InvestmentTransaction`. All money remains
`Prisma.Decimal`. Imported source fields have no editing surface.

The existing financial rules remain unchanged:

- holdings are detail and never add to account/investment totals;
- account and investment snapshots use the established precedence;
- investment purchases/sales/fees remain investment activity and do not enter
  ordinary income or spending;
- aggregate contributions and projected values never create transactions;
- imported activity does not create ordinary `Transaction` rows;
- Plaid and local override paths are unchanged.

Confirmation and Undo revalidate Accounts, Investments, Net Worth, Overview,
and Import History. Deleting only a retained source never touches financial
records or totals.

## Undo and audit

Undo never reparses a file or fuzzy-matches current rows. It locks and reloads
the owner-owned job, deletes only normalized rows with that exact `importJobId`,
and preserves pre-existing records. An account created by the import is removed
only when it has no transaction, recurring, Calendar, or later/import-independent
snapshot/holding/activity dependency. Otherwise the entire reversal is blocked
with a consumer-facing reason; no partial destructive Undo occurs.

The job remains with status Reverted and a reversion timestamp. Candidate,
parser, fingerprint, result, and account-match audit information remains. Undo
works after source deletion because it depends only on relational provenance.
If a later duplicate, overlap, or canceled import matched an account created by
the reverted job, Undo clears only that owner-scoped live account relation
before removing the account. The later import job, candidates, fingerprints,
match decision, and result counts remain auditable, while no stale foreign-key
reference can turn an otherwise safe Undo into a generic database failure.

## Temporary retained-source security

Original bytes are encrypted before parsing with AES-256-GCM, a fresh 96-bit IV,
and a dedicated 32-byte `IMPORT_FILE_ENCRYPTION_KEY`. Configuration rejects key
reuse with Plaid or the general token key. The authenticated file format stores
only a version byte, IV, tag, and ciphertext. Storage keys are random names;
original filenames never become paths. Strict key syntax plus directory
containment prevents traversal.

The default location is ignored `.dev-runtime/imports`; an operator may supply
`IMPORT_STORAGE_DIR`. The database stores only the random storage key and
retention metadata, not a filesystem path or encryption key. Uploads default to
30-day retention. Cancel removes temporary source bytes immediately. An
ordinary parser or review-preparation failure keeps the encrypted source under
the same retention policy and records a plain-language failure reason; source
deletion is reserved for explicit cancellation/deletion, expiration, or a
specific storage-safety failure. Delete source now is idempotent, records
Deleted or Missing, and explicitly
states that imported records and audit history remain. Next.js server
instrumentation runs an expiration sweep at application startup and then every
15 minutes while the long-lived Node process is active. Each sweep paginates
through every expired job, applies the existing owner-scoped deletion path, and
continues safely when a file is already missing or an individual deletion must
be retried. Undo is entirely relational and remains independent of source-file
cleanup.

The normal Windows development workflow stores its generated local-only key at
ignored `.dev-runtime/import-file-encryption.key`. Shutdown removes only
ephemeral PID/state/log artifacts and preserves both this key and
`.dev-runtime/imports`, so retained sources remain decryptable after a normal
restart. An explicit valid `IMPORT_FILE_ENCRYPTION_KEY` in `.env` takes
precedence. Invalid explicit configuration is never replaced silently. A
running project server is reused only when workflow state proves import storage
was configured; an older workflow-owned server is restarted safely, while an
unproven server requires the developer to request the existing verified restart
path. The import page renders interactive controls only when configuration is
valid; otherwise it renders a named configuration-required status instead of
apparently broken disabled fields.

The Milestone 11 guarantee is therefore exact about its runtime boundary:
sources are targeted for deletion at 30 days, automatically deleted while the
application runtime is active, and overdue sources are removed by the startup
sweep after downtime. A literal wall-clock deletion guarantee while the
application is not running requires durable operational scheduling and is
deferred to Milestone 12.

No raw PDF/CSV text, source contents, key, full path, or owner identifiers are
written to ordinary logs or audit JSON. Source retrieval/decryption is a
server-only implementation detail and has no public route.

## UI, accessibility, and responsive behavior

`Settings → Data & imports` is the canonical upload and Import History surface.
The normal entry flow is file-first: the owner selects one PDF or CSV and the
server identifies its family before choosing a parser. Accounts and Investments
link to that same neutral entry point; no top-level navigation item or parallel
pipeline was added.

PDF identification is deterministic and source-specific. NetBenefits requires
NetBenefits/401(k) statement markers, brokerage statements require Fidelity
account plus statement/investment-report and holdings markers, trade
confirmations require confirmation plus brokerage/trade evidence, and TSP
requires Thrift Savings Plan markers. Native PDF text is primary; bounded local
OCR runs only when native text cannot identify the document. CSV identification
uses headers: account + date + value without a holding-name column is a balance
snapshot CSV, while a holding-name column plus value/quantity/price evidence is
an investment-holdings CSV. Ambiguous CSVs ask only Balance snapshots versus
Investment holdings. Unknown PDFs offer only supported PDF families. Because
the database requires a concrete audited import type, ambiguous/unknown files
are not retained under a false placeholder type; the owner confirms the narrow
fallback and selects the file again.

The review confirms “We identified this as …” and answers what was uploaded,
identified, matched, ready, duplicate,
rejected, informational, retained, and changed. Technical evidence is secondary
progressive disclosure, and implementation class names/version strings are not
exposed in the normal owner workflow. Long names use wrapping/minimum-width
containment.
Forms have programmatic labels and visible focus. Commit, Undo, and source
deletion use labeled, focus-trapped dialogs with Escape, focus restoration,
scroll locking, distinct confirmation actions, and non-color text. Existing
semantic surface tokens support Light, Dark, and System.
Import selects retain native keyboard behavior while applying the established
panel and primary-text tokens to both the closed control and its option rows.
This prevents Windows native dropdown popups from combining a light surface
with dark-theme light text, without changing selects elsewhere in the app.

## Parser evolution

Every job records family/version, file fingerprint, plan version/fingerprint,
and evidence. Re-uploading retained or identical bytes creates a new comparison
plan; it never rewrites an earlier job. Equal observations skip. Changed
same-identity observations require review. The safe replacement path is Undo
the earlier import, review the new plan, then confirm. If Undo is dependency
blocked, both histories remain and the conflicting candidate cannot overwrite
the original.

## Tests and known limitations

Unit/component coverage exercises all parser families, aggregate non-synthesis,
CSV mapping/quoting/UTF-8/invalid values/formula inertness, account matching,
cross-document identity, encryption/tampering/wrong-key/path traversal,
idempotent deletion, labeled confirmations, keyboard Escape/focus restoration,
and form labels. PostgreSQL coverage exercises partial commit, exact Decimal,
provenance, repeat duplicate prevention, owner isolation, source deletion plus
Undo, pre-existing-record preservation, and dependency-blocked Undo.

Known limits:

- Local OCR supports English statement text only and is intentionally bounded
  to the documented page, raster, output, confidence, and time limits. It does
  not attempt handwriting recognition or cloud-assisted recovery.
- Deterministic statement parsers support the documented representative text
  structures; materially changed provider layouts are rejected for a future
  parser version rather than guessed.
- Imported investment activity is limited to transaction types representable
  by the current normalized enum; unsupported tax/loan semantics remain
  informational or rejected.
- The in-process retention loop cannot execute while the application is
  stopped. Startup catch-up is guaranteed when the runtime returns; a durable
  wall-clock scheduler and production storage lifecycle belong to Milestone 12.
- Currency conversion, tax-lot accounting, performance inference, and generic
  transaction CSV remain out of scope.
