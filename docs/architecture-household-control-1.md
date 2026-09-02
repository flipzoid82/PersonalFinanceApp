# Household Control 1 Architecture — Transaction Truth and Attention

## Scope and source reconciliation

Household Control 1 establishes one owner-scoped interpretation layer for
transaction purpose, financial role, account-level direction, exact category
allocations, and typed economic relationships. It adds a derived Transaction
Inbox and consolidates Transactions, Overview, Spending, recurrence, and
Calendar matching on that shared truth.

The HC1 implementation contract and its canonical source hierarchy were read
before implementation. The current Milestone 11 schema and all existing
transaction consumers were inspected. No authoritative-source conflict or
unsafe migration constraint was found. HC1 does not implement budgets, income
plans, routed cash flow, Safe-to-Spend, goals, a Debt Tracker, warnings/digest,
or household coordination.

## Durable model

The immutable `Transaction` remains source truth. HC1 adds:

- `TransactionCategory`: stable owner-scoped expense or income purposes;
- `TransactionClassification`: versioned system/owner-rule interpretation;
- `ClassificationRule`: bounded deterministic future matching;
- `TransactionAllocation`: exact positive category magnitudes for real splits;
- `TransactionRelationship`: directed transfer, card-payment, refund, or
  reimbursement lineage.

`TransactionOverride` remains owner truth and gains stable category identity,
an optional direction override, and a review timestamp. The legacy free-form
category and `linkedTransactionId` fields remain compatibility inputs. No
source/provider field is rewritten.

The starter taxonomy is bootstrapped idempotently per owner. Existing owner
renames, order, activation state, and custom categories are preserved. Saving,
reserves, and extra debt principal remain planning destinations rather than
fake spending categories.

## Resolver precedence and classification

The canonical resolver applies:

1. explicit owner override;
2. active deterministic owner rule;
3. versioned deterministic system mapping;
4. permitted provider evidence;
5. unresolved.

Role, category, and direction carry independent provenance and certainty.
Missing confidence is unknown, never numeric zero. The classifier records its
version, direction-adapter version, bounded evidence, and deterministic reason
codes. Unsupported, missing, conflicting, or structurally uncertain meaning
enters review instead of being guessed.

`BORROWING_PROCEEDS` distinguishes debt proceeds from income and transfers.
`UNCATEGORIZED` is retained only as compatibility vocabulary; unresolved new
classification uses nullable role/category plus explicit review state.

## Eligibility predicates

HC1 keeps separate predicates rather than one universal reportable flag:

- classification: current pending/posted and retained historical source rows,
  excluding removed and canceled lineage;
- finalized reporting: posted, not removed, not excluded, sufficiently
  resolved, and never silently combined across currencies;
- Inbox: unresolved/conflicting current activity or open relationship review;
- recurrence: finalized, supported-role activity on current accounts only;
- relationship: current pending/posted same-owner source rows with valid
  currency, followed by type-specific checks;
- allocation: category-bearing income/expense activity only;
- later planning: a named HC1 boundary only; no HC2 planning is implemented.

Disconnected historical transactions remain historical reporting evidence but
cannot create new recurrence projections.

## Exact allocations and refunds

An unsplit category-bearing transaction is returned as one synthetic effective
allocation. No redundant allocation row is stored. A real split stores two to
twenty unique, positive, owner-owned category magnitudes under a serializable
transaction and transaction-specific PostgreSQL advisory lock. The exact sum
must equal the absolute source amount using `Decimal` arithmetic.

Refund and reimbursement relationships are owner-confirmed, directed, and
same-currency. Partial and multiple links store the exact applied magnitude.
The original expense allocation is applied proportionally with a deterministic
final remainder. Per-link allocation evidence supports safe unlinking without
deleting either source transaction or fabricating financial meaning.

## Movement relationships

Transfer and credit-card-payment candidates use equal exact magnitude,
opposite known directions, separate accounts, currency, account type/role
evidence, and a bounded posting-date window. Both sides must already have an
effective transfer or card-payment role and neither side may need review.
Suggestions never change reports. A stale system suggestion that no longer
passes those checks is retained as rejected audit evidence. Only owner
confirmation applies the corresponding categoryless role. Rejection preserves
the auditable relationship and removes relationship-created owner roles when no
other confirmed relationship still requires them.

