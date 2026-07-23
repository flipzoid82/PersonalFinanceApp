import { Card } from "@/components/ui/card";
import type { CalendarViewModel } from "@/lib/calendar";
import { EventDetails } from "./event-details";

export function UpcomingList({
  model,
  returnTo,
}: {
  model: CalendarViewModel;
  returnTo: string;
}) {
  return (
    <section aria-labelledby="upcoming-heading" className="space-y-4">
      <div>
        <h2 id="upcoming-heading" className="text-xl font-bold">
          Upcoming {model.filters.days}-day list
        </h2>
        <p className="text-sm text-slate-600">
          Chronological confirmed and predicted occurrences. Inactive and
          skipped items are excluded.
        </p>
      </div>
      {model.upcomingEvents.length ? (
        <ol className="space-y-3">
          {model.upcomingEvents.map((event) => (
            <li key={event.id}>
              <EventDetails
                event={event}
                candidate={model.matchCandidates[event.id]}
                returnTo={returnTo}
              />
            </li>
          ))}
        </ol>
      ) : (
        <Card className="p-8 text-center">
          <h3 className="font-bold">No events in this range</h3>
          <p className="mt-1 text-sm text-slate-600">
            Try a longer range or clear one of the filters.
          </p>
        </Card>
      )}
    </section>
  );
}
