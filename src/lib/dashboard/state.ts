import {
  AccountSource,
  ConnectionStatus,
  DataSourceStatus,
  DataSourceType,
} from "@prisma/client";
import type {
  DashboardDataSource,
  RawDashboardData,
  SourceHealth,
} from "./types";

export const STALE_AFTER_DAYS = 7;

function latestDate(dates: Array<Date | null | undefined>) {
  return dates.reduce<Date | null>((latest, date) => {
    if (!date) return latest;
    return !latest || date > latest ? date : latest;
  }, null);
}

function sourceLabel(source: DashboardDataSource): SourceHealth["sourceLabel"] {
  if (source.sourceType === DataSourceType.MANUAL) return "Manual";
  if (
    source.sourceType === DataSourceType.CSV_IMPORT ||
    source.sourceType === DataSourceType.FIDELITY_IMPORT
  )
    return "Imported";
  return "Synced";
}

export function deriveDashboardState(data: RawDashboardData, now: Date) {
  const ownedSources = data.dataSources.filter(
    (source) => source.userId === data.ownerId,
  );
  const ownedAccounts = data.accounts.filter(
    (account) => account.userId === data.ownerId,
  );
  const staleBefore = new Date(
    now.getTime() - STALE_AFTER_DAYS * 24 * 60 * 60 * 1000,
  );
  const partialReasons = new Set<string>();
  if (
    ownedAccounts.some(
      ({ isActive, balanceAvailable }) =>
        isActive && balanceAvailable === false,
    )
  )
    partialReasons.add(
      "One or more active accounts have an unavailable balance.",
    );

  const sourceHealth = ownedSources.map<SourceHealth>((source) => {
    const accounts = ownedAccounts.filter(
      (account) => account.dataSource.id === source.id,
    );
    const connectionStatuses = source.institutionConnections.map(
      ({ status }) => status,
    );
    const updatedAt = latestDate([
      source.lastUpdatedAt,
      ...source.institutionConnections.map(
        ({ lastSuccessfulSyncAt }) => lastSuccessfulSyncAt,
      ),
      ...accounts.map((account) =>
        account.source === AccountSource.SYNCED
          ? account.lastSyncedAt
          : account.source === AccountSource.IMPORTED
            ? account.lastImportedAt
            : account.updatedAt,
      ),
    ]);

    let statusLabel: SourceHealth["statusLabel"] = "Current";
    let detail = "Available records are current.";
    if (
      source.status === DataSourceStatus.ERROR ||
      connectionStatuses.includes(ConnectionStatus.ERROR)
    ) {
      statusLabel = "Error";
      detail =
        "The source reports an error; available values may be incomplete.";
      partialReasons.add(`${source.displayName} reports an error.`);
    } else if (
      connectionStatuses.includes(ConnectionStatus.DISCONNECTED) ||
      connectionStatuses.includes(ConnectionStatus.NEEDS_REAUTHENTICATION)
    ) {
      statusLabel = "Disconnected";
      detail =
        "The connection needs attention; previously stored values remain visible.";
      partialReasons.add(
        `${source.displayName} is disconnected or needs attention.`,
      );
    } else if (
      source.status === DataSourceStatus.NEEDS_ATTENTION ||
      source.status === DataSourceStatus.INACTIVE
    ) {
      statusLabel = "Partial";
      detail = "This source may not contain a complete current balance.";
      partialReasons.add(`${source.displayName} may be incomplete.`);
    } else if (!updatedAt) {
      statusLabel = "Partial";
      detail = "No freshness timestamp is available.";
      partialReasons.add(`${source.displayName} has no update timestamp.`);
    } else if (updatedAt < staleBefore) {
      statusLabel = "Stale";
      detail = `No update has been recorded within ${STALE_AFTER_DAYS} days.`;
    }

    return {
      id: source.id,
      name: source.displayName,
      sourceLabel: sourceLabel(source),
      statusLabel,
      updatedAt,
      detail,
    };
  });

  const latestDataAt = latestDate([
    ...sourceHealth.map(({ updatedAt }) => updatedAt),
    ...data.investmentSnapshots
      .filter(({ userId }) => userId === data.ownerId)
      .map(({ asOfDate }) => asOfDate),
    ...data.holdings
      .filter(({ userId }) => userId === data.ownerId)
      .map(({ asOfDate }) => asOfDate),
    ...data.manualAssets
      .filter(({ userId }) => userId === data.ownerId)
      .map(({ updatedAt }) => updatedAt),
  ]);

  return {
    sourceHealth,
    latestDataAt,
    isPartial: partialReasons.size > 0,
    partialReasons: [...partialReasons],
  };
}
