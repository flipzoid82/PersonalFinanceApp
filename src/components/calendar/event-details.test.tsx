import { Prisma } from "@prisma/client";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/actions/calendar", () => ({
  acceptPaymentMatchAction: vi.fn(),
  deactivateRecurringStreamAction: vi.fn(),
  updateCalendarEventAction: vi.fn(),
}));

import type { EffectiveCalendarEvent, MatchCandidate } from "@/lib/calendar";
import { EventDetails } from "./event-details";

afterEach(cleanup);

const event = {
  id: "event-1",
  recurringStreamId: "stream-1",
  title: "Electric bill",
  eventType: "BILL",
  effectiveDate: new Date("2026-08-15T00:00:00.000Z"),
  confirmedDueDate: new Date("2026-08-15T00:00:00.000Z"),
  predictedPostingDate: new Date("2026-08-14T00:00:00.000Z"),
  dateLabel: "Confirmed",
  dateSourceLabel: "Owner correction",
  expectedAmount: new Prisma.Decimal("125.50"),
  actualAmount: null,
  currency: "USD",
  amountLabel: "Expected",
  frequency: "MONTHLY",
  confidence: "HIGH",
  status: "CONFIRMED",
  accountId: "account-1",
  accountName: "Household checking",
  notes: null,
  isManual: false,
  notABill: false,
  lastMatchingTransaction: null,
  source: {},
} as EffectiveCalendarEvent;

const candidate = {
  transaction: {
    id: "transaction-1",
    userId: "owner-1",
    accountId: "account-1",
    originalName: "UTILITY PAYMENT",
    merchantName: "Electric Company",
    amount: new Prisma.Decimal("125.50"),
    currency: "USD",
    postedAt: new Date("2026-08-14T00:00:00.000Z"),
    status: "POSTED",
    override: null,
  },
  score: 90,
  confidence: "HIGH",
  reasons: ["merchant and amount agree"],
  requiresConfirmation: false,
} as MatchCandidate;

describe("Calendar correction and matching theme foundations", () => {
  it("uses semantic warning tokens for suggested matches", () => {
    render(
      <EventDetails event={event} candidate={candidate} returnTo="/calendar" />,
    );

    const notice = screen.getByText(/Suggested posted match/).closest("div");
    expect(notice).toHaveClass(
      "border-[var(--semantic-warning-border)]",
      "bg-[var(--semantic-warning-bg)]",
      "text-[var(--semantic-warning-text)]",
    );
    expect(screen.getByText(/Match evidence/)).toHaveTextContent(
      "merchant and amount agree",
    );
  });

  it("uses shared surface, text, border, and focus tokens for corrections", () => {
    const { container } = render(
      <EventDetails event={event} candidate={candidate} returnTo="/calendar" />,
    );

    fireEvent.click(screen.getByText("Actions and corrections"));
    const dateInput = screen.getByLabelText("Correct confirmed due date");
    expect(dateInput).toHaveClass(
      "border-[var(--border-default)]",
      "bg-[var(--surface-panel)]",
      "text-[var(--text-primary)]",
      "focus-visible:outline-[var(--focus-ring)]",
    );
    expect(dateInput.closest("form")).toHaveClass(
      "bg-[var(--surface-subtle)]",
      "text-[var(--text-primary)]",
    );

    dateInput.focus();
    expect(dateInput).toHaveFocus();
    expect(container.querySelector(".bg-white")).not.toBeInTheDocument();
    expect(container.querySelector(".bg-slate-50")).not.toBeInTheDocument();
  });
});
