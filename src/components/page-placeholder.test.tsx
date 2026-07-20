import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PagePlaceholder } from "./page-placeholder";

describe("PagePlaceholder", () => {
  it("renders an accessible page heading and milestone empty state", () => {
    render(
      <PagePlaceholder title="Accounts" description="Account description" />,
    );
    expect(
      screen.getByRole("heading", { level: 1, name: "Accounts" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Coming in a later milestone")).toBeInTheDocument();
  });
});
