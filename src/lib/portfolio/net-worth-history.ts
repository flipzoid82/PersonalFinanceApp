import { Prisma } from "@prisma/client";
import { isCurrentConnectedAccount } from "@/lib/accounts/current";
import { startOfUtcDay } from "@/lib/dashboard/dates";
import { DEBT_ACCOUNT_TYPES, INVESTMENT_ACCOUNT_TYPES } from "./constants";
import type {
  NetWorthHistory,
  NetWorthRange,
  PortfolioAccount,
  RawPortfolioData,
} from "./types";

const ZERO = new Prisma.Decimal(0);

export const NET_WORTH_RANGES: Array<{
  value: NetWorthRange;
  label: string;
}> = [
  { value: "30d", label: "30D" },
  { value: "3m", label: "3M" },
  { value: "6m", label: "6M" },
  { value: "1y", label: "1Y" },
  { value: "all", label: "All" },
];

export function parseNetWorthRange(value: string | undefined): NetWorthRange {
  return NET_WORTH_RANGES.some((range) => range.value === value)
    ? (value as NetWorthRange)
    : "30d";
}

function subtractUtcMonths(date: Date, months: number) {
  const day = date.getUTCDate();
  const result = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - months, 1),
  );
  const lastDay = new Date(
    Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0),
  ).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return startOfUtcDay(result);
}

export function netWorthRangeStart(range: NetWorthRange, now: Date) {
  const today = startOfUtcDay(now);
  if (range === "all") return null;
  if (range === "30d") {
    const start = new Date(today);
    start.setUTCDate(start.getUTCDate() - 30);
    return start;
  }
  return subtractUtcMonths(today, range === "3m" ? 3 : range === "6m" ? 6 : 12);
}

function latestHistoricalValue(account: PortfolioAccount, date: Date) {
  if (INVESTMENT_ACCOUNT_TYPES.has(account.accountType)) {
    const snapshot = account.investmentSnapshots
      .filter((candidate) => startOfUtcDay(candidate.asOfDate) <= date)
      .sort((a, b) => b.asOfDate.getTime() - a.asOfDate.getTime())[0];
    return snapshot
      ? { value: snapshot.totalValue.abs(), date: snapshot.asOfDate }
      : null;
  }
  const snapshot = account.balanceSnapshots
    .filter((candidate) => startOfUtcDay(candidate.capturedAt) <= date)
    .sort((a, b) => b.capturedAt.getTime() - a.capturedAt.getTime())[0];
  return snapshot
    ? { value: snapshot.currentBalance.abs(), date: snapshot.capturedAt }
    : null;
}

function latestStoredDate(account: PortfolioAccount) {
  const dates = INVESTMENT_ACCOUNT_TYPES.has(account.accountType)
    ? account.investmentSnapshots.map(({ asOfDate }) => asOfDate)
    : account.balanceSnapshots.map(({ capturedAt }) => capturedAt);
  return dates.sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
}

export function calculateNetWorthHistory(
  data: RawPortfolioData,
  range: NetWorthRange,
  now = new Date(),
): NetWorthHistory {
  const accounts = data.accounts.filter(
    ({ userId }) => userId === data.ownerId,
  );
  const start = netWorthRangeStart(range, now);
  const observationDates = [
    ...new Set(
      accounts.flatMap((account) => [
        ...account.balanceSnapshots.map(({ capturedAt }) =>
          startOfUtcDay(capturedAt).getTime(),
        ),
        ...account.investmentSnapshots.map(({ asOfDate }) =>
          startOfUtcDay(asOfDate).getTime(),
        ),
      ]),
    ),
  ]
    .filter(
      (time) => (!start || time >= start.getTime()) && time <= now.getTime(),
    )
    .sort((a, b) => a - b)
    .map((time) => new Date(time));

  const points = observationDates.map((date) => {
    let assets = ZERO;
    let debts = ZERO;
    for (const account of accounts) {
      const historical = latestHistoricalValue(account, date);
      if (!historical) continue;

      // A retained historical account remains valid through its last stored
      // observation, but is never carried into later current periods.
      const lastStored = latestStoredDate(account);
      if (
        !isCurrentConnectedAccount(account) &&
        lastStored &&
        date > startOfUtcDay(lastStored)
      )
        continue;

      if (DEBT_ACCOUNT_TYPES.has(account.accountType))
        debts = debts.plus(historical.value);
      else assets = assets.plus(historical.value);
    }
    return { date, assets, debts, value: assets.minus(debts) };
  });

  const partialReasons: string[] = [];
  if (
    data.manualAssets.some(
      ({ userId, isActive }) => userId === data.ownerId && isActive,
    )
  )
    partialReasons.push(
      "Current manual assets or debts do not have stored historical snapshots.",
    );
  if (
    accounts.some(
      (account) =>
        isCurrentConnectedAccount(account) && !latestStoredDate(account),
    )
  )
    partialReasons.push(
      "Some current accounts do not have stored historical snapshots.",
    );
  else if (
    observationDates.some((date) =>
      accounts.some(
        (account) =>
          isCurrentConnectedAccount(account) &&
          !latestHistoricalValue(account, date),
      ),
    )
  )
    partialReasons.push(
      "Some current accounts do not cover the full selected history range.",
    );
  if (!points.length)
    partialReasons.push(
      "No stored account history is available in this range.",
    );

  const rangeLabel =
    NET_WORTH_RANGES.find(({ value }) => value === range)?.label ?? "30D";
  return {
    range,
    rangeLabel,
    points,
    isPartial: partialReasons.length > 0,
    partialReasons,
    change:
      points.length >= 2 ? points.at(-1)!.value.minus(points[0].value) : null,
  };
}
