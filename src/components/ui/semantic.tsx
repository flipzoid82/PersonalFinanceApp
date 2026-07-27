import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type SemanticTone =
  | "positive"
  | "negative"
  | "warning"
  | "info"
  | "investment"
  | "muted";

export const semanticToneClasses: Record<SemanticTone, string> = {
  positive:
    "border-[var(--semantic-positive-border)] bg-[var(--semantic-positive-bg)] text-[var(--semantic-positive-text)]",
  negative:
    "border-[var(--semantic-negative-border)] bg-[var(--semantic-negative-bg)] text-[var(--semantic-negative-text)]",
  warning:
    "border-[var(--semantic-warning-border)] bg-[var(--semantic-warning-bg)] text-[var(--semantic-warning-text)]",
  info: "border-[var(--semantic-info-border)] bg-[var(--semantic-info-bg)] text-[var(--semantic-info-text)]",
  investment:
    "border-[var(--semantic-investment-border)] bg-[var(--semantic-investment-bg)] text-[var(--semantic-investment-text)]",
  muted:
    "border-[var(--semantic-muted-border)] bg-[var(--semantic-muted-bg)] text-[var(--semantic-muted-text)]",
};

export const semanticTextClasses: Record<SemanticTone, string> = {
  positive: "text-[var(--semantic-positive-text)]",
  negative: "text-[var(--semantic-negative-text)]",
  warning: "text-[var(--semantic-warning-text)]",
  info: "text-[var(--semantic-info-text)]",
  investment: "text-[var(--semantic-investment-text)]",
  muted: "text-[var(--semantic-muted-text)]",
};

export function SemanticBadge({
  tone,
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone: SemanticTone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold",
        semanticToneClasses[tone],
        className,
      )}
      {...props}
    />
  );
}

export function SemanticValue({
  tone,
  label,
  children,
  className,
}: {
  tone: SemanticTone;
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("font-semibold", semanticTextClasses[tone], className)}>
      <span className="sr-only">{label}: </span>
      {children}
    </span>
  );
}
