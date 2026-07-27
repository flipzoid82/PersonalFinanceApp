"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import {
  disconnectPlaidConnection,
  SafePlaidError,
  syncPlaidConnection,
} from "@/lib/plaid";

const idSchema = z.string().min(1).max(255);

function feedback(key: "message" | "error", value: string): never {
  const params = new URLSearchParams({ [key]: value });
  redirect(`/accounts?${params.toString()}`);
}

function safeMessage(error: unknown) {
  return error instanceof SafePlaidError
    ? error.message
    : "Plaid Sandbox could not complete the request.";
}

function revalidatePlaidViews() {
  for (const path of ["/accounts", "/overview", "/calendar", "/transactions"])
    revalidatePath(path);
}

export async function syncPlaidConnectionAction(formData: FormData) {
  const connectionId = idSchema.safeParse(formData.get("connectionId"));
  if (!connectionId.success)
    feedback("error", "The Plaid Sandbox connection was not found.");
  const owner = await requireUser({ activity: "meaningful" });
  const result = await syncPlaidConnection(owner.id, connectionId.data).catch(
    (error: unknown) => feedback("error", safeMessage(error)),
  );
  revalidatePlaidViews();
  feedback(
    "message",
    `Plaid Sandbox sync complete: ${result.accounts} accounts, ${result.added} added, ${result.modified} modified, ${result.removed} removed transactions.${
      result.recurringDetection === "failed"
        ? " Recurring detection could not refresh; retry it from Calendar."
        : ""
    }`,
  );
}

export async function disconnectPlaidConnectionAction(formData: FormData) {
  const connectionId = idSchema.safeParse(formData.get("connectionId"));
  if (!connectionId.success)
    feedback("error", "The Plaid Sandbox connection was not found.");
  const owner = await requireUser({ activity: "meaningful" });
  await disconnectPlaidConnection(owner.id, connectionId.data).catch(
    (error: unknown) => feedback("error", safeMessage(error)),
  );
  revalidatePlaidViews();
  feedback(
    "message",
    "Plaid Sandbox disconnected. Historical local accounts and transactions were preserved.",
  );
}
