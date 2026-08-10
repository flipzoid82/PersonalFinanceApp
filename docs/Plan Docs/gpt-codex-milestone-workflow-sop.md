# Personal Finance App — GPT/Codex Milestone Workflow SOP

## Purpose

This document defines the standard operating procedure for planning, implementing, verifying, reviewing, and merging future milestones of the Personal Finance App.

Its purpose is to keep the workflow consistent across new ChatGPT conversations, context resets, and Codex sessions without losing project integrity, source-of-truth discipline, Git hygiene, security boundaries, or verification quality.

A new ChatGPT conversation should use this document as the workflow authority, then ground milestone-specific decisions in the repository's canonical planning documents, merged architecture documents, current code/schema/tests, and Git state.

## 1. Roles

### ChatGPT

ChatGPT is the planning, review, and workflow coordinator. It should help define the next milestone from the canonical build plan, inspect relevant planning and architecture documents before drafting milestone instructions, identify ambiguities and conflicts instead of silently inventing behavior, create or revise the milestone Codex prompt under `docs/Plan Docs/`, provide the short kickoff prompt that tells Codex to follow the milestone prompt, review Codex's completion report and architecture document, guide manual owner testing where useful, review Git status/diffs before staging, guide staging/commit/push/PR/merge/cleanup, keep future scope from leaking into the current milestone, and preserve security and financial-domain invariants.

ChatGPT should not treat a milestone as complete merely because Codex says it is. The Codex report must be reviewed against the source documents and verification evidence.

### Codex

Codex is the implementation and verification agent. It should work from the milestone prompt and source hierarchy, inspect current implementation reality before changing code, implement only the approved milestone scope, stop and report genuine source conflicts, add/update tests, create/update the milestone architecture document, run required automated and physical verification, clean temporary artifacts, provide a detailed final report, and avoid staging/committing/pushing/merging/opening a PR unless explicitly told to do so.

### Owner

The owner controls credentials and secrets, manual login, approval of product behavior and scope changes, final manual UX observations, and Git commit/push/PR/merge actions unless explicitly delegated.

Never require the owner to paste secrets into ChatGPT or Codex.

## 2. Project Source-of-Truth Hierarchy

For a new milestone, use this hierarchy instead of loading the entire historical repository into context.

### Tier 1 — Current Milestone Prompt

Read the current milestone prompt under `docs/Plan Docs/`, for example:

```text
docs/Plan Docs/milestone-9-codex-prompt.md
```

This defines the approved execution scope for the current milestone.

### Tier 2 — Canonical Core Planning Documents

Read the current non-milestone planning documents that define Product Requirements, Financial Definitions, Data Model, Plaid Integration, Overview Dashboard Specification, Calendar Specification, Build Plan, and Codex Build Brief.

These documents define intended product behavior, financial rules, milestone boundaries, provider behavior, and data-model expectations.

### Tier 3 — Merged Architecture Documents

Read the architecture documents through the most recently completed milestone. These are the concise record of what actually shipped and was verified.

Prefer architecture documents over rereading prior milestone Codex prompts.

### Tier 4 — Current Implementation Reality

Inspect only the code, schema, migrations, tests, README sections, and relevant Git history necessary for the current milestone. Focus on directly affected features, downstream calculations, shared helpers, owner scoping/security boundaries, provider synchronization/reconciliation, and prior behavior that could regress.

Do not perform broad repository archaeology when focused inspection answers the question.

### Tier 5 — Historical Milestone Codex Prompts

Do not read old milestone Codex prompts by default.

Consult a specific historical prompt only when a canonical planning document is ambiguous, an architecture document omits a decision needed for the current milestone, current implementation behavior cannot be explained confidently, or a historical implementation boundary/regression requires the original instruction.

Load only the relevant historical file or section needed to resolve the ambiguity.

### Conflict Rule

If sources reveal a genuine conflict:

1. stop
2. identify the conflicting sources and exact behavior
3. do not invent a compromise silently
4. ask the owner to resolve the product decision when necessary
5. update the current milestone prompt if the approved decision changes scope

## 3. Context-Efficient New-Chat Handoff

When starting a new ChatGPT conversation because context is low or exhausted, do not attempt to recreate the entire conversation history.

Give the new chat:

1. this SOP
2. the current Build Plan
3. the latest completed milestone architecture document
4. the current milestone Codex prompt, if work is in progress
5. the latest Codex completion report, if implementation is awaiting review
6. current Git status/diff output when relevant

Then instruct the new chat to retrieve other canonical planning or architecture documents only as needed.

Recommended handoff:

