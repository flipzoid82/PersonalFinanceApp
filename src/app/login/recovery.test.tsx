import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getCurrentUser: mocks.getCurrentUser,
}));
vi.mock("@/components/login-form", () => ({
  LoginForm: () => <form aria-label="Sign in form" />,
}));

import ForgotPasswordPage from "../forgot-password/page";
import LoginPage from "./page";

describe("password recovery messaging", () => {
  it("links signed-out owners to the recovery status page", async () => {
    mocks.getCurrentUser.mockResolvedValue(null);
    render(await LoginPage());

    expect(
      screen.getByRole("link", { name: "Forgot password?" }),
    ).toHaveAttribute("href", "/forgot-password");
  });

  it("shows a generic security message only for timeout redirects", async () => {
    mocks.getCurrentUser.mockResolvedValue(null);
    const { unmount } = render(
      await LoginPage({
        searchParams: Promise.resolve({ reason: "expired" }),
      }),
    );
    expect(
      screen.getByText(
        "Your session expired for your security. Please sign in again.",
      ),
    ).toBeInTheDocument();

    unmount();
    render(
      await LoginPage({
        searchParams: Promise.resolve({ reason: "logout" }),
      }),
    );
    expect(screen.queryByText(/session expired/i)).not.toBeInTheDocument();
  });

  it("honestly reports that recovery is unavailable without collecting secrets", () => {
    render(<ForgotPasswordPage />);

    expect(
      screen.getByRole("heading", {
        name: "Password recovery is not configured",
      }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByText(/security question/i)).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Back to sign in" }),
    ).toHaveAttribute("href", "/login");
  });
});
