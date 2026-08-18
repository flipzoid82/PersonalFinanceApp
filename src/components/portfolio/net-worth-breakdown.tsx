import { Card } from "@/components/ui/card";
import { Prisma } from "@prisma/client";
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
  const groupDefinitions = [
    { label: "Cash", groups: ["cash"], debt: false },
    { label: "Investments", groups: ["investment"], debt: false },
    {
      label: "Property and vehicles",
      groups: ["property", "vehicle"],
      debt: false,
    },
    { label: "Other assets", groups: ["other-asset"], debt: false },
    {
      label: "Credit cards, mortgages, and loans",
      groups: ["credit-card", "mortgage", "loan"],
      debt: true,
    },
    { label: "Other debts", groups: ["other-debt"], debt: true },
  ] as const;
  const groupTotals = groupDefinitions.map((definition) => ({
    ...definition,
    value: portfolio.items
      .filter(
        ({ group, isCurrent, valueAvailable }) =>
          isCurrent &&
          valueAvailable &&
          definition.groups.includes(group as never),
      )
      .reduce((total, { value }) => total.plus(value), new Prisma.Decimal(0)),
  }));
  const groups = [
    {
      title: "Assets and investments",
      items: portfolio.items.filter(
        ({ category, isCurrent }) => category !== "debt" && isCurrent,
      ),
    },
    {
      title: "Debts",
      items: portfolio.items.filter(
        ({ category, isCurrent }) => category === "debt" && isCurrent,
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
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {groupTotals.map(({ label, value, debt }) => (
          <Card key={label} className="p-4">
            <p className="text-sm font-semibold text-[var(--text-secondary)]">
              {label}
            </p>
            <p className="mt-2">
              <SemanticValue
                tone={
                  debt
                    ? "negative"
                    : label === "Investments"
                      ? "investment"
                      : "positive"
                }
                label={label}
              >
                {debt ? "−" : "+"}
                {formatCurrency(value)}
              </SemanticValue>
            </p>
          </Card>
        ))}
      </div>
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
                        {!item.valueAvailable ? (
                          <SemanticBadge tone="muted">
                            Value unavailable
                          </SemanticBadge>
                        ) : null}
                      </div>
                      <p className="mt-1 text-xs text-[var(--text-secondary)]">
                        {item.typeLabel} · {item.sourceLabel} ·{" "}
                        {item.valueSource} ·{" "}
                        {formatRelativeTime(item.updatedAt, now)}
                      </p>
                    </div>
                    {item.valueAvailable ? (
                      <SemanticValue
                        tone={
                          item.category === "debt"
                            ? "negative"
                            : item.category === "investment"
                              ? "investment"
                              : "positive"
                        }
                        label={
                          item.category === "debt"
                            ? "Debt amount"
                            : "Asset value"
                        }
                      >
                        {item.category === "debt" ? "−" : "+"}
                        {formatCurrency(item.value, item.currency)}
                      </SemanticValue>
                    ) : (
                      <span className="font-semibold text-[var(--text-secondary)]">
                        Unavailable
                      </span>
                    )}
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
