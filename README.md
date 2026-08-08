# Personal Finance Dashboard

A private, single-owner personal finance dashboard. Milestone 7 adds deterministic recurring-pattern detection, bounded Calendar projections, and posted-transaction matching on top of the Sandbox-only Plaid integration. Every bundled or seeded financial value is fake; Plaid Production and real institutions are not supported.

## Prerequisites

- Node.js 20.9 or newer (Node.js 22 LTS recommended)
- pnpm 11.9
- Docker Desktop, or an accessible PostgreSQL 16 database

## Local setup

1. Install dependencies: `pnpm install`
2. Copy `.env.example` to `.env`.
3. Replace `AUTH_SECRET` with at least 32 random characters and `TOKEN_ENCRYPTION_KEY` with 64 random hexadecimal characters. For Plaid Sandbox, also set the five `PLAID_*` variables described below. Do not commit `.env`.
4. Start PostgreSQL: `docker compose up -d postgres`
5. Generate Prisma Client: `pnpm db:generate`
6. Apply migrations: `pnpm db:migrate`
7. Create the sole owner account (PowerShell):
   `$env:OWNER_PASSWORD="a-unique-password-with-12-or-more-characters"; $env:OWNER_NAME="Your Name"; pnpm owner:create you@example.com; Remove-Item Env:OWNER_PASSWORD`
8. Optionally load clearly fake development records: `pnpm db:seed`
9. Start the app: `pnpm dev`
10. Open `http://localhost:3000` and sign in.

`owner:create` creates or updates the same owner email and refuses to add a different second user. The seed reuses an existing owner and never changes that owner's email, name, or password hash. If no owner exists, it creates a clearly synthetic `example.test` owner with login disabled; run `owner:create` afterward to configure usable credentials.

## Local Development Startup

After the one-time dependency, `.env`, and owner setup above, normal Windows
development startup is:

```powershell
pnpm dev:start
```

This command verifies Node, pnpm, Docker, dependencies, `.env`, and the owner
record; starts the PostgreSQL Compose service when needed; waits for database
health; generates Prisma Client; safely applies checked-in pending migrations;
starts or reuses only this project's Next.js development server; waits for
`/login`; and opens `http://localhost:3000/login`. It does not install
dependencies, reset or seed the database, edit `.env`, or enter owner
credentials. Login always remains manual.

Use the supporting commands as follows:

- `pnpm dev:doctor` reports required and optional checks in `PASS`, `WARN`, and
  `FAIL` form without printing passwords, tokens, keys, cookies, owner data, or
  connection-string passwords.
- `pnpm dev:stop` stops only a process tree that is verified as this project's
  Next.js server. It also stops ngrok only when this workflow started it,
  removes ignored runtime state/log files, and leaves PostgreSQL running.
- `pnpm dev:start:plaid` adds Plaid Sandbox and encryption-key-shape checks,
  starts or detects ngrok, requires an HTTPS tunnel, and compares its host with
  `PLAID_WEBHOOK_URL`. A mismatch is reported without rewriting `.env`.
  Ordinary `dev:start` does not require Plaid or ngrok.

If port 3000 already belongs to this project's server, startup reuses it and
records it for a safe later `dev:stop`. Use
`pnpm dev:start -Restart` to request a verified restart. If a stale state
file remains after a crash, `pnpm dev:stop` revalidates the saved PID and
process start time before acting; it refuses PID reuse and unrelated Node
processes. Runtime state and logs live under ignored `.dev-runtime/` and are
removed on shutdown.

The sign-in page links to an honest recovery-status page, but automated password reset is not configured. It does not use security questions or collect reset information. The planned secure flow uses a single-use, short-lived token delivered to the verified owner email, generic request responses, rate limiting, and invalidation of all existing owner sessions after a successful reset. Until that work is implemented, the installation operator must restore access through the local `owner:create` workflow.

## Session security

Authentication remains owner-only and uses opaque, server-generated session
tokens. The browser receives the token only in a `HttpOnly`, `SameSite=Lax`,
path-wide cookie (`Secure` in production). PostgreSQL stores only an
HMAC-SHA-256 digest, plus the session lifecycle timestamps and minimal
revocation reason; raw tokens are never persisted or logged.

The server independently enforces a 15-minute inactivity timeout and an
eight-hour absolute timeout. Two minutes before the earlier deadline, every
open dashboard tab shows an accessible warning. “Stay signed in” asks the
server to renew only the idle deadline and can never move the absolute
deadline. Passive status checks, rendering, prefetching, polling, and Plaid
webhooks do not extend a session. Explicit dashboard navigation and
authenticated mutations are meaningful activity, with database writes
throttled to once per minute.

