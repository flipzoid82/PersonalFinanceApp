"use server";

import { ImportType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import {
  cancelImport,
  commitImport,
  createImportFromUpload,
  deleteImportSource,
  ImportDetectionError,
  ImportServiceError,
  mapCsvImport,
  resolveImportAccount,
  skipImportCandidate,
  undoImport,
} from "@/lib/imports/service";

const supportedTypes = [
  ImportType.GENERIC_ACCOUNT_BALANCE_CSV,
  ImportType.GENERIC_INVESTMENT_HOLDINGS_CSV,
  ImportType.FIDELITY_NETBENEFITS_STATEMENT,
  ImportType.FIDELITY_BROKERAGE_STATEMENT,
  ImportType.FIDELITY_TRADE_CONFIRMATION,
  ImportType.TSP_STATEMENT,
] as const;
const uploadSchema = z.object({
  importType: z.enum(supportedTypes).optional(),
});
const idSchema = z.string().cuid();

function safeError(error: unknown) {
  if (error instanceof ImportServiceError) return error.message;
  return "The import could not be updated safely. Please try again.";
}

function detailUrl(id: string, key: "message" | "error", value: string) {
  return `/settings/imports/${id}?${key}=${encodeURIComponent(value)}`;
}

function refreshFinancialPages() {
  for (const path of [
    "/settings",
    "/settings/imports",
    "/accounts",
    "/investments",
    "/net-worth",
    "/overview",
  ])
    revalidatePath(path);
}

export async function uploadImportAction(formData: FormData) {
  const parsed = uploadSchema.safeParse({
    importType: formData.get("importType") || undefined,
  });
  const file = formData.get("file");
  if (!parsed.success || !(file instanceof File))
    redirect("/settings/imports?error=Choose+a+supported+PDF+or+CSV+file.");
  const user = await requireUser({ activity: "meaningful" });
  let id: string;
  try {
    id = await createImportFromUpload(user.id, file, parsed.data.importType);
  } catch (error) {
    if (error instanceof ImportDetectionError)
      redirect(
        `/settings/imports?fallback=${error.fallback}&error=${encodeURIComponent(error.message)}`,
      );
    redirect(`/settings/imports?error=${encodeURIComponent(safeError(error))}`);
  }
  redirect(`/settings/imports/${id}`);
}

export async function mapCsvImportAction(formData: FormData) {
  const importId = String(formData.get("importId") ?? "");
  if (!idSchema.safeParse(importId).success)
    redirect("/settings/imports?error=Import+not+found.");
  const user = await requireUser({ activity: "meaningful" });
  try {
    await mapCsvImport(user.id, importId, {
      importType: String(formData.get("importType")) as
        | "GENERIC_ACCOUNT_BALANCE_CSV"
        | "GENERIC_INVESTMENT_HOLDINGS_CSV",
      account: String(formData.get("account") ?? ""),
      asOfDate: String(formData.get("asOfDate") ?? ""),
      value: String(formData.get("value") ?? ""),
      currency: String(formData.get("currency") ?? "") || undefined,
      defaultCurrency:
        String(formData.get("defaultCurrency") ?? "") || undefined,
      securityName: String(formData.get("securityName") ?? "") || undefined,
      tickerSymbol: String(formData.get("tickerSymbol") ?? "") || undefined,
      quantity: String(formData.get("quantity") ?? "") || undefined,
      price: String(formData.get("price") ?? "") || undefined,
      costBasis: String(formData.get("costBasis") ?? "") || undefined,
    });
  } catch (error) {
    redirect(detailUrl(importId, "error", safeError(error)));
  }
  redirect(
    detailUrl(
      importId,
      "message",
      "CSV mapping validated. Review the proposed import.",
    ),
  );
}

export async function resolveImportAccountAction(formData: FormData) {
  const importId = String(formData.get("importId") ?? "");
  const matchId = String(formData.get("matchId") ?? "");
  const decision = String(formData.get("decision") ?? "existing");
  const user = await requireUser({ activity: "meaningful" });
  try {
    if (
      !idSchema.safeParse(importId).success ||
      !idSchema.safeParse(matchId).success
    )
      throw new ImportServiceError("The account choice is unavailable.");
    await resolveImportAccount(
      user.id,
      importId,
      matchId,
      decision === "create" ? "create" : "existing",
      String(formData.get("accountId") ?? "") || undefined,
    );
  } catch (error) {
    redirect(detailUrl(importId, "error", safeError(error)));
  }
  redirect(detailUrl(importId, "message", "Account choice saved."));
}

export async function skipImportCandidateAction(formData: FormData) {
  const importId = String(formData.get("importId") ?? "");
  const candidateId = String(formData.get("candidateId") ?? "");
  const user = await requireUser({ activity: "meaningful" });
  try {
    if (
      !idSchema.safeParse(importId).success ||
      !idSchema.safeParse(candidateId).success
    )
      throw new ImportServiceError("This review item is unavailable.");
    await skipImportCandidate(user.id, importId, candidateId);
  } catch (error) {
    redirect(detailUrl(importId, "error", safeError(error)));
  }
  redirect(detailUrl(importId, "message", "Review item skipped."));
}

async function runJobAction(
  formData: FormData,
  operation: (ownerId: string, importId: string) => Promise<void>,
  message: string,
) {
  const importId = String(formData.get("importId") ?? "");
  if (!idSchema.safeParse(importId).success)
    redirect("/settings/imports?error=Import+not+found.");
  const user = await requireUser({ activity: "meaningful" });
  try {
    await operation(user.id, importId);
    refreshFinancialPages();
  } catch (error) {
    redirect(detailUrl(importId, "error", safeError(error)));
  }
  redirect(detailUrl(importId, "message", message));
}

export async function commitImportAction(formData: FormData) {
  return runJobAction(
    formData,
    commitImport,
    "Import completed. The summary below shows what changed.",
  );
}

export async function undoImportAction(formData: FormData) {
  return runJobAction(
    formData,
    undoImport,
    "Import reverted. Its audit history has been preserved.",
  );
}

export async function deleteImportSourceAction(formData: FormData) {
  return runJobAction(
    formData,
    deleteImportSource,
    "Retained source deleted. Imported financial records and audit history remain.",
  );
}

export async function cancelImportAction(formData: FormData) {
  return runJobAction(
    formData,
    cancelImport,
    "Import canceled and its temporary source deleted.",
  );
}
