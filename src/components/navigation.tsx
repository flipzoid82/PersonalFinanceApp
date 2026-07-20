"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Building2,
  CalendarDays,
  CreditCard,
  LayoutDashboard,
  Landmark,
  List,
  Menu,
  PiggyBank,
  Settings,
  X,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export const navigation = [
  { label: "Overview", href: "/overview", icon: LayoutDashboard },
  { label: "Accounts", href: "/accounts", icon: Landmark },
  { label: "Transactions", href: "/transactions", icon: List },
  { label: "Bills", href: "/bills", icon: CreditCard },
  { label: "Calendar", href: "/calendar", icon: CalendarDays },
  { label: "Spending", href: "/spending", icon: BarChart3 },
  { label: "Investments", href: "/investments", icon: PiggyBank },
  { label: "Net Worth", href: "/net-worth", icon: Building2 },
  { label: "Settings", href: "/settings", icon: Settings },
] as const;

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main navigation" className="space-y-1">
      {navigation.map(({ label, href, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900",
              active
                ? "bg-slate-900 text-white"
                : "text-slate-700 hover:bg-slate-100",
            )}
          >
            <Icon aria-hidden="true" size={19} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export function DesktopNavigation() {
  return (
    <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-slate-200 bg-white p-5 lg:block">
      <p className="mb-8 text-lg font-bold tracking-tight">Personal Finance</p>
      <NavLinks />
    </aside>
  );
}

export function MobileNavigation() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open navigation"
        aria-expanded={open}
        className="rounded-lg p-2 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 lg:hidden"
      >
        <Menu aria-hidden="true" />
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            aria-label="Close navigation overlay"
            className="absolute inset-0 bg-slate-900/40"
            onClick={() => setOpen(false)}
          />
          <aside className="relative h-full w-72 bg-white p-5 shadow-xl">
            <div className="mb-7 flex items-center justify-between">
              <p className="font-bold">Personal Finance</p>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close navigation"
                className="rounded-lg p-2 hover:bg-slate-100 focus-visible:outline-2"
              >
                <X aria-hidden="true" />
              </button>
            </div>
            <NavLinks onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      ) : null}
    </>
  );
}
