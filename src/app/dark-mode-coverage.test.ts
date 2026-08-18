// @vitest-environment node

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const THEMED_SURFACES = [
  "src/components/login-form.tsx",
  "src/app/login/page.tsx",
  "src/components/dashboard/metric-card.tsx",
  "src/components/dashboard/overview-dashboard.tsx",
  "src/components/dashboard/overview-panels.tsx",
  "src/components/calendar/calendar-page.tsx",
  "src/components/calendar/calendar-controls.tsx",
  "src/components/calendar/month-view.tsx",
  "src/components/calendar/upcoming-list.tsx",
  "src/components/ui/skeleton.tsx",
];

describe("broad theme coverage", () => {
  it.each(THEMED_SURFACES)(
    "%s uses shared surface or semantic theme tokens",
    (file) => {
      const source = readFileSync(file, "utf8");
      expect(source).toContain("var(--");
      expect(source).not.toMatch(
        /(?:bg-white|bg-slate-(?:50|100|200)|text-slate-(?:400|500|600|700|800|900)|border-slate-(?:200|300)|focus-visible:outline-slate-900)/,
      );
    },
  );
});
