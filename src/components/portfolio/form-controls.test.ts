import { describe, expect, it, vi } from "vitest";

import { dateTimeInputValue } from "./form-controls";

describe("dateTimeInputValue", () => {
  it("formats datetime-local defaults in the user's local time", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 22, 23, 43, 59));

    expect(dateTimeInputValue()).toBe("2026-07-22T23:43");

    vi.useRealTimers();
  });
});
