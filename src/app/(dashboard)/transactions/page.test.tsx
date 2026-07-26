import { beforeEach, describe, expect, it, vi } from "vitest";
import { currentAccountWhere } from "@/lib/accounts/current";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  requireUser: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireUser: mocks.requireUser,
}));

vi.mock("@/lib/db", () => ({
  db: {
    transaction: {
      findMany: mocks.findMany,
    },
  },
}));

import TransactionsPage from "./page";

describe("TransactionsPage", () => {
  beforeEach(() => {
    mocks.findMany.mockReset().mockResolvedValue([]);
    mocks.requireUser.mockReset().mockResolvedValue({ id: "owner-1" });
  });

  it("excludes transactions owned only by disconnected Plaid history", async () => {
    await TransactionsPage();

    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: "owner-1",
          account: currentAccountWhere("owner-1"),
        },
      }),
    );
  });
});
