// @vitest-environment node

import { randomBytes } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  deleteRetainedSource,
  readEncryptedSource,
  retainEncryptedSource,
} from "./storage";

const directories: string[] = [];
async function config(key = randomBytes(32).toString("hex")) {
  const storageDirectory = await mkdtemp(
    path.join(tmpdir(), "finance-import-test-"),
  );
  directories.push(storageDirectory);
  return { encryptionKey: key, storageDirectory };
}

afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("encrypted retained import sources", () => {
  it("encrypts with a fresh nonce and decrypts only with the correct key", async () => {
    const settings = await config("1".repeat(64));
    const first = await retainEncryptedSource(
      Buffer.from("synthetic statement"),
      settings,
    );
    const second = await retainEncryptedSource(
      Buffer.from("synthetic statement"),
      settings,
    );
    expect(first).not.toBe(second);
    expect(
      await readFile(path.join(settings.storageDirectory, first)),
    ).not.toContain(Buffer.from("synthetic statement"));
    expect((await readEncryptedSource(first, settings)).toString()).toBe(
      "synthetic statement",
    );
    await expect(
      readEncryptedSource(first, {
        ...settings,
        encryptionKey: "2".repeat(64),
      }),
    ).rejects.toThrow("authenticated");
  });

  it("rejects tampering and path traversal", async () => {
    const settings = await config();
    const key = await retainEncryptedSource(Buffer.from("safe"), settings);
    const file = path.join(settings.storageDirectory, key);
    const payload = await readFile(file);
    payload[payload.length - 1] ^= 1;
    await writeFile(file, payload);
    await expect(readEncryptedSource(key, settings)).rejects.toThrow(
      "authenticated",
    );
    await expect(
      readEncryptedSource("../outside.bin", settings),
    ).rejects.toThrow("invalid");
  });

  it("deletes idempotently when a retained source is already missing", async () => {
    const settings = await config();
    const key = await retainEncryptedSource(Buffer.from("safe"), settings);
    await expect(deleteRetainedSource(key, settings)).resolves.toBe("deleted");
    await expect(deleteRetainedSource(key, settings)).resolves.toBe("missing");
  });
});
