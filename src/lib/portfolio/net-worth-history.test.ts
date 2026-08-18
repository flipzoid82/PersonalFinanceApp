import {
  AccountSource,
  AccountType,
  ConnectionStatus,
  DataSourceStatus,
  Prisma,
} from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  calculateNetWorthHistory,
  netWorthRangeStart,
  parseNetWorthRange,
} from "./net-worth-history";
import type { PortfolioAccount, RawPortfolioData } from "./types";

const money = (value: string) => new Prisma.Decimal(value);
const NOW = new Date("2026-08-17T12:00:00.000Z");

function account(
  input: Partial<PortfolioAccount> & Pick<PortfolioAccount, "id" | "name">,
): PortfolioAccount {
  return {
    userId: "owner",
    dataSourceId: "source",
    institutionName: null,
    accountType: AccountType.CHECKING,
    accountSubtype: null,
    source: AccountSource.MANUAL,
    currency: "USD",
    currentBalance: money("999"),
    balanceAvailable: true,
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
    institutionConnection: null,
    balanceSnapshots: [],
    investmentSnapshots: [],
    investmentHoldings: [],
    investmentTransactions: [],
    ...input,
    id: input.id,
    name: input.name,
  };
}

describe("net-worth history", () => {
  it("parses every range and defaults to 30D", () => {
    expect(parseNetWorthRange(undefined)).toBe("30d");
    expect(parseNetWorthRange("invalid")).toBe("30d");
    expect(parseNetWorthRange("3m")).toBe("3m");
    expect(parseNetWorthRange("6m")).toBe("6m");
    expect(parseNetWorthRange("1y")).toBe("1y");
    expect(parseNetWorthRange("all")).toBe("all");
    expect(netWorthRangeStart("30d", NOW)?.toISOString()).toBe(
      "2026-07-18T00:00:00.000Z",
    );
    expect(netWorthRangeStart("3m", NOW)?.toISOString()).toBe(
      "2026-05-17T00:00:00.000Z",
    );
    expect(netWorthRangeStart("6m", NOW)?.toISOString()).toBe(
      "2026-02-17T00:00:00.000Z",
    );
    expect(netWorthRangeStart("1y", NOW)?.toISOString()).toBe(
      "2025-08-17T00:00:00.000Z",
    );
    expect(netWorthRangeStart("all", NOW)).toBeNull();
  });

  it("uses stored observations with exact debt subtraction and no current balance backfill", () => {
    const result = calculateNetWorthHistory(
      {
        ownerId: "owner",
        accounts: [
          account({
            id: "cash",
            name: "Cash",
            balanceSnapshots: [
              {
                id: "cash-new",
                currentBalance: money("125.5555"),
                availableBalance: null,
                capturedAt: new Date("2026-08-10T18:30:00.000Z"),
              },
              {
                id: "cash-old",
                currentBalance: money("100.1111"),
                availableBalance: null,
                capturedAt: new Date("2026-08-01T00:00:00.000Z"),
              },
            ],
          }),
          account({
            id: "loan",
            name: "Loan",
            accountType: AccountType.LOAN,
            currentBalance: money("9999"),
            balanceSnapshots: [
              {
                id: "loan",
                currentBalance: money("20.2222"),
                availableBalance: null,
                capturedAt: new Date("2026-08-01T00:00:00.000Z"),
              },
            ],
          }),
        ],
        manualAssets: [],
      },
      "30d",
      NOW,
    );

    expect(result.points.map(({ value }) => value.toFixed(4))).toEqual([
      "79.8889",
      "105.3333",
    ]);
    expect(result.change?.toFixed(4)).toBe("25.4444");
  });

  it("marks manual current values and missing account history as partial", () => {
    const result = calculateNetWorthHistory(
      {
        ownerId: "owner",
        accounts: [account({ id: "no-history", name: "No history" })],
        manualAssets: [
          {
            id: "home",
            userId: "owner",
            name: "Home",
            assetType: "HOME",
            currentValue: money("500000"),
            costBasis: null,
            currency: "USD",
            acquiredAt: null,
            isDebt: false,
            isActive: true,
            notes: null,
            updatedAt: NOW,
          },
        ],
      },
      "30d",
      NOW,
    );
    expect(result.isPartial).toBe(true);
    expect(result.points).toEqual([]);
    expect(result.partialReasons).toHaveLength(3);
  });

  it("retains disconnected observations but does not carry them into later dates", () => {
    const historical = account({
      id: "historical",
      name: "Historical",
      source: AccountSource.SYNCED,
      isActive: false,
      institutionConnection: {
        provider: "PLAID",
        status: ConnectionStatus.DISCONNECTED,
      },
      balanceSnapshots: [
        {
          id: "historical-point",
          currentBalance: money("50"),
          availableBalance: null,
          capturedAt: new Date("2026-08-01T00:00:00.000Z"),
        },
      ],
    });
    const current = account({
      id: "current",
      name: "Current",
      balanceSnapshots: [
        {
          id: "current-old",
          currentBalance: money("10"),
          availableBalance: null,
          capturedAt: new Date("2026-08-01T00:00:00.000Z"),
        },
        {
          id: "current-new",
          currentBalance: money("20"),
          availableBalance: null,
          capturedAt: new Date("2026-08-10T00:00:00.000Z"),
        },
      ],
    });
    const result = calculateNetWorthHistory(
      { ownerId: "owner", accounts: [historical, current], manualAssets: [] },
      "all",
      NOW,
    );
    expect(result.points.map(({ value }) => value.toFixed(0))).toEqual([
      "60",
      "20",
    ]);
  });

  it("excludes cross-owner records", () => {
    const result = calculateNetWorthHistory(
      {
        ownerId: "owner",
        accounts: [
          account({
            id: "other",
            name: "Other",
            userId: "other",
            balanceSnapshots: [
              {
                id: "other-point",
                currentBalance: money("999999"),
                availableBalance: null,
                capturedAt: new Date("2026-08-01T00:00:00.000Z"),
              },
            ],
          }),
        ],
        manualAssets: [],
      },
      "all",
      NOW,
    );
    expect(result.points).toEqual([]);
  });
});
