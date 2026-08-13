# Milestone 11.5 — UX/UI Audit, Branding, and Product Polish

## Status

**Approved roadmap milestone.**

Canonical placement:

```text
Milestone 11 — CSV Import
Milestone 11.5 — UX/UI Audit, Branding, and Product Polish
Milestone 12 — Production Readiness
```

The purpose of placing this work after Milestone 11 is to let the major MVP
feature set stabilize before performing a cross-application usability,
presentation, consistency, and branding pass, while still completing that work
before production-readiness and real-institution rollout.

This milestone is now part of the canonical Build Plan.

Brand implementation is included in this milestone only when the owner has
approved a product name and sufficient brand direction before Milestone 11.5
implementation begins.

If branding decisions are incomplete when this milestone starts, the UX/UI
audit and product-polish work must proceed without inventing a brand on the
owner's behalf. Unresolved branding work should be documented as deferred
rather than improvised.

---

## Objective

Audit the entire application from the perspective of a normal personal-finance
user and improve clarity, discoverability, consistency, accessibility, visual
hierarchy, product language, interaction quality, responsive usability, brand
coherence, and overall ease of use without changing established financial
calculations, provider behavior, security boundaries, data ownership, or core
product scope.

This is a **product-usability, presentation, and approved-brand implementation
milestone**, not a new financial-feature milestone.

The milestone should answer:

> Can a person who did not build this application understand what each page is
> for, what the information means, what actions are available, what will happen
> when they use them, and whether the application feels like one coherent
> product?

If an approved brand exists, it should additionally answer:

> Does the finished application consistently express the approved product name,
> visual identity, tone, and personality without weakening financial clarity,
> accessibility, or semantic meaning?

---

## Product and Financial Boundaries

This milestone must preserve all established product and financial behavior.

Unless a canonical source explicitly changes a rule, preserve:

- single-owner scope
- read-only behavior with respect to real financial institutions
- provider/imported source-data immutability
- local overrides as the correction mechanism
- exact monetary arithmetic
- posted-only finalized income/spending reporting
- pending activity shown separately from finalized reporting
- transfers excluded from income and spending
- credit-card payments excluded from spending
- investment activity excluded from ordinary spending/income where already defined
- existing refund treatment
- prediction versus confirmed-date separation
- predicted-only items never becoming overdue by default
- existing owner-scoping rules
- session-security behavior
- provider reconciliation behavior
- Plaid token/security boundaries
- historical auditability
- current data-source and freshness semantics
- existing accessibility requirement that meaning never depend on color alone

No UX, copy, visual, navigation, or branding improvement may silently redefine a
financial concept.

---

## Existing Foundations to Preserve

The application already has important UX, accessibility, security, and theme
foundations that this milestone should refine rather than replace:

- semantic colors are secondary cues only
- financial/status meaning also uses text, signs, icons, labels, or other cues
- theme-aware semantic tokens already exist
- light/dark foundations already exist
- user-facing Light/Dark/System controls are planned for Milestone 10
- responsive layouts and keyboard access are already tested in multiple areas
- loading, empty, stale, partial, and error states exist
- provider values remain separate from local corrections
- transaction category presentation already supports deterministic consumer-friendly formatting
- small reusable interaction patterns are preferred over premature frameworks
- final formal contrast/theme auditing remains part of Milestone 12

This milestone should refine and unify these foundations rather than replace
them with a large design-system rewrite.

---

## Source Hierarchy

Use the normal project workflow SOP.

Mandatory sources should include:

1. this Milestone 11.5 plan/prompt
2. canonical Build Plan
3. Product Requirements
4. Financial Definitions
5. Data Model
6. Plaid Integration
7. Overview Dashboard Specification
8. Calendar Specification
9. Codex Build Brief
10. merged architecture documents through Milestone 11
11. current application code and tests
12. current navigation structure
13. current semantic/theme/accessibility foundations
14. approved branding source, if one exists

