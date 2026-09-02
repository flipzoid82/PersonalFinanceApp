// @vitest-environment node

import {
  AccountSource,
  AccountType,
  CalendarAmountSource,
  CalendarDateSource,
  CalendarEventStatus,
  CalendarEventType,
  ConfidenceLevel,
  ConnectionStatus,
  DataSourceStatus,
  DataSourceType,
  FinancialRole,
  EconomicDirection,
  InvestmentSource,
  Prisma,
  TransactionStatus,
} from "@prisma/client";
import { describe, expect, it } from "vitest";
import { calculateDashboard } from "./calculations";
import type {
  DashboardAccount,
  DashboardCalendarEvent,
  DashboardTransaction,
  RawDashboardData,
} from "./types";

const NOW = new Date("2026-07-21T12:00:00.000Z");
const money = (value: string | number) => new Prisma.Decimal(value);

function account(
  id: string,
  accountType: AccountType,
  balance: string,
  options: Partial<DashboardAccount> = {},
): DashboardAccount {
  return {
    id,
    userId: "owner",
    name: id,
    institutionName: "Example Bank",
    accountType,
    source: AccountSource.SYNCED,
    currency: "USD",
    currentBalance: money(balance),
    availableBalance: null,
    creditLimit: null,
    isActive: true,
    lastSyncedAt: NOW,
    lastImportedAt: null,
    updatedAt: NOW,
    dataSource: {
      id: "source",
      displayName: "Example Source",
      sourceType: DataSourceType.PLAID,
      status: DataSourceStatus.ACTIVE,
      lastUpdatedAt: NOW,
    },
    institutionConnection: {
      status: ConnectionStatus.ACTIVE,
      lastSuccessfulSyncAt: NOW,
    },
    ...options,
  };
}

function transaction(
  id: string,
  amount: string,
  role: FinancialRole | null,
  options: Partial<DashboardTransaction> = {},
): DashboardTransaction {
  return {
    id,
    userId: "owner",
    originalName: id,
    merchantName: id,
    amount: money(amount),
    currency: "USD",
    authorizedAt: null,
    postedAt: new Date("2026-07-15T00:00:00.000Z"),
    status: TransactionStatus.POSTED,
    providerCategory: "Provider category",
    account: { id: "checking", userId: "owner", name: "Checking" },
    override: {
      merchantNameOverride: null,
      categoryOverride: "Groceries",
      financialRoleOverride: role,
      economicDirectionOverride:
        role === FinancialRole.INCOME || role === FinancialRole.REFUND
          ? EconomicDirection.INFLOW
          : EconomicDirection.OUTFLOW,
      reviewedAt: NOW,
      excludedFromReports: false,
    },
    ...options,
  };
}

function calendarEvent(
  id: string,
  daysFromNow: number,
  options: Partial<DashboardCalendarEvent> = {},
): DashboardCalendarEvent {
  const eventDate = new Date(NOW);
  eventDate.setUTCHours(0, 0, 0, 0);
  eventDate.setUTCDate(eventDate.getUTCDate() + daysFromNow);
  return {
    id,
    userId: "owner",
    title: id,
    eventType: CalendarEventType.BILL,
    eventDate,
    predictedPostingDate: null,
    expectedAmount: money("50"),
    currency: "USD",
    dateSource: CalendarDateSource.INFERRED,
    amountSource: CalendarAmountSource.ESTIMATED,
    confidenceLevel: ConfidenceLevel.HIGH,
    status: CalendarEventStatus.PREDICTED,
    isUserConfirmed: false,
    account: { name: "Checking" },
    overrides: [],
    ...options,
  };
}

function data(overrides: Partial<RawDashboardData> = {}): RawDashboardData {
  return {
    ownerId: "owner",
    accounts: [],
    transactions: [],
    calendarEvents: [],
    investmentSnapshots: [],
    holdings: [],
    balanceSnapshots: [],
    manualAssets: [],
    dataSources: [],
    ...overrides,
  };
}

