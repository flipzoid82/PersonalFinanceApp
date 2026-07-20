# Personal Finance Dashboard

A private, single-owner personal finance dashboard. Milestone 2 provides a normalized, provider-neutral PostgreSQL data model and synthetic development fixtures while intentionally leaving the dashboard pages as placeholders.

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
   `$env:OWNER_PASSWORD="a-unique-password-with-12-or-more-characters"; $env:OWNER_NAME="Your Name"; pnpm owner:create -- you@example.com; Remove-Item Env:OWNER_PASSWORD`
8. Optionally load clearly fake development records: `pnpm db:seed`
9. Start the app: `pnpm dev`
10. Open `http://localhost:3000` and sign in.

`owner:create` creates or updates the same owner email and refuses to add a different second user. The seed reuses an existing owner and never changes that owner's email, name, or password hash. If no owner exists, it creates a clearly synthetic `example.test` owner with login disabled; run `owner:create` afterward to configure usable credentials.

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
- `pnpm db:seed` — idempotently load synthetic Milestone 2 records
- `pnpm db:studio` — inspect the development database

To run the destructive model tests locally, create a separate database whose name contains `test`, migrate it, and provide it only through `TEST_DATABASE_URL`. The tests refuse to run against a URL whose database name does not contain `test`.

```powershell
$env:DATABASE_URL="postgresql://finance:finance_dev_only@localhost:5432/personal_finance_test?schema=public"
$env:TEST_DATABASE_URL=$env:DATABASE_URL
pnpm db:deploy
pnpm test
```

For a clean local reset, first confirm that `DATABASE_URL` points to the disposable development database, then run `pnpm exec prisma migrate reset`. This deletes all data, replays every migration, and runs the synthetic seed. Never run it against a database containing data you need to keep.

## Milestone 2 data model

The schema normalizes data from Plaid, CSV imports, manual entry, Fidelity files, and future providers into shared internal records:

- Sources, institution connections, and checking, savings, debt, brokerage, retirement, 401(k), manual, and other accounts
- Original transactions plus separate local overrides
- Recurring streams, projected/confirmed calendar occurrences, and separate calendar overrides
- Imported, synced, and manual investment holdings, balances, and transactions
- Manual assets and debts, historical account balances, and import-job audit records

All financial root records carry `userId`; balance snapshots are also directly owner-scoped so a full owner purge can coexist with account-delete protection. Secondary foreign keys prevent an in-use data source or account from being deleted. Provider-connection deletion only nulls the optional account connection link, and source overrides cascade with the source record. See [the Milestone 2 architecture note](docs/architecture-milestone-2.md) for the complete relationship policy.

Money uses PostgreSQL `DECIMAL(19,4)` through Prisma `Decimal`, never floating point. It supports 15 whole-number digits and four fractional digits. Security quantities use `DECIMAL(28,10)`. Currency fields contain three-character ISO-4217 codes and default to `USD`. Debt balances and manual debt values are stored as positive amounts owed; the account type or `isDebt` flag supplies the financial meaning. No totals or sign transformations are calculated in Milestone 2.

## Environment

All required variables are described in `.env.example`. Startup fails with field-specific validation errors when the PostgreSQL URL, application URL, auth secret, or future token-encryption key is missing or invalid. Only server modules can read these values.

## Current status

Milestone 2 includes the complete core Prisma model, stable domain enums, indexed ownership and lookup paths, contextual provider-ID uniqueness, exact money storage, migration history, safe synthetic seed data, PostgreSQL model tests, and CI database coverage. Milestone 1 owner-only authentication, protected routes, responsive navigation, placeholder pages, environment validation, and UI smoke tests remain intact.

No live Plaid or Fidelity integration, syncing, CSV parsing, import UI, manual-entry UI, business calculation, categorization, recurring detection, event generation, payment matching, investment analysis, dashboard data wiring, multi-user feature, or production deployment exists yet. See `docs/Plan Docs/build-plan.md` for the future sequence.
