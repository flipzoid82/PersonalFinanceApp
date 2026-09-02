import "server-only";

import { ConnectionStatus, Prisma, TransactionStatus } from "@prisma/client";
import { currentAccountWhere } from "@/lib/accounts/current";
import { db } from "@/lib/db";
import { effectiveTransactionValues } from "./effective";
import { ensureTransactionTruthReady } from "./truth";
import { suggestMovementRelationships } from "./relationships";
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
      transactionCategoryId: true,
      transactionCategory: { select: { id: true, name: true } },
      financialRoleOverride: true,
      economicDirectionOverride: true,
      reviewedAt: true,
      notes: true,
      excludedFromReports: true,
      linkedTransactionId: true,
    },
  },
  classification: {
    select: {
      financialRole: true,
      transactionCategoryId: true,
      transactionCategory: { select: { id: true, name: true } },
      economicDirection: true,
      roleProvenance: true,
      categoryProvenance: true,
      directionProvenance: true,
      roleCertainty: true,
      categoryCertainty: true,
      directionCertainty: true,
      reviewState: true,
      reasonCodes: true,
      deferredUntil: true,
    },
  },
  allocations: {
    select: {
      id: true,
      transactionCategoryId: true,
      transactionCategory: { select: { id: true, name: true } },
      amount: true,
      displayOrder: true,
      provenance: true,
    },
    orderBy: [{ displayOrder: "asc" as const }, { id: "asc" as const }],
  },
  outgoingRelationships: {
    where: { state: { in: ["SUGGESTED", "NEEDS_REVIEW"] } },
    select: { id: true },
  },
  incomingRelationships: {
    where: { state: { in: ["SUGGESTED", "NEEDS_REVIEW"] } },
    select: { id: true },
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
      {
        override: {
          is: { categoryOverride: null, transactionCategoryId: null },
        },
      },
    ],
  };
  if (category === "Uncategorized") {
    return {
      AND: [
        noLocalCategory,
        {
          OR: [
            { classification: { is: null } },
            { classification: { is: { transactionCategoryId: null } } },
          ],
        },
      ],
    } satisfies Prisma.TransactionWhereInput;
  }
  return {
    OR: [
      {
        override: {
          is: {
            OR: [
              { categoryOverride: { equals: category, mode: "insensitive" } },
              {
                transactionCategory: {
                  is: { name: { equals: category, mode: "insensitive" } },
                },
              },
            ],
          },
        },
      },
      {
        AND: [
          noLocalCategory,
          {
            OR: [
              {
                classification: {
                  is: {
                    transactionCategory: {
                      is: { name: { equals: category, mode: "insensitive" } },
                    },
                  },
                },
              },
              { providerCategory: { equals: category, mode: "insensitive" } },
            ],
          },
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
      Prisma.sql`COALESCE(oc.name, cc.name, o.category_override) IS NULL`,
    );
  } else if (filters.category) {
    clauses.push(
      Prisma.sql`LOWER(COALESCE(oc.name, cc.name, o.category_override, t.provider_category)) = LOWER(${filters.category})`,
    );
  }
  if (filters.view === "inbox") {
    clauses.push(
      Prisma.sql`t.status <> 'CANCELED'::"TransactionStatus" AND t.removed_at IS NULL AND ((tc.review_state <> 'RESOLVED'::"ClassificationReviewState" AND (tc.deferred_until IS NULL OR tc.deferred_until <= NOW()) AND o.reviewed_at IS NULL) OR EXISTS (SELECT 1 FROM transaction_relationships tr WHERE tr.user_id = ${ownerId} AND (tr.source_transaction_id = t.id OR tr.target_transaction_id = t.id) AND tr.state IN ('SUGGESTED'::"TransactionRelationshipState", 'NEEDS_REVIEW'::"TransactionRelationshipState")))`,
    );
  }

  return db.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT t.id
    FROM transactions t
    LEFT JOIN transaction_overrides o
      ON o.transaction_id = t.id AND o.user_id = ${ownerId}
    LEFT JOIN transaction_categories oc ON oc.id = o.transaction_category_id
    LEFT JOIN transaction_classifications tc
      ON tc.transaction_id = t.id AND tc.user_id = ${ownerId}
    LEFT JOIN transaction_categories cc ON cc.id = tc.transaction_category_id
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
  await ensureTransactionTruthReady(ownerId);
  const filters = parseTransactionFilters(params);
  if (filters.view === "inbox") await suggestMovementRelationships(ownerId);
  const [accounts, transactionCategories] = await Promise.all([
    db.account.findMany({
      where: currentAccountWhere(ownerId),
      select: { id: true, name: true, institutionName: true },
      orderBy: [{ name: "asc" }, { id: "asc" }],
    }),
    db.transactionCategory.findMany({
      where: { userId: ownerId },
      select: {
        id: true,
        name: true,
        kind: true,
        displayOrder: true,
        isActive: true,
      },
      orderBy: [{ kind: "asc" }, { displayOrder: "asc" }, { name: "asc" }],
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
    ...(filters.view === "inbox"
      ? {
          removedAt: null,
          status:
            filters.status && filters.status !== "CANCELED"
              ? filters.status
              : { not: "CANCELED" },
          ...(filters.status === "CANCELED"
            ? { id: "__no_inbox_canceled__" }
            : {}),
          AND: [
            {
              OR: [
                {
                  AND: [
                    {
                      classification: {
                        is: {
                          reviewState: { not: "RESOLVED" },
                          OR: [
                            { deferredUntil: null },
                            { deferredUntil: { lte: new Date() } },
                          ],
                        },
                      },
                    },
                    {
                      OR: [
                        { override: null },
                        { override: { is: { reviewedAt: null } } },
                      ],
                    },
                  ],
                },
                {
                  outgoingRelationships: {
                    some: {
                      userId: ownerId,
                      state: { in: ["SUGGESTED", "NEEDS_REVIEW"] },
                    },
                  },
                },
                {
                  incomingRelationships: {
                    some: {
                      userId: ownerId,
                      state: { in: ["SUGGESTED", "NEEDS_REVIEW"] },
                    },
                  },
                },
              ],
            },
          ],
        }
      : {}),
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
    ...transactionCategories
      .filter(({ isActive }) => isActive)
      .map(({ name }) => name),
    "Uncategorized",
  ];

  return {
    accounts,
    categories,
    transactionCategories,
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
  await ensureTransactionTruthReady(ownerId);
  return db.transactionCategory.findMany({
    where: { userId: ownerId, isActive: true },
    select: { id: true, name: true, kind: true },
    orderBy: [{ kind: "asc" }, { displayOrder: "asc" }, { name: "asc" }],
  });
}

export async function getClassificationRuleSummaries(ownerId: string) {
  await ensureTransactionTruthReady(ownerId);
  return db.classificationRule.findMany({
    where: { userId: ownerId },
    select: {
      id: true,
      matchType: true,
      normalizedValue: true,
      accountId: true,
      account: { select: { name: true } },
      transactionCategory: { select: { name: true } },
      financialRole: true,
      economicDirection: true,
      priority: true,
      isActive: true,
      appliesFrom: true,
    },
    orderBy: [{ isActive: "desc" }, { priority: "asc" }, { id: "asc" }],
    take: 100,
  });
}

export async function getTransactionDetail(ownerId: string, id: string) {
  if (!id || id.length > 128) return null;
  await ensureTransactionTruthReady(ownerId);
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
      outgoingRelationships: {
        where: { userId: ownerId },
        include: {
          targetTransaction: {
            select: {
              id: true,
              originalName: true,
              merchantName: true,
              amount: true,
              currency: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      },
      incomingRelationships: {
        where: { userId: ownerId },
        include: {
          sourceTransaction: {
            select: {
              id: true,
              originalName: true,
              merchantName: true,
              amount: true,
              currency: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  return transaction
    ? { ...transaction, effective: effectiveTransactionValues(transaction) }
    : null;
}

export async function getRefundLinkCandidates(ownerId: string, id: string) {
  if (!id || id.length > 128) return [];
  await ensureTransactionTruthReady(ownerId);
  const source = await db.transaction.findFirst({
    where: { id, userId: ownerId },
    select: { currency: true },
  });
  if (!source) return [];
  const candidates = await db.transaction.findMany({
    where: {
      userId: ownerId,
      id: { not: id },
      currency: source.currency,
      status: TransactionStatus.POSTED,
      removedAt: null,
    },
    select: ledgerSelect,
    orderBy: [{ postedAt: "desc" }, { id: "desc" }],
    take: 100,
  });
  return candidates
    .map((transaction) => ({
      id: transaction.id,
      originalName: transaction.originalName,
      merchantName: transaction.merchantName,
      amount: transaction.amount,
      currency: transaction.currency,
      postedAt: transaction.postedAt,
      effective: effectiveTransactionValues(transaction),
    }))
    .filter(
      ({ effective }) =>
        effective.financialRole === "EXPENSE" && !effective.needsReview,
    );
}
