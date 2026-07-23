import {
  CalendarAmountSource,
  CalendarDateSource,
  CalendarEventStatus,
  CalendarEventType,
  ConfidenceLevel,
  DataSourceStatus,
  FinancialRole,
  Prisma,
  RecurringFlowType,
  RecurringFrequency,
  RecurringStatus,
  TransactionStatus,
} from "@prisma/client";
import { describe, expect, it } from "vitest";
import { getEffectiveCalendarEvent } from "./effective";
import { findBestTransactionMatch, scoreTransactionMatch } from "./matching";
import type { CalendarTransaction, RawCalendarEvent } from "./types";

const when = new Date("2026-07-25T00:00:00.000Z");
const money = (value: string) => new Prisma.Decimal(value);

function event() {
  return getEffectiveCalendarEvent({
    id: "event",
    userId: "owner",
    recurringStreamId: "stream",
    accountId: "checking",
    eventType: CalendarEventType.BILL,
    title: "Example Internet bill",
    eventDate: when,
    predictedPostingDate: when,
    expectedAmount: money("80"),
    actualAmount: null,
    currency: "USD",
    dateSource: CalendarDateSource.INFERRED,
    amountSource: CalendarAmountSource.ESTIMATED,
    confidenceLevel: ConfidenceLevel.HIGH,
    status: CalendarEventStatus.PREDICTED,
    isUserConfirmed: false,
    notes: null,
    updatedAt: when,
    account: {
      id: "checking",
      userId: "owner",
      name: "Checking",
      dataSource: { status: DataSourceStatus.ACTIVE, lastUpdatedAt: when },
    },
    linkedTransaction: null,
    overrides: [],
    recurringStream: {
      id: "stream",
      userId: "owner",
      merchantName: "Example Internet",
      description: "Monthly internet bill",
      flowType: RecurringFlowType.BILL,
      frequency: RecurringFrequency.MONTHLY,
      averageAmount: money("80"),
      lastAmount: money("80"),
      predictedNextDate: when,
      predictedPostingDate: when,
      confirmedDueDate: null,
      dateSource: CalendarDateSource.INFERRED,
      confidenceLevel: ConfidenceLevel.HIGH,
      isActive: true,
      status: RecurringStatus.ACTIVE,
      typicalAccountId: "checking",
      updatedAt: when,
      calendarOverrides: [],
    },
  } satisfies RawCalendarEvent);
}

function transaction(
  options: Partial<CalendarTransaction> = {},
): CalendarTransaction {
  return {
    id: "transaction",
    userId: "owner",
    accountId: "checking",
    originalName: "EXAMPLE INTERNET SERVICE",
    merchantName: "Example Internet",
    amount: money("80"),
    currency: "USD",
    postedAt: when,
    status: TransactionStatus.POSTED,
    override: { financialRoleOverride: FinancialRole.EXPENSE },
    ...options,
  };
}

describe("posted transaction matching", () => {
  it("never accepts pending transactions", () => {
    expect(
      scoreTransactionMatch(
        event(),
        transaction({ status: TransactionStatus.PENDING }),
      ),
    ).toBeNull();
  });

  it("scores merchant, account, amount, date, and event type deterministically", () => {
    const match = scoreTransactionMatch(event(), transaction());
    expect(match?.confidence).toBe("HIGH");
    expect(match?.requiresConfirmation).toBe(false);
    expect(match?.reasons).toEqual(
      expect.arrayContaining([
        "merchant or description",
        "account",
        "amount",
        "date proximity",
        "event type",
      ]),
    );
  });

  it("requires explicit confirmation for a low-confidence match", () => {
    const match = scoreTransactionMatch(
      event(),
      transaction({
        accountId: "other",
        originalName: "INTERNET CHARGE",
        merchantName: "Internet Company",
        amount: money("84"),
        postedAt: new Date("2026-07-31T00:00:00.000Z"),
        override: null,
      }),
    );
    expect(match?.confidence).toBe("LOW");
    expect(match?.requiresConfirmation).toBe(true);
  });

  it("selects the strongest posted candidate", () => {
    const best = findBestTransactionMatch(event(), [
      transaction({ id: "low", accountId: "other", override: null }),
      transaction({ id: "high" }),
    ]);
    expect(best?.transaction.id).toBe("high");
  });
});
