"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

type FormAction = (formData: FormData) => void | Promise<void>;

export function ImportConfirmationDialog({
  triggerLabel,
  title,
  description,
  confirmLabel,
  action,
  importId,
  destructive = false,
}: {
  triggerLabel: string;
  title: string;
  description: string;
  confirmLabel: string;
  action: FormAction;
  importId: string;
  destructive?: boolean;
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
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusable = () =>
      Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([type="hidden"]):not([disabled])',
        ) ?? [],
      );
    focusable()[0]?.focus();
    function keydown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      } else if (event.key === "Tab") {
        const elements = focusable();
        const first = elements[0];
        const last = elements.at(-1);
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
    document.addEventListener("keydown", keydown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", keydown);
    };
  }, [open]);
  return (
    <>
      <Button ref={triggerRef} onClick={() => setOpen(true)}>
        {triggerLabel}
      </Button>
      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4"
          onMouseDown={(event) =>
            event.target === event.currentTarget && close()
          }
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            className="max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-xl border border-[var(--border-default)] bg-[var(--surface-panel)] p-6 text-[var(--text-primary)] shadow-2xl"
          >
            <h2 id={titleId} className="text-xl font-bold">
              {title}
            </h2>
            <p
              id={descriptionId}
              className="mt-3 text-sm text-[var(--text-secondary)]"
            >
              {description}
            </p>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <Button onClick={close}>Cancel</Button>
              <form action={action}>
                <input type="hidden" name="importId" value={importId} />
                <Button
                  type="submit"
                  className={
                    destructive
                      ? "bg-[var(--semantic-negative-solid)] text-white"
                      : "bg-[var(--semantic-info-solid)] text-white"
                  }
                >
                  {confirmLabel}
                </Button>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
