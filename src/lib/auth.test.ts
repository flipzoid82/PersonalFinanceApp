// @vitest-environment node

import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const TOKEN = "a".repeat(43);
const SECRET = "test-auth-secret-that-is-at-least-32-characters";
const mocks = vi.hoisted(() => ({
  secret: "test-auth-secret-that-is-at-least-32-characters",
  cookies: vi.fn(),
  create: vi.fn(),
  deleteMany: vi.fn(),
  findUnique: vi.fn(),
  redirect: vi.fn(),
  updateMany: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: mocks.cookies }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/db", () => {
  const authSession = {
    create: mocks.create,
    deleteMany: mocks.deleteMany,
    findUnique: mocks.findUnique,
    updateMany: mocks.updateMany,
  };
  return {
    db: {
      authSession,
      $transaction: vi.fn(
        async (work: (tx: { authSession: typeof authSession }) => unknown) =>
          work({ authSession }),
      ),
    },
  };
});
vi.mock("@/lib/env", () => ({
  env: {
    AUTH_SECRET: mocks.secret,
    NODE_ENV: "test",
    SESSION_ABSOLUTE_TIMEOUT_SECONDS: 28_800,
    SESSION_ACTIVITY_THROTTLE_SECONDS: 60,
    SESSION_IDLE_TIMEOUT_SECONDS: 900,
    SESSION_WARNING_THRESHOLD_SECONDS: 120,
  },
}));

import {
  clearInvalidSessionCookie,
  createSession,
  deleteSession,
  getCurrentUser,
  getSessionStatus,
  recordSessionActivity,
  renewSession,
  requireApiUser,
  requireUser,
} from "./auth";

function hash(value = TOKEN) {
  return createHmac("sha256", SECRET).update(value).digest("hex");
}

function activeSession(overrides: Record<string, unknown> = {}) {
  return {
    id: "session-id",
    tokenHash: hash(),
    userId: "owner-id",
    authenticatedAt: new Date("2026-07-26T10:00:00.000Z"),
    lastActivityAt: new Date("2026-07-26T10:05:00.000Z"),
    idleExpiresAt: new Date("2026-07-26T10:20:00.000Z"),
    absoluteExpiresAt: new Date("2026-07-26T18:00:00.000Z"),
    revokedAt: null,
    revocationReason: null,
    createdAt: new Date("2026-07-26T10:00:00.000Z"),
    updatedAt: new Date("2026-07-26T10:05:00.000Z"),
    user: {
      id: "owner-id",
      email: "owner@example.test",
      displayName: "Owner",
    },
    ...overrides,
  };
}

function cookieStore(token: string | null = TOKEN) {
  const set = vi.fn();
  mocks.cookies.mockResolvedValue({
    get: vi.fn().mockReturnValue(token ? { value: token } : undefined),
    set,
  });
  return { set };
}

