"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createPortal } from "react-dom";
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
import { useEffect, useId, useRef, useState } from "react";
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
              "flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]",
              active
                ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-950"
                : "text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)]",
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
    <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-[var(--border-default)] bg-[var(--surface-panel)] p-5 lg:block">
      <p className="mb-8 text-lg font-bold tracking-tight">Personal Finance</p>
      <NavLinks />
    </aside>
  );
}

export function MobileNavigation() {
  const [open, setOpen] = useState(false);
  const dialogId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    const trigger = triggerRef.current;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key !== "Tab" || !drawerRef.current) return;

      const focusable = Array.from(
        drawerRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable.at(-1)!;
      if (
        event.shiftKey &&
        (document.activeElement === first ||
          !drawerRef.current.contains(document.activeElement))
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last ||
          !drawerRef.current.contains(document.activeElement))
      ) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      if (trigger?.isConnected) trigger.focus();
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open navigation"
        aria-expanded={open}
        aria-controls={dialogId}
        className="rounded-lg p-2 hover:bg-[var(--surface-subtle)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)] lg:hidden"
      >
        <Menu aria-hidden="true" />
      </button>
      {open
        ? createPortal(
            <div className="fixed inset-0 isolate z-[100] lg:hidden">
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-slate-950/70"
                onClick={() => setOpen(false)}
              />
              <aside
                ref={drawerRef}
                id={dialogId}
                role="dialog"
                aria-modal="true"
                aria-labelledby={`${dialogId}-title`}
                className="absolute inset-y-0 left-0 h-dvh w-[min(18rem,calc(100vw-3rem))] max-w-full overflow-y-auto overscroll-contain border-r border-[var(--border-default)] bg-[var(--surface-panel)] p-5 shadow-xl"
              >
                <div className="mb-7 flex items-center justify-between">
                  <h2 id={`${dialogId}-title`} className="font-bold">
                    Personal Finance
                  </h2>
                  <button
                    ref={closeRef}
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label="Close navigation"
                    className="rounded-lg p-2 hover:bg-[var(--surface-subtle)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
                  >
                    <X aria-hidden="true" />
                  </button>
                </div>
                <NavLinks onNavigate={() => setOpen(false)} />
              </aside>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
