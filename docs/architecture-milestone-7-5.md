# Milestone 7.5 session security architecture

## Decision and lifecycle model

Milestone 7.5 extends the existing PostgreSQL-backed `AuthSession` model rather
than replacing it. The previous implementation already had the correct
owner-to-session relationship and stored only a token digest, but its single
30-day expiration timestamp could not represent inactivity, absolute lifetime,
activity throttling, or revocation history.

Each session now records:

- an HMAC-SHA-256 token digest and owner foreign key
- authentication and last-meaningful-activity timestamps
- independent idle and absolute expiration timestamps
- nullable revocation timestamp and minimal reason
- creation and update timestamps

The forward-only migration renames the old expiration column to the absolute
deadline and adds the lifecycle fields and query indexes. An old session cannot
be assigned a trustworthy recent-activity timestamp. The migration therefore
preserves every old row, marks it `LEGACY_MIGRATION`, and requires a one-time
fresh login. No authentication history is silently deleted.

## Token and cookie handling

Login generates 256 random bits and encodes them as a 43-character base64url
token. Only an HMAC-SHA-256 digest keyed by `AUTH_SECRET` is stored. Token
shape is checked before database lookup, and neither the raw token nor its
cookie is logged.

The cookie is `HttpOnly`, `SameSite=Lax`, available at `/`, and `Secure` in
production. Its browser expiration is the absolute session deadline. Logout
and the public session-ending redirect expire it with the same path and
security attributes. A successful login revokes the session represented by
the incoming cookie before issuing a new token, preventing session fixation.

Expiration also sets a five-minute, non-sensitive HttpOnly marker containing
only the value `1`. It carries no session identifier, owner data, or deadline.
The proxy uses it solely to preserve `/login?reason=expired` after the bearer
cookie has been cleared or another tab races a protected request. Successful
login, explicit logout, and generic invalid-session cleanup remove the marker.

## Authoritative validation

All page layouts, server actions, and owner-facing Plaid APIs use the same
database validator. Cookie presence in the Next.js proxy is only an early
unauthenticated-navigation check; it never grants access. The validator:

1. validates token shape and hashes it;
2. loads the owner-linked session by its digest;
3. preserves idle or absolute status for rows revoked by expiration and
   rejects every other revoked row;
4. enforces absolute expiration before idle expiration;
5. atomically records the corresponding timeout revocation; and
6. returns owner identity only for an active row.

Protected page failures pass through `/api/session/end`, which clears an
invalid cookie before redirecting to `/login` or
`/login?reason=expired`. Owner APIs return a generic `401` without exposing
session internals. Server actions cannot proceed after expiry. The verified
Plaid webhook stays public and performs its existing provider-signature
validation independently; webhook work never counts as owner activity.

## Timeout and activity semantics

The default idle timeout is 15 minutes, the warning threshold is two minutes,
the absolute lifetime is eight hours, and meaningful-activity writes are
throttled to once per 60 seconds. Environment overrides are validated
centrally at startup. The absolute deadline is fixed at authentication.

Meaningful activity is deliberately narrow:

- trusted, same-origin dashboard navigation
- authenticated owner mutations through server actions
- authenticated owner-initiated Plaid API operations
- an explicit “Stay signed in” request

Rendering, status requests, browser prefetch, polling, focus checks, background
Plaid work, and webhooks are passive and cannot move a deadline. Throttled
activity avoids a write for every click. The atomic update also checks
revocation and both deadlines; if a concurrent logout or timeout wins, the
request revalidates and is denied.

Renewal sets the idle deadline to the earlier of “now plus idle timeout” and
the original absolute deadline. It never rotates or extends the absolute
deadline and fails after either expiration.

## Status, warning, and clock reconciliation

`GET /api/session/status` is passive and returns only server time, idle and
absolute deadlines, warning threshold, renewal availability, and a safe
status. Responses are not cached. The browser computes an offset from server
time, uses the earlier deadline, and treats its countdown as advisory.

The global warning is an `alertdialog` above dashboard and destructive-dialog
layers. It has an accessible name and description, initial focus, a trapped
focus loop, an assertive live region limited to useful thresholds, and
touch-sized actions. Escape does not close, renew, or otherwise hide the
deadline. The copy distinguishes an idle warning from an absolute limit,
mentions possible loss of unsaved work, and removes renewal when the absolute
deadline is controlling. Its narrow layout scrolls within a 375×812 viewport
and uses existing light/dark semantic colors.

Focus, visible-tab, `pageshow`, `online`, and browser-wake effects all fetch
fresh server state. A tab that sleeps or goes offline cannot extend its own
session and is redirected after reconciliation if the server deadline passed.

## Cross-tab behavior

Tabs exchange only the event kinds `warning`, `renewed`, `logout`, and
`expired`, with a random message identifier. `BroadcastChannel` is preferred;
a short-lived `localStorage` event is the fallback. Messages contain no token,
owner information, financial information, or deadline authority.

Renewal and warning messages trigger server reconciliation. Logout and
expiration messages navigate through the server-owned session-ending route,
which clears the cookie and safely confirms the resulting signed-out state. A
stale or forged message can force a fresh sign-in but cannot create or renew a
session.

## Revocation, cleanup, and errors

Explicit logout records `USER_LOGOUT`; new authentication records
`REAUTHENTICATED` on the prior session; validation records `IDLE_TIMEOUT` or
`ABSOLUTE_TIMEOUT`; migration records `LEGACY_MIGRATION`. These rows provide
the minimal audit trail without recording secrets or financial data.

Expired and revoked rows are retained for 30 days. Cleanup occurs during
successful session creation, not on every protected request. Invalid login
continues to use the same generic credential error. Timeout uses a generic
security message, while explicit logout returns to plain `/login`.

## Test strategy and limitations

Unit and component tests cover digest-only storage, cookie attributes,
rotation, idle and absolute precedence, activity throttling, renewal capping,
revocation, safe status metadata, protected-route coverage, expiration
messaging, warning accessibility, focus trapping, Escape behavior, and
absolute-limit copy. The PostgreSQL suite and migration replay cover the
schema together with all Milestone 1–7 behavior.

This milestone does not add MFA, passkeys, remembered devices, sign-out-all,
device/session management, login history, geolocation alerts, password
changes, user-configurable timeouts, or any Milestone 8 transaction feature.
