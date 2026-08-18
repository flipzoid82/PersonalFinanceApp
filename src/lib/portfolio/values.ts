import { AccountSource } from "@prisma/client";
import { INVESTMENT_ACCOUNT_TYPES } from "./constants";
import type { PortfolioAccount } from "./types";

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