```text
We are continuing development of the Personal Finance App.

Use the attached GPT/Codex Milestone Workflow SOP as the workflow authority.

Read the current Build Plan, the latest completed architecture document, and
the current milestone prompt/report provided here.

Use the SOP's source hierarchy. Do not assume missing historical details and
do not reread old milestone Codex prompts unless an ambiguity requires one.

First establish:
- current milestone
- current Git branch/state
- what has already been implemented/verified
- the next workflow step

Then continue from there.
```

## 4. Before Starting a New Milestone

### Step 1 — Confirm Prior Milestone Is Fully Closed

Verify prior PR merged, local `main` updated with `git pull --ff-only`, prior feature branch deleted locally, prior remote feature branch deleted when appropriate, working tree clean, latest architecture document committed, and no temporary runtime/test artifacts remain.

Do not begin a new milestone from an unmerged or dirty prior milestone unless explicitly doing a continuation/fix.

### Step 2 — Review the Build Plan

Identify the exact next milestone and its documented scope. Separate required scope, future milestone scope, unresolved product questions, and cross-cutting invariants that must be preserved.

Do not casually move future milestone work forward.

### Step 3 — Review Relevant Sources

ChatGPT should review canonical core plans relevant to the milestone, latest architecture documents, current code/schema/tests only as necessary, and a prior prompt only if a source ambiguity remains.

### Step 4 — Identify Ambiguities Before Writing the Prompt

Explicitly classify each issue as a source-defined requirement, established implementation behavior, implementation decision left open by the plans, or unresolved conflict requiring owner input.

## 5. Creating the Milestone Codex Prompt

Every full milestone should have a durable prompt stored under:

```text
docs/Plan Docs/milestone-N-codex-prompt.md
```

The prompt should normally contain:

- Objective
- Read First / Source Hierarchy
- Branch and Git Hygiene
- Milestone Scope
- Preserve Existing Behavior
- Non-Negotiable Domain Rules
- Required Initial Analysis
- Functional Requirements
- UI/UX Requirements
- Accessibility and Responsive Behavior
- Testing
- Verification
- Physical Browser Verification
- Documentation
- Out of Scope
- Completion Criteria
- Final Report

### Branch and Git Hygiene

Normally:

```text
git switch main
git pull --ff-only
git switch -c feature/milestone-N
```

Codex may create the milestone branch itself when the prompt says so.

Require work only on the milestone branch and no commit, push, merge, PR, or staging unless explicitly requested. Do not modify planning documents unless the task explicitly requires it.

### Non-Negotiable Domain Rules

Include relevant financial/security rules, such as:

- provider/imported source data remains immutable
- user corrections live in override/local records
- transfers are not income or spending
- credit-card payments are not spending
- pending transactions are not finalized activity
- owner scoping is mandatory
- server-side trust boundaries remain authoritative
- exact monetary arithmetic is preserved
- no real secrets or financial credentials enter source control

### Required Initial Analysis

Require Codex to inspect current implementation reality before coding. Prefer no schema change unless genuinely necessary.

### UI/UX Requirements

New user-facing copy should be written for a normal consumer, not for developers.

Use progressive disclosure:

- primary copy: simple and goal-oriented
- labels: familiar user terminology
- tooltips/help text: short explanation when needed
- technical/provider details: secondary/source information only when useful
- architecture language: documentation, not primary UI copy

Do not expose provider enum/code strings as primary user-facing labels when a deterministic readable display label can safely be derived.

Meaning must never depend on color alone.

### Verification

Typical required gates:

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

Also require the full PostgreSQL-backed suite with the isolated test database and no silent skips when database behavior is affected.

If schema changes, require a forward-only migration, no destructive reset of the development database, and migration/seed verification as appropriate.

### Physical Browser Verification

Require only the flows materially affected by the milestone plus critical regressions. Typical checks include primary feature flow, empty/no-results/error states, mobile layout, keyboard behavior, light/dark rendering where relevant, browser console, owner/session behavior, and provider sync behavior when applicable.

Physical verification should not require exposing credentials. Manual login remains manual.

### Documentation

Create or update:

```text
docs/architecture-milestone-N.md
```

This document must describe final implemented truth, not merely restate the plan.

### Completion Criteria and Final Report

Every required behavior and verification gate must appear in the definition of done.

Require a final report with implementation summary, files changed, source documents reviewed, schema/migration decision, key implementation decisions, tests and exact totals, commands/results, physical verification, defects found/fixed, limitations, unresolved issues/conflicts, secret/security scan result, cleanup result, confirmation nothing was staged/committed/pushed/merged/submitted, and recommendation: ready for review or blocked.

## 6. Starting Codex

Once the milestone prompt exists, the normal ChatGPT kickoff should be short:

