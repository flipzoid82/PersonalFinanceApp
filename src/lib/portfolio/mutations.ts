import "server-only";
import {
  AccountSource,
  AccountType,
  DataSourceStatus,
  DataSourceType,
  InvestmentSource,
  Prisma,
  type PrismaClient,
} from "@prisma/client";
import { db } from "@/lib/db";
import { DEBT_ASSET_TYPES, INVESTMENT_ACCOUNT_TYPES } from "./constants";
import type {
  AccountInput,
  BalanceSnapshotInput,
  InvestmentSnapshotInput,
  ManualAssetInput,
} from "./validation";

type Client = PrismaClient | Prisma.TransactionClient;

async function manualSource(client: Client, ownerId: string) {
  const existing = await client.dataSource.findFirst({
    where: { userId: ownerId, sourceType: DataSourceType.MANUAL },
    orderBy: { createdAt: "asc" },
  });
  if (existing) return existing;
  return client.dataSource.create({
    data: {
      userId: ownerId,
      sourceType: DataSourceType.MANUAL,
      displayName: "Manual entries",
      status: DataSourceStatus.ACTIVE,
      lastUpdatedAt: new Date(),
    },
  });
}

async function ownedManualAccount(
  client: Client,
  ownerId: string,
  accountId: string,
) {
  const account = await client.account.findFirst({
    where: { id: accountId, userId: ownerId, isManual: true },
  });
  if (!account) throw new Error("Manual account not found.");
  return account;
}

function accountData(input: AccountInput) {
  return {
    name: input.name,
    institutionName: input.institutionName,
    accountType: input.accountType,
    accountSubtype: input.accountSubtype,
    currency: input.currency,
    currentBalance: input.currentBalance,
    availableBalance: input.availableBalance,
    creditLimit: input.creditLimit,
    notes: input.notes,
  };
}

export async function createManualAccount(
  ownerId: string,
  input: AccountInput,
  client: PrismaClient = db,
) {
  return client.$transaction(async (tx) => {
    const source = await manualSource(tx, ownerId);
    const account = await tx.account.create({
      data: {
        userId: ownerId,
        dataSourceId: source.id,
        source: AccountSource.MANUAL,
        isManual: true,
        isActive: true,
        ...accountData(input),
      },
    });
    await tx.dataSource.update({
      where: { id: source.id },
      data: {
        status: DataSourceStatus.ACTIVE,
        lastUpdatedAt: new Date(),
      },
    });
    return account;
  });
}

export async function updateManualAccount(
  ownerId: string,
  accountId: string,
  input: AccountInput,
  client: PrismaClient = db,
) {
  await ownedManualAccount(client, ownerId, accountId);
  return client.account.update({
    where: { id: accountId },
    data: accountData(input),
  });
}

export async function deactivateManualAccount(
  ownerId: string,
  accountId: string,
  client: PrismaClient = db,
) {
  await ownedManualAccount(client, ownerId, accountId);
  await client.account.update({
    where: { id: accountId },
    data: { isActive: false },
  });
}

export async function deleteManualAccount(
  ownerId: string,
  accountId: string,
  client: PrismaClient = db,
) {
  const account = await client.account.findFirst({
    where: { id: accountId, userId: ownerId, isManual: true },
    include: {
      _count: {
        select: {
          transactions: true,
          recurringStreams: true,
          calendarEvents: true,
          investmentHoldings: true,
          investmentSnapshots: true,
          investmentTransactions: true,
          balanceSnapshots: true,
        },
      },
    },
  });
  if (!account) throw new Error("Manual account not found.");
  const dependencies = [
    ["transaction", account._count.transactions],
    ["recurring item", account._count.recurringStreams],
    ["calendar event", account._count.calendarEvents],
    ["investment holding", account._count.investmentHoldings],
    ["investment snapshot", account._count.investmentSnapshots],
    ["investment transaction", account._count.investmentTransactions],
    ["balance snapshot", account._count.balanceSnapshots],
  ] as const;
  const dependencySummary = dependencies
    .filter(([, count]) => count > 0)
    .map(([label, count]) => `${count} ${label}${count === 1 ? "" : "s"}`)
    .join(", ");
  if (dependencySummary)
    throw new Error(
      `This account cannot be deleted because it has ${dependencySummary}. Deactivate it instead.`,
    );
  await client.account.delete({ where: { id: account.id } });
}

