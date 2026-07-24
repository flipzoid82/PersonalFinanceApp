import { Card } from "@/components/ui/card";
import { HelpTooltip } from "@/components/ui/help-tooltip";
import { SemanticBadge, SemanticValue } from "@/components/ui/semantic";
import { formatCurrency, formatRelativeTime } from "@/lib/dashboard/formatters";
import type { PortfolioViewModel } from "@/lib/portfolio";
import { PORTFOLIO_HELP } from "./help-copy";

export function NetWorthBreakdown({
  portfolio,
  now,
}: {
  portfolio: PortfolioViewModel;
  now: Date;
}) {
  const groups = [
    {
      title: "Assets and investments",
      items: portfolio.items.filter(
        ({ category, isActive }) => category !== "debt" && isActive,
      ),
    },
    {
      title: "Debts",
      items: portfolio.items.filter(
        ({ category, isActive }) => category === "debt" && isActive,
      ),
    },
  ];
  return (
    <section aria-labelledby="breakdown-title" className="mt-8">
      <h2 id="breakdown-title" className="text-xl font-bold">
        Net-worth breakdown
      </h2>
      <p className="mt-2 text-sm text-[var(--text-secondary)]">
        Assets use a plus sign and debts use a minus sign, so meaning never
        depends on color alone.
      </p>
      <div className="mt-4 grid items-start gap-4 xl:grid-cols-2">
        {groups.map((group) => (
          <Card key={group.title} className="p-5 sm:p-6">
            <h3 className="font-bold">{group.title}</h3>
            {group.items.length ? (
              <ul className="mt-4 divide-y" aria-label={group.title}>
                {group.items.map((item) => (
                  <li
                    key={`${item.category}-${item.id}`}
                    className="flex flex-col gap-2 py-4 sm:flex-row sm:items-start sm:justify-between"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">{item.name}</p>
                        <SemanticBadge
                          tone={
                            item.category === "debt"
                              ? "negative"
                              : item.category === "investment"
                                ? "investment"
                                : "positive"
                          }
                        >
                          {item.category === "debt"
                            ? "Debt"
                            : item.category === "investment"
                              ? "Investment"
                              : "Asset"}
                        </SemanticBadge>
                        <span className="inline-flex items-center gap-1">
                          <SemanticBadge
                            tone={
                              item.freshness === "current"
                                ? "info"
                                : item.freshness === "stale"
                                  ? "warning"
                                  : "muted"
                            }
                          >
                            {item.freshness === "current"
                              ? "Current"
                              : item.freshness === "stale"
                                ? "Stale"
                                : "Update unavailable"}
                          </SemanticBadge>
                          <HelpTooltip label="Freshness status">
                            {PORTFOLIO_HELP.freshness}
                          </HelpTooltip>
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-[var(--text-secondary)]">
                        {item.typeLabel} · {item.sourceLabel} ·{" "}
                        {item.valueSource} ·{" "}
                        {formatRelativeTime(item.updatedAt, now)}
                      </p>
                    </div>
                    <SemanticValue
                      tone={
                        item.category === "debt"
                          ? "negative"
                          : item.category === "investment"
                            ? "investment"
                            : "positive"
                      }
                      label={
                        item.category === "debt" ? "Debt amount" : "Asset value"
                      }
                    >
                      {item.category === "debt" ? "−" : "+"}
                      {formatCurrency(item.value, item.currency)}
                    </SemanticValue>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-[var(--text-secondary)]">
                No {group.title.toLowerCase()} are available.
              </p>
            )}
          </Card>
        ))}
      </div>
    </section>
  );
}
