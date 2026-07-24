// @vitest-environment node

import { createHash } from "node:crypto";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { describe, expect, it, vi } from "vitest";
import type { PlaidClient } from "./client";
import { parsePlaidTransactionsWebhook, verifyPlaidWebhook } from "./webhook";

describe("Plaid webhook validation", () => {
  it("accepts only the Sandbox transaction-sync webhook shape", () => {
    expect(
      parsePlaidTransactionsWebhook({
        webhook_type: "TRANSACTIONS",
        webhook_code: "SYNC_UPDATES_AVAILABLE",
        item_id: "sandbox-item",
        environment: "sandbox",
      }),
    ).toMatchObject({ item_id: "sandbox-item" });
    expect(() =>
      parsePlaidTransactionsWebhook({
        webhook_type: "AUTH",
        webhook_code: "DEFAULT_UPDATE",
        item_id: "sandbox-item",
      }),
    ).toThrow();
  });

  it("verifies Plaid's ES256 signature, age, and raw-body hash", async () => {
    const now = new Date("2026-07-23T12:00:00.000Z");
    const body = '{"webhook_type":"TRANSACTIONS"}';
    const { privateKey, publicKey } = await generateKeyPair("ES256");
    const publicJwk = await exportJWK(publicKey);
    const hash = createHash("sha256").update(body).digest("hex");
    const token = await new SignJWT({ request_body_sha256: hash })
      .setProtectedHeader({ alg: "ES256", kid: "fixture-key" })
      .setIssuedAt(Math.floor(now.getTime() / 1000))
      .sign(privateKey);
    const plaid = {
      webhookVerificationKeyGet: vi.fn(async () => ({
        data: {
          key: {
            ...publicJwk,
            alg: "ES256",
            kid: "fixture-key",
            use: "sig",
            created_at: 0,
            expired_at: null,
          },
          request_id: "safe-request-id",
        },
      })),
    } as unknown as PlaidClient;

    await expect(
      verifyPlaidWebhook(body, token, { plaid, now }),
    ).resolves.toBeUndefined();
    await expect(
      verifyPlaidWebhook(`${body} `, token, { plaid, now }),
    ).rejects.toThrow("body verification failed");
  });
});
