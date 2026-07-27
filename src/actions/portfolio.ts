"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import {
  addBalanceSnapshot,
  addInvestmentSnapshot,
  createManualAccount,
  createManualAsset,
  deactivateManualAccount,
  deactivateManualAsset,
  deleteBalanceSnapshot,
  deleteInvestmentSnapshot,
  deleteManualAccount,
  deleteManualAsset,
  updateInvestmentSnapshot,
  updateManualAccount,
  updateManualAsset,
} from "@/lib/portfolio/mutations";
import {
  accountIdSchema,
  accountSchema,
  balanceSnapshotIdSchema,
  balanceSnapshotSchema,
  investmentSnapshotIdSchema,
  investmentSnapshotSchema,
  manualAssetIdSchema,
  manualAssetSchema,
  updateAccountSchema,
  updateInvestmentSnapshotSchema,
  updateManualAssetSchema,
  validationMessage,
} from "@/lib/portfolio/validation";

const ALLOWED_RETURN_PATHS = ["/accounts", "/investments", "/net-worth"];

function returnPath(formData: FormData) {
  const candidate = String(formData.get("returnTo") ?? "/accounts");
  return ALLOWED_RETURN_PATHS.some(
    (path) => candidate === path || candidate.startsWith(`${path}?`),
  )
    ? candidate
    : "/accounts";
}

function feedbackUrl(path: string, key: "message" | "error", value: string) {
  const url = new URL(path, "http://portfolio.local");
  url.searchParams.delete("message");
  url.searchParams.delete("error");
  url.searchParams.set(key, value);
  return `${url.pathname}${url.search}${url.hash}`;
}

function finish(path: string, key: "message" | "error", value: string): never {
  if (key === "message") {
    for (const route of [
      "/accounts",
      "/investments",
      "/net-worth",
      "/overview",
    ])
      revalidatePath(route);
  }
  redirect(feedbackUrl(path, key, value));
}

function safeError(error: unknown) {
  const friendly = [
    "Manual account not found.",
    "Use an investment balance snapshot for this account.",
    "A snapshot already exists for that timestamp.",
    "Balance snapshot not found.",
    "Manual asset or debt not found.",
    "Investment account not found.",
    "An investment snapshot already exists for that timestamp.",
    "Manual investment snapshot not found.",
  ];
  if (!(error instanceof Error))
    return "The portfolio could not be updated. Please try again.";
  if (
    friendly.includes(error.message) ||
    error.message.startsWith("This account cannot be deleted because it has ")
  )
    return error.message;
  return "The portfolio could not be updated. Please try again.";
}

function accountValues(formData: FormData) {
  return {
    name: formData.get("name"),
    institutionName: formData.get("institutionName"),
    accountType: formData.get("accountType"),
    accountSubtype: formData.get("accountSubtype"),
    currency: formData.get("currency"),
    currentBalance: formData.get("currentBalance"),
    availableBalance: formData.get("availableBalance"),
    creditLimit: formData.get("creditLimit"),
    notes: formData.get("notes"),
  };
}

function assetValues(formData: FormData) {
  return {
    name: formData.get("name"),
    assetType: formData.get("assetType"),
    currentValue: formData.get("currentValue"),
    costBasis: formData.get("costBasis"),
    currency: formData.get("currency"),
    acquiredAt: formData.get("acquiredAt"),
    notes: formData.get("notes"),
  };
}

function investmentSnapshotValues(formData: FormData) {
  return {
    accountId: formData.get("accountId"),
    totalValue: formData.get("totalValue"),
    vestedValue: formData.get("vestedValue"),
    asOfDate: formData.get("asOfDate"),
    notes: formData.get("notes"),
  };
}

export async function createManualAccountAction(formData: FormData) {
  const path = returnPath(formData);
  const parsed = accountSchema.safeParse(accountValues(formData));
  if (!parsed.success) finish(path, "error", validationMessage(parsed.error));
  const user = await requireUser({ activity: "meaningful" });
  try {
    await createManualAccount(user.id, parsed.data);
  } catch (error) {
    finish(path, "error", safeError(error));
  }
  finish(path, "message", "Manual account created.");
}

export async function updateManualAccountAction(formData: FormData) {
  const path = returnPath(formData);
  const parsed = updateAccountSchema.safeParse({
    accountId: formData.get("accountId"),
    ...accountValues(formData),
  });
  if (!parsed.success) finish(path, "error", validationMessage(parsed.error));
  const { accountId, ...input } = parsed.data;
  const user = await requireUser({ activity: "meaningful" });
  try {
    await updateManualAccount(user.id, accountId, input);
  } catch (error) {
    finish(path, "error", safeError(error));
  }
  finish(path, "message", "Manual account updated.");
}

export async function deactivateManualAccountAction(formData: FormData) {
  const path = returnPath(formData);
  const parsed = accountIdSchema.safeParse({
    accountId: formData.get("accountId"),
  });
  if (!parsed.success) finish(path, "error", validationMessage(parsed.error));
  const user = await requireUser({ activity: "meaningful" });
  try {
    await deactivateManualAccount(user.id, parsed.data.accountId);
  } catch (error) {
    finish(path, "error", safeError(error));
  }
  finish(path, "message", "Manual account deactivated.");
}

