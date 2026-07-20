import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Personal Finance", template: "%s | Personal Finance" },
  description: "A private, single-owner personal finance dashboard.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
