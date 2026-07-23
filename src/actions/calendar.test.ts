// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  applyCalendarEventAction: vi.fn(),
  createManualRecurringEvent: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  }),
  revalidatePath: vi.fn(),
  requireUser: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/auth", () => ({ requireUser: mocks.requireUser }));
vi.mock("@/lib/calendar/mutations", () => ({
  acceptPaymentMatch: vi.fn(),
  applyCalendarEventAction: mocks.applyCalendarEventAction,
  createManualRecurringEvent: mocks.createManualRecurringEvent,
  deactivateRecurringStream: vi.fn(),
}));

import {
  createManualRecurringEventAction,
  updateCalendarEventAction,
} from "./calendar";

describe("calendar server actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ id: "owner-1" });
  });

  it("does not catch Next's success redirect after updating an event", async () => {
    mocks.applyCalendarEventAction.mockResolvedValue("Prediction confirmed.");
    const formData = new FormData();
    formData.set("intent", "confirm");
    formData.set("eventId", "event-1");
    formData.set("date", "2026-07-26");
    formData.set("returnTo", "/calendar?view=month");

    await expect(updateCalendarEventAction(formData)).rejects.toThrow(
      "NEXT_REDIRECT:/calendar?view=month&message=Prediction+confirmed.",
    );

    expect(mocks.applyCalendarEventAction).toHaveBeenCalledWith("owner-1", {
      intent: "confirm",
      eventId: "event-1",
      date: "2026-07-26",
    });
    expect(mocks.redirect).toHaveBeenCalledOnce();
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/calendar");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/overview");
  });

  it("preserves the success redirect after creating a manual event", async () => {
    mocks.createManualRecurringEvent.mockResolvedValue({ id: "event-2" });
    const formData = new FormData();
    formData.set("name", "Manual reminder");
    formData.set("eventType", "BILL");
    formData.set("date", "2026-08-05");
    formData.set("amount", "33.25");
    formData.set("currency", "USD");
    formData.set("accountId", "");
    formData.set("frequency", "MONTHLY");
    formData.set("dateKind", "confirmed");
    formData.set("notes", "Synthetic event");

    await expect(createManualRecurringEventAction(formData)).rejects.toThrow(
      "NEXT_REDIRECT:/calendar?message=Manual+recurring+event+created.",
    );

    expect(mocks.createManualRecurringEvent).toHaveBeenCalledOnce();
    expect(mocks.redirect).toHaveBeenCalledOnce();
  });
});
