import "server-only";
import { calculatePortfolio } from "./calculations";
import { getPortfolioData } from "./queries";
import type { NetWorthRange } from "./types";

export async function getPortfolioViewModel(
  ownerId: string,
  now = new Date(),
  range: NetWorthRange = "30d",
) {
  return calculatePortfolio(await getPortfolioData(ownerId), now, range);
}
