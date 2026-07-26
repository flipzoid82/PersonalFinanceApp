import type {
  AccountSource,
  AccountType,
  ConnectionStatus,
  DataSourceStatus,
  InvestmentSource,
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
    currentValue: Prisma.Decimal;
    currency: string;
    source: InvestmentSource;
    asOfDate: Date;
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
};