Logout revokes the current database session, clears the cookie, coordinates
the result across tabs, and returns to `/login`. Timeout does the same and
uses `/login?reason=expired` for a generic explanation. Focus, visibility,
page-show, browser wake, and online events reconcile against server time, so a
sleeping or offline tab cannot rely on a stale client countdown. Unsaved form
changes may be lost when a session ends.

The server policy can be shortened for local physical testing by placing the
overrides in the local `.env` file and restarting the development server:

```dotenv
SESSION_IDLE_TIMEOUT_SECONDS="900"
SESSION_WARNING_THRESHOLD_SECONDS="120"
SESSION_ABSOLUTE_TIMEOUT_SECONDS="28800"
SESSION_ACTIVITY_THROTTLE_SECONDS="60"
```

`.env.example` documents the available variables and defaults; Next.js does
not use it as runtime configuration. Do not commit `.env`.

The warning threshold must be shorter than the idle timeout, and the absolute
timeout must not be shorter than the idle timeout. These variables are
server-only; the status response exposes only the current deadlines, server
time, warning threshold, and safe status. Existing pre-Milestone-7.5 sessions
are retained as revoked audit rows during migration and require one fresh
sign-in. Revoked rows are cleaned up after 30 days during login rather than on
every request.

Current limitations are intentional: there is no MFA, passkey, remembered
device, device/session management, sign-out-all-devices, login-history, or
user-configurable timeout UI. Those are future security scope, not Milestone
7.5.

## Commands

- `pnpm dev` — local development server
- `pnpm dev:start` — verified normal local startup and `/login` launch
- `pnpm dev:start:plaid` — verified local startup with Plaid Sandbox/ngrok checks
- `pnpm dev:doctor` — redacted local-tooling and service diagnostics
- `pnpm dev:stop` — stop only the verified project server and workflow-owned ngrok
- `pnpm build` / `pnpm start` — production build and local production server
- `pnpm lint` — ESLint
- `pnpm format:check` / `pnpm format` — check or apply formatting
- `pnpm typecheck` — strict TypeScript check
- `pnpm test` / `pnpm test:watch` — Vitest suite
- `pnpm db:generate` — generate Prisma Client
- `pnpm db:migrate` — create/apply development migrations
- `pnpm db:deploy` — apply checked-in migrations without creating new ones
- `pnpm db:seed` — idempotently load synthetic portfolio, Plaid-safe, calendar, dashboard, and recurring-detection records
- `pnpm db:studio` — inspect the development database

To run the destructive model tests locally, create a separate database whose name contains `test`, migrate it, and provide it only through `TEST_DATABASE_URL`. The tests refuse to run against a URL whose database name does not contain `test`.

```powershell
$env:DATABASE_URL="postgresql://finance:finance_dev_only@localhost:5432/personal_finance_test?schema=public"
$env:TEST_DATABASE_URL=$env:DATABASE_URL
pnpm db:deploy
pnpm test
```

For a clean local reset, first confirm that `DATABASE_URL` points to the disposable development database, then run `pnpm exec prisma migrate reset`. This deletes all data, replays every migration, and runs the synthetic seed. Never run it against a database containing data you need to keep.

## Milestone 3 demo dashboard

After `pnpm db:seed`, the authenticated Overview displays:

- Net worth, cash, available cash, card debt, credit utilization, investments, current-month income/spending/cash flow, and upcoming bills
- Active account balances with synced/imported/manual source labels
- Posted and pending recent transactions with effective local overrides
- Accessible spending-category bars with a text equivalent
- Predicted and confirmed upcoming activity from existing calendar events
- Investment accounts using one current value per account
- A 30-day, snapshot-backed tracked-net-worth trend
- Provider-neutral freshness, stale, disconnected, error, partial, loading, empty, and error behavior

Finalized monthly metrics use posted transactions with an explicit financial-role override. Pending transactions, transfers, card payments, investment activity, ignored rows, and report-excluded rows do not affect income or spending. Expense overrides take precedence over provider display fields, and explicitly classified refunds reduce their effective spending category. No original transaction is mutated.

Investment totals use the latest balance snapshot for each investment account, falling back to that account's normalized current balance. Holdings are display/audit detail and are not added again. Current net worth adds cash, one value per investment account, other active asset accounts, and manual assets, then subtracts card/loan/mortgage/manual debts. The historical trend uses only stored account and investment snapshots and is labeled partial when manual-asset history is unavailable.

