import { BillsPage } from "@/components/bills/bills-page";
import { requireUser } from "@/lib/auth";
import { parseBillRange } from "@/lib/bills";
import { getBillsViewModel } from "@/lib/bills/server";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const days = parseBillRange(params.days);
  return <BillsPage model={await getBillsViewModel(user.id, days)} />;
}