Calendar fulfillment lineage remains separate from economic relationships.

## Rules and Transaction Inbox

Owner rules support merchant exact, description exact/prefix/contains, and
merchant-plus-account scopes. Arbitrary regular expressions are not accepted.
Rules are owner-scoped, prioritized deterministically, and future-only by
default. Equal-priority conflicting outcomes enter review. Historical
application requires a stable preview and explicit confirmation; the service
rejects confirmation if the candidate identity set changed.

The Inbox is derived from classification, override review, deferral, and open
relationship state. It is not a second durable queue. Deferral retains ledger
visibility and automatically becomes eligible again at its timestamp.

## Pending-to-posted continuity

Plaid sync classifies newly stored rows in the same database transaction.
Pending replacement moves compatible owner overrides, exact allocations,
typed relationships, legacy-link compatibility, and Calendar fulfillment to
the posted successor. Conflicting source meaning is exposed for review rather
than silently discarding owner intent. The provider transaction commits before
recurrence detection begins, so a later projection failure cannot roll back
valid provider history. Recurrence detection is rerun from canonical effective
truth.

## Backfill and cutover

The forward-only migrations only expand schema and constraints. They do not
rewrite source data. An explicit bounded backfill command processes one owner
in batches of 250, bootstraps categories, migrates legacy free-form category
values, classifies eligible rows, inventories legacy links, reconciles
compatibility, and only then writes the owner cutover marker. Every step is
idempotent and retryable. No global startup backfill exists.

Readiness has two signals. The owner truth-version/cutover marker records the
completed historical cutover, while bounded existence probes detect a current
missing classification or stale classifier version. A current gap resumes the
same 250-row backfill; a ready owner with no gap does not scan or reclassify
whole-history batches.

Recurring detection has two explicit phases and lock order:

1. Before its transaction, the HC1 readiness gate performs the bounded probes.
   If needed, the short `hc1-bootstrap:<owner>` advisory transaction runs and
   releases first, classification proceeds in separate bounded transactions,
   and compatibility/cutover verification completes.
2. Only then does the recurring transaction acquire
   `recurring-detection:<owner>`. Candidate selection requires a classification
   at the current classifier version, so a transaction inserted in the small
   post-readiness race window fails closed until a later readiness pass. The
   recurring transaction performs no classification or migration-scale
   backfill and retains atomic stream, projection, and matching writes.

No readiness work runs inside the recurring transaction, so there is no nested
Prisma transaction or inversion between the HC1 and recurring advisory locks.
Plaid classifies inserted/updated rows atomically in its provider transaction;
the seed/bootstrap path remains explicitly cut over by readiness before normal
consumers use its rows.

The original legacy `linkedTransactionId` did not preserve a relationship
type. When no authoritative typed relationship already exists, the forward-only
repair represents it as `LEGACY_UNTYPED`, `NEEDS_REVIEW`, and zero financial
effect rather than guessing transfer, card-payment, refund, or reimbursement
meaning. Owner resolution atomically retypes that row when possible; an
existing supported row is reconciled as the sole canonical economic
representation. The legacy value remains as origin evidence. Dual-read
compatibility cannot apply a second effect.

The development inventory contained one owner and zero legacy links before the
repair. After the idempotent repair pass it remained: encountered 0,
deterministically converted 0, `LEGACY_UNTYPED` 0, structurally invalid 0,
legacy non-null 0, functionally legacy-dependent 0, corresponding typed 0, and
rerun delta 0. Synthetic PostgreSQL coverage exercises nonzero ambiguous,
existing-canonical, movement-resolution, and refund-resolution cases without
using owner financial data.

## Cutover reconciliation

The backfill performs per-transaction compatibility reconciliation before the
cutover marker is written. Synthetic coverage classifies results into:

- unchanged: owner merchant/category/role/exclusion choices and source amounts;
- intended canonicalization: stable category identity and deterministic system
  classification where supported;
- intended exclusion: unresolved/conflicting rows remain visible in the Inbox
  but cannot enter finalized reporting or recurrence;
