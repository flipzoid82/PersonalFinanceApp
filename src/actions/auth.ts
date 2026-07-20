"use server";

import { redirect } from "next/navigation";
import { createSession, deleteSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/password";

export type LoginState = { error?: string };

export async function login(
  _: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  const user = await db.user.findUnique({ where: { email } });

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return { error: "The email or password is incorrect." };
  }

  await createSession(user.id);
  redirect("/overview");
}

export async function logout() {
  await deleteSession();
  redirect("/login");
}
