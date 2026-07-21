import { OverviewDashboard } from "@/components/dashboard/overview-dashboard";
import { requireUser } from "@/lib/auth";
import { getDashboardViewModel } from "@/lib/dashboard";

export default async function OverviewPage() {
  const user = await requireUser();
  const now = new Date();
  const dashboard = await getDashboardViewModel(user.id, now);

  return <OverviewDashboard dashboard={dashboard} now={now} />;
}
