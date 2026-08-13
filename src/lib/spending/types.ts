import type { FinancialRole, Prisma } from "@prisma/client";

export type SpendingTransaction = {
  id: string;
  merchant: string;
  category: string;
  role: FinancialRole;
  amount: Prisma.Decimal;
  currency: string;
  postedAt: Date;
  accountName: string;
};

export type SpendingBreakdown = {
  label: string;
  filterValue: string;
  amount: Prisma.Decimal;
  share: Prisma.Decimal;
};

export type SpendingMonth = {
  month: Date;
  income: Prisma.Decimal;
  spending: Prisma.Decimal;
  netCashFlow: Prisma.Decimal;
};

export type UnusualPurchase = SpendingTransaction & {
  priorCount: number;
  priorMedian: Prisma.Decimal;
  threshold: Prisma.Decimal;
};

export type SpendingViewModel = {
  currentMonth: SpendingMonth;
  previousMonth: SpendingMonth;
  spendingChange: Prisma.Decimal | null;
  categories: SpendingBreakdown[];
  merchants: SpendingBreakdown[];
  largestPurchases: SpendingTransaction[];
  unusualPurchases: UnusualPurchase[];
  monthlyTrend: SpendingMonth[];
  transactionCount: number;
  latestPostedAt: Date | null;
  stateMessages: string[];
  isEmpty: boolean;
};
