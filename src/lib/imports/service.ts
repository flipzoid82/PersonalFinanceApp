import "server-only";

import {
  AccountSource,
  DataSourceStatus,
  DataSourceType,
  ImportAccountMatchStatus,
  ImportCandidateKind,
  ImportCandidateStatus,
  ImportSourceStatus,
  ImportStatus,
  ImportType,
  InvestmentSource,
  Prisma,
  type PrismaClient,
} from "@prisma/client";
import { db } from "@/lib/db";
import { currentAccountWhere } from "@/lib/accounts/current";
import {
  detectCommonCsvMapping,
  detectCsvImportType,
  CsvParseError,
  mapGenericCsv,
  parseCsv,
} from "./csv";
import {
  candidateIdentity,
  fingerprintObject,
  sanitizeFilename,
  sha256,
  sourceCandidateFingerprint,
} from "./identity";
import { matchImportAccount } from "./matching";
import { extractPdfOcrText, extractPdfText } from "./pdf";
import {
  detectStatementType,
  ImportParseError,
  parseStatementText,
} from "./parsers";
import {
  deleteRetainedSource,
  readEncryptedSource,
  retainEncryptedSource,
} from "./storage";
import type {
  CsvMapping,
  ParsedImportCandidate,
  ParsedImportDocument,
} from "./types";

export const MAX_IMPORT_FILE_BYTES = 8 * 1024 * 1024;
export const IMPORT_RETENTION_DAYS = 30;
const PLAN_VERSION = 1;

const PDF_TYPES = new Set<ImportType>([
  ImportType.FIDELITY_NETBENEFITS_STATEMENT,
  ImportType.FIDELITY_BROKERAGE_STATEMENT,
  ImportType.FIDELITY_TRADE_CONFIRMATION,
  ImportType.TSP_STATEMENT,
]);
const CSV_TYPES = new Set<ImportType>([
  ImportType.GENERIC_ACCOUNT_BALANCE_CSV,
  ImportType.GENERIC_INVESTMENT_HOLDINGS_CSV,
]);

export class ImportServiceError extends Error {}

export class ImportDetectionError extends ImportServiceError {
  constructor(
    message: string,
    readonly fallback: "csv" | "pdf",
  ) {
    super(message);
  }
}

function asJson(value: unknown) {
  return value as Prisma.InputJsonValue;
}

function accountStableKey(candidate: ParsedImportCandidate) {
  const account = candidate.proposedData?.account;
  if (!account) return "informational";
  return fingerprintObject({
    sourceKey: account.sourceKey.trim().toLocaleLowerCase(),
    institution: account.institutionName?.trim().toLocaleLowerCase(),
    mask: account.maskedIdentifier,
    type: account.accountType,
    subtype: account.accountSubtype?.trim().toLocaleLowerCase(),
    currency: account.currency,
  });
}

function sourceDetails(type: ImportType) {
  if (type === ImportType.TSP_STATEMENT)
    return {
      sourceType: DataSourceType.CSV_IMPORT,
      displayName: "TSP statement imports",
    };
  if (PDF_TYPES.has(type))
    return {
      sourceType: DataSourceType.FIDELITY_IMPORT,
      displayName: "Fidelity statement imports",
    };
  return { sourceType: DataSourceType.CSV_IMPORT, displayName: "CSV imports" };
}

async function getOrCreateDataSource(ownerId: string, type: ImportType) {
  const details = sourceDetails(type);
  const existing = await db.dataSource.findFirst({
    where: { userId: ownerId, ...details },
    orderBy: { createdAt: "asc" },
  });
  return (
    existing ??
    (await db.dataSource.create({
      data: { userId: ownerId, ...details, status: DataSourceStatus.ACTIVE },
    }))
  );
}

function countStates(candidates: ParsedImportCandidate[]) {
  return {
    duplicateRowCount: candidates.filter(
      (item) => item.status === ImportCandidateStatus.DUPLICATE,
    ).length,
    rejectedRowCount: candidates.filter(
      (item) => item.status === ImportCandidateStatus.REJECTED,
    ).length,
    reviewRowCount: candidates.filter(
      (item) => item.status === ImportCandidateStatus.NEEDS_REVIEW,
    ).length,
    informationalRowCount: candidates.filter(
      (item) => item.status === ImportCandidateStatus.INFORMATIONAL,
    ).length,
  };
}

