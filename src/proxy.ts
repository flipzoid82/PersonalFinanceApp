import { type NextRequest, NextResponse } from "next/server";
import {
  SESSION_COOKIE_NAME,
  SESSION_EXPIRATION_COOKIE_NAME,
} from "./lib/auth-constants";

const PUBLIC_PATHS = [
  "/login",
  "/forgot-password",
  "/api/plaid/webhook",
  "/api/session/end",
] as const;

function isPublicPath(pathname: string) {
  return (
    PUBLIC_PATHS.some(
      (path) => pathname === path || pathname.startsWith(`${path}/`),
    ) ||
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico"
  );
}

export function proxy(request: NextRequest) {
  if (isPublicPath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  if (!request.cookies.get(SESSION_COOKIE_NAME)?.value) {
    const loginUrl = new URL("/login", request.url);
    if (request.cookies.get(SESSION_EXPIRATION_COOKIE_NAME)?.value === "1") {
      loginUrl.searchParams.set("reason", "expired");
    }
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!login(?:/|$)|forgot-password(?:/|$)|api/plaid/webhook(?:/|$)|api/session/end(?:/|$)|_next/static|_next/image|favicon.ico).*)",
  ],
};
