import { AccountType, ImportAccountMatchStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { matchImportAccount } from "./matching";

const identity = {
  sourceKey: "fidelity:1234",
  displayName: "Fidelity brokerage account",
  institutionName: "Fidelity",
  maskedIdentifier: "1234",
  accountType: AccountType.BROKERAGE,
  currency: "USD",
};
const account = {
  id: "account-1",
  name: "Fidelity brokerage account",
  institutionName: "Fidelity",
  mask: "1234",
  accountType: AccountType.BROKERAGE,
  accountSubtype: null,
  currency: "USD",
};

describe("conservative import account matching", () => {
  it("auto-links one strong masked identity", () => {
    expect(matchImportAccount(identity, [account])).toMatchObject({
      status: ImportAccountMatchStatus.MATCHED,
      matchedAccountId: account.id,
    });
  });

  it("requires review for multiple plausible accounts", () => {
    expect(
      matchImportAccount(identity, [account, { ...account, id: "account-2" }]),
    ).toMatchObject({ status: ImportAccountMatchStatus.NEEDS_REVIEW });
  });

  it("proposes explicit creation when there is no match", () => {
    expect(matchImportAccount(identity, [])).toMatchObject({
      status: ImportAccountMatchStatus.CREATE,
    });
  });
});
