import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SemanticBadge, SemanticValue, semanticToneClasses } from "./semantic";

describe("semantic financial variants", () => {
  it.each([
    ["positive", "--semantic-positive"],
    ["negative", "--semantic-negative"],
    ["warning", "--semantic-warning"],
    ["info", "--semantic-info"],
    ["investment", "--semantic-investment"],
    ["muted", "--semantic-muted"],
  ] as const)("uses centralized %s theme variables", (tone, variable) => {
    expect(semanticToneClasses[tone]).toContain(variable);
  });

  it("pairs semantic styling with visible non-color labels and signs", () => {
    render(
      <div>
        <SemanticBadge tone="warning">
          Stale · updated 10 days ago
        </SemanticBadge>
        <SemanticValue tone="negative" label="Debt amount">
          −$125.00
        </SemanticValue>
      </div>,
    );
    expect(screen.getByText("Stale · updated 10 days ago")).toBeInTheDocument();
    expect(screen.getByText("−$125.00")).toBeInTheDocument();
    expect(screen.getByText("Debt amount:")).toHaveClass("sr-only");
  });
});
