# App-Wide Notice and Alert Architecture Audit

## 1. Current architecture summary

The app does not have a true reusable `Alert`, `Notice`, or `Callout` component.

Existing shared layers are:

- `src/app/globals.css` defines light and dark semantic tokens for:
  - positive
  - negative
  - warning
  - informational
  - investment
  - muted
- `src/components/ui/semantic.tsx` provides:
  - `semanticToneClasses`
  - `semanticTextClasses`
  - `SemanticBadge`
  - `SemanticValue`
- `src/components/ui/card.tsx` supplies a theme-safe generic panel.
- `src/components/portfolio/feedback.tsx` is a reusable success/error notice, but only for portfolio pages.

`semanticToneClasses` is currently the only app-wide shared notice-presentation layer. It provides border, background, and text colors, but not:

- notice layout
- title/body structure
- icon treatment
- actions
- ARIA-role selection
- focus behavior

It is therefore a partial foundation, not a complete notice system.

No toast, toaster, snackbar, or other transient-feedback system exists.

## 2. App-wide inventory

| Surface                                                   | Category                               | Shared implementation                                                   | Theme/accessibility assessment                                                                                      | Recommendation                                                                       |
| --------------------------------------------------------- | -------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Overview “Partial totals”                                 | Warning; stale/partial-data            | Local markup                                                            | `role="status"` and warning icon, but hardcoded `amber-50/300/950`; dark-theme visual inconsistency                 | Migrate to shared notice                                                             |
| Overview empty dashboard                                  | Informational/page state               | `Card` only                                                             | No live role needed; some hardcoded slate text can become low contrast in dark mode                                 | Keep as empty-state layout, use theme text tokens                                    |
| Overview source-health rows                               | Connection/source health; stale-data   | Local badges                                                            | Hardcoded emerald/amber/rose/slate badges; explicit labels prevent color-only meaning, but appearance is light-only | Keep as badges; migrate to `SemanticBadge`                                           |
| Overview transaction and upcoming-status badges           | Specialized record status              | Local badges                                                            | Hardcoded light status colors; explicit status text is good                                                         | Keep as badges, use semantic helpers                                                 |
| Accounts/Investments action feedback                      | Success, error, validation             | `PortfolioFeedback`                                                     | Token-safe; `status` for success and `alert` for error; duplicated concept outside portfolio                        | Migrate to shared notice                                                             |
| Accounts/Investments/Net Worth “Partial values”           | Warning; stale/partial-data            | `PortfolioSummary` local markup                                         | Token-safe, `role="status"`, icon and heading; duplicates Overview partial notice                                   | Migrate to shared notice                                                             |
| Account, asset, investment and net-worth freshness labels | Connection/source health; stale-data   | `SemanticBadge`                                                         | Theme-safe, explicit Current/Stale/Unavailable labels and help text                                                 | Keep as specialized badges                                                           |
| Plaid configuration-required state                        | Connection/source health               | `SemanticBadge` plus local text                                         | Theme-safe and `role="status"`; structure is local                                                                  | Could use a compact notice, but migration is optional                                |
| Plaid connection status                                   | Connection/source health               | `plaidStatusPresentation` plus `SemanticBadge`                          | Good separation of domain state from presentation; explicit Ready/Stale/Repair/Error/Disconnected labels            | Keep specialized                                                                     |
| Plaid stored connection error                             | Error/source health                    | Local semantic-negative text                                            | Theme-safe, but no alert/callout structure or role                                                                  | Candidate for nested shared notice                                                   |
| Plaid Link launch/exchange error                          | Error                                  | Local paragraph                                                         | `role="alert"` and semantic-negative text; no background/border                                                     | Candidate for compact shared notice                                                  |
| Plaid empty connection state                              | Informational/page state               | `Card`                                                                  | Theme-safe; no live role required                                                                                   | Keep as empty state                                                                  |
| Transaction override feedback                             | Success, error, validation             | Local markup                                                            | Token-safe and correct `status`/`alert`, but duplicates portfolio and Calendar feedback                             | Migrate to shared notice                                                             |
| Transaction unavailable-account filter                    | Warning/validation                     | Local text                                                              | `role="alert"` with warning text token; no panel or title                                                           | Candidate for compact notice; `alert` may be stronger than necessary on initial load |
| Transactions empty/no-match state                         | Informational/page state               | `Card`                                                                  | Theme-safe, static semantics appropriate                                                                            | Keep as empty state                                                                  |
| Bills “Bill data notice”                                  | Warning; stale/partial-data            | Local `Card` markup                                                     | Theme-safe, `role="status"`, heading and list; duplicates Calendar and Spending almost exactly                      | Migrate to shared notice                                                             |
| Calendar success/error feedback                           | Success, error, validation             | Local markup                                                            | Token-safe with `status`/`alert`; success is focusable via `tabIndex=-1` but not programmatically focused           | Migrate to shared notice                                                             |
| Calendar “Calendar data notice”                           | Warning; stale/partial-data            | Local `Card` markup                                                     | Token-safe and `role="status"`; duplicates Bills/Spending                                                           | Migrate to shared notice                                                             |
| Calendar suggested match                                  | Warning/specialized matching workflow  | Local domain component                                                  | Theme-safe; explicit confidence and evidence; contains an action form                                               | Leave specialized or compose a notice shell without moving matching logic            |
| Calendar empty/no-events states                           | Informational/page state               | `Card`                                                                  | Static role is appropriate, but several `text-slate-600` uses are dark-theme risks                                  | Keep as empty states; normalize text tokens separately                               |
| Spending “Spending data notice”                           | Warning; stale/partial-data            | Local `Card` markup                                                     | Theme-safe, `role="status"`, heading and list; duplicates Bills/Calendar                                            | Migrate to shared notice                                                             |
| Spending “Higher than typical”                            | Specialized analytical annotation      | `SemanticBadge` and cards                                               | Theme-safe, explicitly says it is not a fraud/security alert                                                        | Keep specialized                                                                     |
| Investment template-selected message                      | Informational/confirmation             | Local paragraph                                                         | Token-safe and `role="status"`; duplicates generic notice treatment                                                 | Migrate to shared notice                                                             |
| Login invalid-credentials error                           | Error/validation                       | Login-local paragraph                                                   | `role="alert"`, but hardcoded `text-red-700` on a dark panel has serious contrast risk                              | Blocking theme fix; migrate to compact notice or semantic error text                 |
| Login session-expired message                             | Session/security informational warning | Local markup                                                            | Token-safe, `role="status"`; duplicated warning presentation                                                        | Shared notice is appropriate; session timeout dialog remains separate                |
| Forgot-password page                                      | Informational/security state           | `Card` page                                                             | Theme-safe, static content; does not collect secrets                                                                | Keep as specialized page state                                                       |
| Dashboard error boundary                                  | Error/page state                       | Local page                                                              | Generic safe copy, but hardcoded `text-slate-600` is low-contrast in dark mode; no alert semantics                  | Keep error-page layout; use theme text token                                         |
| Not-found page                                            | Informational/page state               | Local page                                                              | Same hardcoded slate dark-mode risk; no alert role needed                                                           | Keep specialized page                                                                |
| Session-expiration warning                                | Session/security alert                 | Dedicated controller                                                    | `alertdialog`, assertive live region, focus trap, server-backed countdown; Escape intentionally cannot dismiss      | Must remain specialized                                                              |
| Permanent-delete confirmation                             | Destructive dialog                     | Shared `DeleteConfirmationDialog`                                       | Correct dialog labeling, focus trap, Escape, trigger-focus restoration; dependency warning is token-safe            | Keep specialized                                                                     |
| Plaid disconnect confirmation                             | Destructive dialog                     | Dedicated dialog                                                        | Correct labeling, focus trap and Escape; domain-specific history explanation                                        | Keep specialized                                                                     |
| Settings security explanation                             | Static informational content           | `Card`                                                                  | Theme-safe, not an active notice                                                                                    | Keep as content                                                                      |
| Native form constraints                                   | Validation                             | Browser-native `required`, `min`, `pattern`                             | No shared field-error component, `aria-invalid`, or field-linked custom errors                                      | Remain separate from notice primitive                                                |
| Server action validation                                  | Validation/error                       | URL feedback rendered by Calendar, portfolio, or transaction components | Safe generic messages, but presentation differs by feature                                                          | Page-level summary should use shared notice                                          |
| Help tooltips                                             | Specialized help                       | Shared `HelpTooltip`                                                    | Keyboard, focus, Escape and accessible-name behavior                                                                | Keep separate                                                                        |
| Toast-style feedback                                      | Transient feedback                     | None                                                                    | No infrastructure or usage found                                                                                    | Do not introduce during consolidation                                                |

