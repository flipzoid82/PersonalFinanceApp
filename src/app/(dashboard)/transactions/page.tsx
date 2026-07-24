import { TransactionStatus } from "@prisma/client";
import { Card } from "@/components/ui/card";
import { SemanticBadge, SemanticValue } from "@/components/ui/semantic";
import { requireUser } from "@/lib/auth";
import {
  formatCurrency,
  formatDate,
  titleCaseEnum,
} from "@/lib/dashboard/formatters";
import { db } from "@/lib/db";

export default async function TransactionsPage() {
  const owner = await requireUser();
  const transactions = await db.transaction.findMany({
    where: { userId: owner.id, account: { userId: owner.id } },
    select: {
      id: true,
      originalName: true,
      merchantName: true,
      amount: true,
      currency: true,
      authorizedAt: true,
      postedAt: true,
      status: true,
      providerCategory: true,
      removedAt: true,
      account: {
        select: {
          name: true,
          source: true,
          institutionConnection: { select: { provider: true } },
        },
      },
      override: {
        select: {
          merchantNameOverride: true,
          categoryOverride: true,
        },
      },
    },
    orderBy: [{ postedAt: "desc" }, { authorizedAt: "desc" }],
    take: 100,
  });

  return (
    <div className="mx-auto max-w-7xl">
      <p className="text-sm font-semibold text-[var(--semantic-info-text)]">
        Milestone 6 · Normalized activity
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">Transactions</h1>
      <p className="mt-2 max-w-3xl text-[var(--text-secondary)]">
        Read-only normalized activity from manual, imported, and Plaid Sandbox
        sources. Editing and categorization remain outside this milestone.
      </p>

      {!transactions.length ? (
        <Card className="mt-6 p-6">
          <p className="font-semibold">No transactions yet</p>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            Connect a Plaid Sandbox institution or keep using manual portfolio
            records. Missing activity is never represented as zero.
          </p>
        </Card>
      ) : (
        <Card className="mt-6 overflow-hidden">
          <ul className="divide-y" aria-label="Transactions">
            {transactions.map((transaction) => {
              const name =
                transaction.override?.merchantNameOverride ??
                transaction.merchantName ??
                transaction.originalName;
              const category =
                transaction.override?.categoryOverride ??
                transaction.providerCategory ??
                "Uncategorized";
              const date = transaction.postedAt ?? transaction.authorizedAt;
              const isRemoved = Boolean(transaction.removedAt);
              return (
                <li
                  key={transaction.id}
                  className="grid gap-3 p-4 sm:grid-cols-[1fr_auto] sm:p-5"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-semibold">{name}</p>
                      <SemanticBadge
                        tone={
                          isRemoved
                            ? "muted"
                            : transaction.status === TransactionStatus.PENDING
                              ? "warning"
                              : "info"
                        }
                      >
                        {isRemoved
                          ? "Removed by provider"
                          : titleCaseEnum(transaction.status)}
                      </SemanticBadge>
                      {transaction.account.institutionConnection?.provider ===
                      "PLAID" ? (
                        <SemanticBadge tone="info">Plaid Sandbox</SemanticBadge>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm text-[var(--text-secondary)]">
                      {transaction.account.name} · {category}
                      {date ? ` · ${formatDate(date)}` : ""}
                    </p>
                  </div>
                  <p className="sm:text-right">
                    <SemanticValue
                      tone={isRemoved ? "muted" : "negative"}
                      label="Transaction amount"
                    >
                      {formatCurrency(
                        transaction.amount.abs(),
                        transaction.currency,
                      )}
                    </SemanticValue>
                  </p>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
