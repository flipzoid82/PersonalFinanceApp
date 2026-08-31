// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  IMPORT_CLEANUP_INTERVAL_MS,
  resetImportRetentionCleanupForTests,
  startImportRetentionCleanup,
} from "./retention";

afterEach(() => {
  resetImportRetentionCleanupForTests();
  vi.useRealTimers();
});

describe("retained-source runtime cleanup", () => {
  it("sweeps on startup and periodically while the process is active", async () => {
    vi.useFakeTimers();
    const cleanup = vi.fn().mockResolvedValue(0);

    await startImportRetentionCleanup(cleanup);
    expect(cleanup).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(IMPORT_CLEANUP_INTERVAL_MS);
    expect(cleanup).toHaveBeenCalledTimes(2);
  });

  it("keeps one process-owned loop across repeated startup registration", async () => {
    vi.useFakeTimers();
    const cleanup = vi.fn().mockResolvedValue(0);

    await Promise.all([
      startImportRetentionCleanup(cleanup),
      startImportRetentionCleanup(cleanup),
    ]);
    await vi.advanceTimersByTimeAsync(IMPORT_CLEANUP_INTERVAL_MS);

    expect(cleanup).toHaveBeenCalledTimes(2);
  });

  it("keeps the application alive and retries after a cleanup failure", async () => {
    vi.useFakeTimers();
    const error = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const cleanup = vi
      .fn<Cleanup>()
      .mockRejectedValueOnce(new Error("sensitive database detail"))
      .mockResolvedValue(0);

    await expect(startImportRetentionCleanup(cleanup)).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledWith(
      expect.not.stringContaining("sensitive database detail"),
    );

    await vi.advanceTimersByTimeAsync(IMPORT_CLEANUP_INTERVAL_MS);
    expect(cleanup).toHaveBeenCalledTimes(2);
    error.mockRestore();
  });
});

type Cleanup = () => Promise<number>;
