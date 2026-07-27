import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  SessionSecurityController,
  type SessionPayload,
} from "./session-security-controller";

const NOW = Date.parse("2026-07-26T10:00:00.000Z");

function payload(overrides: Partial<SessionPayload> = {}): SessionPayload {
  return {
    absoluteExpiresAt: "2026-07-26T18:00:00.000Z",
    canRenew: true,
    idleExpiresAt: "2026-07-26T10:01:30.000Z",
    serverNow: "2026-07-26T10:00:00.000Z",
    status: "active",
    warningThresholdSeconds: 120,
    ...overrides,
  };
}

function response(body: SessionPayload, ok = true) {
  return {
    json: vi.fn().mockResolvedValue(body),
    ok,
    redirected: false,
  } as unknown as Response;
}

async function renderController(
  initial = payload(),
  navigate = vi.fn<(url: string) => void>(),
) {
  const fetchMock = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(response(initial));
  render(
    <>
      <main id="dashboard-shell">
        <button type="button">Page action</button>
      </main>
      <SessionSecurityController navigate={navigate} />
    </>,
  );
  screen.getByRole("button", { name: "Page action" }).focus();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
    await Promise.resolve();
    await Promise.resolve();
  });
  return { fetchMock, navigate };
}

describe("session expiration warning", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("shows an accessible warning at the configured threshold and traps focus", async () => {
    await renderController();

    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toHaveAccessibleName("Still working?");
    expect(dialog).toHaveAccessibleDescription(/no recent activity/i);
    expect(
      screen.getByRole("button", { name: "Stay signed in" }),
    ).toHaveFocus();
    expect(document.getElementById("dashboard-shell")).toHaveProperty(
      "inert",
      true,
    );

    fireEvent.keyDown(document, { key: "Tab" });
    expect(screen.getByRole("button", { name: "Sign out now" })).toHaveFocus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(
      screen.getByRole("button", { name: "Stay signed in" }),
    ).toHaveFocus();
  });

  it("Escape neither dismisses nor renews the warning", async () => {
    const { fetchMock } = await renderController();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalledWith(
      "/api/session/renew",
      expect.anything(),
    );
  });

  it("renews through the server and removes the warning", async () => {
    const renewed = payload({
      idleExpiresAt: "2026-07-26T10:15:00.000Z",
    });
    const { fetchMock } = await renderController();
    fetchMock.mockResolvedValueOnce(response(renewed));
    fetchMock.mockResolvedValueOnce(response(renewed));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Stay signed in" }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/session/renew",
      expect.objectContaining({ method: "POST" }),
    );
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Page action" })).toHaveFocus();
  });

  it("distinguishes the absolute limit and removes renewal", async () => {
    await renderController(
      payload({
        absoluteExpiresAt: "2026-07-26T10:01:30.000Z",
        idleExpiresAt: "2026-07-26T10:10:00.000Z",
      }),
    );

    expect(
      screen.getByRole("heading", { name: "Your session is ending" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Stay signed in" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/maximum sign-in time/i)).toBeInTheDocument();
  });

  it("uses server time for the countdown instead of trusting the browser clock", async () => {
    await renderController(
      payload({
        absoluteExpiresAt: "2026-07-26T18:00:00.000Z",
        idleExpiresAt: "2026-07-26T10:06:30.000Z",
        serverNow: "2026-07-26T10:05:00.000Z",
      }),
    );

    expect(screen.getByText(/Session ends in 1:30/)).toBeInTheDocument();
  });

  it("announces useful thresholds without replacing the live region every second", async () => {
    await renderController();
    const liveRegion = screen.getByText(/120 seconds unless/i);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(liveRegion).toHaveTextContent("120 seconds");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(29_000);
    });
    expect(liveRegion).toHaveTextContent("60 seconds");
  });

  it("reconciles cross-tab messages with the server instead of trusting them", async () => {
    const { fetchMock } = await renderController();
    fetchMock.mockClear();
    fetchMock.mockResolvedValue(response(payload()));

    window.dispatchEvent(
      new StorageEvent("storage", {
        key: "personal-finance-session-event",
        newValue: JSON.stringify({ type: "renewed" }),
      }),
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/session/status",
      expect.objectContaining({ cache: "no-store" }),
    );
  });

  it("preserves the expiration reason across tabs after server invalidation", async () => {
    const { navigate } = await renderController();

    window.dispatchEvent(
      new StorageEvent("storage", {
        key: "personal-finance-session-event",
        newValue: JSON.stringify({ type: "expired" }),
      }),
    );

    expect(navigate).toHaveBeenCalledWith("/api/session/end?reason=expired");
  });

  it("revokes immediately when Sign out now is chosen", async () => {
    const { fetchMock, navigate } = await renderController();
    fetchMock.mockResolvedValueOnce(response(payload()));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Sign out now" }));
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/session/logout",
      expect.objectContaining({ method: "POST" }),
    );
    expect(navigate).toHaveBeenCalledWith("/login");
  });

  it("redirects safely when renewal fails", async () => {
    const { fetchMock, navigate } = await renderController();
    fetchMock.mockResolvedValueOnce(response(payload(), false));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Stay signed in" }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(navigate).toHaveBeenCalledWith("/api/session/end?reason=expired");
  });
});
