import {
  AccountSource,
  AccountType,
  DataSourceStatus,
  ManualAssetType,
  Prisma,
} from "@prisma/client";
import { describe, expect, it } from "vitest";
import { calculatePortfolio, latestAccountValue } from "./calculations";
import type {
  PortfolioAccount,
  PortfolioManualAsset,
  RawPortfolioData,
} from "./types";

const money = (value: string) => new Prisma.Decimal(value);
const NOW = new Date("2026-07-22T12:00:00.000Z");

function account(
  input: Partial<PortfolioAccount> & Pick<PortfolioAccount, "id" | "name">,
): PortfolioAccount {
  const { id, name, ...overrides } = input;
  return {
    id,
    userId: "owner",
    dataSourceId: "source",
    name,
    institutionName: null,
    accountType: AccountType.CHECKING,
    accountSubtype: null,
    source: AccountSource.MANUAL,
    currency: "USD",
    currentBalance: money("10"),
    availableBalance: null,
    creditLimit: null,
    isManual: true,
    isActive: true,
    lastSyncedAt: null,
    lastImportedAt: null,
    notes: null,
    updatedAt: NOW,
    dataSource: {
      displayName: "Manual",
      status: DataSourceStatus.ACTIVE,
      lastUpdatedAt: NOW,
    },
    balanceSnapshots: [],
    investmentSnapshots: [],
    investmentHoldings: [],
    investmentTransactions: [],
    ...overrides,
  };
}

function asset(
  input: Partial<PortfolioManualAsset> &
    Pick<PortfolioManualAsset, "id" | "name">,
): PortfolioManualAsset {
  const { id, name, ...overrides } = input;
  return {
    id,
    userId: "owner",
    name,
    assetType: ManualAssetType.HOME,
    currentValue: money("100"),
    costBasis: null,
    currency: "USD",
    acquiredAt: null,
    isDebt: false,
    isActive: true,
    notes: null,
    updatedAt: NOW,
    ...overrides,
  };
}

describe("Milestone 5 portfolio calculations", () => {
  it("uses the latest snapshot instead of adding account balances or holdings", () => {
    const investment = account({
      id: "investment",
      name: "Investment",
      accountType: AccountType.BROKERAGE,
      currentBalance: money("100"),
      investmentSnapshots: [
        {
          id: "new",
          totalValue: money("150.1234"),
          vestedValue: null,
          source: "MANUAL",
          asOfDate: NOW,
          notes: null,
        },
        {
          id: "old",
          totalValue: money("140"),
          vestedValue: null,
          source: "MANUAL",
          asOfDate: new Date("2026-07-01T00:00:00.000Z"),
          notes: null,
        },
      ],
      investmentHoldings: [
        {
          id: "holding",
          securityName: "Holding",
          tickerSymbol: null,
          securityType: null,
          quantity: null,
          price: null,
          currentValue: money("999"),
          costBasis: null,
          vestedQuantity: null,
          vestedValue: null,
          currency: "USD",
          source: "MANUAL",
          asOfDate: NOW,
        },
      ],
    });
    const latest = latestAccountValue(investment, NOW);
    const result = calculatePortfolio(
      { ownerId: "owner", accounts: [investment], manualAssets: [] },
      NOW,
    );
    expect(latest.value.toFixed(4)).toBe("150.1234");
    expect(result.totalInvestments.toFixed(4)).toBe("150.1234");
  });

  it("adds active assets and investments, subtracts debts, and excludes inactive records", () => {
    const data: RawPortfolioData = {
      ownerId: "owner",
      accounts: [
        account({ id: "cash", name: "Cash", currentBalance: money("50.1111") }),
        account({
          id: "loan",
          name: "Loan",
          accountType: AccountType.LOAN,
          currentBalance: money("20.2222"),
        }),
        account({
          id: "inactive",
          name: "Inactive",
          currentBalance: money("999"),
          isActive: false,
        }),
        account({
          id: "other",
          name: "Other owner",
          userId: "other",
          currentBalance: money("999"),
        }),
      ],
      manualAssets: [
        asset({ id: "home", name: "Home", currentValue: money("100.3333") }),
        asset({
          id: "mortgage",
          name: "Mortgage",
          assetType: ManualAssetType.MORTGAGE,
          currentValue: money("40.4444"),
          isDebt: true,
        }),
        asset({
          id: "old",
          name: "Inactive asset",
          currentValue: money("999"),
          isActive: false,
        }),
      ],
    };
    const result = calculatePortfolio(data, NOW);
    expect(result.totalAssets.toFixed(4)).toBe("150.4444");
    expect(result.totalDebts.toFixed(4)).toBe("60.6666");
    expect(result.netWorth.toFixed(4)).toBe("89.7778");
  });

  it("derives honest empty and partial states", () => {
    const empty = calculatePortfolio(
      { ownerId: "owner", accounts: [], manualAssets: [] },
      NOW,
    );
    expect(empty.isEmpty).toBe(true);
    expect(empty.netWorth.isZero()).toBe(true);

    const partial = calculatePortfolio(
      {
        ownerId: "owner",
        accounts: [
          account({
            id: "attention",
            name: "Needs attention",
            dataSource: {
              displayName: "Manual statements",
              status: DataSourceStatus.NEEDS_ATTENTION,
              lastUpdatedAt: new Date("2026-07-01T00:00:00.000Z"),
            },
          }),
        ],
        manualAssets: [],
      },
      NOW,
    );
    expect(partial.isPartial).toBe(true);
    expect(partial.partialReasons).toEqual([
      "Manual statements needs attention.",
    ]);
  });
});
