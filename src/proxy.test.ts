// @vitest-environment node

import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import {
  DASHBOARD_ROUTES,
  SESSION_COOKIE_NAME,
  SESSION_EXPIRATION_COOKIE_NAME,
} from "@/lib/auth-constants";
import { proxy } from "./proxy";

function dashboardPageRoutes(
  directory = path.join(process.cwd(), "src", "app", "(dashboard)"),
  segments: string[] = [],
): string[] {
  const routes: string[] = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const childDirectory = path.join(directory, entry.name);
    const childSegments = [...segments, entry.name];
    if (existsSync(path.join(childDirectory, "page.tsx"))) {
      routes.push(`/${childSegments.join("/")}`);
    }
    routes.push(...dashboardPageRoutes(childDirectory, childSegments));
  }

  return routes;
}

describe("server-side dashboard route protection", () => {
  it("covers every page currently inside the dashboard route group", () => {
    expect([...DASHBOARD_ROUTES].sort()).toEqual(dashboardPageRoutes().sort());
  });

  it.each(DASHBOARD_ROUTES)(
    "redirects direct unauthenticated navigation to %s",
    (pathname) => {
      const response = proxy(
        new NextRequest(`http://localhost:3000${pathname}`),
      );

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe(
        "http://localhost:3000/login",
      );
    },
  );

  it("lets a cookie-bearing request reach the database-backed layout check", () => {
    const response = proxy(
      new NextRequest("http://localhost:3000/overview", {
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=opaque-session-token`,
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it.each(DASHBOARD_ROUTES)(
    "preserves expiration context on direct navigation to %s after cookie clearing",
    (pathname) => {
      const response = proxy(
        new NextRequest(`http://localhost:3000${pathname}`, {
          headers: {
            cookie: `${SESSION_EXPIRATION_COOKIE_NAME}=1`,
          },
        }),
      );

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe(
        "http://localhost:3000/login?reason=expired",
      );
    },
  );

  it.each(["/login", "/forgot-password", "/api/session/end"])(
    "keeps the public route %s available without a cookie",
    (pathname) => {
      const response = proxy(
        new NextRequest(`http://localhost:3000${pathname}`),
      );

      expect(response.status).toBe(200);
      expect(response.headers.get("location")).toBeNull();
    },
  );

  it("does not loop on the expiration login or session-ending routes", () => {
    for (const pathname of [
      "/login?reason=expired",
      "/api/session/end?reason=expired",
    ]) {
      const response = proxy(
        new NextRequest(`http://localhost:3000${pathname}`, {
          headers: {
            cookie: `${SESSION_EXPIRATION_COOKIE_NAME}=1`,
          },
        }),
      );
      expect(response.status).toBe(200);
      expect(response.headers.get("location")).toBeNull();
    }
  });

  it("allows the verified Plaid webhook endpoint without an owner cookie", () => {
    const response = proxy(
      new NextRequest("http://localhost:3000/api/plaid/webhook"),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("keeps owner-facing Plaid APIs protected", () => {
    const response = proxy(
      new NextRequest("http://localhost:3000/api/plaid/link-token"),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/login",
    );
  });
});
