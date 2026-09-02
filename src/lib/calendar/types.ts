import type {
  CalendarAmountSource,
  CalendarDateSource,
  CalendarEventStatus,
  CalendarEventType,
  ConfidenceLevel,
  DataSourceStatus,
  Prisma,
  RecurringFlowType,
  RecurringFrequency,
  RecurringStatus,
  TransactionStatus,
  FinancialRole,
} from "@prisma/client";
import type { CalendarRange } from "./dates";

export type CalendarOverrideValue = {
  id: string;
  confirmedDueDate: Date | null;
  expectedAmountOverride: Prisma.Decimal | null;
  frequencyOverride: RecurringFrequency | null;
  statusOverride: CalendarEventStatus | null;
  notABill: boolean;
  notes: string | null;
  updatedAt: Date;
};

export type CalendarTransaction = {
  id: string;
  userId: string;
  accountId: string;
  originalName: string;
  merchantName: string | null;
  amount: Prisma.Decimal;
  currency: string;
  postedAt: Date | null;
  status: TransactionStatus;
  override: { financialRoleOverride: FinancialRole | null } | null;
  classification?: { financialRole: FinancialRole | null } | null;
};

export type CalendarStream = {
  id: string;
  userId: string;
  merchantName: string | null;
  description: string;
  flowType: RecurringFlowType;
  frequency: RecurringFrequency;
  averageAmount: Prisma.Decimal;
  lastAmount: Prisma.Decimal;
  predictedNextDate: Date;
  predictedPostingDate: Date | null;
  confirmedDueDate: Date | null;
  dateSource: CalendarDateSource;
  confidenceLevel: ConfidenceLevel;
  isActive: boolean;
  status: RecurringStatus;
  typicalAccountId: string | null;
  updatedAt: Date;
  calendarOverrides: CalendarOverrideValue[];
  calendarEvents?: Array<{
    id: string;
    eventDate: Date;
    linkedTransaction: CalendarTransaction | null;
  }>;
};

export type RawCalendarEvent = {
  id: string;
  userId: string;
  recurringStreamId: string | null;
  accountId: string | null;
  eventType: CalendarEventType;
  title: string;
  eventDate: Date;
  predictedPostingDate: Date | null;
  expectedAmount: Prisma.Decimal | null;
  actualAmount: Prisma.Decimal | null;
  currency: string;
  dateSource: CalendarDateSource;
  amountSource: CalendarAmountSource;
  confidenceLevel: ConfidenceLevel;
  status: CalendarEventStatus;
  isUserConfirmed: boolean;
  notes: string | null;
  updatedAt: Date;
  account: {
    id: string;
    userId: string;
    name: string;
    isActive?: boolean;
    institutionConnection?: {
      status: import("@prisma/client").ConnectionStatus;
    } | null;
    dataSource: {
      status: DataSourceStatus;
      lastUpdatedAt: Date | null;
    };
  } | null;
  linkedTransaction: CalendarTransaction | null;
  recurringStream: CalendarStream | null;
  overrides: CalendarOverrideValue[];
};

export type CalendarFilters = {
  view: "month" | "upcoming";
  month: Date;
  selectedDay: Date | null;
  days: CalendarRange;
  eventTypes: CalendarEventType[];
  dateKind: "all" | "confirmed" | "predicted" | "needs-confirmation";
};

export type EffectiveCalendarEvent = {
  id: string;
  recurringStreamId: string | null;
  title: string;
  eventType: CalendarEventType;
  effectiveDate: Date;
  confirmedDueDate: Date | null;
  predictedPostingDate: Date | null;
  dateLabel: "Confirmed" | "Predicted";
  dateSourceLabel: string;
  expectedAmount: Prisma.Decimal | null;
  actualAmount: Prisma.Decimal | null;
  currency: string;
  amountLabel: string;
  frequency: RecurringFrequency;
  confidence: ConfidenceLevel;
  status: CalendarEventStatus;
  accountId: string | null;
  accountName: string | null;
  notes: string | null;
  isManual: boolean;
  notABill: boolean;
  lastMatchingTransaction: CalendarTransaction | null;
  source: RawCalendarEvent;
};

export type MatchCandidate = {
  transaction: CalendarTransaction;
  score: number;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  reasons: string[];
  requiresConfirmation: boolean;
};

export type CalendarState = {
  isEmpty: boolean;
  noEventsInRange: boolean;
  allPredictionsDismissed: boolean;
  isStale: boolean;
  isPartial: boolean;
  stateMessages: string[];
};

export type CalendarViewModel = {
  filters: CalendarFilters;
  monthDates: Date[];
  monthEvents: EffectiveCalendarEvent[];
  selectedDayEvents: EffectiveCalendarEvent[];
  upcomingEvents: EffectiveCalendarEvent[];
  matchCandidates: Record<string, MatchCandidate | undefined>;
  accounts: Array<{ id: string; name: string; currency: string }>;
  state: CalendarState;
};

export type RawCalendarData = {
  ownerId: string;
  events: RawCalendarEvent[];
  transactions: CalendarTransaction[];
  accounts: Array<{
    id: string;
    userId: string;
    name: string;
    currency: string;
  }>;
  recurringStreamCount: number;
};
