import "server-only";

import { getCalendarData } from "@/lib/calendar/queries";
import type { BillRange } from "./types";
import { buildBillsViewModel } from "./view-model";

export async function getBillsViewModel(
  ownerId: string,
  days: BillRange,
  now = new Date(),
) {
  return buildBillsViewModel(await getCalendarData(ownerId, now), days, now);
}
