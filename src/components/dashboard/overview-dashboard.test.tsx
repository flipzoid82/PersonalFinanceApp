import { Prisma } from "@prisma/client";
import { cleanup, render, screen } from "@testing-library/react";
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
    expect(container.querySelector("[role='status']")).toHaveTextContent(
      "Partial totals",
    );
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
