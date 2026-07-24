import { describe, expect, it } from "vitest";
import { decryptAccessToken, encryptAccessToken } from "./crypto";

const KEY = "a".repeat(64);
const OTHER_KEY = "b".repeat(64);

describe("Plaid access-token encryption", () => {
  it("round trips with versioned AES-256-GCM payloads", () => {
    const encrypted = encryptAccessToken("access-sandbox-fixture", KEY);
    expect(encrypted.startsWith("v1.")).toBe(true);
    expect(encrypted).not.toContain("access-sandbox-fixture");
    expect(decryptAccessToken(encrypted, KEY)).toBe("access-sandbox-fixture");
  });

  it("uses a unique random nonce for every encryption", () => {
    const first = encryptAccessToken("same-token", KEY);
    const second = encryptAccessToken("same-token", KEY);
    expect(first).not.toBe(second);
  });

  it("fails closed with the wrong key", () => {
    const encrypted = encryptAccessToken("same-token", KEY);
    expect(() => decryptAccessToken(encrypted, OTHER_KEY)).toThrow(
      "could not be authenticated",
    );
  });

  it("fails closed after ciphertext tampering", () => {
    const encrypted = encryptAccessToken("same-token", KEY);
    const parts = encrypted.split(".");
    parts[3] = `${parts[3].startsWith("A") ? "B" : "A"}${parts[3].slice(1)}`;
    const tampered = parts.join(".");
    expect(() => decryptAccessToken(tampered, KEY)).toThrow(
      "could not be authenticated",
    );
  });
});
