import Link from "next/link";
import { Card } from "@/components/ui/card";
import {
  semanticTextClasses,
  type SemanticTone,
} from "@/components/ui/semantic";
import { cn } from "@/lib/utils";

export function MetricCard({
  label,
  value,
  support,
  href,
  order,
  tone = "default",
}: {
  label: string;
  value: string;
  support: string;
  href: string;
  order: string;
  tone?: "default" | SemanticTone;
}) {
  return (
    <Card
      className={cn(
        order,
        "min-h-36 p-5 transition hover:border-[var(--semantic-info-border)]",
      )}
    >
      <Link
        href={href}
        className="block h-full rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--focus-ring)]"
      >
        <h3 className="text-sm font-semibold text-[var(--text-secondary)]">
          {label}
        </h3>
        <p
          className={cn(
            "mt-4 text-2xl font-bold tracking-tight sm:text-3xl",
            tone !== "default" && semanticTextClasses[tone],
          )}
        >
          {value}
        </p>
        <p className="mt-3 text-xs leading-5 text-[var(--text-secondary)]">
          {support}
        </p>
      </Link>
    </Card>
  );
}
