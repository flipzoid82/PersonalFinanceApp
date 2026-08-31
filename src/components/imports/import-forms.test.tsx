import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CsvMappingForm, ImportUploadForm } from "./import-forms";

vi.mock("@/actions/imports", () => ({
  mapCsvImportAction: vi.fn(),
  resolveImportAccountAction: vi.fn(),
  uploadImportAction: vi.fn(),
}));

afterEach(cleanup);

describe("import forms", () => {
  it("starts with a file choice and explains automatic detection and retention", () => {
    render(<ImportUploadForm configured />);
    expect(
      screen.queryByLabelText("What are you importing?"),
    ).not.toBeInTheDocument();
    const fileInput = screen.getByLabelText("Choose a statement or CSV");
    expect(fileInput).toBeEnabled();
    expect(fileInput).toHaveAttribute(
      "accept",
      expect.stringContaining(".pdf"),
    );
    expect(
      screen.getByRole("button", { name: "Upload and review" }),
    ).toBeEnabled();
    expect(
      screen.getByText(/encrypted original is retained for 30 days/i),
    ).toBeVisible();
    expect(screen.getByText(/identify the file type for you/i)).toBeVisible();
  });

  it("offers only plausible CSV choices after ambiguous detection", () => {
    render(<ImportUploadForm configured fallback="csv" />);
    const choice = screen.getByLabelText("Choose the closest match");
    expect(choice).toHaveTextContent("Generic balance snapshots CSV");
    expect(choice).toHaveTextContent("Generic investment holdings CSV");
    expect(choice).not.toHaveTextContent("Fidelity");
    expect(choice).toBeRequired();
  });

  it("replaces mysteriously disabled controls with a safe configuration-required state", () => {
    render(<ImportUploadForm configured={false} />);
    expect(
      screen.getByText(/encrypted import storage is unavailable/i),
    ).toBeVisible();
    expect(
      screen.getByText(/local developers should restart with pnpm dev:start/i),
    ).toBeVisible();
    expect(
      screen.queryByLabelText("What are you importing?"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText("Choose a statement or CSV"),
    ).not.toBeInTheDocument();
  });

  it("provides programmatic labels for required and optional CSV mappings", () => {
    render(
      <CsvMappingForm
        importId="job-1"
        importType="GENERIC_INVESTMENT_HOLDINGS_CSV"
        headers={["Account", "Date", "Security", "Value", "Currency"]}
        detected={{
          account: "Account",
          asOfDate: "Date",
          securityName: "Security",
          value: "Value",
          currency: "Currency",
        }}
      />,
    );
    expect(screen.getByLabelText("Account")).toHaveValue("Account");
    expect(screen.getByLabelText("Account").className).toContain(
      "[&>option]:bg-[var(--surface-panel)]",
    );
    expect(screen.getByLabelText("Holding name column")).toHaveValue(
      "Security",
    );
    expect(screen.getAllByText("Holding name column")).toHaveLength(1);
    expect(screen.getByLabelText("Cost basis")).toHaveValue("");
    expect(
      screen.getByLabelText("Currency when no column is mapped"),
    ).toHaveAccessibleDescription(/never guessed row by row/i);
  });
});
