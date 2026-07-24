import { logout } from "@/actions/auth";
import { DesktopNavigation, MobileNavigation } from "@/components/navigation";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  return (
    <div className="min-h-screen">
      <DesktopNavigation />
      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex min-h-16 items-center justify-between border-b border-[var(--border-default)] bg-[color-mix(in_srgb,var(--surface-panel)_95%,transparent)] px-4 backdrop-blur sm:px-6 lg:px-8">
          <MobileNavigation />
          <p className="hidden truncate text-sm text-[var(--text-secondary)] sm:block">
            Signed in as {user.displayName ?? user.email}
          </p>
          <form action={logout}>
            <Button
              type="submit"
              className="min-h-9 bg-[var(--surface-panel)] px-3 text-[var(--text-primary)] ring-1 ring-[var(--border-default)] hover:bg-[var(--surface-subtle)] dark:bg-[var(--surface-panel)] dark:text-[var(--text-primary)]"
            >
              Sign out
            </Button>
          </form>
        </header>
        <main className="p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
