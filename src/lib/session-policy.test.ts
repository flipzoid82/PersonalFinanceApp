// @vitest-environment node

import { describe, expect, it } from "vitest";

vi.mock("@/lib/env", () => ({
  env: {
    SESSION_ABSOLUTE_TIMEOUT_SECONDS: 28_800,
    SESSION_ACTIVITY_THROTTLE_SECONDS: 60,
    SESSION_IDLE_TIMEOUT_SECONDS: 900,
    SESSION_WARNING_THRESHOLD_SECONDS: 120,
  },
}));

import { vi } from "vitest";
import { buildSessionPolicy } from "./session-policy";

describe("session policy", () => {
  it("uses the Milestone 7.5 defaults", () => {
    expect(buildSessionPolicy({})).toEqual({
      absoluteTimeoutMs: 8 * 60 * 60 * 1000,
      activityThrottleMs: 60 * 1000,
      idleTimeoutMs: 15 * 60 * 1000,
      revokedRetentionMs: 30 * 24 * 60 * 60 * 1000,
      warningThresholdMs: 2 * 60 * 1000,
      warningThresholdSeconds: 120,
    });
  });

  it("accepts shortened development overrides", () => {
    expect(
      buildSessionPolicy({
        absoluteTimeoutSeconds: 120,
        activityThrottleSeconds: 2,
        idleTimeoutSeconds: 60,
        warningThresholdSeconds: 10,
      }),
    ).toEqual(
      expect.objectContaining({
        absoluteTimeoutMs: 120_000,
        activityThrottleMs: 2_000,
        idleTimeoutMs: 60_000,
        warningThresholdMs: 10_000,
      }),
    );
  });

  it("rejects warning and absolute deadlines that contradict the idle policy", () => {
    expect(() =>
      buildSessionPolicy({
        idleTimeoutSeconds: 60,
        warningThresholdSeconds: 60,
      }),
    ).toThrow(/warning threshold/i);
    expect(() =>
      buildSessionPolicy({
        absoluteTimeoutSeconds: 59,
        idleTimeoutSeconds: 60,
        warningThresholdSeconds: 10,
      }),
    ).toThrow(/absolute timeout/i);
  });
});
