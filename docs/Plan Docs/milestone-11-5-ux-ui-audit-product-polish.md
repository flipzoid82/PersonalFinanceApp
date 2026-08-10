# Proposed Milestone 11.5 — UX/UI Audit and Product Polish

## Status

**Proposed roadmap addition.** This milestone is not part of the current canonical Build Plan yet.

Recommended placement:

```text
Milestone 11 — CSV Import
Milestone 11.5 — UX/UI Audit and Product Polish
Milestone 12 — Production Readiness
```

The purpose of placing this work after Milestone 11 is to let the major MVP feature set stabilize before performing a cross-application usability pass, while still completing the work before production-readiness and real-institution rollout.

---

## Objective

Audit the entire application from the perspective of a normal personal-finance user and improve clarity, discoverability, consistency, accessibility, and ease of use without changing established financial calculations, provider behavior, security boundaries, or core product scope.

This is a **product-usability and presentation milestone**, not a new financial-feature milestone.

The milestone should answer:

> Can a person who did not build this application understand what each page is for, what the information means, what actions are available, and what will happen when they use them?

---

## Existing Foundations to Preserve

The application already has important UX/accessibility foundations that this milestone should refine rather than replace:

- semantic colors are secondary cues only
- financial/status meaning must also be communicated with text, signs, icons, or labels
- light/dark theme foundations exist
- responsive layouts and keyboard access are tested
- loading, empty, stale, partial, and error states exist in multiple areas
- user-facing theme controls are planned for Milestone 10
- final contrast/theme auditing is already planned for Milestone 12

This milestone should focus on the broader usability gap that is not currently covered explicitly by the roadmap: language, orientation, information hierarchy, consistency, discoverability, help, and consumer comprehension.

---

## Source Hierarchy

Use the normal project workflow SOP.

Mandatory sources should include:

1. this milestone prompt/plan once approved
2. canonical Product Requirements
3. Financial Definitions
4. Build Plan
5. Codex Build Brief
6. merged architecture documents through Milestone 11
7. current application code and tests
8. relevant accessibility/theme foundations
9. current navigation structure

Historical Codex prompts should not be read by default.

---

## Phase 1 — Full Application UX Audit

Before changing code, inspect every owner-facing route:

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

Also inspect:

- transaction detail
- account detail/edit surfaces
- manual asset/debt flows
- recurring/bill detail or correction flows
- Plaid connection/reconnect/sync UI
- CSV import workflow
- session-expiration warning
- confirmation/error dialogs
- loading/empty/error states

For every surface, document findings in a structured audit.

### Audit dimensions

Score or classify each screen for:

- purpose clarity
- terminology
- information hierarchy
- discoverability
- action clarity
- form clarity
- feedback after actions
- empty-state usefulness
- error-message usefulness
- technical/provider jargon exposure
- visual density
- table/list readability
- mobile usability
- keyboard usability
- accessibility
- theme readability
- consistency with other screens

Classify issues by severity:

```text
P0 — prevents task completion or creates financial misunderstanding
P1 — substantial confusion or usability barrier
P2 — noticeable friction or inconsistency
P3 — cosmetic/polish improvement
```

Do not begin broad refactoring until the audit is documented.

---

## Phase 2 — Consumer-Friendly Language

Review all visible copy as if the user has no knowledge of:

- Prisma
- Plaid internals
- provider normalization
- effective-value precedence
- database terminology
- UTC implementation details
- internal enum names
- milestone terminology

### Primary rule

> User-facing language explains what the user can do and what the information means. Technical implementation language belongs in documentation or secondary source details.

### Rewrite areas

Review and improve:

- page taglines
- page descriptions
- form labels
- table headers
- filter labels
- buttons
- badges
- status text
- explanatory paragraphs
- confirmation messages
- validation messages
- empty states
- error states
- Settings descriptions
- source/freshness descriptions

### Examples

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

unless the distinction is truly necessary for the user.

Avoid displaying:

```text
TRANSPORTATION_TAXIS_AND_RIDE_SHARES
```

as the primary label.

Prefer:

```text
Taxis & rideshare
```

while preserving the original provider value as source data.

---

## Phase 3 — Terminology System

Create a small documented consumer terminology glossary so the same concept is not called different things on different screens.

Audit terms such as:

- transaction
- merchant
- description
- category
- transaction type / financial role
- spending
- expense
- income
- transfer
- credit-card payment
- refund
- bill
- recurring payment
- predicted
- confirmed
- due date
- posting date
- available cash
- current balance
- source
- synced
- imported
- manual
- stale
- excluded from reports

For each important term, define:

```text
Internal/domain term
Preferred user-facing term
Short explanation
Where technical wording may still appear
```

Do not rename database fields merely to improve UI terminology.

---

## Phase 4 — Progressive Disclosure and Help

Add contextual help only where it reduces real confusion.

Possible patterns:

- tooltip/help icon beside unfamiliar terms
- concise helper text beneath a control
- expandable “Learn more” section
- source/details section on detail pages
- first-use orientation where justified

### Good tooltip candidates

Potentially confusing concepts include:

