# Personal Finance Dashboard

A private, single-owner personal finance dashboard. Milestone 1 establishes the authenticated application shell and engineering foundation; it intentionally contains no real financial functionality or data.

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
8. Start the app: `pnpm dev`
9. Open `http://localhost:3000` and sign in.

`owner:create` creates or updates the same owner email and refuses to add a different second user. Credentials are never hard-coded or stored in source control.

## Commands

- `pnpm dev` — local development server
- `pnpm build` / `pnpm start` — production build and local production server
- `pnpm lint` — ESLint
- `pnpm format:check` / `pnpm format` — check or apply formatting
- `pnpm typecheck` — strict TypeScript check
- `pnpm test` / `pnpm test:watch` — Vitest suite
- `pnpm db:migrate` — create/apply development migrations
- `pnpm db:deploy` — apply checked-in migrations
- `pnpm db:studio` — inspect the development database

## Environment

All required variables are described in `.env.example`. Startup fails with field-specific validation errors when the PostgreSQL URL, application URL, auth secret, or future token-encryption key is missing or invalid. Only server modules can read these values.

## Current status

Milestone 1 includes Next.js, TypeScript, Tailwind CSS, reusable UI primitives, PostgreSQL/Prisma configuration, owner-only authentication, responsive navigation, all placeholder routes, Overview skeletons, Vitest, ESLint, Prettier, error handling, and GitHub Actions CI.

Not implemented yet: financial data models, Plaid or Fidelity integrations, account/transaction syncing, imports, manual finance tracking, calculations, categorization, recurring detection, bill prediction, calendar generation, debt payoff features, multi-user features, or deployment. See `docs/Plan Docs/build-plan.md` for the future sequence.
