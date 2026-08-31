import type { Account, ImportAccountMatchStatus } from "@prisma/client";
import { ImportAccountMatchStatus as MatchStatus } from "@prisma/client";
import type { ImportAccountIdentity } from "./types";

type MatchableAccount = Pick<
  Account,
  | "id"
  | "name"
  | "institutionName"
  | "mask"
  | "accountType"
  | "accountSubtype"
  | "currency"
>;

function normalized(value: string | null | undefined) {
  return value?.normalize("NFKC").trim().toLocaleLowerCase() ?? "";
}

export function matchImportAccount(
  identity: ImportAccountIdentity,
  accounts: MatchableAccount[],
): {
  status: ImportAccountMatchStatus;
  matchedAccountId?: string;
  reason: string;
} {
  const sameShape = accounts.filter(
    (account) =>
      account.accountType === identity.accountType &&
      account.currency === identity.currency &&
      (!identity.institutionName ||
        normalized(account.institutionName) ===
          normalized(identity.institutionName)),
  );
  const strong = identity.maskedIdentifier
    ? sameShape.filter(
        (account) =>
          account.mask === identity.maskedIdentifier ||
          account.mask?.endsWith(identity.maskedIdentifier ?? "") === true,
      )
    : sameShape.filter(
        (account) =>
          normalized(account.name) === normalized(identity.displayName),
      );
  if (strong.length === 1)
    return {
      status: MatchStatus.MATCHED,
      matchedAccountId: strong[0].id,
      reason: "Matched by account identity, type, institution, and currency.",
    };
  if (strong.length > 1 || sameShape.length > 1)
    return {
      status: MatchStatus.NEEDS_REVIEW,
      reason:
        "We found more than one possible account. Choose the correct account.",
    };
  if (sameShape.length === 1)
    return {
      status: MatchStatus.NEEDS_REVIEW,
      matchedAccountId: sameShape[0].id,
      reason:
        "We found a possible account, but its identity is not strong enough to link automatically.",
    };
  return {
    status: MatchStatus.CREATE,
    reason:
      "No existing account matched. A new imported account will be created after confirmation.",
  };
}