Historical milestone Codex prompts should not be read by default.

Use them only if a current source or architecture document leaves a specific
ambiguity unresolved.

If sources genuinely conflict, stop and report the conflict rather than
silently inventing a compromise.

---

## Approved Branding Source

If branding has been finalized before Milestone 11.5, there should be a
canonical branding document such as:

```text
docs/Plan Docs/brand-identity.md
```

That document may define approved items such as:

- final product name
- capitalization and spelling
- logo
- wordmark
- favicon/app icon direction
- tagline, if any
- brand personality
- writing tone
- typography direction
- primary/accent visual direction
- approved decorative palette
- iconographic direction
- naming conventions
- browser/application metadata
- light/dark brand treatment
- prohibited or deprecated names
- semantic-color interaction rules

The branding document is an owner-approved input.

Codex must not invent a final product name, logo direction, tagline, or brand
identity when those decisions have not been approved.

---

# Phase 1 — Full Application UX Audit

Before broad implementation changes, inspect every owner-facing route.

Expected routes include:

```text
/login
/overview
/accounts
/transactions
/bills
/calendar
/spending
/investments
/net-worth
/settings
```

Also inspect all material secondary surfaces, including:

- transaction detail
- account detail
- account create/edit workflows
- manual asset/debt workflows
- recurring/bill detail
- recurring/bill correction flows
- Plaid connection UI
- Plaid reconnect/repair UI
- Plaid sync state
- Plaid disconnect confirmation
- CSV import workflow
- import mapping
- rejected-row review
- import completion summary
- session-expiration warning
- destructive confirmation dialogs
- loading states
- empty states
- no-results states
- partial states
- stale states
- error states
- route-level not-found states where relevant

For every surface, document findings in a structured UX audit before beginning
large cross-app refactoring.

## Audit Dimensions

Review each screen for:

- purpose clarity
- terminology
- information hierarchy
- discoverability
- navigation/orientation
- action clarity
- form clarity
- feedback after actions
- empty-state usefulness
- no-results usefulness
- error-message usefulness
- stale/partial-state usefulness
- technical/provider jargon exposure
- visual density
- table/list readability
- typography/readability
- spacing and grouping
- long-text resilience
- mobile usability
- tablet usability
- desktop usability
- keyboard usability
- focus behavior
- accessibility
- theme readability
- semantic consistency
- consistency with other screens
- branding consistency, when applicable

## Severity Classification

Classify findings as:

```text
P0 — prevents task completion, creates unsafe behavior, or creates a serious
     financial misunderstanding

P1 — substantial confusion, accessibility barrier, broken journey, or major
     usability problem

P2 — noticeable friction, inconsistency, unnecessary complexity, or recurring
     comprehension issue

P3 — cosmetic, refinement, or lower-priority polish improvement
```

Do not begin a broad redesign merely because aesthetic preferences differ.

Prioritize comprehension, safe task completion, consistency, and accessibility.

---

# Phase 2 — Consumer-Friendly Language

Review visible application copy as if the user has no knowledge of:

- Prisma
- database terminology
- provider normalization
- provider enums
- Plaid internals
- effective-value precedence
- UTC implementation details
- internal status codes
- schema names
- milestone terminology
- implementation architecture

## Primary Rule

> User-facing language explains what the user can do and what the information
> means. Technical implementation language belongs in documentation or
> secondary source/details contexts.

Review and improve:

- page titles
- page taglines
- page descriptions
- navigation labels
- card titles
- chart titles
- table headers
- form labels
- helper text
- search placeholders
- filter labels
- buttons
- menu items
- badges
- status text
- confirmation messages
- validation messages
- empty states
- no-results states
- stale/partial states
- error states
- Settings descriptions
- account-source descriptions
- freshness descriptions
- import messages
- connection-health messages

## Examples

Avoid:

