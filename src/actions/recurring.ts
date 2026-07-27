"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { runRecurringDetection } from "@/lib/recurring";

function returnPath(formData: FormData) {
  const candidate = String(formData.get("returnTo") ?? "/calendar");
  return candidate.startsWith("/calendar") && !candidate.startsWith("//")
    ? candidate
    : "/calendar";
}

function feedbackUrl(path: string, key: "message" | "error", value: string) {
  const url = new URL(path, "http://calendar.local");
  url.searchParams.delete("message");
  url.searchParams.delete("error");
  url.searchParams.set(key, value);
  return `${url.pathname}${url.search}${url.hash}`;
}

export async function refreshRecurringDetectionAction(formData: FormData) {
  const path = returnPath(formData);
  const owner = await requireUser({ activity: "meaningful" });
  const result = await runRecurringDetection(owner.id).catch(() => null);
  if (!result)
    redirect(
      feedbackUrl(
        path,
        "error",
        "Recurring detection could not refresh. Plaid and transaction history were not changed.",
      ),
    );
  revalidatePath("/calendar");
  revalidatePath("/overview");
  redirect(
    feedbackUrl(
      path,
      "message",
      `Recurring detection refreshed: ${result.candidates} patterns, ${result.projectionsCreated} new projections, ${result.transactionsMatched} posted matches.`,
    ),
  );
}
