import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  }),
  revalidatePath: vi.fn(),
  requireUser: vi.fn(),
  updateOverride: vi.fn(),
  detect: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/auth", () => ({ requireUser: mocks.requireUser }));
vi.mock("@/lib/transactions/mutations", () => ({
  updateTransactionOverride: mocks.updateOverride,
}));
vi.mock("@/lib/recurring", () => ({ runRecurringDetection: mocks.detect }));

import { updateTransactionOverrideAction } from "./transactions";

function form(intent: "save" | "clear" = "save") {
  const data = new FormData();
  data.set("transactionId", "transaction-1");
  data.set("returnTo", "/transactions/transaction-1");
  data.set("categoryOverride", "Dining");
  data.set("financialRoleOverride", "EXPENSE");
  data.set("notes", "Owner note");
  data.set("excludedFromReports", "true");
  data.set("intent", intent);
  return data;
}

describe("transaction override action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ id: "owner-1" });
    mocks.updateOverride.mockResolvedValue({ id: "override-1" });
    mocks.detect.mockResolvedValue({});
  });

  it("uses the authenticated owner, refreshes projections, and returns safe feedback", async () => {
    await expect(updateTransactionOverrideAction(form())).rejects.toThrow(
      "NEXT_REDIRECT:/transactions/transaction-1?message=Transaction+override+saved.",
    );
    expect(mocks.requireUser).toHaveBeenCalledWith({ activity: "meaningful" });
    expect(mocks.updateOverride).toHaveBeenCalledWith(
      "owner-1",
      "transaction-1",
      {
        categoryOverride: "Dining",
        financialRoleOverride: "EXPENSE",
        notes: "Owner note",
        excludedFromReports: true,
      },
    );
    expect(mocks.detect).toHaveBeenCalledWith("owner-1");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/transactions");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/overview");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/calendar");
  });

  it("clears only editable override values", async () => {
    await expect(
      updateTransactionOverrideAction(form("clear")),
    ).rejects.toThrow(/Editable\+transaction\+overrides\+cleared/);
    expect(mocks.updateOverride).toHaveBeenCalledWith(
      "owner-1",
      "transaction-1",
      {
        categoryOverride: null,
        financialRoleOverride: null,
        notes: null,
        excludedFromReports: false,
      },
    );
  });

  it("rejects malformed roles before authentication and prevents open redirects", async () => {
    const data = form();
    data.set("financialRoleOverride", "ADMIN");
    data.set("returnTo", "https://evil.example/steal");
    await expect(updateTransactionOverrideAction(data)).rejects.toThrow(
      "NEXT_REDIRECT:/transactions?error=",
    );
    expect(mocks.requireUser).not.toHaveBeenCalled();
    expect(mocks.updateOverride).not.toHaveBeenCalled();
  });

  it("cannot mutate after session validation rejects the request", async () => {
    mocks.requireUser.mockRejectedValue(
      new Error("NEXT_REDIRECT:/login?reason=expired"),
    );
    await expect(updateTransactionOverrideAction(form())).rejects.toThrow(
      "NEXT_REDIRECT:/login?reason=expired",
    );
    expect(mocks.updateOverride).not.toHaveBeenCalled();
  });

  it("returns generic mutation failures and keeps a saved correction when projection refresh fails", async () => {
    mocks.updateOverride.mockRejectedValueOnce(
      new Error("private database error"),
    );
    await expect(updateTransactionOverrideAction(form())).rejects.toThrow(
      /could\+not\+be\+saved/i,
    );
    expect(mocks.redirect).toHaveBeenCalledWith(
      expect.not.stringContaining("private+database+error"),
    );

    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ id: "owner-1" });
    mocks.updateOverride.mockResolvedValue({ id: "override-1" });
    mocks.detect.mockRejectedValue(new Error("recoverable projection failure"));
    await expect(updateTransactionOverrideAction(form())).rejects.toThrow(
      /message=Transaction\+override\+saved/,
    );
  });
});