- Transaction type
- Exclude from spending & income
- Predicted vs Confirmed
- Confidence
- Available balance vs Current balance
- Data freshness
- Historical/disconnected account
- Manual vs Synced vs Imported
- Net cash flow
- Credit utilization

Tooltips must:

- be keyboard accessible
- work on touch devices
- not contain essential information that cannot be reached elsewhere
- be concise
- use consumer language

Do not add a tooltip to every label.

---

## Phase 5 — Navigation and Orientation

Review whether a normal user can understand:

- where they are
- what each navigation destination contains
- how related screens connect
- how to return from details
- where to correct data
- where to manage data sources
- where to find reports vs raw activity

Review:

- navigation labels
- selected/current-page indication
- page titles
- breadcrumbs or back-navigation where useful
- Overview links to deeper pages
- detail-page return paths
- related-action placement

Do not redesign the entire information architecture unless the audit shows a clear usability problem.

---

## Phase 6 — Tables, Lists, and Spreadsheet-Like Surfaces

Standardize proven interaction patterns across data-heavy screens.

Review tables/lists for:

- clear column names
- sortable headers where useful
- visible sort direction
- active/debounced search where useful
- filters
- reset/clear behavior
- pagination
- row/detail navigation
- readable date formatting
- readable currency formatting
- readable categories
- long-text resilience
- mobile alternative layout
- keyboard interaction
- empty/no-results states

Reuse small proven patterns introduced in prior milestones rather than building a large generic data-grid framework.

Potential surfaces:

- Transactions
- Accounts
- Bills
- Spending merchant/category views
- Investment holdings
- Net-worth history
- CSV import review/rejected rows

Not every table needs every feature.

---

## Phase 7 — Forms and Editing Workflows

Audit every form for:

- clear field names
- plain-language descriptions
- sensible grouping
- required vs optional clarity
- useful defaults
- input formatting
- validation timing
- error placement
- success feedback
- destructive action confirmation
- cancel/back behavior
- accidental data-loss risk
- mobile keyboard/input usability

Financially important edits should state their effect clearly.

Example:

Instead of:

```text
Exclude from reports
```

prefer something like:

```text
Don't include in spending & income
```

with helper text:

```text
The transaction stays in your history but won't affect spending or income totals.
```

---

## Phase 8 — Empty, Loading, Error, Partial, and Stale States

Every important page should be understandable even when there is little or no data.

Audit:

### Empty

Explain:

- why there may be no data
- what the user can do next
- whether this is expected

### No search/filter results

Explain that the data exists but current filters found no matches.

Provide an obvious reset action.

### Loading

Avoid fake financial values.

### Error

Use safe, actionable consumer language.

Do not expose stack traces, provider codes, raw API errors, or secret-bearing diagnostics.

### Partial/stale

Explain:

- what information may be incomplete
- which source needs attention when safe
- what action the user can take

---

## Phase 9 — Visual Hierarchy and Density

Audit screens for whether the most important information is visually obvious.

Review:

- heading hierarchy
- card density
- whitespace
- section grouping
- primary vs secondary metadata
- repetitive badges
- excessively verbose helper text
- long provider/source labels
- numeric alignment
- currency prominence
- date prominence
- destructive vs primary actions

Avoid aesthetic redesign for its own sake. Every visual change should improve comprehension or task completion.

---

## Phase 10 — Responsive Usability

Test at minimum:

```text
375 × 812
```

Also inspect representative tablet and desktop widths.

Check:

- horizontal overflow
- clipped labels
- long categories
- wide tables
- filter layouts
- dialogs
- forms
- charts
- sticky/fixed elements
- tap targets
- navigation
- tooltips/help controls

A layout technically fitting on screen is not enough; it must remain comfortably usable.

---

## Phase 11 — Accessibility Audit

Preserve and deepen the existing accessibility standards.

Verify:

- semantic headings
- landmarks
- labels
- table headers/captions
- keyboard-only operation
- visible focus
- logical focus order
- dialogs trap/restore focus safely
- live-region use is restrained
- color is never the sole cue
- accessible names are consumer-friendly
- charts have text/table equivalents
- icons have meaningful labels where necessary
- tooltips/help are keyboard and touch accessible
- reduced-motion behavior where motion is introduced

Automated checks do not replace physical keyboard testing.

---

## Phase 12 — Theme and Semantic Consistency

Milestone 10 should already have completed the user-facing theme control and broad dark-mode support. This UX milestone should inspect the finished experience for usability consistency rather than reimplement theme architecture.

Verify:

- Light
- Dark
- System
- positive/negative semantics
- warnings
- prediction/confirmation states
- links
- focus indicators
- muted text
- tables
- forms
- charts
- tooltips
- dialogs
- empty/error states

Leave the final formal contrast/theme-persistence production audit to Milestone 12.

---

## Phase 13 — User Journey Testing

Test complete tasks rather than isolated components.

Representative journeys:

### Daily review

```text
Sign in
→ Overview
→ inspect recent transactions
→ open a transaction
→ correct classification
→ return to Overview
```

### Find a charge

```text
Transactions
→ active search
→ filter/sort
→ detail
→ understand source and classification
```

### Upcoming bills

