import "server-only";

import { ConnectionStatus, Prisma, TransactionStatus } from "@prisma/client";
import { currentAccountWhere } from "@/lib/accounts/current";
import { db } from "@/lib/db";
import { effectiveTransactionValues } from "./effective";
import {
  parseTransactionFilters,
  type TransactionFilters,
  type TransactionSearchParams,
} from "./filters";

export const TRANSACTIONS_PER_PAGE = 50;

const ledgerSelect = {
  id: true,
  originalName: true,
  merchantName: true,
  amount: true,
  currency: true,
  authorizedAt: true,
  postedAt: true,
  status: true,
  providerCategory: true,
  removedAt: true,
  createdAt: true,
  account: {
    select: {
      id: true,
      name: true,
      institutionName: true,
      source: true,
      isActive: true,
      dataSource: {
        select: {
          displayName: true,
          status: true,
          lastUpdatedAt: true,
        },
      },
      institutionConnection: {
        select: {
          provider: true,
          status: true,
          lastSuccessfulSyncAt: true,
        },
      },
    },
  },
  override: {
    select: {
      merchantNameOverride: true,
      categoryOverride: true,
      financialRoleOverride: true,
      notes: true,
      excludedFromReports: true,
      linkedTransactionId: true,
    },
  },
} satisfies Prisma.TransactionSelect;

export type LedgerTransaction = Prisma.TransactionGetPayload<{
  select: typeof ledgerSelect;
}>;

function effectiveDateWhere(dateFrom: string, dateTo: string) {
  if (!dateFrom && !dateTo) return undefined;
  const range: Prisma.DateTimeNullableFilter = {};
  if (dateFrom) range.gte = new Date(`${dateFrom}T00:00:00.000Z`);
  if (dateTo) {
    const exclusiveEnd = new Date(`${dateTo}T00:00:00.000Z`);
    exclusiveEnd.setUTCDate(exclusiveEnd.getUTCDate() + 1);
    range.lt = exclusiveEnd;
  }
  return {
    OR: [{ postedAt: range }, { postedAt: null, authorizedAt: range }],
  } satisfies Prisma.TransactionWhereInput;
}

function absoluteAmountWhere(amountMin: string, amountMax: string) {
  if (!amountMin && !amountMax) return undefined;
  const minimum = amountMin ? new Prisma.Decimal(amountMin) : null;
  const maximum = amountMax ? new Prisma.Decimal(amountMax) : null;
  if (minimum && maximum) {
    return {
      OR: [
        { amount: { gte: minimum, lte: maximum } },
        { amount: { gte: maximum.negated(), lte: minimum.negated() } },
      ],
    } satisfies Prisma.TransactionWhereInput;
  }
  if (minimum)
    return {
      OR: [
        { amount: { gte: minimum } },
        { amount: { lte: minimum.negated() } },
      ],
    } satisfies Prisma.TransactionWhereInput;
  return {
    amount: { gte: maximum!.negated(), lte: maximum! },
  } satisfies Prisma.TransactionWhereInput;
}

function categoryWhere(category: string) {
  if (!category) return undefined;
  const noLocalCategory: Prisma.TransactionWhereInput = {
    OR: [
      { override: { is: null } },
      { override: { is: { categoryOverride: null } } },
    ],
  };
  if (category === "Uncategorized") {
    return {
      AND: [noLocalCategory, { providerCategory: null }],
    } satisfies Prisma.TransactionWhereInput;
  }
  return {
    OR: [
      {
        override: {
          is: { categoryOverride: { equals: category, mode: "insensitive" } },
        },
      },
      {
        AND: [
          noLocalCategory,
          { providerCategory: { equals: category, mode: "insensitive" } },
        ],
      },
    ],
  } satisfies Prisma.TransactionWhereInput;
}

function searchWhere(search: string) {
  if (!search) return undefined;
  return {
    OR: [
      { originalName: { contains: search, mode: "insensitive" } },
      { merchantName: { contains: search, mode: "insensitive" } },
      {
        override: {
          is: {
            merchantNameOverride: { contains: search, mode: "insensitive" },
          },
        },
      },
    ],
  } satisfies Prisma.TransactionWhereInput;
}

