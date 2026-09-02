import "server-only";
import {
  CalendarAmountSource,
  CalendarDateSource,
  CalendarEventStatus,
  CalendarEventType,
  ConfidenceLevel,
  type Prisma,
  PrismaClient,
  RecurringFlowType,
  RecurringFrequency,
  RecurringStatus,
  TransactionStatus,
} from "@prisma/client";
import { db } from "@/lib/db";
import { currentAccountWhere } from "@/lib/accounts/current";
import { parseIsoDate } from "./dates";
import { getEffectiveCalendarEvent } from "./effective";
import { scoreTransactionMatch } from "./matching";
import type { CalendarOverrideValue, RawCalendarEvent } from "./types";
import type { EventActionInput, ManualEventInput } from "./validation";

type Client = PrismaClient | Prisma.TransactionClient;

async function ownedEvent(client: Client, ownerId: string, eventId: string) {
  const event = await client.calendarEvent.findFirst({
    where: { id: eventId, userId: ownerId },
    include: {
      account: {
        select: {
          id: true,
          userId: true,
          name: true,
          dataSource: { select: { status: true, lastUpdatedAt: true } },
        },
      },
      linkedTransaction: {
        include: {
          override: { select: { financialRoleOverride: true } },
          classification: { select: { financialRole: true } },
        },
      },
      overrides: { where: { userId: ownerId }, orderBy: { updatedAt: "desc" } },
      recurringStream: {
        include: {
          calendarOverrides: {
            where: { userId: ownerId },
            orderBy: { updatedAt: "desc" },
          },
          calendarEvents: {
            where: { userId: ownerId, linkedTransactionId: { not: null } },
            orderBy: { eventDate: "desc" },
            take: 1,
            include: {
              linkedTransaction: {
                include: {
                  override: { select: { financialRoleOverride: true } },
                  classification: { select: { financialRole: true } },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!event) throw new Error("Calendar event not found.");
  return event;
}

function snapshot(
  current: CalendarOverrideValue | undefined,
  patch: Partial<{
    confirmedDueDate: Date | null;
    expectedAmountOverride: Prisma.Decimal | null;
    frequencyOverride: RecurringFrequency | null;
    statusOverride: CalendarEventStatus | null;
    notABill: boolean;
    notes: string | null;
  }>,
) {
  return {
    confirmedDueDate: current?.confirmedDueDate ?? null,
    expectedAmountOverride: current?.expectedAmountOverride ?? null,
    frequencyOverride: current?.frequencyOverride ?? null,
    statusOverride: current?.statusOverride ?? null,
    notABill: current?.notABill ?? false,
    notes: current?.notes ?? null,
    ...patch,
  };
}

async function appendEventOverride(
  client: Client,
  ownerId: string,
  eventId: string,
  current: CalendarOverrideValue | undefined,
  patch: Parameters<typeof snapshot>[1],
) {
  return client.calendarOverride.create({
    data: {
      userId: ownerId,
      calendarEventId: eventId,
      ...snapshot(current, patch),
    },
  });
}

export async function applyCalendarEventAction(
  ownerId: string,
  input: EventActionInput,
  client: Client = db,
) {
  const event = await ownedEvent(client, ownerId, input.eventId);
  const current = event.overrides[0];
  switch (input.intent) {
    case "confirm":
    case "correct-date":
      await appendEventOverride(client, ownerId, event.id, current, {
        confirmedDueDate: parseIsoDate(input.date)!,
        statusOverride: CalendarEventStatus.CONFIRMED,
      });
      return input.intent === "confirm"
        ? "Prediction confirmed."
        : "Due date corrected.";
    case "correct-amount":
      await appendEventOverride(client, ownerId, event.id, current, {
        expectedAmountOverride: input.amount,
      });
      return "Expected amount corrected.";
    case "correct-frequency":
      await appendEventOverride(client, ownerId, event.id, current, {
        frequencyOverride: input.frequency,
      });
      return "Frequency corrected.";
    case "mark-paid":
      await appendEventOverride(client, ownerId, event.id, current, {
        statusOverride: CalendarEventStatus.PAID,
      });
      return "Event marked paid.";
    case "mark-skipped":
      await appendEventOverride(client, ownerId, event.id, current, {
        statusOverride: CalendarEventStatus.SKIPPED,
      });
      return "Event marked skipped.";
    case "not-a-bill":
      await appendEventOverride(client, ownerId, event.id, current, {
        notABill: true,
        statusOverride: CalendarEventStatus.INACTIVE,
      });
      return "Event marked as not a bill.";
    case "notes":
      await appendEventOverride(client, ownerId, event.id, current, {
        notes: input.notes || null,
      });
      return "Notes updated.";
  }
}

export async function deactivateRecurringStream(
  ownerId: string,
  streamId: string,
  client: Client = db,
) {
  const stream = await client.recurringStream.findFirst({
    where: { id: streamId, userId: ownerId },
    include: {
      calendarOverrides: {
        where: { userId: ownerId },
        orderBy: { updatedAt: "desc" },
        take: 1,
      },
    },
  });
  if (!stream) throw new Error("Recurring stream not found.");
  await client.calendarOverride.create({
    data: {
      userId: ownerId,
      recurringStreamId: stream.id,
      ...snapshot(stream.calendarOverrides[0], {
        statusOverride: CalendarEventStatus.INACTIVE,
      }),
    },
  });
  return "Recurring stream deactivated.";
}

const FLOW_BY_EVENT: Record<CalendarEventType, RecurringFlowType> = {
  BILL: RecurringFlowType.BILL,
  SUBSCRIPTION: RecurringFlowType.SUBSCRIPTION,
  DEBT_PAYMENT: RecurringFlowType.DEBT_PAYMENT,
  CREDIT_CARD_PAYMENT: RecurringFlowType.CREDIT_CARD_PAYMENT,
  EXPECTED_INCOME: RecurringFlowType.EXPECTED_INCOME,
  OTHER_RECURRING: RecurringFlowType.OTHER,
};

export async function createManualRecurringEvent(
  ownerId: string,
  input: ManualEventInput,
  client: PrismaClient = db,
) {
  const date = parseIsoDate(input.date)!;
  if (input.accountId) {
    const account = await client.account.findFirst({
      where: { id: input.accountId, ...currentAccountWhere(ownerId) },
      select: { id: true },
    });
    if (!account) throw new Error("Selected account is unavailable.");
  }
  return client.$transaction(async (tx) => {
    const confirmed = input.dateKind === "confirmed";
    const stream = await tx.recurringStream.create({
      data: {
        userId: ownerId,
        merchantName: input.name,
        description: input.notes || `Manual recurring event: ${input.name}`,
        flowType: FLOW_BY_EVENT[input.eventType],
        frequency: input.frequency,
        averageAmount: input.amount,
        lastAmount: input.amount,
        firstDate: date,
        lastDate: date,
        predictedNextDate: date,
        predictedPostingDate: confirmed ? null : date,
        confirmedDueDate: confirmed ? date : null,
        dateSource: CalendarDateSource.MANUAL,
        confidenceLevel: confirmed
          ? ConfidenceLevel.HIGH
          : ConfidenceLevel.MEDIUM,
        isActive: true,
        status: RecurringStatus.ACTIVE,
        typicalAccountId: input.accountId,
      },
    });
    return tx.calendarEvent.create({
      data: {
        userId: ownerId,
        recurringStreamId: stream.id,
        accountId: input.accountId,
        eventType: input.eventType,
        title: input.name,
        eventDate: date,
        predictedPostingDate: confirmed ? null : date,
        expectedAmount: input.amount,
        currency: input.currency,
        dateSource: CalendarDateSource.MANUAL,
        amountSource: CalendarAmountSource.MANUAL,
        confidenceLevel: confirmed
          ? ConfidenceLevel.HIGH
          : ConfidenceLevel.MEDIUM,
        status: confirmed
          ? CalendarEventStatus.CONFIRMED
          : CalendarEventStatus.PREDICTED,
        isUserConfirmed: confirmed,
        notes: input.notes || null,
      },
    });
  });
}

export async function acceptPaymentMatch(
  ownerId: string,
  eventId: string,
  transactionId: string,
  confirmLowConfidence: boolean,
  client: PrismaClient = db,
) {
  return client.$transaction(async (tx) => {
    const event = await ownedEvent(tx, ownerId, eventId);
    if (event.linkedTransactionId)
      throw new Error("This event is already paid.");
    const transaction = await tx.transaction.findFirst({
      where: {
        id: transactionId,
        userId: ownerId,
        status: TransactionStatus.POSTED,
      },
      include: {
        override: { select: { financialRoleOverride: true } },
        classification: { select: { financialRole: true } },
      },
    });
    if (!transaction) throw new Error("Posted transaction not found.");
    const used = await tx.calendarEvent.count({
      where: { userId: ownerId, linkedTransactionId: transaction.id },
    });
    if (used) throw new Error("That transaction is already matched.");
    const effective = getEffectiveCalendarEvent(
      event as unknown as RawCalendarEvent,
    );
    const candidate = scoreTransactionMatch(effective, transaction);
    if (!candidate || candidate.score < 0.35)
      throw new Error("The transaction is not a suitable match.");
    if (candidate.requiresConfirmation && !confirmLowConfidence)
      throw new Error("This match requires explicit confirmation.");
    await tx.calendarEvent.update({
      where: { id: event.id },
      data: {
        linkedTransactionId: transaction.id,
        actualAmount: transaction.amount.abs(),
      },
    });
    await appendEventOverride(tx, ownerId, event.id, event.overrides[0], {
      statusOverride: CalendarEventStatus.PAID,
    });
    return "Posted transaction accepted as payment.";
  });
}
