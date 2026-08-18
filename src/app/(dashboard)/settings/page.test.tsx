import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "@/components/theme/theme-provider";

vi.mock("@/lib/session-policy", () => ({
  sessionPolicy: {
    absoluteTimeoutMs: 180_000,
    idleTimeoutMs: 60_000,
    warningThresholdMs: 30_000,
  },
}));

import SettingsPage from "./page";

describe("SettingsPage", () => {
  it("describes session limits with readable sub-minute durations", () => {
    render(
      <ThemeProvider initialPreference="system">
        <SettingsPage />
      </ThemeProvider>,
    );

    expect(
      screen.getByText(/an inactive session ends after 1 minute/i),
    ).toHaveTextContent("A warning appears 30 seconds before");
    expect(
      screen.getByText(/Choosing “Stay signed in” renews only/i),
    ).toHaveTextContent("A session always ends after 3 minutes");
    expect(screen.queryByText(/0\.5 minutes/i)).not.toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /System/ })).toBeChecked();
  });
});