Money calculations remain in Prisma `Decimal` until final locale-aware formatting. Dashboard calendar boundaries currently use UTC because the owner profile has no time-zone field. Aggregate demo totals assume the seeded USD currency; individual account and transaction rows retain their own currency labels. Sources become stale after seven days without a relevant update.

Bills, Spending, and Settings remain placeholders. The Transactions route remains read-only and intentionally does not include Milestone 8 editing, search, or filters. There is no importing, performance analysis, or production integration.

## Milestone 4 calendar and recurring events

The authenticated Calendar provides:

- A keyboard-accessible traditional month grid with previous/next and current-month navigation, concise event summaries, selected-day details, and a chronological list alternative
- An upcoming list with inclusive 14, 30, 60, and 90-day UTC ranges; 30 days is the default
- URL-backed filters for every supported event type, confirmed dates, predicted dates, and needs-confirmation items
- Text labels for predicted versus confirmed dates, expected-amount source, confidence, source, and status
- Separate display of a confirmed due date and supplemental predicted posting date
- Owner-scoped actions to confirm a prediction, correct due date/amount/frequency, update notes, mark paid/skipped/not-a-bill, deactivate a stream, accept a payment match, and create a manual recurring event

Corrections append `CalendarOverride` snapshots instead of modifying inferred, provider, or imported values. Effective precedence is event override, stream override, user-confirmed event fields, source event fields, then recurring-stream fallback. Confirmed due dates are always primary. Predicted posting dates are estimates and never presented as contractual due dates.

An occurrence is overdue only when it has a confirmed past due date, has no accepted posted transaction, and is not paid, skipped, inactive, or dismissed as not a bill. Predicted-only occurrences are never overdue. Inactive and skipped items remain visible in their month for history but are excluded from the default upcoming list.

Payment matching considers only posted transactions in the same currency. It scores the normalized recurring merchant/description identity, account, Decimal-safe amount tolerance (the greater of 5 currency units or 10%), posting-date proximity within seven days, and compatible financial role. An unclassified transaction cannot become a high-confidence match. Strong matches can be accepted directly; lower-confidence suggestions require an explicit confirmation. Acceptance links the normalized transaction and records the absolute actual amount without changing transaction source fields. Manual “mark paid” remains available when no transaction should be linked.

The seed includes clearly fake examples for every event type and confidence level, predicted and confirmed dates, a confirmed due date with a separate posting prediction, fixed and estimated amounts, paid/skipped/inactive/manual/needs-confirmation states, a month boundary, multiple events on one date, and both high- and low-confidence matching scenarios. Run `pnpm db:seed` more than once safely. Milestone 7 detection may now add inferred streams and bounded future occurrences from the dedicated synthetic history.

Calendar freshness uses the existing seven-day threshold. Missing amounts or sources needing attention produce a partial-data notice while keeping available records visible. All calendar dates use UTC because the owner profile does not yet include a time zone. Currency is displayed per record, but conversion or aggregation across currencies is not implemented.

## Milestone 5 manual assets and investments

The authenticated Accounts, Investments, and Net Worth pages now support:

- Manual checking, savings, brokerage, retirement, 401(k), mortgage, loan, credit-card, other-asset, and other-debt accounts
- Manual homes, real estate, vehicles, private assets, mortgages, auto loans, student loans, personal loans, and other debts
- Exact `DECIMAL(19,4)` balance and investment snapshots with chronological history and duplicate timestamp protection
- Create, update, deactivate, and referentially safe delete flows scoped to the authenticated owner
- Editable metadata templates for Fidelity Individual TOD, UnitedHealth Contribution, and UnitedHealth Group 401(k) Savings Plan
- Source, active/inactive, current/stale, and partial labels that never rely on color alone
- Holdings display where records exist; holdings are detail and are not added to account totals

Current values use one authoritative value per account. Investment accounts use the latest investment snapshot, other accounts use the latest balance snapshot, and both fall back to the normalized account balance. Active manual assets and debts use their current manual value. Holdings are not added again. Inactive records remain visible but are excluded. Net worth is active assets and investments minus active debts, with all arithmetic kept in Prisma `Decimal`.

Manual values become stale after seven days without a snapshot or update. A source in needs-attention or error state marks totals partial while retaining available values. The demo seed includes a home, mortgage, vehicle, auto loan, active/inactive records, all three Fidelity templates, a manual brokerage, holdings, and fresh/stale snapshots.