```text
Review normalized retained activity and apply owner-local corrections.
```

Prefer:

```text
Review, search, and organize your transaction history.
```

Avoid:

```text
Effective category
```

Prefer:

```text
Category
```

unless the effective/source distinction is necessary in that context.

Avoid presenting:

```text
TRANSPORTATION_TAXIS_AND_RIDE_SHARES
```

as a primary label.

Prefer:

```text
Taxis & rideshare
```

while preserving the exact provider value as source data.

Avoid:

```text
Excluded from reports
```

when a more concrete explanation is appropriate.

Prefer:

```text
Don't include in spending & income
```

with helper text explaining that the transaction remains in history.

---

# Phase 3 — Terminology System

Create and document a small consumer-facing terminology glossary so the same
concept is not named inconsistently across screens.

Review terms including:

- transaction
- merchant
- description
- category
- transaction type
- financial role
- spending
- expense
- income
- transfer
- refund
- credit-card payment
- investment activity
- debt payment
- bill
- recurring payment
- subscription
- predicted
- confirmed
- due date
- posting date
- expected amount
- available cash
- current balance
- account balance
- source
- synced
- imported
- manual
- stale
- partial
- unavailable
- excluded
- report exclusion
- confidence
- net cash flow
- credit utilization
- current value
- net worth

For each important term, define:

```text
Internal/domain term:
Preferred user-facing term:
Short explanation:
Where technical wording may still appear:
```

Do not rename database fields merely to make UI terminology friendlier.

---

# Phase 4 — Progressive Disclosure and Help

Add contextual help only where it solves a real comprehension problem.

Possible patterns include:

- tooltip/help icon
- concise helper text
- expandable "Learn more"
- secondary source/details card
- explanation beneath a metric
- first-use orientation where genuinely justified

Potential concepts requiring help include:

- Transaction type
- Category source
- Exclude from spending & income
- Predicted versus Confirmed
- Prediction confidence
- Available balance versus Current balance
- Data freshness
- Historical/disconnected account
- Manual versus Synced versus Imported
- Net cash flow
- Credit utilization
- Expected amount
- Estimated bill amount
- Investment-value source

Help controls must:

- be keyboard accessible
- work on touch devices
- have useful accessible names
- not contain essential information unavailable elsewhere
- remain concise
- use consumer language
- avoid unnecessary implementation details

Do not add a tooltip to every label.

---

# Phase 5 — Navigation and Orientation

Review whether a normal user can understand:

- where they are
- what each navigation destination contains
- how related pages connect
- how to return from detail pages
- where to correct transaction information
- where to manage financial data sources
- where to inspect raw activity versus reports
- how Bills and Calendar differ
- how Investments and Net Worth differ
- how Spending relates to Transactions
- how Accounts relates to source health

Review navigation labels, current-page indication, route naming, page titles,
breadcrumbs where useful, back-navigation, detail-page return paths, Overview
links, contextual related links, action placement, and mobile navigation
behavior.

Do not redesign the entire information architecture unless the audit documents a
clear usability problem.

---

# Phase 6 — Tables, Lists, and Data-Heavy Surfaces

Standardize proven interaction patterns across data-heavy screens.

Review tables and lists for:

- clear column names
- useful sorting
- visible sort direction
- active search where appropriate
- debounced search where appropriate
- filters
- filter-state visibility
- reset/clear behavior
- pagination
- deterministic ordering
- row/detail navigation
- readable dates
- readable currencies
- readable categories
- readable account/source labels
- long-text resilience
- mobile alternatives
- keyboard operation
- empty states
- no-results states
- accessible captions/headers

Potential surfaces include Transactions, Accounts, Bills, Spending category and
merchant views, Investment holdings, Net-worth history, CSV import review, and
CSV rejected rows.

Reuse small patterns already proven by prior milestones. Do not build a large
generic data-grid framework unless multiple real use cases demonstrate that it
is needed. Not every table needs every feature.

