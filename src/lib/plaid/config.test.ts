import { describe, expect, it } from "vitest";
import { PlaidConfigurationError, parsePlaidConfig } from "./config";

const valid = {
  PLAID_CLIENT_ID: "sandbox-client",
  PLAID_SECRET: "sandbox-secret",
  PLAID_ENV: "sandbox",
  PLAID_WEBHOOK_URL: "https://example.test/api/plaid/webhook",
  PLAID_TOKEN_ENCRYPTION_KEY: "1".repeat(64),
  TOKEN_ENCRYPTION_KEY: "2".repeat(64),
};

describe("Plaid Sandbox configuration", () => {
  it("accepts a complete Sandbox-only configuration", () => {
    expect(parsePlaidConfig(valid)).toMatchObject({
      environment: "sandbox",
      clientId: "sandbox-client",
    });
  });

  it.each([
    [{ ...valid, PLAID_ENV: "production" }],
    [{ ...valid, PLAID_SECRET: "" }],
    [{ ...valid, PLAID_TOKEN_ENCRYPTION_KEY: "short" }],
    [
      {
        ...valid,
        PLAID_TOKEN_ENCRYPTION_KEY: valid.TOKEN_ENCRYPTION_KEY,
      },
    ],
  ])("fails closed for invalid or non-Sandbox values", (input) => {
    expect(() => parsePlaidConfig(input)).toThrow(PlaidConfigurationError);
  });
});
