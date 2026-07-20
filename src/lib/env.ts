import "server-only";
import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().url().startsWith("postgresql://"),
  APP_URL: z.string().url(),
  AUTH_SECRET: z.string().min(32),
  TOKEN_ENCRYPTION_KEY: z.string().regex(/^[a-fA-F0-9]{64}$/),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
});

const result = schema.safeParse(process.env);

if (!result.success) {
  throw new Error(
    `Invalid environment configuration:\n${result.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("\n")}`,
  );
}

export const env = result.data;
