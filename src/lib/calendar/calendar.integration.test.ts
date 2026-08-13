// @vitest-environment node

import {
  CalendarAmountSource,
  CalendarDateSource,
  CalendarEventStatus,
  CalendarEventType,
  ConfidenceLevel,
  Prisma,
  PrismaClient,
  RecurringFrequency,
} from "@prisma/client";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

vi.mock("server-only", () => ({}));
import { seedDevelopmentData } from "../../../prisma/seed";
import { calculateDashboard } from "@/lib/dashboard/calculations";
import { getDashboardData } from "@/lib/dashboard/queries";
import { parseCalendarFilters } from "./filters";
import {
  acceptPaymentMatch,
  applyCalendarEventAction,
  createManualRecurringEvent,
  deactivateRecurringStream,
} from "./mutations";
import { getCalendarData } from "./queries";
import { buildCalendarViewModel } from "./view-model";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeDatabase = testDatabaseUrl ? describe : describe.skip;
const reference = new Date("2026-07-21T12:00:00.000Z");
let prisma: PrismaClient;
let ownerId: string;

async function clearTestData() {
  await prisma.calendarOverride.deleteMany();
  await prisma.transactionOverride.deleteMany();
  await prisma.calendarEvent.deleteMany();
  await prisma.investmentHolding.deleteMany();
  await prisma.investmentBalanceSnapshot.deleteMany();
  await prisma.investmentTransaction.deleteMany();
  await prisma.balanceSnapshot.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.recurringStream.deleteMany();
  await prisma.importJob.deleteMany();
  await prisma.account.deleteMany();
  await prisma.institutionConnection.deleteMany();
  await prisma.dataSource.deleteMany();
  await prisma.manualAsset.deleteMany();
  await prisma.authSession.deleteMany();
  await prisma.user.deleteMany();
}

