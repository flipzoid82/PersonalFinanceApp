import "server-only";

import { createHmac, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  SESSION_COOKIE_NAME,
  SESSION_EXPIRATION_COOKIE_NAME,
} from "@/lib/auth-constants";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { sessionPolicy } from "@/lib/session-policy";

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const EXPIRATION_MARKER_MAX_AGE_SECONDS = 5 * 60;

export const SESSION_REVOCATION_REASONS = {
  absoluteTimeout: "ABSOLUTE_TIMEOUT",
  idleTimeout: "IDLE_TIMEOUT",
  legacyMigration: "LEGACY_MIGRATION",
  reauthenticated: "REAUTHENTICATED",
  userLogout: "USER_LOGOUT",
} as const;

export type SessionStatus =
  | "active"
  | "absolute_expired"
  | "idle_expired"
  | "invalid"
  | "revoked";

type SessionUser = {
  id: string;
  email: string;
  displayName: string | null;
};

type SessionResult = {
  absoluteExpiresAt: Date | null;
  idleExpiresAt: Date | null;
  lastActivityAt: Date | null;
  sessionId: string | null;
  status: SessionStatus;
  user: SessionUser | null;
};

export class AuthRequiredError extends Error {
  readonly code = "AUTH_REQUIRED";

  constructor(readonly status: SessionStatus) {
    super("Authentication is required.");
    this.name = "AuthRequiredError";
  }
}

function hashToken(token: string) {
  return createHmac("sha256", env.AUTH_SECRET).update(token).digest("hex");
}

function isValidToken(token: string | undefined): token is string {
  return typeof token === "string" && TOKEN_PATTERN.test(token);
}

function cookieOptions(expires?: Date) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: env.NODE_ENV === "production",
    path: "/",
    ...(expires ? { expires } : {}),
  };
}

async function clearSessionCookie() {
  (await cookies()).set(SESSION_COOKIE_NAME, "", {
    ...cookieOptions(new Date(0)),
    maxAge: 0,
  });
}

async function clearExpirationMarker() {
  (await cookies()).set(SESSION_EXPIRATION_COOKIE_NAME, "", {
    ...cookieOptions(new Date(0)),
    maxAge: 0,
  });
}

async function markSessionExpired() {
  (await cookies()).set(SESSION_EXPIRATION_COOKIE_NAME, "1", {
    ...cookieOptions(
      new Date(Date.now() + EXPIRATION_MARKER_MAX_AGE_SECONDS * 1000),
    ),
    maxAge: EXPIRATION_MARKER_MAX_AGE_SECONDS,
  });
}

async function revokeExpiredSession(
  sessionId: string,
  reason:
    | typeof SESSION_REVOCATION_REASONS.absoluteTimeout
    | typeof SESSION_REVOCATION_REASONS.idleTimeout,
  now: Date,
) {
  await db.authSession.updateMany({
    where: { id: sessionId, revokedAt: null },
    data: { revokedAt: now, revocationReason: reason },
  });
}

async function inspectCurrentSession(now = new Date()): Promise<SessionResult> {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!isValidToken(token)) {
    return {
      absoluteExpiresAt: null,
      idleExpiresAt: null,
      lastActivityAt: null,
      sessionId: null,
      status: "invalid",
      user: null,
    };
  }

  const session = await db.authSession.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });

  if (!session) {
    return {
      absoluteExpiresAt: null,
      idleExpiresAt: null,
      lastActivityAt: null,
      sessionId: null,
      status: "invalid",
      user: null,
    };
  }

  if (session.revokedAt) {
    const status =
      session.revocationReason === SESSION_REVOCATION_REASONS.absoluteTimeout
        ? "absolute_expired"
        : session.revocationReason === SESSION_REVOCATION_REASONS.idleTimeout
          ? "idle_expired"
          : "revoked";
    return {
      absoluteExpiresAt: session.absoluteExpiresAt,
      idleExpiresAt: session.idleExpiresAt,
      lastActivityAt: session.lastActivityAt,
      sessionId: session.id,
      status,
      user: null,
    };
  }

  if (session.absoluteExpiresAt <= now) {
    await revokeExpiredSession(
      session.id,
      SESSION_REVOCATION_REASONS.absoluteTimeout,
      now,
    );
    return {
      absoluteExpiresAt: session.absoluteExpiresAt,
      idleExpiresAt: session.idleExpiresAt,
      lastActivityAt: session.lastActivityAt,
      sessionId: session.id,
      status: "absolute_expired",
      user: null,
    };
  }

  if (session.idleExpiresAt <= now) {
    await revokeExpiredSession(
      session.id,
      SESSION_REVOCATION_REASONS.idleTimeout,
      now,
    );
    return {
      absoluteExpiresAt: session.absoluteExpiresAt,
      idleExpiresAt: session.idleExpiresAt,
      lastActivityAt: session.lastActivityAt,
      sessionId: session.id,
      status: "idle_expired",
      user: null,
    };
  }

  return {
    absoluteExpiresAt: session.absoluteExpiresAt,
    idleExpiresAt: session.idleExpiresAt,
    lastActivityAt: session.lastActivityAt,
    sessionId: session.id,
    status: "active",
    user: {
      id: session.user.id,
      email: session.user.email,
      displayName: session.user.displayName,
    },
  };
}

function isExpiredStatus(status: SessionStatus) {
  return status === "absolute_expired" || status === "idle_expired";
}