---

# Phase 7 — Forms and Editing Workflows

Audit every owner-facing form for clear field names, consumer-friendly
descriptions, sensible grouping, required-versus-optional clarity, useful
defaults, input formatting, validation timing and placement, exact financial
effects, save feedback, destructive-action confirmation, cancel/back behavior,
unsaved-change risk, mobile input behavior, keyboard navigation, and focus after
errors/completion.

Financially meaningful edits should clearly explain their effect.

Example:

Instead of:

```text
Exclude from reports
```

prefer:

```text
Don't include in spending & income
```

with helper text such as:

```text
The transaction stays in your history but won't affect spending or income totals.
```

The UI must not imply that changing a local correction changes the original
financial-provider record.

---

# Phase 8 — Empty, Loading, No-Results, Error, Partial, and Stale States

Every important page should remain understandable when data is missing,
incomplete, delayed, filtered away, or unavailable.

## Empty

Explain why there may be no data, whether the state is expected, and what the
user can do next. Avoid displaying unknown financial values as zero.

## No Search or Filter Results

Explain that data may exist but the current filters found no matches. Provide an
obvious way to clear or reset filters.

## Loading

Do not show fake financial values. Use appropriate skeletons or neutral loading
states.

## Error

Use safe, actionable consumer language. Never expose stack traces, raw provider
errors, provider tokens, internal request bodies, database errors, secrets, or
raw API payloads.

## Partial

Explain what information may be incomplete, which source is affected when safe,
and what impact that may have on displayed totals.

## Stale

Explain when data was last successfully updated, which source may need attention,
whether values remain usable, and what action the user can take.

---

# Phase 9 — Visual Hierarchy and Information Density

Audit whether the most important information on each page is immediately clear.

Review heading hierarchy, card density, spacing, whitespace, section grouping,
primary versus secondary metadata, repetitive badges, overuse of borders,
overly verbose helper text, long provider labels, currency prominence, date
prominence, numeric alignment, destructive-action prominence,
primary-action prominence, form density, chart density, and readability at
common zoom levels.

Avoid aesthetic redesign for its own sake. Each visual change should improve
comprehension, hierarchy, task completion, readability, accessibility,
consistency, or brand coherence when applicable.

---

# Phase 10 — Brand Identity and Product Naming

This phase applies only when the owner has approved a brand identity before or
during Milestone 11.5.

If no approved branding source exists, document this phase as deferred and do
not invent a brand.

## Branding Goals

Apply the approved product identity consistently across the completed
application without weakening financial clarity, semantic status meaning,
accessibility, contrast, theme behavior, data density, or task completion.

## Product Name

Replace temporary/internal product naming with the approved final name where
appropriate.

Review:

- login screen
- application shell
- navigation
- header
- page metadata
- browser title
- manifest/app metadata where applicable
- README consumer-facing references where appropriate
- user-facing help text
- empty/error states
- source-independent application messages

Do not rename database tables, internal code identifiers, migration history, or
provider fields solely for branding unless technically necessary and separately
justified.

## Logo and Wordmark

If approved assets/direction exist, implement appropriate logo, wordmark,
compact navigation mark, login treatment, app-shell treatment, responsive
versions, and light/dark variants.

Do not make essential navigation depend on a logo without an accessible text
name.

## App Icon and Browser Identity

Where supported and approved, update favicon, application icons, manifest icons,
browser/application metadata, and page title conventions.

Do not include unapproved placeholder artwork in production-facing metadata.

## Brand Voice and Tone

Align consumer-facing copy with the approved brand voice while preserving
financial precision, clarity, concise warnings, neutral error messages, and safe
security messaging.

Brand personality must not make financial warnings ambiguous or playful when
clarity is more important.

## Typography

Apply approved typography direction only when technically appropriate.

Preserve readability, numeric clarity, currency alignment, accessibility,
performance, fallback fonts, and responsive behavior.

