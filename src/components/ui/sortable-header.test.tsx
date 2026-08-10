import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SortableHeader } from "./sortable-header";

describe("SortableHeader", () => {
  it("exposes direction through text and table semantics", () => {
    render(
      <table>
        <thead>
          <tr>
            <SortableHeader
              label="Amount"
              href="/transactions?sort=amount&direction=desc"
              active
              direction="asc"
            />
          </tr>
        </thead>
      </table>,
    );

    expect(screen.getByRole("columnheader")).toHaveAttribute(
      "aria-sort",
      "ascending",
    );
    expect(
      screen.getByRole("link", { name: "Sort by Amount, descending" }),
    ).toHaveAttribute("href", "/transactions?sort=amount&direction=desc");
    expect(screen.getByText("↑")).toHaveAttribute("aria-hidden", "true");
  });
});
