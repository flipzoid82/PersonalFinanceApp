# Milestone 7.5 Codex Prompt — Session Security Hardening

## Objective

Implement Milestone 7.5: server-enforced session lifecycle hardening for the owner-only personal finance application.

This milestone must add:

- idle session expiration
- absolute session expiration
- an accessible pre-expiration warning
- safe session renewal
- immediate server-side revocation on logout or timeout
- cross-tab coordination
- complete regression coverage for all protected routes

Do not start Milestone 8.

## Read First

Before editing, read:

- every document under `docs/Plan Docs/`
- the current authentication and session implementation
- `proxy.ts`
- login, logout, recovery, and protected-layout code
- Prisma schema and migrations
- owner creation and seed behavior
- all authentication, proxy, layout, and route-protection tests
- README and architecture documents
- the merged Milestone 7 implementation and Git history

Treat the repository and planning documents as the source of truth.

If this prompt conflicts with existing product requirements or security behavior, stop and report the conflict before changing code.

## Branch and Git Hygiene

Start from updated `main`:

```text
git switch main
git pull --ff-only
git switch -c feature/milestone-7-5
```

Work only on:

```text
feature/milestone-7-5
```

Do not commit, stage, push, or open a pull request unless explicitly instructed.

Do not modify Milestone 8 or later functionality.

## Security Policy

Use centralized configuration for these defaults:

```text
Idle timeout:            15 minutes
Warning threshold:        2 minutes before idle expiry
Absolute timeout:         8 hours
Activity write throttle: 60 seconds
```

Requirements:

1. The server is authoritative for session validity.
2. The client countdown is advisory UI only.
3. Every protected server request must reject an expired or revoked session.
4. Idle timeout and absolute timeout are independent.
5. User activity may extend the idle deadline but must never extend the absolute deadline.
6. Successful full reauthentication may create a new session with new idle and absolute deadlines.
7. Logout must revoke the current session server-side and clear the cookie.
8. Timeout must revoke or expire the current session server-side and clear the cookie at the next response.
9. An expired session cookie must never regain validity.
10. Background polling, prefetching, health checks, page visibility events, or automated requests must not keep a session alive indefinitely.
11. Session tokens, cookie values, hashes, and authentication secrets must never be logged or exposed to the browser.
12. Existing owner-only behavior must remain intact.

Keep timeout values centralized and overridable through safe server-side environment configuration for tests and future deployment.

## Required Initial Analysis

Before implementation, inspect and document:

1. whether the current session is self-contained, database-backed, or hybrid
2. how session identifiers are generated, stored, signed, hashed, validated, and revoked
3. current cookie attributes
4. current login and logout behavior
5. current session expiration behavior
6. how `proxy.ts` and server-side route protection validate sessions
7. whether server actions and API routes share the same validation path
8. whether any background requests currently refresh session state
9. whether a schema migration is necessary
10. the safest design for immediate revocation and server-enforced idle expiration

Prefer the smallest secure architecture.

Do not add a database-backed session table merely for convenience if the current architecture can safely support idle expiration, absolute expiration, and revocation. However, if the current session is a self-contained cookie or token that cannot be immediately revoked or safely track server-side inactivity, add a database-backed session model.

Report the schema decision before implementing.

## Recommended Session Model

If a database-backed session is required, use a model equivalent to:

```text
Session
- id
- userId
- tokenHash
- createdAt
- authenticatedAt
- lastActivityAt
- idleExpiresAt
- absoluteExpiresAt
- revokedAt
- revocationReason
```

Do not store the raw session token.

Requirements:

- generate a cryptographically random bearer token
- store only a secure hash of the token
- use constant-time comparison where applicable
- scope every session lookup to the owner
- add indexes for token hash, owner, expiry, and revocation as required
- add a forward-only migration
- preserve existing owner data
- invalidate legacy sessions safely during rollout if they cannot be migrated securely
- document any one-time forced re-login caused by the migration

Do not add device fingerprinting, geolocation tracking, or invasive telemetry.

## Session Creation

On successful login:

- validate the owner credentials using the existing password flow
- generate a new unpredictable session token
- rotate away any pre-authentication or previous session identifier
- store server-side session metadata
- set idle and absolute expiration
- issue a hardened cookie
- never expose session metadata unnecessarily to client JavaScript
- redirect to the intended protected destination safely
- prevent open redirects

