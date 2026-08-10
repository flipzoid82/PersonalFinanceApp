"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { runRecurringDetection } from "@/lib/recurring";
import { updateTransactionOverride } from "@/lib/transactions/mutations";
import {
  transactionOverrideSchema,
  transactionValidationMessage,
} from "@/lib/transactions/validation";

function returnPath(formData: FormData) {
  const candidate = String(formData.get("returnTo") ?? "/transactions");
  return candidate.startsWith("/transactions") && !candidate.startsWith("//")
    ? candidate
    : "/transactions";
}

function feedbackUrl(path: string, key: "message" | "error", value: string) {
  const url = new URL(path, "http://transactions.local");
  url.searchParams.delete("message");
  url.searchParams.delete("error");
  url.searchParams.set(key, value);
  return `${url.pathname}${url.search}${url.hash}`;
}

function finish(path: string, key: "message" | "error", value: string): never {
  if (key === "message") {
    for (const route of ["/transactions", "/overview", "/calendar"])
      revalidatePath(route);
  }
  redirect(feedbackUrl(path, key, value));
}

export async function updateTransactionOverrideAction(formData: FormData) {
  const path = returnPath(formData);
  const intent = formData.get("intent");
  const parsed = transactionOverrideSchema.safeParse({
    transactionId: formData.get("transactionId"),
    categoryOverride:
      intent === "clear" ? "" : formData.get("categoryOverride"),
    financialRoleOverride:
      intent === "clear" ? "" : formData.get("financialRoleOverride"),
    notes: intent === "clear" ? "" : formData.get("notes"),
    excludedFromReports:
      intent === "clear"
        ? false
        : formData.get("excludedFromReports") === "true",
    intent,
  });
  if (!parsed.success)
    finish(path, "error", transactionValidationMessage(parsed.error));
  const owner = await requireUser({ activity: "meaningful" });
  try {
    await updateTransactionOverride(owner.id, parsed.data.transactionId, {
      categoryOverride: parsed.data.categoryOverride,
      financialRoleOverride: parsed.data.financialRoleOverride,
      notes: parsed.data.notes,
      excludedFromReports: parsed.data.excludedFromReports,
    });
  } catch (error) {
    finish(
      path,
      "error",
      error instanceof Error && error.message === "Transaction not found."
        ? error.message
        : "The transaction override could not be saved. Please try again.",
    );
  }
  try {
    await runRecurringDetection(owner.id);
  } catch {
    // The local correction is authoritative even if the recoverable projection refresh fails.
  }
  finish(
    path,
    "message",
    parsed.data.intent === "clear"
      ? "Editable transaction overrides cleared."
      : "Transaction override saved.",
  );
}
