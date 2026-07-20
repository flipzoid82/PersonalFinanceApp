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
        <header className="sticky top-0 z-30 flex min-h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6 lg:px-8">
          <MobileNavigation />
          <p className="hidden truncate text-sm text-slate-600 sm:block">
            Signed in as {user.displayName ?? user.email}
          </p>
          <form action={logout}>
            <Button className="min-h-9 bg-white px-3 text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50">
              Sign out
            </Button>
          </form>
        </header>
        <main className="p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
