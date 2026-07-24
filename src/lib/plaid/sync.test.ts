// @vitest-environment node

import { describe, expect, it, vi } from "vitest";
import type { Transaction } from "plaid";
import type { PlaidClient } from "./client";
import { collectTransactionChanges } from "./sync";

function transaction(id: string) {
  return { transaction_id: id } as Transaction;
}

describe("Plaid transaction pagination", () => {
  it("collects added, modified, and removed records across every page", async () => {
    const transactionsSync = vi
      .fn()
      .mockResolvedValueOnce({
        data: {
          added: [transaction("added-1")],
          modified: [],
          removed: [],
          next_cursor: "page-1",
          has_more: true,
        },
      })
      .mockResolvedValueOnce({
        data: {
          added: [],
          modified: [transaction("modified-1")],
          removed: [{ transaction_id: "removed-1" }],
          next_cursor: "complete",
          has_more: false,
        },
      });

    const result = await collectTransactionChanges(
      "server-only-token",
      "original",
      { transactionsSync } as unknown as PlaidClient,
    );

    expect(result.nextCursor).toBe("complete");
    expect(result.added.map(({ transaction_id }) => transaction_id)).toEqual([
      "added-1",
    ]);
    expect(result.modified.map(({ transaction_id }) => transaction_id)).toEqual(
      ["modified-1"],
    );
    expect(result.removed).toEqual([{ transaction_id: "removed-1" }]);
    expect(transactionsSync).toHaveBeenNthCalledWith(1, {
      access_token: "server-only-token",
      cursor: "original",
    });
    expect(transactionsSync).toHaveBeenNthCalledWith(2, {
      access_token: "server-only-token",
      cursor: "page-1",
    });
  });

  it("restarts from the original cursor after a pagination mutation", async () => {
    const mutation = {
      response: {
        data: {
          error_code: "TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION",
          request_id: "safe-request",
        },
      },
    };
    const transactionsSync = vi
      .fn()
      .mockResolvedValueOnce({
        data: {
          added: [transaction("discarded")],
          modified: [],
          removed: [],
          next_cursor: "mutated-page",
          has_more: true,
        },
      })
      .mockRejectedValueOnce(mutation)
      .mockResolvedValueOnce({
        data: {
          added: [transaction("kept")],
          modified: [],
          removed: [],
          next_cursor: "complete",
          has_more: false,
        },
      });

    const result = await collectTransactionChanges(
      "server-only-token",
      "original",
      { transactionsSync } as unknown as PlaidClient,
    );

    expect(result.added.map(({ transaction_id }) => transaction_id)).toEqual([
      "kept",
    ]);
    expect(transactionsSync).toHaveBeenNthCalledWith(3, {
      access_token: "server-only-token",
      cursor: "original",
    });
  });
});
