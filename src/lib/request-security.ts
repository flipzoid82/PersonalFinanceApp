import "server-only";

import { env } from "@/lib/env";

export function requireSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(env.APP_URL).origin) {
    throw new Error("Invalid request origin.");
  }
}
