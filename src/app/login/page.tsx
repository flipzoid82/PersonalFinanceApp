import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { Card } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage(
  {
    searchParams,
  }: {
    searchParams: Promise<{ reason?: string }>;
  } = {
    searchParams: Promise.resolve({}),
  },
) {
  if (await getCurrentUser()) redirect("/overview");
  const reason = (await searchParams).reason;
  return (
    <main className="flex min-h-screen items-center justify-center p-5">
      <Card className="w-full max-w-md p-7 sm:p-9">
        <p className="text-sm font-semibold text-slate-500">
          PRIVATE DASHBOARD
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Welcome back</h1>
        <p className="mt-2 mb-7 text-slate-600">
          Sign in with the owner account configured for this application.
        </p>
        {reason === "expired" ? (
          <p
            role="status"
            className="mb-5 rounded-lg border border-[var(--semantic-warning-border)] bg-[var(--semantic-warning-bg)] p-3 text-sm font-medium text-[var(--semantic-warning-text)]"
          >
            Your session expired for your security. Please sign in again.
          </p>
        ) : null}
        <LoginForm />
        <p className="mt-5 text-center text-sm">
          <Link
            href="/forgot-password"
            className="font-semibold text-[var(--semantic-info-text)] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
          >
            Forgot password?
          </Link>
        </p>
      </Card>
    </main>
  );
}