describe("server-authoritative sessions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.updateMany.mockResolvedValue({ count: 1 });
    mocks.deleteMany.mockResolvedValue({ count: 0 });
  });

  it("stores only an HMAC digest, rotates the prior session, and sets a secure cookie", async () => {
    const { set } = cookieStore();

    await createSession("owner-id");

    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: { tokenHash: hash(), revokedAt: null },
      data: {
        revokedAt: expect.any(Date),
        revocationReason: "REAUTHENTICATED",
      },
    });
    const createData = mocks.create.mock.calls[0][0].data;
    expect(createData.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(createData.tokenHash).not.toBe(TOKEN);
    expect(createData.idleExpiresAt.getTime()).toBe(
      createData.authenticatedAt.getTime() + 15 * 60 * 1000,
    );
    expect(createData.absoluteExpiresAt.getTime()).toBe(
      createData.authenticatedAt.getTime() + 8 * 60 * 60 * 1000,
    );
    expect(set).toHaveBeenCalledWith(
      "finance_session",
      expect.stringMatching(/^[A-Za-z0-9_-]{43}$/),
      expect.objectContaining({
        httpOnly: true,
        path: "/",
        sameSite: "lax",
        secure: false,
      }),
    );
    expect(set).toHaveBeenCalledWith(
      "finance_session_expired",
      "",
      expect.objectContaining({ maxAge: 0, path: "/" }),
    );
  });

  it("revokes the current session and expires the cookie on logout", async () => {
    const { set } = cookieStore();

    await deleteSession();

    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: { tokenHash: hash(), revokedAt: null },
      data: {
        revokedAt: expect.any(Date),
        revocationReason: "USER_LOGOUT",
      },
    });
    expect(set).toHaveBeenCalledWith(
      "finance_session",
      "",
      expect.objectContaining({ maxAge: 0, path: "/" }),
    );
    expect(set).toHaveBeenCalledWith(
      "finance_session_expired",
      "",
      expect.objectContaining({ maxAge: 0, path: "/" }),
    );
  });

  it("still clears the cookie when no token is present", async () => {
    const { set } = cookieStore(null);

    await deleteSession();

    expect(mocks.updateMany).not.toHaveBeenCalled();
    expect(set).toHaveBeenCalledTimes(2);
  });

  it("treats repeated logout as an idempotent success", async () => {
    const { set } = cookieStore();
    mocks.updateMany.mockResolvedValue({ count: 0 });

    await expect(deleteSession()).resolves.toBeUndefined();

    expect(set).toHaveBeenCalledTimes(2);
  });

  it("redirects unauthenticated protected access through cookie cleanup", async () => {
    cookieStore(null);
    mocks.redirect.mockImplementation(() => {
      throw new Error("NEXT_REDIRECT");
    });

    await expect(requireUser()).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.redirect).toHaveBeenCalledWith("/api/session/end");
  });

  it("rejects malformed and unknown cookie values without querying their hash", async () => {
    cookieStore("not-a-valid-token");
    await expect(getCurrentUser()).resolves.toBeNull();
    expect(mocks.findUnique).not.toHaveBeenCalled();

    cookieStore();
    mocks.findUnique.mockResolvedValue(null);
    await expect(getCurrentUser()).resolves.toBeNull();
    expect(mocks.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tokenHash: hash() } }),
    );
  });

  it("revokes idle-expired sessions and returns no owner", async () => {
    cookieStore();
    mocks.findUnique.mockResolvedValue(
      activeSession({
        idleExpiresAt: new Date("2026-07-26T10:10:00.000Z"),
      }),
    );

    const status = await getSessionStatus(new Date("2026-07-26T10:11:00.000Z"));

    expect(status.status).toBe("idle_expired");
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: { id: "session-id", revokedAt: null },
      data: {
        revokedAt: new Date("2026-07-26T10:11:00.000Z"),
        revocationReason: "IDLE_TIMEOUT",
      },
    });
  });

  it("gives absolute expiration precedence when both deadlines passed", async () => {
    cookieStore();
    mocks.findUnique.mockResolvedValue(
      activeSession({
        absoluteExpiresAt: new Date("2026-07-26T10:09:00.000Z"),
        idleExpiresAt: new Date("2026-07-26T10:10:00.000Z"),
      }),
    );

    const status = await getSessionStatus(new Date("2026-07-26T10:11:00.000Z"));

    expect(status.status).toBe("absolute_expired");
    expect(mocks.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          revocationReason: "ABSOLUTE_TIMEOUT",
        }),
      }),
    );
  });

  it("blocks expired page, action, and API authentication paths", async () => {
    vi.useFakeTimers();
    cookieStore();
    mocks.findUnique.mockResolvedValue(
      activeSession({
        idleExpiresAt: new Date("2026-07-26T10:10:00.000Z"),
      }),
    );
    mocks.redirect.mockImplementation(() => {
      throw new Error("NEXT_REDIRECT");
    });
    vi.setSystemTime(new Date("2026-07-26T10:11:00.000Z"));

    await expect(requireUser({ activity: "meaningful" })).rejects.toThrow(
      "NEXT_REDIRECT",
    );
    expect(mocks.redirect).toHaveBeenCalledWith(
      "/api/session/end?reason=expired",
    );

    mocks.findUnique.mockResolvedValue(
      activeSession({
        revokedAt: new Date("2026-07-26T10:11:00.000Z"),
        revocationReason: "IDLE_TIMEOUT",
      }),
    );
    await expect(requireApiUser()).rejects.toMatchObject({
      code: "AUTH_REQUIRED",
      status: "idle_expired",
    });
    vi.useRealTimers();
  });

  it("does not authenticate a revoked session", async () => {
    cookieStore();
    mocks.findUnique.mockResolvedValue(
      activeSession({
        revokedAt: new Date("2026-07-26T10:06:00.000Z"),
        revocationReason: "USER_LOGOUT",
      }),
    );

    await expect(getCurrentUser()).resolves.toBeNull();
  });

  it("preserves idle and absolute expiration reasons on already-revoked sessions", async () => {
    cookieStore();
    mocks.findUnique
      .mockResolvedValueOnce(
        activeSession({
          revokedAt: new Date("2026-07-26T10:06:00.000Z"),
          revocationReason: "IDLE_TIMEOUT",
        }),
      )
      .mockResolvedValueOnce(
        activeSession({
          revokedAt: new Date("2026-07-26T18:00:00.000Z"),
          revocationReason: "ABSOLUTE_TIMEOUT",
        }),
      );

    await expect(getSessionStatus()).resolves.toMatchObject({
      status: "idle_expired",
    });
    await expect(getSessionStatus()).resolves.toMatchObject({
      status: "absolute_expired",
    });
  });

  it("clears the bearer cookie and stores only a short-lived expiration marker", async () => {
    const { set } = cookieStore();

    await clearInvalidSessionCookie("expired");

    expect(set).toHaveBeenCalledWith(
      "finance_session",
      "",
      expect.objectContaining({ maxAge: 0, path: "/" }),
    );
    expect(set).toHaveBeenCalledWith(
      "finance_session_expired",
      "1",
      expect.objectContaining({
        httpOnly: true,
        maxAge: 300,
        path: "/",
        sameSite: "lax",
      }),
    );
  });

  it("accepts a valid owner session through its token hash lookup", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-26T10:11:00.000Z"));
    cookieStore();
    mocks.findUnique.mockResolvedValue(activeSession());

    await expect(getCurrentUser()).resolves.toEqual({
      id: "owner-id",
      email: "owner@example.test",
      displayName: "Owner",
    });
    expect(mocks.findUnique).toHaveBeenCalledWith({
      where: { tokenHash: hash() },
      include: { user: true },
    });
    vi.useRealTimers();
  });

  it("throttles meaningful activity and never extends beyond the absolute deadline", async () => {
    cookieStore();
    mocks.findUnique.mockResolvedValue(
      activeSession({
        absoluteExpiresAt: new Date("2026-07-26T10:15:30.000Z"),
      }),
    );
    const now = new Date("2026-07-26T10:11:00.000Z");

    await recordSessionActivity(now);

    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: {
        id: "session-id",
        revokedAt: null,
        lastActivityAt: { lte: new Date("2026-07-26T10:10:00.000Z") },
        idleExpiresAt: { gt: now },
        absoluteExpiresAt: { gt: now },
      },
      data: {
        idleExpiresAt: new Date("2026-07-26T10:15:30.000Z"),
        lastActivityAt: now,
      },
    });
  });

  it("avoids a database write inside the meaningful-activity throttle window", async () => {
    cookieStore();
    mocks.findUnique.mockResolvedValue(
      activeSession({
        lastActivityAt: new Date("2026-07-26T10:10:30.000Z"),
      }),
    );

    const result = await recordSessionActivity(
      new Date("2026-07-26T10:11:00.000Z"),
    );

    expect(result.status).toBe("active");
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  it("renews only the idle deadline and caps it at absolute expiration", async () => {
    cookieStore();
    mocks.findUnique.mockResolvedValue(
      activeSession({
        absoluteExpiresAt: new Date("2026-07-26T10:15:30.000Z"),
      }),
    );
    const now = new Date("2026-07-26T10:11:00.000Z");

    const result = await renewSession(now);

    expect(result.absoluteExpiresAt).toEqual(
      new Date("2026-07-26T10:15:30.000Z"),
    );
    expect(result.idleExpiresAt).toEqual(new Date("2026-07-26T10:15:30.000Z"));
    expect(mocks.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          idleExpiresAt: new Date("2026-07-26T10:15:30.000Z"),
          lastActivityAt: now,
        },
      }),
    );
  });

  it.each([
    {
      label: "idle",
      overrides: {
        idleExpiresAt: new Date("2026-07-26T10:10:00.000Z"),
      },
      status: "idle_expired",
    },
    {
      label: "absolute",
      overrides: {
        absoluteExpiresAt: new Date("2026-07-26T10:10:00.000Z"),
      },
      status: "absolute_expired",
    },
  ])(
    "refuses renewal after $label expiration",
    async ({ overrides, status }) => {
      cookieStore();
      mocks.findUnique.mockResolvedValue(activeSession(overrides));

      const result = await renewSession(new Date("2026-07-26T10:11:00.000Z"));

      expect(result.status).toBe(status);
      expect(mocks.updateMany).toHaveBeenCalledOnce();
      expect(mocks.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            revocationReason:
              status === "idle_expired" ? "IDLE_TIMEOUT" : "ABSOLUTE_TIMEOUT",
          }),
        }),
      );
    },
  );

  it("keeps concurrent renewal bounded by the same absolute deadline", async () => {
    cookieStore();
    mocks.findUnique.mockResolvedValue(
      activeSession({
        absoluteExpiresAt: new Date("2026-07-26T10:15:30.000Z"),
      }),
    );
    const now = new Date("2026-07-26T10:11:00.000Z");

    const [first, second] = await Promise.all([
      renewSession(now),
      renewSession(now),
    ]);

    expect(first.idleExpiresAt).toEqual(second.idleExpiresAt);
    expect(first.absoluteExpiresAt).toEqual(second.absoluteExpiresAt);
    expect(first.absoluteExpiresAt).toEqual(
      new Date("2026-07-26T10:15:30.000Z"),
    );
  });

  it("returns only safe status metadata", async () => {
    cookieStore();
    mocks.findUnique.mockResolvedValue(activeSession());

    const status = await getSessionStatus(new Date("2026-07-26T10:11:00.000Z"));

    expect(status).toEqual({
      absoluteExpiresAt: "2026-07-26T18:00:00.000Z",
      canRenew: true,
      idleExpiresAt: "2026-07-26T10:20:00.000Z",
      serverNow: "2026-07-26T10:11:00.000Z",
      status: "active",
      warningThresholdSeconds: 120,
    });
    expect(JSON.stringify(status)).not.toContain("owner@example");
    expect(JSON.stringify(status)).not.toContain(TOKEN);
  });
});
