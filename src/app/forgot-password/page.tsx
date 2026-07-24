import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = { title: "Password recovery" };

export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-5">
      <Card className="w-full max-w-lg p-7 sm:p-9">
        <p className="text-sm font-semibold text-[var(--text-secondary)]">
          OWNER ACCOUNT RECOVERY
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">
          Password recovery is not configured
        </h1>
        <p className="mt-4 text-[var(--text-secondary)]">
          This private dashboard does not currently send password-reset emails
          or accept recovery answers. No reset request has been created.
        </p>
        <p className="mt-3 text-[var(--text-secondary)]">
          Ask the person who operates this installation to restore access using
          the local owner-account administration command.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-flex min-h-10 items-center rounded-lg border border-[var(--border-default)] bg-[var(--surface-subtle)] px-4 py-2 text-sm font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-panel)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
        >
          Back to sign in
        </Link>
      </Card>
    </main>
  );
}
