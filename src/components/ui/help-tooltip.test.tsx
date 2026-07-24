import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { HelpTooltip } from "./help-tooltip";

afterEach(cleanup);

describe("HelpTooltip", () => {
  it("provides an accessible trigger and opens on keyboard focus", () => {
    render(
      <HelpTooltip label="Cost basis">
        The original purchase price.
      </HelpTooltip>,
    );

    const trigger = screen.getByRole("button", {
      name: "Help: Cost basis",
    });
    expect(trigger).toHaveAttribute("type", "button");
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    fireEvent.focus(trigger);

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("tooltip")).toHaveTextContent(
      "The original purchase price.",
    );
    expect(trigger).toHaveAttribute(
      "aria-describedby",
      screen.getByRole("tooltip").id,
    );
  });

  it("opens on hover and closes with Escape", () => {
    render(
      <HelpTooltip label="Freshness status">
        Current means updated within seven days.
      </HelpTooltip>,
    );

    const trigger = screen.getByRole("button", {
      name: "Help: Freshness status",
    });
    fireEvent.mouseEnter(trigger.parentElement!);
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
    fireEvent.mouseLeave(trigger.parentElement!);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    trigger.focus();
    expect(trigger).toHaveFocus();
    fireEvent.keyDown(trigger, { key: "Escape" });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("opens from a touch-compatible click without submitting a form", () => {
    render(
      <form>
        <HelpTooltip label="Manual source">
          Maintained by the owner.
        </HelpTooltip>
      </form>,
    );

    const trigger = screen.getByRole("button", {
      name: "Help: Manual source",
    });
    fireEvent.click(trigger);

    expect(screen.getByRole("tooltip")).toHaveTextContent(
      "Maintained by the owner.",
    );
    expect(trigger).toHaveAttribute("type", "button");
  });
});