export async function createSession(userId: string) {
  const now = new Date();
  const token = randomBytes(32).toString("base64url");
  const absoluteExpiresAt = new Date(
    now.getTime() + sessionPolicy.absoluteTimeoutMs,
  );
  const idleExpiresAt = new Date(
    Math.min(
      now.getTime() + sessionPolicy.idleTimeoutMs,
      absoluteExpiresAt.getTime(),
    ),
  );
  const currentToken = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const retentionCutoff = new Date(
    now.getTime() - sessionPolicy.revokedRetentionMs,
  );

  await db.$transaction(async (transaction) => {
    await transaction.authSession.deleteMany({
      where: {
        OR: [
          { revokedAt: { lt: retentionCutoff } },
          {
            absoluteExpiresAt: { lt: retentionCutoff },
            revokedAt: { not: null },
          },
        ],
      },
    });
    if (isValidToken(currentToken)) {
      await transaction.authSession.updateMany({
        where: { tokenHash: hashToken(currentToken), revokedAt: null },
        data: {
          revokedAt: now,
          revocationReason: SESSION_REVOCATION_REASONS.reauthenticated,
        },
      });
    }

    await transaction.authSession.create({
      data: {
        absoluteExpiresAt,
        authenticatedAt: now,
        idleExpiresAt,
        lastActivityAt: now,
        tokenHash: hashToken(token),
        userId,
      },
    });
  });

  (await cookies()).set(
    SESSION_COOKIE_NAME,
    token,
    cookieOptions(absoluteExpiresAt),
  );
  await clearExpirationMarker();
}

export async function getCurrentUser() {
  const result = await inspectCurrentSession();
  return result.status === "active" ? result.user : null;
}

export async function requireUser(options?: { activity?: "meaningful" }) {
  if (options?.activity === "meaningful") {
    const result = await recordSessionActivity();
    if (result.status === "active" && result.user) return result.user;
    redirect(
      isExpiredStatus(result.status)
        ? "/api/session/end?reason=expired"
        : "/api/session/end",
    );
  }

  const result = await inspectCurrentSession();
  if (result.status === "active" && result.user) return result.user;
  redirect(
    isExpiredStatus(result.status)
      ? "/api/session/end?reason=expired"
      : "/api/session/end",
  );
}

export async function requireApiUser(options?: { activity?: "meaningful" }) {
  const result =
    options?.activity === "meaningful"
      ? await recordSessionActivity()
      : await inspectCurrentSession();
  if (result.status === "active" && result.user) return result.user;
  throw new AuthRequiredError(result.status);
}

export async function getSessionStatus(now = new Date()) {
  const result = await inspectCurrentSession(now);
  return {
    absoluteExpiresAt: result.absoluteExpiresAt?.toISOString() ?? null,
    canRenew:
      result.status === "active" &&
      result.absoluteExpiresAt !== null &&
      result.absoluteExpiresAt.getTime() > now.getTime(),
    idleExpiresAt: result.idleExpiresAt?.toISOString() ?? null,
    serverNow: now.toISOString(),
    status: result.status,
    warningThresholdSeconds: sessionPolicy.warningThresholdSeconds,
  };
}

export async function recordSessionActivity(now = new Date()) {
  const result = await inspectCurrentSession(now);
  if (result.status !== "active" || !result.sessionId) return result;

  const throttleCutoff = new Date(
    now.getTime() - sessionPolicy.activityThrottleMs,
  );
  if (result.lastActivityAt! > throttleCutoff) return result;
  const idleExpiresAt = new Date(
    Math.min(
      now.getTime() + sessionPolicy.idleTimeoutMs,
      result.absoluteExpiresAt!.getTime(),
    ),
  );
  const updated = await db.authSession.updateMany({
    where: {
      id: result.sessionId,
      revokedAt: null,
      lastActivityAt: { lte: throttleCutoff },
      idleExpiresAt: { gt: now },
      absoluteExpiresAt: { gt: now },
    },
    data: { idleExpiresAt, lastActivityAt: now },
  });
  if (updated.count === 0) return inspectCurrentSession(now);

  return {
    ...result,
    idleExpiresAt:
      idleExpiresAt > result.idleExpiresAt!
        ? idleExpiresAt
        : result.idleExpiresAt,
  };
}

export async function renewSession(now = new Date()) {
  const result = await inspectCurrentSession(now);
  if (result.status !== "active" || !result.sessionId) return result;

  const idleExpiresAt = new Date(
    Math.min(
      now.getTime() + sessionPolicy.idleTimeoutMs,
      result.absoluteExpiresAt!.getTime(),
    ),
  );
  const updated = await db.authSession.updateMany({
    where: {
      id: result.sessionId,
      revokedAt: null,
      idleExpiresAt: { gt: now },
      absoluteExpiresAt: { gt: now },
    },
    data: { idleExpiresAt, lastActivityAt: now },
  });

  if (updated.count === 0) return inspectCurrentSession(now);
  return { ...result, idleExpiresAt };
}

export async function deleteSession(
  reason: string = SESSION_REVOCATION_REASONS.userLogout,
) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (isValidToken(token)) {
    await db.authSession.updateMany({
      where: { tokenHash: hashToken(token), revokedAt: null },
      data: { revokedAt: new Date(), revocationReason: reason },
    });
  }
  await clearSessionCookie();
  await clearExpirationMarker();
}

export async function clearInvalidSessionCookie(reason?: "expired") {
  await clearSessionCookie();
  if (reason === "expired") await markSessionExpired();
  else await clearExpirationMarker();
}