Do not introduce typography that reduces dense financial-data readability.

## Brand Color

Brand/accent colors must coexist with, not replace, the established semantic
financial color system.

Semantic meanings remain authoritative:

- positive / income / assets / paid
- negative / spending / debt / overdue
- warning / predicted / stale / needs attention
- informational / confirmed / synced
- investments
- inactive / skipped / unavailable / muted

A brand color must not redefine those meanings.

## Theme Behavior

Approved branding must work coherently in Light, Dark, and System.

Verify logo contrast, wordmark contrast, accent contrast, focus indicators,
branded surfaces, hover/focus/active states, semantic badges, charts,
navigation, login, and dialogs.

No brand treatment may depend on color alone for meaning.

## Decorative Elements

If the brand includes decorative patterns, illustrations, gradients, or other
visual devices, use them sparingly.

They must not interfere with financial values, tables, charts, forms, alerts,
warnings, mobile layout, keyboard focus, or text contrast.

## Branding Regression Boundary

Brand implementation must not silently change calculations, data queries,
provider mapping, local override precedence, reporting classifications,
authentication, session behavior, synchronization, or import behavior.

Branding is presentation and product identity, not financial logic.

---

# Phase 11 — Responsive Usability

Test at minimum:

```text
375 × 812
```

Also inspect representative narrow mobile, wider mobile, tablet, laptop, and
desktop widths.

Check horizontal overflow, clipped labels, long categories, long account names,
long merchant names, provider/source strings, wide tables, card stacking,
filter layouts, search controls, dialogs, forms, charts, navigation,
tooltips/help controls, sticky/fixed elements, tap targets, branded
header/logo behavior, login branding, and responsive wordmark behavior.

A layout technically fitting on-screen is not sufficient. It should remain
comfortably usable.

---

# Phase 12 — Accessibility Audit

Preserve and deepen existing accessibility standards.

Verify semantic headings, landmarks, labels, accessible names, table
captions/headers, keyboard-only operation, visible focus, logical focus order,
skip/navigation behavior where applicable, safe dialog focus trapping and
restoration, understandable confirmations, restrained live regions, non-color
meaning, meaningful icon alternatives, chart text/table equivalents,
keyboard/touch help, reduced-motion behavior where motion is introduced,
appropriate logo/brand text alternatives, hidden decorative imagery,
consumer-friendly accessible names, readable typography, and usable brand
contrast.

Automated checks do not replace physical keyboard testing.

---

# Phase 13 — Theme and Semantic Consistency

Milestone 10 should already have completed user-facing theme controls and broad
dark-mode support.

This milestone should inspect the finished application for cross-app
consistency rather than reimplement theme architecture.

Verify Light, Dark, System, brand treatment, positive/negative values, warnings,
predicted/confirmed/paid/overdue/stale/inactive states, links, focus indicators,
muted text, tables, forms, charts, tooltips, dialogs, empty states, errors, and
import states.

Leave the final formal production accessibility, contrast, and
theme-persistence audit to Milestone 12.

---

# Phase 14 — User Journey Testing

Test complete user tasks rather than only isolated components.

Representative journeys:

```text
Sign in
→ Overview
→ inspect recent transactions
→ open a transaction
→ correct classification
→ return to Overview
```

```text
Transactions
→ search
→ filter
→ sort
→ open detail
→ understand source
→ understand classification
```

```text
Overview
→ Bills or Calendar
→ distinguish predicted/confirmed
→ understand next expected charge
→ correct/confirm where supported
```

```text
Accounts
→ identify stale/disconnected source
→ understand status
→ reconnect/sync if supported
```

```text
Spending
→ understand current-month total
→ inspect category breakdown
→ compare with previous month
→ inspect merchant totals
→ identify unusual spending
→ reach underlying transactions
```

```text
Investments
→ understand total value
→ understand account/source/freshness
→ inspect holdings/allocation
→ navigate to Net Worth
```

