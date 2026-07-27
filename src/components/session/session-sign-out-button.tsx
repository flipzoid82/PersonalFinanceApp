"use client";

import { useState } from "react";
import { announceSessionEvent } from "@/components/session/session-events";
import { Button } from "@/components/ui/button";

export function SessionSignOutButton() {
  const [pending, setPending] = useState(false);

  async function signOut() {
    if (pending) return;
    setPending(true);
    try {
      await fetch("/api/session/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
    } finally {
      announceSessionEvent("logout");
      window.location.assign("/login");
    }
  }

  return (
    <Button
      type="button"
      disabled={pending}
      onClick={signOut}
      className="min-h-9 bg-[var(--surface-panel)] px-3 text-[var(--text-primary)] ring-1 ring-[var(--border-default)] hover:bg-[var(--surface-subtle)] dark:bg-[var(--surface-panel)] dark:text-[var(--text-primary)]"
    >
      {pending ? "Signing out…" : "Sign out"}
    </Button>
  );
}
