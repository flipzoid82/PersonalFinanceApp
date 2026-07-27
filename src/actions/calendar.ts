"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import {
  acceptPaymentMatch,
  applyCalendarEventAction,
  createManualRecurringEvent,
  deactivateRecurringStream,
} from "@/lib/calendar/mutations";
import {
  acceptMatchSchema,
  deactivateSchema,
  eventActionSchema,
  manualEventSchema,
  validationMessage,
} from "@/lib/calendar/validation";

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

function safeError(error: unknown) {
  const friendly = [
    "Calendar event not found.",
    "Recurring stream not found.",
    "Selected account is unavailable.",
    "This event is already paid.",
    "Posted transaction not found.",
    "That transaction is already matched.",
    "The transaction is not a suitable match.",
    "This match requires explicit confirmation.",
  ];
  return error instanceof Error && friendly.includes(error.message)
    ? error.message
    : "The calendar could not be updated. Please try again.";
}

function finish(path: string, key: "message" | "error", value: string): never {
  if (key === "message") {
    revalidatePath("/calendar");
    revalidatePath("/overview");
  }
  redirect(feedbackUrl(path, key, value));
}

export async function updateCalendarEventAction(formData: FormData) {
  const path = returnPath(formData);
  const parsed = eventActionSchema.safeParse({
    intent: formData.get("intent"),
    eventId: formData.get("eventId"),
    date: formData.get("date"),
    amount: formData.get("amount"),
    frequency: formData.get("frequency"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) finish(path, "error", validationMessage(parsed.error));
  const user = await requireUser({ activity: "meaningful" });
  let message: string;
  try {
    message = await applyCalendarEventAction(user.id, parsed.data);
  } catch (error) {
    finish(path, "error", safeError(error));
  }
  finish(path, "message", message);
}

export async function deactivateRecurringStreamAction(formData: FormData) {
  const path = returnPath(formData);
  const parsed = deactivateSchema.safeParse({
    streamId: formData.get("streamId"),
  });
  if (!parsed.success) finish(path, "error", validationMessage(parsed.error));
  const user = await requireUser({ activity: "meaningful" });
  let message: string;
  try {
    message = await deactivateRecurringStream(user.id, parsed.data.streamId);
  } catch (error) {
    finish(path, "error", safeError(error));
  }
  finish(path, "message", message);
}

export async function acceptPaymentMatchAction(formData: FormData) {
  const path = returnPath(formData);
  const parsed = acceptMatchSchema.safeParse({
    eventId: formData.get("eventId"),
    transactionId: formData.get("transactionId"),
    confirmLowConfidence: formData.get("confirmLowConfidence") === "true",
  });
  if (!parsed.success) finish(path, "error", validationMessage(parsed.error));
  const user = await requireUser({ activity: "meaningful" });
  let message: string;
  try {
    message = await acceptPaymentMatch(
      user.id,
      parsed.data.eventId,
      parsed.data.transactionId,
      parsed.data.confirmLowConfidence,
    );
  } catch (error) {
    finish(path, "error", safeError(error));
  }
  finish(path, "message", message);
}

export async function createManualRecurringEventAction(formData: FormData) {
  const path = returnPath(formData);
  const parsed = manualEventSchema.safeParse({
    name: formData.get("name"),
    eventType: formData.get("eventType"),
    date: formData.get("date"),
    amount: formData.get("amount"),
    currency: formData.get("currency"),
    accountId: formData.get("accountId"),
    frequency: formData.get("frequency"),
    dateKind: formData.get("dateKind"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) finish(path, "error", validationMessage(parsed.error));
  const user = await requireUser({ activity: "meaningful" });
  try {
    await createManualRecurringEvent(user.id, parsed.data);
  } catch (error) {
    finish(path, "error", safeError(error));
  }
  finish(path, "message", "Manual recurring event created.");
}
