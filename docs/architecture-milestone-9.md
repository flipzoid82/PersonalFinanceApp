# Milestone 9 Architecture: Bills and Spending

## Scope

Milestone 9 replaces the Bills and Spending placeholders with authenticated, owner-scoped reporting surfaces. It adds no database tables or migrations. Provider-owned transaction and Plaid data remain immutable; corrections continue to live in the existing override records.

### Requirement provenance

- Source-defined requirements provide the financial classifications, exact monetary arithmetic, owner/security boundaries, provider-data immutability, override precedence, and Calendar semantics.
- Established preserved behavior keeps finalized historical transactions auditable after account disconnection or replacement, while current balances and account totals exclude inactive/disconnected accounts.
- Owner-approved Milestone 9 implementation decisions set the Bills ranges and 30-day default, the bounded 12-month trend, and the exact unusual-spending heuristic. These details supplement the canonical sources and are not attributed to the original Product Requirements.

## Bills

The Bills query reads the existing Calendar data graph, excludes occurrences belonging only to inactive or disconnected historical accounts, and applies `getEffectiveCalendarEvent`. The historical rows remain stored and auditable through established history/Calendar paths, but they cannot inflate the current Bills list or total. Effective derivation preserves the established precedence: event override, stream override, user-confirmed/source event value, then recurring-stream fallback. `not_a_bill`, inactive state, status, due-date, amount, and frequency corrections therefore behave identically on Bills and Calendar.

The page uses the existing 14/30/60/90-day convention and defaults to 30 days. Overview remains unchanged at 14 days. Confirmed due dates are primary; predicted posting dates are supplemental estimates. Predicted-only events never become overdue. Paid and skipped occurrences remain visible but do not contribute to the upcoming-outflow total. Expected income is presented separately and never contributes to bill totals. Inactive and dismissed records remain available as historical context. Corrections link back to Calendar rather than introducing a second correction workflow.

## Spending eligibility

Spending reads owner-scoped posted, nonremoved transactions from both current accounts and retained inactive/disconnected historical accounts. Account disconnection or replacement must not rewrite historical reporting. It applies `TransactionOverride` precedence through `effectiveTransactionValues` and removes report-excluded or unclassified activity before calculation.

Only effective `EXPENSE` values increase spending. Effective `REFUND` values reduce spending and their effective category. `INCOME` contributes only to income. Transfers, credit-card payments, debt/internal movement, investment activity, ignored activity, pending activity, removed activity, and unclassified activity do not contribute. Amount direction is based on the effective financial role; stored provider signs are not treated as direction. All arithmetic uses `Prisma.Decimal`.

The current and previous periods are UTC calendar months. Month-over-month percentage is omitted when prior spending is zero. Category labels use the existing consumer-facing provider-category formatter while links preserve the exact source category filter. Merchant identity uses the existing effective merchant with no additional fuzzy normalization.

## Historical trend and unusual spending

The historical table uses a bounded twelve-calendar-month window ending in the current month. It is historical reporting only and does not forecast.

Unusual-purchase indicators evaluate current-month effective expenses against earlier qualifying expenses at the exact same effective merchant. At least four prior observations are required. The baseline uses exact absolute Decimal values, their median, and median absolute deviation (MAD). A purchase is shown only when it is at least both `median + 3 × MAD` and `1.5 × median`. The current transaction is excluded from its own baseline. The UI describes this only as higher than typical and explicitly avoids fraud or security claims. This algorithm and the 12-calendar-month trend window are owner-approved Milestone 9 decisions, not requirements attributed to the original Product Requirements.

## Consistency and safety

Overview and Spending finalized reporting both include otherwise qualifying owner-scoped historical posted transactions after account disconnection or replacement. Provider-removed rows remain excluded. Current account/balance queries still use the shared current-account predicate, and forward-looking Bills excludes obsolete historical-account projections. Regression coverage proves these distinct boundaries and compares Overview and Spending monthly results using the same PostgreSQL records. All server routes call `requireUser`; owner IDs are included in every top-level query and relationship eligibility check.

The UI uses semantic tokens plus signs, labels, and status text so meaning does not depend on color. Category and merchant charts include accessible table equivalents. Cards and values use wrapping, truncation only where a full table value remains available, minimum-width containment, and local horizontal scrolling for the twelve-month table at narrow viewports.

Plaid synchronization remains unchanged: provider fields continue through the existing reconciliation path, while merchant, category, role, and report-exclusion corrections remain separate `TransactionOverride` data. Spending only reads those effective values. Bills likewise reads existing Calendar overrides and never writes provider or imported source fields.

## Schema and migration decision

The current schema already expresses every Milestone 9 requirement. Bills uses recurring streams, projected occurrences, matches, and Calendar overrides; Spending uses transactions and transaction overrides. No schema edit, migration, repair, reset, or seed-only workaround is needed.

## Test strategy

Pure Decimal calculation tests use controlled fixtures to cover income, expenses, refunds, excluded roles, month comparisons, category and merchant grouping, largest purchases, the four-observation minimum, exact median/MAD, and both unusual-spending thresholds. Bills view-model tests cover canonical ranges, income separation, owner scoping, inactive/not-a-bill behavior, predicted-only status, and obsolete historical-account projections. Component tests cover semantic tokens, accessible chart tables, URL drill-downs, range controls, empty states, and long text. PostgreSQL integration coverage validates historical transaction retention, current-account/current-Bills exclusion, Calendar history preservation, owner scoping, override precedence, removed/pending/report-excluded behavior, and exact Overview parity. Existing seed tests run the canonical seed repeatedly and preserve the established Overview totals without a permanent unusual-spending QA fixture.

## Known limitations

Milestone 9 is reporting only. It does not add bill payment, reminders, budgets, forecasting, fraud detection, fuzzy merchant normalization, or a new correction UI. Bills corrections remain in Calendar, and unusual-spending comparisons require exact effective merchant identity. The application continues to use UTC calendar periods until a later owner-time-zone decision. The twelve-month trend honestly shows months with no qualifying finalized activity as zero; it does not infer missing history or forecast future activity.

## Closeout presentation hardening

Manual dark-theme acceptance exposed duplicated generic notice styling outside
the original Bills and Spending product scope. Closeout therefore introduced a
small app-wide `Notice` presentation primitive backed by the existing semantic
tokens and migrated only generic page-level information, warning, success, and
error feedback. Bills and Spending calculations, Calendar matching and
correction semantics, session behavior, and provider data remain unchanged.
Specialized dialogs, suggested matches, validation, empty states, badges, and
broader visual normalization remain separate and are not part of this
consolidation.
