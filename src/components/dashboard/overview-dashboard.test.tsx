import { FinancialRole, Prisma, TransactionStatus } from "@prisma/client";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { OverviewDashboard } from "./overview-dashboard";
import type { DashboardViewModel } from "@/lib/dashboard/types";

const emptyDashboard: DashboardViewModel = {
  isEmpty: true,
  isPartial: false,
  partialReasons: [],
  latestDataAt: null,
  metrics: {
    cash: new Prisma.Decimal(0),
    availableCash: null,
    cardDebt: new Prisma.Decimal(0),
    creditUtilization: null,
    investments: new Prisma.Decimal(0),
    netWorth: new Prisma.Decimal(0),
    income: new Prisma.Decimal(0),
    spending: new Prisma.Decimal(0),
    cashFlow: new Prisma.Decimal(0),
  },
  accounts: [],
  recentTransactions: [],
  upcoming: [],
  upcomingTotal: new Prisma.Decimal(0),
  upcomingConfirmedCount: 0,
  upcomingPredictedCount: 0,
  spendingCategories: [],
  investmentAccounts: [],
  netWorthTrend: [],
  trendIsPartial: true,
  sourceHealth: [],
};

describe("OverviewDashboard states", () => {
  afterEach(cleanup);

  it("explains an empty owner without rendering misleading zero metrics", () => {
    render(
      <OverviewDashboard
        dashboard={emptyDashboard}
        now={new Date("2026-07-21T12:00:00.000Z")}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "No financial data available" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("$0.00")).not.toBeInTheDocument();
    expect(screen.getByText("pnpm db:seed")).toBeInTheDocument();
  });

  it("preserves the required responsive metric ordering", () => {
    const source = DashboardWithValues();
    const { container } = render(
      <OverviewDashboard
        dashboard={source}
        now={new Date("2026-07-21T12:00:00.000Z")}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Overview" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Upcoming Bills").closest("div")).toHaveClass(
      "order-4",
      "xl:order-8",
    );
    expect(screen.getByText("Investments").closest("div")).toHaveClass(
      "order-8",
      "xl:order-4",
    );
    const notice = container.querySelector("[role='status']");
    expect(notice).toHaveTextContent("Partial totals");
    expect(notice).toHaveClass(
      "bg-[var(--semantic-warning-bg)]",
      "text-[var(--semantic-warning-text)]",
    );
    expect(notice).not.toHaveClass("bg-amber-50", "text-amber-950");
  });

  it("links monthly metrics to their intended destinations", () => {
    render(
      <OverviewDashboard
        dashboard={DashboardWithValues()}
        now={new Date("2026-07-21T12:00:00.000Z")}
      />,
    );

    expect(
      screen.getByRole("link", { name: /Income This Month/ }),
    ).toHaveAttribute("href", "/transactions");
    expect(
      screen.getByRole("link", { name: /Spending This Month/ }),
    ).toHaveAttribute("href", "/spending?view=expenses");
    expect(
      screen.getByRole("link", { name: /Upcoming Bills/ }),
    ).toHaveAttribute("href", "/calendar?view=upcoming&days=14");
  });

  it("links recent activity to transaction detail", () => {
    const dashboard = DashboardWithValues();
    dashboard.recentTransactions = [
      {
        id: "transaction-1",
        name: "Synthetic Coffee",
        accountName: "Checking",
        date: new Date("2026-07-20T00:00:00.000Z"),
        amount: new Prisma.Decimal("12.34"),
        currency: "USD",
        status: TransactionStatus.POSTED,
        category: "Dining",
        role: FinancialRole.EXPENSE,
      },
    ];
    render(
      <OverviewDashboard
        dashboard={dashboard}
        now={new Date("2026-07-21T12:00:00.000Z")}
      />,
    );

    expect(
      screen.getByRole("link", { name: "Synthetic Coffee" }),
    ).toHaveAttribute("href", "/transactions/transaction-1");
    expect(screen.getByText("Posted")).toHaveClass(
      "bg-[var(--semantic-info-bg)]",
      "text-[var(--semantic-info-text)]",
    );
  });

  it("applies established semantic tones with visible financial labels and signs", () => {
    render(
      <OverviewDashboard
        dashboard={DashboardWithValues()}
        now={new Date("2026-07-21T12:00:00.000Z")}
      />,
    );

    const expectations = [
      ["Net Worth", "$575.00", "--semantic-positive-text"],
      ["Cash", "$100.00", "--semantic-positive-text"],
      ["Credit Card Debt", "$25.00", "--semantic-negative-text"],
      ["Investments", "$500.00", "--semantic-investment-text"],
      ["Income This Month", "$1,000.00", "--semantic-positive-text"],
      ["Spending This Month", "$300.00", "--semantic-negative-text"],
      ["Net Cash Flow", "$700.00", "--semantic-positive-text"],
      ["Upcoming Bills", "$0.00", "--semantic-warning-text"],
    ] as const;

    for (const [label, value, token] of expectations) {
      const link = screen.getByText(label).closest("a");
      expect(link).not.toBeNull();
      expect(within(link!).getByText(value)).toHaveClass(
        `text-[var(${token})]`,
      );
    }

    expect(
      screen.getByRole("link", { name: /Credit Card Debt.*\$25\.00/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", {
        name: /Net Cash Flow.*Income minus spending/i,
      }),
    ).toBeInTheDocument();
  });
});

function DashboardWithValues(): DashboardViewModel {
  return {
    ...emptyDashboard,
    isEmpty: false,
    isPartial: true,
    partialReasons: ["Synthetic source may be incomplete."],
    latestDataAt: new Date("2026-07-21T10:00:00.000Z"),
    metrics: {
      ...emptyDashboard.metrics,
      cash: new Prisma.Decimal("100"),
      cardDebt: new Prisma.Decimal("25"),
      investments: new Prisma.Decimal("500"),
      netWorth: new Prisma.Decimal("575"),
      income: new Prisma.Decimal("1000"),
      spending: new Prisma.Decimal("300"),
      cashFlow: new Prisma.Decimal("700"),
    },
    sourceHealth: [],
  };
}
