import "server-only";
import { calculateDashboard } from "./calculations";
import { getDashboardData } from "./queries";

export async function getDashboardViewModel(ownerId: string, now = new Date()) {
  const data = await getDashboardData(ownerId, now);
  return calculateDashboard(data, now);
}