- intended exactness: splits preserve the exact source magnitude, while
  confirmed partial refunds reduce only their exact applied magnitude;
- intended economic deduplication: confirmed movements are represented once
  and unresolved legacy links have no relationship-derived effect.

Overview and Spending integration tests reconcile the shared effective values
and exact monthly totals. The synthetic cutover reconciliation completed with
zero unexplained differences; the development pass also completed its
non-sensitive compatibility verification with zero unexplained differences.

## Query and consumer design

Ledger sorting and filtering use owner-scoped PostgreSQL joins for stable
category identity and effective merchant values, followed by one bulk load of
the selected page. Allocations and relationship-attention state are selected in
the same bounded query shape. Overview, Spending, recurrence, and Calendar use
the shared resolver/eligibility functions rather than private role heuristics.

Overview exposes transaction-classification coverage by currency and links
unresolved activity to the Inbox. Spending aggregates exact effective expense
and refund allocations. Non-USD values remain separate.

A sanitized PostgreSQL `EXPLAIN (ANALYZE, BUFFERS)` audit used 5,000 synthetic
transactions and no development-owner values. The 50-row ledger page completed
in about 2 ms, effective-category filtering in about 9 ms, Inbox filtering in
about 20 ms, allocation page loading in under 1 ms, relationship page loading
in under 1 ms, the 5,000-row recurring candidate load in about 9 ms, and both
readiness probes in under 4 ms on the local test database. Exact timings are
environment-specific; the relevant findings were query shape and cardinality.

PostgreSQL demonstrated the source/target relationship indexes for Inbox
attention lookups. Unique transaction classification and page-key indexes keep
classification, allocation, and relationship loading to a fixed number of bulk
queries rather than one query per transaction. The new
`(user_id, classifier_version)` index supports the stale-version probe. On the
single-owner synthetic relation, PostgreSQL rationally preferred sequential
scans for several filters because nearly every row matched; this was not
misreported as index use. Ledger category/search expressions and the recurring
history scan remain pre-existing bounded-page/domain query shapes rather than
new HC1 N+1 behavior. The recurring result cardinality is history-sized by its
detection purpose, but HC1 no longer adds an owner-history classification load
or extends the recurring advisory-lock duration with backfill work.

## Security and integrity

All reads and writes start from the authenticated owner. Server services verify
transaction, account, category, allocation, rule, and relationship ownership.
Composite owner-aware database references provide defense in depth for every
new cross-record relationship. Database constraints also enforce unique
classification, category identity, split category/order, directed relationship
identity, distinct endpoints, and positive stored magnitudes.

No raw provider payload, provider identifier, real owner record, credential,
or secret is written to diagnostics, migration output, tests, or this document.
Tests use synthetic records only.

## Verification record

Focused unit and isolated PostgreSQL integration coverage includes taxonomy
bootstrap preservation, deterministic/unresolved/borrowing classification,
rule conflict and future-only behavior, stable historical preview, exact split
reconciliation, relationship suggestion/confirmation, partial refund
allocation/unlink, cross-owner database rejection, and pending-to-posted
continuity. The repair closure additionally covers a current cutover marker with
new missing truth, stale classifier versions, more than one 250-row batch,
interrupted/resumed readiness, no-op current readiness, post-readiness
insertion races, fail-closed recurrence eligibility, concurrent recurring
locks, idempotent reruns, and `LEGACY_UNTYPED` resolution.

The final isolated PostgreSQL suite passed 96 files and 451 tests with zero
skipped database tests. Prisma generation and validation, current migration
status, a fresh 14-migration disposable replay, repeated seed idempotency,
lint, typecheck, formatting, production build, and `git diff --check` passed.
The established startup workflow reached `/login` without exposing owner or
secret data. An authenticated controlled-browser pass then verified Overview,
the complete ledger, the derived Inbox, URL-backed sorting, browser
Back/Forward restoration, transaction-detail review controls, visible keyboard
focus, and current dark-theme readability. At 375×812 the Inbox had no
document-level horizontal overflow and the compact navigation/app-bar controls
remained usable. The browser console contained zero warnings or errors. No
owner credentials, identifiers, amounts, merchant details, or account details
were copied into the verification record.
