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
      providerAccountLinks: {
        where: { isCurrent: false },
        select: {
          providerAccountId: true,
          account: { select: { id: true, name: true } },
        },
        orderBy: { firstSeenAt: "asc" },
      },
      _count: {
        select: {
          accounts: { where: { isActive: true } },
          providerAccountLinks: true,
        },
      },
    },
    orderBy: [{ disconnectedAt: "asc" }, { institutionName: "asc" }],
  });
}
