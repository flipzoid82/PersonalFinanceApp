import "server-only";
import { calculatePortfolio } from "./calculations";
import { getPortfolioData } from "./queries";

export async function getPortfolioViewModel(ownerId: string, now = new Date()) {
  return calculatePortfolio(await getPortfolioData(ownerId), now);
}
