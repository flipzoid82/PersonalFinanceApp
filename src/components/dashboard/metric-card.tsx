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
      className={cn(order, "min-h-36 p-5 transition hover:border-slate-300")}
    >
      <Link
        href={href}
        className="block h-full rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-slate-900"
      >
        <h3 className="text-sm font-semibold text-slate-600">{label}</h3>
        <p
          className={cn(
            "mt-4 text-2xl font-bold tracking-tight sm:text-3xl",
            tone !== "default" && semanticTextClasses[tone],
          )}
        >
          {value}
        </p>
        <p className="mt-3 text-xs leading-5 text-slate-500">{support}</p>
      </Link>
    </Card>
  );
}
