# Milestone 2 Data Architecture

Milestone 2 extends the owner-only Milestone 1 foundation with normalized financial persistence. It adds no live integration, calculation, detection, or dashboard behavior.

## Provider-neutral records

`DataSource` describes where data originated without forcing downstream records to understand a provider. `InstitutionConnection` holds optional connection metadata, while normalized `Account`, `Transaction`, investment, recurring, calendar, balance, and import records work for synced, imported, and manual sources. Provider IDs are nullable and unique only in their meaningful context: an item within a provider, or an account/transaction identifier within its source account context. Optional JSON payloads are server-only audit material and must never contain access tokens or credentials.

Fidelity and NetBenefits are not assumed to sync through Plaid. Fidelity positions and transactions can be tagged as imported, and Fidelity account balances and holdings can be manual. The same investment tables can accept a future approved synced provider without changing dashboard-facing concepts.

## Ownership and isolation

Every financial root record has a required `userId` foreign key with an ownership index. `BalanceSnapshot` also has direct ownership in addition to its required account relationship. This lets PostgreSQL remove all owner data in one coordinated cascade while ordinary account deletion remains blocked when historical records exist.

The application remains single-owner: there are no organizations, households, invitations, roles, or sharing tables. Future queries must scope financial roots by the authenticated owner's `userId`; child records reached through an account inherit the same ownership boundary.

## Exact currency and debt representation

Money is stored as PostgreSQL `DECIMAL(19,4)` and exposed as Prisma `Decimal`. This provides 15 whole-number digits and four fractional digits without binary floating-point error. Investment quantities use `DECIMAL(28,10)`, while prices, values, cost bases, balances, limits, fees, and transaction amounts use the money type. Confidence scores use `DECIMAL(5,4)`.

Currency fields are three-character ISO-4217 codes, defaulting to `USD`. Validation of the complete ISO code list belongs at the service boundary in a later milestone. Debt account balances and `ManualAsset` debt values are positive amounts owed. `AccountType` or `isDebt` distinguishes a liability from an asset; Milestone 2 performs no aggregation or sign conversion.

## Original data and overrides

Original provider/imported transaction names, amounts, categories, timestamps, status, IDs, and optional raw JSON remain on `Transaction`. Corrections live one-to-one in `TransactionOverride`. Deleting a source transaction cascades its override; deleting a separately linked reimbursement/refund only nulls that optional link.

Calendar inference is similarly separate from user correction. `RecurringStream` and `CalendarEvent` can retain inferred next/posting dates, while confirmed due dates and user corrections remain distinguishable through date-source fields and `CalendarOverride`. Predicted and confirmed events use separate statuses and can coexist. Deleting a calendar event or recurring stream cascades overrides attached to that source so corrections cannot become orphans.

## Referential actions

- Deleting a user cascades all directly owned local data, including authentication sessions and balance snapshots.
- Deleting an account or data source with historical dependents is blocked by `NO ACTION`; records must be deliberately reassigned or removed first.
- Deleting an institution connection sets the optional link on accounts to null and does not affect manual assets.
- Deleting a transaction cascades its source override and sets optional pending/linked/event references to null where the related record remains meaningful.
- Deleting a recurring stream leaves projected calendar occurrences intact by setting their stream link to null, but deletes overrides whose corrected source is removed.
- Practical uniqueness on `(accountId, capturedAt)` reduces duplicate balance snapshots; investment snapshots are unique by account, source, and as-of timestamp.

`NO ACTION` is deliberate rather than an implicit default: it prevents standalone parent deletion while allowing PostgreSQL to evaluate a complete coordinated owner cascade after all directly owned rows are removed.
