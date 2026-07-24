import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/actions/portfolio", () => ({
  createManualAssetAction: vi.fn(),
  deactivateManualAssetAction: vi.fn(),
  deleteManualAssetAction: vi.fn(),
  updateManualAssetAction: vi.fn(),
}));

import { CreateManualAssetForm } from "./manual-asset-list";

describe("manual asset help", () => {
  it("keeps field requirements visible and exposes named help triggers", () => {
    render(<CreateManualAssetForm />);

    expect(screen.getByLabelText("Asset or debt type")).toHaveAccessibleName(
      "Asset or debt type",
    );
    expect(
      screen.getByLabelText("Current value or amount owed"),
    ).toBeRequired();
    expect(screen.getByLabelText("Cost basis (optional)")).not.toBeRequired();
    expect(
      screen.getByLabelText("Acquired date (optional)"),
    ).not.toBeRequired();

    for (const name of [
      "Help: Asset or debt type",
      "Help: Current value or amount owed",
      "Help: Cost basis",
      "Help: Acquired date",
    ]) {
      expect(screen.getByRole("button", { name })).toHaveAttribute(
        "type",
        "button",
      );
    }
  });
});
