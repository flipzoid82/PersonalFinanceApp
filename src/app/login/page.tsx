import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { Card } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/overview");
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
        <LoginForm />
      </Card>
    </main>
  );
}
