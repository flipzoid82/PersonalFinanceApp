import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { decodeProtectedHeader, importJWK, jwtVerify, type JWK } from "jose";
import { z } from "zod";
import type { PrismaClient } from "@prisma/client";
import { db } from "@/lib/db";
import { getPlaidClient, SafePlaidError, type PlaidClient } from "./client";
import { syncPlaidConnection } from "./sync";

const webhookSchema = z.object({
  webhook_type: z.literal("TRANSACTIONS"),
  webhook_code: z.literal("SYNC_UPDATES_AVAILABLE"),
  item_id: z.string().min(1).max(255),
  environment: z.literal("sandbox").optional(),
});

export type PlaidTransactionsWebhook = z.infer<typeof webhookSchema>;

export function parsePlaidTransactionsWebhook(value: unknown) {
  return webhookSchema.parse(value);
}

export async function verifyPlaidWebhook(
  rawBody: string,
  verificationHeader: string,
  options: { plaid?: PlaidClient; now?: Date } = {},
) {
  const plaid = options.plaid ?? getPlaidClient();
  const now = options.now ?? new Date();
  const header = decodeProtectedHeader(verificationHeader);
  if (header.alg !== "ES256" || typeof header.kid !== "string" || !header.kid)
    throw new Error("Invalid Plaid webhook signature.");

  const keyResponse = await plaid.webhookVerificationKeyGet({
    key_id: header.kid,
  });
  const key = keyResponse.data.key;
  if (
    key.alg !== "ES256" ||
    key.kid !== header.kid ||
    (key.expired_at !== null &&
      key.expired_at !== undefined &&
      key.expired_at * 1000 < now.getTime())
  )
    throw new Error("Invalid Plaid webhook verification key.");

  const publicKey = await importJWK(key as JWK, "ES256");
  const verified = await jwtVerify(verificationHeader, publicKey, {
    algorithms: ["ES256"],
  });
  const issuedAt = verified.payload.iat;
  const expectedHash = verified.payload.request_body_sha256;
  if (
    typeof issuedAt !== "number" ||
    Math.abs(now.getTime() / 1000 - issuedAt) > 5 * 60 ||
    typeof expectedHash !== "string" ||
    !/^[a-f0-9]{64}$/i.test(expectedHash)
  )
    throw new Error("Invalid Plaid webhook claims.");

  const actual = Buffer.from(
    createHash("sha256").update(rawBody).digest("hex"),
    "hex",
  );
  const expected = Buffer.from(expectedHash, "hex");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
    throw new Error("Plaid webhook body verification failed.");
}

export async function processPlaidTransactionsWebhook(
  webhook: PlaidTransactionsWebhook,
  options: { plaid?: PlaidClient; database?: PrismaClient } = {},
) {
  const database = options.database ?? db;
  const connection = await database.institutionConnection.findFirst({
    where: {
      provider: "PLAID",
      providerItemId: webhook.item_id,
    },
    select: { id: true, userId: true },
  });
  if (!connection) return "unknown" as const;
  try {
    await syncPlaidConnection(connection.userId, connection.id, {
      plaid: options.plaid,
      database,
    });
  } catch (error) {
    if (
      error instanceof SafePlaidError &&
      error.code === "SYNC_ALREADY_RUNNING"
    )
      return "already-syncing" as const;
    throw error;
  }
  return "synced" as const;
}
