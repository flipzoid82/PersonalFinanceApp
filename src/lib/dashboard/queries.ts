import "server-only";
import { CalendarEventStatus, TransactionStatus } from "@prisma/client";
import { db } from "@/lib/db";
import {
  addUtcDays,
  startOfNextUtcMonth,
  startOfUtcDay,
  startOfUtcMonth,
} from "./dates";
import type { RawDashboardData } from "./types";

export async function getDashboardData(
  ownerId: string,
  now = new Date(),
): Promise<RawDashboardData> {
  const today = startOfUtcDay(now);
  const recentStart = addUtcDays(now, -30);
  const queryStart =
    startOfUtcMonth(now) < recentStart ? startOfUtcMonth(now) : recentStart;
  const upcomingEnd = addUtcDays(today, 14);
  const [
    accounts,
    transactions,
    calendarEvents,
    investmentSnapshots,
    holdings,
    balanceSnapshots,
    manualAssets,
    dataSources,
  ] = await Promise.all([
    db.account.findMany({
      where: { userId: ownerId, isActive: true },
      include: {
        dataSource: {
          select: {
            id: true,
            displayName: true,
            sourceType: true,
            status: true,
            lastUpdatedAt: true,
          },
        },
        institutionConnection: {
          select: { status: true, lastSuccessfulSyncAt: true },
        },
      },
    }),
    db.transaction.findMany({
      where: {
        userId: ownerId,
        status: { in: [TransactionStatus.POSTED, TransactionStatus.PENDING] },
        OR: [
          { postedAt: { gte: queryStart, lt: startOfNextUtcMonth(now) } },
          { authorizedAt: { gte: recentStart, lte: now } },
        ],
      },
      include: {
        account: { select: { id: true, userId: true, name: true } },
        override: {
          select: {
            merchantNameOverride: true,
            categoryOverride: true,
            financialRoleOverride: true,
            excludedFromReports: true,
          },
        },
      },
    }),
    db.calendarEvent.findMany({
      where: {
        userId: ownerId,
        status: { not: CalendarEventStatus.INACTIVE },
        OR: [
          { eventDate: { gte: today, lte: upcomingEnd } },
          {
            overrides: {
              some: {
                userId: ownerId,
                confirmedDueDate: { gte: today, lte: upcomingEnd },
              },
            },
          },
        ],
      },
      include: {
        account: { select: { name: true } },
        recurringStream: {
          select: {
            isActive: true,
            calendarOverrides: {
              where: { userId: ownerId },
              orderBy: { updatedAt: "desc" },
              take: 1,
              select: {
                confirmedDueDate: true,
                expectedAmountOverride: true,
                statusOverride: true,
                notABill: true,
                updatedAt: true,
              },
            },
          },
        },
        overrides: {
          where: { userId: ownerId },
          orderBy: { updatedAt: "desc" },
          take: 1,
          select: {
            confirmedDueDate: true,
            expectedAmountOverride: true,
            statusOverride: true,
            notABill: true,
            updatedAt: true,
          },
        },
      },
    }),
    db.investmentBalanceSnapshot.findMany({
      where: { userId: ownerId, asOfDate: { lte: now } },
      orderBy: { asOfDate: "asc" },
    }),
    db.investmentHolding.findMany({
      where: { userId: ownerId, asOfDate: { lte: now } },
      orderBy: { currentValue: "desc" },
    }),
    db.balanceSnapshot.findMany({
      where: {
        userId: ownerId,
        capturedAt: { gte: recentStart, lte: now },
      },
      orderBy: { capturedAt: "asc" },
    }),
    db.manualAsset.findMany({ where: { userId: ownerId } }),
    db.dataSource.findMany({
      where: { userId: ownerId },
      include: {
        institutionConnections: {
          where: { userId: ownerId },
          select: { status: true, lastSuccessfulSyncAt: true },
        },
      },
    }),
  ]);

  return {
    ownerId,
    accounts,
    transactions,
    calendarEvents,
    investmentSnapshots,
    holdings,
    balanceSnapshots,
    manualAssets,
    dataSources,
  };
}
