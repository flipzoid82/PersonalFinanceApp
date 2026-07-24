import { type NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "./lib/auth-constants";

const PUBLIC_PATHS = ["/login", "/forgot-password"] as const;

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
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!login(?:/|$)|forgot-password(?:/|$)|_next/static|_next/image|favicon.ico).*)",
  ],
};
