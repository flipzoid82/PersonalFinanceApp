import Link from "next/link";

export function SortableHeader({
  label,
  href,
  active,
  direction,
  align = "left",
  className = "",
}: {
  label: string;
  href: string;
  active: boolean;
  direction: "asc" | "desc";
  align?: "left" | "right";
  className?: string;
}) {
  const nextDirection =
    active && direction === "asc" ? "descending" : "ascending";
  const indicator = active ? (direction === "asc" ? "↑" : "↓") : "↕";
  return (
    <th
      scope="col"
      aria-sort={
        active ? (direction === "asc" ? "ascending" : "descending") : "none"
      }
      className={className}
    >
      <Link
        href={href}
        aria-label={`Sort by ${label}, ${nextDirection}`}
        className={`inline-flex min-h-11 items-center gap-1 rounded font-semibold underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)] ${align === "right" ? "justify-end" : ""}`}
      >
        <span>{label}</span>
        <span aria-hidden="true">{indicator}</span>
        {active ? (
          <span className="sr-only">
            ({direction === "asc" ? "ascending" : "descending"})
          </span>
        ) : null}
      </Link>
    </th>
  );
}
