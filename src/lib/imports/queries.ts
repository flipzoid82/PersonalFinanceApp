import "server-only";

import { db } from "@/lib/db";
import { currentAccountWhere } from "@/lib/accounts/current";

export async function getImportHistory(ownerId: string) {
  return db.importJob.findMany({
    where: { userId: ownerId },
    include: {
      accountMatches: {
        select: {
          displayName: true,
          status: true,
          matchedAccount: { select: { name: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getImportDetail(ownerId: string, importId: string) {
  return db.importJob.findFirst({
    where: { id: importId, userId: ownerId },
    include: {
      dataSource: { select: { displayName: true } },
      accountMatches: {
        include: { matchedAccount: { select: { id: true, name: true } } },
        orderBy: { displayName: "asc" },
      },
      candidates: { orderBy: { ordinal: "asc" } },
      createdAccounts: { select: { id: true, name: true } },
    },
  });
}

export async function getImportAccountOptions(ownerId: string) {
  return db.account.findMany({
    where: currentAccountWhere(ownerId),
    select: {
      id: true,
      name: true,
      institutionName: true,
      accountType: true,
      currency: true,
    },
    orderBy: { name: "asc" },
  });
}
