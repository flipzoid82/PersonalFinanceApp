import {
  ImportAccountMatchStatus,
  ImportCandidateStatus,
  ImportSourceStatus,
  ImportStatus,
  Prisma,
} from "@prisma/client";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  cancelImportAction,
  commitImportAction,
  deleteImportSourceAction,
  undoImportAction,
  skipImportCandidateAction,
} from "@/actions/imports";
import { ImportConfirmationDialog } from "@/components/imports/confirmation-dialog";
import {
  AccountMatchForm,
  CsvMappingForm,
} from "@/components/imports/import-forms";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { requireUser } from "@/lib/auth";
import {
  candidateKindLabels,
  candidateStatusLabels,
  formatImportDate,
  importStatusLabels,
  importTypeLabels,
} from "@/lib/imports/presentation";
import {
  getImportAccountOptions,
  getImportDetail,
} from "@/lib/imports/queries";

function dateTime(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function jsonRecord(value: Prisma.JsonValue | null | undefined) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function candidateSummary(value: Prisma.JsonValue | null) {
  const data = jsonRecord(value);
  const account = jsonRecord(data.account as Prisma.JsonValue);
  const details = [
    account.displayName,
    data.asOfDate ?? data.transactionDate,
    data.securityName,
    data.totalValue ?? data.currentBalance ?? data.currentValue ?? data.amount,
    account.currency,
  ].filter((item) => typeof item === "string" && item.length);
  return (
    details.join(" · ") || "No normalized financial record will be created."
  );
}

export default async function ImportDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ importId: string }>;
  searchParams: Promise<{ message?: string; error?: string }>;
}) {
  const user = await requireUser();
  const [{ importId }, feedback] = await Promise.all([params, searchParams]);
  const [job, accountOptions] = await Promise.all([
    getImportDetail(user.id, importId),
    getImportAccountOptions(user.id),
  ]);
  if (!job) notFound();
  const plan = jsonRecord(job.planData);
  const headers = Array.isArray(plan.headers)
    ? plan.headers.filter((item): item is string => typeof item === "string")
    : [];
  const detected = jsonRecord(
    plan.detectedMapping as Prisma.JsonValue,
  ) as Record<string, string | undefined>;
  const isMapping = plan.stage === "mapping" && headers.length > 0;
  const failureMessage =
    typeof plan.failureMessage === "string" ? plan.failureMessage : null;
  const committed =
    job.status === ImportStatus.COMPLETED ||
    job.status === ImportStatus.PARTIAL;
  const readyCount = job.candidates.filter(
    (candidate) => candidate.status === ImportCandidateStatus.READY,
  ).length;
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <Link
          href="/settings/imports"
          className="text-sm font-semibold text-[var(--semantic-info-text)] hover:underline"
        >
          ← Data &amp; imports
        </Link>
        <h1 className="mt-3 text-3xl font-bold break-words">
          {job.sourceName}
        </h1>
        <p className="mt-2 text-[var(--text-secondary)]">
          {importTypeLabels[job.importType]} · {importStatusLabels[job.status]}
        </p>
      </div>
      {feedback.message ? (
        <Notice tone="positive" role="status">
          {feedback.message}
        </Notice>
      ) : null}
      {feedback.error ? (
        <Notice tone="negative" role="alert">
          {feedback.error}
        </Notice>
      ) : null}
      {failureMessage ? (
        <Notice
          tone="negative"
          role="alert"
          title="This file could not be prepared"
        >
          {failureMessage} The encrypted original is still retained unless an
          explicit source-safety rule says otherwise.
        </Notice>
      ) : plan.detectedType ? (
        <Notice tone="positive" role="status">
          We identified this as {importTypeLabels[job.importType]}.
        </Notice>
      ) : null}
      {plan.exactDuplicateOf ? (
        <Notice tone="warning" title="This exact file was imported before">
          Existing record identities are checked again below. Duplicates will be
          skipped; earlier imported records are never silently rewritten.
        </Notice>
      ) : null}
      {plan.usedOcr ? (
        <Notice tone="warning" title="Local OCR was used">
          This scanned document was read with bounded local OCR. Verify every
          amount, date, account match, and activity row before confirming the
          import. Ambiguous or low-confidence OCR is rejected rather than
          guessed.
        </Notice>
      ) : null}
      <Card className="p-5 sm:p-6">
        <h2 className="text-xl font-bold">Source and retention</h2>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="font-semibold">Uploaded</dt>
            <dd className="break-words text-[var(--text-secondary)]">
              {dateTime(job.createdAt)}
            </dd>
          </div>
          <div>
            <dt className="font-semibold">File analysis</dt>
            <dd className="break-words text-[var(--text-secondary)]">
              {isMapping
                ? "Ready for column confirmation"
                : plan.usedOcr
                  ? "Read with bounded local OCR"
                  : job.parserFamily
                    ? "Read from the source file"
                    : "Analysis did not complete"}
            </dd>
          </div>
          <div>
            <dt className="font-semibold">Original source</dt>
            <dd className="text-[var(--text-secondary)]">
              {job.sourceStatus === ImportSourceStatus.RETAINED &&
              job.sourceRetainUntil
                ? `Encrypted until ${dateTime(job.sourceRetainUntil)}`
                : job.sourceStatus === ImportSourceStatus.MISSING
                  ? "No longer present"
                  : "Deleted"}
            </dd>
          </div>
          <div>
            <dt className="font-semibold">Statement date</dt>
            <dd className="text-[var(--text-secondary)]">
              {job.asOfDate ? formatImportDate(job.asOfDate) : "Not supplied"}
            </dd>
          </div>
        </dl>
        {job.sourceStatus === ImportSourceStatus.RETAINED ? (
          <div className="mt-5">
            <ImportConfirmationDialog
              triggerLabel="Delete source now"
              title={`Delete the retained source for ${job.sourceName}?`}
              description="The encrypted original file will be permanently deleted and cannot be recovered. Imported financial records, provenance, Import History, and safe Undo capability will remain."
              confirmLabel="Delete source permanently"
              action={deleteImportSourceAction}
              importId={job.id}
              destructive
            />
          </div>
        ) : null}
      </Card>
      {isMapping ? (
        <Card className="p-5 sm:p-6">
          <h2 className="text-xl font-bold">Map CSV columns</h2>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            Confirm what each source column means. Unknown columns may remain
            unmapped; formulas are treated as inert text.
          </p>
          <div className="mt-5">
            <CsvMappingForm
              importId={job.id}
              importType={
                job.importType as
                  | "GENERIC_ACCOUNT_BALANCE_CSV"
                  | "GENERIC_INVESTMENT_HOLDINGS_CSV"
              }
              headers={headers}
              detected={detected}
            />
          </div>
        </Card>
      ) : null}
      {job.accountMatches.length ? (
        <section aria-labelledby="accounts-heading">
          <h2 id="accounts-heading" className="text-xl font-bold">
            Accounts affected
          </h2>
          <div className="mt-4 space-y-3">
            {job.accountMatches.map((match) => (
              <Card key={match.id} className="p-4">
                <div className="flex flex-wrap justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-semibold break-words">
                      {match.displayName}
                    </h3>
                    <p className="text-sm text-[var(--text-secondary)]">
                      {match.institutionName ?? "No institution"} ·{" "}
                      {match.accountType.toLowerCase().replaceAll("_", " ")} ·{" "}
                      {match.currency}
                    </p>
                  </div>
                  <span className="text-sm font-semibold">
                    {match.status === ImportAccountMatchStatus.MATCHED
                      ? `Matched: ${match.matchedAccount?.name ?? "existing account"}`
                      : match.status === ImportAccountMatchStatus.CREATE
                        ? "Create new account"
                        : "Needs review"}
                  </span>
                </div>
                <p className="mt-2 text-sm text-[var(--text-secondary)]">
                  {match.reason}
                </p>
                {match.status === ImportAccountMatchStatus.NEEDS_REVIEW ? (
                  <AccountMatchForm
                    importId={job.id}
                    matchId={match.id}
                    suggestedAccountId={match.matchedAccountId ?? undefined}
                    accounts={accountOptions}
                  />
                ) : null}
              </Card>
            ))}
          </div>
        </section>
      ) : null}
      {job.candidates.length ? (
        <section aria-labelledby="review-heading">
          <h2 id="review-heading" className="text-xl font-bold">
            What the app found
          </h2>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            Source values cannot be edited here. Skip unsupported or ambiguous
            data and use local corrections after import when appropriate.
          </p>
          <ul className="mt-4 space-y-3">
            {job.candidates.map((candidate) => (
              <li key={candidate.id}>
                <Card className="min-w-0 p-4">
                  <div className="flex flex-wrap justify-between gap-2">
                    <h3 className="font-semibold break-words">
                      {candidate.sourceLabel ??
                        candidateKindLabels[candidate.kind]}
                    </h3>
                    <span className="text-sm font-semibold">
                      {candidateStatusLabels[candidate.status]}
                    </span>
                  </div>
                  <p className="mt-2 text-sm break-words text-[var(--text-secondary)]">
                    {candidateSummary(candidate.proposedData)}
                  </p>
                  {candidate.reviewReason ? (
                    <p className="mt-2 text-sm">{candidate.reviewReason}</p>
                  ) : null}
                  {candidate.status === ImportCandidateStatus.NEEDS_REVIEW ? (
                    <form action={skipImportCandidateAction} className="mt-3">
                      <input type="hidden" name="importId" value={job.id} />
                      <input
                        type="hidden"
                        name="candidateId"
                        value={candidate.id}
                      />
                      <Button type="submit">Skip this item</Button>
                    </form>
                  ) : null}
                  <details className="mt-3 text-xs text-[var(--text-secondary)]">
                    <summary className="cursor-pointer font-semibold">
                      Source evidence
                    </summary>
                    <p className="mt-1 break-words">
                      {candidateKindLabels[candidate.kind]} ·{" "}
                      {plan.usedOcr
                        ? "local OCR evidence"
                        : job.importType.endsWith("_CSV")
                          ? "CSV source row"
                          : "native PDF text"}
                    </p>
                  </details>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <Card className="p-5 sm:p-6">
        <h2 className="text-xl font-bold">What changed?</h2>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
          <div>
            <dt className="font-semibold">Imported</dt>
            <dd>{job.importedRowCount}</dd>
          </div>
          <div>
            <dt className="font-semibold">Ready</dt>
            <dd>{readyCount}</dd>
          </div>
          <div>
            <dt className="font-semibold">Duplicates</dt>
            <dd>{job.duplicateRowCount}</dd>
          </div>
          <div>
            <dt className="font-semibold">Rejected</dt>
            <dd>{job.rejectedRowCount}</dd>
          </div>
          <div>
            <dt className="font-semibold">Information only</dt>
            <dd>{job.informationalRowCount}</dd>
          </div>
        </dl>
        <div className="mt-5 flex flex-wrap gap-3">
          {job.status === ImportStatus.READY && readyCount > 0 ? (
            <ImportConfirmationDialog
              triggerLabel="Review and confirm import"
              title={`Import ${readyCount} item${readyCount === 1 ? "" : "s"}?`}
              description="Only items marked Ready to import will be written. Duplicates, rejected items, and informational values will be skipped. This import can be undone later when no dependent records make reversal unsafe."
              confirmLabel="Confirm import"
              action={commitImportAction}
              importId={job.id}
            />
          ) : null}
          {committed ? (
            <ImportConfirmationDialog
              triggerLabel="Undo import"
              title={`Undo ${job.sourceName}?`}
              description="The financial records created only by this import will be removed. Pre-existing and unrelated later records will remain. Undo is blocked if a created account now has dependent records. The Import History audit entry will remain as Reverted."
              confirmLabel="Undo import"
              action={undoImportAction}
              importId={job.id}
              destructive
            />
          ) : null}
          {job.status !== ImportStatus.COMPLETED &&
          job.status !== ImportStatus.PARTIAL &&
          job.status !== ImportStatus.REVERTED &&
          job.status !== ImportStatus.CANCELED &&
          job.status !== ImportStatus.FAILED ? (
            <form action={cancelImportAction}>
              <input type="hidden" name="importId" value={job.id} />
              <Button type="submit">Cancel import</Button>
            </form>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
