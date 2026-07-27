import "server-only";
import { env } from "@/lib/env";

export type SessionPolicy = {
  idleTimeoutMs: number;
  warningThresholdMs: number;
  warningThresholdSeconds: number;
  absoluteTimeoutMs: number;
  activityThrottleMs: number;
  revokedRetentionMs: number;
};

export function buildSessionPolicy(values: {
  idleTimeoutSeconds?: number;
  warningThresholdSeconds?: number;
  absoluteTimeoutSeconds?: number;
  activityThrottleSeconds?: number;
}): SessionPolicy {
  const idleTimeoutMs = (values.idleTimeoutSeconds ?? 15 * 60) * 1000;
  const warningThresholdMs = (values.warningThresholdSeconds ?? 2 * 60) * 1000;
  const absoluteTimeoutMs =
    (values.absoluteTimeoutSeconds ?? 8 * 60 * 60) * 1000;
  const activityThrottleMs = (values.activityThrottleSeconds ?? 60) * 1000;
  if (warningThresholdMs >= idleTimeoutMs)
    throw new Error(
      "Session warning threshold must be shorter than idle timeout.",
    );
  if (absoluteTimeoutMs < idleTimeoutMs)
    throw new Error(
      "Session absolute timeout must not be shorter than idle timeout.",
    );
  return {
    idleTimeoutMs,
    warningThresholdMs,
    warningThresholdSeconds: warningThresholdMs / 1000,
    absoluteTimeoutMs,
    activityThrottleMs,
    revokedRetentionMs: 30 * 24 * 60 * 60 * 1000,
  };
}

export const sessionPolicy = buildSessionPolicy({
  idleTimeoutSeconds: env.SESSION_IDLE_TIMEOUT_SECONDS,
  warningThresholdSeconds: env.SESSION_WARNING_THRESHOLD_SECONDS,
  absoluteTimeoutSeconds: env.SESSION_ABSOLUTE_TIMEOUT_SECONDS,
  activityThrottleSeconds: env.SESSION_ACTIVITY_THROTTLE_SECONDS,
});