```text
Net Worth
→ understand current total
→ understand assets vs debts
→ inspect trend
→ identify source/freshness limitations
```

```text
CSV import
→ choose source/type
→ map fields
→ validation
→ review
→ rejected rows
→ completion summary
```

```text
Active session
→ warning
→ understand remaining time
→ renew or allow expiration
→ safe sign-in redirect
```

The user should be able to explain what happened without understanding
implementation terminology.

---

# Phase 15 — First-Time-User Comprehension Review

Even though the product is private and single-user, conduct a "new user"
comprehension review.

For each major screen ask:

1. What is this page for?
2. What is the most important information here?
3. What can I do?
4. What do unfamiliar terms mean?
5. What happens if I change something?
6. Where did this financial data come from?
7. Is this data current?
8. How do I recover from an error?
9. Where should I go next?
10. Can I distinguish source information from my local corrections?

If an approved brand exists, also ask:

11. Is the product identity recognizable without overwhelming the financial information?
12. Does the tone feel consistent across screens?
13. Does the application feel like one coherent product?

Do not build a large onboarding tour unless the audit demonstrates that one is
necessary.

---

# Phase 16 — UX and Brand Consistency Tests

Add targeted regression tests for stable UX rules where automation provides
real value.

Examples:

- provider enum codes do not appear as primary category labels
- shared terminology appears consistently on key pages
- sortable tables expose accessible sort state
- critical help controls have accessible names
- empty states provide useful next steps
- filtered no-results states offer reset behavior
- technical provider IDs remain hidden
- raw provider payloads remain hidden
- color is not the sole meaning cue
- source values remain available in appropriate details
- financial edits explain their reporting effect
- mobile layouts do not overflow
- theme variants render semantic states correctly
- product name is consistent after approved branding rollout
- page metadata uses the approved product name
- logo/wordmark retains accessible naming
- branding does not override semantic status classes
- light/dark brand variants remain readable

Avoid brittle snapshots of every sentence or purely decorative pixel output.

Test durable behavior and accessibility semantics.

---

# Phase 17 — Documentation and Audit Closure

Create:

```text
docs/ux-audit-milestone-11-5.md
docs/architecture-milestone-11-5.md
```

If branding is implemented, also create or maintain the approved branding
source, for example:

```text
docs/Plan Docs/brand-identity.md
```

## UX Audit Document

Record:

- route/surface
- finding
- severity
- proposed fix
- implemented fix
- deferred item
- reason for deferral

Summarize counts by P0/P1/P2/P3 and clearly identify any unresolved P0/P1 issue.

## Architecture Document

Record terminology decisions, help/tooltip patterns, reusable table/list
patterns, responsive patterns, accessibility decisions, category/source
formatting decisions, significant navigation changes, form interaction
decisions, state/presentation decisions, theme interactions, testing strategy,
and known limitations.

If branding is implemented, additionally record:

- final product name
- brand source document
- app-shell naming treatment
- logo/wordmark usage
- favicon/app-icon treatment
- typography decisions
- brand accent usage
- semantic-color separation
- Light/Dark/System behavior
- brand-related accessibility decisions

Architecture documentation must describe implemented truth, not merely repeat
the plan.

---

# Explicit Out of Scope

Do not use this milestone as justification to add:

- new financial calculations
- new financial classifications
- new provider integrations
- new Plaid products
- banking/payment functionality
- money transfers
- investment advice
- debt advice
- AI financial recommendations
- household/multi-user functionality
- credit-score monitoring
- tax functionality
- new CSV data types unrelated to Milestone 11
- new notification systems
- advanced forecasting
- automatic Fidelity integration
- large design-system rewrite
- arbitrary information-architecture redesign
- speculative product features
- production deployment
- Production Plaid institution rollout

Do not invent:

- product name
- logo
- tagline
- brand personality
- brand palette

