import {
  AccountSource,
  AccountType,
  DataSourceStatus,
  InvestmentSource,
  InvestmentTransactionType,
  Prisma,
} from "@prisma/client";
import { describe, expect, it } from "vitest";
import { calculateInvestmentInsights } from "./investment-insights";
import type { PortfolioAccount } from "./types";

const NOW = new Date("2026-08-17T12:00:00.000Z");
const money = (value: string) => new Prisma.Decimal(value);

function investment(
  input: Partial<PortfolioAccount> & Pick<PortfolioAccount, "id" | "name">,
): PortfolioAccount {
  return {
    userId: "owner",
    dataSourceId: "source",
    institutionName: "Example Investments",
    accountType: AccountType.BROKERAGE,
    accountSubtype: "brokerage",
    source: AccountSource.IMPORTED,
    currency: "USD",
    currentBalance: money("100"),
    balanceAvailable: true,
    availableBalance: null,
    creditLimit: null,
    isManual: false,
    isActive: true,
    lastSyncedAt: null,
    lastImportedAt: NOW,
    notes: null,
    updatedAt: NOW,
    dataSource: {
      displayName: "Example source",
      status: DataSourceStatus.ACTIVE,
      lastUpdatedAt: NOW,
    },
    institutionConnection: null,
    balanceSnapshots: [],
    investmentSnapshots: [
      {
        id: "snapshot",
        totalValue: money("100"),
        vestedValue: null,
        source: InvestmentSource.IMPORTED,
        asOfDate: NOW,
        notes: null,
      },
    ],
    investmentHoldings: [],
    investmentTransactions: [],
    ...input,
    id: input.id,
    name: input.name,
  };
}

describe("investment insights", () => {
  it("uses account values as the allocation denominator and never adds holdings", () => {
    const account = investment({
      id: "account",
      name: "Brokerage",
      investmentHoldings: [
        {
          id: "fund",
          securityName: "Example Fund",
          tickerSymbol: "EXMPL",
          securityType: "fund",
          quantity: money("2"),
          price: money("30"),
          currentValue: money("60"),
          costBasis: null,
          vestedQuantity: null,
          vestedValue: null,
          currency: "USD",
          source: InvestmentSource.IMPORTED,
          asOfDate: NOW,
        },
      ],
    });
    const result = calculateInvestmentInsights(
      { investmentAccounts: [account], totalInvestments: money("100") },
      NOW,
    );
    expect(result.accountAllocation[0].percentage?.toString()).toBe("100");
    expect(result.knownHoldingsValue.toFixed(4)).toBe("60.0000");
    expect(result.unallocatedValue.toFixed(4)).toBe("40.0000");
    expect(
      result.holdingAllocation
        .reduce((total, item) => total.plus(item.value), money("0"))
        .toFixed(4),
    ).toBe("100.0000");
  });

  it("treats missing or date-misaligned holdings as explicitly unallocated", () => {
    const missing = investment({ id: "missing", name: "Missing" });
    const staleDetail = investment({
      id: "stale",
      name: "Stale detail",
      investmentHoldings: [
        {
          id: "old-fund",
          securityName: "Old Fund",
          tickerSymbol: null,
          securityType: null,
          quantity: null,
          price: null,
          currentValue: money("80"),
          costBasis: null,
          vestedQuantity: null,
          vestedValue: null,
          currency: "USD",
          source: InvestmentSource.IMPORTED,
          asOfDate: new Date("2026-08-10T00:00:00.000Z"),
        },
      ],
    });
    const result = calculateInvestmentInsights(
      {
        investmentAccounts: [missing, staleDetail],
        totalInvestments: money("200"),
      },
      NOW,
    );
    expect(result.knownHoldingsValue.isZero()).toBe(true);
    expect(result.unallocatedValue.toFixed(0)).toBe("200");
    expect(
      result.accounts.every(
        ({ holdingsAlignedToValue }) => !holdingsAlignedToValue,
      ),
    ).toBe(true);
  });

  it("shows only explicit contributions and excludes gains, dividends, transfers, and fees", () => {
    const transactions = [
      ["contribution", InvestmentTransactionType.CONTRIBUTION, "25"],
      ["dividend", InvestmentTransactionType.DIVIDEND, "5"],
      ["buy", InvestmentTransactionType.BUY, "20"],
      ["transfer", InvestmentTransactionType.TRANSFER, "30"],
      ["fee", InvestmentTransactionType.FEE, "2"],
      ["other", InvestmentTransactionType.OTHER, "100"],
    ].map(([id, transactionType, amount]) => ({
      id: String(id),
      source: InvestmentSource.IMPORTED,
      transactionDate: NOW,
      transactionType: transactionType as InvestmentTransactionType,
      securityName: null,
      tickerSymbol: null,
      amount: money(String(amount)),
      quantity: null,
      price: null,
      fees: null,
      currency: "USD",
    }));
    const account = investment({
      id: "account",
      name: "Retirement",
      investmentTransactions: transactions,
    });
    const result = calculateInvestmentInsights(
      { investmentAccounts: [account], totalInvestments: money("100") },
      NOW,
    );
    expect(result.contributions.map(({ id }) => id)).toEqual(["contribution"]);
    expect(result.contributionTotal.toFixed(0)).toBe("25");
  });
});
