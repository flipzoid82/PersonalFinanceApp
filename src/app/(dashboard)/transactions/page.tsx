import { TransactionLedger } from "@/components/transactions/transaction-ledger";
import { ClassificationRuleManager } from "@/components/transactions/classification-rule-manager";
import { Notice } from "@/components/ui/notice";
import { requireUser } from "@/lib/auth";
import type { TransactionSearchParams } from "@/lib/transactions/filters";
import { getTransactionLedger } from "@/lib/transactions/queries";
import { getClassificationRuleSummaries } from "@/lib/transactions/queries";
import { previewHistoricalRuleApplication } from "@/lib/transactions/mutations";

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams?: Promise<TransactionSearchParams>;
} = {}) {
  const owner = await requireUser();
  const resolvedSearchParams = (await searchParams) ?? {};
  const [ledger, rules] = await Promise.all([
    getTransactionLedger(owner.id, resolvedSearchParams),
    getClassificationRuleSummaries(owner.id),
  ]);
  const previewRuleValue = resolvedSearchParams.previewRule;
  const previewRuleId = (
    Array.isArray(previewRuleValue) ? previewRuleValue[0] : previewRuleValue
  )?.slice(0, 128);
  const previewResult =
    previewRuleId && rules.some(({ id }) => id === previewRuleId)
      ? await previewHistoricalRuleApplication(owner.id, previewRuleId)
      : null;
  const message = Array.isArray(resolvedSearchParams.message)
    ? resolvedSearchParams.message[0]
    : resolvedSearchParams.message;
  const error = Array.isArray(resolvedSearchParams.error)
    ? resolvedSearchParams.error[0]
    : resolvedSearchParams.error;

  return (
    <div className="mx-auto max-w-7xl">
      <p className="text-sm font-semibold text-[var(--semantic-info-text)]">
        Milestone 8 · Transactions and local corrections
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">Transactions</h1>
      <p className="mt-2 max-w-3xl text-[var(--text-secondary)]">
        Resolve activity that needs attention or inspect the complete ledger.
        Owner corrections never change institution source data.
      </p>
      {message ? (
        <Notice tone="positive" role="status" className="mt-5">
          {message}
        </Notice>
      ) : null}
      {error ? (
        <Notice tone="negative" role="alert" className="mt-5">
          {error}
        </Notice>
      ) : null}
      <TransactionLedger ledger={ledger} />
      <ClassificationRuleManager
        rules={rules}
        preview={
          previewResult && previewRuleId
            ? {
                ruleId: previewRuleId,
                transactionIds: previewResult.transactionIds,
                totalsByCurrency: Object.fromEntries(
                  Object.entries(previewResult.totalsByCurrency).map(
                    ([currency, total]) => [currency, total.toFixed(4)],
                  ),
                ),
              }
            : undefined
        }
      />
    </div>
  );
}
