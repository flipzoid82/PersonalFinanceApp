import {
  AccountSource,
  AccountType as InternalAccountType,
  Prisma,
  TransactionStatus,
} from "@prisma/client";
import type {
  AccountBase,
  RemovedTransaction,
  Transaction as PlaidTransaction,
} from "plaid";

function currencyCode(account: AccountBase) {
  const candidate =
    account.balances.iso_currency_code ??
    account.balances.unofficial_currency_code;
  return candidate && /^[A-Z]{3}$/.test(candidate) ? candidate : "USD";
}

export function mapPlaidAccountType(account: AccountBase) {
  const type = String(account.type);
  const subtype = String(account.subtype ?? "").toLowerCase();
  if (type === "depository")
    return subtype === "checking"
      ? InternalAccountType.CHECKING
      : InternalAccountType.SAVINGS;
  if (type === "credit") return InternalAccountType.CREDIT_CARD;
  if (type === "loan")
    return subtype.includes("mortgage")
      ? InternalAccountType.MORTGAGE
      : InternalAccountType.LOAN;
  if (type === "investment") {
    if (subtype.includes("401")) return InternalAccountType.FOUR_O_ONE_K;
    if (subtype.includes("brokerage") || subtype.includes("cash management"))
      return InternalAccountType.BROKERAGE;
    return InternalAccountType.RETIREMENT;
  }
  return InternalAccountType.OTHER;
}

export function plaidAccountData(
  account: AccountBase,
  institutionName: string,
  syncedAt: Date,
) {
  const balanceAvailable = account.balances.current !== null;
  return {
    name: account.name,
    officialName: account.official_name,
    institutionName,
    mask: account.mask,
    accountType: mapPlaidAccountType(account),
    accountSubtype: account.subtype ? String(account.subtype) : null,
    source: AccountSource.SYNCED,
    currency: currencyCode(account),
    currentBalance: new Prisma.Decimal(account.balances.current ?? 0),
    balanceAvailable,
    availableBalance:
      account.balances.available === null
        ? null
        : new Prisma.Decimal(account.balances.available),
    creditLimit:
      account.balances.limit === null
        ? null
        : new Prisma.Decimal(account.balances.limit),
    isManual: false,
    isActive: true,
    lastSyncedAt: syncedAt,
  };
}

function utcDate(value: string | null | undefined) {
  if (!value) return null;
  return value.includes("T")
    ? new Date(value)
    : new Date(`${value}T00:00:00.000Z`);
}

export function plaidTransactionData(transaction: PlaidTransaction) {
  return {
    originalName: transaction.name,
    merchantName: transaction.merchant_name,
    amount: new Prisma.Decimal(transaction.amount),
    currency:
      transaction.iso_currency_code &&
      /^[A-Z]{3}$/.test(transaction.iso_currency_code)
        ? transaction.iso_currency_code
        : "USD",
    authorizedAt:
      utcDate(transaction.authorized_datetime) ??
      utcDate(transaction.authorized_date),
    postedAt: transaction.pending
      ? null
      : (utcDate(transaction.datetime) ?? utcDate(transaction.date)),
    status: transaction.pending
      ? TransactionStatus.PENDING
      : TransactionStatus.POSTED,
    providerCategory:
      transaction.personal_finance_category?.detailed ??
      transaction.personal_finance_category?.primary ??
      transaction.category?.join(" / ") ??
      null,
    pendingProviderTransactionId: transaction.pending_transaction_id,
    removedAt: null,
    rawProviderPayload: {
      source: "plaid_sandbox",
      paymentChannel: transaction.payment_channel,
    },
  };
}

export type PlaidSyncChanges = {
  added: PlaidTransaction[];
  modified: PlaidTransaction[];
  removed: RemovedTransaction[];
  nextCursor: string;
};