Semantic financial styles are centralized as theme-aware CSS variables and reusable components: assets/income/paid are green, debts/spending/overdue red, predicted/stale/warnings amber, confirmed/synced informational blue, investments purple, and inactive/unavailable states gray. The foundations respect system light/dark preference and include future explicit `.light`/`.dark` overrides. Milestone 5 intentionally does not expose a theme selector; that remains Milestone 10 work.

Fidelity templates contain editable labels and account metadata only. They never collect credentials, sign in, or automatically sync. Automatic Fidelity/NetBenefits sync, CSV import, investment performance, allocation, trading, and advice are not implemented.

## Milestone 6 Plaid Sandbox

Plaid support is intentionally restricted to the official Sandbox. Create
Sandbox API keys in the Plaid dashboard and configure:

```dotenv
PLAID_CLIENT_ID="your-sandbox-client-id"
PLAID_SECRET="your-sandbox-secret"
PLAID_ENV="sandbox"
PLAID_WEBHOOK_URL="https://your-public-development-url.example/api/plaid/webhook"
PLAID_TOKEN_ENCRYPTION_KEY="a-dedicated-64-character-hex-key"
```

`PLAID_ENV` accepts only `sandbox`. The Plaid encryption key must differ from
`TOKEN_ENCRYPTION_KEY`. Secrets and access tokens are server-only and must
never be committed, logged, returned to the browser, or placed in fixtures.
If Plaid configuration is absent or invalid, the rest of the dashboard remains
available and Accounts shows a safe configuration-required state.

From Accounts, “Connect Sandbox institution” requests a short-lived Link token
for the Transactions product. Plaid Link handles only official fake Sandbox
credentials. The browser returns a one-time public token; the server exchanges
it, encrypts the resulting access token with AES-256-GCM and a unique nonce,
stores only ciphertext, maps accounts into the provider-neutral schema, and
runs the initial cursor-based `/transactions/sync`.

Manual sync and verified `SYNC_UPDATES_AVAILABLE` webhooks reuse the same sync
engine. Cursor advancement, account updates, and added/modified/removed
transaction reconciliation commit atomically. A mutation during pagination
restarts from the original cursor. Provider removal is preserved as canceled
history, pending-to-posted replacements are linked, and local overrides remain
separate and authoritative. Pending transactions cannot satisfy Calendar paid
matching.

Update mode uses the encrypted server-side access token to repair an Item and
does not exchange another public token. Disconnect requires confirmation,
calls Plaid Item removal, destroys the local ciphertext, deactivates the source
and accounts, and retains normalized historical transactions. Reconnecting a
single unambiguous account reuses its local identity to avoid double counting.
Balances missing from Plaid are displayed as unavailable and excluded from
totals.

Replacement Sandbox Items also use a deterministic
owner/institution/mask/type/name identity when Plaid assigns new Item and
provider account IDs. Historical Item-to-account identities remain in a
separate audit relation, while only the current connection contributes to
totals. Owner-level locking and database uniqueness prevent repeated or
concurrent reconnects from creating a second logical account.

For legacy development data created before this identity model, run
`pnpm plaid:repair-accounts` first. It executes the complete repair in a
transaction and rolls it back after reporting the proposed counts. After
creating a backup and reviewing the report, run
`pnpm plaid:repair-accounts -- --apply`. The repair is idempotent, remaps
dependent records, records merged account metadata, and retains redundant
transaction and stream rows as inactive audit history.

Plaid signs webhooks with an ES256 JWT in `Plaid-Verification`. The endpoint
validates the official JWK, algorithm, key lifetime, five-minute issue window,
and SHA-256 raw-body digest before finding the Item by its stored provider ID.
Local webhook testing needs an HTTPS URL reachable by Plaid; use only a
developer-controlled tunnel and never include credentials in its URL.

Most tests use deterministic mocked Plaid responses. Optional physical testing
must use official Sandbox credentials and Sandbox institutions only. This
milestone does not support Plaid Production, real bank credentials, payments,
transfers, identity, liabilities, income, Auth/routing data, automatic
Fidelity sync, or provider imports.

## Milestone 7 recurring detection

Recurring detection uses normalized local posted transactions on active
owner-owned accounts. It excludes pending, canceled, removed, report-excluded,
refund, investment, cash-withdrawal, unsupported fee/interest, unclassified,
and generic-transfer records. Transaction overrides take precedence for the
effective merchant, category, financial role, and report exclusion; original
provider values remain unchanged.

