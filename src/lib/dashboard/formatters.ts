import type { Prisma } from "@prisma/client";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

const shortDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

export function formatCurrency(value: Prisma.Decimal | null, currency = "USD") {
  if (value === null) return "Unavailable";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value.toNumber());
}

export function formatPercent(value: Prisma.Decimal | null) {
  if (value === null) return "Unavailable";
  return `${value.toDecimalPlaces(1).toString()}%`;
}

export function formatDate(date: Date) {
  return dateFormatter.format(date);
}

export function formatShortDate(date: Date) {
  return shortDateFormatter.format(date);
}

export function formatRelativeTime(date: Date | null, now: Date) {
  if (!date) return "Update time unavailable";
  const milliseconds = now.getTime() - date.getTime();
  if (milliseconds < 0) return `Dated ${formatDate(date)}`;
  const minutes = Math.floor(milliseconds / 60_000);
  if (minutes < 1) return "Updated just now";
  if (minutes < 60)
    return `Updated ${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Updated ${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `Updated ${days} day${days === 1 ? "" : "s"} ago`;
}

export function titleCaseEnum(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
