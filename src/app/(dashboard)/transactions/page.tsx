import { TransactionLedger } from "@/components/transactions/transaction-ledger";
import { requireUser } from "@/lib/auth";
import type { TransactionSearchParams } from "@/lib/transactions/filters";
import { getTransactionLedger } from "@/lib/transactions/queries";

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams?: Promise<TransactionSearchParams>;
} = {}) {
  const owner = await requireUser();
  const ledger = await getTransactionLedger(
    owner.id,
    (await searchParams) ?? {},
  );

  return (
    <div className="mx-auto max-w-7xl">
      <p className="text-sm font-semibold text-[var(--semantic-info-text)]">
        Milestone 8 · Transactions and local corrections
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">Transactions</h1>
      <p className="mt-2 max-w-3xl text-[var(--text-secondary)]">
        Review normalized activity, search and filter retained history, and
        apply owner-local corrections without changing institution data.
      </p>
      <TransactionLedger ledger={ledger} />
    </div>
  );
}