Counterparties are normalized deterministically by case/whitespace,
punctuation, common domain suffixes, and conservative trailing numeric
references. Detection groups only within the same owner, account, currency,
flow direction, financial role, recurring type, and normalized counterparty.
No fuzzy merchant merging or cross-account grouping occurs.

Supported inferred frequencies are weekly (7 ±2 days), biweekly (14 ±3),
semimonthly with two calendar anchors, monthly with ±5-day calendar drift,
quarterly with ±10-day drift, and annual with ±14-day drift. Three observations
are required except for a clear annual pair. One missing cycle is tolerated.

Expected amount is the exact-Decimal median. Median absolute deviation
determines fixed versus estimated amounts and limits outlier influence.
Confidence combines observation count, interval regularity, amount stability,
merchant quality, account consistency, continuity, and missed-cycle penalties.
High begins at `0.80`; medium at `0.55`. Only high and medium candidates create
events.

Inferred streams and projections use nullable owner-scoped deterministic keys,
so repeated or concurrent runs update rather than duplicate. Calendar
projection is bounded to 90 days, except that an annual stream retains one next
occurrence. Two missed cycles make only an inferred, unconfirmed stream
inactive; history remains intact.

Predicted posting dates never populate confirmed due dates. Existing Calendar
overrides and user-confirmed values remain authoritative. Predicted-only events
never become overdue.

Eligible posted transactions can satisfy projected events using exact stream
identity, account, currency, financial role/direction, Decimal-safe amount
tolerance, and a five- or seven-day date window. Pending/removed transactions
cannot match, ambiguous candidates remain unmatched, and one transaction
cannot satisfy two events.

Detection runs after a successfully committed Plaid exchange, manual sync,
repair, or verified transaction webhook. A detection failure cannot roll back
Plaid history. Calendar also provides an authenticated “Refresh recurring
detection” recovery control. PostgreSQL advisory locking plus unique indexes
protect overlapping runs.

The synthetic seed includes fixed monthly, variable monthly, biweekly income,
an insufficient-history lookalike, and pending activity. Run the seed twice,
then use Calendar’s refresh control to demonstrate idempotent projection.
See [the Milestone 7 architecture note](docs/architecture-milestone-7.md) for
normalization tradeoffs, score weights, matching caps, and schema details.

## Data model

The schema normalizes data from Plaid, CSV imports, manual entry, Fidelity files, and future providers into shared internal records:

- Sources, institution connections, and checking, savings, debt, brokerage, retirement, 401(k), manual, and other accounts
- Original transactions plus separate local overrides
- Recurring streams, projected/confirmed calendar occurrences, and separate calendar overrides
- Imported, synced, and manual investment holdings, balances, and transactions
- Manual assets and debts, historical account balances, and import-job audit records

All financial root records carry `userId`; balance snapshots are also directly owner-scoped so a full owner purge can coexist with account-delete protection. Secondary foreign keys prevent an in-use data source or account from being deleted. Provider-connection deletion only nulls the optional account connection link, and source overrides cascade with the source record. See [the Milestone 2 architecture note](docs/architecture-milestone-2.md) for the complete relationship policy.

Money uses PostgreSQL `DECIMAL(19,4)` through Prisma `Decimal`, never floating point. It supports 15 whole-number digits and four fractional digits. Security quantities use `DECIMAL(28,10)`. Currency fields contain three-character ISO-4217 codes and default to `USD`. Debt balances and manual debt values are stored as positive amounts owed; the account type or `isDebt` flag supplies the financial meaning.

## Environment

All variables are described in `.env.example`. Core startup fails with
field-specific validation errors when the PostgreSQL URL, application URL,
auth secret, or general token-encryption key is invalid. Plaid validates its
complete Sandbox-only configuration at the server integration boundary so an
unconfigured dashboard can still render safely. Only server modules can read
these values.

## Current status

Milestone 7 includes owner-scoped recurring detection, confidence scoring,
inferred-stream upsert, bounded Calendar projection, posted-only matching, and
Plaid sync/webhook triggering. Milestones 1–6 remain intact.

No real-institution or Plaid Production integration, automatic Fidelity sync,
CSV/PDF parsing, import UI, Milestone 8 transaction management, full Bills or
Spending product, bill payment, investment performance analysis, theme
selector, multi-user feature, or production deployment exists. See
`docs/Plan Docs/build-plan.md` for the future sequence.