Do not implement “remember me.”

## Cookie Requirements

Ensure the session cookie uses:

- `HttpOnly`
- `Secure` in HTTPS environments
- appropriate `SameSite`
- path scoped to `/` unless a narrower safe scope is practical
- no sensitive payload beyond the session token
- explicit expiration aligned with the absolute session lifetime
- deletion with matching name, path, domain, and security attributes
- localhost development behavior without weakening production settings

Do not expose the cookie to client JavaScript.

## Session Validation

Create one authoritative server-side validation path used by:

- protected pages
- protected layouts
- server actions
- API routes
- Plaid endpoints
- recurring detection actions
- manual data mutations
- logout
- session renewal

Validation must reject sessions that are:

- unknown
- malformed
- hash mismatched
- revoked
- idle-expired
- absolute-expired
- associated with a missing or inactive owner
- otherwise invalid under the existing auth model

When invalid:

- do not refresh activity
- revoke or mark expired where appropriate
- clear the cookie when possible
- redirect browser page requests to `/login?reason=expired` for expiration
- return a safe unauthorized response for API requests
- never leak the exact internal validation reason to an attacker
- preserve a generic user-facing distinction between “expired” and “invalid credentials” only where safe

## Idle Activity Semantics

Do not treat every request as meaningful activity.

Meaningful activity may include:

- authenticated page navigation initiated by the user
- authenticated form submission
- explicit “Stay signed in”
- user-initiated refresh
- user-initiated Plaid actions
- other authenticated mutations or navigations clearly caused by the owner

Do not automatically refresh idle activity for:

- framework prefetch requests
- background polling
- webhook traffic
- server-to-server Plaid callbacks
- static asset requests
- browser visibility checks
- health checks
- analytics
- automated countdown polling
- passive client heartbeat requests without recent user activity

Client-side interaction events may update the warning UI’s local understanding of recent activity, but they must not directly grant a new server deadline.

Use a throttled server activity update so rapid navigation or repeated actions do not write to the database on every request. Default throttle: 60 seconds.

Document exactly which requests update `lastActivityAt`.

## Absolute Timeout

The absolute deadline must be fixed when the session is created.

Requirements:

- ordinary activity cannot extend it
- “Stay signed in” cannot extend it
- only successful reauthentication can start a new absolute lifetime
- when reached, the session terminates even if the owner is active
- the warning UI must distinguish idle expiry from absolute expiry if the distinction affects available actions
- if the absolute deadline is too close to renew safely, require login rather than claiming the session was extended

## Session Status Endpoint

Add a minimal protected endpoint or server action that returns only what the warning UI needs:

```text
serverNow
idleExpiresAt
absoluteExpiresAt
warningThresholdSeconds
status
```

Requirements:

- no session token
- no user financial data
- no internal hashes
- no provider identifiers
- no unnecessary user profile data
- response must not itself extend idle activity
- safe cache-control headers
- owner-scoped validation

Prefer server timestamps over the browser clock.

## Stay Signed In

The warning dialog’s “Stay signed in” action must:

- be explicit user activity
- call a protected server endpoint or action
- validate the current session
- reject revoked or expired sessions
- extend only the idle deadline
- preserve the absolute deadline
- return updated server timestamps
- close the dialog only after successful renewal
- redirect to login if renewal fails
- avoid duplicate concurrent renewals
- remain idempotent where practical

Do not silently extend the session just because the dialog appeared.

## Warning Dialog

Add an accessible modal warning before idle expiration.

Suggested text:

```text
Are you still there?

For your security, you will be signed out in 01:59 due to inactivity.

[Stay signed in] [Sign out now]
```

Requirements:

- appears approximately two minutes before idle expiry
- countdown is based on server-provided expiry
- updates accurately after sleep/wake and tab restoration
- “Stay signed in” is the primary action
- “Sign out now” immediately revokes the session
- dialog has a clear accessible name and description
- focus moves into the dialog
- focus is trapped appropriately
- focus returns safely if the session is renewed
- Escape must not silently extend the session
- countdown must not be announced every second
- announce meaningful thresholds using a polite live region
- status meaning must not rely on color
- usable at 375×812
- works in light and dark rendering
- no horizontal overflow
- no background interaction while modal