async function duplicateAgainstExisting(
  ownerId: string,
  candidate: ParsedImportCandidate,
  identity: string,
  matchedAccountId?: string,
) {
  const data = candidate.proposedData;
  if (!data) return null;
  if (candidate.kind === ImportCandidateKind.BALANCE_SNAPSHOT) {
    const record = await db.balanceSnapshot.findFirst({
      where: { userId: ownerId, importIdentityKey: identity },
      select: { currentBalance: true, availableBalance: true },
    });
    if (record)
      return record.currentBalance.equals(data.currentBalance ?? "") &&
        (data.availableBalance === undefined ||
          record.availableBalance?.equals(data.availableBalance) === true)
        ? "duplicate"
        : "conflict";
  }
  if (candidate.kind === ImportCandidateKind.INVESTMENT_BALANCE_SNAPSHOT) {
    const record = await db.investmentBalanceSnapshot.findFirst({
      where: { userId: ownerId, importIdentityKey: identity },
      select: { totalValue: true, vestedValue: true },
    });
    if (record)
      return record.totalValue.equals(data.totalValue ?? "") &&
        (data.vestedValue === undefined ||
          record.vestedValue?.equals(data.vestedValue) === true)
        ? "duplicate"
        : "conflict";
  }
  if (candidate.kind === ImportCandidateKind.HOLDING) {
    const record = await db.investmentHolding.findFirst({
      where: { userId: ownerId, importIdentityKey: identity },
      select: {
        currentValue: true,
        quantity: true,
        price: true,
        costBasis: true,
      },
    });
    if (record)
      return record.currentValue.equals(data.currentValue ?? "") &&
        (data.quantity === undefined ||
          record.quantity?.equals(data.quantity) === true) &&
        (data.price === undefined ||
          record.price?.equals(data.price) === true) &&
        (data.costBasis === undefined ||
          record.costBasis?.equals(data.costBasis) === true)
        ? "duplicate"
        : "conflict";
  }
  if (candidate.kind === ImportCandidateKind.INVESTMENT_TRANSACTION) {
    const record = await db.investmentTransaction.findFirst({
      where: { userId: ownerId, importIdentityKey: identity },
      select: { id: true },
    });
    if (record) return "duplicate";
  }
  if (!matchedAccountId) return null;
  if (
    candidate.kind === ImportCandidateKind.INVESTMENT_TRANSACTION &&
    data.transactionDate &&
    data.transactionType
  ) {
    const dates = [data.transactionDate, data.settlementDate]
      .filter((value): value is string => Boolean(value))
      .map((value) => new Date(`${value}T00:00:00.000Z`));
    const possible = await db.investmentTransaction.findMany({
      where: {
        userId: ownerId,
        accountId: matchedAccountId,
        transactionType: data.transactionType,
        transactionDate: { in: dates },
        ...(data.tickerSymbol
          ? { tickerSymbol: { equals: data.tickerSymbol, mode: "insensitive" } }
          : data.securityName
            ? {
                securityName: {
                  equals: data.securityName,
                  mode: "insensitive",
                },
              }
            : {}),
      },
      select: { quantity: true, price: true, amount: true },
    });
    const same = possible.some(
      (record) =>
        (data.quantity === undefined ||
          record.quantity?.equals(data.quantity)) &&
        (data.price === undefined || record.price?.equals(data.price)) &&
        (data.amount === undefined || record.amount?.equals(data.amount)),
    );
    if (same) return "duplicate";
  }
  const asOfDate = data.asOfDate
    ? new Date(`${data.asOfDate}T00:00:00.000Z`)
    : undefined;
  if (candidate.kind === ImportCandidateKind.BALANCE_SNAPSHOT && asOfDate)
    return (await db.balanceSnapshot.findUnique({
      where: {
        accountId_capturedAt: {
          accountId: matchedAccountId,
          capturedAt: asOfDate,
        },
      },
      select: { currentBalance: true },
    }))
      ? "conflict"
      : null;
  if (
    candidate.kind === ImportCandidateKind.INVESTMENT_BALANCE_SNAPSHOT &&
    asOfDate
  )
    return (await db.investmentBalanceSnapshot.findUnique({
      where: {
        accountId_source_asOfDate: {
          accountId: matchedAccountId,
          source: InvestmentSource.IMPORTED,
          asOfDate,
        },
      },
      select: { totalValue: true },
    }))
      ? "conflict"
      : null;
  return null;
}

