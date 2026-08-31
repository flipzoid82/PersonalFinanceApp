import { createHash } from "node:crypto";
import type { ParsedImportCandidate, ProposedImportData } from "./types";

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}

export function sha256(value: string | Uint8Array) {
  return createHash("sha256").update(value).digest("hex");
}

export function fingerprintObject(value: unknown) {
  return sha256(canonical(value));
}

function providerFamily(parserFamily: string) {
  if (parserFamily.startsWith("Fidelity")) return "fidelity";
  if (parserFamily.startsWith("Tsp")) return "tsp";
  return "generic-import";
}

export function candidateIdentity(
  parserFamily: string,
  candidate: Pick<ParsedImportCandidate, "kind" | "proposedData">,
  normalizedAccountKey: string,
) {
  const data: Partial<ProposedImportData> = candidate.proposedData ?? {};
  const transactionIdentity =
    candidate.kind === "INVESTMENT_TRANSACTION"
      ? {
          account: normalizedAccountKey,
          family: providerFamily(parserFamily),
          kind: candidate.kind,
          transactionType: data.transactionType,
          transactionDate: data.transactionDate,
          settlementDate: data.settlementDate,
          security: (
            data.tickerSymbol ?? data.securityName
          )?.toLocaleLowerCase(),
          quantity: data.quantity,
          price: data.price,
          amount: data.amount,
          fees: data.fees,
          reference: data.sourceReference,
        }
      : {
          account: normalizedAccountKey,
          family: providerFamily(parserFamily),
          kind: candidate.kind,
          asOfDate: data.asOfDate,
          security: (
            data.tickerSymbol ?? data.securityName
          )?.toLocaleLowerCase(),
        };
  return fingerprintObject(transactionIdentity);
}

export function sourceCandidateFingerprint(
  parserFamily: string,
  ordinal: number,
  data: ProposedImportData | undefined,
) {
  return fingerprintObject({ parserFamily, ordinal, data });
}

export function sanitizeFilename(name: string) {
  const leaf = name.replace(/\\/g, "/").split("/").pop() ?? "import";
  const safe = leaf.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  return (safe || "import").slice(0, 160);
}
