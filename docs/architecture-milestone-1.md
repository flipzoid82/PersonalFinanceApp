# Milestone 1 Architecture

The application uses Next.js App Router and strict TypeScript. All dashboard pages live in the protected `(dashboard)` route group. Its server layout validates an opaque, HTTP-only session cookie against PostgreSQL before rendering any private page.

Authentication is intentionally owner-only. Passwords use Node's scrypt password derivation, raw session tokens never enter the database, and only their HMAC-SHA-256 digests are stored. The Prisma schema contains only `User` and `AuthSession`; financial models remain deferred to Milestone 2.

Server configuration is validated with Zod. Prisma is cached on the development global object to avoid connection proliferation during Next.js hot reloads. UI primitives live under `src/components/ui`, while the responsive application navigation and page shell are reusable components.
