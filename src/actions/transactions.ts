"use server";

import {
  ClassificationRuleMatchType,
  EconomicDirection,
  FinancialRole,
  Prisma,
  TransactionRelationshipState,
  TransactionRelationshipType,
  TransactionCategoryKind,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { runRecurringDetection } from "@/lib/recurring";
import {
  createFutureClassificationRule,
  confirmHistoricalRuleApplication,
  createTransactionCategory,
  replaceTransactionAllocations,
  updateTransactionOverride,
  updateTransactionCategory,
} from "@/lib/transactions/mutations";
import {
  createRefundRelationship,
  resolveLegacyRelationship,
  setRelationshipState,
} from "@/lib/transactions/relationships";
import { deferTransactionReview } from "@/lib/transactions/truth";
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

export async function deferTransactionReviewAction(formData: FormData) {
  const path = returnPath(formData);
  const owner = await requireUser({ activity: "meaningful" });
  const transactionId = String(formData.get("transactionId") ?? "");
  const days = Number.parseInt(String(formData.get("days") ?? "7"), 10);
  if (!transactionId || ![1, 7, 30].includes(days))
    finish(path, "error", "The review deferral is invalid.");
  const until = new Date();
  until.setUTCDate(until.getUTCDate() + days);
  try {
    await deferTransactionReview(owner.id, transactionId, until);
  } catch {
    finish(path, "error", "The transaction review could not be deferred.");
  }
  finish(
    path,
    "message",
    `Review deferred for ${days} day${days === 1 ? "" : "s"}.`,
  );
}

export async function replaceTransactionSplitAction(formData: FormData) {
  const path = returnPath(formData);
  const owner = await requireUser({ activity: "meaningful" });
  const transactionId = String(formData.get("transactionId") ?? "");
  const categoryIds = formData.getAll("splitCategoryId").map(String);
  const amountValues = formData.getAll("splitAmount").map(String);
  try {
    const allocations = categoryIds.flatMap((transactionCategoryId, index) =>
      transactionCategoryId
        ? [
            {
              transactionCategoryId,
              amount: new Prisma.Decimal(amountValues[index] ?? ""),
            },
          ]
        : [],
    );
    await replaceTransactionAllocations(owner.id, transactionId, allocations);
  } catch (error) {
    finish(
      path,
      "error",
      error instanceof Error ? error.message : "The split could not be saved.",
    );
  }
  finish(path, "message", "Exact transaction split saved.");
}

export async function createClassificationRuleAction(formData: FormData) {
  const path = returnPath(formData);
  const owner = await requireUser({ activity: "meaningful" });
  const matchType = String(formData.get("matchType") ?? "");
  const role = String(formData.get("financialRole") ?? "");
  const direction = String(formData.get("economicDirection") ?? "");
  if (
    !Object.values(ClassificationRuleMatchType).includes(
      matchType as ClassificationRuleMatchType,
    )
  )
    finish(path, "error", "The classification rule scope is invalid.");
  try {
    await createFutureClassificationRule(owner.id, {
      transactionId: String(formData.get("transactionId") ?? ""),
      matchType: matchType as ClassificationRuleMatchType,
      transactionCategoryId:
        String(formData.get("transactionCategoryId") ?? "") || null,
      financialRole: Object.values(FinancialRole).includes(
        role as FinancialRole,
      )
        ? (role as FinancialRole)
        : null,
      economicDirection: Object.values(EconomicDirection).includes(
        direction as EconomicDirection,
      )
        ? (direction as EconomicDirection)
        : null,
    });
  } catch (error) {
    finish(
      path,
      "error",
      error instanceof Error ? error.message : "The rule could not be created.",
    );
  }
  finish(path, "message", "Future-only classification rule created.");
}

export async function confirmHistoricalRuleAction(formData: FormData) {
  const owner = await requireUser({ activity: "meaningful" });
  let transactionIds: string[];
  try {
    const parsed = JSON.parse(String(formData.get("transactionIds") ?? "[]"));
    if (
      !Array.isArray(parsed) ||
      parsed.length > 1000 ||
      parsed.some((value) => typeof value !== "string" || value.length > 128)
    )
      throw new Error();
    transactionIds = parsed;
  } catch {
    finish("/transactions", "error", "The historical preview is invalid.");
  }
  try {
    const count = await confirmHistoricalRuleApplication(
      owner.id,
      String(formData.get("ruleId") ?? ""),
      transactionIds!,
    );
    finish(
      "/transactions",
      "message",
      `Historical rule applied to ${count} transaction${count === 1 ? "" : "s"}.`,
    );
  } catch (error) {
    finish(
      "/transactions",
      "error",
      error instanceof Error
        ? error.message
        : "The historical rule could not be applied.",
    );
  }
}

export async function setRelationshipStateAction(formData: FormData) {
  const path = returnPath(formData);
  const owner = await requireUser({ activity: "meaningful" });
  const state = String(formData.get("state") ?? "");
  if (
    state !== TransactionRelationshipState.CONFIRMED &&
    state !== TransactionRelationshipState.REJECTED
  )
    finish(path, "error", "The relationship decision is invalid.");
  try {
    await setRelationshipState(
      owner.id,
      String(formData.get("relationshipId") ?? ""),
      state as TransactionRelationshipState,
    );
  } catch (error) {
    finish(
      path,
      "error",
      error instanceof Error
        ? error.message
        : "The relationship could not be updated.",
    );
  }
  finish(path, "message", "Transaction relationship updated.");
}

export async function resolveLegacyRelationshipAction(formData: FormData) {
  const path = returnPath(formData);
  const owner = await requireUser({ activity: "meaningful" });
  const type = String(formData.get("type") ?? "");
  if (
    type !== TransactionRelationshipType.INTERNAL_TRANSFER &&
    type !== TransactionRelationshipType.CREDIT_CARD_PAYMENT &&
    type !== TransactionRelationshipType.REFUND &&
    type !== TransactionRelationshipType.REIMBURSEMENT
  )
    finish(path, "error", "Select a supported relationship type.");
  let amount: Prisma.Decimal;
  try {
    amount = new Prisma.Decimal(String(formData.get("appliedAmount") ?? ""));
  } catch {
    finish(path, "error", "Enter a valid positive applied amount.");
  }
  try {
    await resolveLegacyRelationship(
      owner.id,
      String(formData.get("relationshipId") ?? ""),
      type as TransactionRelationshipType,
      amount!,
    );
  } catch (error) {
    finish(
      path,
      "error",
      error instanceof Error
        ? error.message
        : "The legacy relationship could not be resolved.",
    );
  }
  finish(path, "message", "Legacy relationship resolved and confirmed.");
}

export async function createRefundRelationshipAction(formData: FormData) {
  const path = returnPath(formData);
  const owner = await requireUser({ activity: "meaningful" });
  const type = String(formData.get("type") ?? "");
  if (
    type !== TransactionRelationshipType.REFUND &&
    type !== TransactionRelationshipType.REIMBURSEMENT
  )
    finish(path, "error", "The refund relationship type is invalid.");
  let amount: Prisma.Decimal;
  try {
    amount = new Prisma.Decimal(String(formData.get("appliedAmount") ?? ""));
  } catch {
    finish(path, "error", "Enter a valid positive applied amount.");
  }
  try {
    await createRefundRelationship(
      owner.id,
      String(formData.get("refundTransactionId") ?? ""),
      String(formData.get("originalTransactionId") ?? ""),
      type,
      amount!,
    );
  } catch (error) {
    finish(
      path,
      "error",
      error instanceof Error
        ? error.message
        : "The refund could not be linked.",
    );
  }
  finish(path, "message", "Refund or reimbursement linked.");
}

export async function createTransactionCategoryAction(formData: FormData) {
  const owner = await requireUser({ activity: "meaningful" });
  const kind = String(formData.get("kind") ?? "");
  if (
    !Object.values(TransactionCategoryKind).includes(
      kind as TransactionCategoryKind,
    )
  )
    finish("/transactions", "error", "The category kind is invalid.");
  try {
    await createTransactionCategory(
      owner.id,
      kind as TransactionCategoryKind,
      String(formData.get("name") ?? ""),
    );
  } catch (error) {
    finish(
      "/transactions",
      "error",
      error instanceof Error
        ? error.message
        : "The category could not be created.",
    );
  }
  finish("/transactions", "message", "Transaction category created.");
}

export async function updateTransactionCategoryAction(formData: FormData) {
  const owner = await requireUser({ activity: "meaningful" });
  try {
    await updateTransactionCategory(
      owner.id,
      String(formData.get("categoryId") ?? ""),
      {
        name: String(formData.get("name") ?? ""),
        isActive: formData.get("isActive") === "true",
        displayOrder: Number.parseInt(
          String(formData.get("displayOrder") ?? "0"),
          10,
        ),
      },
    );
  } catch (error) {
    finish(
      "/transactions",
      "error",
      error instanceof Error
        ? error.message
        : "The category could not be updated.",
    );
  }
  finish("/transactions", "message", "Transaction category updated.");
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
    transactionCategoryId:
      intent === "clear" ? "" : formData.get("transactionCategoryId"),
    categoryOverride:
      intent === "clear" ? "" : formData.get("categoryOverride"),
    financialRoleOverride:
      intent === "clear" ? "" : formData.get("financialRoleOverride"),
    economicDirectionOverride:
      intent === "clear" ? "" : formData.get("economicDirectionOverride"),
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
      transactionCategoryId: parsed.data.transactionCategoryId,
      financialRoleOverride: parsed.data.financialRoleOverride,
      economicDirectionOverride: parsed.data.economicDirectionOverride,
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
