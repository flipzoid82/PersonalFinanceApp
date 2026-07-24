export function PortfolioFeedback({
  message,
  error,
}: {
  message?: string;
  error?: string;
}) {
  if (!message && !error) return null;
  return (
    <div
      role={error ? "alert" : "status"}
      className={
        error
          ? "mt-5 rounded-xl border border-[var(--semantic-negative-border)] bg-[var(--semantic-negative-bg)] p-4 text-sm text-[var(--semantic-negative-text)]"
          : "mt-5 rounded-xl border border-[var(--semantic-positive-border)] bg-[var(--semantic-positive-bg)] p-4 text-sm text-[var(--semantic-positive-text)]"
      }
    >
      <p className="font-semibold">
        {error ? "Update failed" : "Update saved"}
      </p>
      <p className="mt-1">{error ?? message}</p>
    </div>
  );
}
