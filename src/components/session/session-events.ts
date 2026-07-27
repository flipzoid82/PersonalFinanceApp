"use client";

export const SESSION_CHANNEL_NAME = "personal-finance-session";
export const SESSION_STORAGE_KEY = "personal-finance-session-event";

export type SessionEventType = "expired" | "logout" | "renewed" | "warning";

export function announceSessionEvent(type: SessionEventType) {
  const message = { id: crypto.randomUUID(), type };
  if (typeof window.BroadcastChannel === "function") {
    const channel = new BroadcastChannel(SESSION_CHANNEL_NAME);
    channel.postMessage(message);
    channel.close();
  }
  try {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(message));
    localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // Storage can be disabled. The current tab still completes the operation.
  }
}
