import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  detect: vi.fn(),
  redirect: vi.fn(),
  revalidatePath: vi.fn(),
  requireUser: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/auth", () => ({ requireUser: mocks.requireUser }));
vi.mock("@/lib/recurring", () => ({
  runRecurringDetection: mocks.detect,
}));

import { refreshRecurringDetectionAction } from "./recurring";

describe("recurring detection server action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ id: "owner-id" });
    mocks.redirect.mockImplementation((url: string) => {
      throw new Error(`NEXT_REDIRECT:${url}`);
    });
  });

  it("uses the authenticated owner and returns accessible result feedback", async () => {
    mocks.detect.mockResolvedValue({
      eligibleTransactions: 3,
      candidates: 1,
      streamsCreated: 1,
      streamsUpdated: 0,
      projectionsCreated: 3,
      projectionsUpdated: 0,
      transactionsMatched: 0,
      streamsMarkedInactive: 0,
    });
    const formData = new FormData();
    formData.set("returnTo", "/calendar?view=upcoming");

    await expect(refreshRecurringDetectionAction(formData)).rejects.toThrow(
      "NEXT_REDIRECT:/calendar?view=upcoming&message=",
    );
    expect(mocks.requireUser).toHaveBeenCalledOnce();
    expect(mocks.detect).toHaveBeenCalledWith("owner-id");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/calendar");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/overview");
  });

  it("reports detection failure without exposing an internal error", async () => {
    mocks.detect.mockRejectedValue(new Error("private database detail"));
    await expect(
      refreshRecurringDetectionAction(new FormData()),
    ).rejects.toThrow("NEXT_REDIRECT:/calendar?error=");
    expect(mocks.redirect).toHaveBeenCalledWith(
      expect.not.stringContaining("private+database+detail"),
    );
  });
});
