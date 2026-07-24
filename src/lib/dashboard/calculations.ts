import {
  AccountSource,
  AccountType,
  CalendarAmountSource,
  CalendarDateSource,
  CalendarEventStatus,
  CalendarEventType,
  FinancialRole,
  Prisma,
  TransactionStatus,
} from "@prisma/client";
import {
  addUtcDays,
  startOfNextUtcMonth,
  startOfUtcDay,
  startOfUtcMonth,
} from "./dates";
import { deriveDashboardState } from "./state";
import type {
  DashboardAccount,
  DashboardCalendarEvent,
  DashboardViewModel,
  InvestmentAccountSummary,
  RawDashboardData,
  RecentTransaction,
  SpendingCategory,
  UpcomingActivity,
} from "./types";

const ZERO = new Prisma.Decimal(0);
const CASH_TYPES = new Set<AccountType>([
  AccountType.CHECKING,
  AccountType.SAVINGS,
]);
const INVESTMENT_TYPES = new Set<AccountType>([
  AccountType.BROKERAGE,
  AccountType.RETIREMENT,
  AccountType.FOUR_O_ONE_K,
]);
const DEBT_TYPES = new Set<AccountType>([
  AccountType.CREDIT_CARD,
  AccountType.LOAN,
  AccountType.MORTGAGE,
  AccountType.MANUAL_DEBT,
]);
const UPCOMING_OUTFLOW_TYPES = new Set<CalendarEventType>([
  CalendarEventType.BILL,
  CalendarEventType.SUBSCRIPTION,
  CalendarEventType.DEBT_PAYMENT,
  CalendarEventType.CREDIT_CARD_PAYMENT,
  CalendarEventType.OTHER_RECURRING,
]);

function sum(values: Prisma.Decimal[]) {
  return values.reduce((total, value) => total.plus(value), ZERO);
}

function accountFreshness(account: DashboardAccount) {
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

function effectiveTransaction(
  transaction: RawDashboardData["transactions"][number],
) {
  return {
    name:
      transaction.override?.merchantNameOverride ??
      transaction.merchantName ??
      transaction.originalName,
    category:
      transaction.override?.categoryOverride ??
      transaction.providerCategory ??
      "Uncategorized",
    role: transaction.override?.financialRoleOverride ?? null,
    excluded: transaction.override?.excludedFromReports ?? false,
  };
}

function currentInvestmentAccounts(
  data: RawDashboardData,
  accounts: DashboardAccount[],
  now: Date,
) {
  return accounts
    .filter((account) => INVESTMENT_TYPES.has(account.accountType))
    .map<InvestmentAccountSummary>((account) => {
      const snapshot = data.investmentSnapshots
        .filter(
          (candidate) =>
            candidate.userId === data.ownerId &&
            candidate.accountId === account.id &&
            candidate.asOfDate <= now,
        )
        .sort((a, b) => b.asOfDate.getTime() - a.asOfDate.getTime())[0];
      return {
        id: account.id,
        name: account.name,
        source: account.source,
        value: snapshot?.totalValue ?? account.currentBalance,
        currency: account.currency,
        asOfDate: snapshot?.asOfDate ?? accountFreshness(account),
        valueSource: snapshot ? "Snapshot" : "Account balance",
      };
    });
}

function calculateMonthlyActivity(data: RawDashboardData, now: Date) {
  const monthStart = startOfUtcMonth(now);
  const nextMonth = startOfNextUtcMonth(now);
  let income = ZERO;
  let spending = ZERO;
  const categories = new Map<string, Prisma.Decimal>();

  for (const transaction of data.transactions) {
    if (
      transaction.userId !== data.ownerId ||
      transaction.account.userId !== data.ownerId ||
      transaction.status !== TransactionStatus.POSTED ||
      !transaction.postedAt ||
      transaction.postedAt < monthStart ||
      transaction.postedAt >= nextMonth
    )
      continue;
    const effective = effectiveTransaction(transaction);
    if (effective.excluded || !effective.role) continue;
    const amount = transaction.amount.abs();

    if (effective.role === FinancialRole.INCOME) {
      income = income.plus(amount);
    } else if (effective.role === FinancialRole.EXPENSE) {
      spending = spending.plus(amount);
      categories.set(
        effective.category,
        (categories.get(effective.category) ?? ZERO).plus(amount),
      );
    } else if (effective.role === FinancialRole.REFUND) {
      spending = spending.minus(amount);
      categories.set(
        effective.category,
        (categories.get(effective.category) ?? ZERO).minus(amount),
      );
    }
  }

  const spendingCategories = [...categories.entries()]
    .map<SpendingCategory>(([category, amount]) => ({ category, amount }))
    .filter(({ amount }) => !amount.isZero())
    .sort((a, b) => b.amount.abs().comparedTo(a.amount.abs()));

  return { income, spending, spendingCategories };
}

function recentTransactions(data: RawDashboardData, now: Date) {
  const recentStart = addUtcDays(now, -30);
  return data.transactions
    .filter((transaction) => {
      const date = transaction.postedAt ?? transaction.authorizedAt;
      return (
        transaction.userId === data.ownerId &&
        transaction.account.userId === data.ownerId &&
        Boolean(date && date >= recentStart && date <= now)
      );
    })
    .map<RecentTransaction>((transaction) => {
      const effective = effectiveTransaction(transaction);
      return {
        id: transaction.id,
        name: effective.name,
        accountName: transaction.account.name,
        date: (transaction.postedAt ?? transaction.authorizedAt)!,
        amount: transaction.amount,
        currency: transaction.currency,
        status: transaction.status,
        category: effective.category,
        role: effective.role,
      };
    })
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, 8);
}

