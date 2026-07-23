import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function CalendarLoading() {
  return (
    <div
      className="mx-auto max-w-7xl space-y-6"
      role="status"
      aria-label="Loading calendar"
    >
      <div className="space-y-2">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-5 w-full max-w-2xl" />
      </div>
      <Card className="space-y-4 p-5" aria-hidden="true">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-10 w-full" />
      </Card>
      <Card className="p-4" aria-hidden="true">
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 42 }, (_, index) => (
            <Skeleton key={index} className="h-24 w-full" />
          ))}
        </div>
      </Card>
      <span className="sr-only">Loading calendar</span>
    </div>
  );
}
