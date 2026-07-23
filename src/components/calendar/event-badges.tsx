import type { CalendarEventStatus, ConfidenceLevel } from "@prisma/client";
import { titleCaseEnum } from "@/lib/dashboard/formatters";
import { cn } from "@/lib/utils";

export function TextBadge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "positive" | "warning" | "danger";
}) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold",
        tone === "positive" &&
          "border-emerald-200 bg-emerald-50 text-emerald-800",
        tone === "warning" && "border-amber-200 bg-amber-50 text-amber-900",
        tone === "danger" && "border-rose-200 bg-rose-50 text-rose-800",
        tone === "neutral" && "border-slate-200 bg-slate-50 text-slate-700",
      )}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: CalendarEventStatus }) {
  const tone =
    status === "PAID"
      ? "positive"
      : status === "OVERDUE"
        ? "danger"
        : status === "NEEDS_CONFIRMATION"
          ? "warning"
          : "neutral";
  return <TextBadge tone={tone}>{titleCaseEnum(status)}</TextBadge>;
}

export function ConfidenceBadge({
  confidence,
}: {
  confidence: ConfidenceLevel;
}) {
  return (
    <TextBadge
      tone={confidence === "NEEDS_CONFIRMATION" ? "warning" : "neutral"}
    >
      Confidence: {titleCaseEnum(confidence)}
    </TextBadge>
  );
}
