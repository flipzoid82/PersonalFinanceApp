import "server-only";
import { z } from "zod";

const schema = z
  .object({
    DATABASE_URL: z.string().url().startsWith("postgresql://"),
    APP_URL: z.string().url(),
    AUTH_SECRET: z.string().min(32),
    TOKEN_ENCRYPTION_KEY: z.string().regex(/^[a-fA-F0-9]{64}$/),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    SESSION_IDLE_TIMEOUT_SECONDS: z.coerce
      .number()
      .int()
      .min(5)
      .default(15 * 60),
    SESSION_WARNING_THRESHOLD_SECONDS: z.coerce
      .number()
      .int()
      .min(1)
      .default(2 * 60),
    SESSION_ABSOLUTE_TIMEOUT_SECONDS: z.coerce
      .number()
      .int()
      .min(10)
      .default(8 * 60 * 60),
    SESSION_ACTIVITY_THROTTLE_SECONDS: z.coerce
      .number()
      .int()
      .min(1)
      .default(60),
  })
  .superRefine((value, context) => {
    if (
      value.SESSION_WARNING_THRESHOLD_SECONDS >=
      value.SESSION_IDLE_TIMEOUT_SECONDS
    )
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["SESSION_WARNING_THRESHOLD_SECONDS"],
        message: "must be shorter than the idle timeout",
      });
    if (
      value.SESSION_ABSOLUTE_TIMEOUT_SECONDS <
      value.SESSION_IDLE_TIMEOUT_SECONDS
    )
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["SESSION_ABSOLUTE_TIMEOUT_SECONDS"],
        message: "must not be shorter than the idle timeout",
      });
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
