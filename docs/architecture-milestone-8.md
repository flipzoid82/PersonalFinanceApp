# Milestone 8 architecture: transactions and local overrides

## Scope, source review, and exclusions

Milestone 8 implements the authenticated owner's transaction ledger, active
search, URL-backed filters and sorting, transaction detail, and editing of
local category, financial role, notes, and report exclusion. The canonical planning documents,
merged Milestone 1-7.5 architecture notes, schema, current implementation, and
tests were reviewed in the required hierarchy. They revealed no genuine
conflict. Historical milestone prompts were not needed.

Merchant editing and refund/reimbursement linking UI, category management,
imports, Spending analytics, production Plaid, multi-user product behavior,
and all Milestone 9+ work are excluded. Existing merchant and linked-transaction
override fields are honored and preserved.

## Initial analysis work log

The provider-neutral schema is sufficient, so Milestone 8 requires no schema
change or migration.

1. `Transaction` stores owner/account IDs, provider transaction identity,
   original and provider merchant names, exact Decimal amount, currency,
   authorization/posting dates, status, provider category/confidence,
   pending-to-posted identities, server-only raw audit data, removal time, and
   timestamps.
2. `TransactionOverride` is a one-to-one local row containing owner and source
   transaction IDs, merchant/category/financial-role corrections, notes,
   report exclusion, an optional linked refund/reimbursement transaction, and
   timestamps.
3. Status values are `PENDING`, `POSTED`, and `CANCELED`; provider removals are
   canceled rows with `removedAt` populated.
4. Financial roles are `INCOME`, `EXPENSE`, `TRANSFER`, `REFUND`,
   `CREDIT_CARD_PAYMENT`, `INVESTMENT_ACTIVITY`, `DEBT_PAYMENT`, `IGNORED`, and
   `UNCATEGORIZED`.
5. Categories are bounded strings rather than a managed category table. Local
   category precedes provider category, then `Uncategorized` for presentation.
6. Provenance is represented by `Account.source`, its `DataSource`, and an
   optional `InstitutionConnection`; raw payloads never enter the UI.
7. Every transaction belongs to an owner and account. Historical disconnected
   accounts remain auditable.
8. Effective precedence is local merchant/category/role/report metadata over
   provider values. Amount, currency, dates, status, IDs, and source names have
   no owner-editable override.
9. Source amounts are stored unchanged. Plaid may use positive outflow and
   negative inflow signs, while existing synthetic/imported normalized rows
   use positive magnitudes. Financial direction therefore comes from effective
   role, and calculations/display use absolute magnitude.
10. Sync upserts provider fields by account/provider ID, marks a replaced
    pending row canceled, links the posted replacement, marks removals canceled
    with `removedAt`, and leaves the override untouched.
11. Refund/reimbursement linking is the nullable `linkedTransactionId`; no
    current owner-facing workflow edits it.
12. `excludedFromReports` defaults false and is already honored by Overview and
    recurring eligibility. It does not hide ledger history.
13. Notes are nullable owner-local override text.
14. Existing reads start from `Transaction.userId`; new reads and mutations
    repeat both transaction and owner predicates.
15. Current-balance queries exclude inactive accounts and accounts attached to
    disconnected Plaid Items. Transaction history itself is retained.
16. Milestone 6 exposed a bounded, read-only list of 100 current-account
    transactions with no URL search, filters, detail, or mutations.
17. Overview uses posted transactions for finalized metrics, requires an
    explicit effective role, and honors category/role/report overrides.
18. Recurring detection is posted-only and uses effective merchant/category/
    role/exclusion values without creating overrides.
19. Calendar matching is posted-only, owner/currency scoped, and rejects a
    mismatched explicit role. Pending activity cannot satisfy events.
20. The current override model contains every required Milestone 8 field.

## Ownership and trust boundaries

The dashboard route group remains protected by server-side session validation.
List, option, detail, and mutation operations begin with the authenticated
owner ID supplied by `requireUser`; no browser-supplied owner identity is
trusted. Detail uses `Transaction.id + Transaction.userId`, and mutations first
select the same pair inside a database transaction. A missing, malformed, or
cross-owner ID behaves as missing without revealing another owner's record.
Mutations count as meaningful session activity and retain the established
expiration/cookie-clearing `/login?reason=expired` behavior. Explicit sign-out
continues to use plain `/login`.

Prisma, raw provider data, and Plaid reconciliation remain server-only. The UI
does not render raw payloads, tokens, provider IDs, or secrets.

## Transaction data flow and effective-value precedence

Plaid/import/manual normalization writes source-owned `Transaction` fields.
The ledger query selects a bounded owner slice plus account provenance and an
optional `TransactionOverride`. A shared effective-value helper is used by the
ledger, Overview calculations, and recurring normalization:

