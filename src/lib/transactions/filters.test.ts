import { TransactionStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { parseTransactionFilters, transactionFilterQuery } from "./filters";

describe("transaction filters", () => {
  it("normalizes bounded filters and preserves exact decimal strings", () => {
    const filters = parseTransactionFilters({
      search: "  Coffee Shop  ",
      dateFrom: "2026-07-01",
      dateTo: "2026-07-31",
      amountMin: "10.0100",
      amountMax: "25.9999",
      status: TransactionStatus.POSTED,
      sort: "amount",
      direction: "asc",
      page: "3",
    });

    expect(filters).toMatchObject({
      search: "Coffee Shop",
      dateFrom: "2026-07-01",
      dateTo: "2026-07-31",
      amountMin: "10.0100",
      amountMax: "25.9999",
      status: TransactionStatus.POSTED,
      sort: "amount",
      direction: "asc",
      page: 3,
    });
  });

  it("rejects malformed values and an inverted amount range", () => {
    expect(
      parseTransactionFilters({
        dateFrom: "2026-02-31",
        amountMin: "20.00",
        amountMax: "10.00",
        status: "NOT_A_STATUS",
        sort: "unknown",
        direction: "sideways",
        page: "-2",
      }),
    ).toMatchObject({
      dateFrom: "",
      amountMin: "20.00",
      amountMax: "",
      status: "",
      sort: "date",
      direction: "desc",
      page: 1,
    });
  });

  it("retains filters while omitting pagination from a fresh query", () => {
    const query = transactionFilterQuery(
      parseTransactionFilters({
        search: "rent",
        accountId: "account-1",
        page: "4",
      }),
    );
    expect(query.toString()).toBe(
      "search=rent&accountId=account-1&sort=date&direction=desc",
    );
  });
});