async function persistParsedPlan(
  ownerId: string,
  jobId: string,
  parsed: ParsedImportDocument,
  additionalPlanData: Record<string, unknown> = {},
) {
  const accounts = await db.account.findMany({
    where: currentAccountWhere(ownerId),
    select: {
      id: true,
      name: true,
      institutionName: true,
      mask: true,
      accountType: true,
      accountSubtype: true,
      currency: true,
    },
  });
  const accountIdentities = new Map(
    parsed.candidates
      .map((candidate) => candidate.proposedData?.account)
      .filter((value) => value !== undefined)
      .map((identity) => [identity.sourceKey, identity]),
  );
  const matches = [...accountIdentities.values()].map((identity) => {
    const decision = matchImportAccount(identity, accounts);
    return {
      identity,
      decision:
        decision.status === ImportAccountMatchStatus.CREATE
          ? {
              ...decision,
              status: ImportAccountMatchStatus.NEEDS_REVIEW,
              reason:
                "No existing account matched. Confirm creation or choose an existing account.",
            }
          : decision,
    };
  });
  const candidates = await Promise.all(
    parsed.candidates.map(async (candidate) => {
      if (
        !candidate.proposedData?.account ||
        candidate.status !== ImportCandidateStatus.READY
      )
        return candidate;
      const match = matches.find(
        ({ identity }) =>
          identity.sourceKey === candidate.proposedData?.account.sourceKey,
      );
      const identity = candidateIdentity(
        parsed.parserFamily,
        candidate,
        accountStableKey(candidate),
      );
      const duplicate = await duplicateAgainstExisting(
        ownerId,
        candidate,
        identity,
        match?.decision.matchedAccountId,
      );
      if (duplicate === "duplicate")
        return {
          ...candidate,
          status: ImportCandidateStatus.DUPLICATE,
          reviewReason:
            "This financial observation was already imported and will be skipped.",
        };
      if (duplicate === "conflict")
        return {
          ...candidate,
          status: ImportCandidateStatus.NEEDS_REVIEW,
          reviewReason:
            "An existing observation has the same account and date but different source values. Skip it or undo the earlier import before re-importing.",
        };
      return candidate;
    }),
  );
  const needsAccountReview = matches.some(
    ({ decision }) => decision.status === ImportAccountMatchStatus.NEEDS_REVIEW,
  );
  const stateCounts = countStates(candidates);
  const planFingerprint = fingerprintObject({
    version: PLAN_VERSION,
    parsed: { ...parsed, candidates },
    matches,
    additionalPlanData,
  });

  await db.$transaction(async (tx) => {
    const job = await tx.importJob.findFirst({
      where: { id: jobId, userId: ownerId },
    });
    if (
      !job ||
      (job.status !== ImportStatus.PENDING &&
        job.status !== ImportStatus.PROCESSING &&
        job.status !== ImportStatus.NEEDS_REVIEW)
    )
      throw new ImportServiceError("This import can no longer be changed.");
    await tx.importCandidate.deleteMany({ where: { importJobId: jobId } });
    await tx.importAccountMatch.deleteMany({ where: { importJobId: jobId } });
    const createdMatches = new Map<string, string>();
    for (const { identity, decision } of matches) {
      const match = await tx.importAccountMatch.create({
        data: {
          importJobId: jobId,
          sourceKey: identity.sourceKey,
          displayName: identity.displayName,
          institutionName: identity.institutionName,
          maskedIdentifier: identity.maskedIdentifier,
          accountType: identity.accountType,
          accountSubtype: identity.accountSubtype,
          currency: identity.currency,
          status: decision.status,
          matchedAccountId: decision.matchedAccountId,
          reason: decision.reason,
        },
      });
      createdMatches.set(identity.sourceKey, match.id);
    }
    for (const candidate of candidates) {
      await tx.importCandidate.create({
        data: {
          importJobId: jobId,
          accountMatchId: candidate.proposedData?.account
            ? createdMatches.get(candidate.proposedData.account.sourceKey)
            : undefined,
          ordinal: candidate.ordinal,
          kind: candidate.kind,
          status: candidate.status,
          sourceFingerprint: sourceCandidateFingerprint(
            parsed.parserFamily,
            candidate.ordinal,
            candidate.proposedData,
          ),
          sourceLabel: candidate.sourceLabel,
          proposedData: candidate.proposedData
            ? asJson(candidate.proposedData)
            : undefined,
          evidence: asJson(candidate.evidence),
          reviewReason: candidate.reviewReason,
        },
      });
    }
    const hasReady = candidates.some(
      (item) => item.status === ImportCandidateStatus.READY,
    );
    await tx.importJob.update({
      where: { id: jobId },
      data: {
        importType: parsed.importType,
        parserFamily: parsed.parserFamily,
        parserVersion: parsed.parserVersion,
        statementStartAt: parsed.statementStartAt
          ? new Date(`${parsed.statementStartAt}T00:00:00.000Z`)
          : null,
        statementEndAt: parsed.statementEndAt
          ? new Date(`${parsed.statementEndAt}T00:00:00.000Z`)
          : null,
        asOfDate: parsed.asOfDate
          ? new Date(`${parsed.asOfDate}T00:00:00.000Z`)
          : null,
        currency: parsed.currency,
        planVersion: PLAN_VERSION,
        planFingerprint,
        planData: asJson({ usedOcr: parsed.usedOcr, ...additionalPlanData }),
        status:
          needsAccountReview || stateCounts.reviewRowCount > 0
            ? ImportStatus.NEEDS_REVIEW
            : hasReady
              ? ImportStatus.READY
              : ImportStatus.NEEDS_REVIEW,
        ...stateCounts,
      },
    });
  });
}

