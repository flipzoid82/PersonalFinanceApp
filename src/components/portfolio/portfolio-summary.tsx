import {
  AlertTriangle,
  CircleDollarSign,
  Landmark,
  Wallet,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { SemanticBadge, SemanticValue } from "@/components/ui/semantic";
import { formatCurrency } from "@/lib/dashboard/formatters";
import type { PortfolioViewModel } from "@/lib/portfolio";

export function PortfolioSummary({
  portfolio,
  context = "portfolio",
}: {
  portfolio: PortfolioViewModel;
  context?: "portfolio" | "investments" | "net-worth";
}) {
  const metrics =
    context === "investments"
      ? [
          {
            label: "Investment value",
            value: portfolio.totalInvestments,
            tone: "investment" as const,
            icon: Landmark,
          },
          {
            label: "Active investment accounts",
            text: String(
              portfolio.investmentAccounts.filter(({ isActive }) => isActive)
                .length,
            ),
            tone: "investment" as const,
            icon: Wallet,
          },
        ]
      : [
          {
            label: "Total assets",
            value: portfolio.totalAssets,
            tone: "positive" as const,
            icon: Wallet,
          },
          {
            label: "Total debts",
            value: portfolio.totalDebts,
            tone: "negative" as const,
            icon: CircleDollarSign,
          },
          {
            label: "Net worth",
            value: portfolio.netWorth,
            tone: portfolio.netWorth.isNegative()
              ? ("negative" as const)
              : ("positive" as const),
            icon: Landmark,
          },
        ];
  return (
    <>
      {portfolio.isPartial ? (
        <div
          role="status"
          className="mt-5 flex gap-3 rounded-xl border border-[var(--semantic-warning-border)] bg-[var(--semantic-warning-bg)] p-4 text-sm text-[var(--semantic-warning-text)]"
        >
          <AlertTriangle className="size-5 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-semibold">Partial values</p>
            <p className="mt-1">{portfolio.partialReasons.join(" ")}</p>
          </div>
        </div>
      ) : null}
      <section
        aria-label="Portfolio totals"
        className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
      >
        {metrics.map((metric) => {
          const { label, tone, icon: Icon } = metric;
          return (
            <Card key={label} className="p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-[var(--text-secondary)]">
                  {label}
                </p>
                <SemanticBadge tone={tone}>
                  <Icon className="mr-1 size-3.5" aria-hidden="true" />
                  {tone === "negative"
                    ? "Debt"
                    : tone === "investment"
                      ? "Investment"
                      : "Asset"}
                </SemanticBadge>
              </div>
              <p className="mt-4 text-2xl">
                <SemanticValue tone={tone} label={label}>
                  {("text" in metric ? metric.text : undefined) ??
                    `${tone === "negative" ? "−" : "+"}${formatCurrency(metric.value!)}`}
                </SemanticValue>
              </p>
            </Card>
          );
        })}
      </section>
    </>
  );
}
