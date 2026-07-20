import type { NextConfig } from "next";
import { z } from "zod";

const buildPhase = process.env.NEXT_PHASE === "phase-production-build";
const isCi = process.env.CI === "true";

// CI supplies non-secret validation values because static compilation must not use production secrets.
if (!buildPhase || !isCi) {
  const result = z
    .object({
      DATABASE_URL: z.string().url().startsWith("postgresql://"),
      APP_URL: z.string().url(),
      AUTH_SECRET: z.string().min(32),
      TOKEN_ENCRYPTION_KEY: z.string().regex(/^[a-fA-F0-9]{64}$/),
    })
    .safeParse(process.env);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${details}`);
  }
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
};

export default nextConfig;
