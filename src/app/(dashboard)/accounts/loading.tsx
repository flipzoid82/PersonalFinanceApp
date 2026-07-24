import { Card } from "@/components/ui/card";

export default function AccountsLoading() {
  return (
    <div aria-busy="true" aria-label="Loading account connections">
      <div className="h-8 w-52 animate-pulse rounded bg-[var(--surface-subtle)]" />
      <Card className="mt-6 p-6">
        <p className="text-sm text-[var(--text-secondary)]">
          Loading Plaid Sandbox connections and account balances…
        </p>
      </Card>
    </div>
  );
}