## 3. Duplication and inconsistency findings

The clearest duplicated structures are:

- Bills, Calendar, and Spending each independently render:
  - a warning panel
  - `role="status"`
  - bold title
  - bulleted state-message list
  - semantic warning border/background/text
- Overview and `PortfolioSummary` independently render:
  - warning icon
  - title
  - partial-reason body
  - `role="status"`
- `PortfolioFeedback`, `TransactionDetail`, and `CalendarPage` independently render success/error action feedback.
- Login expiration, investment-template selection, Plaid errors, and transaction-filter warnings each recreate smaller variants.

There are also two nearly identical shared form-class modules:

- `src/components/portfolio/form-controls.ts`
- `src/components/ui/form-controls.ts`

That is adjacent technical debt, but it should not be folded into a notice refactor.

## 4. Theme and accessibility risks

### Serious remaining risks

- `src/components/dashboard/overview-dashboard.tsx` uses a hardcoded light-only partial-total panel.
- `src/components/login-form.tsx` uses `text-red-700` for invalid-login feedback. On the dark panel foundation this is likely insufficiently contrasted.
- Login labels and fields also use hardcoded slate colors rather than the established form tokens.
- `src/components/dashboard/overview-panels.tsx` contains multiple hardcoded light-only status and source-health badges.
- Calendar empty states, the dashboard error boundary, Overview empty-state copy, and the not-found page use fixed `text-slate-600` or similar colors that are weak on dark surfaces.