export async function deleteManualAccountAction(formData: FormData) {
  const path = returnPath(formData);
  const parsed = accountIdSchema.safeParse({
    accountId: formData.get("accountId"),
  });
  if (!parsed.success) finish(path, "error", validationMessage(parsed.error));
  const user = await requireUser({ activity: "meaningful" });
  try {
    await deleteManualAccount(user.id, parsed.data.accountId);
  } catch (error) {
    finish(path, "error", safeError(error));
  }
  finish(path, "message", "Manual account deleted.");
}

export async function addBalanceSnapshotAction(formData: FormData) {
  const path = returnPath(formData);
  const parsed = balanceSnapshotSchema.safeParse({
    accountId: formData.get("accountId"),
    currentBalance: formData.get("currentBalance"),
    availableBalance: formData.get("availableBalance"),
    capturedAt: formData.get("capturedAt"),
  });
  if (!parsed.success) finish(path, "error", validationMessage(parsed.error));
  const user = await requireUser({ activity: "meaningful" });
  try {
    await addBalanceSnapshot(user.id, parsed.data);
  } catch (error) {
    finish(path, "error", safeError(error));
  }
  finish(path, "message", "Balance snapshot added.");
}

export async function deleteBalanceSnapshotAction(formData: FormData) {
  const path = returnPath(formData);
  const parsed = balanceSnapshotIdSchema.safeParse({
    snapshotId: formData.get("snapshotId"),
  });
  if (!parsed.success) finish(path, "error", validationMessage(parsed.error));
  const user = await requireUser({ activity: "meaningful" });
  try {
    await deleteBalanceSnapshot(user.id, parsed.data.snapshotId);
  } catch (error) {
    finish(path, "error", safeError(error));
  }
  finish(path, "message", "Balance snapshot deleted.");
}

export async function createManualAssetAction(formData: FormData) {
  const path = returnPath(formData);
  const parsed = manualAssetSchema.safeParse(assetValues(formData));
  if (!parsed.success) finish(path, "error", validationMessage(parsed.error));
  const user = await requireUser({ activity: "meaningful" });
  try {
    await createManualAsset(user.id, parsed.data);
  } catch (error) {
    finish(path, "error", safeError(error));
  }
  finish(path, "message", "Manual asset or debt created.");
}

export async function updateManualAssetAction(formData: FormData) {
  const path = returnPath(formData);
  const parsed = updateManualAssetSchema.safeParse({
    assetId: formData.get("assetId"),
    ...assetValues(formData),
  });
  if (!parsed.success) finish(path, "error", validationMessage(parsed.error));
  const { assetId, ...input } = parsed.data;
  const user = await requireUser({ activity: "meaningful" });
  try {
    await updateManualAsset(user.id, assetId, input);
  } catch (error) {
    finish(path, "error", safeError(error));
  }
  finish(path, "message", "Manual asset or debt updated.");
}

export async function deactivateManualAssetAction(formData: FormData) {
  const path = returnPath(formData);
  const parsed = manualAssetIdSchema.safeParse({
    assetId: formData.get("assetId"),
  });
  if (!parsed.success) finish(path, "error", validationMessage(parsed.error));
  const user = await requireUser({ activity: "meaningful" });
  try {
    await deactivateManualAsset(user.id, parsed.data.assetId);
  } catch (error) {
    finish(path, "error", safeError(error));
  }
  finish(path, "message", "Manual asset or debt deactivated.");
}

export async function deleteManualAssetAction(formData: FormData) {
  const path = returnPath(formData);
  const parsed = manualAssetIdSchema.safeParse({
    assetId: formData.get("assetId"),
  });
  if (!parsed.success) finish(path, "error", validationMessage(parsed.error));
  const user = await requireUser({ activity: "meaningful" });
  try {
    await deleteManualAsset(user.id, parsed.data.assetId);
  } catch (error) {
    finish(path, "error", safeError(error));
  }
  finish(path, "message", "Manual asset or debt deleted.");
}

export async function addInvestmentSnapshotAction(formData: FormData) {
  const path = returnPath(formData);
  const parsed = investmentSnapshotSchema.safeParse(
    investmentSnapshotValues(formData),
  );
  if (!parsed.success) finish(path, "error", validationMessage(parsed.error));
  const user = await requireUser({ activity: "meaningful" });
  try {
    await addInvestmentSnapshot(user.id, parsed.data);
  } catch (error) {
    finish(path, "error", safeError(error));
  }
  finish(path, "message", "Investment snapshot added.");
}

export async function updateInvestmentSnapshotAction(formData: FormData) {
  const path = returnPath(formData);
  const parsed = updateInvestmentSnapshotSchema.safeParse({
    snapshotId: formData.get("snapshotId"),
    ...investmentSnapshotValues(formData),
  });
  if (!parsed.success) finish(path, "error", validationMessage(parsed.error));
  const { snapshotId, ...input } = parsed.data;
  const user = await requireUser({ activity: "meaningful" });
  try {
    await updateInvestmentSnapshot(user.id, snapshotId, input);
  } catch (error) {
    finish(path, "error", safeError(error));
  }
  finish(path, "message", "Investment snapshot updated.");
}

export async function deleteInvestmentSnapshotAction(formData: FormData) {
  const path = returnPath(formData);
  const parsed = investmentSnapshotIdSchema.safeParse({
    snapshotId: formData.get("snapshotId"),
  });
  if (!parsed.success) finish(path, "error", validationMessage(parsed.error));
  const user = await requireUser({ activity: "meaningful" });
  try {
    await deleteInvestmentSnapshot(user.id, parsed.data.snapshotId);
  } catch (error) {
    finish(path, "error", safeError(error));
  }
  finish(path, "message", "Investment snapshot deleted.");
}
