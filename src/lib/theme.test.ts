import { describe, expect, it } from "vitest";
import {
  explicitThemeClass,
  parseThemePreference,
  THEME_PREFERENCES,
} from "./theme";

describe("theme preference", () => {
  it("accepts only Light, Dark, and System values", () => {
    expect(THEME_PREFERENCES).toEqual(["light", "dark", "system"]);
    expect(parseThemePreference("light")).toBe("light");
    expect(parseThemePreference("dark")).toBe("dark");
    expect(parseThemePreference("system")).toBe("system");
    expect(parseThemePreference("unknown")).toBe("system");
    expect(parseThemePreference(undefined)).toBe("system");
  });

  it("uses no explicit class for System", () => {
    expect(explicitThemeClass("light")).toBe("light");
    expect(explicitThemeClass("dark")).toBe("dark");
    expect(explicitThemeClass("system")).toBeUndefined();
  });
});
