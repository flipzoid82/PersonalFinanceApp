// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  deleteSession: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/auth", () => ({
  createSession: vi.fn(),
  deleteSession: mocks.deleteSession,
}));
vi.mock("@/lib/db", () => ({
  db: { user: { findUnique: vi.fn() } },
}));
vi.mock("@/lib/password", () => ({ verifyPassword: vi.fn() }));

import { logout } from "./auth";

describe("logout action", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deletes the session before redirecting to login", async () => {
    await logout();

    expect(mocks.deleteSession).toHaveBeenCalledOnce();
    expect(mocks.redirect).toHaveBeenCalledWith("/login");
    expect(mocks.deleteSession.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.redirect.mock.invocationCallOrder[0],
    );
  });
});