function ledgerOrder(filters: TransactionFilters) {
  const direction =
    filters.direction === "asc" ? Prisma.sql`ASC` : Prisma.sql`DESC`;
  switch (filters.sort) {
    case "transaction":
      return Prisma.sql`
        LOWER(COALESCE(NULLIF(BTRIM(o.merchant_name_override), ''), NULLIF(BTRIM(t.merchant_name), ''), t.original_name)) ${direction} NULLS LAST,
        t.created_at DESC,
        t.id DESC`;
    case "amount":
      return Prisma.sql`
        ABS(t.amount) ${direction},
        t.created_at DESC,
        t.id DESC`;
    default:
      return Prisma.sql`
        COALESCE(t.posted_at, t.authorized_at) ${direction} NULLS LAST,
        t.created_at DESC,
        t.id DESC`;
  }
}

async function orderedLedgerIds(
  ownerId: string,
  filters: TransactionFilters,
  selectedAccountId: string,
  page: number,
) {
  const clauses: Prisma.Sql[] = [Prisma.sql`t.user_id = ${ownerId}`];
  if (selectedAccountId)
    clauses.push(Prisma.sql`t.account_id = ${selectedAccountId}`);
  if (filters.status)
    clauses.push(Prisma.sql`t.status::text = ${filters.status}`);
  if (filters.search) {
    clauses.push(Prisma.sql`(
      POSITION(LOWER(${filters.search}) IN LOWER(COALESCE(o.merchant_name_override, ''))) > 0
      OR POSITION(LOWER(${filters.search}) IN LOWER(COALESCE(t.merchant_name, ''))) > 0
      OR POSITION(LOWER(${filters.search}) IN LOWER(t.original_name)) > 0)`);
  }
  if (filters.dateFrom)
    clauses.push(
      Prisma.sql`COALESCE(t.posted_at, t.authorized_at) >= ${new Date(`${filters.dateFrom}T00:00:00.000Z`)}`,
    );
  if (filters.dateTo) {
    const exclusiveEnd = new Date(`${filters.dateTo}T00:00:00.000Z`);
    exclusiveEnd.setUTCDate(exclusiveEnd.getUTCDate() + 1);
    clauses.push(
      Prisma.sql`COALESCE(t.posted_at, t.authorized_at) < ${exclusiveEnd}`,
    );
  }
  if (filters.amountMin)
    clauses.push(Prisma.sql`ABS(t.amount) >= ${filters.amountMin}::numeric`);
  if (filters.amountMax)
    clauses.push(Prisma.sql`ABS(t.amount) <= ${filters.amountMax}::numeric`);
  if (filters.category === "Uncategorized") {
    clauses.push(
      Prisma.sql`o.category_override IS NULL AND t.provider_category IS NULL`,
    );
  } else if (filters.category) {
    clauses.push(
      Prisma.sql`LOWER(COALESCE(o.category_override, t.provider_category)) = LOWER(${filters.category})`,
    );
  }

  return db.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT t.id
    FROM transactions t
    LEFT JOIN transaction_overrides o
      ON o.transaction_id = t.id AND o.user_id = ${ownerId}
    WHERE ${Prisma.join(clauses, " AND ")}
    ORDER BY ${ledgerOrder(filters)}
    LIMIT ${TRANSACTIONS_PER_PAGE}
    OFFSET ${(page - 1) * TRANSACTIONS_PER_PAGE}
  `);
}

export async function getTransactionLedger(
  ownerId: string,
  params: TransactionSearchParams,
) {
  const filters = parseTransactionFilters(params);
  const [accounts, providerCategories, overrideCategories] = await Promise.all([
    db.account.findMany({
      where: currentAccountWhere(ownerId),
      select: { id: true, name: true, institutionName: true },
      orderBy: [{ name: "asc" }, { id: "asc" }],
    }),
    db.transaction.findMany({
      where: { userId: ownerId, providerCategory: { not: null } },
      distinct: ["providerCategory"],
      select: { providerCategory: true },
    }),
    db.transactionOverride.findMany({
      where: { userId: ownerId, categoryOverride: { not: null } },
      distinct: ["categoryOverride"],
      select: { categoryOverride: true },
    }),
  ]);
  const selectedAccountId =
    !filters.accountId || accounts.some(({ id }) => id === filters.accountId)
      ? filters.accountId
      : "__unavailable_account__";
  const selectedAccountUnavailable =
    Boolean(filters.accountId) &&
    selectedAccountId === "__unavailable_account__";
  const clauses: Prisma.TransactionWhereInput[] = [
    searchWhere(filters.search),
    effectiveDateWhere(filters.dateFrom, filters.dateTo),
    absoluteAmountWhere(filters.amountMin, filters.amountMax),
    categoryWhere(filters.category),
  ].filter((value) => value !== undefined);
  const where: Prisma.TransactionWhereInput = {
    userId: ownerId,
    ...(selectedAccountId ? { accountId: selectedAccountId } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(clauses.length ? { AND: clauses } : {}),
  };
  const total = await db.transaction.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / TRANSACTIONS_PER_PAGE));
  const page = Math.min(filters.page, pageCount);
  const orderedIds = await orderedLedgerIds(
    ownerId,
    filters,
    selectedAccountId,
    page,
  );
  const transactions = await db.transaction.findMany({
    where: { id: { in: orderedIds.map(({ id }) => id) }, userId: ownerId },
    select: ledgerSelect,
  });
  const transactionById = new Map(
    transactions.map((transaction) => [transaction.id, transaction]),
  );
  const categories = [
    ...new Set([
      ...providerCategories.flatMap(({ providerCategory }) =>
        providerCategory ? [providerCategory] : [],
      ),
      ...overrideCategories.flatMap(({ categoryOverride }) =>
        categoryOverride ? [categoryOverride] : [],
      ),
      "Uncategorized",
    ]),
  ].sort((a, b) => a.localeCompare(b));

  return {
    accounts,
    categories,
    filters,
    selectedAccountUnavailable,
    page,
    pageCount,
    total,
    transactions: orderedIds.flatMap(({ id }) => {
      const transaction = transactionById.get(id);
      return transaction
        ? [
            {
              ...transaction,
              effective: effectiveTransactionValues(transaction),
              isHistorical:
                !transaction.account.isActive ||
                transaction.account.institutionConnection?.status ===
                  ConnectionStatus.DISCONNECTED,
            },
          ]
        : [];
    }),
  };
}

export async function getTransactionCategoryOptions(ownerId: string) {
  const [provider, local] = await Promise.all([
    db.transaction.findMany({
      where: { userId: ownerId, providerCategory: { not: null } },
      distinct: ["providerCategory"],
      select: { providerCategory: true },
    }),
    db.transactionOverride.findMany({
      where: { userId: ownerId, categoryOverride: { not: null } },
      distinct: ["categoryOverride"],
      select: { categoryOverride: true },
    }),
  ]);
  return [
    ...new Set([
      ...provider.flatMap(({ providerCategory }) =>
        providerCategory ? [providerCategory] : [],
      ),
      ...local.flatMap(({ categoryOverride }) =>
        categoryOverride ? [categoryOverride] : [],
      ),
    ]),
  ].sort((a, b) => a.localeCompare(b));
}

export async function getTransactionDetail(ownerId: string, id: string) {
  if (!id || id.length > 128) return null;
  const transaction = await db.transaction.findFirst({
    where: { id, userId: ownerId },
    select: {
      ...ledgerSelect,
      providerCategoryConfidence: true,
      pendingProviderTransactionId: true,
      pendingTransaction: {
        select: {
          originalName: true,
          merchantName: true,
          status: true,
          authorizedAt: true,
        },
      },
      postedTransactions: {
        select: {
          originalName: true,
          merchantName: true,
          status: true,
          postedAt: true,
        },
        orderBy: { postedAt: "desc" },
        take: 5,
      },
    },
  });
  return transaction
    ? { ...transaction, effective: effectiveTransactionValues(transaction) }
    : null;
}
