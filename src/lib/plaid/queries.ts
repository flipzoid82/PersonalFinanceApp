import "server-only";
import { db } from "@/lib/db";

export async function getPlaidConnections(ownerId: string) {
  return db.institutionConnection.findMany({
    where: { userId: ownerId, provider: "PLAID" },
    select: {
      id: true,
      institutionName: true,
      institutionId: true,
      status: true,
      syncStartedAt: true,
      lastAttemptedSyncAt: true,
      lastSuccessfulSyncAt: true,
      lastErrorCode: true,
      lastErrorMessage: true,
      disconnectedAt: true,
      dataSource: {
        select: { status: true, lastUpdatedAt: true },
      },
      _count: { select: { accounts: true } },
    },
    orderBy: [{ disconnectedAt: "asc" }, { institutionName: "asc" }],
  });
}
