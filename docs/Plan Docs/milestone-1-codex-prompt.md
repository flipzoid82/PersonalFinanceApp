# Milestone 1 Codex Prompt

## Objective

Build Milestone 1 of the personal finance dashboard project.

Do not proceed beyond Milestone 1.

## Read First

Before making any changes, read every planning document under:

```text
docs/Plan Docs/
```

Treat those files as the source of truth for product scope, financial definitions, architecture, calendar behavior, Plaid constraints, Fidelity constraints, and the build sequence.

If this prompt conflicts with a planning document, stop and report the conflict before implementing.

## Milestone 1 Scope

Create the project foundation only.

The milestone should include:

- Next.js with TypeScript
- App Router
- Tailwind CSS
- A reusable UI component library
- PostgreSQL configuration
- Prisma setup
- Environment-variable validation
- Authentication suitable for a private single-user application
- Base dashboard shell
- Responsive navigation
- Test framework
- Linting and formatting
- Continuous-integration checks
- A clear local-development setup

## Application Shell

Create the main authenticated application layout with navigation placeholders for:

- Overview
- Accounts
- Transactions
- Bills
- Calendar
- Spending
- Investments
- Net Worth
- Settings

Create placeholder pages for each route.

The placeholder pages should contain only:

- Page title
- One-sentence description
- A simple empty-state or “coming in a later milestone” message

Do not implement real financial functionality yet.

## Overview Placeholder

Create a responsive Overview page shell that reserves space for:

### Primary metrics

- Net Worth
- Cash
- Credit Card Debt
- Investments

### Monthly metrics

- Income This Month
- Spending This Month
- Net Cash Flow
- Upcoming Bills

### Main panels

- Net Worth Trend
- Account Balances
- Recent Transactions
- Spending by Category
- Upcoming Activity
- Data Freshness and Connection Status

Use static placeholder or skeleton content only.

Do not add financial formulas or calculation logic.

## Authentication

This is a single-user, private personal-finance application.

Use a minimal and secure authentication approach appropriate for one owner.

Requirements:

- Protect all application routes.
- Keep public routes limited to authentication and required framework routes.
- Do not add household sharing, invitations, teams, organizations, or roles.
- Document how the initial owner account is created.
- Do not hard-code credentials.

If the repository already specifies an authentication provider, follow the existing choice unless it conflicts with the planning docs.

## Database and Prisma

Configure PostgreSQL and Prisma, but implement only the minimum schema necessary for Milestone 1.

At minimum, include the authenticated application user model and any models required by the selected authentication solution.

Do not implement the full financial data model yet unless a framework dependency strictly requires part of it.

Create:

- Prisma configuration
- Initial migration
- Database client helper
- Development setup instructions
- Safe handling for repeated development reloads

## Environment Variables

Add validated environment variables.

Include an example environment file that contains names and descriptions but no real secrets.

At minimum, validate variables required for:

- Database connection
- Authentication
- Application URL
- Encryption key placeholder for future provider tokens, if appropriate

Fail clearly at startup when required environment variables are missing or invalid.

## UI and Responsive Behavior

The application must be usable on desktop and mobile from the start.

Requirements:

- Desktop sidebar or equivalent navigation
- Mobile navigation appropriate for small screens
- Accessible labels and focus states
- Keyboard-accessible navigation
- No reliance on color alone
- Reusable layout primitives
- Consistent spacing and typography

Do not spend time on final visual polish. Establish a clean, maintainable design foundation.

## Engineering Requirements

Use strict TypeScript.

Add:

- ESLint
- Prettier or an equivalent formatter
- Type-check command
- Unit or component test framework
- At least one meaningful smoke test
- CI workflow that runs install, lint, type-check, test, and build
- Clear npm scripts
- Error boundaries or basic framework-level error handling where appropriate

Prefer simple, maintainable code over abstractions that are not yet needed.

## Security Requirements

Do not expose server secrets to browser code.

Do not implement Plaid access-token handling yet.

Do not implement Fidelity authentication or automatic Fidelity syncing.

Do not log sensitive environment values.

Do not add public APIs unless required for authentication or health checks.

Do not use real personal financial data in seed files, tests, screenshots, fixtures, or source control.

## Explicitly Out of Scope

Do not implement any of the following in Milestone 1:

- Plaid integration
- Plaid Link
- Real account syncing
- Transaction syncing
- Fidelity Access
- Automatic Fidelity or NetBenefits syncing
- CSV import
- Manual investment tracking
- Manual assets or debts
- Financial calculations
- Net-worth calculations
- Recurring transaction detection
- Bill-date prediction
- Calendar event generation
- Spending categorization
- Debt payoff logic
- Production deployment
- Multi-user functionality

## Repository Hygiene

Before changing files:

1. Inspect the existing repository.
2. Preserve useful existing configuration.
3. Avoid replacing working files unnecessarily.
4. Do not delete user-authored planning documents.
5. Keep all planning documents under `doc/Plan Docs/`.
6. Add concise comments only where they improve understanding.

## Documentation

Update or create the root README with:

- Project summary
- Prerequisites
- Installation steps
- Environment setup
- Database setup
- Migration commands
- Local development command
- Test, lint, type-check, and build commands
- Authentication setup
- Current milestone status
- Explicit list of features not implemented yet

Add a short architecture note for Milestone 1 if the repository does not already have one.

## Completion Criteria

Milestone 1 is complete only when:

- The app installs successfully.
- The development server starts.
- Authentication protects application routes.
- All navigation routes render.
- The Overview shell is responsive.
- PostgreSQL and Prisma are configured.
- Environment variables are validated.
- Linting passes.
- Type-checking passes.
- Tests pass.
- The production build passes.
- CI is configured to run those checks.
- No out-of-scope financial functionality was added.

## Final Response

When finished, stop and provide:

1. A concise summary of what was implemented.
2. A list of important files created or changed.
3. Commands that were run and their results.
4. Any assumptions made.
5. Any unresolved issues or decisions.
6. Exact local setup steps for the user.
7. Confirmation that no work beyond Milestone 1 was performed.

Do not begin Milestone 2.
