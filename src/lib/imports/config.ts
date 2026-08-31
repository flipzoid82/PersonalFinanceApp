import "server-only";

import path from "node:path";
import { z } from "zod";

const importConfigSchema = z
  .object({
    IMPORT_FILE_ENCRYPTION_KEY: z.string().regex(/^[a-fA-F0-9]{64}$/),
    IMPORT_STORAGE_DIR: z.string().trim().min(1).optional(),
    PLAID_TOKEN_ENCRYPTION_KEY: z.string().optional(),
    TOKEN_ENCRYPTION_KEY: z.string().optional(),
  })
  .superRefine((value, context) => {
    const key = value.IMPORT_FILE_ENCRYPTION_KEY.toLowerCase();
    for (const name of [
      "PLAID_TOKEN_ENCRYPTION_KEY",
      "TOKEN_ENCRYPTION_KEY",
    ] as const) {
      if (value[name]?.toLowerCase() === key)
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["IMPORT_FILE_ENCRYPTION_KEY"],
          message: "must be dedicated to retained import files",
        });
    }
  });

export class ImportConfigurationError extends Error {
  constructor() {
    super("Statement import storage is not configured.");
    this.name = "ImportConfigurationError";
  }
}

export function parseImportConfig(values: Record<string, unknown>) {
  const result = importConfigSchema.safeParse(values);
  if (!result.success) throw new ImportConfigurationError();
  return {
    encryptionKey: result.data.IMPORT_FILE_ENCRYPTION_KEY,
    storageDirectory: result.data.IMPORT_STORAGE_DIR
      ? path.resolve(/* turbopackIgnore: true */ result.data.IMPORT_STORAGE_DIR)
      : path.join(process.cwd(), ".dev-runtime", "imports"),
  };
}

export function isImportConfigured() {
  return importConfigSchema.safeParse(process.env).success;
}

export function getImportConfig() {
  return parseImportConfig(process.env);
}
