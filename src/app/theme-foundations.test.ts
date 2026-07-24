// @vitest-environment node

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("theme foundations", () => {
  const css = readFileSync("src/app/globals.css", "utf8");

  it("supports system dark mode and a future explicit class override", () => {
    expect(css).toContain("@media (prefers-color-scheme: dark)");
    expect(css).toContain(":root.dark");
    expect(css).toContain(":root:not(.light)");
  });

  it("defines every planned semantic meaning as a theme token", () => {
    for (const token of [
      "--semantic-positive",
      "--semantic-negative",
      "--semantic-warning",
      "--semantic-info",
      "--semantic-investment",
      "--semantic-muted",
    ])
      expect(css).toContain(token);
  });
});
