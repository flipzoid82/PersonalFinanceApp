import type {
  AccountSource,
  AccountType,
  ConnectionStatus,
  DataSourceStatus,
  InvestmentSource,
  InvestmentTransactionType,
  ManualAssetType,
  Prisma,
} from "@prisma/client";

export type PortfolioAccount = {
  id: string;
  userId: string;
  dataSourceId: string;
  name: string;
  institutionName: string | null;
  accountType: AccountType;
  accountSubtype: string | null;
  source: AccountSource;
  currency: string;
  currentBalance: Prisma.Decimal;
  balanceAvailable?: boolean;
  availableBalance: Prisma.Decimal | null;
  creditLimit: Prisma.Decimal | null;
  isManual: boolean;
  isActive: boolean;
  lastSyncedAt: Date | null;
  lastImportedAt: Date | null;
  notes: string | null;
  updatedAt: Date;
  dataSource: {
    displayName: string;
    status: DataSourceStatus;
    lastUpdatedAt: Date | null;
  };
  institutionConnection?: {
    id?: string;
    provider: string;
    status: ConnectionStatus;
    disconnectedAt?: Date | null;
  } | null;
  balanceSnapshots: Array<{
    id: string;
    currentBalance: Prisma.Decimal;
    availableBalance: Prisma.Decimal | null;
    capturedAt: Date;
  }>;
  investmentSnapshots: Array<{
    id: string;
    totalValue: Prisma.Decimal;
    vestedValue: Prisma.Decimal | null;
    source: InvestmentSource;
    asOfDate: Date;
    notes: string | null;
  }>;
  investmentHoldings: Array<{
    id: string;
    securityName: string;
    tickerSymbol: string | null;
    securityType: string | null;
    quantity: Prisma.Decimal | null;
    price: Prisma.Decimal | null;
    currentValue: Prisma.Decimal;
    costBasis: Prisma.Decimal | null;
    vestedQuantity: Prisma.Decimal | null;
    vestedValue: Prisma.Decimal | null;
    currency: string;
    source: InvestmentSource;
    asOfDate: Date;
  }>;
  investmentTransactions: Array<{
    id: string;
    source: InvestmentSource;
    transactionDate: Date;
    transactionType: InvestmentTransactionType;
    securityName: string | null;
    tickerSymbol: string | null;
    amount: Prisma.Decimal | null;
    quantity: Prisma.Decimal | null;
    price: Prisma.Decimal | null;
    fees: Prisma.Decimal | null;
    currency: string;
  }>;
};

export type PortfolioManualAsset = {
  id: string;
  userId: string;
  name: string;
  assetType: ManualAssetType;
  currentValue: Prisma.Decimal;
  costBasis: Prisma.Decimal | null;
  currency: string;
  acquiredAt: Date | null;
  isDebt: boolean;
  isActive: boolean;
  notes: string | null;
  updatedAt: Date;
};

export type RawPortfolioData = {
  ownerId: string;
  accounts: PortfolioAccount[];
  manualAssets: PortfolioManualAsset[];
};

export type Freshness = "current" | "stale" | "unavailable";

export type PortfolioItem = {
  id: string;
  name: string;
  typeLabel: string;
  category: "asset" | "debt" | "investment";
  group:
    | "cash"
    | "investment"
    | "property"
    | "vehicle"
    | "other-asset"
    | "credit-card"
    | "mortgage"
    | "loan"
    | "other-debt";
  value: Prisma.Decimal;
  valueAvailable: boolean;
  currency: string;
  sourceLabel: "Synced" | "Imported" | "Manual";
  valueSource:
    | "Account balance"
    | "Balance snapshot"
    | "Investment snapshot"
    | "Manual value";
  updatedAt: Date | null;
  freshness: Freshness;
  isActive: boolean;
  isCurrent: boolean;
};

export type PortfolioViewModel = {
  isEmpty: boolean;
  isPartial: boolean;
  partialReasons: string[];
  totalAssets: Prisma.Decimal;
  totalDebts: Prisma.Decimal;
  netWorth: Prisma.Decimal;
  totalInvestments: Prisma.Decimal;
  items: PortfolioItem[];
  accounts: PortfolioAccount[];
  manualAssets: PortfolioManualAsset[];
  investmentAccounts: PortfolioAccount[];
  netWorthHistory: NetWorthHistory;
  investmentInsights: InvestmentInsights;
};

export type NetWorthRange = "30d" | "3m" | "6m" | "1y" | "all";

export type NetWorthHistoryPoint = {
  date: Date;
  assets: Prisma.Decimal;
  debts: Prisma.Decimal;
  value: Prisma.Decimal;
};

export type NetWorthHistory = {
  range: NetWorthRange;
  rangeLabel: string;
  points: NetWorthHistoryPoint[];
  isPartial: boolean;
  partialReasons: string[];
  change: Prisma.Decimal | null;
};

export type InvestmentAccountInsight = {
  account: PortfolioAccount;
  currentValue: Prisma.Decimal;
  valueUpdatedAt: Date | null;
  valueAvailable: boolean;
  latestHoldings: PortfolioAccount["investmentHoldings"];
  holdingsAsOf: Date | null;
  holdingsAlignedToValue: boolean;
  knownHoldingsValue: Prisma.Decimal;
  unallocatedValue: Prisma.Decimal;
};

export type InvestmentAllocationItem = {
  id: string;
  label: string;
  accountName: string;
  value: Prisma.Decimal;
  percentage: Prisma.Decimal | null;
  kind: "holding" | "unallocated";
};

export type InvestmentContribution = {
  id: string;
  accountName: string;
  date: Date;
  amount: Prisma.Decimal;
  currency: string;
  source: InvestmentSource;
  description: string | null;
};

export type InvestmentInsights = {
  accounts: InvestmentAccountInsight[];
  accountAllocation: Array<{
    id: string;
    label: string;
    value: Prisma.Decimal;
    percentage: Prisma.Decimal | null;
  }>;
  holdingAllocation: InvestmentAllocationItem[];
  knownHoldingsValue: Prisma.Decimal;
  unallocatedValue: Prisma.Decimal;
  contributions: InvestmentContribution[];
  contributionTotal: Prisma.Decimal;
};
