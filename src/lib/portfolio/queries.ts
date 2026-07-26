import "server-only";
import { db } from "@/lib/db";
import type { RawPortfolioData } from "./types";

export async function getPortfolioData(
  ownerId: string,
): Promise<RawPortfolioData> {
  const [accounts, manualAssets] = await Promise.all([
    db.account.findMany({
      where: { userId: ownerId },
      include: {
        dataSource: {
          select: {
            displayName: true,
            status: true,
            lastUpdatedAt: true,
          },
        },
        institutionConnection: {
          select: { id: true, provider: true, status: true },
        },
        balanceSnapshots: {
          where: { userId: ownerId },
          orderBy: { capturedAt: "desc" },
        },
        investmentSnapshots: {
          where: { userId: ownerId },
          orderBy: { asOfDate: "desc" },
        },
        investmentHoldings: {
          where: { userId: ownerId },
          orderBy: { currentValue: "desc" },
        },
      },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
    }),
    db.manualAsset.findMany({
      where: { userId: ownerId },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
    }),
  ]);
  return { ownerId, accounts, manualAssets };
}
