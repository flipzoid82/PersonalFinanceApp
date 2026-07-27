import { NextResponse } from "next/server";
import { AuthRequiredError } from "@/lib/auth";
import { PlaidConfigurationError } from "@/lib/plaid/config";
import { SafePlaidError } from "@/lib/plaid";
export { requireSameOrigin } from "@/lib/request-security";

export function plaidApiError(error: unknown) {
  if (error instanceof AuthRequiredError)
    return NextResponse.json(
      { error: "Authentication is required." },
      { status: 401 },
    );
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