1. merchant: local merchant override, provider merchant, original description;
2. category: local category override, provider category, `Uncategorized`;
3. financial role: local role override, otherwise unclassified at this layer;
4. notes and report exclusion: local override, otherwise null/false.

Provider amount, currency, timestamps, status, identity, and names remain
unchanged. Mutations apply only validated override patches in a transaction.
They preserve merchant and linked-refund metadata that the form does not edit.
A fully empty override row is deleted only after explicit clearing leaves no
local metadata.

Provider-style category codes have a presentation-only formatter. Known
high-level prefixes become a consumer label such as `Rent and Utilities · Gas
and electricity`; other uppercase underscore codes fall back to deterministic
word spacing and casing. Owner-local labels pass through unchanged. The exact
provider category remains stored unchanged and is still shown in the detail
page's read-only source values.

## Amount, date, and status semantics

The stored source sign is preserved but is not a provider-neutral direction
signal: Plaid's convention and existing synthetic/import conventions differ.
The UI uses absolute currency magnitude, while effective role supplies explicit
inflow/outflow and reporting classification. Unclassified rows say that their
direction is not classified. No JavaScript floating point is used for filters
or reporting.

`PENDING` is not finalized. `POSTED` is finalized under existing explicit-role
rules. `CANCELED` is retained history; `removedAt` further labels provider
removal. Plaid remains responsible for pending-to-posted reconciliation. Detail
displays that relationship without creating a second reconciliation system.

## Search, filters, ordering, and bounded querying

Search is case-insensitive, trimmed, bounded to 120 characters, and matches
original description, provider merchant, and local merchant override. The
search field updates the URL after a 300 ms debounce, retains current filters
and sort, and resets pagination. It uses replacement navigation to avoid one
history entry per edit; URL changes from browser Back/Forward synchronize the
field. Newer input clears the prior timer. The client tracks local request
generations so a slower older server response cannot replace a newer draft;
actual `popstate` navigation is marked separately and synchronizes the field.
Next App Router still owns cancellation of the underlying navigation.

All filter state is URL-backed and server-validated:

- date uses posted date then authorized date, with inclusive UTC days and an
  exclusive next-day upper bound;
- account options use `currentAccountWhere(ownerId)` and exclude inactive or
  disconnected historical Plaid accounts;
- effective category compares local override first and provider category next,
  including `Uncategorized`;
- amount minimum/maximum use absolute magnitude and exact `Decimal(19,4)`
  comparisons across positive and negative stored values;
- status accepts only the current Prisma enum.

The sortable desktop columns are Date, Transaction, and Amount, each supporting
ascending and descending directions. Date sorts by `postedAt` with
`authorizedAt` fallback, Transaction sorts by effective merchant precedence,
and Amount sorts by the absolute exact Decimal magnitude displayed by the UI.
Every ordering has creation-time and ID tie breakers. Sort and direction are
server-validated URL fields; filter submissions and page links preserve them,
while a new sort starts at page one.

Retained owner history remains queryable when its account is historical, with
an explicit label. A stale/tampered/cross-owner account filter returns no rows
and an unavailable message instead of broadening the query or leaking data.

Implementation decision: server pagination uses 50 rows, the smallest
conservative bounded strategy consistent with current server components. A
parameterized PostgreSQL query selects only the correctly ordered page of
owner-scoped IDs, including effective-merchant and exact-magnitude expressions;
the existing typed Prisma selection then loads those IDs and restores their
order. This avoids client sorting, unbounded history loads, unsafe interpolation,
or a denormalized second source of truth. The default is Date descending with
null dates last. Navigation preserves all active filters and sort state.

## Detail and local override design

Implementation decision: detail is a server-rendered page at
`/transactions/[transactionId]`, matching dashboard navigation and the
Overview row-link requirement. It separates effective and read-only source
cards, shows account/provenance, dates, amount/currency/status, notes/report
state, and useful pending/posted links. It exposes neither raw JSON nor internal
provider IDs.

The local correction form accepts a bounded category string with owner-derived
suggestions, the current `FinancialRole` enum, notes up to 1,000 characters,
and report exclusion. An explicit clear restores provider-derived behavior for
those four fields. It does not create category management. Successful saves
revalidate Transactions, Overview, and Calendar, then refresh recurring
detection. Projection failure is recoverable and cannot roll back a saved local
correction. Safe success/error feedback redirects back to detail.

Merchant correction and linked refund/reimbursement remain model-supported but
have no Milestone 8 editor. Effective display/search honors an existing
merchant correction, and mutations preserve both unrelated fields.

## Downstream financial behavior

Transfer and credit-card-payment rows remain visible with text stating their
non-income/non-spending meaning. Overview continues to count only posted,
non-removed, non-excluded activity with explicit effective roles. Transfers,
card payments, and investment activity stay outside income/spending; refunds
retain established expense-reduction behavior. Recent Overview rows now link
to owner-scoped detail.

