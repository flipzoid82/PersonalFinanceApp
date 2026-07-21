import type {
  AccountSource,
  AccountType,
  CalendarAmountSource,
  CalendarDateSource,
  CalendarEventStatus,
  CalendarEventType,
  ConfidenceLevel,
  ConnectionStatus,
  DataSourceStatus,
  DataSourceType,
  FinancialRole,
  InvestmentSource,
  Prisma,
  TransactionStatus,
} from "@prisma/client";

export type DashboardAccount = {
  id: string;
  userId: string;
  name: string;
  institutionName: string | null;
  accountType: AccountType;
  source: AccountSource;
  currency: string;
  currentBalance: Prisma.Decimal;
  availableBalance: Prisma.Decimal | null;
  creditLimit: Prisma.Decimal | null;
  isActive: boolean;
  lastSyncedAt: Date | null;
  lastImportedAt: Date | null;
  updatedAt: Date;
  dataSource: {
    id: string;
    displayName: string;
    sourceType: DataSourceType;
    status: DataSourceStatus;
    lastUpdatedAt: Date | null;
  };
  institutionConnection: {
    status: ConnectionStatus;
    lastSuccessfulSyncAt: Date | null;
  } | null;
};

export type DashboardTransaction = {
  id: string;
  userId: string;
  originalName: string;
  merchantName: string | null;
  amount: Prisma.Decimal;
  currency: string;
  authorizedAt: Date | null;
  postedAt: Date | null;
  status: TransactionStatus;
  providerCategory: string | null;
  account: {
    id: string;
    userId: string;
    name: string;
  };
  override: {
    merchantNameOverride: string | null;
    categoryOverride: string | null;
    financialRoleOverride: FinancialRole | null;
    excludedFromReports: boolean;
  } | null;
};

export type DashboardCalendarEvent = {
  id: string;
  userId: string;
  title: string;
  eventType: CalendarEventType;
  eventDate: Date;
  predictedPostingDate: Date | null;
  expectedAmount: Prisma.Decimal | null;
  currency: string;
  dateSource: CalendarDateSource;
  amountSource: CalendarAmountSource;
  confidenceLevel: ConfidenceLevel;
  status: CalendarEventStatus;
  isUserConfirmed: boolean;
  account: { name: string } | null;
  overrides: Array<{
    confirmedDueDate: Date | null;
    expectedAmountOverride: Prisma.Decimal | null;
    statusOverride: CalendarEventStatus | null;
    notABill: boolean;
    updatedAt: Date;
  }>;
};

export type DashboardInvestmentSnapshot = {
  id: string;
  userId: string;
  accountId: string;
  totalValue: Prisma.Decimal;
  source: InvestmentSource;
  asOfDate: Date;
};

export type DashboardHolding = {
  id: string;
  userId: string;
  accountId: string;
  securityName: string;
  tickerSymbol: string | null;
  currentValue: Prisma.Decimal;
  source: InvestmentSource;
  asOfDate: Date;
};

export type DashboardBalanceSnapshot = {
  id: string;
  userId: string;
  accountId: string;
  currentBalance: Prisma.Decimal;
  capturedAt: Date;
};

export type DashboardManualAsset = {
  id: string;
  userId: string;
  name: string;
  currentValue: Prisma.Decimal;
  currency: string;
  isDebt: boolean;
  updatedAt: Date;
};

export type DashboardDataSource = {
  id: string;
  userId: string;
  displayName: string;
  sourceType: DataSourceType;
  status: DataSourceStatus;
  lastUpdatedAt: Date | null;
  institutionConnections: Array<{
    status: ConnectionStatus;
    lastSuccessfulSyncAt: Date | null;
  }>;
};

export type RawDashboardData = {
  ownerId: string;
  accounts: DashboardAccount[];
  transactions: DashboardTransaction[];
  calendarEvents: DashboardCalendarEvent[];
  investmentSnapshots: DashboardInvestmentSnapshot[];
  holdings: DashboardHolding[];
  balanceSnapshots: DashboardBalanceSnapshot[];
  manualAssets: DashboardManualAsset[];
  dataSources: DashboardDataSource[];
};

export type DashboardMetrics = {
  cash: Prisma.Decimal;
  availableCash: Prisma.Decimal | null;
  cardDebt: Prisma.Decimal;
  creditUtilization: Prisma.Decimal | null;
  investments: Prisma.Decimal;
  netWorth: Prisma.Decimal;
  income: Prisma.Decimal;
  spending: Prisma.Decimal;
  cashFlow: Prisma.Decimal;
};

export type RecentTransaction = {
  id: string;
  name: string;
  accountName: string;
  date: Date;
  amount: Prisma.Decimal;
  currency: string;
  status: TransactionStatus;
  category: string;
  role: FinancialRole | null;
};

export type UpcomingActivity = {
  id: string;
  title: string;
  date: Date;
  predictedPostingDate: Date | null;
  amount: Prisma.Decimal | null;
  currency: string;
  dateLabel: "Confirmed" | "Predicted";
  amountLabel: string;
  status: CalendarEventStatus;
  confidence: ConfidenceLevel;
  accountName: string | null;
};

export type SpendingCategory = {
  category: string;
  amount: Prisma.Decimal;
};

export type InvestmentAccountSummary = {
  id: string;
  name: string;
  source: AccountSource;
  value: Prisma.Decimal;
  currency: string;
  asOfDate: Date;
  valueSource: "Snapshot" | "Account balance";
};

export type NetWorthPoint = {
  date: Date;
  value: Prisma.Decimal;
};

export type SourceHealth = {
  id: string;
  name: string;
  sourceLabel: "Synced" | "Imported" | "Manual";
  statusLabel: "Current" | "Stale" | "Partial" | "Disconnected" | "Error";
  updatedAt: Date | null;
  detail: string;
};

export type DashboardViewModel = {
  isEmpty: boolean;
  isPartial: boolean;
  partialReasons: string[];
  latestDataAt: Date | null;
  metrics: DashboardMetrics;
  accounts: DashboardAccount[];
  recentTransactions: RecentTransaction[];
  upcoming: UpcomingActivity[];
  upcomingTotal: Prisma.Decimal;
  upcomingConfirmedCount: number;
  upcomingPredictedCount: number;
  spendingCategories: SpendingCategory[];
  investmentAccounts: InvestmentAccountSummary[];
  netWorthTrend: NetWorthPoint[];
  trendIsPartial: boolean;
  sourceHealth: SourceHealth[];
};