```text
Implement Milestone N.

Start by reading docs/Plan Docs/milestone-N-codex-prompt.md and follow the
source hierarchy defined there.

Treat the canonical planning documents, merged architecture documents, and
current implementation as the source of truth.

Do not load prior milestone Codex prompts unless the milestone prompt's source
hierarchy calls for one to resolve a specific ambiguity.

Work only on feature/milestone-N.

If you find a genuine conflict between sources, stop and report it before
implementing.

Do not commit, push, merge, stage files, or open a pull request.
```

Do not paste the entire milestone prompt into Codex chat when the repository file already contains it.

## 7. Resource/Token Discipline

Read by default: current milestone prompt, canonical core plans, merged architecture through the latest milestone, and focused current code/schema/tests.

Do not read by default: every historical milestone Codex prompt, entire Git history, unrelated source directories, unrelated test suites line-by-line, or old logs/completion reports unless resolving an ambiguity.

Context-efficient source reading does not mean weak testing. Codex should still run the full regression suite and required build/quality gates when required.

For large milestones, optionally record:

```text
Starting usage:
Before physical verification:
Final usage:
```

Treat elapsed wall-clock time carefully because inactive periods may inflate it.

## 8. Mid-Milestone Scope Changes

If the owner approves additional features before the milestone is committed/PR'd:

### Small Extension to Current Milestone

If the addition clearly belongs to the current milestone:

1. keep the same feature branch
2. unstage current changes if already staged:
   ```text
   git restore --staged .
   ```
3. update the existing milestone Codex prompt
4. add the new requirements before Completion Criteria
5. expand Completion Criteria
6. give Codex a narrow continuation kickoff
7. update the architecture document
8. rerun affected focused tests plus required full gates
9. rerun affected physical verification
10. review the entire milestone as one final unit

Do not create a new milestone prompt file merely for a small extension.

### Separate Milestone / Follow-up

Create a new milestone or follow-up branch when the change materially expands product scope, belongs to a later planned milestone, changes architecture substantially, makes the current milestone difficult to review coherently, or arrives after the milestone has already merged.

## 9. Reviewing the Codex Completion Report

ChatGPT should review the final report against the current milestone prompt, Completion Criteria, architecture document, source hierarchy, test totals, physical verification, and known financial/security invariants.

Look for scope creep, silently invented behavior, unnecessary schema changes, skipped tests, missing owner isolation, provider-data mutation, financial-semantics regressions, generated artifact pollution, secret leakage, missing responsive/accessibility checks, unperformed physical-test claims, or mismatch between architecture and implementation.

If something is incomplete, send Codex a narrowly scoped follow-up rather than restarting the milestone.

## 10. Owner Manual Testing

After Codex reports PASS, ChatGPT may provide a short owner-facing testing guide focused on what a normal user would do, newly added behavior, visible financial correctness, provider/local override survival when applicable, responsive behavior, and confusing UX/copy the owner may notice.

Manual owner observations may generate current-milestone bug fixes, current-milestone usability refinements, or future UX backlog items.

Avoid turning every UX observation into immediate scope expansion. Decide whether it belongs now or in the planned UX/product-polish milestone.

## 11. Git Review Before Commit

Codex should finish with nothing staged.

First review:

```text
git status
git diff --stat
git diff --check
```

If correct:

```text
git add .
git diff --cached --check
git diff --cached --stat
git status --short
```

Review the complete staged file set before committing.

Windows LF/CRLF conversion warnings are informational unless accompanied by an actual `git diff --check` failure or unintended file normalization.

Do not commit until staged scope matches the milestone, `git diff --cached --check` passes, no unrelated/generated files are staged, and expected planning/architecture docs are included.

## 12. Commit, Push, and Pull Request

After final approval:

```text
git commit -m "Implement Milestone N ..."
git push -u origin feature/milestone-N
```

Then open one milestone PR.

The PR should summarize milestone objective, major implementation areas, schema/migration decision, verification results, test totals, meaningful limitations, physical verification, and documentation added.

Avoid splitting one coherent unmerged milestone into unnecessary follow-up PRs solely because refinement happened before the first commit.

## 13. After Merge

After the milestone PR is merged:

```text
git switch main
git pull --ff-only
git branch -d feature/milestone-N
git status
git push origin --delete feature/milestone-N
```

Verify `main` contains the merge, working tree is clean, local milestone branch is removed, and remote branch is removed when appropriate.

Then the next milestone may begin.

## 14. Architecture Documentation Rule

Every completed milestone should have:

```text
docs/architecture-milestone-N.md
```

Architecture documents are deliberately important because they allow future GPT/Codex sessions to understand what actually shipped without rereading enormous historical prompts.

