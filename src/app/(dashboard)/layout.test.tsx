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

import DashboardLayout from "./layout";

describe("authenticated dashboard layout", () => {
  it("wires Sign out as a form submit control", async () => {
    mocks.requireUser.mockResolvedValue({
      id: "owner-id",
      email: "owner@example.test",
      displayName: "Synthetic Owner",
    });

    render(await DashboardLayout({ children: <p>Protected content</p> }));

    expect(screen.getByRole("button", { name: "Sign out" })).toHaveAttribute(
      "type",
      "submit",
    );
    expect(mocks.requireUser).toHaveBeenCalledOnce();
  });
});
