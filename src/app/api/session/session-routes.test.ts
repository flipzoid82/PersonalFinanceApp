// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  clearInvalidSessionCookie: vi.fn(),
  deleteSession: vi.fn(),
  getSessionStatus: vi.fn(),
  recordSessionActivity: vi.fn(),
  renewSession: vi.fn(),
  requireSameOrigin: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  clearInvalidSessionCookie: mocks.clearInvalidSessionCookie,
  deleteSession: mocks.deleteSession,
  getSessionStatus: mocks.getSessionStatus,
  recordSessionActivity: mocks.recordSessionActivity,
  renewSession: mocks.renewSession,
}));
vi.mock("@/lib/request-security", () => ({
  requireSameOrigin: mocks.requireSameOrigin,
}));
vi.mock("@/lib/env", () => ({
  env: { APP_URL: "http://localhost:3000" },
}));

import { POST as recordActivity } from "./activity/route";
import { GET as endSession } from "./end/route";
import { POST as logout } from "./logout/route";
import { POST as renew } from "./renew/route";
import { GET as status } from "./status/route";

const active = {
  absoluteExpiresAt: "2026-07-26T18:00:00.000Z",
  canRenew: true,
  idleExpiresAt: "2026-07-26T10:15:00.000Z",
  serverNow: "2026-07-26T10:00:00.000Z",
  status: "active",
  warningThresholdSeconds: 120,
};

describe("session lifecycle routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSessionStatus.mockResolvedValue(active);
    mocks.recordSessionActivity.mockResolvedValue({ status: "active" });
    mocks.renewSession.mockResolvedValue({ status: "active" });
  });

  it("returns passive safe status metadata without caching", async () => {
    const response = await status();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(await response.json()).toEqual(active);
    expect(mocks.recordSessionActivity).not.toHaveBeenCalled();
  });

  it("returns 401 for an expired passive status check", async () => {
    mocks.getSessionStatus.mockResolvedValue({
      ...active,
      canRenew: false,
      status: "idle_expired",
    });

    expect((await status()).status).toBe(401);
  });

  it("requires same-origin requests for renewal and activity", async () => {
    const request = new Request("http://localhost:3000/api/session/renew", {
      method: "POST",
    });

    expect((await renew(request.clone())).status).toBe(200);
    expect((await recordActivity(request)).status).toBe(200);
    expect(mocks.requireSameOrigin).toHaveBeenCalledTimes(2);
    expect(mocks.renewSession).toHaveBeenCalledOnce();
    expect(mocks.recordSessionActivity).toHaveBeenCalledOnce();
  });

  it("rejects a failed origin check before changing session state", async () => {
    mocks.requireSameOrigin.mockImplementationOnce(() => {
      throw new Error("Invalid request origin.");
    });
    const request = new Request("http://localhost:3000/api/session/renew", {
      method: "POST",
    });

    expect((await renew(request)).status).toBe(403);
    expect(mocks.renewSession).not.toHaveBeenCalled();
  });

  it("revokes the current session before acknowledging logout", async () => {
    const request = new Request("http://localhost:3000/api/session/logout", {
      method: "POST",
    });
    const response = await logout(request);

    expect(response.status).toBe(200);
    expect(mocks.deleteSession).toHaveBeenCalledOnce();
    expect(await response.json()).toEqual({ signedOut: true });
  });

  it("clears stale cookies and uses only the safe expiration reason", async () => {
    const expired = await endSession(
      new Request("http://localhost:3000/api/session/end?reason=expired"),
    );
    expect(expired.headers.get("location")).toBe(
      "http://localhost:3000/login?reason=expired",
    );
    const unsafe = await endSession(
      new Request(
        "http://localhost:3000/api/session/end?reason=expired&next=https://evil.example",
      ),
    );
    expect(unsafe.headers.get("location")).toBe(
      "http://localhost:3000/login?reason=expired",
    );
    expect(mocks.clearInvalidSessionCookie).toHaveBeenNthCalledWith(
      1,
      "expired",
    );
    expect(mocks.clearInvalidSessionCookie).toHaveBeenNthCalledWith(
      2,
      "expired",
    );
    expect(mocks.clearInvalidSessionCookie).toHaveBeenCalledTimes(2);
  });

  it("keeps explicit non-expiration session ending on plain login", async () => {
    const response = await endSession(
      new Request("http://localhost:3000/api/session/end"),
    );

    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/login",
    );
    expect(mocks.clearInvalidSessionCookie).toHaveBeenCalledWith(undefined);
  });
});