These are the remaining patterns most capable of reproducing the Milestone 9 regressions.

### Semantics

- Errors generally use `role="alert"` correctly.
- Success and warning summaries generally use `role="status"`.
- Static empty states correctly avoid unnecessary live regions.
- Some source-health and stored-error content has no role. That is acceptable for server-rendered page content, but dynamically introduced Plaid errors correctly use `role="alert"`.
- `TransactionLedger` uses `role="alert"` for an unavailable filter selected from the URL. `status` may be less disruptive unless immediate intervention is required.
- Most page-level feedback is not programmatically focused after server navigation. A shared primitive could support an opt-in focus target without forcing focus universally.

### Semantic token contrast

The existing token pairs are strong in both themes:

| Tone        |  Light |    Dark |
| ----------- | -----: | ------: |
| Positive    | 7.29:1 | 11.43:1 |
| Negative    | 7.30:1 | 11.08:1 |
| Warning     | 6.84:1 | 12.03:1 |
| Information | 8.01:1 | 10.34:1 |
| Investment  | 8.13:1 | 11.02:1 |
| Muted       | 6.92:1 |  9.85:1 |

The existing theme system is sufficient. No second color system is needed.

Icon-specific tokens are unnecessary if icons use `currentColor`. Actions should continue using the global `--focus-ring`; a separate warning/error focus-color system is not needed.

## 5. Recommended architecture

The smallest useful boundary is a presentation-only `Notice` component backed by `semanticToneClasses`.

A suitable shape would be approximately:

```tsx
<Notice
  tone="warning"
  title="Partial totals"
  role="status"
  icon={AlertTriangle}
>
  ...
</Notice>
```

Recommended capabilities:

- `tone`: existing `info | warning | positive | negative`
- optional `title`
- `children`
- optional icon using `currentColor`
- optional actions area
- optional explicit `role`
- optional `tabIndex`/focus ref
- `className` for spacing only
- shared border, background, text, radius, padding, and title/body layout

The component should not own:

- domain message generation
- state conditions
- redirect/query handling
- dialog state
- validation parsing
- focus traps
- timeouts
- toasts
- Plaid or Calendar actions

Using existing names internally avoids duplicating the semantic system. A consumer-facing alias of `success → positive` and `error → negative` is optional, but adding parallel tokens is not warranted.

### Initial consumers