export async function addBalanceSnapshot(
  ownerId: string,
  input: BalanceSnapshotInput,
  client: PrismaClient = db,
) {
  const account = await ownedManualAccount(client, ownerId, input.accountId);
  if (INVESTMENT_ACCOUNT_TYPES.has(account.accountType))
    throw new Error("Use an investment balance snapshot for this account.");
  try {
    return await client.$transaction(async (tx) => {
      const snapshot = await tx.balanceSnapshot.create({
        data: {
          userId: ownerId,
          accountId: account.id,
          currentBalance: input.currentBalance,
          availableBalance: input.availableBalance,
          capturedAt: input.capturedAt,
        },
      });
      await tx.account.update({
        where: { id: account.id },
        data: {
          currentBalance: input.currentBalance,
          availableBalance: input.availableBalance,
        },
      });
      return snapshot;
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    )
      throw new Error("A snapshot already exists for that timestamp.");
    throw error;
  }
}

export async function deleteBalanceSnapshot(
  ownerId: string,
  snapshotId: string,
  client: PrismaClient = db,
) {
  const snapshot = await client.balanceSnapshot.findFirst({
    where: { id: snapshotId, userId: ownerId, account: { userId: ownerId } },
  });
  if (!snapshot) throw new Error("Balance snapshot not found.");
  await client.balanceSnapshot.delete({ where: { id: snapshot.id } });
}

export async function createManualAsset(
  ownerId: string,
  input: ManualAssetInput,
  client: PrismaClient = db,
) {
  return client.manualAsset.create({
    data: {
      userId: ownerId,
      ...input,
      isDebt: DEBT_ASSET_TYPES.has(input.assetType),
      isActive: true,
    },
  });
}

export async function updateManualAsset(
  ownerId: string,
  assetId: string,
  input: ManualAssetInput,
  client: PrismaClient = db,
) {
  const asset = await client.manualAsset.findFirst({
    where: { id: assetId, userId: ownerId },
  });
  if (!asset) throw new Error("Manual asset or debt not found.");
  return client.manualAsset.update({
    where: { id: asset.id },
    data: { ...input, isDebt: DEBT_ASSET_TYPES.has(input.assetType) },
  });
}

export async function deactivateManualAsset(
  ownerId: string,
  assetId: string,
  client: PrismaClient = db,
) {
  const asset = await client.manualAsset.findFirst({
    where: { id: assetId, userId: ownerId },
  });
  if (!asset) throw new Error("Manual asset or debt not found.");
  await client.manualAsset.update({
    where: { id: asset.id },
    data: { isActive: false },
  });
}

export async function deleteManualAsset(
  ownerId: string,
  assetId: string,
  client: PrismaClient = db,
) {
  const asset = await client.manualAsset.findFirst({
    where: { id: assetId, userId: ownerId },
  });
  if (!asset) throw new Error("Manual asset or debt not found.");
  await client.manualAsset.delete({ where: { id: asset.id } });
}

export async function addInvestmentSnapshot(
  ownerId: string,
  input: InvestmentSnapshotInput,
  client: PrismaClient = db,
) {
  const account = await ownedManualAccount(client, ownerId, input.accountId);
  if (!INVESTMENT_ACCOUNT_TYPES.has(account.accountType))
    throw new Error("Investment account not found.");
  try {
    return await client.$transaction(async (tx) => {
      const snapshot = await tx.investmentBalanceSnapshot.create({
        data: {
          userId: ownerId,
          accountId: account.id,
          totalValue: input.totalValue,
          vestedValue: input.vestedValue,
          source: InvestmentSource.MANUAL,
          asOfDate: input.asOfDate,
          notes: input.notes,
        },
      });
      await tx.account.update({
        where: { id: account.id },
        data: { currentBalance: input.totalValue },
      });
      return snapshot;
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    )
      throw new Error(
        "An investment snapshot already exists for that timestamp.",
      );
    throw error;
  }
}

export async function updateInvestmentSnapshot(
  ownerId: string,
  snapshotId: string,
  input: InvestmentSnapshotInput,
  client: PrismaClient = db,
) {
  const snapshot = await client.investmentBalanceSnapshot.findFirst({
    where: {
      id: snapshotId,
      userId: ownerId,
      source: InvestmentSource.MANUAL,
      account: { userId: ownerId, isManual: true },
    },
  });
  if (!snapshot) throw new Error("Manual investment snapshot not found.");
  return client.investmentBalanceSnapshot.update({
    where: { id: snapshot.id },
    data: {
      totalValue: input.totalValue,
      vestedValue: input.vestedValue,
      asOfDate: input.asOfDate,
      notes: input.notes,
    },
  });
}

export async function deleteInvestmentSnapshot(
  ownerId: string,
  snapshotId: string,
  client: PrismaClient = db,
) {
  const snapshot = await client.investmentBalanceSnapshot.findFirst({
    where: {
      id: snapshotId,
      userId: ownerId,
      source: InvestmentSource.MANUAL,
      account: { userId: ownerId, isManual: true },
    },
  });
  if (!snapshot) throw new Error("Manual investment snapshot not found.");
  await client.investmentBalanceSnapshot.delete({
    where: { id: snapshot.id },
  });
}

export function isInvestmentAccountType(type: AccountType) {
  return INVESTMENT_ACCOUNT_TYPES.has(type);
}
