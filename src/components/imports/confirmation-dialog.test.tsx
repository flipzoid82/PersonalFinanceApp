import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ImportConfirmationDialog } from "./confirmation-dialog";

describe("ImportConfirmationDialog", () => {
  it("does not act on the first click and exposes a labeled modal", () => {
    const action = vi.fn();
    render(
      <ImportConfirmationDialog
        triggerLabel="Undo import"
        title="Undo synthetic.csv?"
        description="Only records from this import will be removed."
        confirmLabel="Undo import"
        action={action}
        importId="job-1"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Undo import" }));
    expect(action).not.toHaveBeenCalled();
    expect(
      screen.getByRole("dialog", { name: "Undo synthetic.csv?" }),
    ).toBeVisible();
    expect(
      screen.getByText("Only records from this import will be removed."),
    ).toBeVisible();
  });

  it("closes with Escape and restores focus", () => {
    render(
      <ImportConfirmationDialog
        triggerLabel="Delete source now"
        title="Delete retained source?"
        description="Financial records remain."
        confirmLabel="Delete source permanently"
        action={vi.fn()}
        importId="job-1"
      />,
    );
    const trigger = screen.getByRole("button", { name: "Delete source now" });
    fireEvent.click(trigger);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
