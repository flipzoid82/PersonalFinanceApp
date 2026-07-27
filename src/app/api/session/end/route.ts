import { NextResponse } from "next/server";
import { clearInvalidSessionCookie } from "@/lib/auth";
import { env } from "@/lib/env";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const expired = requestUrl.searchParams.get("reason") === "expired";
  await clearInvalidSessionCookie(expired ? "expired" : undefined);
  const loginUrl = new URL("/login", env.APP_URL);
  if (expired) {
    loginUrl.searchParams.set("reason", "expired");
  }
  return NextResponse.redirect(loginUrl);
}
