import { STALE_AFTER_DAYS } from "./constants";
import type { Freshness } from "./types";

export function freshnessState(
  updatedAt: Date | null,
  now = new Date(),
): Freshness {
  if (!updatedAt) return "unavailable";
  return now.getTime() - updatedAt.getTime() > STALE_AFTER_DAYS * 86_400_000
    ? "stale"
    : "current";
}
