// @vitest-environment node

import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password";

describe("owner password authentication", () => {
  it("continues to accept the owner password and reject a different value", async () => {
    const hash = await hashPassword("synthetic-owner-password");

    await expect(
      verifyPassword("synthetic-owner-password", hash),
    ).resolves.toBe(true);
    await expect(verifyPassword("incorrect-password", hash)).resolves.toBe(
      false,
    );
  });

  it("rejects malformed stored hashes", async () => {
    await expect(
      verifyPassword("synthetic-owner-password", "not-a-password-hash"),
    ).resolves.toBe(false);
  });
});
