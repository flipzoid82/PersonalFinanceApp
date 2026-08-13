import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useActionState: () => [
      { error: "The email or password is incorrect." },
      vi.fn(),
      false,
    ],
  };
});

vi.mock("@/actions/auth", () => ({ login: vi.fn() }));

import { LoginForm } from "./login-form";

describe("LoginForm feedback", () => {
  it("renders invalid credentials as a theme-safe error alert", () => {
    render(<LoginForm />);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("The email or password is incorrect.");
    expect(alert).toHaveClass(
      "bg-[var(--semantic-negative-bg)]",
      "text-[var(--semantic-negative-text)]",
    );
    expect(alert).not.toHaveClass("text-red-700");
  });
});
