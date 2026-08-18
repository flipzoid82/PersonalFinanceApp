import { AccountSource, DataSourceStatus, Prisma } from "@prisma/client";
import {
  accountTypeLabel,
  DEBT_ACCOUNT_TYPES,
  INVESTMENT_ACCOUNT_TYPES,
} from "./constants";
import { freshnessState } from "./freshness";
import type {
  PortfolioAccount,
  PortfolioItem,
  PortfolioViewModel,
  RawPortfolioData,
} from "./types";
import { titleCaseEnum } from "@/lib/dashboard/formatters";
import { isCurrentConnectedAccount } from "@/lib/accounts/current";
import { calculateInvestmentInsights } from "./investment-insights";
import { calculateNetWorthHistory } from "./net-worth-history";
import type { NetWorthRange } from "./types";
import { latestAccountValue } from "./values";

export { latestAccountValue } from "./values";

const ZERO = new Prisma.Decimal(0);

function accountGroup(account: PortfolioAccount): PortfolioItem["group"] {
  if (INVESTMENT_ACCOUNT_TYPES.has(account.accountType)) return "investment";
  if (account.accountType === "CHECKING" || account.accountType === "SAVINGS")
    return "cash";
  if (account.accountType === "CREDIT_CARD") return "credit-card";
  if (account.accountType === "MORTGAGE") return "mortgage";
  if (account.accountType === "LOAN") return "loan";
  return DEBT_ACCOUNT_TYPES.has(account.accountType)
    ? "other-debt"
    : "other-asset";
}

function manualAssetGroup(
  asset: RawPortfolioData["manualAssets"][number],
): PortfolioItem["group"] {
  if (asset.isDebt) {
    if (asset.assetType === "MORTGAGE") return "mortgage";
    if (
      asset.assetType === "AUTO_LOAN" ||
      asset.assetType === "STUDENT_LOAN" ||
      asset.assetType === "PERSONAL_LOAN"
    )
      return "loan";
    return "other-debt";
  }
  if (asset.assetType === "HOME" || asset.assetType === "OTHER_REAL_ESTATE")
    return "property";
  if (asset.assetType === "VEHICLE") return "vehicle";
  return "other-asset";
}

function sourceLabel(source: AccountSource) {
  return source === AccountSource.SYNCED
    ? ("Synced" as const)
    : source === AccountSource.IMPORTED
      ? ("Imported" as const)
      : ("Manual" as const);
}

export function calculatePortfolio(
  data: RawPortfolioData,
  now = new Date(),
  range: NetWorthRange = "30d",
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
      typeLabel: accountTypeLabel(account.accountType),
      category,
      group: accountGroup(account),
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
      group: manualAssetGroup(asset),
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

  const viewModel = {
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
  return {
    ...viewModel,
    netWorthHistory: calculateNetWorthHistory(data, range, now),
    investmentInsights: calculateInvestmentInsights(viewModel, now),
  };
}
