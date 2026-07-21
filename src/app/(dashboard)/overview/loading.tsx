import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function OverviewLoading() {
  return (
    <div
      className="mx-auto max-w-7xl space-y-6"
      role="status"
      aria-label="Loading financial overview"
    >
      <div className="space-y-3">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-5 w-full max-w-xl" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }, (_, index) => (
          <Card key={index} className="min-h-36 p-5" aria-hidden="true">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="mt-5 h-8 w-36" />
            <Skeleton className="mt-4 h-3 w-44" />
          </Card>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        {Array.from({ length: 6 }, (_, index) => (
          <Card key={index} className="min-h-72 p-5" aria-hidden="true">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="mt-8 h-4 w-full" />
            <Skeleton className="mt-3 h-4 w-4/5" />
            <Skeleton className="mt-3 h-4 w-2/3" />
          </Card>
        ))}
      </div>
      <span className="sr-only">Loading financial overview</span>
    </div>
  );
}