export async function createImportFromUpload(
  ownerId: string,
  file: File,
  requestedType?: ImportType,
) {
  if (!file || file.size <= 0)
    throw new ImportServiceError("Choose a non-empty file to import.");
  if (file.size > MAX_IMPORT_FILE_BYTES)
    throw new ImportServiceError("Import files are limited to 8 MB.");
  const extension = file.name.toLocaleLowerCase().split(".").pop();
  const isPdf = extension === "pdf";
  const isCsv = extension === "csv";
  if (!isPdf && !isCsv)
    throw new ImportServiceError(
      "Choose a supported PDF statement or UTF-8 CSV file.",
    );
  if (
    requestedType &&
    ((isPdf && !PDF_TYPES.has(requestedType)) ||
      (isCsv && !CSV_TYPES.has(requestedType)))
  )
    throw new ImportServiceError(
      `Choose a ${isPdf ? "PDF" : "CSV"} file for the selected fallback.`,
    );
  const bytes = new Uint8Array(await file.arrayBuffer());
  let importType: ImportType;
  let csvText: string | undefined;
  let csvHeaders: string[] | undefined;
  let pdfExtraction:
    | {
        text: string;
        pageCount: number;
        method: "native-pdf-text" | "ocr";
        ocrMinimumConfidence?: number;
      }
    | undefined;
  if (isCsv) {
    try {
      csvText = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      throw new ImportServiceError("The CSV must use UTF-8 text encoding.");
    }
    const csv = parseCsv(csvText);
    csvHeaders = csv.headers;
    const detection = detectCsvImportType(csv.headers);
    if (detection.confidence === "ambiguous" && !requestedType)
      throw new ImportDetectionError(
        "We could not tell whether this CSV contains balance snapshots or investment holdings. Choose the closest match and select the file again.",
        "csv",
      );
    importType =
      requestedType ??
      (detection.confidence === "strong"
        ? (detection.importType as ImportType)
        : ImportType.GENERIC_ACCOUNT_BALANCE_CSV);
  } else {
    const native = await extractPdfText(bytes);
    try {
      importType = detectStatementType(native.text);
      pdfExtraction = { ...native, method: "native-pdf-text" };
    } catch (nativeError) {
      try {
        const ocr = await extractPdfOcrText(bytes);
        importType = detectStatementType(ocr.text);
        pdfExtraction = {
          text: ocr.text,
          pageCount: ocr.pageCount,
          method: "ocr",
          ocrMinimumConfidence: ocr.minimumConfidence,
        };
      } catch (ocrError) {
        if (!requestedType)
          throw new ImportDetectionError(
            "We could not safely identify this PDF. Choose the closest supported statement type and select the file again.",
            "pdf",
          );
        importType = requestedType;
        if (native.text.length >= 40)
          pdfExtraction = { ...native, method: "native-pdf-text" };
        else throw ocrError ?? nativeError;
      }
    }
    if (requestedType && requestedType !== importType)
      throw new ImportServiceError(
        "The selected fallback does not match the document content.",
      );
  }
  const fileFingerprint = sha256(bytes);
  const storageKey = await retainEncryptedSource(bytes);
  const retainUntil = new Date(Date.now() + IMPORT_RETENTION_DAYS * 86_400_000);
  let jobId: string | undefined;
  try {
    const source = await getOrCreateDataSource(ownerId, importType);
    const duplicate = await db.importJob.findFirst({
      where: {
        userId: ownerId,
        fileFingerprint,
        status: { in: [ImportStatus.COMPLETED, ImportStatus.PARTIAL] },
      },
      select: { id: true },
      orderBy: { completedAt: "desc" },
    });
    const job = await db.importJob.create({
      data: {
        userId: ownerId,
        dataSourceId: source.id,
        sourceName: sanitizeFilename(file.name),
        sourceContentType:
          file.type || (isPdf ? "application/pdf" : "text/csv"),
        sourceSize: file.size,
        fileFingerprint,
        importType,
        status: ImportStatus.PROCESSING,
        sourceStorageKey: storageKey,
        sourceStatus: ImportSourceStatus.RETAINED,
        sourceRetainUntil: retainUntil,
      },
    });
    jobId = job.id;
    if (isCsv) {
      await db.importJob.update({
        where: { id: job.id },
        data: {
          status: ImportStatus.NEEDS_REVIEW,
          parserFamily:
            importType === ImportType.GENERIC_ACCOUNT_BALANCE_CSV
              ? "GenericBalanceCsvParser"
              : "GenericHoldingCsvParser",
          parserVersion: "1.0.0",
          planVersion: PLAN_VERSION,
          planData: asJson({
            stage: "mapping",
            headers: csvHeaders,
            detectedMapping: detectCommonCsvMapping(csvHeaders ?? []),
            exactDuplicateOf: duplicate?.id,
            detectedType: importType,
          }),
        },
      });
    } else {
      if (!pdfExtraction)
        throw new ImportParseError("The PDF could not be read safely.");
      const parsed: ParsedImportDocument = parseStatementText(
        pdfExtraction.text,
        importType,
        pdfExtraction.method,
      );
      await persistParsedPlan(ownerId, job.id, parsed, {
        pageCount: pdfExtraction.pageCount,
        ...(pdfExtraction.method === "ocr"
          ? {
              ocrPageCount: pdfExtraction.pageCount,
              ocrMinimumConfidence: pdfExtraction.ocrMinimumConfidence,
            }
          : {}),
        exactDuplicateOf: duplicate?.id,
        detectedType: importType,
      });
    }
    return job.id;
  } catch (error) {
    if (jobId)
      await db.importJob.updateMany({
        where: { id: jobId, userId: ownerId },
        data: {
          status: ImportStatus.FAILED,
          failureCode:
            error instanceof ImportParseError
              ? error.code
              : "IMPORT_PREPARATION_FAILED",
          planVersion: PLAN_VERSION,
          planData: asJson({
            stage: "failed",
            failureMessage:
              error instanceof ImportParseError ||
              error instanceof ImportServiceError
                ? error.message
                : "The file could not be prepared safely.",
          }),
        },
      });
    if (jobId) return jobId;
    await deleteRetainedSource(storageKey).catch(() => undefined);
    if (
      error instanceof ImportServiceError ||
      error instanceof ImportParseError
    )
      throw error;
    throw new ImportServiceError(
      "The file could not be prepared safely. Please review it and try again.",
    );
  }
}