Recurring detection remains posted-only and uses the shared effective merchant,
category, role, and exclusion. Calendar paid matching remains posted-only,
owner/currency/role compatible, and cannot use pending activity. Predicted-only
events never become overdue. Plaid sync continues updating only provider-owned
fields, preserving overrides, reconciling status atomically, and retaining
duplicate protections.

## States, accessibility, responsive layout, and themes

The ledger has populated, empty, filtered-no-results, unavailable-account, and
route loading states. Mutation errors are generic and accessible; safe detail
lookup uses the existing not-found boundary. Filters and override inputs have
programmatic labels, controls retain touch-size conventions, status feedback
uses live-region roles, table headers/caption are semantic, and all controls are
keyboard reachable. Sort links are native keyboard-operable links with
`aria-sort`, explicit accessible action names, and visible `↑`, `↓`, or `↕`
symbols, so direction never depends on color.

Status, role, override, historical source, removal, direction, and report
exclusion have text cues; meaning never relies on color. Current CSS variables
provide light/dark surfaces, focus rings, and semantic colors. No theme toggle
was added.

At narrow widths the ledger renders semantic list cards instead of a wide
table. The desktop table begins at `md`, includes a dedicated Date column, and
uses a fixed layout. Merchant, category, account, source, and detail values use
zero-minimum tracks plus anywhere wrapping so unusually long or unbroken text
cannot widen the page. The mobile treatment avoids horizontal scrolling at
375 x 812. Detail cards stack before using two columns.

## Schema, tests, verification, and known limitations

No Prisma or seed change was necessary. `TransactionOverride` already contains
all required fields, so no migration was added and deterministic seed totals
remain unchanged.

Focused unit/component tests cover URL parsing, all sortable-header directions,
sort/filter/page URL retention, search debounce and URL/history synchronization,
stale-search cancellation, category formatting/fallback/source preservation,
long-text containment, precedence, non-color labels, empty/no-results states,
detail accessibility, safe action validation and feedback, and Overview navigation.
PostgreSQL tests cover all three sort keys in both directions, sort with filters
and pagination, owner isolation,
deterministic retained history, disconnected accounts, effective search and
category, UTC dates, current account, status and exact Decimal filters, source
preservation, unrelated override preservation, empty-row cleanup, and safe
detail lookup. The full suite retains Plaid reconciliation/override survival,
Overview, recurring, Calendar, authentication/session, seed-idempotency,
responsive, and theme regressions.

Physical verification used an authenticated owner session in Chrome. It covered
the populated ledger; combined search, date, current-account, effective-
category, exact-amount, and status filters; filtered no-results; pending and
posted status; transfer and card-payment meaning; four-page navigation; current
and retained historical source labels; Overview-to-detail navigation; detail
source/effective separation; category, role, notes, and report-exclusion save
and clear; provider-value preservation; a Plaid Sandbox manual sync with local
override survival; keyboard traversal; default desktop layout; exact 375 x 812
ledger/detail layout; session-expiration redirect; and a clean browser console.
The mobile pass found an implicit-grid min-content overflow caused by a long
provider category. Explicit zero-minimum grid tracks and card `min-w-0` fixed
it, and a browser recheck proved `scrollWidth === clientWidth`.

The final usability-extension pass physically checked Date, Transaction, and
Amount in both directions; visible and accessible direction indicators; sort
retention with status filtering and page navigation; rapid active search; URL
updates; browser Back/Forward field synchronization; keyboard activation;
consumer category labels alongside unchanged source codes; and desktop
overflow. A deliberate in-flight race initially restored an older search. The
client now tracks locally issued request generations and distinguishes browser
history navigation; the same race then ended on the newest query and results.
A fresh Chrome tab contained only React DevTools/HMR informational messages and
no warnings or errors.

The connected Chrome automation surface did not expose viewport or color-scheme
emulation. Therefore, this extension pass does not claim a new physical exact
375 x 812 or light-mode run; the earlier exact-width Milestone 8 pass remains
valid for the base layout, while the extension adds fixed-table/anywhere-wrap
component regressions and retains the shared automated light/dark token tests.

The active browser reported dark system preference, and dark surfaces,
positive/negative/muted semantic states, focus behavior, and text cues were
physically checked. Its available control surface exposed viewport but not
color-scheme emulation, so a second physical light-mode override was not
claimed. `theme-foundations.test.ts` verifies light plus both dark token paths,
and component tests verify centralized semantic-token usage and non-color cues.
An entirely empty owner was not manufactured because doing so would require
destructive development-data changes; the empty state is covered by the
component suite, while the filtered no-results state was physically checked.

Known product limitations are deliberate: UTC day boundaries until an owner
time zone exists, string categories, sorting limited to the three approved
ledger columns, no merchant/refund-link editor, and no production provider
support. Milestone 9 and later work was not started.
