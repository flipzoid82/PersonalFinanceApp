export const DETECTION_VERSION = 1;
export const PROJECTION_HORIZON_DAYS = 90;
export const INACTIVE_AFTER_MISSED_CYCLES = 2;

export const CONFIDENCE_THRESHOLDS = {
  high: 0.8,
  medium: 0.55,
} as const;

export const INTERVAL_TOLERANCES = {
  weeklyDays: 2,
  biweeklyDays: 3,
  monthlyDays: 5,
  quarterlyDays: 10,
  annualDays: 14,
} as const;

export const MATCHING_TOLERANCES = {
  highConfidenceDays: 5,
  mediumConfidenceDays: 7,
  fixedPercent: "0.10",
  fixedAbsolute: "5",
  variablePercentCap: "0.35",
  variableAbsoluteCap: "250",
} as const;

export const MINIMUM_OCCURRENCES = {
  standard: 3,
  annual: 2,
} as const;
