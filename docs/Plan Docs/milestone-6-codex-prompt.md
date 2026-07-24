# Milestone 6 Codex Prompt

## Objective

Build Milestone 6: Plaid Sandbox integration.

Implement an owner-scoped Sandbox flow for connecting a synthetic institution, securely storing connection credentials, syncing accounts and transactions, handling transaction-update webhooks, and repairing an Item through Plaid Link update mode.

Do not begin Milestone 7.

## Read First

Before changing files:

1. Confirm `main` matches `origin/main`.
2. Confirm the working tree is clean.
3. Confirm the current branch is `feature/milestone-6`.
4. Read every file under `docs/Plan Docs/`.
5. Inspect completed Milestones 1–5, authentication, route protection, Prisma schema/migrations/seed/tests, environment validation, CI, README, architecture notes, and current source-precedence rules.
6. Stop and report any conflict before implementation.

Use the updated build plan as the source of truth.

## Authoritative Plaid Direction

- Create Link sessions with `/link/token/create`.
- Use Plaid Link in the browser.
- Exchange the temporary `public_token` on the server through `/item/public_token/exchange`.
- Store the resulting `access_token` only on the server and encrypted at rest.
- Use `/transactions/sync`, not `/transactions/get`.
- Persist the transaction-sync cursor.
- Process all pages while `has_more` is true.
- On `TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION`, restart from the original cursor for that sync attempt.
- Call `/transactions/sync` once after connection to initialize sync webhooks.
- Handle `SYNC_UPDATES_AVAILABLE`.
- Use Link update mode for broken or expired Items.
- Use Plaid Sandbox only.
- Use Sandbox webhook simulation where useful.

Never expose Plaid secrets, access tokens, or raw provider credentials to the browser, logs, test snapshots, errors, Git, or documentation.

## Scope

Implement:

- Plaid SDK and server-only client
- strict Sandbox environment configuration
- Link-token creation
- Plaid Link launch
- public-token exchange
- encrypted access-token storage
- owner-scoped institution connection persistence
- Plaid account synchronization
- cursor-based transaction synchronization
- pending, posted, modified, and removed transaction handling
- webhook endpoint
- `SYNC_UPDATES_AVAILABLE` processing
- connection health/error state
- manual sync
- Link update-mode repair flow
- safe disconnect flow
- connection status UI
- loading, empty, partial, stale, syncing, repair-needed, disconnected, and error states
- deterministic tests plus optional live Sandbox verification
- documentation

Do not implement Plaid Production, real institutions, recurring detection, transaction editing, CSV/PDF import, Fidelity automatic sync, payments, transfers, identity, liabilities, income, Auth routing numbers, or Milestone 7.

## Products and Link Configuration

Initialize Link with only:

- `transactions`

Use United States country configuration and USD-compatible handling unless the existing requirements say otherwise.

Use a stable per-owner Plaid client user identifier that does not expose the owner email.

Create Link tokens server-side. Do not persist Link tokens.

## Environment Configuration

Add validated variables using the existing project pattern:

```text
PLAID_CLIENT_ID
PLAID_SECRET
PLAID_ENV=sandbox
PLAID_WEBHOOK_URL
PLAID_TOKEN_ENCRYPTION_KEY
```

Requirements:

- fail safely when required variables are missing
- reject non-Sandbox environments in Milestone 6
- keep `.env.example` free of real credentials
- never commit `.env`
- document Sandbox credential setup
- use a dedicated encryption key separate from session/authentication secrets
- validate key format and length
- never print secrets

## Plaid Client

Create one server-only, typed Plaid client boundary.

Requirements:

- Sandbox base path only
- centralized error normalization
- test-injectable client
- no access token accepted from browser requests
- no sensitive payload logging
- safe Plaid request IDs and provider error codes may be logged

## Encryption

Encrypt Plaid access tokens before persistence.

Requirements:

- authenticated encryption such as AES-256-GCM
- random nonce/IV per encryption
- authentication tag
- versioned encrypted payload
- server-only decryption immediately before Plaid requests
- fail closed on tampering or wrong key
- tests for round trip, unique ciphertext, wrong key, and tampering
- documented future key-rotation strategy

