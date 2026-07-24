# Milestone 1 Architecture

The application uses Next.js App Router and strict TypeScript. All dashboard pages live in the protected `(dashboard)` route group. Its server layout validates an opaque, HTTP-only session cookie against PostgreSQL before rendering any private page.

Authentication is intentionally owner-only. Passwords use Node's scrypt password derivation, raw session tokens never enter the database, and only their HMAC-SHA-256 digests are stored. The Prisma schema contains only `User` and `AuthSession`; financial models remain deferred to Milestone 2.

Dashboard protection is enforced twice on the server. `src/proxy.ts` rejects requests without the opaque session cookie before a dashboard route renders, while the `(dashboard)` server layout validates that cookie against a current `AuthSession` record in PostgreSQL. A missing, unknown, or expired session therefore redirects to `/login`; cookie presence alone never authenticates an owner.

Password recovery is intentionally not configured yet. The visible recovery page does not collect an email, recovery answer, or replacement password. A future secure implementation must create a cryptographically random single-use token, store only its digest, expire it quickly, and deliver the reset link only to the verified owner email. Request responses must remain generic to avoid account enumeration, requests and attempts must be rate-limited, successful reset must invalidate every existing owner session, and reset events should be auditable. Security questions must not be used as the sole identity check.

Server configuration is validated with Zod. Prisma is cached on the development global object to avoid connection proliferation during Next.js hot reloads. UI primitives live under `src/components/ui`, while the responsive application navigation and page shell are reusable components.
