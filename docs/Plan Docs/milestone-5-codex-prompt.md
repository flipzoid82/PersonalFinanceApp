# Milestone 5 Codex Prompt

## Objective

Build Milestone 5: Manual Assets and Investments.

Implement manual accounts, assets, debts, investment accounts, balance snapshots, known Fidelity account setup, source freshness, net-worth integration, and theme-aware semantic colors.

Do not begin Milestone 6.

## Read First

1. Confirm `main` matches `origin/main`.
2. Confirm a clean working tree.
3. Read every file in `docs/Plan Docs/`.
4. Inspect Milestones 3 and 4, Prisma schema/migrations/seed/tests, authentication, shared UI, README, CI, and Git history.
5. Stop and report any planning conflict before implementation.

## Scope

Implement:

- manual financial accounts
- manual assets
- manual debts
- manual investment accounts
- manual balance snapshots
- known Fidelity account templates
- source and freshness display
- inclusion of manual assets, debts, and investments in net worth
- create, update, deactivate, and safe-delete flows
- loading, empty, stale, partial, validation, and error states
- responsive and accessible layouts
- reusable theme-aware semantic color tokens and variants

Do not implement Plaid, automatic Fidelity sync, CSV import, recurring detection, full transaction management, investment performance, trading, production deployment, or Milestone 6.

## Preserve

Do not break owner-only authentication, Sign out, protected routes, Milestone 3 Overview calculations, Milestone 4 Calendar, existing migrations, seed idempotency, provider-neutral architecture, CI, or existing tests.

## Semantic Color System and Theme Foundations

Required meanings:

- Positive / income / assets / paid: green
- Negative / spending / debt / overdue: red
- Warning / predicted / stale / medium confidence / needs attention: amber
- Informational / confirmed / synced: blue
- Investments: purple
- Inactive / skipped / unavailable / muted: gray

Requirements:

- Centralize styles in reusable theme tokens, utilities, variants, or shared components.
- Never rely on color alone; pair color with text, a sign, an icon, a label, or another non-color cue.
- Maintain accessible contrast in light and dark themes.
- Ensure all new Milestone 5 components render correctly in light and dark themes.
- Apply styling consistently to values, badges, source labels, account rows, alerts, forms, tables, and summaries.
- Do not add the user-facing Light/Dark/System theme control in Milestone 5; that remains scheduled for Milestone 10.
- Make only narrow consistency updates to Overview or Calendar.
- Add regression tests for semantic variants, non-color labels, and light/dark behavior where practical.

## Functional Requirements

Support manual accounts for checking, savings, brokerage, retirement, 401(k), mortgage, loan, credit card, other asset, and other debt.

Support manual assets and debts including primary residence, real estate, vehicle, private asset, mortgage, auto loan, student loan, personal loan, and other debt.

Support investment accounts including taxable brokerage, traditional IRA, Roth IRA, 401(k), 403(b), HSA investment account, pension/retirement, and other investment account.

Allow exact-decimal balance snapshots with currency, as-of timestamp, chronological history, freshness, duplicate protection where practical, and owner scoping.

Provide safe templates for:

- Fidelity Individual TOD
- UnitedHealth Contribution
- UnitedHealth Group 401(k) Savings Plan

Templates must prefill metadata only, use no credentials, perform no login or automatic sync, remain editable, and preserve provider-neutral internal models.

## Net Worth

Include manual accounts, assets, debts, and investments while preserving source precedence, preventing double-counting, using the latest authoritative value, applying Decimal-safe arithmetic, and keeping every query owner-scoped.

## Pages

Implement practical Milestone 5 versions of:

- Accounts
- Investments
- Net Worth

Show balances, source, freshness, active state, asset/debt classification, holdings where available, and clear partial-data states.

## Actions

Implement secure server actions or equivalent for create/update/deactivate manual accounts, assets, debts, investment accounts, snapshots, notes, and safe deletion where referentially valid.

Require server validation, owner authorization, revalidation, exact money parsing, safe dates, accessible feedback, and no raw database errors.

## Schema

First determine whether existing models are sufficient, especially Account, ManualAsset, InvestmentHolding, InvestmentBalanceSnapshot, BalanceSnapshot, and DataSource.

Prefer no schema change. If a migration is genuinely required, explain why, create a forward-only migration, preserve history, and test both upgrade and full replay.

## Seed

Add only synthetic, owner-safe, idempotent examples needed for Milestone 5, including a home, mortgage, vehicle, auto loan, the three Fidelity templates, a manual brokerage, multiple snapshots, fresh/stale records, and active/inactive records.

## Tests

At minimum test owner scoping, mutations, create/update/deactivate flows, snapshots, latest-value precedence, double-count prevention, net-worth inclusion, debt subtraction, source labels, freshness, Fidelity templates, exact decimals, validation, inactive records, partial and empty states, semantic variants, non-color labels, light/dark behavior, responsive structure, seed idempotency, Overview, Calendar, authentication/logout, and PostgreSQL CI execution.

## Documentation

Update README and create `docs/architecture-milestone-5.md` covering ownership, model usage, calculation precedence, semantic tokens, theme behavior, freshness, mutations, validation, accessibility, tests, schema decision, and the absence of automatic Fidelity/Plaid sync.

Do not modify planning documents.

## Verification

Run:

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

Also run the full PostgreSQL suite with `TEST_DATABASE_URL`, run seed twice, physically test all create/update/deactivate flows and Fidelity templates, verify net worth and theme behavior, test mobile, verify Sign out/protected routes, check the browser console, run `git diff --check`, and restore generated `next-env.d.ts`.

## Git Hygiene

Work on `feature/milestone-5`.

Do not commit or push after implementation unless explicitly asked.

## Final Report

Report implementation summary, pages and flows, semantic/theme system, calculation precedence, Fidelity templates, files changed, schema decision, seed changes, test totals, states, accessibility/responsiveness, commands/results, physical testing, assumptions, unresolved issues, and confirmation that Milestone 6 was not started.