Do not invent custom cryptography.

## Data Model

Prefer reusing:

- `DataSource`
- `InstitutionConnection`
- `Account`
- `Transaction`

Connection persistence may require:

- owner
- provider
- Plaid Item ID
- encrypted access token
- institution ID/name
- status
- safe error code/details
- sync cursor
- last attempted/successful sync
- repair-needed state
- disconnected state

Use provider-neutral names where practical.

If schema changes are required, explain each gap, create one forward-only migration, preserve history, test upgrade and replay, add indexes, and never store raw bank credentials.

## Link and Exchange Flow

1. User clicks Connect institution.
2. Server creates a Link token.
3. Browser opens Plaid Link.
4. Link returns a temporary public token.
5. Browser sends it to an authenticated server action or route.
6. Server exchanges it for an access token and Item ID.
7. Server encrypts and stores the access token.
8. Server fetches and persists institution/account metadata.
9. Server performs the first `/transactions/sync`.
10. UI reports connected, syncing, ready, partial, or repair-needed.

Requirements:

- never store the public token
- owner-scope exchange
- prevent duplicate Items where practical
- make retries idempotent
- show safe errors
- never serialize Plaid responses wholesale to the client

## Account Sync

Synchronize Plaid accounts into existing `Account` records.

Requirements:

- stable identity from Plaid account ID
- owner and connection scoping
- upsert instead of duplicate
- preserve provider values
- carefully map account types/subtypes
- store masks only when provided
- missing balances remain unavailable, not zero
- preserve manual accounts
- never auto-merge manual and Plaid accounts
- keep disconnected provider history traceable
- prevent double-counting
- record source and freshness
- preserve provider originals and use existing override strategy for local edits

## Transaction Sync

Use `/transactions/sync` and persist:

- added
- modified
- removed
- `next_cursor`
- `has_more`

Requirements:

- process every page
- advance stored cursor only after the full batch succeeds
- retain original cursor until commit
- restart from original cursor on mutation-during-pagination
- use a database transaction where practical
- stable identity from Plaid transaction ID
- idempotent reprocessing
- preserve provider values and local overrides
- distinguish pending and posted
- handle pending-to-posted replacement safely
- do not silently destroy audit history for removed provider transactions
- pending transactions cannot satisfy confirmed bill matching
- do not create recurring streams in Milestone 6

## Webhooks

Add a Plaid webhook route.

Requirements:

- validate supported payload shape/type/code
- return quickly
- handle `TRANSACTIONS / SYNC_UPDATES_AVAILABLE`
- resolve connection by Item ID
- never trust owner IDs from webhook input
- owner-scope resulting sync through stored relationships
- idempotent processing
- safe unknown-Item behavior
- no sensitive logging
- document local-development limitations

Use official webhook verification if reliably supported by the current SDK. Otherwise document the limitation and use strict validation, Item lookup, replay-safe processing, and HTTPS assumptions. Do not invent a signature scheme.

## Manual Sync

Add an authenticated owner-only sync action.

Requirements:

- one connection at a time
- prevent accidental concurrent sync
- safe retry
- update attempt/success timestamps
- show change counts when practical
- never expose internal errors or tokens

## Repair Flow

Implement Link update mode.

Requirements:

- create update-mode Link token from the stored Item access token
- decrypt only server-side
- preserve existing IDs/history
- update status on success
- rerun account and transaction sync
- show clear Repair connection action
- distinguish repair-needed from disconnected

## Disconnect Flow

Requirements:

- explicit confirmation
- explain consequences
- mark the connection disconnected/inactive
- determine and document whether `/item/remove` is used in Sandbox
- preserve historical local data unless separately confirmed for deletion
- never delete transactions on one click
- exclude disconnected balances from current totals according to documented rules
- support future reconnection without duplication

## UI

Add Plaid connection management under Accounts and/or Settings according to existing architecture.

Show:

- institution
- status
- source: Plaid Sandbox
- last successful/attempted sync
- account count
- repair-needed state
- Sync, Repair, and Disconnect actions
- clear Sandbox badge

Use semantic colors without color-only meaning. All new UI must support light and dark themes. Never imply that real institutions are connected.