```text
Overview
→ Bills or Calendar
→ distinguish predicted/confirmed
→ understand next expected charge
→ correct/confirm where supported
```

### Account health

```text
Accounts
→ identify disconnected/stale source
→ understand status
→ reconnect/sync if supported
```

### Investment review

```text
Investments
→ understand account value/source/freshness
→ holdings/allocation
→ navigate to net worth
```

### Import

```text
CSV import
→ choose/map
→ validation
→ review
→ rejected rows
→ completion summary
```

The tester should be able to explain what happened without knowing implementation terminology.

---

## Phase 14 — First-Time-User Comprehension Review

Even though the product is single-user/private, perform a “new user” review.

For each major screen ask:

1. What is this page for?
2. What is the most important thing here?
3. What can I do?
4. What does each unfamiliar term mean?
5. What happens if I change something?
6. Where did this financial data come from?
7. How do I recover from an error?
8. Where should I go next?

If the interface itself cannot answer those questions reasonably, improve it.

Do not build a large onboarding tour unless the audit demonstrates one is necessary.

---

## Phase 15 — UX Consistency Tests

Add targeted regression tests for stable UX rules where automation is useful.

Examples:

- no provider-style enum code appears as a primary category label
- shared terminology is used on key pages
- sortable tables have accessible sort state
- critical help controls have accessible names
- empty states contain next-step guidance
- mobile layouts do not overflow
- technical provider IDs/raw payloads remain hidden
- meaning does not rely on color
- source values remain available in appropriate detail views
- theme variants render supported semantic states

Avoid brittle snapshot tests of every sentence.

---

## Documentation Deliverables

Create:

```text
docs/ux-audit-milestone-11-5.md
docs/architecture-milestone-11-5.md
```

### UX audit document

Record:

- route/surface
- finding
- severity
- proposed fix
- implemented fix
- deferred item
- reason for deferral

### Architecture document

Record:

- shared terminology decisions
- help/tooltip patterns
- reusable table/list patterns
- responsive patterns
- accessibility decisions
- user-facing category/source formatting
- significant navigation changes
- testing strategy
- known limitations

---

## Explicit Out of Scope

Do not use this milestone as justification to add:

- new financial calculations
- new provider integrations
- banking/payment functionality
- investment advice
- debt advice
- AI recommendations
- household/multi-user functionality
- new CSV data types unrelated to Milestone 11
- new notification systems
- large design-system rewrite
- arbitrary visual redesign
- branding/rebranding unless separately approved
- production deployment

Functional defects discovered during the audit may be fixed if they are necessary for safe/understandable use, but must be documented as defects rather than hidden feature expansion.

---

## Completion Criteria

Milestone 11.5 is complete only when:

- every owner-facing route has been audited
- findings are documented and prioritized
- P0 and P1 usability issues are resolved or explicitly blocked
- primary UI copy uses consumer-friendly language
- core terminology is consistent across screens
- provider/internal codes do not leak into primary presentation where a readable deterministic label is safe
- technical details are moved to secondary/source/help contexts where appropriate
- confusing concepts have contextual help where justified
- navigation and detail-return flows are coherent
- table/list patterns are consistent where applicable
- forms clearly communicate effects and validation
- empty/no-results/error/partial/stale states provide useful guidance
- long text does not create overflow
- primary user journeys pass physical testing
- 375×812 usability passes across every major route
- keyboard-only navigation passes for every major interactive flow
- light/dark/system presentation remains understandable
- financial meaning never depends on color alone
- charts retain accessible text equivalents
- no financial calculation or provider-source behavior was silently changed
- provider/source data remains immutable
- owner/session security remains intact
- relevant automated tests pass
- full PostgreSQL regression suite passes without skipped database tests
- lint, typecheck, format, build, and diff checks pass
- UX audit and architecture documents are complete
- no Milestone 12 production/deployment scope is implemented

---

## Final Report

Codex should report:

1. overall PASS or BLOCKED
2. audit methodology
3. routes audited
4. issue counts by P0/P1/P2/P3
5. files changed
6. terminology changes
7. page-copy changes
8. contextual help/tooltips added
9. navigation/orientation changes
10. table/list consistency changes
11. form improvements
12. empty/error/partial-state improvements
13. responsive fixes
14. accessibility fixes
15. theme/semantic fixes
16. user journeys physically tested
17. defects discovered and fixed
18. intentionally deferred findings
19. automated test totals
20. PostgreSQL test totals
21. build/lint/typecheck/format results
22. browser-console results
23. security/secret-scan results
24. confirmation financial/provider semantics were preserved
25. confirmation temporary artifacts were removed
26. confirmation nothing was staged, committed, pushed, merged, or submitted
27. recommendation: ready for PR or blocked

---

## Relationship to Milestone 12

Milestone 11.5 should leave the application **understandable and pleasant to use**.

Milestone 12 should then concentrate on making that finished experience **safe and operationally ready for production**, including security review, backup, observability, error tracking, rate limiting, production deployment, Plaid Production Trial, and the final formal accessibility/contrast/theme audit.

This separation prevents Production Readiness from becoming a catch-all UX redesign milestone.