function amountSourceLabel(source: CalendarAmountSource) {
  const labels: Record<CalendarAmountSource, string> = {
    [CalendarAmountSource.FIXED]: "Fixed",
    [CalendarAmountSource.ESTIMATED]: "Estimated",
    [CalendarAmountSource.LAST_OBSERVED]: "Last observed",
    [CalendarAmountSource.PROVIDER]: "Provider",
    [CalendarAmountSource.IMPORTED]: "Imported",
    [CalendarAmountSource.MANUAL]: "Manual",
  };
  return labels[source];
}

function effectiveCalendarEvent(
  event: DashboardCalendarEvent,
): UpcomingActivity | null {
  const override = event.overrides[0];
  const streamOverride = event.recurringStream?.calendarOverrides[0];
  if (
    override?.notABill ||
    streamOverride?.notABill ||
    event.recurringStream?.isActive === false
  )
    return null;
  let status =
    override?.statusOverride ?? streamOverride?.statusOverride ?? event.status;
  if (status === CalendarEventStatus.INACTIVE) return null;
  const confirmedDueDate =
    override?.confirmedDueDate ?? streamOverride?.confirmedDueDate;
  const date = confirmedDueDate ?? event.eventDate;
  const dateLabel =
    confirmedDueDate ||
    event.isUserConfirmed ||
    event.dateSource === CalendarDateSource.USER_CONFIRMED ||
    status === CalendarEventStatus.CONFIRMED
      ? "Confirmed"
      : "Predicted";
  if (dateLabel === "Predicted" && status === CalendarEventStatus.OVERDUE)
    status = CalendarEventStatus.PREDICTED;
  return {
    id: event.id,
    title: event.title,
    date,
    predictedPostingDate: event.predictedPostingDate,
    amount:
      override?.expectedAmountOverride ??
      streamOverride?.expectedAmountOverride ??
      event.expectedAmount,
    currency: event.currency,
    dateLabel,
    amountLabel:
      override?.expectedAmountOverride || streamOverride?.expectedAmountOverride
        ? "Manual"
        : amountSourceLabel(event.amountSource),
    status,
    confidence: event.confidenceLevel,
    accountName: event.account?.name ?? null,
  };
}

