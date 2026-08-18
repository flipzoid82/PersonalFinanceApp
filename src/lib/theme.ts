export const THEME_COOKIE_NAME = "finance-theme";

export const THEME_PREFERENCES = ["light", "dark", "system"] as const;

export type ThemePreference = (typeof THEME_PREFERENCES)[number];

export function parseThemePreference(value: string | null | undefined) {
  return THEME_PREFERENCES.includes(value as ThemePreference)
    ? (value as ThemePreference)
    : "system";
}

export function explicitThemeClass(preference: ThemePreference) {
  return preference === "system" ? undefined : preference;
}
