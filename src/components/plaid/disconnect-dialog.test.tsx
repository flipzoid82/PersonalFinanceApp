import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  disconnect: vi.fn(async () => undefined),
}));

vi.mock("@/actions/plaid", () => ({
  disconnectPlaidConnectionAction: mocks.disconnect,
}));

import { DisconnectPlaidDialog } from "./disconnect-dialog";

afterEach(() => {
  cleanup();
  mocks.disconnect.mockClear();
});

describe("DisconnectPlaidDialog", () => {
  it("does not disconnect on first click and requires final confirmation", async () => {
    render(
      <DisconnectPlaidDialog
        connectionId="connection-1"
        institutionName="First Platypus Bank"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Disconnect" }));
    expect(mocks.disconnect).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toHaveAccessibleName(
      "Disconnect First Platypus Bank?",
    );
    expect(
      screen.getByText(/does not delete transactions/i),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Disconnect Sandbox" }));
    await waitFor(() => expect(mocks.disconnect).toHaveBeenCalledOnce());
  });

  it("cancels with Escape and restores focus", () => {
    render(
      <DisconnectPlaidDialog
        connectionId="connection-1"
        institutionName="First Platypus Bank"
      />,
    );
    const trigger = screen.getByRole("button", { name: "Disconnect" });
    fireEvent.click(trigger);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(mocks.disconnect).not.toHaveBeenCalled();
  });
});
