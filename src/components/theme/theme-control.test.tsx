import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ThemeControl } from "./theme-control";
import { ThemeProvider } from "./theme-provider";

afterEach(() => {
  cleanup();
  document.documentElement.className = "";
  document.cookie = "finance-theme=; Max-Age=0; Path=/";
});

describe("ThemeControl", () => {
  it("switches Light to Dark with a moon action and synchronizes Settings", () => {
    document.documentElement.className = "light";
    const { container } = render(
      <ThemeProvider initialPreference="light">
        <ThemeControl />
        <ThemeControl variant="settings" />
      </ThemeProvider>,
    );

    const button = screen.getByRole("button", {
      name: "Switch to Dark theme.",
    });
    expect(container.querySelector(".lucide-moon")).toBeInTheDocument();
    fireEvent.click(button);

    expect(
      screen.getByRole("button", { name: "Switch to Light theme." }),
    ).toBeInTheDocument();
    expect(container.querySelector(".lucide-sun")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Dark/ })).toBeChecked();
    expect(document.documentElement).toHaveClass("dark");
    expect(document.documentElement).not.toHaveClass("light");
    expect(document.cookie).toContain("finance-theme=dark");
  });

  it("switches Dark to Light with a sun action and persists the choice", () => {
    document.documentElement.className = "dark";
    const { container } = render(
      <ThemeProvider initialPreference="dark">
        <ThemeControl />
        <ThemeControl variant="settings" />
      </ThemeProvider>,
    );

    expect(container.querySelector(".lucide-sun")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Dark/ })).toBeChecked();
    fireEvent.click(
      screen.getByRole("button", { name: "Switch to Light theme." }),
    );
    expect(document.documentElement).toHaveClass("light");
    expect(document.documentElement).not.toHaveClass("dark");
    expect(document.cookie).toContain("finance-theme=light");
    expect(screen.getByRole("radio", { name: /Light/ })).toBeChecked();
  });

  it("makes System explicit and keeps all three choices in Settings", () => {
    const { container } = render(
      <ThemeProvider initialPreference="system">
        <ThemeControl />
        <ThemeControl variant="settings" />
      </ThemeProvider>,
    );

    const systemButton = screen.getByRole("button", {
      name: "System theme active. Activate to switch to Dark theme.",
    });
    expect(systemButton).toHaveTextContent("System");
    expect(systemButton).toHaveAttribute("data-theme-preference", "system");
    expect(container.querySelector(".lucide-monitor-cog")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /System/ })).toBeChecked();

    for (const label of ["Light", "Dark", "System"])
      expect(
        screen.getByRole("radio", { name: new RegExp(label) }),
      ).toBeVisible();

    fireEvent.click(systemButton);
    expect(screen.getByRole("radio", { name: /Dark/ })).toBeChecked();
    expect(document.cookie).toContain("finance-theme=dark");

    fireEvent.click(screen.getByRole("radio", { name: /System/ }));
    expect(
      screen.getByRole("button", {
        name: "System theme active. Activate to switch to Dark theme.",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /System/ })).toBeChecked();
    expect(document.documentElement).not.toHaveClass("light", "dark");
    expect(document.cookie).toContain("finance-theme=system");
  });
});
