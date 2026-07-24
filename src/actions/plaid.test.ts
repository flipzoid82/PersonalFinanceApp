import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  disconnect: vi.fn(),
  redirect: vi.fn(),
  revalidatePath: vi.fn(),
  requireUser: vi.fn(),
  sync: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));
vi.mock("@/lib/auth", () => ({ requireUser: mocks.requireUser }));
vi.mock("@/lib/plaid", () => ({
  disconnectPlaidConnection: mocks.disconnect,
  SafePlaidError: class SafePlaidError extends Error {},
  syncPlaidConnection: mocks.sync,
}));

import {
  disconnectPlaidConnectionAction,
  syncPlaidConnectionAction,
} from "./plaid";

describe("Plaid server actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ id: "owner-id" });
    mocks.redirect.mockImplementation((url: string) => {
      throw new Error(`NEXT_REDIRECT:${url}`);
    });
  });

  it("redirects with successful manual-sync feedback without catching the redirect", async () => {
    mocks.sync.mockResolvedValue({
      accounts: 12,
      added: 0,
      modified: 0,
      removed: 0,
    });
    const formData = new FormData();
    formData.set("connectionId", "connection-id");

    await expect(syncPlaidConnectionAction(formData)).rejects.toThrow(
      "NEXT_REDIRECT:/accounts?message=",
    );

    expect(mocks.sync).toHaveBeenCalledOnce();
    expect(mocks.redirect).toHaveBeenCalledOnce();
    expect(mocks.redirect).toHaveBeenCalledWith(
      expect.stringContaining("Plaid+Sandbox+sync+complete"),
    );
  });

  it("redirects with successful disconnect feedback without catching the redirect", async () => {
    mocks.disconnect.mockResolvedValue(undefined);
    const formData = new FormData();
    formData.set("connectionId", "connection-id");

    await expect(disconnectPlaidConnectionAction(formData)).rejects.toThrow(
      "NEXT_REDIRECT:/accounts?message=",
    );

    expect(mocks.disconnect).toHaveBeenCalledOnce();
    expect(mocks.redirect).toHaveBeenCalledOnce();
    expect(mocks.redirect).toHaveBeenCalledWith(
      expect.stringContaining("Plaid+Sandbox+disconnected"),
    );
  });
});
