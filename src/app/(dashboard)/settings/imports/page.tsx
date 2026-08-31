import Link from "next/link";
import { ImportUploadForm } from "@/components/imports/import-forms";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { requireUser } from "@/lib/auth";
import { isImportConfigured } from "@/lib/imports/config";
import {
  importStatusLabels,
  importTypeLabels,
} from "@/lib/imports/presentation";
import { getImportHistory } from "@/lib/imports/queries";

function dateTime(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

export default async function ImportsPage({
  searchParams,
}: {
  searchParams: Promise<{
    fallback?: string;
    message?: string;
    error?: string;
  }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const history = await getImportHistory(user.id);
  const configured = isImportConfigured();
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <p className="text-sm font-semibold text-[var(--semantic-info-text)]">
          Settings · Data &amp; imports
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">
          Data &amp; imports
        </h1>
        <p className="mt-2 max-w-3xl text-[var(--text-secondary)]">
          Review a statement or CSV before anything changes. Completed imports
          keep an audit trail and can be undone when safe.
        </p>
      </div>
      {params.message ? (
        <Notice tone="positive" role="status">
          {params.message}
        </Notice>
      ) : null}
      {params.error ? (
        <Notice tone="negative" role="alert">
          {params.error}
        </Notice>
      ) : null}
      <Card className="p-5 sm:p-6">
        <h2 className="text-xl font-bold">Import data</h2>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          Supported sources are Fidelity and TSP statements, optional Fidelity
          trade confirmations, generic balance CSVs, and clear holding CSVs.
          Generic transaction CSVs are not supported.
        </p>
        <div className="mt-5">
          <ImportUploadForm
            configured={configured}
            fallback={
              params.fallback === "csv" || params.fallback === "pdf"
                ? params.fallback
                : undefined
            }
          />
        </div>
      </Card>
      <section aria-labelledby="history-heading">
        <h2 id="history-heading" className="text-xl font-bold">
          Import History
        </h2>
        {history.length ? (
          <ul className="mt-4 space-y-3">
            {history.map((job) => (
              <li key={job.id}>
                <Card className="min-w-0 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-semibold break-words">
                        {job.sourceName}
                      </h3>
                      <p className="text-sm text-[var(--text-secondary)]">
                        {importTypeLabels[job.importType]} ·{" "}
                        {dateTime(job.createdAt)}
                      </p>
                    </div>
                    <span className="rounded-full border border-[var(--border-default)] px-3 py-1 text-sm font-semibold">
                      {importStatusLabels[job.status]}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-[var(--text-secondary)]">
                    {job.importedRowCount} imported · {job.duplicateRowCount}{" "}
                    duplicates · {job.rejectedRowCount} rejected
                  </p>
                  <Link
                    href={`/settings/imports/${job.id}`}
                    className="mt-3 inline-block font-semibold text-[var(--semantic-info-text)] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]"
                  >
                    Open import details
                  </Link>
                </Card>
              </li>
            ))}
          </ul>
        ) : (
          <Card className="mt-4 p-6 text-[var(--text-secondary)]">
            No imports yet. Upload a supported statement or CSV to create a
            review plan.
          </Card>
        )}
      </section>
    </div>
  );
}
