export function PortfolioFeedback({
  message,
  error,
}: {
  message?: string;
  error?: string;
}) {
  if (!message && !error) return null;
  return (
    <Notice
      tone={error ? "negative" : "positive"}
      title={error ? "Update failed" : "Update saved"}
      role={error ? "alert" : "status"}
      className="mt-5"
    >
      {error ?? message}
    </Notice>
  );
}
import { Notice } from "@/components/ui/notice";
