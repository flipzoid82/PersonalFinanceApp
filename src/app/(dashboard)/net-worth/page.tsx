import { NetWorthBreakdown } from "@/components/portfolio/net-worth-breakdown";
import { NetWorthHistory } from "@/components/portfolio/net-worth-history";
import { PortfolioSummary } from "@/components/portfolio/portfolio-summary";
import { Card } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { getPortfolioViewModel } from "@/lib/portfolio/server";
import { parseNetWorthRange } from "@/lib/portfolio";

export default async function NetWorthPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const user = await requireUser();
  const now = new Date();
  const range = parseNetWorthRange((await searchParams).range);
  const portfolio = await getPortfolioViewModel(user.id, now, range);
  return (
    <div className="mx-auto max-w-7xl">
      <p className="text-sm font-semibold text-[var(--semantic-positive-text)]">
        Net-worth overview
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">Net Worth</h1>
      <p className="mt-2 max-w-3xl text-[var(--text-secondary)]">
        Latest authoritative assets and investments minus active debts, with
        source, freshness, and calculation precedence shown for every value.
      </p>
      <PortfolioSummary portfolio={portfolio} context="net-worth" />
      {portfolio.isEmpty ? (
        <Card className="mt-8 p-8 text-center">
          <h2 className="text-xl font-bold">No net-worth records available</h2>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            Add a manual account, asset, debt, or investment to begin. Missing
            values are not treated as zero.
          </p>
        </Card>
      ) : (
        <>
          <NetWorthHistory history={portfolio.netWorthHistory} />
          <NetWorthBreakdown portfolio={portfolio} now={now} />
        </>
      )}
    </div>
  );
}
