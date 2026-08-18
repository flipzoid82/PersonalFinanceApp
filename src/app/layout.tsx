import type { Metadata } from "next";
import { cookies } from "next/headers";
import { ThemeProvider } from "@/components/theme/theme-provider";
import {
  explicitThemeClass,
  parseThemePreference,
  THEME_COOKIE_NAME,
} from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Personal Finance", template: "%s | Personal Finance" },
  description: "A private, single-owner personal finance dashboard.",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const preference = parseThemePreference(
    (await cookies()).get(THEME_COOKIE_NAME)?.value,
  );
  return (
    <html lang="en" className={explicitThemeClass(preference)}>
      <body className="min-h-screen antialiased">
        <ThemeProvider initialPreference={preference}>{children}</ThemeProvider>
      </body>
    </html>
  );
}
