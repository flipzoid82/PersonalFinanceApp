import { AccountSource, DataSourceStatus, Prisma } from "@prisma/client";
import { DEBT_ACCOUNT_TYPES, INVESTMENT_ACCOUNT_TYPES } from "./constants";
import { freshnessState } from "./freshness";
import type {
  PortfolioAccount,
  PortfolioItem,
  PortfolioViewModel,
  RawPortfolioData,
} from "./types";
import { titleCaseEnum } from "@/lib/dashboard/formatters";
import { isCurrentConnectedAccount } from "@/lib/accounts/current";

const ZERO = new Prisma.Decimal(0);

function sourceLabel(source: AccountSource) {
  return source === AccountSource.SYNCED
    ? ("Synced" as const)
    : source === AccountSource.IMPORTED
      ? ("Imported" as const)
      : ("Manual" as const);
}

function accountUpdateDate(account: PortfolioAccount) {
  if (account.source === AccountSource.SYNCED)
    return (
      account.lastSyncedAt ??
      account.dataSource.lastUpdatedAt ??
      account.updatedAt
    );
  if (account.source === AccountSource.IMPORTED)
    return (
      account.lastImportedAt ??
      account.dataSource.lastUpdatedAt ??
      account.updatedAt
    );
  return account.updatedAt;
}

export function latestAccountValue(
  account: PortfolioAccount,
  now = new Date(),
) {
  if (INVESTMENT_ACCOUNT_TYPES.has(account.accountType)) {
    const snapshot = account.investmentSnapshots
      .filter(({ asOfDate }) => asOfDate <= now)
      .sort((a, b) => b.asOfDate.getTime() - a.asOfDate.getTime())[0];
    if (snapshot)
      return {
        value: snapshot.totalValue,
        isAvailable: true,
        source: "Investment snapshot" as const,
        updatedAt: snapshot.asOfDate,
      };
  } else {
    const snapshot = account.balanceSnapshots
      .filter(({ capturedAt }) => capturedAt <= now)
      .sort((a, b) => b.capturedAt.getTime() - a.capturedAt.getTime())[0];
    if (snapshot)
      return {
        value: snapshot.currentBalance,
        isAvailable: true,
        source: "Balance snapshot" as const,
        updatedAt: snapshot.capturedAt,
      };
  }
  return {
    value: account.currentBalance,
    isAvailable: account.balanceAvailable !== false,
    source: "Account balance" as const,
    updatedAt: accountUpdateDate(account),
  };
}

export function calculatePortfolio(
  data: RawPortfolioData,
  now = new Date(),
): PortfolioViewModel {
  const ownedAccounts = data.accounts.filter(
    ({ userId }) => userId === data.ownerId,
  );
  const manualAssets = data.manualAssets.filter(
    ({ userId }) => userId === data.ownerId,
  );
  const items: PortfolioItem[] = [];

  for (const account of ownedAccounts) {
    const latest = latestAccountValue(account, now);
    const category = INVESTMENT_ACCOUNT_TYPES.has(account.accountType)
      ? "investment"
      : DEBT_ACCOUNT_TYPES.has(account.accountType)
        ? "debt"
        : "asset";
    items.push({
      id: account.id,
      name: account.name,
      typeLabel: titleCaseEnum(account.accountType),
      category,
      value: latest.value.abs(),
      valueAvailable: latest.isAvailable,
      currency: account.currency,
      sourceLabel: sourceLabel(account.source),
      valueSource: latest.source,
      updatedAt: latest.updatedAt,
      freshness: freshnessState(latest.updatedAt, now),
      isActive: account.isActive,
      isCurrent: isCurrentConnectedAccount(account),
    });
  }

  for (const asset of manualAssets) {
    items.push({
      id: asset.id,
      name: asset.name,
      typeLabel: titleCaseEnum(asset.assetType),
      category: asset.isDebt ? "debt" : "asset",
      value: asset.currentValue.abs(),
      valueAvailable: true,
      currency: asset.currency,
      sourceLabel: "Manual",
      valueSource: "Manual value",
      updatedAt: asset.updatedAt,
      freshness: freshnessState(asset.updatedAt, now),
      isActive: asset.isActive,
      isCurrent: asset.isActive,
    });
  }

  const activeItems = items.filter(
    ({ isCurrent, valueAvailable }) => isCurrent && valueAvailable,
  );
  const totalAssets = activeItems
    .filter(({ category }) => category !== "debt")
    .reduce((total, { value }) => total.plus(value), ZERO);
  const totalDebts = activeItems
    .filter(({ category }) => category === "debt")
    .reduce((total, { value }) => total.plus(value), ZERO);
  const totalInvestments = activeItems
    .filter(({ category }) => category === "investment")
    .reduce((total, { value }) => total.plus(value), ZERO);
  const affectedSources = ownedAccounts
    .filter(
      (account) =>
        isCurrentConnectedAccount(account) &&
        account.dataSource.status !== DataSourceStatus.ACTIVE,
    )
    .map(({ dataSource }) => dataSource.displayName);
  const partialReasons = [...new Set(affectedSources)].map(
    (name) => `${name} needs attention.`,
  );
  if (
    ownedAccounts.some(
      (account) =>
        isCurrentConnectedAccount(account) &&
        !latestAccountValue(account, now).isAvailable,
    )
  )
    partialReasons.push(
      "One or more active accounts have an unavailable balance.",
    );

  return {
    isEmpty: items.filter(({ isCurrent }) => isCurrent).length === 0,
    isPartial: partialReasons.length > 0,
    partialReasons,
    totalAssets,
    totalDebts,
    netWorth: totalAssets.minus(totalDebts),
    totalInvestments,
    items: items.sort((a, b) => b.value.comparedTo(a.value)),
    accounts: ownedAccounts,
    manualAssets,
    investmentAccounts: ownedAccounts.filter(
      (account) =>
        isCurrentConnectedAccount(account) &&
        INVESTMENT_ACCOUNT_TYPES.has(account.accountType),
    ),
  };
}
