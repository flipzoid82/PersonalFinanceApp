import { ConnectionStatus, Prisma } from "@prisma/client";

export function currentAccountStateWhere(): Prisma.AccountWhereInput {
  return {
    isActive: true,
    OR: [
      { institutionConnectionId: null },
      { institutionConnection: { provider: { not: "PLAID" } } },
      {
        institutionConnection: {
          provider: "PLAID",
          status: { not: ConnectionStatus.DISCONNECTED },
        },
      },
    ],
  };
}

export function currentAccountWhere(ownerId: string): Prisma.AccountWhereInput {
  return { userId: ownerId, ...currentAccountStateWhere() };
}

export function isCurrentConnectedAccount(account: {
  isActive: boolean;
  institutionConnection?: {
    provider: string;
    status: ConnectionStatus;
  } | null;
}) {
  return (
    account.isActive &&
    (account.institutionConnection?.provider !== "PLAID" ||
      account.institutionConnection.status !== ConnectionStatus.DISCONNECTED)
  );
}
