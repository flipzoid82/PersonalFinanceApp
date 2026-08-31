import "server-only";

import { cleanupExpiredImportSources } from "./service";

export const IMPORT_CLEANUP_INTERVAL_MS = 15 * 60 * 1000;

type Cleanup = () => Promise<number>;
type CleanupTimer = ReturnType<typeof setInterval>;

type RetentionRuntimeState = {
  startPromise?: Promise<void>;
  timer?: CleanupTimer;
};

const runtime = globalThis as typeof globalThis & {
  __importRetentionRuntime?: RetentionRuntimeState;
};

function state() {
  return (runtime.__importRetentionRuntime ??= {});
}

async function runCleanup(cleanup: Cleanup) {
  try {
    await cleanup();
  } catch {
    console.error(
      "[imports] Retained-source cleanup failed and will be retried without exposing source details.",
    );
  }
}

export function startImportRetentionCleanup(
  cleanup: Cleanup = cleanupExpiredImportSources,
  intervalMs = IMPORT_CLEANUP_INTERVAL_MS,
) {
  const current = state();
  if (current.startPromise) return current.startPromise;

  current.startPromise = (async () => {
    await runCleanup(cleanup);
    const timer = setInterval(() => void runCleanup(cleanup), intervalMs);
    timer.unref?.();
    current.timer = timer;
  })();
  return current.startPromise;
}

export function resetImportRetentionCleanupForTests() {
  const current = state();
  if (current.timer) clearInterval(current.timer);
  delete runtime.__importRetentionRuntime;
}
