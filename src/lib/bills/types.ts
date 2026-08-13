import type { EffectiveCalendarEvent } from "@/lib/calendar";

export type BillRange = 14 | 30 | 60 | 90;

export type BillsViewModel = {
  days: BillRange;
  rangeStart: Date;
  rangeEnd: Date;
  bills: EffectiveCalendarEvent[];
  expectedIncome: EffectiveCalendarEvent[];
  inactive: EffectiveCalendarEvent[];
  upcomingTotal: import("@prisma/client").Prisma.Decimal;
  confirmedCount: number;
  predictedCount: number;
  needsConfirmationCount: number;
  stateMessages: string[];
  isEmpty: boolean;
};
