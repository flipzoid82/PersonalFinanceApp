import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const metrics = [
  { label: "Net Worth", order: "order-1" },
  { label: "Cash", order: "order-2" },
  { label: "Credit Card Debt", order: "order-3" },
  { label: "Investments", order: "order-8 xl:order-4" },
  { label: "Income This Month", order: "order-5" },
  { label: "Spending This Month", order: "order-6" },
  { label: "Net Cash Flow", order: "order-7" },
  { label: "Upcoming Bills", order: "order-4 xl:order-8" },
];

const panels = [
  "Net Worth Trend",
  "Account Balances",
  "Recent Transactions",
  "Spending by Category",
  "Upcoming Activity",
  "Data Freshness and Connection Status",
];

export default function OverviewPage() {
  return (
    <div className="mx-auto max-w-7xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Overview</h1>
        <p className="mt-2 text-slate-600">
          A responsive foundation for your financial snapshot.
        </p>
      </div>
      <section aria-labelledby="metrics-title" className="mt-8">
        <h2 id="metrics-title" className="sr-only">
          Dashboard metrics
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map(({ label, order }) => (
            <Card key={label} className={`${order} min-h-32 p-5`}>
              <h3 className="text-sm font-semibold text-slate-600">{label}</h3>
              <Skeleton className="mt-5 h-7 w-28" />
              <p className="mt-3 text-xs text-slate-500">
                Data available in a later milestone
              </p>
            </Card>
          ))}
        </div>
      </section>
      <section aria-labelledby="panels-title" className="mt-6">
        <h2 id="panels-title" className="sr-only">
          Dashboard details
        </h2>
        <div className="grid gap-4 xl:grid-cols-2">
          {panels.map((panel) => (
            <Card key={panel} className="min-h-64 p-5">
              <h3 className="font-semibold">{panel}</h3>
              <div className="mt-8 space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-4 w-2/3" />
              </div>
              <p className="mt-8 text-sm text-slate-500">
                Placeholder - no financial data is connected.
              </p>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