function upcomingActivity(data: RawDashboardData, now: Date) {
  const today = startOfUtcDay(now);
  const windowEnd = addUtcDays(today, 14);
  const excludedStatuses = new Set<CalendarEventStatus>([
    CalendarEventStatus.PAID,
    CalendarEventStatus.SKIPPED,
    CalendarEventStatus.INACTIVE,
  ]);
  const upcoming = data.calendarEvents
    .filter(
      (event) =>
        event.userId === data.ownerId &&
        UPCOMING_OUTFLOW_TYPES.has(event.eventType),
    )
    .map(effectiveCalendarEvent)
    .filter((event): event is UpcomingActivity => Boolean(event))
    .filter(
      (event) =>
        event.date >= today &&
        event.date <= windowEnd &&
        !excludedStatuses.has(event.status),
    )
    .sort((a, b) => a.date.getTime() - b.date.getTime());
  return {
    upcoming,
    upcomingTotal: sum(
      upcoming.flatMap(({ amount }) => (amount ? [amount.abs()] : [])),
    ),
    upcomingConfirmedCount: upcoming.filter(
      ({ dateLabel }) => dateLabel === "Confirmed",
    ).length,
    upcomingPredictedCount: upcoming.filter(
      ({ dateLabel }) => dateLabel === "Predicted",
    ).length,
  };
}

function netWorthTrend(
  data: RawDashboardData,
  accounts: DashboardAccount[],
  now: Date,
) {
  const start = addUtcDays(startOfUtcDay(now), -30);
  const balances = data.balanceSnapshots.filter(
    (snapshot) =>
      snapshot.userId === data.ownerId &&
      snapshot.capturedAt >= start &&
      snapshot.capturedAt <= now,
  );
  const investments = data.investmentSnapshots.filter(
    (snapshot) =>
      snapshot.userId === data.ownerId &&
      snapshot.asOfDate >= start &&
      snapshot.asOfDate <= now,
  );
  const dates = [
    ...new Set(
      [
        ...balances.map(({ capturedAt }) => capturedAt),
        ...investments.map(({ asOfDate }) => asOfDate),
      ].map((date) => startOfUtcDay(date).getTime()),
    ),
  ]
    .sort((a, b) => a - b)
    .map((time) => new Date(time));
  const accountMap = new Map(accounts.map((account) => [account.id, account]));

  const points = dates.map((date) => {
    let assets = ZERO;
    let debts = ZERO;
    for (const account of accounts) {
      if (INVESTMENT_TYPES.has(account.accountType)) {
        const snapshot = investments
          .filter(
            (candidate) =>
              candidate.accountId === account.id && candidate.asOfDate <= date,
          )
          .sort((a, b) => b.asOfDate.getTime() - a.asOfDate.getTime())[0];
        if (snapshot) assets = assets.plus(snapshot.totalValue.abs());
        continue;
      }
      const snapshot = balances
        .filter(
          (candidate) =>
            candidate.accountId === account.id && candidate.capturedAt <= date,
        )
        .sort((a, b) => b.capturedAt.getTime() - a.capturedAt.getTime())[0];
      if (!snapshot || !accountMap.has(snapshot.accountId)) continue;
      if (DEBT_TYPES.has(account.accountType))
        debts = debts.plus(snapshot.currentBalance.abs());
      else assets = assets.plus(snapshot.currentBalance);
    }
    return { date, value: assets.minus(debts) };
  });

  const missingAccountHistory = accounts.some((account) =>
    INVESTMENT_TYPES.has(account.accountType)
      ? !investments.some(({ accountId }) => accountId === account.id)
      : !balances.some(({ accountId }) => accountId === account.id),
  );
  return {
    points,
    isPartial: data.manualAssets.length > 0 || missingAccountHistory,
  };
}