If absolute timeout is the earlier deadline, the dialog must not offer an action that falsely promises extension beyond it.

## Sleep, Wake, and Clock Changes

Handle:

- laptop sleep
- browser suspension
- background tab throttling
- device clock changes
- restoring a tab after the deadline

On `visibilitychange`, window focus, page restoration, and network reconnection, reconcile with the server.

Do not trust elapsed `setInterval` ticks as the source of truth.

If the server says the session expired, immediately transition to login.

## Cross-Tab Coordination

Use `BroadcastChannel`, with a safe fallback only if necessary.

Coordinate:

- logout
- timeout
- successful idle renewal
- warning visibility
- new session/login where appropriate

Requirements:

- logout in one tab signs out all tabs for that session
- renewal in one tab updates the countdown in other tabs
- an expired tab cannot resurrect the session
- cross-tab messages contain no session token or sensitive data
- server validation remains authoritative
- stale or forged cross-tab messages cannot create a valid session
- handle browsers without `BroadcastChannel`

Do not implement a device/session management dashboard.

## Logout

Current-session logout must:

- revoke the server-side session
- record a non-sensitive reason such as `USER_LOGOUT`
- clear the cookie
- broadcast logout to other tabs
- redirect to `/login`
- make the old cookie unusable for pages, actions, and API routes
- remain safe if called more than once
- work when the session is already expired
- never log the session token

## Expiration Redirect

Use:

```text
/login?reason=expired
```

Suggested message:

```text
Your session expired for your security. Please sign in again.
```

Requirements:

- do not reveal internal security details
- avoid redirect loops
- ignore unsafe redirect destinations
- invalid credentials must continue to use the existing generic error
- explicit logout must not show an expiration message

## Unsaved Work

The warning should give the owner time to finish or save work.

Requirements:

- do not silently submit forms
- do not store passwords or sensitive form contents in local storage
- do not implement broad draft persistence
- document that unsaved changes may be lost
- ensure the warning appears above forms and dialogs
- verify destructive confirmation dialogs do not conflict with the timeout modal

## Cleanup and Audit

Add safe cleanup for expired and revoked sessions without running expensive cleanup on every request.

Record only minimal security events if the architecture supports it:

- login success
- login failure without password values
- logout
- idle expiration
- absolute expiration
- renewal
- revocation

Never log raw session tokens, cookies, passwords, Plaid secrets, access tokens, encryption keys, or financial data.

## UI Scope

Allowed:

- global session timeout controller
- accessible warning dialog
- expiration message on login
- minimal timeout-policy copy in Settings
- safe development-only timeout overrides

Not allowed:

- MFA
- passkeys
- biometrics
- remembered devices
- sign out all devices
- session/device management UI
- login history UI
- geolocation alerts
- password-change workflow
- user-configurable timeout duration
- Milestone 8 transaction functionality

## Tests

Add unit, integration, and component tests covering at least:

### Session lifecycle

1. successful login creates a server session
2. raw token is not stored
3. token hash lookup works
4. cookie is hardened
5. idle deadline is initialized
6. absolute deadline is fixed
7. login rotates the identifier
8. owner scoping
9. valid session accepted
10. unknown or malformed token rejected
11. revoked session rejected
12. idle-expired session rejected
13. absolute-expired session rejected
14. expired session cannot access pages, actions, or APIs
15. stale cookie cannot regain validity

### Activity and renewal

16. meaningful activity extends idle deadline
17. activity never extends absolute deadline
18. write throttling prevents excessive updates
19. background status checks do not extend idle deadline
20. prefetch does not extend idle deadline
21. webhook traffic does not extend owner sessions
22. explicit renewal succeeds
23. renewal after idle expiry fails
24. renewal after absolute expiry fails
25. concurrent renewal remains consistent
26. renewal in one tab updates another

### Logout and warning UI

27. logout revokes the server session
28. logout clears the cookie
29. old cookie fails after logout
30. duplicate logout is safe
31. logout in one tab affects another
32. timeout shows the expiration message
33. explicit logout does not show the expiration message
34. warning appears at the configured threshold
35. countdown uses server time
36. Stay signed in renews safely
37. failed renewal redirects to login
38. Sign out now revokes immediately
39. dialog is keyboard accessible
40. focus is trapped and restored safely
41. live-region behavior avoids every-second announcements
42. warning works at 375×812
43. warning works in light and dark rendering
44. wake after expiry redirects immediately

