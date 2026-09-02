import { FinancialRole, TransactionStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  isClassificationEligible,
  isFinalizedReportingEligible,
  isInboxEligible,
  isLaterPlanningEligible,
  isRecurrenceEligible,
  isRelationshipEligible,
} from "./eligibility";

const transaction = {
  status: TransactionStatus.POSTED,
  removedAt: null,
  currency: "USD",
  account: { isActive: true },
};

const effective = {
  financialRole: FinancialRole.EXPENSE,
  excludedFromReports: false,
  needsReview: false,
  categoryId: "category-1",
};

describe("transaction eligibility boundaries", () => {
  it("keeps classification, reporting, Inbox, recurrence, relationship, and later planning distinct", () => {
    expect(isClassificationEligible(transaction)).toBe(true);
    expect(isFinalizedReportingEligible(transaction, effective)).toBe(true);
    expect(isInboxEligible(transaction, effective)).toBe(false);
    expect(isRecurrenceEligible(transaction, effective)).toBe(true);
    expect(isRelationshipEligible(transaction)).toBe(true);
    expect(isLaterPlanningEligible(transaction, effective)).toBe(true);
  });

  it("retains pending activity for classification and relationships but not finalized reporting", () => {
    const pending = { ...transaction, status: TransactionStatus.PENDING };
    expect(isClassificationEligible(pending)).toBe(true);
    expect(isRelationshipEligible(pending)).toBe(true);
    expect(isFinalizedReportingEligible(pending, effective)).toBe(false);
  });

  it("keeps unresolved activity in Inbox and outside finalized consumers", () => {
    const unresolved = {
      ...effective,
      financialRole: null,
      needsReview: true,
      categoryId: null,
    };
    expect(isInboxEligible(transaction, unresolved)).toBe(true);
    expect(isFinalizedReportingEligible(transaction, unresolved)).toBe(false);
    expect(isRecurrenceEligible(transaction, unresolved)).toBe(false);
  });

  it("allows historical reporting but blocks new recurrence and planning from inactive accounts", () => {
    const historical = { ...transaction, account: { isActive: false } };
    expect(isFinalizedReportingEligible(historical, effective)).toBe(true);
    expect(isRecurrenceEligible(historical, effective)).toBe(false);
    expect(isLaterPlanningEligible(historical, effective)).toBe(false);
  });

  it("keeps non-USD finalized reporting eligible but out of the later USD planning boundary", () => {
    const cad = { ...transaction, currency: "CAD" };
    expect(isFinalizedReportingEligible(cad, effective)).toBe(true);
    expect(isLaterPlanningEligible(cad, effective)).toBe(false);
  });

  it.each([
    FinancialRole.REFUND,
    FinancialRole.BORROWING_PROCEEDS,
    FinancialRole.INVESTMENT_ACTIVITY,
    FinancialRole.IGNORED,
  ])("does not create recurrence from %s", (financialRole) => {
    expect(
      isRecurrenceEligible(transaction, { ...effective, financialRole }),
    ).toBe(false);
  });
});
