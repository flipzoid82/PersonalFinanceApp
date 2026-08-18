"use client";

import { MonitorCog, Moon, Sun } from "lucide-react";
import { useId } from "react";
import { useThemePreference } from "./theme-provider";
import type { ThemePreference } from "@/lib/theme";

const choices: Array<{
  value: ThemePreference;
  label: string;
  description: string;
  icon: typeof Sun;
}> = [
  {
    value: "light",
    label: "Light",
    description: "Always use the light appearance.",
    icon: Sun,
  },
  {
    value: "dark",
    label: "Dark",
    description: "Always use the dark appearance.",
    icon: Moon,
  },
  {
    value: "system",
    label: "System",
    description: "Follow this device's light or dark preference.",
    icon: MonitorCog,
  },
];

export function ThemeControl({
  variant = "compact",
}: {
  variant?: "compact" | "settings";
}) {
  const { preference, setPreference } = useThemePreference();
  const id = useId();

  if (variant === "compact") {
    const nextPreference = preference === "dark" ? "light" : "dark";
    const CompactIcon =
      preference === "light" ? Moon : preference === "dark" ? Sun : MonitorCog;
    const actionLabel =
      preference === "system"
        ? "System theme active. Activate to switch to Dark theme."
        : `Switch to ${nextPreference === "dark" ? "Dark" : "Light"} theme.`;
    return (
      <button
        type="button"
        aria-label={actionLabel}
        title={actionLabel}
        data-theme-preference={preference}
        onClick={() => setPreference(nextPreference)}
        className="inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-[var(--border-default)] bg-[var(--surface-panel)] px-2.5 text-sm font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-subtle)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
      >
        <CompactIcon className="size-4 shrink-0" aria-hidden="true" />
        {preference === "system" ? <span>System</span> : null}
      </button>
    );
  }

  return (
    <fieldset>
      <legend className="font-semibold">Appearance</legend>
      <p className="mt-1 text-sm text-[var(--text-secondary)]">
        Choose a theme for this browser. System follows your device setting.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {choices.map(({ value, label, description, icon: Icon }) => (
          <label
            key={value}
            className="flex min-w-0 cursor-pointer items-start gap-3 rounded-xl border border-[var(--border-default)] bg-[var(--surface-panel)] p-4 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--focus-ring)] has-[:checked]:border-[var(--semantic-info-border)] has-[:checked]:bg-[var(--semantic-info-bg)]"
          >
            <input
              id={`${id}-${value}`}
              type="radio"
              name={`${id}-theme`}
              value={value}
              checked={preference === value}
              onChange={() => setPreference(value)}
              className="mt-1"
            />
            <span className="min-w-0">
              <span className="flex items-center gap-2 font-semibold">
                <Icon className="size-4 shrink-0" aria-hidden="true" />
                {label}
              </span>
              <span className="mt-1 block text-sm text-[var(--text-secondary)]">
                {description}
              </span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
