import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "@/components/theme/theme-provider";

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireUser: mocks.requireUser }));
vi.mock("@/actions/auth", () => ({ logout: vi.fn() }));
vi.mock("@/components/navigation", () => ({
  DesktopNavigation: () => null,
  MobileNavigation: () => null,
}));
vi.mock("@/components/session/session-security-controller", () => ({
  SessionSecurityController: () => <div data-testid="session-controller" />,
}));
vi.mock("@/components/session/session-sign-out-button", () => ({
  SessionSignOutButton: () => <button type="button">Sign out</button>,
}));

import DashboardLayout from "./layout";

describe("authenticated dashboard layout", () => {
  it("wires the cross-tab-aware Sign out control and timeout controller", async () => {
    mocks.requireUser.mockResolvedValue({
      id: "owner-id",
      email: "owner@example.test",
      displayName: "Synthetic Owner",
    });

    const { container } = render(
      <ThemeProvider initialPreference="system">
        {await DashboardLayout({ children: <p>Protected content</p> })}
      </ThemeProvider>,
    );

    expect(screen.getByRole("button", { name: "Sign out" })).toHaveAttribute(
      "type",
      "button",
    );
    expect(screen.getByTestId("session-controller")).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "System theme active. Activate to switch to Dark theme.",
      }),
    ).toHaveAttribute("data-theme-preference", "system");
    expect(container.querySelector("header")).toHaveClass(
      "grid-cols-[auto_1fr_auto]",
    );
    expect(screen.getByText("Signed in as Synthetic Owner")).toHaveClass(
      "justify-self-start",
    );
    expect(
      screen.getByRole("button", { name: "Sign out" }).parentElement,
    ).toHaveClass("justify-self-end");
    expect(mocks.requireUser).toHaveBeenCalledOnce();
  });

  it("does not render protected children when session validation redirects", async () => {
    mocks.requireUser.mockRejectedValue(new Error("NEXT_REDIRECT"));

    await expect(
      DashboardLayout({ children: <p>Protected content</p> }),
    ).rejects.toThrow("NEXT_REDIRECT");
  });
});
