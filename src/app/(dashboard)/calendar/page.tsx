import { CalendarPage } from "@/components/calendar/calendar-page";
import { requireUser } from "@/lib/auth";
import { parseCalendarFilters } from "@/lib/calendar";
import { getCalendarViewModel } from "@/lib/calendar/server";

type SearchParams = Record<string, string | string[] | undefined>;

function currentCalendarPath(params: SearchParams) {
  const result = new URLSearchParams();
  for (const key of ["view", "month", "day", "days", "kind", "types"]) {
    const value = params[key];
    if (Array.isArray(value)) value.forEach((item) => result.append(key, item));
    else if (value) result.set(key, value);
  }
  const query = result.toString();
  return query ? `/calendar?${query}` : "/calendar";
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const now = new Date();
  const filters = parseCalendarFilters(params, now);
  const model = await getCalendarViewModel(user.id, filters, now);
  return (
    <CalendarPage
      model={model}
      now={now}
      returnTo={currentCalendarPath(params)}
      message={typeof params.message === "string" ? params.message : undefined}
      error={typeof params.error === "string" ? params.error : undefined}
    />
  );
}
