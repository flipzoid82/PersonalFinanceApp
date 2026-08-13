import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PortfolioFeedback } from "./feedback";

afterEach(cleanup);

describe("PortfolioFeedback", () => {
  it("preserves status and alert semantics through the shared notice", () => {
    const { rerender } = render(<PortfolioFeedback message="Account saved." />);
    expect(screen.getByRole("status")).toHaveTextContent("Account saved.");
    expect(screen.getByRole("status")).toHaveClass(
      "bg-[var(--semantic-positive-bg)]",
    );

    rerender(<PortfolioFeedback error="Account update failed." />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Account update failed.",
    );
    expect(screen.getByRole("alert")).toHaveClass(
      "bg-[var(--semantic-negative-bg)]",
    );
  });
});
