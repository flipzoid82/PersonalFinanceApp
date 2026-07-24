import { ConnectionStatus } from "@prisma/client";

export type PlaidConnectionStatusInput = {
  status: ConnectionStatus;
  syncStartedAt: Date | null;
  lastSuccessfulSyncAt: Date | null;
};

export function plaidStatusPresentation(
  connection: PlaidConnectionStatusInput,
  now: Date,
) {
  if (connection.status === ConnectionStatus.DISCONNECTED)
    return { label: "Disconnected", tone: "muted" as const };
  if (connection.syncStartedAt)
    return { label: "Syncing", tone: "info" as const };
  if (connection.status === ConnectionStatus.NEEDS_REAUTHENTICATION)
    return { label: "Repair needed", tone: "warning" as const };
  if (connection.status === ConnectionStatus.ERROR)
    return { label: "Error", tone: "negative" as const };
  if (
    !connection.lastSuccessfulSyncAt ||
    now.getTime() - connection.lastSuccessfulSyncAt.getTime() > 7 * 86_400_000
  )
    return { label: "Stale", tone: "warning" as const };
  return { label: "Ready", tone: "info" as const };
}
