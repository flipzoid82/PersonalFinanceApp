"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

type FormAction = (formData: FormData) => void | Promise<void>;

type HiddenField = {
  name: string;
  value: string;
};

function HiddenFields({ fields }: { fields: HiddenField[] }) {
  return fields.map(({ name, value }) => (
    <input key={name} type="hidden" name={name} value={value} />
  ));
}

export function DeleteConfirmationDialog({
  recordName,
  recordType,
  triggerLabel,
  deleteAction,
  deleteFields,
  deactivateAction,
  deactivateFields = [],
  dependencyWarning,
}: {
  recordName: string;
  recordType: string;
  triggerLabel: string;
  deleteAction: FormAction;
  deleteFields: HiddenField[];
  deactivateAction?: FormAction;
  deactivateFields?: HiddenField[];
  dependencyWarning?: string;
}) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  function close() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  useEffect(() => {
    if (!open) return;

    const dialog = dialogRef.current;
    const focusableSelector =
      'button:not([disabled]), [href], input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const focusableElements = () =>
      Array.from(
        dialog?.querySelectorAll<HTMLElement>(focusableSelector) ?? [],
      );

    focusableElements()[0]?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== "Tab") return;

      const elements = focusableElements();
      if (!elements.length) return;
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (!dialog?.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  return (
    <>
      <Button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        className="bg-rose-700 hover:bg-rose-800 dark:bg-rose-300 dark:text-rose-950"
      >
        {triggerLabel}
      </Button>
      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) close();
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            className="w-full max-w-lg rounded-xl border border-[var(--border-default)] bg-[var(--surface-panel)] p-6 text-[var(--text-primary)] shadow-2xl"
          >
            <h2 id={titleId} className="text-xl font-bold">
              Permanently delete {recordName}?
            </h2>
            <div
              id={descriptionId}
              className="mt-3 space-y-3 text-sm text-[var(--text-secondary)]"
            >
              <p>
                You are about to permanently delete the {recordType} “
                {recordName}”. This deletion is permanent and cannot be undone.
              </p>
              {dependencyWarning ? (
                <p className="rounded-lg border border-[var(--semantic-warning-border)] bg-[var(--semantic-warning-bg)] p-3 text-[var(--semantic-warning-text)]">
                  {dependencyWarning}
                </p>
              ) : null}
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <Button type="button" onClick={close}>
                Cancel
              </Button>
              {deactivateAction ? (
                <form action={deactivateAction}>
                  <HiddenFields fields={deactivateFields} />
                  <Button
                    type="submit"
                    className="bg-amber-700 hover:bg-amber-800 dark:bg-amber-300 dark:text-amber-950"
                  >
                    Deactivate instead
                  </Button>
                </form>
              ) : null}
              <form action={deleteAction}>
                <HiddenFields fields={deleteFields} />
                <Button
                  type="submit"
                  className="bg-rose-700 hover:bg-rose-800 dark:bg-rose-300 dark:text-rose-950"
                >
                  Delete permanently
                </Button>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
