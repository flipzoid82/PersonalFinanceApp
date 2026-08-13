import { SpendingPage } from "@/components/spending/spending-page";
import { requireUser } from "@/lib/auth";
import { getSpendingViewModel } from "@/lib/spending/queries";

export default async function Page() {
  const user = await requireUser();
  return <SpendingPage model={await getSpendingViewModel(user.id)} />;
}
