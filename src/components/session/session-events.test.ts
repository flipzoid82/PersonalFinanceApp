import { afterEach, describe, expect, it, vi } from "vitest";
import { announceSessionEvent, SESSION_STORAGE_KEY } from "./session-events";

const originalBroadcastChannel = window.BroadcastChannel;

describe("cross-tab session events", () => {
  afterEach(() => {
    Object.defineProperty(window, "BroadcastChannel", {
      configurable: true,
      value: originalBroadcastChannel,
    });
    vi.restoreAllMocks();
  });

  it("broadcasts only a safe event kind and random identifier", () => {
    const postMessage = vi.fn();
    const close = vi.fn();
    class BroadcastChannelMock {
      postMessage = postMessage;
      close = close;
    }
    Object.defineProperty(window, "BroadcastChannel", {
      configurable: true,
      value: BroadcastChannelMock,
    });
    const storage = vi.spyOn(Storage.prototype, "setItem");

    announceSessionEvent("renewed");

    expect(postMessage).toHaveBeenCalledWith({
      id: expect.any(String),
      type: "renewed",
    });
    expect(close).toHaveBeenCalledOnce();
    const serialized = storage.mock.calls[0][1];
    expect(serialized).not.toMatch(/token|cookie|email|deadline/i);
  });

  it("falls back safely when BroadcastChannel is unavailable", () => {
    Object.defineProperty(window, "BroadcastChannel", {
      configurable: true,
      value: undefined,
    });
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const removeItem = vi.spyOn(Storage.prototype, "removeItem");

    announceSessionEvent("logout");

    expect(setItem).toHaveBeenCalledWith(
      SESSION_STORAGE_KEY,
      expect.stringContaining('"type":"logout"'),
    );
    expect(removeItem).toHaveBeenCalledWith(SESSION_STORAGE_KEY);
  });
});
