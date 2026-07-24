import type { CalendarEventStatus, ConfidenceLevel } from "@prisma/client";
import { SemanticBadge, type SemanticTone } from "@/components/ui/semantic";
import { titleCaseEnum } from "@/lib/dashboard/formatters";

export function TextBadge({
  children,
  tone = "muted",
}: {
  children: React.ReactNode;
  tone?: SemanticTone;
}) {
  return <SemanticBadge tone={tone}>{children}</SemanticBadge>;
}

export function StatusBadge({ status }: { status: CalendarEventStatus }) {
  const tone =
    status === "PAID"
      ? "positive"
      : status === "OVERDUE"
        ? "negative"
        : status === "PREDICTED" || status === "NEEDS_CONFIRMATION"
          ? "warning"
          : status === "CONFIRMED"
            ? "info"
            : "muted";
  return <TextBadge tone={tone}>{titleCaseEnum(status)}</TextBadge>;
}

export function ConfidenceBadge({
  confidence,
}: {
  confidence: ConfidenceLevel;
}) {
  return (
    <TextBadge
      tone={
        confidence === "NEEDS_CONFIRMATION" || confidence === "MEDIUM"
          ? "warning"
          : "muted"
      }
    >
      Confidence: {titleCaseEnum(confidence)}
    </TextBadge>
  );
}
