import { Card } from "@/components/ui/card";
import { ThemeControl } from "@/components/theme/theme-control";
import { sessionPolicy } from "@/lib/session-policy";
import Link from "next/link";

function duration(milliseconds: number) {
  const minutes = milliseconds / 60_000;
  if (!Number.isInteger(minutes)) {
    const seconds = milliseconds / 1000;
    return `${seconds} ${seconds === 1 ? "second" : "seconds"}`;
  }
  if (minutes >= 60 && minutes % 60 === 0) {
    const hours = minutes / 60;
    return `${hours} ${hours === 1 ? "hour" : "hours"}`;
  }
  return `${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
}

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="mt-2 text-[var(--text-secondary)]">
          Review application preferences and security behavior.
        </p>
      </div>
      <Card className="p-6">
        <ThemeControl variant="settings" />
      </Card>
      <Card className="p-6">
        <h2 className="text-xl font-semibold">Data &amp; imports</h2>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          Import supported statements or balance and holding CSVs, review
          proposed changes, and manage Import History, Undo, and retained
          sources.
        </p>
        <Link
          href="/settings/imports"
          className="mt-4 inline-block font-semibold text-[var(--semantic-info-text)] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]"
        >
          Open Data &amp; imports
        </Link>
      </Card>
      <Card className="p-6">
        <h2 className="text-xl font-semibold">Session security</h2>
        <div className="mt-3 space-y-2 text-sm text-[var(--text-secondary)]">
          <p>
            For your security, an inactive session ends after{" "}
            {duration(sessionPolicy.idleTimeoutMs)}. A warning appears{" "}
            {duration(sessionPolicy.warningThresholdMs)} before the idle
            deadline.
          </p>
          <p>
            Choosing “Stay signed in” renews only the inactivity deadline. A
            session always ends after{" "}
            {duration(sessionPolicy.absoluteTimeoutMs)} and requires a fresh
            sign-in.
          </p>
          <p>
            These limits are enforced by the server and apply across open
            browser tabs. Unsaved changes may be lost when a session ends.
          </p>
        </div>
      </Card>
    </div>
  );
}