## Authentication and Authorization

Every Link, exchange, sync, repair, and disconnect action must require the authenticated owner.

Never accept owner ID, Item ID, or access token from the client when it can be derived server-side.

## Seed and Fixtures

Do not seed real Plaid tokens or credentials.

Use deterministic fixtures for accounts, paginated transaction sync, added/modified/removed transactions, pending-to-posted replacement, webhooks, and repair-needed errors.

Clearly distinguish mocked fixtures from live Sandbox verification.

## Testing

At minimum test:

1. environment validation and Sandbox-only enforcement
2. encryption round trip, nonce uniqueness, wrong-key, and tamper failure
3. owner-scoped Link-token creation and exchange
4. encrypted token persistence
5. idempotent duplicate exchange
6. account upsert and missing-balance handling
7. manual-account preservation
8. added, modified, and removed transactions
9. pending-to-posted replacement
10. local override preservation
11. pagination
12. cursor atomicity
13. mutation-during-pagination restart
14. initial sync
15. webhook sync and duplicate webhook handling
16. unknown Item webhook
17. manual sync and concurrent-sync prevention
18. repair/update-mode flow
19. disconnect confirmation and historical-data preservation
20. double-count prevention
21. pending transactions do not satisfy paid matching
22. route protection
23. safe error messages and no token leakage
24. semantic status labels and light/dark rendering
25. loading/empty/partial/stale/error states
26. Overview, Calendar, and Manual Portfolio regressions
27. seed idempotency
28. full PostgreSQL CI execution without silent skips

Use deterministic mocked Plaid responses for most automated tests. Gate optional live Sandbox tests behind dedicated environment variables.

## Physical Sandbox Verification

Using official Sandbox credentials only, physically verify:

- Link launch and successful Sandbox login
- public-token exchange
- account creation
- initial transaction sync
- account/transaction display
- manual sync
- webhook simulation where locally reachable
- update mode
- disconnect confirmation
- reconnect without duplicates
- Overview totals
- Calendar paid-matching rules
- mobile layout
- light/dark rendering
- logout and protected routes
- clean browser console

Never use real bank credentials.

## Documentation

Update README with setup, environment variables, Sandbox credentials, Link flow, encryption, sync cursor behavior, webhooks, repair, disconnect, source precedence, tests, and explicit non-support for Production/real institutions.

Create:

```text
docs/architecture-milestone-6.md
```

Document ownership, trust boundaries, Plaid client boundary, Link/exchange sequence, encryption and rotation plan, schema decision, account mapping, transaction reconciliation, cursor atomicity, webhooks, repair, disconnect, double-count prevention, errors/states, tests, limitations, and confirmation that Milestone 7 is not implemented.

Do not modify planning documents unless explicitly asked.

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

- run full PostgreSQL tests with both `DATABASE_URL` and `TEST_DATABASE_URL` pointed to the isolated test DB
- test migration upgrade and full replay
- run seed twice
- scan for committed Plaid secrets/tokens
- physically verify Sandbox flows
- run `git diff --check`
- restore `next-env.d.ts`
- remove temporary logs
- confirm no real credentials are in the working tree
- confirm Milestone 7 was not started

## Git Hygiene

Work on:

```text
feature/milestone-6
```

Do not commit or push implementation changes unless explicitly asked.

## Completion Criteria

Milestone 6 is complete only when Sandbox Link, token exchange, encryption, account sync, cursor-based transaction sync, webhook processing, manual sync, repair, disconnect, owner scoping, regression safety, and all required checks pass without real institutions or Milestone 7 work.

## Final Report

Stop and report:

1. implementation summary
2. Link and exchange flow
3. encryption design
4. account sync
5. transaction reconciliation and cursor behavior
6. webhook behavior
7. repair and disconnect
8. UI and states
9. files changed
10. schema/migration decision
11. seed/fixtures
12. tests and totals
13. security/privacy controls
14. accessibility/theme/responsive behavior
15. commands/results
16. physically tested Sandbox flows
17. assumptions
18. unresolved issues
19. confirmation no real credentials were committed
20. confirmation Milestone 7 was not started
