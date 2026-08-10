import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  getTransactionLedger: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireUser: mocks.requireUser }));
vi.mock("@/lib/transactions/queries", () => ({
  getTransactionLedger: mocks.getTransactionLedger,
}));

import TransactionsPage from "./page";

describe("TransactionsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ id: "owner-1" });
    mocks.getTransactionLedger.mockResolvedValue({ transactions: [] });
  });

  it("requires the authenticated owner and forwards URL filters", async () => {
    const searchParams = Promise.resolve({
      search: "coffee",
      status: "POSTED",
    });
    await TransactionsPage({ searchParams });

    expect(mocks.requireUser).toHaveBeenCalledOnce();
    expect(mocks.getTransactionLedger).toHaveBeenCalledWith("owner-1", {
      search: "coffee",
      status: "POSTED",
    });
  });
});
