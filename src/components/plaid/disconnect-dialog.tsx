"use client";

import { useEffect, useId, useRef, useState } from "react";
import { disconnectPlaidConnectionAction } from "@/actions/plaid";
import { Button } from "@/components/ui/button";

export function DisconnectPlaidDialog({
  connectionId,
  institutionName,
}: {
  connectionId: string;
  institutionName: string;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  function close() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    const elements = () =>
      Array.from(dialog?.querySelectorAll<HTMLElement>("button") ?? []);
    elements()[0]?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      } else if (event.key === "Tab") {
        const focusable = elements();
        const first = focusable[0];
        const last = focusable.at(-1);
        if (!first || !last) return;
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      <Button ref={triggerRef} type="button" onClick={() => setOpen(true)}>
        Disconnect
      </Button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            className="w-full max-w-lg rounded-xl border border-[var(--border-default)] bg-[var(--surface-panel)] p-6 shadow-2xl"
          >
            <h2 id={titleId} className="text-xl font-bold">
              Disconnect {institutionName}?
            </h2>
            <div
              id={descriptionId}
              className="mt-3 space-y-3 text-sm text-[var(--text-secondary)]"
            >
              <p>
                This removes the Sandbox Item from Plaid and stops future
                synchronization.
              </p>
              <p>
                Historical local accounts and transactions are preserved for
                traceability, but disconnected balances are excluded from
                current totals. This does not delete transactions.
              </p>
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <Button type="button" onClick={close}>
                Cancel
              </Button>
              <form action={disconnectPlaidConnectionAction}>
                <input type="hidden" name="connectionId" value={connectionId} />
                <Button
                  type="submit"
                  className="bg-rose-700 hover:bg-rose-800 dark:bg-rose-300 dark:text-rose-950"
                >
                  Disconnect Sandbox
                </Button>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