describeDatabase("Milestone 4 calendar integration", () => {
  beforeAll(async () => {
    const url = new URL(testDatabaseUrl!);
    if (!url.pathname.toLowerCase().includes("test"))
      throw new Error("TEST_DATABASE_URL must name an isolated test database.");
    prisma = new PrismaClient({
      datasources: { db: { url: testDatabaseUrl } },
    });
    await prisma.$connect();
  });

  beforeEach(async () => {
    await clearTestData();
    ownerId = (await seedDevelopmentData(prisma, reference)).ownerId;
  });

  afterAll(async () => prisma?.$disconnect());

  it("keeps calendar queries and mutations scoped to the owner", async () => {
    const other = await prisma.user.create({
      data: { email: "calendar-other@example.test", passwordHash: "not-login" },
    });
    await prisma.calendarEvent.create({
      data: {
        id: "other_calendar_event",
        userId: other.id,
        eventType: CalendarEventType.BILL,
        title: "Other owner's bill",
        eventDate: new Date("2026-07-25T00:00:00.000Z"),
        expectedAmount: new Prisma.Decimal("999"),
        dateSource: CalendarDateSource.MANUAL,
        amountSource: CalendarAmountSource.MANUAL,
        confidenceLevel: ConfidenceLevel.HIGH,
        status: CalendarEventStatus.CONFIRMED,
      },
    });
    const data = await getCalendarData(ownerId, reference);
    expect(data.events.some(({ id }) => id === "other_calendar_event")).toBe(
      false,
    );
    await expect(
      applyCalendarEventAction(
        ownerId,
        { intent: "mark-paid", eventId: "other_calendar_event" },
        prisma,
      ),
    ).rejects.toThrow("Calendar event not found.");
  });

  it("builds month and 14/30/60/90-day filtered views", async () => {
    const data = await getCalendarData(ownerId, reference);
    for (const days of [14, 30, 60, 90] as const) {
      const filters = parseCalendarFilters(
        { view: "upcoming", days: String(days) },
        reference,
      );
      const view = buildCalendarViewModel(data, filters, reference);
      expect(
        view.upcomingEvents.every(({ effectiveDate }) => {
          const elapsed =
            (effectiveDate.getTime() - Date.UTC(2026, 6, 21)) / 86_400_000;
          return elapsed >= 0 && elapsed <= days;
        }),
      ).toBe(true);
    }
    const bills = buildCalendarViewModel(
      data,
      parseCalendarFilters(
        { view: "upcoming", types: CalendarEventType.BILL },
        reference,
      ),
      reference,
    );
    expect(
      bills.upcomingEvents.every(
        ({ eventType }) => eventType === CalendarEventType.BILL,
      ),
    ).toBe(true);
    const predicted = buildCalendarViewModel(
      data,
      parseCalendarFilters({ view: "upcoming", kind: "predicted" }, reference),
      reference,
    );
    expect(
      predicted.upcomingEvents.every(
        ({ dateLabel }) => dateLabel === "Predicted",
      ),
    ).toBe(true);
    expect(
      data.events.some(({ id }) => id === "seed_calendar_month_boundary"),
    ).toBe(true);
  });

  it("stores confirmation and date, amount, frequency, status, and note corrections as override snapshots", async () => {
    const eventId = "seed_calendar_predicted";
    await applyCalendarEventAction(
      ownerId,
      { intent: "confirm", eventId, date: "2026-07-26" },
      prisma,
    );
    await applyCalendarEventAction(
      ownerId,
      { intent: "correct-date", eventId, date: "2026-07-27" },
      prisma,
    );
    await applyCalendarEventAction(
      ownerId,
      {
        intent: "correct-amount",
        eventId,
        amount: new Prisma.Decimal("222.22"),
      },
      prisma,
    );
    await applyCalendarEventAction(
      ownerId,
      {
        intent: "correct-frequency",
        eventId,
        frequency: RecurringFrequency.QUARTERLY,
      },
      prisma,
    );
    await applyCalendarEventAction(
      ownerId,
      { intent: "notes", eventId, notes: "Owner correction" },
      prisma,
    );
    const source = await prisma.calendarEvent.findUniqueOrThrow({
      where: { id: eventId },
    });
    const latest = await prisma.calendarOverride.findFirstOrThrow({
      where: { calendarEventId: eventId, userId: ownerId },
      orderBy: { updatedAt: "desc" },
    });
    expect(source.eventDate).toEqual(new Date("2026-07-24T00:00:00.000Z"));
    expect(source.expectedAmount?.toString()).toBe("115.5");
    expect(latest.confirmedDueDate).toEqual(
      new Date("2026-07-27T00:00:00.000Z"),
    );
    expect(latest.expectedAmountOverride?.toString()).toBe("222.22");
    expect(latest.frequencyOverride).toBe(RecurringFrequency.QUARTERLY);
    expect(latest.notes).toBe("Owner correction");
    expect(
      await prisma.calendarOverride.count({
        where: { calendarEventId: eventId },
      }),
    ).toBe(5);
  });

  it("supports paid, skipped, not-a-bill, and stream deactivation without changing source dates", async () => {
    await applyCalendarEventAction(
      ownerId,
      { intent: "mark-paid", eventId: "seed_calendar_subscription" },
      prisma,
    );
    await applyCalendarEventAction(
      ownerId,
      { intent: "mark-skipped", eventId: "seed_calendar_debt" },
      prisma,
    );
    await applyCalendarEventAction(
      ownerId,
      { intent: "not-a-bill", eventId: "seed_calendar_card_payment" },
      prisma,
    );
    await deactivateRecurringStream(ownerId, "seed_recurring_income", prisma);
    const statuses = await prisma.calendarOverride.findMany({
      where: { userId: ownerId },
      orderBy: { updatedAt: "desc" },
    });
    expect(
      statuses.some(
        ({ statusOverride }) => statusOverride === CalendarEventStatus.PAID,
      ),
    ).toBe(true);
    expect(
      statuses.some(
        ({ statusOverride }) => statusOverride === CalendarEventStatus.SKIPPED,
      ),
    ).toBe(true);
    expect(statuses.some(({ notABill }) => notABill)).toBe(true);
    const stream = await prisma.recurringStream.findUniqueOrThrow({
      where: { id: "seed_recurring_income" },
      include: { calendarOverrides: true },
    });
    expect(stream.isActive).toBe(true);
    expect(stream.calendarOverrides[0]?.statusOverride).toBe(
      CalendarEventStatus.INACTIVE,
    );
  });

  it("creates a clearly manual owner-scoped recurring event", async () => {
    const created = await createManualRecurringEvent(
      ownerId,
      {
        name: "Manual rent",
        eventType: CalendarEventType.BILL,
        date: "2026-08-01",
        amount: new Prisma.Decimal("1450"),
        currency: "USD",
        accountId: "seed_account_checking",
        frequency: RecurringFrequency.MONTHLY,
        dateKind: "confirmed",
        notes: "Synthetic manual fixture",
      },
      prisma,
    );
    expect(created.userId).toBe(ownerId);
    expect(created.dateSource).toBe(CalendarDateSource.MANUAL);
    expect(created.amountSource).toBe(CalendarAmountSource.MANUAL);
    expect(created.isUserConfirmed).toBe(true);
  });

  it("requires confirmation for low-confidence matches and links accepted posted payments with actual amount", async () => {
    await acceptPaymentMatch(
      ownerId,
      "seed_calendar_high_match",
      "seed_transaction_calendar_high_match",
      false,
      prisma,
    );
    const high = await prisma.calendarEvent.findUniqueOrThrow({
      where: { id: "seed_calendar_high_match" },
    });
    expect(high.linkedTransactionId).toBe(
      "seed_transaction_calendar_high_match",
    );
    expect(high.actualAmount?.toString()).toBe("79.99");
    await expect(
      acceptPaymentMatch(
        ownerId,
        "seed_calendar_needs_confirmation",
        "seed_transaction_calendar_low_match",
        false,
        prisma,
      ),
    ).rejects.toThrow("requires explicit confirmation");
    await acceptPaymentMatch(
      ownerId,
      "seed_calendar_needs_confirmation",
      "seed_transaction_calendar_low_match",
      true,
      prisma,
    );
    const low = await prisma.calendarEvent.findUniqueOrThrow({
      where: { id: "seed_calendar_needs_confirmation" },
    });
    expect(low.linkedTransactionId).toBe("seed_transaction_calendar_low_match");
    expect(low.actualAmount?.toString()).toBe("101.25");
  });

  it("keeps seed idempotent and preserves Milestone 3 Overview totals", async () => {
    const before = {
      events: await prisma.calendarEvent.count(),
      streams: await prisma.recurringStream.count(),
      transactions: await prisma.transaction.count(),
    };
    await seedDevelopmentData(prisma, reference);
    expect({
      events: await prisma.calendarEvent.count(),
      streams: await prisma.recurringStream.count(),
      transactions: await prisma.transaction.count(),
    }).toEqual(before);
    const dashboard = calculateDashboard(
      await getDashboardData(ownerId, reference),
      reference,
    );
    expect(dashboard.metrics.income.toString()).toBe("4250");
    expect(dashboard.metrics.spending.toString()).toBe("344.6021");
    expect(dashboard.metrics.netWorth.toString()).toBe("396632.7341");
    expect(
      await prisma.transaction.count({
        where: { id: { startsWith: "seed_spending_" } },
      }),
    ).toBe(0);
  });
});
