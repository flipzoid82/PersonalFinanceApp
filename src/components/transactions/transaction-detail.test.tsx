import {
  FinancialRole,
  Prisma,
  TransactionCategoryKind,
  TransactionRelationshipState,
  TransactionRelationshipType,
  TransactionStatus,
} from "@prisma/client";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/actions/transactions", () => ({
  updateTransactionOverrideAction: vi.fn(),
  createClassificationRuleAction: vi.fn(),
  deferTransactionReviewAction: vi.fn(),
  replaceTransactionSplitAction: vi.fn(),
  resolveLegacyRelationshipAction: vi.fn(),
  setRelationshipStateAction: vi.fn(),
  createRefundRelationshipAction: vi.fn(),
}));

import { TransactionDetail } from "./transaction-detail";

afterEach(cleanup);

function detail() {
  return {
    id: "transaction-1",
    originalName: "ORIGINAL STORE NAME",
    merchantName: "Provider Store",
    amount: new Prisma.Decimal("-45.6700"),
    currency: "USD",
    authorizedAt: new Date("2026-07-01T00:00:00Z"),
    postedAt: new Date("2026-07-02T00:00:00Z"),
    status: TransactionStatus.POSTED,
    providerCategory: "Provider category",
    providerCategoryConfidence: new Prisma.Decimal("0.9000"),
    pendingProviderTransactionId: null,
    removedAt: null,
    createdAt: new Date("2026-07-02T00:00:00Z"),
    account: {
      id: "account-1",
      name: "Checking",
      institutionName: "Bank",
      source: "SYNCED",
      isActive: true,
      dataSource: {
        displayName: "Plaid",
        status: "ACTIVE",
        lastUpdatedAt: null,
      },
      institutionConnection: {
        provider: "PLAID",
        status: "ACTIVE",
        lastSuccessfulSyncAt: null,
      },
    },
    override: {
      merchantNameOverride: null,
      categoryOverride: "Local category",
      financialRoleOverride: FinancialRole.REFUND,
      notes: "Owner-only note",
      excludedFromReports: true,
      linkedTransactionId: null,
    },
    pendingTransaction: {
      originalName: "PENDING STORE",
      merchantName: "Pending Store",
      status: TransactionStatus.CANCELED,
      authorizedAt: new Date("2026-07-01T00:00:00Z"),
    },
    postedTransactions: [],
    effective: {
      merchant: "Provider Store",
      category: "Local category",
      financialRole: FinancialRole.REFUND,
      notes: "Owner-only note",
      excludedFromReports: true,
      hasLocalOverride: true,
    },
  };
}

describe("TransactionDetail", () => {
  it("distinguishes effective and source values without exposing raw payloads or IDs", () => {
    render(
      <TransactionDetail
        transaction={detail() as never}
        categories={[
          {
            id: "category-1",
            name: "Local category",
            kind: TransactionCategoryKind.EXPENSE,
          },
        ]}
        message="Transaction override saved."
      />,
    );
    expect(
      screen.getByRole("heading", { name: "Effective transaction" }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Source values" }),
    ).toBeVisible();
    expect(screen.getByText("ORIGINAL STORE NAME")).toBeVisible();
    expect(screen.getAllByText("Local category").length).toBeGreaterThan(0);
    expect(screen.getByLabelText("Transaction purpose category")).toBeVisible();
    expect(screen.getByLabelText("Financial role override")).toHaveValue(
      "REFUND",
    );
    expect(screen.getByLabelText("Owner notes")).toHaveValue("Owner-only note");
    expect(screen.getByLabelText("Exclude from reports")).toBeChecked();
    expect(screen.getByText(/Pending predecessor:/)).toBeVisible();
    expect(screen.queryByText(/rawProviderPayload/i)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/provider transaction id/i),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("override saved");
  });

  it("renders semantic tokens and non-color amount/status cues", () => {
    const { container } = render(
      <TransactionDetail transaction={detail() as never} categories={[]} />,
    );
    expect(screen.getAllByText(/\$45.67/).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Posted").length).toBeGreaterThan(0);
    expect(container.innerHTML).toContain("--semantic-positive-text");
    expect(container.innerHTML).toContain("--semantic-info-text");
  });

  it("requires an explicit supported type before a legacy link can be confirmed", () => {
    const transaction = {
      ...detail(),
      outgoingRelationships: [
        {
          id: "legacy-relationship",
          type: TransactionRelationshipType.LEGACY_UNTYPED,
          state: TransactionRelationshipState.NEEDS_REVIEW,
          appliedAmount: null,
          targetTransaction: {
            id: "transaction-2",
            originalName: "OTHER SYNTHETIC TRANSACTION",
            merchantName: "Other synthetic transaction",
            amount: new Prisma.Decimal("45.6700"),
            currency: "USD",
          },
        },
      ],
      incomingRelationships: [],
    };
    render(
      <TransactionDetail transaction={transaction as never} categories={[]} />,
    );

    expect(
      screen.getByText("Legacy untyped link", { exact: false }),
    ).toBeVisible();
    expect(screen.getByText(/has no established economic type/i)).toBeVisible();
    expect(screen.getByLabelText("Economic relationship type")).toHaveValue("");
    expect(
      screen.getByRole("button", { name: "Resolve and confirm" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Confirm relationship" }),
    ).not.toBeInTheDocument();
  });

  it("uses zero-minimum grid tracks so long provider categories do not overflow mobile", () => {
    render(
      <TransactionDetail transaction={detail() as never} categories={[]} />,
    );

    const effectiveCard = screen
      .getByRole("heading", { name: "Effective transaction" })
      .closest("div");
    const sourceCard = screen
      .getByRole("heading", { name: "Source values" })
      .closest("div");
    expect(effectiveCard).toHaveClass("min-w-0");
    expect(sourceCard).toHaveClass("min-w-0");
    expect(effectiveCard?.parentElement).toHaveClass("grid-cols-1");
  });

  it("formats the effective provider category but retains its exact source value", () => {
    const transaction = {
      ...detail(),
      providerCategory: "RENT_AND_UTILITIES_GAS_AND_ELECTRICITY",
      override: null,
      effective: {
        ...detail().effective,
        category: "RENT_AND_UTILITIES_GAS_AND_ELECTRICITY",
      },
    };
    render(
      <TransactionDetail transaction={transaction as never} categories={[]} />,
    );

    expect(
      screen.getByText("Rent and Utilities · Gas and electricity"),
    ).toBeVisible();
    expect(
      screen.getByText("RENT_AND_UTILITIES_GAS_AND_ELECTRICITY"),
    ).toBeVisible();
  });

  it("exposes an accessible exact refund linkage form for eligible expenses", () => {
    render(
      <TransactionDetail
        transaction={detail() as never}
        categories={[]}
        refundCandidates={[
          {
            id: "expense-1",
            originalName: "ORIGINAL EXPENSE",
            merchantName: "Example Expense",
            amount: new Prisma.Decimal("45.67"),
            currency: "USD",
            postedAt: new Date("2026-06-30T00:00:00Z"),
            effective: {} as never,
          },
        ]}
      />,
    );
    expect(
      screen.getByRole("heading", { name: "Link an expense refund" }),
    ).toBeVisible();
    expect(screen.getByLabelText("Original expense")).toBeVisible();
    expect(screen.getByLabelText("Relationship type")).toBeVisible();
    expect(screen.getByLabelText("Applied amount")).toHaveValue("45.6700");
    expect(screen.getByRole("button", { name: "Link expense" })).toBeVisible();
  });
});