export function calculateDashboard(
  data: RawDashboardData,
  now = new Date(),
): DashboardViewModel {
  const accounts = data.accounts
    .filter((account) => account.userId === data.ownerId && account.isActive)
    .map((account) => ({
      ...account,
      currentBalance:
        account.balanceSnapshots?.[0]?.currentBalance ?? account.currentBalance,
      availableBalance:
        account.balanceSnapshots?.[0]?.availableBalance ??
        account.availableBalance,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const manualAssets = data.manualAssets.filter(
    ({ userId, isActive }) => userId === data.ownerId && isActive !== false,
  );
  const investmentAccounts = currentInvestmentAccounts(data, accounts, now);
  const cashAccounts = accounts.filter((account) =>
    CASH_TYPES.has(account.accountType),
  );
  const cardAccounts = accounts.filter(
    ({ accountType }) => accountType === AccountType.CREDIT_CARD,
  );
  const cash = sum(cashAccounts.map(({ currentBalance }) => currentBalance));
  const availableValues = cashAccounts.flatMap(({ availableBalance }) =>
    availableBalance ? [availableBalance] : [],
  );
  const availableCash = availableValues.length ? sum(availableValues) : null;
  const cardDebt = sum(
    cardAccounts.map(({ currentBalance }) => currentBalance.abs()),
  );
  const creditLimits = cardAccounts.flatMap(({ creditLimit }) =>
    creditLimit && creditLimit.isPositive() ? [creditLimit] : [],
  );
  const totalCreditLimit = sum(creditLimits);
  const creditUtilization = totalCreditLimit.isPositive()
    ? cardDebt.dividedBy(totalCreditLimit).times(100)
    : null;
  const investments = sum(investmentAccounts.map(({ value }) => value.abs()));
  const otherAccountAssets = sum(
    accounts
      .filter(
        ({ accountType }) =>
          !CASH_TYPES.has(accountType) &&
          !INVESTMENT_TYPES.has(accountType) &&
          !DEBT_TYPES.has(accountType),
      )
      .map(({ currentBalance }) => currentBalance),
  );
  const accountDebts = sum(
    accounts
      .filter(({ accountType }) => DEBT_TYPES.has(accountType))
      .map(({ currentBalance }) => currentBalance.abs()),
  );
  const manualAssetTotal = sum(
    manualAssets
      .filter(({ isDebt }) => !isDebt)
      .map(({ currentValue }) => currentValue),
  );
  const manualDebtTotal = sum(
    manualAssets
      .filter(({ isDebt }) => isDebt)
      .map(({ currentValue }) => currentValue.abs()),
  );
  const netWorth = cash
    .plus(investments)
    .plus(otherAccountAssets)
    .plus(manualAssetTotal)
    .minus(accountDebts)
    .minus(manualDebtTotal);
  const monthly = calculateMonthlyActivity(data, now);
  const upcoming = upcomingActivity(data, now);
  const trend = netWorthTrend(data, accounts, now);
  const state = deriveDashboardState(data, now);
  const isEmpty =
    accounts.length === 0 &&
    manualAssets.length === 0 &&
    data.transactions.filter(({ userId }) => userId === data.ownerId).length ===
      0 &&
    data.calendarEvents.filter(({ userId }) => userId === data.ownerId)
      .length === 0;

  return {
    isEmpty,
    isPartial: state.isPartial,
    partialReasons: state.partialReasons,
    latestDataAt: state.latestDataAt,
    metrics: {
      cash,
      availableCash,
      cardDebt,
      creditUtilization,
      investments,
      netWorth,
      income: monthly.income,
      spending: monthly.spending,
      cashFlow: monthly.income.minus(monthly.spending),
    },
    accounts,
    recentTransactions: recentTransactions(data, now),
    ...upcoming,
    spendingCategories: monthly.spendingCategories,
    investmentAccounts,
    netWorthTrend: trend.points,
    trendIsPartial: trend.isPartial,
    sourceHealth: state.sourceHealth,
  };
}