export async function mapCsvImport(
  ownerId: string,
  jobId: string,
  mapping: CsvMapping,
) {
  const job = await db.importJob.findFirst({
    where: { id: jobId, userId: ownerId },
    select: {
      sourceStorageKey: true,
      sourceStatus: true,
      planData: true,
      importType: true,
    },
  });
  if (
    !job?.sourceStorageKey ||
    job.sourceStatus !== ImportSourceStatus.RETAINED
  )
    throw new ImportServiceError(
      "The retained CSV is no longer available for mapping.",
    );
  if (!CSV_TYPES.has(job.importType) || mapping.importType !== job.importType)
    throw new ImportServiceError(
      "The CSV mapping type does not match this import.",
    );
  const bytes = await readEncryptedSource(job.sourceStorageKey);
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new ImportServiceError("The CSV must use UTF-8 text encoding.");
  }
  let parsed: ParsedImportDocument;
  try {
    parsed = mapGenericCsv(text, mapping);
  } catch (error) {
    if (error instanceof CsvParseError)
      throw new ImportServiceError(error.message);
    throw error;
  }
  const previous = (job.planData ?? {}) as Record<string, unknown>;
  await persistParsedPlan(ownerId, jobId, parsed, {
    stage: "review",
    mapping,
    exactDuplicateOf: previous.exactDuplicateOf,
  });
}

export async function resolveImportAccount(
  ownerId: string,
  jobId: string,
  matchId: string,
  decision: "existing" | "create",
  accountId?: string,
) {
  await db.$transaction(async (tx) => {
    const match = await tx.importAccountMatch.findFirst({
      where: {
        id: matchId,
        importJobId: jobId,
        importJob: { userId: ownerId },
      },
    });
    if (!match)
      throw new ImportServiceError("The account choice is unavailable.");
    let matchedAccountId: string | null = null;
    if (decision === "existing") {
      const account = await tx.account.findFirst({
        where: currentAccountWhere(ownerId),
      });
      const selected = accountId
        ? await tx.account.findFirst({
            where: { ...currentAccountWhere(ownerId), id: accountId },
          })
        : null;
      if (!account || !selected)
        throw new ImportServiceError("Choose an available account.");
      matchedAccountId = selected.id;
    }
    await tx.importAccountMatch.update({
      where: { id: match.id },
      data: {
        status:
          decision === "existing"
            ? ImportAccountMatchStatus.MATCHED
            : ImportAccountMatchStatus.CREATE,
        matchedAccountId,
        reason:
          decision === "existing"
            ? "Account selected by the owner."
            : "New imported account confirmed by the owner.",
      },
    });
    if (matchedAccountId) {
      const candidates = await tx.importCandidate.findMany({
        where: { importJobId: jobId, accountMatchId: match.id },
      });
      for (const candidate of candidates) {
        const data = proposed(candidate);
        if (!data.asOfDate) continue;
        const asOfDate = new Date(`${data.asOfDate}T00:00:00.000Z`);
        const conflict =
          candidate.kind === ImportCandidateKind.BALANCE_SNAPSHOT
            ? await tx.balanceSnapshot.findUnique({
                where: {
                  accountId_capturedAt: {
                    accountId: matchedAccountId,
                    capturedAt: asOfDate,
                  },
                },
                select: { id: true },
              })
            : candidate.kind === ImportCandidateKind.INVESTMENT_BALANCE_SNAPSHOT
              ? await tx.investmentBalanceSnapshot.findUnique({
                  where: {
                    accountId_source_asOfDate: {
                      accountId: matchedAccountId,
                      source: InvestmentSource.IMPORTED,
                      asOfDate,
                    },
                  },
                  select: { id: true },
                })
              : null;
        if (conflict)
          await tx.importCandidate.update({
            where: { id: candidate.id },
            data: {
              status: ImportCandidateStatus.NEEDS_REVIEW,
              reviewReason:
                "The selected account already has an observation on this date. Skip this item or choose a different account.",
            },
          });
      }
    }
    const unresolved = await tx.importAccountMatch.count({
      where: {
        importJobId: jobId,
        status: ImportAccountMatchStatus.NEEDS_REVIEW,
      },
    });
    const reviewCandidates = await tx.importCandidate.count({
      where: { importJobId: jobId, status: ImportCandidateStatus.NEEDS_REVIEW },
    });
    await tx.importJob.update({
      where: { id: jobId },
      data: {
        status:
          unresolved || reviewCandidates
            ? ImportStatus.NEEDS_REVIEW
            : ImportStatus.READY,
      },
    });
  });
}

