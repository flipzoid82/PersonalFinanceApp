import type {
  AccountType,
  ImportCandidateKind,
  ImportCandidateStatus,
  ImportType,
  InvestmentTransactionType,
} from "@prisma/client";

export type ImportAccountIdentity = {
  sourceKey: string;
  displayName: string;
  institutionName?: string;
  maskedIdentifier?: string;
  accountType: AccountType;
  accountSubtype?: string;
  currency: string;
};

export type ImportEvidence = {
  parserFamily: string;
  parserVersion: string;
  documentType: ImportType;
  extractionMethod: "native-pdf-text" | "csv" | "ocr";
  page?: number;
  section?: string;
  sourceLabel?: string;
  normalizedConcept: string;
};

export type ProposedImportData = {
  account: ImportAccountIdentity;
  asOfDate?: string;
  totalValue?: string;
  vestedValue?: string;
  currentBalance?: string;
  availableBalance?: string;
  securityName?: string;
  tickerSymbol?: string;
  securityType?: string;
  quantity?: string;
  price?: string;
  currentValue?: string;
  costBasis?: string;
  allocationPercent?: string;
  transactionDate?: string;
  settlementDate?: string;
  transactionType?: InvestmentTransactionType;
  amount?: string;
  fees?: string;
  sourceReference?: string;
  informationalLabel?: string;
  informationalValue?: string;
};

export type ParsedImportCandidate = {
  ordinal: number;
  kind: ImportCandidateKind;
  status: ImportCandidateStatus;
  sourceLabel?: string;
  proposedData?: ProposedImportData;
  evidence: ImportEvidence;
  reviewReason?: string;
};

export type ParsedImportDocument = {
  importType: ImportType;
  parserFamily: string;
  parserVersion: string;
  statementStartAt?: string;
  statementEndAt?: string;
  asOfDate?: string;
  currency?: string;
  candidates: ParsedImportCandidate[];
  usedOcr: boolean;
};

export type CsvMapping = {
  importType: "GENERIC_ACCOUNT_BALANCE_CSV" | "GENERIC_INVESTMENT_HOLDINGS_CSV";
  account: string;
  asOfDate: string;
  value: string;
  currency?: string;
  defaultCurrency?: string;
  securityName?: string;
  tickerSymbol?: string;
  quantity?: string;
  price?: string;
  costBasis?: string;
};
