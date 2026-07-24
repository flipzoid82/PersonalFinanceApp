// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  env: { AUTH_SECRET: "test-auth-secret-with-sufficient-length" },
}));

import { linkTokenRequest, normalizePlaidError } from "./client";

const ENVIRONMENT = {
  PLAID_CLIENT_ID: "sandbox-client",
  PLAID_SECRET: "sandbox-secret",
  PLAID_ENV: "sandbox",
  PLAID_WEBHOOK_URL: "https://example.test/api/plaid/webhook",
  PLAID_TOKEN_ENCRYPTION_KEY: "1".repeat(64),
  TOKEN_ENCRYPTION_KEY: "2".repeat(64),
};

afterEach(() => vi.unstubAllEnvs());

function configure() {
  for (const [name, value] of Object.entries(ENVIRONMENT))
    vi.stubEnv(name, value);
}

describe("Plaid Link requests and safe errors", () => {
  it("requests only Transactions for a new Sandbox connection", () => {
    configure();
    const request = linkTokenRequest("owner-id");
    expect(request.products).toEqual(["transactions"]);
    expect(request.access_token).toBeUndefined();
    expect(request.webhook).toBe("https://example.test/api/plaid/webhook");
    expect(request.user?.client_user_id).not.toContain("owner-id");
  });

  it("uses update mode without requesting products", () => {
    configure();
    const request = linkTokenRequest("owner-id", "server-only-token");
    expect(request.access_token).toBe("server-only-token");
    expect(request.products).toBeUndefined();
  });

  it("does not leak provider response data into errors", () => {
    const safe = normalizePlaidError({
      response: {
        data: {
          error_code: "UNKNOWN_PROVIDER_ERROR",
          request_id: "request-id",
          access_token: "must-not-leak",
        },
      },
    });
    expect(safe.code).toBe("UNKNOWN_PROVIDER_ERROR");
    expect(safe.message).toBe("Plaid Sandbox could not complete the request.");
    expect(JSON.stringify(safe)).not.toContain("must-not-leak");
  });
});
