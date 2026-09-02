import { confirmHistoricalRuleAction } from "@/actions/transactions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { titleCaseEnum } from "@/lib/dashboard/formatters";

type Rule = Awaited<
  ReturnType<
    typeof import("@/lib/transactions/queries").getClassificationRuleSummaries
  >
>[number];

export function ClassificationRuleManager({
  rules,
  preview,
}: {
  rules: Rule[];
  preview?: {
    ruleId: string;
    transactionIds: string[];
    totalsByCurrency: Record<string, string>;
  };
}) {
  return (
    <Card className="mt-6 p-5 sm:p-6">
      <details open={Boolean(preview)}>
        <summary className="min-h-11 cursor-pointer font-semibold">
          Manage future classification rules
        </summary>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          New rules affect future matching only. Historical activity requires a
          separate preview and explicit confirmation.
        </p>
        {!rules.length ? (
          <p className="mt-4 text-sm text-[var(--text-secondary)]">
            No owner rules have been created.
          </p>
        ) : (
          <div className="mt-4 grid gap-3">
            {rules.map((rule) => (
              <div
                key={rule.id}
                className="rounded-lg border border-[var(--border-default)] p-4"
              >
                <p className="font-semibold [overflow-wrap:anywhere]">
                  {titleCaseEnum(rule.matchType)} · {rule.normalizedValue}
                </p>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                  {rule.financialRole
                    ? titleCaseEnum(rule.financialRole)
                    : "Role unchanged"}
                  {rule.transactionCategory
                    ? ` · ${rule.transactionCategory.name}`
                    : ""}
                  {rule.account ? ` · ${rule.account.name}` : " · All accounts"}
                  {rule.isActive ? " · Active" : " · Inactive"}
                </p>
                <form method="get" action="/transactions" className="mt-3">
                  <input type="hidden" name="previewRule" value={rule.id} />
                  <Button type="submit">Preview historical impact</Button>
                </form>
                {preview?.ruleId === rule.id ? (
                  <Notice tone="warning" role="status" className="mt-4">
                    <p className="font-semibold">
                      Review before applying to {preview.transactionIds.length}{" "}
                      historical transaction
                      {preview.transactionIds.length === 1 ? "" : "s"}.
                    </p>
                    <p className="mt-1 text-sm">
                      Expected magnitudes:{" "}
                      {Object.entries(preview.totalsByCurrency)
                        .map(([currency, total]) => `${currency} ${total}`)
                        .join(" · ") || "none"}
                    </p>
                    {preview.transactionIds.length ? (
                      <form
                        action={confirmHistoricalRuleAction}
                        className="mt-3"
                      >
                        <input type="hidden" name="ruleId" value={rule.id} />
                        <input
                          type="hidden"
                          name="transactionIds"
                          value={JSON.stringify(preview.transactionIds)}
                        />
                        <Button type="submit">
                          Confirm historical application
                        </Button>
                      </form>
                    ) : null}
                  </Notice>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </details>
    </Card>
  );
}
