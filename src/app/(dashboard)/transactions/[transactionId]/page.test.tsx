import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  getDetail: vi.fn(),
  getCategories: vi.fn(),
  getRefundCandidates: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("@/lib/auth", () => ({ requireUser: mocks.requireUser }));
vi.mock("@/lib/transactions/queries", () => ({
  getTransactionDetail: mocks.getDetail,
  getTransactionCategoryOptions: mocks.getCategories,
  getRefundLinkCandidates: mocks.getRefundCandidates,
}));
vi.mock("@/components/transactions/transaction-detail", () => ({
  TransactionDetail: () => null,
}));

import TransactionDetailPage from "./page";

describe("TransactionDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ id: "owner-1" });
    mocks.getCategories.mockResolvedValue([]);
    mocks.getRefundCandidates.mockResolvedValue([]);
  });

  it("looks up detail and category options only for the authenticated owner", async () => {
    mocks.getDetail.mockResolvedValue({ id: "transaction-1" });
    await TransactionDetailPage({
      params: Promise.resolve({ transactionId: "transaction-1" }),
    });
    expect(mocks.requireUser).toHaveBeenCalledOnce();
    expect(mocks.getDetail).toHaveBeenCalledWith("owner-1", "transaction-1");
    expect(mocks.getCategories).toHaveBeenCalledWith("owner-1");
    expect(mocks.getRefundCandidates).toHaveBeenCalledWith(
      "owner-1",
      "transaction-1",
    );
  });

  it("uses the same not-found behavior for missing or unauthorized IDs", async () => {
    mocks.getDetail.mockResolvedValue(null);
    await expect(
      TransactionDetailPage({
        params: Promise.resolve({ transactionId: "unknown" }),
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
