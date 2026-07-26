import { AccountList } from "@/components/portfolio/account-list";
import { PortfolioFeedback } from "@/components/portfolio/feedback";
import { ManualAccountForm } from "@/components/portfolio/manual-account-form";
import {
  CreateManualAssetForm,
  ManualAssetList,
} from "@/components/portfolio/manual-asset-list";
import { PortfolioSummary } from "@/components/portfolio/portfolio-summary";
import { PlaidConnectionManager } from "@/components/plaid/connection-manager";
import { Card } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { getPortfolioViewModel } from "@/lib/portfolio/server";

export default async function AccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; error?: string }>;
}) {
  const user = await requireUser();
  const now = new Date();
  const [portfolio, feedback] = await Promise.all([
    getPortfolioViewModel(user.id, now),
    searchParams,
  ]);
  const visibleAccounts = portfolio.accounts.filter(
    (account) =>
      account.institutionConnection?.provider !== "PLAID" ||
      account.institutionConnection.status !== ConnectionStatus.DISCONNECTED,
  );
  return (
    <div className="mx-auto max-w-7xl">
      <p className="text-sm font-semibold text-[var(--semantic-info-text)]">
        Milestone 5 · Manual and normalized data
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">Accounts</h1>
      <p className="mt-2 max-w-3xl text-[var(--text-secondary)]">
        Review source-aware balances and manage manual accounts, property,
        vehicles, loans, debts, and chronological balance snapshots.
      </p>
      <PortfolioFeedback {...feedback} />
      <PortfolioSummary portfolio={portfolio} />
      <PlaidConnectionManager ownerId={user.id} now={now} />

      <section aria-labelledby="accounts-title" className="mt-8">
        <h2 id="accounts-title" className="text-xl font-bold">
          Financial accounts
        </h2>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          Current connected accounts and manual records appear here. Retained
          disconnected Plaid identities are listed under their historical
          institution cards and never contribute to totals.
        </p>
        <div className="mt-4">
          <AccountList accounts={visibleAccounts} now={now} />
        </div>
      </section>

      <section aria-labelledby="manual-assets-title" className="mt-8">
        <h2 id="manual-assets-title" className="text-xl font-bold">
          Manual assets and debts
        </h2>
        <div className="mt-4">
          <ManualAssetList assets={portfolio.manualAssets} now={now} />
        </div>
      </section>

      <section
        aria-labelledby="add-account-title"
        className="mt-8 grid items-start gap-4 xl:grid-cols-2"
      >
        <Card className="p-5 sm:p-6">
          <details>
            <summary
              id="add-account-title"
              className="cursor-pointer text-lg font-bold"
            >
              Add manual account
            </summary>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              Supports checking, savings, credit cards, loans, mortgages, and
              other manual asset or debt accounts.
            </p>
            <div className="mt-5">
              <ManualAccountForm returnTo="/accounts" />
            </div>
          </details>
        </Card>
        <Card className="p-5 sm:p-6">
          <details>
            <summary className="cursor-pointer text-lg font-bold">
              Add manual asset or debt
            </summary>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              Use this for homes, real estate, vehicles, private assets,
              mortgages, and personal or student loans.
            </p>
            <div className="mt-5">
              <CreateManualAssetForm />
            </div>
          </details>
        </Card>
      </section>
    </div>
  );
}
import { ConnectionStatus } from "@prisma/client";