- Overview partial totals
- Portfolio partial values
- Bills, Calendar, and Spending data notices
- Calendar, portfolio, and transaction success/error feedback
- Login session-expired message
- Investment template information
- Plaid Link and connection-error feedback
- Transaction unavailable-filter warning

### Keep specialized

- Session expiration `alertdialog`
- Delete confirmation dialog
- Plaid disconnect dialog
- Suggested Calendar transaction match
- Field-level/native validation
- Empty states
- Status/freshness badges
- Help tooltips
- Global error and not-found page layouts

## 6. Likely affected files

A future targeted consolidation would introduce something like:

- `src/components/ui/notice.tsx`
- `src/components/ui/notice.test.tsx`

Likely migrations:

- `src/components/dashboard/overview-dashboard.tsx`
- `src/components/portfolio/portfolio-summary.tsx`
- `src/components/portfolio/feedback.tsx`
- `src/components/bills/bills-page.tsx`
- `src/components/calendar/calendar-page.tsx`
- `src/components/spending/spending-page.tsx`
- `src/components/transactions/transaction-detail.tsx`
- `src/components/transactions/transaction-ledger.tsx`
- `src/app/(dashboard)/investments/page.tsx`
- `src/app/login/page.tsx`
- `src/components/login-form.tsx`
- `src/components/plaid/plaid-link-button.tsx`
- possibly `src/components/plaid/connection-manager.tsx`

Separate theme-debt files, not necessarily part of the Notice migration:

- `src/components/dashboard/overview-panels.tsx`
- `src/app/(dashboard)/error.tsx`
- `src/app/not-found.tsx`
- Calendar empty-state components
- login form controls

## 7. Scope recommendation

Implement a small centralized Notice primitive before Milestone 9 closes, but keep the migration narrow.

Recommended pre-close scope:

1. Add the primitive and focused tests.
2. Migrate the duplicated page-level warning/success/error notices.
3. Fix the invalid-login error and Overview partial-total dark-theme risks.
4. Physically verify those surfaces in both themes.

Defer to Milestone 11.5:

- broad empty-state visual normalization
- all Overview badge modernization
- general form-primitive consolidation
- global page-polish work
- any toast system
- larger dialog abstraction

The small pre-close change reduces the demonstrated regression class at modest risk. Deferring everything leaves multiple independent notice implementations and at least two serious dark-theme risks in active user flows.

## 8. Remaining Milestone 9 risk

Milestone 9 should not be considered fully closed from an app-wide dark-theme perspective yet.

Bills, Calendar, Spending, portfolio partial-value notices, transaction feedback, and session expiration are currently token-safe. However:

- Overview’s partial-total notice still uses a light-only hardcoded warning panel.
- Invalid-login feedback uses a hardcoded red text color with likely inadequate dark contrast.
- Overview connection/source-health badges retain the same light-only styling pattern.
- Several static error/empty-state messages use low-contrast slate text in dark mode.

The first two are serious enough to justify a small pre-close correction. The broader badge and empty-state cleanup can be explicitly tracked for Milestone 11.5.

---

Audit constraints: this was a read-only architecture audit. No product files were modified as part of the investigation, and no files were staged, committed, pushed, merged, restored from the planning stash, or submitted.

## 9. Implementation status

The recommended narrow consolidation is now implemented through
`src/components/ui/notice.tsx`. The shared `Notice` primitive accepts the four
existing semantic tones (`info`, `warning`, `positive`, and `negative`) and
uses the established light/dark semantic border, background, and text tokens.
It supports optional titles, icons, actions, native accessibility attributes,
and caller-managed focus without imposing alert behavior on informational
content.

The approved generic surfaces now use the primitive: Overview and portfolio
partial-data warnings; Bills, Calendar, and Spending data notices; Calendar,
portfolio, and transaction success/error feedback; login expiration and
invalid-login feedback; investment template information; Plaid Link and
connection errors; and the unavailable transaction-filter warning. This also
removes the serious light-only styling risks identified for the Overview
partial-total warning and invalid-login error.

Specialized experiences remain intentionally separate: session-expiration and
destructive confirmation dialogs, Plaid disconnect confirmation, suggested
Calendar matching, field validation, empty states, badges, help tooltips, and
global error/not-found layouts. Broader badge, empty-state, form, and global
page-polish work remains deferred to Milestone 11.5.
