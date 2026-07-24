import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DeleteConfirmationDialog } from "./delete-confirmation-dialog";

afterEach(cleanup);

describe("DeleteConfirmationDialog", () => {
  it("does not delete on the first click and submits only the final action", async () => {
    const deleteAction = vi.fn(async () => undefined);

    render(
      <DeleteConfirmationDialog
        recordName="Primary Residence"
        recordType="manual asset"
        triggerLabel="Delete asset"
        deleteAction={deleteAction}
        deleteFields={[{ name: "assetId", value: "asset-1" }]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Delete asset" }));

    expect(deleteAction).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toHaveAccessibleName(
      "Permanently delete Primary Residence?",
    );
    expect(
      screen.getByText(/deletion is permanent and cannot be undone/i),
    ).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Delete permanently" }));

    await waitFor(() => expect(deleteAction).toHaveBeenCalledOnce());
  });

  it("offers cancellation and deactivation without invoking deletion", async () => {
    const deleteAction = vi.fn(async () => undefined);
    const deactivateAction = vi.fn(async () => undefined);

    render(
      <DeleteConfirmationDialog
        recordName="Everyday Checking"
        recordType="manual account"
        triggerLabel="Delete account"
        deleteAction={deleteAction}
        deleteFields={[{ name: "accountId", value: "account-1" }]}
        deactivateAction={deactivateAction}
        deactivateFields={[{ name: "accountId", value: "account-1" }]}
        dependencyWarning="Dependent history blocks deletion."
      />,
    );

    const trigger = screen.getByRole("button", { name: "Delete account" });
    fireEvent.click(trigger);
    expect(
      screen.getByText("Dependent history blocks deletion."),
    ).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(deleteAction).not.toHaveBeenCalled();

    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("button", { name: "Deactivate instead" }));

    await waitFor(() => expect(deactivateAction).toHaveBeenCalledOnce());
    expect(deleteAction).not.toHaveBeenCalled();
  });

  it("traps keyboard focus and closes with Escape", () => {
    render(
      <DeleteConfirmationDialog
        recordName="Mortgage"
        recordType="debt"
        triggerLabel="Delete debt"
        deleteAction={vi.fn()}
        deleteFields={[{ name: "assetId", value: "debt-1" }]}
      />,
    );

    const trigger = screen.getByRole("button", { name: "Delete debt" });
    fireEvent.click(trigger);

    const cancel = screen.getByRole("button", { name: "Cancel" });
    const confirm = screen.getByRole("button", {
      name: "Delete permanently",
    });
    expect(cancel).toHaveFocus();

    confirm.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(cancel).toHaveFocus();

    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(confirm).toHaveFocus();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
