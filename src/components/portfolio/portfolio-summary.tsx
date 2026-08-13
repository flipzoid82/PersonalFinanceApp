import {
  AlertTriangle,
  CircleDollarSign,
  Landmark,
  Wallet,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
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
        <Notice
          tone="warning"
          title="Partial values"
          icon={AlertTriangle}
          role="status"
          className="mt-5"
        >
          {portfolio.partialReasons.join(" ")}
        </Notice>
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
