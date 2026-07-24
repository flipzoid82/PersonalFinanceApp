import "server-only";
import { z } from "zod";

const plaidSchema = z
  .object({
    PLAID_CLIENT_ID: z.string().min(1),
    PLAID_SECRET: z.string().min(1),
    PLAID_ENV: z.literal("sandbox"),
    PLAID_WEBHOOK_URL: z.string().url(),
    PLAID_TOKEN_ENCRYPTION_KEY: z.string().regex(/^[a-fA-F0-9]{64}$/),
    TOKEN_ENCRYPTION_KEY: z.string().regex(/^[a-fA-F0-9]{64}$/),
  })
  .refine(
    (value) =>
      value.PLAID_TOKEN_ENCRYPTION_KEY.toLowerCase() !==
      value.TOKEN_ENCRYPTION_KEY.toLowerCase(),
    {
      message: "Plaid must use a dedicated encryption key.",
      path: ["PLAID_TOKEN_ENCRYPTION_KEY"],
    },
  );

export class PlaidConfigurationError extends Error {
  constructor() {
    super("Plaid Sandbox is not configured.");
    this.name = "PlaidConfigurationError";
  }
}

export function parsePlaidConfig(values: Record<string, unknown>) {
  const result = plaidSchema.safeParse(values);
  if (!result.success) throw new PlaidConfigurationError();
  return {
    clientId: result.data.PLAID_CLIENT_ID,
    secret: result.data.PLAID_SECRET,
    environment: result.data.PLAID_ENV,
    webhookUrl: result.data.PLAID_WEBHOOK_URL,
    encryptionKey: result.data.PLAID_TOKEN_ENCRYPTION_KEY,
  } as const;
}

export function isPlaidConfigured() {
  return plaidSchema.safeParse(process.env).success;
}

export function getPlaidConfig() {
  return parsePlaidConfig(process.env);
}
