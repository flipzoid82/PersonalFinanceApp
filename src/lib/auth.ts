import "server-only";
import { createHmac, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

const COOKIE_NAME = "finance_session";
const SESSION_LENGTH_MS = 1000 * 60 * 60 * 24 * 30;

function tokenHash(token: string) {
  return createHmac("sha256", env.AUTH_SECRET).update(token).digest("hex");
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_LENGTH_MS);

  await db.authSession.create({
    data: { tokenHash: tokenHash(token), expiresAt, userId },
  });
  (await cookies()).set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function getCurrentUser() {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;

  const session = await db.authSession.findUnique({
    where: { tokenHash: tokenHash(token) },
    include: { user: true },
  });

  if (!session || session.expiresAt <= new Date()) return null;
  return {
    id: session.user.id,
    email: session.user.email,
    displayName: session.user.displayName,
  };
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function deleteSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (token) {
    await db.authSession.deleteMany({ where: { tokenHash: tokenHash(token) } });
  }
  cookieStore.delete(COOKIE_NAME);
}
