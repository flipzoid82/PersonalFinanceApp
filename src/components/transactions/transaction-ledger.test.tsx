import { FinancialRole, Prisma, TransactionStatus } from "@prisma/client";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TransactionLedger } from "./transaction-ledger";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/transactions",
  useSearchParams: () => new URLSearchParams(),
}));

afterEach(cleanup);

const filters = {
  search: "",
  dateFrom: "",
  dateTo: "",
  accountId: "",
  category: "",
  amountMin: "",
  amountMax: "",
  status: "" as const,
  sort: "date" as const,
  direction: "desc" as const,
  page: 1,
};

function ledger(transactions: unknown[] = []) {
  return {
    accounts: [{ id: "account-1", name: "Checking", institutionName: "Bank" }],
    categories: ["Dining", "Uncategorized"],
    filters,
    selectedAccountUnavailable: false,
    page: 1,
    pageCount: 1,
    total: transactions.length,
    transactions,
  } as never;
}

function transaction() {
  return {
    id: "transaction-1",
    originalName: "CARD PAYMENT",
    merchantName: "Card issuer",
    amount: new Prisma.Decimal("125.3400"),
    currency: "USD",
    authorizedAt: new Date("2026-07-01T00:00:00Z"),
    postedAt: new Date("2026-07-02T00:00:00Z"),
    status: TransactionStatus.POSTED,
    providerCategory: "Payment",
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
    override: null,
    effective: {
      merchant: "Card issuer",
      category: "Payment",
      financialRole: FinancialRole.CREDIT_CARD_PAYMENT,
      notes: null,
      excludedFromReports: false,
      hasLocalOverride: false,
    },
    isHistorical: false,
  };
}

describe("TransactionLedger", () => {
  it("provides accessible filters and non-color financial meaning", () => {
    render(<TransactionLedger ledger={ledger([transaction()])} />);

    expect(screen.getByLabelText("Merchant or description")).toBeVisible();
    expect(screen.getByLabelText("Effective category")).toBeVisible();
    expect(
      screen.getAllByText(/Card payment · not spending/i).length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText("Amount").length).toBeGreaterThan(0);
    expect(screen.getByRole("columnheader", { name: /Date/i })).toHaveAttribute(
      "aria-sort",
      "descending",
    );
    expect(
      screen.getByRole("link", { name: "Sort by Transaction, ascending" }),
    ).toHaveAttribute("href", "/transactions?sort=transaction&direction=asc");
    expect(
      screen.getAllByRole("link", { name: "Card issuer" })[0],
    ).toHaveAttribute("href", "/transactions/transaction-1");
  });

  it("formats provider categories and protects long ledger values from overflow", () => {
    const long = "MerchantWithoutAnyNaturalBreak".repeat(8);
    const item = {
      ...transaction(),
      merchantName: long,
      effective: {
        ...transaction().effective,
        merchant: long,
        category: "TRANSPORTATION_TAXIS_AND_RIDE_SHARES",
      },
    };
    render(<TransactionLedger ledger={ledger([item])} />);

    expect(
      screen.getAllByText(/Transportation · Taxis and ride shares/).length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: long })[0]).toHaveClass(
      "[overflow-wrap:anywhere]",
    );
    expect(screen.getByRole("table")).toHaveClass("table-fixed");
  });

  it("preserves filters in sort and pagination links while resetting the page for sorting", () => {
    render(
      <TransactionLedger
        ledger={
          {
            ...(ledger([transaction()]) as unknown as Record<string, unknown>),
            filters: {
              ...filters,
              search: "coffee",
              status: TransactionStatus.POSTED,
              sort: "amount",
              direction: "asc",
              page: 2,
            },
            page: 2,
            pageCount: 3,
            total: 101,
          } as never
        }
      />,
    );

    expect(
      screen.getByRole("link", { name: "Sort by Amount, descending" }),
    ).toHaveAttribute(
      "href",
      "/transactions?search=coffee&status=POSTED&sort=amount&direction=desc",
    );
    expect(screen.getByRole("link", { name: "Next" })).toHaveAttribute(
      "href",
      "/transactions?search=coffee&status=POSTED&sort=amount&direction=asc&page=3",
    );
  });

  it("distinguishes empty and filtered no-results states", () => {
    const emptyLedger = ledger() as Record<string, unknown>;
    const { rerender } = render(
      <TransactionLedger ledger={emptyLedger as never} />,
    );
    expect(screen.getByText("No transactions yet")).toBeVisible();
    rerender(
      <TransactionLedger
        ledger={
          {
            ...emptyLedger,
            filters: { ...filters, search: "missing" },
          } as never
        }
      />,
    );
    expect(screen.getByText("No transactions match")).toBeVisible();
  });

  it("renders an unavailable account filter as a non-disruptive warning status", () => {
    render(
      <TransactionLedger
        ledger={
          {
            ...(ledger() as unknown as Record<string, unknown>),
            selectedAccountUnavailable: true,
          } as never
        }
      />,
    );

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "selected account is unavailable",
    );
    expect(screen.getByRole("status")).toHaveClass(
      "bg-[var(--semantic-warning-bg)]",
    );
  });
});