export async function skipImportCandidate(
  ownerId: string,
  jobId: string,
  candidateId: string,
) {
  await db.$transaction(async (tx) => {
    const candidate = await tx.importCandidate.findFirst({
      where: {
        id: candidateId,
        importJobId: jobId,
        importJob: { userId: ownerId },
        status: ImportCandidateStatus.NEEDS_REVIEW,
      },
    });
    if (!candidate)
      throw new ImportServiceError("This review item is no longer available.");
    await tx.importCandidate.update({
      where: { id: candidate.id },
      data: { status: ImportCandidateStatus.SKIPPED },
    });
    const [unresolvedAccounts, unresolvedCandidates, readyCandidates] =
      await Promise.all([
        tx.importAccountMatch.count({
          where: {
            importJobId: jobId,
            status: ImportAccountMatchStatus.NEEDS_REVIEW,
          },
        }),
        tx.importCandidate.count({
          where: {
            importJobId: jobId,
            status: ImportCandidateStatus.NEEDS_REVIEW,
          },
        }),
        tx.importCandidate.count({
          where: { importJobId: jobId, status: ImportCandidateStatus.READY },
        }),
      ]);
    await tx.importJob.update({
      where: { id: jobId },
      data: {
        reviewRowCount: unresolvedCandidates,
        status:
          unresolvedAccounts || unresolvedCandidates || !readyCandidates
            ? ImportStatus.NEEDS_REVIEW
            : ImportStatus.READY,
      },
    });
  });
}

function proposed(candidate: { proposedData: Prisma.JsonValue | null }) {
  return candidate.proposedData as unknown as NonNullable<
    ParsedImportCandidate["proposedData"]
  >;
}

