import { Prisma, TransactionStatus } from "@prisma/client";

export type TransactionSearchParams = Record<
  string,
  string | string[] | undefined
>;

export const TRANSACTION_SORT_KEYS = ["date", "transaction", "amount"] as const;
export type TransactionSortKey = (typeof TRANSACTION_SORT_KEYS)[number];
export type TransactionSortDirection = "asc" | "desc";

export type TransactionFilters = {
  search: string;
  dateFrom: string;
  dateTo: string;
  accountId: string;
  category: string;
  amountMin: string;
  amountMax: string;
  status: TransactionStatus | "";
  sort: TransactionSortKey;
  direction: TransactionSortDirection;
  page: number;
};

function single(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function bounded(value: string | string[] | undefined, maximum: number) {
  return single(value).trim().slice(0, maximum);
}

function dateValue(value: string | string[] | undefined) {
  const candidate = bounded(value, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(candidate)) return "";
  const parsed = new Date(`${candidate}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === candidate
    ? candidate
    : "";
}

function amountValue(value: string | string[] | undefined) {
  const candidate = bounded(value, 24);
  return /^\d{1,15}(?:\.\d{1,4})?$/.test(candidate) ? candidate : "";
}

export function parseTransactionFilters(
  params: TransactionSearchParams,
): TransactionFilters {
  const statusCandidate = bounded(params.status, 32);
  const pageCandidate = Number.parseInt(single(params.page), 10);
  const amountMin = amountValue(params.amountMin);
  const amountMax = amountValue(params.amountMax);
  const sortCandidate = bounded(params.sort, 24);
  const directionCandidate = bounded(params.direction, 8);
  return {
    search: bounded(params.search, 120),
    dateFrom: dateValue(params.dateFrom),
    dateTo: dateValue(params.dateTo),
    accountId: bounded(params.accountId, 128),
    category: bounded(params.category, 120),
    amountMin,
    amountMax:
      amountMin &&
      amountMax &&
      new Prisma.Decimal(amountMax).lessThan(new Prisma.Decimal(amountMin))
        ? ""
        : amountMax,
    status: Object.values(TransactionStatus).includes(
      statusCandidate as TransactionStatus,
    )
      ? (statusCandidate as TransactionStatus)
      : "",
    sort: TRANSACTION_SORT_KEYS.includes(sortCandidate as TransactionSortKey)
      ? (sortCandidate as TransactionSortKey)
      : "date",
    direction:
      directionCandidate === "asc" || directionCandidate === "desc"
        ? directionCandidate
        : "desc",
    page:
      Number.isSafeInteger(pageCandidate) && pageCandidate > 0
        ? pageCandidate
        : 1,
  };
}

export function transactionFilterQuery(filters: TransactionFilters) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (key !== "page" && value) query.set(key, String(value));
  }
  return query;
}

export function transactionSortQuery(
  filters: TransactionFilters,
  sort: TransactionSortKey,
) {
  const query = transactionFilterQuery(filters);
  query.set("sort", sort);
  query.set(
    "direction",
    filters.sort === sort && filters.direction === "asc" ? "desc" : "asc",
  );
  return query;
}