They should record scope/exclusions, schema/migration decisions, trust boundaries, effective-value/precedence rules, financial/date/status semantics, major data flows, implementation decisions where plans were silent, downstream interactions, UI/accessibility/responsive behavior, test strategy/results, and known limitations.

The architecture document is the compact bridge between milestones.

## 15. Financial and Security Integrity Rules

Unless a canonical product decision explicitly changes them, preserve:

### Financial data

- original provider/imported values remain immutable
- user corrections are stored separately
- local overrides win only where explicitly defined
- exact monetary arithmetic is used
- pending activity is not finalized reporting
- transfers are not spending or income
- credit-card payments are not spending
- refunds follow established reporting semantics
- provider synchronization must not erase local corrections
- historical financial records remain auditable

### Ownership/security

- application remains owner-scoped unless the product plan explicitly changes
- server-side session validation remains authoritative
- browser-provided owner identity is never trusted
- secrets, passwords, Plaid tokens, encryption keys, and session tokens never enter source control, prompts, reports, screenshots, logs, or test fixtures
- `.env` remains ignored
- manual login remains manual
- never ask the owner to paste a password/token into ChatGPT or Codex

## 16. UI/UX Product Rule Going Forward

Until the dedicated cross-app UX/product-polish milestone is reached, every new feature should still follow this baseline rule:

> User-facing language explains what the user can do and what the information means. Technical implementation language belongs in documentation, not primary UI copy.

Prefer `Search your transactions` over `Search normalized retained activity`.

Prefer familiar labels such as `Category` over implementation-oriented terminology unless the distinction is essential to user understanding.

Prefer a tooltip or secondary source section for technical nuance rather than placing it in the primary interface.

Provider-style codes should have deterministic consumer-friendly display formatting where safe, while original source values remain preserved.

This rule prevents UX debt from increasing before the later full-app usability audit.

## 17. Reusable UI Patterns Without Premature Frameworks

When a milestone introduces an interaction that future screens will likely need—such as sortable table headers—prefer a small reusable component/helper, consistent accessibility behavior, consistent URL/state semantics, and documented usage.

Do not create a large generic data-grid/design-system subsystem before multiple real use cases establish the requirements.

Generalize from proven patterns, not hypothetical future needs.

## 18. Development Workflow Expectations

Use the repository's established scripts rather than ad-hoc process management when possible:

```text
pnpm dev:start
pnpm dev:start:plaid
pnpm dev:stop
pnpm dev:doctor
```

The workflow validates prerequisites, starts/reuses PostgreSQL safely, starts the project dev server, optionally starts Plaid/ngrok mode, avoids killing unrelated processes, and leaves Docker/PostgreSQL running on normal `dev:stop`.

Do not silently alter Docker Desktop internal settings or `.env`.

## 19. What a New ChatGPT Session Must Never Assume

A new session must not assume the current branch, that a prior PR merged, that the worktree is clean, that the latest Codex report is still authoritative after new edits, exact schema state, exact test totals, exact filenames when they can be inspected, that a future milestone feature was approved, that an implementation detail from an old prompt is still current, or that a user-facing term is acceptable merely because it exists in current UI.

Verify before acting.

## 20. Milestone Workflow Summary

```text
Prior milestone merged
        ↓
Update main / clean branches
        ↓
Read Build Plan + relevant canonical plans
        ↓
Read merged architecture docs
        ↓
Resolve milestone ambiguities
        ↓
Create milestone Codex prompt
        ↓
Codex creates feature branch
        ↓
Codex implements + tests + documents
        ↓
Codex physical verification
        ↓
ChatGPT reviews report
        ↓
Owner manual QA where useful
        ↓
Small pre-merge refinements if approved
        ↓
Final git diff review
        ↓
Stage once
        ↓
Commit
        ↓
Push
        ↓
PR
        ↓
Merge
        ↓
Update main / delete feature branch
        ↓
Begin next milestone
```

## 21. Recommended Files to Hand to a New GPT Chat

For the smallest reliable context package, provide or point the new chat to:

```text
docs/Plan Docs/gpt-codex-milestone-workflow-sop.md
docs/Plan Docs/build-plan.md
docs/architecture-milestone-<latest-completed>.md
docs/Plan Docs/milestone-<current>-codex-prompt.md   # if in progress
```

If the current milestone implementation has just completed, also provide the latest Codex completion report.

From there, the new chat should retrieve only the additional canonical documents it actually needs.

## 22. Core Principle

> Read the smallest authoritative set of sources needed to understand the work, test the largest relevant behavior surface needed to prove it is safe, and preserve a concise architecture record so the next milestone does not need to rediscover the past.
