# Codex Build Brief

## Project

Build a single-user personal finance dashboard web app.

## Non-Negotiable Product Rules

- Single-user only for MVP.
- Read-only with respect to real financial institutions.
- Never mutate original provider data.
- Store user corrections as local overrides.
- Credit-card payments are transfers, not spending.
- Transfers are not income or spending.
- Pending transactions are shown but excluded from finalized totals.
- Investments are included in net worth.
- Fidelity / NetBenefits should not be assumed to work through Plaid.
- Fidelity support in the MVP must work through manual balance tracking and CSV or statement import.
- Inferred bill dates must be labeled as predictions.
- Predicted posting dates and confirmed due dates are separate concepts.
- Predicted-only events must not be marked overdue by default.
- Provider-specific integrations must map into normalized internal tables.

## First Implementation Target

Build Milestone 1 only unless explicitly instructed otherwise.

Milestone 1 includes:

- Next.js with TypeScript
- Tailwind CSS
- UI component library
- PostgreSQL
- Prisma
- Environment validation
- Authentication
- Base dashboard shell
- Test framework
- CI checks

Do not implement Plaid yet.

Do not implement Fidelity automatic syncing.

Do not implement recurring detection yet.

Do not create multi-user sharing or household access.

## Important Docs

Read these documents before implementation:

- docs/product-requirements.md
- docs/financial-definitions.md
- docs/data-model.md
- docs/plaid-integration.md
- docs/overview-dashboard-spec.md
- docs/calendar-spec.md
- docs/build-plan.md
