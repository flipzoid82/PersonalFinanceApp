import type {
  AccountType,
  CalendarAmountSource,
  CalendarEventType,
  ConfidenceLevel,
  FinancialRole,
  Prisma,
  RecurringFlowType,
  RecurringFrequency,
  TransactionStatus,
} from "@prisma/client";

export type DetectionTransaction = {
  id: string;
  userId: string;
  accountId: string;
  originalName: string;
  merchantName: string | null;
  amount: Prisma.Decimal;
  currency: string;
  postedAt: Date | null;
  status: TransactionStatus;
  providerCategory: string | null;
  removedAt: Date | null;
  account: {
    id: string;
    userId: string;
    isActive: boolean;
    accountType: AccountType;
  };
  override: {
    merchantNameOverride: string | null;
    categoryOverride: string | null;
    financialRoleOverride: FinancialRole | null;
    excludedFromReports: boolean;
  } | null;
};

export type EffectiveDetectionTransaction = DetectionTransaction & {
  effectiveMerchant: string;
  normalizedMerchant: string;
  effectiveCategory: string | null;
  financialRole: FinancialRole;
  direction: "inflow" | "outflow";
  flowType: RecurringFlowType;
  eventType: CalendarEventType;
};

export type FrequencyAnalysis = {
  frequency: RecurringFrequency;
  regularity: number;
  anchors?: [number, number];
};

export type DetectedRecurringCandidate = {
  detectionKey: string;
  normalizedMerchant: string;
  displayName: string;
  accountId: string;
  currency: string;
  direction: "inflow" | "outflow";
  financialRole: FinancialRole;
  flowType: RecurringFlowType;
  eventType: CalendarEventType;
  category: string | null;
  frequency: RecurringFrequency;
  anchors?: [number, number];
  transactionIds: string[];
  occurrenceDates: Date[];
  firstDate: Date;
  lastDate: Date;
  lastAmount: Prisma.Decimal;
  expectedAmount: Prisma.Decimal;
  amountDeviation: Prisma.Decimal;
  amountSource: CalendarAmountSource;
  confidenceScore: Prisma.Decimal;
  confidenceLevel: ConfidenceLevel;
  intervalRegularity: number;
  missedCycles: number;
  predictedNextDate: Date;
  projectedDates: Date[];
};

export type RecurringDetectionResult = {
  eligibleTransactions: number;
  candidates: number;
  streamsCreated: number;
  streamsUpdated: number;
  projectionsCreated: number;
  projectionsUpdated: number;
  transactionsMatched: number;
  streamsMarkedInactive: number;
};
