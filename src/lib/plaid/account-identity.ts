import { createHash } from "node:crypto";

function normalizeIdentityPart(value: string) {
  return value
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase("en-US")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export type PlaidLogicalAccountIdentity = {
  institutionId: string | null;
  mask: string | null;
  name: string;
  officialName: string | null;
  type: string;
  subtype: string | null;
  currency: string;
};

export function plaidProviderIdentityKey(
  identity: PlaidLogicalAccountIdentity,
) {
  const institutionId = normalizeIdentityPart(identity.institutionId ?? "");
  const mask = normalizeIdentityPart(identity.mask ?? "");
  const name = normalizeIdentityPart(identity.officialName ?? identity.name);
  const type = normalizeIdentityPart(identity.type);
  const subtype = normalizeIdentityPart(identity.subtype ?? "");
  const currency = normalizeIdentityPart(identity.currency);
  if (!institutionId || !mask || !name || !type || !currency) return null;

  const digest = createHash("sha256")
    .update(
      JSON.stringify({
        provider: "PLAID",
        institutionId,
        mask,
        name,
        type,
        subtype,
        currency,
      }),
    )
    .digest("hex");
  return `plaid:v1:${digest}`;
}