### Regression

45. valid owner login remains correct
46. invalid login remains generic
47. forgot-password placeholder remains honest
48. owner:create remains correct
49. every dashboard route remains protected
50. Plaid Link actions remain protected
51. Plaid webhook remains independent of browser sessions
52. recurring detection remains protected
53. manual financial-data mutations remain protected
54. all Milestone 1–7 pages load for a valid session
55. no Milestone 8 functionality is added
56. migration replay and seed idempotency
57. no database tests are silently skipped

Use short timeout overrides in tests instead of waiting real minutes or hours.

## Physical Verification

Physically verify:

1. valid and invalid login
2. warning appears using shortened development-only values
3. countdown decreases correctly
4. Stay signed in extends idle expiry only
5. absolute expiry remains unchanged
6. Sign out now works
7. inactivity causes automatic logout
8. `/login?reason=expired` appears
9. old tabs cannot continue after expiry
10. protected routes and actions reject expired sessions
11. cross-tab warning, renewal, and logout
12. sleep/wake or suspended-tab behavior
13. offline during warning and reconnect after expiry
14. 375×812 layout
15. light and dark rendering
16. keyboard-only dialog use
17. browser console is clean
18. no session value appears in DOM, local storage, session storage, responses, or logs
19. Plaid webhook still works without a browser session
20. all protected routes redirect after logout

Do not expose the owner password or session token during verification.

## Required Commands

Run and pass:

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

Also:

- run the full PostgreSQL-backed suite with `TEST_DATABASE_URL`
- ensure no database tests are skipped
- replay all migrations if schema changes
- run seed twice
- scan for session tokens, credentials, keys, passwords, and personal data
- inspect cookies and headers without reporting secret values
- inspect the browser console
- remove temporary files and restore unrelated generated changes
- confirm no Milestone 8 code was added

## Documentation

Update README with:

- idle timeout
- warning threshold
- absolute timeout
- server-authoritative expiration
- renewal behavior
- logout behavior
- cross-tab behavior
- expiration redirect
- cookie security
- environment configuration
- development/testing overrides
- limitations
- future security scope

Create:

```text
docs/architecture-milestone-7-5.md
```

Document the session architecture, schema decision, token hashing, cookie configuration, validation flow, timeout rules, activity semantics, throttling, status and renewal flow, warning UI, clock reconciliation, cross-tab coordination, logout and revocation, cleanup, errors, accessibility, tests, limitations, and confirmation that Milestone 8 was not started.

## Completion Criteria

Milestone 7.5 is complete only when:

- session expiration is enforced server-side
- idle and absolute deadlines are independent
- passive requests cannot keep the session alive
- logout and timeout invalidate the session server-side
- the warning dialog is accessible and accurate
- Stay signed in extends only idle expiration
- cross-tab logout and renewal work
- sleep/wake reconciles with the server
- expired sessions cannot access any protected page, action, or API
- all Milestone 1–7 functionality remains intact
- migrations, seed, PostgreSQL tests, lint, typecheck, format, and build pass
- light, dark, mobile, and console verification pass
- no secrets or private data are introduced
- Milestone 8 is not started

## Final Report

Stop and report:

1. overall PASS or BLOCKED
2. implementation summary
3. files changed
4. prior and new session architecture
5. schema and migration decision
6. token storage and hashing
7. cookie attributes
8. idle and absolute timeout behavior
9. meaningful activity and throttling rules
10. renewal behavior
11. warning-dialog behavior
12. cross-tab behavior
13. sleep/wake handling
14. logout and revocation
15. expiration redirect
16. cleanup and audit behavior
17. error handling
18. test files and totals
19. migration and seed results
20. physical flows tested
21. accessibility, responsive, light, and dark results
22. browser-console results
23. security and secret-scan results
24. limitations and environmental exceptions
25. defects found and fixed
26. assumptions
27. confirmation temporary files were removed
28. confirmation nothing was staged, committed, pushed, or submitted
29. confirmation Milestone 8 was not started
30. final recommendation: ready for PR or not ready for PR