unless those items have been separately approved by the owner.

If branding is approved, implementing that approved branding **is in scope**.

Functional defects discovered during the UX audit may be fixed when necessary
for safe or understandable use, but they must be documented as defects rather
than hidden feature expansion.

---

# Completion Criteria

Milestone 11.5 is complete only when:

## Audit

- every owner-facing route has been audited
- major secondary/detail flows have been audited
- findings are documented and prioritized
- P0 issues are resolved or explicitly blocked
- P1 issues are resolved or explicitly blocked
- deferred P2/P3 findings are documented

## Language and Terminology

- primary UI copy uses consumer-friendly language
- core terminology is consistent
- developer-oriented copy is removed from primary UI
- provider/internal codes do not leak into primary presentation when a readable deterministic label is safe
- technical details live in secondary/source/help contexts where appropriate

## Help and Navigation

- confusing concepts have contextual help where justified
- navigation is coherent
- current-page state is understandable
- detail-return flows are coherent
- related pages connect logically
- action placement is understandable

## Tables and Lists

- table/list patterns are consistent where applicable
- sorting is understandable where provided
- search/filter behavior is understandable
- reset behavior is obvious
- pagination is usable
- long text does not break layout
- mobile representations are usable
- accessibility semantics remain correct

## Forms

- forms clearly communicate field meaning
- validation is understandable
- financial edits explain their effect where needed
- destructive actions are clearly confirmed
- save/cancel behavior is predictable
- keyboard operation passes

## States

- empty states provide meaningful guidance
- no-results states explain filtering/search
- loading states avoid fake financial values
- errors are safe and actionable
- stale states explain freshness
- partial states explain incomplete data where appropriate

## Responsive

- 375×812 usability passes across every major route
- representative tablet widths pass
- representative desktop widths pass
- no unintended horizontal overflow exists
- long merchant/category/account/source values remain resilient
- dialogs/forms/charts remain usable

## Accessibility

- keyboard-only navigation passes major flows
- visible focus remains present
- dialogs manage focus safely
- color is never the sole financial/status cue
- charts retain accessible text/table equivalents
- contextual help is keyboard/touch accessible
- headings/labels/landmarks remain semantically correct

## Themes

- Light remains coherent
- Dark remains coherent
- System remains coherent
- semantic states remain understandable in all supported themes
- branded elements, when implemented, work in all supported themes

## Branding

If approved branding exists:

- the approved product name is consistently applied
- obsolete temporary product naming is removed from primary UI
- approved logo/wordmark treatment is implemented
- browser/app metadata is updated where applicable
- favicon/app icons are updated where approved
- brand voice is consistently reflected in consumer-facing copy
- typography remains accessible and financially readable
- brand colors coexist with semantic financial colors
- brand identity does not replace semantic financial meaning
- brand presentation passes Light/Dark/System checks
- brand assets and controls have correct accessible treatment

If branding is not approved before implementation:

- Codex does not invent branding
- branding work is explicitly documented as deferred

## Financial and Security Integrity

- no financial calculation is silently changed
- no provider-source behavior is silently changed
- provider/source data remains immutable
- local override precedence remains intact
- owner scoping remains intact
- session security remains intact
- Plaid access-token security remains intact
- historical records remain auditable
- no raw provider payload or secret leaks into UI

## Testing and Verification

- relevant focused tests pass
- full PostgreSQL regression suite passes
- no database tests are silently skipped
- lint passes
- typecheck passes
- format check passes
- build passes
- Prisma validation passes
- migration status passes
- `git diff --check` passes
- browser console is clean of application errors
- temporary runtime/test artifacts are removed
- secret/security scan finds no exposed secrets

## Documentation

- `docs/ux-audit-milestone-11-5.md` is complete
- `docs/architecture-milestone-11-5.md` is complete
- approved branding documentation is current if branding was implemented
- known limitations and deferred findings are documented

