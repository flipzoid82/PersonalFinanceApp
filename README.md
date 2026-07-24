# Personal Finance Dashboard

A private, single-owner personal finance dashboard. Milestone 5 adds manual accounts, assets, debts, investment balances, Fidelity metadata templates, source-aware net worth, and light/dark semantic foundations alongside the Milestone 3 Overview and Milestone 4 Calendar. No financial institution is connected, and every bundled financial value is fake.

## Prerequisites

- Node.js 20.9 or newer (Node.js 22 LTS recommended)
- pnpm 11.9
- Docker Desktop, or an accessible PostgreSQL 16 database

## Local setup

1. Install dependencies: `pnpm install`
2. Copy `.env.example` to `.env`.
3. Replace `AUTH_SECRET` with at least 32 random characters and `TOKEN_ENCRYPTION_KEY` with 64 random hexadecimal characters. Do not commit `.env`.
4. Start PostgreSQL: `docker compose up -d postgres`
5. Generate Prisma Client: `pnpm db:generate`
6. Apply migrations: `pnpm db:migrate`
7. Create the sole owner account (PowerShell):
   `$env:OWNER_PASSWORD="a-unique-password-with-12-or-more-characters"; $env:OWNER_NAME="Your Name"; pnpm owner:create you@example.com; Remove-Item Env:OWNER_PASSWORD`
8. Optionally load clearly fake development records: `pnpm db:seed`
9. Start the app: `pnpm dev`
10. Open `http://localhost:3000` and sign in.

`owner:create` creates or updates the same owner email and refuses to add a different second user. The seed reuses an existing owner and never changes that owner's email, name, or password hash. If no owner exists, it creates a clearly synthetic `example.test` owner with login disabled; run `owner:create` afterward to configure usable credentials.

The sign-in page links to an honest recovery-status page, but automated password reset is not configured. It does not use security questions or collect reset information. The planned secure flow uses a single-use, short-lived token delivered to the verified owner email, generic request responses, rate limiting, and invalidation of all existing owner sessions after a successful reset. Until that work is implemented, the installation operator must restore access through the local `owner:create` workflow.

## Commands

- `pnpm dev` — local development server
- `pnpm build` / `pnpm start` — production build and local production server
- `pnpm lint` — ESLint
- `pnpm format:check` / `pnpm format` — check or apply formatting
- `pnpm typecheck` — strict TypeScript check
- `pnpm test` / `pnpm test:watch` — Vitest suite
- `pnpm db:generate` — generate Prisma Client
- `pnpm db:migrate` — create/apply development migrations
- `pnpm db:deploy` — apply checked-in migrations without creating new ones
- `pnpm db:seed` — idempotently load synthetic Milestone 5 portfolio, calendar, and dashboard records
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

Transactions, Bills, Spending, and Settings remain placeholders. There is no live sync, importing, recurring-pattern detection, automatic event generation, performance analysis, or production integration.

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

The seed includes clearly fake examples for every event type and confidence level, predicted and confirmed dates, a confirmed due date with a separate posting prediction, fixed and estimated amounts, paid/skipped/inactive/manual/needs-confirmation states, a month boundary, multiple events on one date, and both high- and low-confidence matching scenarios. Run `pnpm db:seed` more than once safely; no recurring detection or future-occurrence generation is performed.

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

Fidelity templates contain editable labels and account metadata only. They never collect credentials, sign in, or automatically sync. Plaid, automatic Fidelity/NetBenefits sync, CSV import, investment performance, allocation, trading, and advice are not implemented.

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

All required variables are described in `.env.example`. Startup fails with field-specific validation errors when the PostgreSQL URL, application URL, auth secret, or future token-encryption key is missing or invalid. Only server modules can read these values.

## Current status

Milestone 5 includes authenticated manual account, asset, debt, investment snapshot, Fidelity-template, and source-aware Net Worth workflows with semantic light/dark foundations and PostgreSQL integration coverage. Milestone 4 Calendar, Milestone 3 Overview calculations, Milestone 1 owner-only authentication, and the existing provider-neutral migration history remain intact.

No live Plaid or Fidelity integration, syncing, CSV parsing, import UI, recurring-pattern detection, automatic event generation, bill payment, investment performance analysis, theme selector, multi-user feature, or production deployment exists yet. See `docs/Plan Docs/build-plan.md` for the future sequence.
