// @vitest-environment node

import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cookies: vi.fn(),
  deleteMany: vi.fn(),
  findUnique: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: mocks.cookies }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/db", () => ({
  db: {
    authSession: {
      create: vi.fn(),
      deleteMany: mocks.deleteMany,
      findUnique: mocks.findUnique,
    },
  },
}));
vi.mock("@/lib/env", () => ({
  env: {
    AUTH_SECRET: "test-auth-secret-that-is-at-least-32-characters",
    NODE_ENV: "test",
  },
}));

import { deleteSession, getCurrentUser, requireUser } from "./auth";

describe("session logout", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deletes the current AuthSession and clears its cookie", async () => {
    const deleteCookie = vi.fn();
    mocks.cookies.mockResolvedValue({
      get: vi.fn().mockReturnValue({ value: "current-session-token" }),
      delete: deleteCookie,
    });

    await deleteSession();

    const expectedHash = createHmac(
      "sha256",
      "test-auth-secret-that-is-at-least-32-characters",
    )
      .update("current-session-token")
      .digest("hex");
    expect(mocks.deleteMany).toHaveBeenCalledWith({
      where: { tokenHash: expectedHash },
    });
    expect(deleteCookie).toHaveBeenCalledWith("finance_session");
  });

  it("still clears the cookie when no session token is present", async () => {
    const deleteCookie = vi.fn();
    mocks.cookies.mockResolvedValue({
      get: vi.fn().mockReturnValue(undefined),
      delete: deleteCookie,
    });

    await deleteSession();

    expect(mocks.deleteMany).not.toHaveBeenCalled();
    expect(deleteCookie).toHaveBeenCalledWith("finance_session");
  });

  it("redirects unauthenticated protected access to login", async () => {
    mocks.cookies.mockResolvedValue({
      get: vi.fn().mockReturnValue(undefined),
    });
    mocks.redirect.mockImplementation(() => {
      throw new Error("NEXT_REDIRECT");
    });

    await expect(requireUser()).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.redirect).toHaveBeenCalledWith("/login");
  });

  it("rejects a cookie that has no matching AuthSession", async () => {
    mocks.cookies.mockResolvedValue({
      get: vi.fn().mockReturnValue({ value: "unknown-session-token" }),
    });
    mocks.findUnique.mockResolvedValue(null);

    await expect(getCurrentUser()).resolves.toBeNull();
  });

  it("rejects an expired AuthSession even when its cookie still exists", async () => {
    mocks.cookies.mockResolvedValue({
      get: vi.fn().mockReturnValue({ value: "expired-session-token" }),
    });
    mocks.findUnique.mockResolvedValue({
      expiresAt: new Date(Date.now() - 1),
      user: {
        id: "owner-id",
        email: "owner@example.test",
        displayName: "Owner",
      },
    });

    await expect(getCurrentUser()).resolves.toBeNull();
  });
});
