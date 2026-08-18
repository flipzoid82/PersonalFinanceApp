import { AccountList } from "@/components/portfolio/account-list";
import { PortfolioFeedback } from "@/components/portfolio/feedback";
import {
  FidelityTemplateLinks,
  InvestmentSnapshots,
} from "@/components/portfolio/investment-details";
import {
  InvestmentComposition,
  InvestmentContributions,
  InvestmentHoldings,
} from "@/components/portfolio/investment-overview";
import { ManualAccountForm } from "@/components/portfolio/manual-account-form";
import { PortfolioSummary } from "@/components/portfolio/portfolio-summary";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { requireUser } from "@/lib/auth";
import { fidelityTemplate } from "@/lib/portfolio";
import { getPortfolioViewModel } from "@/lib/portfolio/server";

export default async function InvestmentsPage({
  searchParams,
}: {
  searchParams: Promise<{
    template?: string;
    message?: string;
    error?: string;
  }>;
}) {
  const user = await requireUser();
  const now = new Date();
  const params = await searchParams;
  const portfolio = await getPortfolioViewModel(user.id, now);
  const template = fidelityTemplate(params.template);
  return (
    <div className="mx-auto max-w-7xl">
      <p className="text-sm font-semibold text-[var(--semantic-investment-text)]">
        Investment overview
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">Investments</h1>
      <p className="mt-2 max-w-3xl text-[var(--text-secondary)]">
        See how much is in your brokerage and retirement accounts, where it is
        held, what holdings are known, and when each value was updated.
      </p>
      <PortfolioFeedback message={params.message} error={params.error} />
      <PortfolioSummary portfolio={portfolio} context="investments" />

      <section aria-labelledby="investment-accounts-title" className="mt-8">
        <h2 id="investment-accounts-title" className="text-xl font-bold">
          Where your investments are
        </h2>
        <div className="mt-4">
          <AccountList
            accounts={portfolio.investmentAccounts}
            now={now}
            returnTo="/investments"
            investmentsOnly
          />
        </div>
      </section>

      <InvestmentComposition insights={portfolio.investmentInsights} />
      <InvestmentHoldings insights={portfolio.investmentInsights} now={now} />
      <InvestmentContributions insights={portfolio.investmentInsights} />

      <InvestmentSnapshots accounts={portfolio.investmentAccounts} now={now} />

      <Card id="add-investment" className="mt-8 scroll-mt-24 p-5 sm:p-6">
        <h2 className="text-xl font-bold">Add manual investment account</h2>
        <div className="mt-4">
          <FidelityTemplateLinks selected={template?.id} />
        </div>
        {template ? (
          <Notice tone="info" role="status" className="mt-4">
            {template.label} metadata is prefilled below and remains editable.
            No credentials or connection are involved.
          </Notice>
        ) : null}
        <div className="mt-5">
          <ManualAccountForm
            returnTo="/investments"
            investmentOnly
            template={template}
          />
        </div>
      </Card>
    </div>
  );
}
