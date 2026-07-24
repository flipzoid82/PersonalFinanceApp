import { Skeleton } from "@/components/ui/skeleton";

export default function AccountsLoading() {
  return (
    <div role="status" aria-label="Loading accounts" className="space-y-5">
      <span className="sr-only">Loading accounts</span>
      <Skeleton className="h-10 w-48" />
      <div className="grid gap-4 sm:grid-cols-3">
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}
