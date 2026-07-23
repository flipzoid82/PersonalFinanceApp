import { CalendarEventType, RecurringFrequency } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { eventActionSchema, manualEventSchema } from "./validation";

describe("calendar server validation", () => {
  it("rejects invalid dates and non-positive corrections", () => {
    expect(
      eventActionSchema.safeParse({
        intent: "correct-date",
        eventId: "event",
        date: "2026-02-30",
      }).success,
    ).toBe(false);
    expect(
      eventActionSchema.safeParse({
        intent: "correct-amount",
        eventId: "event",
        amount: "0",
      }).success,
    ).toBe(false);
  });

  it("accepts valid manual values and normalizes currency", () => {
    const result = manualEventSchema.parse({
      name: "Manual rent",
      eventType: CalendarEventType.BILL,
      date: "2026-08-01",
      amount: "1450.25",
      currency: "usd",
      accountId: "",
      frequency: RecurringFrequency.MONTHLY,
      dateKind: "confirmed",
      notes: "Synthetic",
    });
    expect(result.currency).toBe("USD");
    expect(result.amount.toString()).toBe("1450.25");
    expect(result.accountId).toBeNull();
  });
});
