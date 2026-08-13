import "server-only";
import { TransactionStatus } from "@prisma/client";
import { db } from "@/lib/db";
import {
  currentAccountStateWhere,
  currentAccountWhere,
} from "@/lib/accounts/current";
import { addUtcDays, startOfUtcDay } from "./dates";
import type { RawCalendarData } from "./types";

const transactionSelect = {
  id: true,
  userId: true,
  accountId: true,
  originalName: true,
  merchantName: true,
  amount: true,
  currency: true,
  postedAt: true,
  status: true,
  override: { select: { financialRoleOverride: true } },
} as const;

const overrideSelect = {
  id: true,
  confirmedDueDate: true,
  expectedAmountOverride: true,
  frequencyOverride: true,
  statusOverride: true,
  notABill: true,
  notes: true,
  updatedAt: true,
} as const;

export async function getCalendarData(
  ownerId: string,
  now = new Date(),
): Promise<RawCalendarData> {
  const transactionStart = addUtcDays(startOfUtcDay(now), -120);
  const [events, transactions, accounts, recurringStreamCount] =
    await Promise.all([
      db.calendarEvent.findMany({
        where: { userId: ownerId },
        include: {
          account: {
            select: {
              id: true,
              userId: true,
              name: true,
              isActive: true,
              institutionConnection: { select: { status: true } },
              dataSource: {
                select: { status: true, lastUpdatedAt: true },
              },
            },
          },
          linkedTransaction: { select: transactionSelect },
          overrides: {
            where: { userId: ownerId },
            orderBy: { updatedAt: "desc" },
            select: overrideSelect,
          },
          recurringStream: {
            include: {
              calendarOverrides: {
                where: { userId: ownerId },
                orderBy: { updatedAt: "desc" },
                select: overrideSelect,
              },
              calendarEvents: {
                where: {
                  userId: ownerId,
                  linkedTransactionId: { not: null },
                },
                orderBy: { eventDate: "desc" },
                take: 1,
                select: {
                  id: true,
                  eventDate: true,
                  linkedTransaction: { select: transactionSelect },
                },
              },
            },
          },
        },
        orderBy: { eventDate: "asc" },
      }),
      db.transaction.findMany({
        where: {
          userId: ownerId,
          status: TransactionStatus.POSTED,
          postedAt: { gte: transactionStart },
          account: {
            userId: ownerId,
            ...currentAccountStateWhere(),
          },
        },
        select: transactionSelect,
        orderBy: { postedAt: "desc" },
      }),
      db.account.findMany({
        where: currentAccountWhere(ownerId),
        select: { id: true, userId: true, name: true, currency: true },
        orderBy: { name: "asc" },
      }),
      db.recurringStream.count({ where: { userId: ownerId } }),
    ]);

  return {
    ownerId,
    events,
    transactions,
    accounts,
    recurringStreamCount,
  };
}
