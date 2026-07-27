import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

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

    render(await DashboardLayout({ children: <p>Protected content</p> }));

    expect(screen.getByRole("button", { name: "Sign out" })).toHaveAttribute(
      "type",
      "button",
    );
    expect(screen.getByTestId("session-controller")).toBeInTheDocument();
    expect(mocks.requireUser).toHaveBeenCalledOnce();
  });

  it("does not render protected children when session validation redirects", async () => {
    mocks.requireUser.mockRejectedValue(new Error("NEXT_REDIRECT"));

    await expect(
      DashboardLayout({ children: <p>Protected content</p> }),
    ).rejects.toThrow("NEXT_REDIRECT");
  });
});
