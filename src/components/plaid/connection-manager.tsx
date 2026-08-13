import { ConnectionStatus } from "@prisma/client";
import { syncPlaidConnectionAction } from "@/actions/plaid";
import { formatRelativeTime } from "@/lib/dashboard/formatters";
import { isPlaidConfigured } from "@/lib/plaid";
import { getPlaidConnections } from "@/lib/plaid/queries";
import { plaidStatusPresentation } from "@/lib/plaid/status";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { SemanticBadge } from "@/components/ui/semantic";
import { DisconnectPlaidDialog } from "./disconnect-dialog";
import { PlaidLinkButton } from "./plaid-link-button";

export async function PlaidConnectionManager({
  ownerId,
  now,
}: {
  ownerId: string;
  now: Date;
}) {
  const [connections, configured] = await Promise.all([
    getPlaidConnections(ownerId),
    Promise.resolve(isPlaidConfigured()),
  ]);
  return (
    <section aria-labelledby="plaid-connections-title" className="mt-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 id="plaid-connections-title" className="text-xl font-bold">
            Plaid Sandbox connections
          </h2>
          <p className="mt-2 max-w-3xl text-sm text-[var(--text-secondary)]">
            Connect fake Sandbox institutions only. This application never
            requests or stores real bank credentials.
          </p>
        </div>
        {configured ? (
          <PlaidLinkButton />
        ) : (
          <div role="status" className="max-w-md text-sm">
            <SemanticBadge tone="muted">Configuration required</SemanticBadge>
            <p className="mt-2 text-[var(--text-secondary)]">
              Add the documented Plaid Sandbox environment variables to enable
              Link.
            </p>
          </div>
        )}
      </div>

      {!connections.length ? (
        <Card className="mt-4 p-6">
          <p className="font-semibold">No Sandbox institutions connected</p>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            Manual accounts and assets remain available independently.
          </p>
        </Card>
      ) : (
        <ul className="mt-4 space-y-4" aria-label="Plaid Sandbox connections">
          {connections.map((connection) => {
            const presentation = plaidStatusPresentation(connection, now);
            const disconnected =
              connection.status === ConnectionStatus.DISCONNECTED;
            const needsRepair =
              connection.status === ConnectionStatus.NEEDS_REAUTHENTICATION;
            return (
              <li key={connection.id}>
                <Card className="p-5 sm:p-6">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-bold">
                          {connection.institutionName}
                        </h3>
                        <SemanticBadge tone="info">Plaid Sandbox</SemanticBadge>
                        <SemanticBadge tone={presentation.tone}>
                          {presentation.label}
                        </SemanticBadge>
                      </div>
                      <dl className="mt-3 grid gap-2 text-sm text-[var(--text-secondary)] sm:grid-cols-2">
                        <div>
                          <dt className="font-semibold text-[var(--text-primary)]">
                            {disconnected
                              ? "Retained account identities"
                              : "Current accounts"}
                          </dt>
                          <dd>
                            {disconnected
                              ? connection._count.providerAccountLinks
                              : connection._count.accounts}
                          </dd>
                        </div>
                        <div>
                          <dt className="font-semibold text-[var(--text-primary)]">
                            Last successful sync
                          </dt>
                          <dd>
                            {formatRelativeTime(
                              connection.lastSuccessfulSyncAt,
                              now,
                            )}
                          </dd>
                        </div>
                        <div>
                          <dt className="font-semibold text-[var(--text-primary)]">
                            Last attempted sync
                          </dt>
                          <dd>
                            {formatRelativeTime(
                              connection.lastAttemptedSyncAt,
                              now,
                            )}
                          </dd>
                        </div>
                      </dl>
                      {connection.lastErrorMessage ? (
                        <Notice tone="negative" className="mt-3">
                          {connection.lastErrorMessage}
                        </Notice>
                      ) : null}
                    </div>
                    {!disconnected ? (
                      <div className="flex flex-wrap gap-2">
                        {needsRepair ? (
                          <PlaidLinkButton
                            mode="repair"
                            connectionId={connection.id}
                          />
                        ) : null}
                        <form action={syncPlaidConnectionAction}>
                          <input
                            type="hidden"
                            name="connectionId"
                            value={connection.id}
                          />
                          <Button
                            type="submit"
                            disabled={Boolean(connection.syncStartedAt)}
                          >
                            {connection.syncStartedAt ? "Syncing…" : "Sync now"}
                          </Button>
                        </form>
                        <DisconnectPlaidDialog
                          connectionId={connection.id}
                          institutionName={connection.institutionName}
                        />
                      </div>
                    ) : (
                      <div className="text-sm text-[var(--text-secondary)]">
                        <p>
                          Historical Item retained. It does not contribute to
                          current totals. Use Connect to reconnect.
                        </p>
                        {connection.providerAccountLinks.length ? (
                          <details className="mt-3">
                            <summary className="cursor-pointer font-semibold text-[var(--text-primary)]">
                              View retained accounts
                            </summary>
                            <ul className="mt-2 list-disc space-y-1 pl-5">
                              {connection.providerAccountLinks.map((link) => (
                                <li key={link.providerAccountId}>
                                  {link.account.name}
                                </li>
                              ))}
                            </ul>
                          </details>
                        ) : (
                          <p className="mt-3">
                            No account identities were recorded for this
                            historical Item.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
