import type { ButtonHTMLAttributes, Ref } from "react";
import { cn } from "@/lib/utils";

export function Button({
  className,
  ref,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { ref?: Ref<HTMLButtonElement> }) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex min-h-10 items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)] disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-white",
        className,
      )}
      {...props}
    />
  );
}
