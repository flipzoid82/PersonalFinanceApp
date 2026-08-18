"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { THEME_COOKIE_NAME, type ThemePreference } from "@/lib/theme";

type ThemeContextValue = {
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyTheme(preference: ThemePreference) {
  const root = document.documentElement;
  root.classList.toggle("light", preference === "light");
  root.classList.toggle("dark", preference === "dark");
  document.cookie = `${THEME_COOKIE_NAME}=${preference}; Max-Age=31536000; Path=/; SameSite=Lax`;
}

export function ThemeProvider({
  initialPreference,
  children,
}: {
  initialPreference: ThemePreference;
  children: React.ReactNode;
}) {
  const [preference, setPreferenceState] = useState(initialPreference);
  const setPreference = useCallback((next: ThemePreference) => {
    applyTheme(next);
    setPreferenceState(next);
  }, []);
  const value = useMemo(
    () => ({ preference, setPreference }),
    [preference, setPreference],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useThemePreference() {
  const context = useContext(ThemeContext);
  if (!context)
    throw new Error("useThemePreference must be used inside ThemeProvider.");
  return context;
}
