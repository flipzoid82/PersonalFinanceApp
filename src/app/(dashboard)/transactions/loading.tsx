import { Card } from "@/components/ui/card";

export default function TransactionsLoading() {
  return (
    <div aria-busy="true" aria-label="Loading transactions">
      <div className="h-8 w-48 animate-pulse rounded bg-[var(--surface-subtle)]" />
      <Card className="mt-6 p-6">
        <p className="text-sm text-[var(--text-secondary)]">
          Loading normalized transactions…
        </p>
      </Card>
    </div>
  );
}
