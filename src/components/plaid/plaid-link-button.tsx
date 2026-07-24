"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  usePlaidLink,
  type PlaidLinkOnSuccessMetadata,
} from "react-plaid-link";
import { Button } from "@/components/ui/button";

export function PlaidLinkButton({
  mode = "connect",
  connectionId,
}: {
  mode?: "connect" | "repair";
  connectionId?: string;
}) {
  const [token, setToken] = useState<string | null>(null);
  const launchWhenReady = useRef(false);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const finish = useCallback(
    async (publicToken: string, metadata: PlaidLinkOnSuccessMetadata) => {
      setBusy(true);
      const response = await fetch(
        mode === "repair"
          ? "/api/plaid/repair-complete"
          : "/api/plaid/exchange",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            mode === "repair"
              ? { connectionId }
              : {
                  publicToken,
                  linkSessionId: metadata.link_session_id,
                  institutionId: metadata.institution?.institution_id ?? null,
                  institutionName: metadata.institution?.name ?? null,
                },
          ),
        },
      );
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        setBusy(false);
        setErrorMessage(result.error ?? "Plaid Sandbox could not connect.");
        return;
      }
      window.location.assign(
        `/accounts?message=${encodeURIComponent(
          mode === "repair"
            ? "Plaid Sandbox connection repaired and synced."
            : "Plaid Sandbox institution connected and synced.",
        )}`,
      );
    },
    [connectionId, mode],
  );

  const { open, ready } = usePlaidLink({
    token,
    onSuccess: (publicToken, metadata) => {
      void finish(publicToken, metadata);
    },
    onExit: (linkError) => {
      launchWhenReady.current = false;
      setBusy(false);
      if (linkError)
        setErrorMessage(
          "Plaid Sandbox Link closed with an error. No credentials were stored.",
        );
    },
  });

  useEffect(() => {
    if (ready && launchWhenReady.current) {
      launchWhenReady.current = false;
      open();
    }
  }, [open, ready]);

  async function launch() {
    setBusy(true);
    setErrorMessage(null);
    try {
      const response = await fetch("/api/plaid/link-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(connectionId ? { connectionId } : {}),
      });
      const result = (await response.json()) as {
        linkToken?: string;
        error?: string;
      };
      if (!response.ok || !result.linkToken)
        throw new Error(result.error ?? "Plaid Sandbox is unavailable.");
      setToken(result.linkToken);
      launchWhenReady.current = true;
    } catch (error) {
      setBusy(false);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Plaid Sandbox is unavailable.",
      );
    }
  }

  return (
    <div>
      <Button
        type="button"
        disabled={busy}
        onClick={() => void launch()}
        className={
          mode === "repair"
            ? "bg-amber-700 hover:bg-amber-800 dark:bg-amber-300 dark:text-amber-950"
            : undefined
        }
      >
        {busy
          ? mode === "repair"
            ? "Opening repair…"
            : "Opening Plaid Sandbox…"
          : mode === "repair"
            ? "Repair connection"
            : "Connect Sandbox institution"}
      </Button>
      {errorMessage ? (
        <p
          role="alert"
          className="mt-2 text-sm text-[var(--semantic-negative-text)]"
        >
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
