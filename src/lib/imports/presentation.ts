import type {
  ImportCandidateKind,
  ImportCandidateStatus,
  ImportStatus,
  ImportType,
} from "@prisma/client";

export function formatImportDate(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(value);
}

export const importTypeLabels: Record<ImportType, string> = {
  BANK_TRANSACTIONS_CSV:
    "Bank transactions CSV (not supported in Milestone 11)",
  FIDELITY_POSITIONS_CSV: "Legacy Fidelity positions CSV",
  FIDELITY_TRANSACTIONS_CSV: "Legacy Fidelity transactions CSV",
  MANUAL_BALANCE_SNAPSHOT: "Manual balance snapshot",
  GENERIC_ACCOUNT_BALANCE_CSV: "Generic balance snapshots CSV",
  GENERIC_INVESTMENT_HOLDINGS_CSV: "Generic investment holdings CSV",
  FIDELITY_NETBENEFITS_STATEMENT: "Fidelity NetBenefits statement",
  FIDELITY_BROKERAGE_STATEMENT: "Fidelity brokerage monthly statement",
  FIDELITY_TRADE_CONFIRMATION: "Fidelity trade confirmation",
  TSP_STATEMENT: "TSP statement",
};

export const importStatusLabels: Record<ImportStatus, string> = {
  PENDING: "Pending",
  PROCESSING: "Processing",
  NEEDS_REVIEW: "Needs review",
  READY: "Ready to import",
  COMPLETED: "Completed",
  PARTIAL: "Completed with issues",
  FAILED: "Failed",
  CANCELED: "Canceled",
  REVERTED: "Reverted",
};

export const candidateStatusLabels: Record<ImportCandidateStatus, string> = {
  READY: "Ready to import",
  DUPLICATE: "Duplicate — will skip",
  NEEDS_REVIEW: "Needs review",
  REJECTED: "Rejected",
  INFORMATIONAL: "Informational only",
  SKIPPED: "Skipped",
};

export const candidateKindLabels: Record<ImportCandidateKind, string> = {
  BALANCE_SNAPSHOT: "Balance snapshot",
  INVESTMENT_BALANCE_SNAPSHOT: "Investment balance",
  HOLDING: "Holding",
  INVESTMENT_TRANSACTION: "Investment activity",
  INFORMATIONAL: "Statement information",
};
