import "server-only";
import { createHmac } from "node:crypto";
import {
  Configuration,
  CountryCode,
  PlaidApi,
  PlaidEnvironments,
  Products,
  type LinkTokenCreateRequest,
} from "plaid";
import { env } from "@/lib/env";
import { getPlaidConfig } from "./config";

export type PlaidClient = Pick<
  PlaidApi,
  | "accountsGet"
  | "institutionsGetById"
  | "itemGet"
  | "itemPublicTokenExchange"
  | "itemRemove"
  | "linkTokenCreate"
  | "sandboxItemResetLogin"
  | "sandboxItemFireWebhook"
  | "transactionsSync"
  | "webhookVerificationKeyGet"
>;

let client: PlaidApi | undefined;

export function getPlaidClient(): PlaidClient {
  if (!client) {
    const config = getPlaidConfig();
    client = new PlaidApi(
      new Configuration({
        basePath: PlaidEnvironments.sandbox,
        baseOptions: {
          headers: {
            "PLAID-CLIENT-ID": config.clientId,
            "PLAID-SECRET": config.secret,
          },
        },
      }),
    );
  }
  return client;
}

export function plaidClientUserId(ownerId: string) {
  return createHmac("sha256", env.AUTH_SECRET)
    .update(`plaid-owner:${ownerId}`)
    .digest("hex");
}

export function linkTokenRequest(
  ownerId: string,
  accessToken?: string,
): LinkTokenCreateRequest {
  const config = getPlaidConfig();
  return {
    client_name: "Personal Finance Dashboard",
    country_codes: [CountryCode.Us],
    language: "en",
    user: { client_user_id: plaidClientUserId(ownerId) },
    webhook: config.webhookUrl,
    ...(accessToken
      ? { access_token: accessToken }
      : { products: [Products.Transactions] }),
  };
}

const SAFE_ERROR_MESSAGES: Record<string, string> = {
  ITEM_LOGIN_REQUIRED:
    "This connection needs to be repaired before it can sync.",
  INSTITUTION_DOWN:
    "The Sandbox institution is temporarily unavailable. Try again later.",
  INSTITUTION_NOT_RESPONDING:
    "The Sandbox institution did not respond. Try again later.",
  PRODUCT_NOT_READY:
    "Plaid Sandbox is still preparing transaction data. Try again shortly.",
  RATE_LIMIT_EXCEEDED: "Plaid Sandbox is busy. Try again shortly.",
};

export class SafePlaidError extends Error {
  constructor(
    public readonly code: string,
    public readonly requestId?: string,
    message = SAFE_ERROR_MESSAGES[code] ??
      "Plaid Sandbox could not complete the request.",
  ) {
    super(message);
    this.name = "SafePlaidError";
  }
}

export function normalizePlaidError(error: unknown) {
  if (error instanceof SafePlaidError) return error;
  const response = (
    error as {
      response?: {
        data?: { error_code?: unknown; request_id?: unknown };
      };
    }
  )?.response?.data;
  return new SafePlaidError(
    typeof response?.error_code === "string"
      ? response.error_code
      : "PLAID_REQUEST_FAILED",
    typeof response?.request_id === "string" ? response.request_id : undefined,
  );
}
