"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  announceSessionEvent,
  SESSION_CHANNEL_NAME,
  SESSION_STORAGE_KEY,
  type SessionEventType,
} from "@/components/session/session-events";
import { Button } from "@/components/ui/button";

export type SessionPayload = {
  absoluteExpiresAt: string | null;
  canRenew: boolean;
  idleExpiresAt: string | null;
  serverNow: string;
  status:
    | "active"
    | "absolute_expired"
    | "idle_expired"
    | "invalid"
    | "revoked";
  warningThresholdSeconds: number;
};

function expirationTime(payload: SessionPayload) {
  if (!payload.idleExpiresAt || !payload.absoluteExpiresAt) return null;
  return Math.min(
    Date.parse(payload.idleExpiresAt),
    Date.parse(payload.absoluteExpiresAt),
  );
}

function isSessionEvent(value: unknown): value is { type: SessionEventType } {
  if (!value || typeof value !== "object" || !("type" in value)) return false;
  return ["expired", "logout", "renewed", "warning"].includes(
    String(value.type),
  );
}

function browserNavigate(url: string) {
  window.location.assign(url);
}

export function SessionSecurityController({
  navigate = browserNavigate,
}: {
  navigate?: (url: string) => void;
} = {}) {
  const [payload, setPayload] = useState<SessionPayload | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [renewing, setRenewing] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const dialogRef = useRef<HTMLDivElement>(null);
  const stayButtonRef = useRef<HTMLButtonElement>(null);
  const signOutButtonRef = useRef<HTMLButtonElement>(null);
  const lastFocusedRef = useRef<HTMLElement | null>(null);
  const announcedThresholdRef = useRef<number | null>(null);
  const warningBroadcastRef = useRef(false);
  const clockOffsetRef = useRef(0);
  const titleId = useId();
  const descriptionId = useId();

  const reconcile = useCallback(async () => {
    try {
      const response = await fetch("/api/session/status", {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      if (response.redirected) {
        navigate(response.url);
        return;
      }
      const next = (await response.json()) as SessionPayload;
      if (!response.ok || next.status !== "active") {
        announceSessionEvent("expired");
        navigate(
          next.status === "idle_expired" || next.status === "absolute_expired"
            ? "/api/session/end?reason=expired"
            : "/api/session/end",
        );
        return;
      }
      clockOffsetRef.current = Date.parse(next.serverNow) - Date.now();
      setPayload(next);
    } catch {
      // Offline tabs retain the last server deadline and retry when online.
    }
  }, [navigate]);

  const endSession = useCallback(
    async (reason: "expired" | "logout") => {
      if (reason === "logout") {
        try {
          await fetch("/api/session/logout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
          });
        } finally {
          announceSessionEvent("logout");
          navigate("/login");
        }
        return;
      }
      announceSessionEvent("expired");
      navigate("/api/session/end?reason=expired");
    },
    [navigate],
  );

  useEffect(() => {
    const timeout = window.setTimeout(() => void reconcile(), 0);
    return () => window.clearTimeout(timeout);
  }, [reconcile]);

  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === "visible") void reconcile();
    }
    window.addEventListener("focus", reconcile);
    window.addEventListener("online", reconcile);
    window.addEventListener("pageshow", reconcile);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("focus", reconcile);
      window.removeEventListener("online", reconcile);
      window.removeEventListener("pageshow", reconcile);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [reconcile]);

  useEffect(() => {
    function receive(value: unknown) {
      if (!isSessionEvent(value)) return;
      if (value.type === "expired") {
        navigate("/api/session/end?reason=expired");
      } else if (value.type === "logout") {
        navigate("/api/session/end");
      } else {
        void reconcile();
      }
    }
    const channel =
      typeof window.BroadcastChannel === "function"
        ? new BroadcastChannel(SESSION_CHANNEL_NAME)
        : null;
    if (channel) channel.onmessage = (event) => receive(event.data);
    function onStorage(event: StorageEvent) {
      if (event.key !== SESSION_STORAGE_KEY || !event.newValue) return;
      try {
        receive(JSON.parse(event.newValue));
      } catch {
        // Ignore malformed messages and defer to server state.
      }
    }
    window.addEventListener("storage", onStorage);
    return () => {
      channel?.close();
      window.removeEventListener("storage", onStorage);
    };
  }, [navigate, reconcile]);

  useEffect(() => {
    function recordMeaningfulNavigation(event: MouseEvent) {
      if (
        !event.isTrusted ||
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const anchor = (event.target as Element | null)?.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      const target = new URL(anchor.href, window.location.href);
      if (target.origin !== window.location.origin) return;
      void fetch("/api/session/activity", {
        keepalive: true,
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
    }
    document.addEventListener("click", recordMeaningfulNavigation, true);
    return () =>
      document.removeEventListener("click", recordMeaningfulNavigation, true);
  }, []);

  useEffect(() => {
    if (!payload) return;
    const expiresAt = expirationTime(payload);
    if (expiresAt === null) return;
    const warningThresholdSeconds = payload.warningThresholdSeconds;
    function updateCountdown() {
      const remaining = Math.max(
        0,
        Math.ceil((expiresAt! - (Date.now() + clockOffsetRef.current)) / 1000),
      );
      setRemainingSeconds(remaining);
      if (remaining === 0) {
        void reconcile();
        return;
      }
      const threshold = [10, 30, 60, 120].find((value) => remaining <= value);
      if (threshold && announcedThresholdRef.current !== threshold) {
        announcedThresholdRef.current = threshold;
        setAnnouncement(
          `Your session will end in ${threshold} seconds unless you stay signed in.`,
        );
      }
      if (
        remaining <= warningThresholdSeconds &&
        !warningBroadcastRef.current
      ) {
        warningBroadcastRef.current = true;
        announceSessionEvent("warning");
      }
    }
    updateCountdown();
    const interval = window.setInterval(updateCountdown, 1000);
    return () => window.clearInterval(interval);
  }, [payload, reconcile]);

  const warningOpen =
    payload !== null &&
    remainingSeconds > 0 &&
    remainingSeconds <= payload.warningThresholdSeconds;

  useEffect(() => {
    const shell = document.getElementById("dashboard-shell");
    if (!warningOpen) {
      if (shell) shell.inert = false;
      lastFocusedRef.current?.focus();
      return;
    }
    lastFocusedRef.current = document.activeElement as HTMLElement | null;
    if (shell) shell.inert = true;
    (stayButtonRef.current ?? signOutButtonRef.current)?.focus();
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        return;
      }
      if (event.key !== "Tab") return;
      const elements = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
      const first = elements[0];
      const last = elements.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      if (shell) shell.inert = false;
    };
  }, [warningOpen]);

  async function staySignedIn() {
    if (renewing) return;
    setRenewing(true);
    try {
      const response = await fetch("/api/session/renew", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) {
        await endSession("expired");
        return;
      }
      const next = (await response.json()) as SessionPayload;
      clockOffsetRef.current = Date.parse(next.serverNow) - Date.now();
      announcedThresholdRef.current = null;
      warningBroadcastRef.current = false;
      setAnnouncement("Your session has been renewed.");
      setPayload(next);
      announceSessionEvent("renewed");
    } finally {
      setRenewing(false);
    }
  }

  const absoluteLimitReached =
    payload?.absoluteExpiresAt != null &&
    expirationTime(payload) === Date.parse(payload.absoluteExpiresAt);
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;

  return (
    <>
      <p className="sr-only" aria-live="assertive" aria-atomic="true">
        {announcement}
      </p>
      {warningOpen ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/75 p-4">
          <div
            ref={dialogRef}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            className="max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-xl border border-[var(--semantic-warning-border)] bg-[var(--surface-panel)] p-5 text-[var(--text-primary)] shadow-2xl sm:p-6"
          >
            <h2 id={titleId} className="text-xl font-bold">
              {absoluteLimitReached
                ? "Your session is ending"
                : "Still working?"}
            </h2>
            <div
              id={descriptionId}
              className="mt-3 space-y-3 text-sm text-[var(--text-secondary)]"
            >
              <p>
                {absoluteLimitReached
                  ? "The maximum sign-in time has been reached. Sign in again to continue."
                  : "Your session is about to expire because there has been no recent activity."}
              </p>
              <p className="font-semibold text-[var(--semantic-warning-text)]">
                Session ends in {minutes}:{seconds.toString().padStart(2, "0")}.
              </p>
              <p>Unsaved changes may be lost when the session ends.</p>
            </div>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                ref={signOutButtonRef}
                type="button"
                onClick={() => void endSession("logout")}
              >
                Sign out now
              </Button>
              {!absoluteLimitReached && payload.canRenew ? (
                <Button
                  ref={stayButtonRef}
                  type="button"
                  disabled={renewing}
                  onClick={staySignedIn}
                  className="bg-[var(--semantic-warning-text)] text-[var(--surface-panel)]"
                >
                  {renewing ? "Renewing…" : "Stay signed in"}
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