describe("dashboard financial calculations", () => {
  it("includes only checking and savings in cash and only cards in card debt", () => {
    const result = calculateDashboard(
      data({
        accounts: [
          account("checking", AccountType.CHECKING, "100", {
            availableBalance: money("80"),
          }),
          account("savings", AccountType.SAVINGS, "200", {
            availableBalance: money("190"),
          }),
          account("card", AccountType.CREDIT_CARD, "50", {
            creditLimit: money("1000"),
          }),
          account("loan", AccountType.LOAN, "70"),
          account("mortgage", AccountType.MORTGAGE, "100"),
          account("brokerage", AccountType.BROKERAGE, "999"),
        ],
      }),
      NOW,
    );

    expect(result.metrics.cash.toString()).toBe("300");
    expect(result.metrics.availableCash?.toString()).toBe("270");
    expect(result.metrics.cardDebt.toString()).toBe("50");
    expect(result.metrics.creditUtilization?.toString()).toBe("5");
  });

  it("uses the latest investment snapshot per account without adding holdings", () => {
    const result = calculateDashboard(
      data({
        accounts: [
          account("brokerage", AccountType.BROKERAGE, "1000"),
          account("retirement", AccountType.FOUR_O_ONE_K, "500", {
            source: AccountSource.MANUAL,
          }),
        ],
        investmentSnapshots: [
          {
            id: "old",
            userId: "owner",
            accountId: "brokerage",
            totalValue: money("900"),
            source: InvestmentSource.IMPORTED,
            asOfDate: new Date("2026-07-10T00:00:00.000Z"),
          },
          {
            id: "latest",
            userId: "owner",
            accountId: "brokerage",
            totalValue: money("1100"),
            source: InvestmentSource.IMPORTED,
            asOfDate: new Date("2026-07-20T00:00:00.000Z"),
          },
        ],
        holdings: [
          {
            id: "holding",
            userId: "owner",
            accountId: "brokerage",
            securityName: "Synthetic Fund",
            tickerSymbol: "TESTX",
            currentValue: money("750"),
            source: InvestmentSource.IMPORTED,
            asOfDate: NOW,
          },
        ],
      }),
      NOW,
    );

    expect(result.metrics.investments.toString()).toBe("1600");
  });

  it("includes investment/manual assets and subtracts account/manual debts", () => {
    const result = calculateDashboard(
      data({
        accounts: [
          account("checking", AccountType.CHECKING, "300"),
          account("brokerage", AccountType.BROKERAGE, "1000"),
          account("card", AccountType.CREDIT_CARD, "50"),
          account("loan", AccountType.LOAN, "70"),
          account("manual-account-asset", AccountType.MANUAL_ASSET, "30"),
        ],
        manualAssets: [
          {
            id: "home",
            userId: "owner",
            name: "Home",
            currentValue: money("2000"),
            currency: "USD",
            isDebt: false,
            updatedAt: NOW,
          },
          {
            id: "mortgage",
            userId: "owner",
            name: "Mortgage",
            currentValue: money("500"),
            currency: "USD",
            isDebt: true,
            updatedAt: NOW,
          },
        ],
      }),
      NOW,
    );

    expect(result.metrics.netWorth.toString()).toBe("2710");
  });

  it("excludes pending, transfers, card payments, and report-excluded expenses", () => {
    const result = calculateDashboard(
      data({
        transactions: [
          transaction("income", "1000", FinancialRole.INCOME),
          transaction("expense", "100", FinancialRole.EXPENSE),
          transaction("refund", "20", FinancialRole.REFUND),
          transaction("transfer", "400", FinancialRole.TRANSFER),
          transaction("card-payment", "300", FinancialRole.CREDIT_CARD_PAYMENT),
          transaction("pending", "500", FinancialRole.EXPENSE, {
            status: TransactionStatus.PENDING,
            postedAt: null,
            authorizedAt: NOW,
          }),
          transaction("excluded", "90", FinancialRole.EXPENSE, {
            override: {
              merchantNameOverride: null,
              categoryOverride: "Groceries",
              financialRoleOverride: FinancialRole.EXPENSE,
              excludedFromReports: true,
            },
          }),
        ],
      }),
      NOW,
    );

    expect(result.metrics.income.toString()).toBe("1000");
    expect(result.metrics.spending.toString()).toBe("80");
    expect(result.metrics.cashFlow.toString()).toBe("920");
  });

  it("applies merchant, role, and category overrides", () => {
    const result = calculateDashboard(
      data({
        transactions: [
          transaction("source-name", "45", FinancialRole.EXPENSE, {
            merchantName: "Provider merchant",
            providerCategory: "Provider category",
            override: {
              merchantNameOverride: "Corrected merchant",
              categoryOverride: "Home",
              financialRoleOverride: FinancialRole.EXPENSE,
              excludedFromReports: false,
            },
          }),
        ],
      }),
      NOW,
    );

    expect(result.recentTransactions[0]).toMatchObject({
      name: "Corrected merchant",
      category: "Home",
      role: FinancialRole.EXPENSE,
    });
    expect(result.spendingCategories[0]).toMatchObject({ category: "Home" });
  });

  it("uses an inclusive 14-day window and keeps confirmed/predicted labels distinct", () => {
    const result = calculateDashboard(
      data({
        calendarEvents: [
          calendarEvent("predicted", 1, {
            status: CalendarEventStatus.OVERDUE,
          }),
          calendarEvent("confirmed", 7, {
            dateSource: CalendarDateSource.USER_CONFIRMED,
            status: CalendarEventStatus.CONFIRMED,
            isUserConfirmed: true,
          }),
          calendarEvent("boundary", 14),
          calendarEvent("outside", 15),
        ],
      }),
      NOW,
    );

    expect(result.upcoming.map(({ id }) => id)).toEqual([
      "predicted",
      "confirmed",
      "boundary",
    ]);
    expect(result.upcomingConfirmedCount).toBe(1);
    expect(result.upcomingPredictedCount).toBe(2);
    expect(result.upcoming[0]).toMatchObject({
      dateLabel: "Predicted",
      status: CalendarEventStatus.PREDICTED,
    });
  });

  it("does not allow records owned by another user into totals", () => {
    const result = calculateDashboard(
      data({
        accounts: [
          account("owned", AccountType.CHECKING, "100"),
          account("other", AccountType.CHECKING, "9999", { userId: "other" }),
        ],
        transactions: [
          transaction("owned-income", "50", FinancialRole.INCOME),
          transaction("other-income", "9999", FinancialRole.INCOME, {
            userId: "other",
            account: { id: "other", userId: "other", name: "Other" },
          }),
        ],
      }),
      NOW,
    );

    expect(result.metrics.cash.toString()).toBe("100");
    expect(result.metrics.income.toString()).toBe("50");
  });

  it("derives empty, stale, and partial states without inventing zero data", () => {
    expect(calculateDashboard(data(), NOW).isEmpty).toBe(true);
    const stale = calculateDashboard(
      data({
        accounts: [
          account("checking", AccountType.CHECKING, "10", {
            lastSyncedAt: new Date("2026-07-01T00:00:00.000Z"),
            updatedAt: new Date("2026-07-01T00:00:00.000Z"),
          }),
        ],
        dataSources: [
          {
            id: "source",
            userId: "owner",
            displayName: "Stale Source",
            sourceType: DataSourceType.MANUAL,
            status: DataSourceStatus.ACTIVE,
            lastUpdatedAt: new Date("2026-07-01T00:00:00.000Z"),
            institutionConnections: [],
          },
        ],
      }),
      NOW,
    );
    expect(stale.sourceHealth[0].statusLabel).toBe("Stale");

    const partial = calculateDashboard(
      data({
        accounts: [account("checking", AccountType.CHECKING, "10")],
        dataSources: [
          {
            id: "source",
            userId: "owner",
            displayName: "Incomplete Source",
            sourceType: DataSourceType.PLAID,
            status: DataSourceStatus.NEEDS_ATTENTION,
            lastUpdatedAt: NOW,
            institutionConnections: [],
          },
        ],
      }),
      NOW,
    );
    expect(partial.isPartial).toBe(true);
    expect(partial.sourceHealth[0].statusLabel).toBe("Partial");
  });

  it("keeps replaced Plaid Items out of current source health when a replacement is active", () => {
    const result = calculateDashboard(
      data({
        accounts: [account("checking", AccountType.CHECKING, "10")],
        dataSources: [
          {
            id: "historical",
            userId: "owner",
            displayName: "Sandbox Bank (Plaid Sandbox)",
            sourceType: DataSourceType.PLAID,
            status: DataSourceStatus.INACTIVE,
            lastUpdatedAt: NOW,
            institutionConnections: [
              {
                status: ConnectionStatus.DISCONNECTED,
                lastSuccessfulSyncAt: NOW,
              },
            ],
          },
          {
            id: "current",
            userId: "owner",
            displayName: "Sandbox Bank (Plaid Sandbox)",
            sourceType: DataSourceType.PLAID,
            status: DataSourceStatus.ACTIVE,
            lastUpdatedAt: NOW,
            institutionConnections: [
              {
                status: ConnectionStatus.ACTIVE,
                lastSuccessfulSyncAt: NOW,
              },
            ],
          },
        ],
      }),
      NOW,
    );

    expect(result.sourceHealth).toHaveLength(1);
    expect(result.sourceHealth[0]).toMatchObject({
      id: "current",
      statusLabel: "Current",
    });
    expect(result.partialReasons).not.toContain(
      "Sandbox Bank (Plaid Sandbox) is disconnected or needs attention.",
    );
  });
});
