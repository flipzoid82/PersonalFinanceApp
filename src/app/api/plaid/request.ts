import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { PlaidConfigurationError } from "@/lib/plaid/config";
import { SafePlaidError } from "@/lib/plaid";

export function requireSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(env.APP_URL).origin)
    throw new Error("Invalid request origin.");
}

export function plaidApiError(error: unknown) {
  if (error instanceof PlaidConfigurationError)
    return NextResponse.json(
      { error: "Plaid Sandbox is not configured." },
      { status: 503 },
    );
  if (error instanceof SafePlaidError)
    return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(
    { error: "Plaid Sandbox could not complete the request." },
    { status: 400 },
  );
}
