# Milestone 6 architecture: Plaid Sandbox

## Scope and ownership

Milestone 6 implements Plaid Sandbox only for the authenticated single owner.
Every owner-initiated query and mutation includes the authenticated `userId`;
the browser never supplies an owner identity. The webhook resolves ownership
only from the stored Plaid Item ID. Production, real institutions, payments,
transfers, identity, liabilities, income, Auth data, imports, and Milestone 7
are not implemented.

## Trust boundaries and Link sequence

The browser may receive a short-lived Link token and send a one-time public
token plus non-secret institution metadata. It never receives the Plaid client
secret, access token, encryption key, or stored ciphertext.

1. An authenticated same-origin request asks the server for a Link token.
2. The server creates a Sandbox token for Transactions using an HMAC-derived,
   non-email client-user ID and the configured webhook URL.
3. Official Plaid Link collects fake Sandbox credentials.
4. The browser sends the public token to the authenticated exchange route.
5. The server exchanges it, reads Item and institution metadata, encrypts the
   access token, creates provider-neutral records, and performs initial sync.
6. The unique Link session ID makes a browser retry idempotent.

Update mode decrypts the access token only on the server, requests a Link token
with `access_token` and no products, and reruns sync after Link succeeds. There
is no second public-token exchange.

## Configuration and client boundary

Plaid configuration is validated together at its server-only boundary. The
only accepted environment is `sandbox`; incomplete, malformed, non-Sandbox, or
key-reuse configurations fail closed. The official SDK is always constructed
with `PlaidEnvironments.sandbox`. Service functions accept injected Plaid and
database clients for deterministic tests. Provider errors are reduced to safe
codes, request IDs, and user messages; raw responses are not logged or exposed.

## Encryption and rotation

Access tokens use AES-256-GCM with a fresh 96-bit random IV and a dedicated
32-byte key. The versioned value stores `version.iv.tag.ciphertext` using
base64url. Authentication failure, an unknown version, malformed ciphertext,
wrong key, or tampering fails closed.

The current key is deployment configuration, never database content. A future
rotation should add a new ciphertext version/key identifier, decrypt with the
old key in a one-off server process, re-encrypt each token with a new key and
nonce, verify all rows, then retire the old key. Keys and plaintext tokens must
never enter logs, browser payloads, fixtures, documentation, or Git.

## Schema decision and indexes

The provider-neutral schema already contained DataSource,
InstitutionConnection, Account, Transaction, overrides, and history. The
forward-only Milestone 6 migration adds:

- Link-session idempotency, sync cursor/lock/attempt/error/disconnect fields on
  InstitutionConnection
- account mask and explicit balance availability
- transaction removal timestamp
- indexes for owner/status and sync-lock queries

The migration preserves all existing data. A missing provider balance retains
a non-authoritative numeric storage placeholder solely because the existing
column is non-null; `balanceAvailable=false` is authoritative, the UI displays
“Unavailable,” and every current aggregate excludes it.

## Account mapping and reconnect

Plaid account types map to existing checking, savings, credit-card, loan,
mortgage, brokerage, retirement, 401(k), and other types. Synced accounts are
upserted by source and Plaid account ID. A sync first marks accounts for that
connection inactive, then reactivates returned accounts. Manual/imported
records are untouched. A reconnect reuses exactly one inactive synced account
when institution, mask, name, and mapped type form an unambiguous match;
otherwise it creates a new normalized account instead of guessing.

Only active accounts contribute to current totals. Investment snapshots take
precedence over account balances, balance snapshots take precedence for other
accounts, and holdings remain detail rather than an additional total.
Disconnected and unavailable values therefore cannot double count.

## Transaction reconciliation and cursor atomicity

`/transactions/sync` starts at the stored cursor and reads every page. If Plaid
reports a mutation during pagination, collection restarts from the original
cursor with an empty accumulator. Added and modified records upsert by stable
Plaid transaction ID under the normalized account. Provider fields update, but
the separate local TransactionOverride relation is never replaced.

Removed records are marked canceled with `removedAt`; audit history is not
deleted. A posted replacement points to its former pending transaction and
marks that pending row canceled. Pending rows remain pending until replaced and
are already excluded from Calendar paid matching.

Account updates, transaction reconciliation, successful timestamps, source
health, and cursor advancement occur in one database transaction. A failed
page or database transaction leaves the previous cursor intact. A conditional
timestamp lock prevents overlapping manual/webhook syncs and permits recovery
from a stale 15-minute lock.

## Webhooks, repair, and disconnect

The public webhook is the sole authentication-cookie exception. It still trusts
no payload until the `Plaid-Verification` ES256 JWT is verified against Plaid's
JWK, including key ID/expiry, a five-minute issue-time window, and constant-time
comparison of the signed SHA-256 raw-body hash. Only the Sandbox
`TRANSACTIONS/SYNC_UPDATES_AVAILABLE` shape is accepted. Unknown Items are
acknowledged without work; duplicate delivery uses the same cursor and sync
lock.

`ITEM_LOGIN_REQUIRED` records a repair-needed status. Successful update mode
clears the safe error state and syncs. Disconnect requires a labeled,
focus-trapped confirmation dialog, calls `/item/remove`, clears ciphertext and
the sync lock, marks the source/connection/accounts inactive, and preserves
transactions and other history.

## UI, states, and accessibility

Accounts shows configuration-required, empty, syncing, ready, stale,
repair-needed, error, and disconnected text labels with theme-aware semantic
tokens. Actions include Connect, Sync now, Repair, and confirmed Disconnect.
The dialog names the institution, explains preservation consequences, supports
keyboard focus cycling, Escape cancellation, and focus restoration.
Transactions provides read-only normalized display with explicit pending,
posted, removed, and Plaid Sandbox labels. Loading states and missing-balance
states are announced in text. Layouts use responsive wrapping and established
light/dark CSS variables; meaning never depends on color alone.

## Tests and limitations

Deterministic tests cover configuration, encryption, owner scope, exchange
idempotency, encrypted persistence, account mapping, missing balances, manual
preservation, transaction reconciliation, pagination, pagination-mutation
restart, cursor atomicity, local overrides, pending replacement, concurrent
sync, webhook verification/unknown/duplicate handling, update mode, repair,
disconnect preservation, reconnect deduplication, route protection, semantic
states, and Milestones 1–5 regressions. PostgreSQL integration tests require an
isolated database name containing `test` and never silently target development
data. Physical Link and webhook verification requires user-provided official
Sandbox credentials and a reachable HTTPS webhook URL.
