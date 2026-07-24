import { ConnectionStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { semanticToneClasses } from "@/components/ui/semantic";
import { plaidStatusPresentation } from "./status";

const NOW = new Date("2026-07-23T12:00:00.000Z");

describe("Plaid semantic connection states", () => {
  it.each([
    [ConnectionStatus.ACTIVE, NOW, null, "Syncing", "info"],
    [
      ConnectionStatus.NEEDS_REAUTHENTICATION,
      null,
      NOW,
      "Repair needed",
      "warning",
    ],
    [ConnectionStatus.ERROR, null, NOW, "Error", "negative"],
    [ConnectionStatus.DISCONNECTED, null, NOW, "Disconnected", "muted"],
    [
      ConnectionStatus.ACTIVE,
      null,
      new Date("2026-07-01T12:00:00.000Z"),
      "Stale",
      "warning",
    ],
    [ConnectionStatus.ACTIVE, null, NOW, "Ready", "info"],
  ] as const)(
    "labels connection states without relying on color alone",
    (status, syncStartedAt, lastSuccessfulSyncAt, label, tone) => {
      expect(
        plaidStatusPresentation(
          { status, syncStartedAt, lastSuccessfulSyncAt },
          NOW,
        ),
      ).toEqual({ label, tone });
    },
  );

  it("uses theme-variable styles for light and dark rendering", () => {
    expect(semanticToneClasses.info).toContain("var(--semantic-info-bg)");
    expect(semanticToneClasses.warning).toContain("var(--semantic-warning-bg)");
    expect(semanticToneClasses.negative).toContain(
      "var(--semantic-negative-bg)",
    );
  });
});