## Scope

- no Milestone 12 production/deployment work is implemented
- no unrelated future financial features are introduced
- no unapproved branding is invented

---

# Required Physical Verification

Physical browser testing should cover affected routes and representative user
journeys.

At minimum verify:

```text
/login
/overview
/accounts
/transactions
/bills
/calendar
/spending
/investments
/net-worth
/settings
```

plus relevant transaction detail, account detail/edit, recurring/bill
corrections, Plaid status/reconnect/sync, CSV import, dialogs, session warning,
and empty/no-results/error/stale states.

Test:

- keyboard-only operation
- visible focus
- 375×812
- representative tablet width
- representative desktop width
- Light
- Dark
- System where physically controllable
- long/unbroken text
- realistic financial values
- clean browser console

Where the physical automation environment cannot control a specific condition,
do not falsely claim that condition was physically tested.

Use automated regression coverage to supplement unavailable physical controls
and clearly report the limitation.

---

# Required Verification Commands

Use the established project workflow and current repository commands.

Typical final gates should include:

```text
pnpm db:generate
pnpm exec prisma validate
pnpm exec prisma migrate status
pnpm lint
pnpm typecheck
pnpm test
pnpm format:check
pnpm build
git diff --check
```

When PostgreSQL-backed behavior is affected, run the full isolated PostgreSQL
suite with no silent skips.

If schema changes are genuinely required:

- explain why
- prefer the smallest forward-only migration
- do not reset development data destructively
- verify migration replay/status
- preserve existing financial records

A schema change should not be introduced merely for visual polish or branding.

---

# Final Report

Codex should report:

1. overall PASS or BLOCKED
2. audit methodology
3. routes audited
4. secondary flows audited
5. issue counts by P0/P1/P2/P3
6. P0/P1 resolution status
7. files changed
8. schema/migration decision
9. terminology changes
10. page-copy changes
11. contextual help/tooltips added
12. navigation/orientation changes
13. table/list consistency changes
14. form improvements
15. empty/no-results/error/partial/stale-state improvements
16. visual hierarchy improvements
17. responsive fixes
18. accessibility fixes
19. theme/semantic fixes
20. whether branding was approved and implemented
21. approved product name, if applicable
22. branding source used
23. logo/wordmark/icon changes
24. brand typography/color decisions
25. confirmation brand colors did not replace semantic financial colors
26. user journeys physically tested
27. exact physical viewport/theme conditions tested
28. defects discovered and fixed
29. intentionally deferred findings
30. automated test totals
31. PostgreSQL test totals
32. build result
33. lint result
34. typecheck result
35. format-check result
36. Prisma validation/migration result
37. browser-console result
38. security/secret-scan result
39. confirmation financial/provider semantics were preserved
40. confirmation owner/session security was preserved
41. confirmation source/provider data remained immutable
42. confirmation temporary artifacts were removed
43. confirmation nothing was staged, committed, pushed, merged, or submitted
44. recommendation: ready for review or blocked

---

# Relationship to Milestone 12

Milestone 11.5 should leave the application understandable, coherent,
accessible, visually polished, consistently named, consistently branded when an
approved brand exists, and pleasant and efficient to use.

Milestone 12 should then concentrate on making that finished experience safe
and operationally ready for production.

Milestone 12 remains responsible for:

- final security review
- backup strategy
- observability
- error tracking
- rate limiting
- production deployment
- Plaid Production Trial
- real-institution rollout after Sandbox validation
- final formal accessibility audit
- final contrast audit
- final theme-persistence audit
- final production metadata/deployment verification

The distinction is:

> **Milestone 11.5 asks whether the finished product is understandable,
> coherent, accessible, and professionally presented.**

> **Milestone 12 asks whether that finished product is safe and operationally
> ready to run in production.**

This separation prevents Production Readiness from becoming a catch-all UX,
branding, or redesign milestone.
