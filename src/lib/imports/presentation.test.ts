import { describe, expect, it } from "vitest";
import { formatImportDate } from "./presentation";

describe("import presentation", () => {
  it("renders database date-only values without shifting to the previous day", () => {
    expect(formatImportDate(new Date("2026-07-31T00:00:00.000Z"))).toBe(
      "Jul 31, 2026",
    );
  });
});