export async function commitImport(ownerId: string, jobId: string) {
  await db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${ownerId}), hashtext('financial-import'))`;
      const job = await tx.importJob.findFirst({
        where: { id: jobId, userId: ownerId },
        include: {
          accountMatches: true,
          candidates: { orderBy: { ordinal: "asc" } },
        },
      });
      if (
        !job ||
        job.status !== ImportStatus.READY ||
        !job.parserFamily ||
        !job.planFingerprint
      )
        throw new ImportServiceError("This import is not ready to confirm.");
      if (
        job.accountMatches.some(
          (match) => match.status === ImportAccountMatchStatus.NEEDS_REVIEW,
        )
      )
        throw new ImportServiceError(
          "Resolve every account choice before confirming.",
        );
      const accountIds = new Map<string, string>();
      for (const match of job.accountMatches) {
        if (
          match.status === ImportAccountMatchStatus.MATCHED &&
          match.matchedAccountId
        ) {
          const owned = await tx.account.findFirst({
            where: { id: match.matchedAccountId, userId: ownerId },
            select: { id: true },
          });
          if (!owned)
            throw new ImportServiceError(
              "A selected account is no longer available.",
            );
          accountIds.set(match.id, owned.id);
        } else if (match.status === ImportAccountMatchStatus.CREATE) {
          const account = await tx.account.create({
            data: {
              userId: ownerId,
              dataSourceId: job.dataSourceId,
              name: match.displayName,
              institutionName: match.institutionName,
              mask: match.maskedIdentifier,
              accountType: match.accountType,
              accountSubtype: match.accountSubtype,
              source: AccountSource.IMPORTED,
              currency: match.currency,
              currentBalance: new Prisma.Decimal(0),
              balanceAvailable: false,
              isManual: false,
              createdByImportJobId: job.id,
            },
          });
          accountIds.set(match.id, account.id);
          await tx.importAccountMatch.update({
            where: { id: match.id },
            data: {
              status: ImportAccountMatchStatus.MATCHED,
              matchedAccountId: account.id,
            },
          });
        }
      }
      let imported = 0;
      let duplicates = job.duplicateRowCount;
      for (const candidate of job.candidates) {
        if (
          candidate.status !== ImportCandidateStatus.READY ||
          !candidate.accountMatchId
        )
          continue;
        const accountId = accountIds.get(candidate.accountMatchId);
        if (!accountId)
          throw new ImportServiceError("A candidate account is unresolved.");
        const data = proposed(candidate);
        const identity = candidateIdentity(
          job.parserFamily,
          { kind: candidate.kind, proposedData: data },
          accountStableKey({
            ordinal: candidate.ordinal,
            kind: candidate.kind,
            status: candidate.status,
            evidence: {} as ParsedImportCandidate["evidence"],
            proposedData: data,
          }),
        );
        const duplicate = await Promise.all([
          tx.balanceSnapshot.findFirst({
            where: { userId: ownerId, importIdentityKey: identity },
          }),
          tx.investmentBalanceSnapshot.findFirst({
            where: { userId: ownerId, importIdentityKey: identity },
          }),
          tx.investmentHolding.findFirst({
            where: { userId: ownerId, importIdentityKey: identity },
          }),
          tx.investmentTransaction.findFirst({
            where: { userId: ownerId, importIdentityKey: identity },
          }),
        ]).then((records) => records.some(Boolean));
        if (duplicate) {
          duplicates += 1;
          await tx.importCandidate.update({
            where: { id: candidate.id },
            data: {
              status: ImportCandidateStatus.DUPLICATE,
              reviewReason:
                "This observation was committed by another import and was skipped.",
            },
          });
          continue;
        }
        const asOfDate = data.asOfDate
          ? new Date(`${data.asOfDate}T00:00:00.000Z`)
          : null;
        if (
          candidate.kind === ImportCandidateKind.BALANCE_SNAPSHOT &&
          asOfDate &&
          data.currentBalance
        ) {
          await tx.balanceSnapshot.create({
            data: {
              userId: ownerId,
              accountId,
              currentBalance: new Prisma.Decimal(data.currentBalance),
              availableBalance: data.availableBalance
                ? new Prisma.Decimal(data.availableBalance)
                : null,
              capturedAt: asOfDate,
              importJobId: job.id,
              importIdentityKey: identity,
            },
          });
        } else if (
          candidate.kind === ImportCandidateKind.INVESTMENT_BALANCE_SNAPSHOT &&
          asOfDate &&
          data.totalValue
        ) {
          await tx.investmentBalanceSnapshot.create({
            data: {
              userId: ownerId,
              accountId,
              totalValue: new Prisma.Decimal(data.totalValue),
              vestedValue: data.vestedValue
                ? new Prisma.Decimal(data.vestedValue)
                : null,
              source: InvestmentSource.IMPORTED,
              asOfDate,
              importJobId: job.id,
              importIdentityKey: identity,
            },
          });
        } else if (
          candidate.kind === ImportCandidateKind.HOLDING &&
          asOfDate &&
          data.securityName &&
          data.currentValue
        ) {
          await tx.investmentHolding.create({
            data: {
              userId: ownerId,
              accountId,
              source: InvestmentSource.IMPORTED,
              securityName: data.securityName,
              tickerSymbol: data.tickerSymbol,
              securityType: data.securityType,
              quantity: data.quantity
                ? new Prisma.Decimal(data.quantity)
                : null,
              price: data.price ? new Prisma.Decimal(data.price) : null,
              currentValue: new Prisma.Decimal(data.currentValue),
              costBasis: data.costBasis
                ? new Prisma.Decimal(data.costBasis)
                : null,
              currency: data.account.currency,
              asOfDate,
              importJobId: job.id,
              importIdentityKey: identity,
            },
          });
        } else if (
          candidate.kind === ImportCandidateKind.INVESTMENT_TRANSACTION &&
          data.transactionDate &&
          data.transactionType
        ) {
          await tx.investmentTransaction.create({
            data: {
              userId: ownerId,
              accountId,
              source: InvestmentSource.IMPORTED,
              providerInvestmentTransactionId: data.sourceReference || null,
              transactionDate: new Date(
                `${data.transactionDate}T00:00:00.000Z`,
              ),
              transactionType: data.transactionType,
              securityName: data.securityName,
              tickerSymbol: data.tickerSymbol,
              amount: data.amount ? new Prisma.Decimal(data.amount) : null,
              quantity: data.quantity
                ? new Prisma.Decimal(data.quantity)
                : null,
              price: data.price ? new Prisma.Decimal(data.price) : null,
              fees: data.fees ? new Prisma.Decimal(data.fees) : null,
              currency: data.account.currency,
              rawPayload: asJson({
                settlementDate: data.settlementDate,
                parserFamily: job.parserFamily,
                parserVersion: job.parserVersion,
              }),
              importJobId: job.id,
              importIdentityKey: identity,
            },
          });
        } else continue;
        imported += 1;
        await tx.account.update({
          where: { id: accountId },
          data: {
            lastImportedAt: new Date(),
            ...((candidate.kind === ImportCandidateKind.BALANCE_SNAPSHOT ||
              candidate.kind ===
                ImportCandidateKind.INVESTMENT_BALANCE_SNAPSHOT) && {
              balanceAvailable: true,
            }),
          },
        });
      }
      if (!imported)
        throw new ImportServiceError("There are no new ready items to import.");
      const hasIssues =
        duplicates > 0 ||
        job.rejectedRowCount > 0 ||
        job.informationalRowCount > 0;
      await tx.importJob.update({
        where: { id: job.id },
        data: {
          status: hasIssues ? ImportStatus.PARTIAL : ImportStatus.COMPLETED,
          importedRowCount: imported,
          duplicateRowCount: duplicates,
          reviewRowCount: 0,
          completedAt: new Date(),
        },
      });
      await tx.dataSource.update({
        where: { id: job.dataSourceId },
        data: { lastUpdatedAt: new Date(), status: DataSourceStatus.ACTIVE },
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function deleteImportSource(ownerId: string, jobId: string) {
  const job = await db.importJob.findFirst({
    where: { id: jobId, userId: ownerId },
    select: { sourceStorageKey: true, sourceStatus: true },
  });
  if (!job) throw new ImportServiceError("Import not found.");
  if (!job.sourceStorageKey || job.sourceStatus !== ImportSourceStatus.RETAINED)
    return;
  const result = await deleteRetainedSource(job.sourceStorageKey);
  await db.importJob.updateMany({
    where: {
      id: jobId,
      userId: ownerId,
      sourceStatus: ImportSourceStatus.RETAINED,
    },
    data: {
      sourceStatus:
        result === "deleted"
          ? ImportSourceStatus.DELETED
          : ImportSourceStatus.MISSING,
      sourceDeletedAt: new Date(),
      sourceStorageKey: null,
    },
  });
}

export async function cancelImport(ownerId: string, jobId: string) {
  const job = await db.importJob.findFirst({
    where: { id: jobId, userId: ownerId },
    select: { status: true },
  });
  if (!job) throw new ImportServiceError("Import not found.");
  if (
    job.status === ImportStatus.COMPLETED ||
    job.status === ImportStatus.PARTIAL ||
    job.status === ImportStatus.REVERTED
  )
    throw new ImportServiceError("A committed import cannot be canceled.");
  await deleteImportSource(ownerId, jobId);
  await db.importJob.updateMany({
    where: { id: jobId, userId: ownerId },
    data: { status: ImportStatus.CANCELED },
  });
}

export async function undoImport(ownerId: string, jobId: string) {
  await db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${ownerId}), hashtext('financial-import'))`;
      const job = await tx.importJob.findFirst({
        where: { id: jobId, userId: ownerId },
        include: { createdAccounts: true },
      });
      if (
        !job ||
        (job.status !== ImportStatus.COMPLETED &&
          job.status !== ImportStatus.PARTIAL)
      )
        throw new ImportServiceError("This import cannot be undone.");
      for (const account of job.createdAccounts) {
        const [
          transactions,
          recurring,
          events,
          otherBalances,
          otherInvestmentBalances,
          otherHoldings,
          otherInvestmentTransactions,
        ] = await Promise.all([
          tx.transaction.count({ where: { accountId: account.id } }),
          tx.recurringStream.count({ where: { typicalAccountId: account.id } }),
          tx.calendarEvent.count({ where: { accountId: account.id } }),
          tx.balanceSnapshot.count({
            where: { accountId: account.id, importJobId: { not: job.id } },
          }),
          tx.investmentBalanceSnapshot.count({
            where: { accountId: account.id, importJobId: { not: job.id } },
          }),
          tx.investmentHolding.count({
            where: { accountId: account.id, importJobId: { not: job.id } },
          }),
          tx.investmentTransaction.count({
            where: { accountId: account.id, importJobId: { not: job.id } },
          }),
        ]);
        if (
          transactions +
            recurring +
            events +
            otherBalances +
            otherInvestmentBalances +
            otherHoldings +
            otherInvestmentTransactions >
          0
        )
          throw new ImportServiceError(
            `Undo is blocked because ${account.name} has later or dependent financial records.`,
          );
      }
      await tx.investmentTransaction.deleteMany({
        where: { importJobId: job.id, userId: ownerId },
      });
      await tx.investmentHolding.deleteMany({
        where: { importJobId: job.id, userId: ownerId },
      });
      await tx.investmentBalanceSnapshot.deleteMany({
        where: { importJobId: job.id, userId: ownerId },
      });
      await tx.balanceSnapshot.deleteMany({
        where: { importJobId: job.id, userId: ownerId },
      });
      const createdIds = job.createdAccounts.map(({ id }) => id);
      if (createdIds.length) {
        await tx.importAccountMatch.updateMany({
          where: { importJobId: job.id, matchedAccountId: { in: createdIds } },
          data: {
            matchedAccountId: null,
            status: ImportAccountMatchStatus.CREATE,
          },
        });
        await tx.importAccountMatch.updateMany({
          where: {
            matchedAccountId: { in: createdIds },
            importJob: { userId: ownerId },
          },
          data: { matchedAccountId: null },
        });
        await tx.importJob.updateMany({
          where: { userId: ownerId, matchedAccountId: { in: createdIds } },
          data: { matchedAccountId: null },
        });
        await tx.account.deleteMany({
          where: { id: { in: createdIds }, userId: ownerId },
        });
      }
      await tx.importJob.update({
        where: { id: job.id },
        data: { status: ImportStatus.REVERTED, revertedAt: new Date() },
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function cleanupExpiredImportSources(now = new Date()) {
  let cursor: string | undefined;
  let attempted = 0;

  while (true) {
    const expired = await db.importJob.findMany({
      where: {
        sourceStatus: ImportSourceStatus.RETAINED,
        sourceRetainUntil: { lte: now },
        sourceStorageKey: { not: null },
      },
      select: { id: true, userId: true },
      orderBy: { id: "asc" },
      take: 50,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (!expired.length) break;

    for (const job of expired) {
      attempted += 1;
      await deleteImportSource(job.userId, job.id).catch(() => undefined);
    }
    cursor = expired.at(-1)!.id;
    if (expired.length < 50) break;
  }

  return attempted;
}
