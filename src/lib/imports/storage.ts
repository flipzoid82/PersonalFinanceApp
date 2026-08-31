import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { getImportConfig } from "./config";

const VERSION = 1;
const HEADER_SIZE = 1 + 12 + 16;
const STORAGE_KEY = /^[a-f0-9]{32}\.bin$/;

function storagePath(storageKey: string, directory: string) {
  if (!STORAGE_KEY.test(storageKey))
    throw new Error("Retained source reference is invalid.");
  const resolved = path.resolve(directory, storageKey);
  if (path.dirname(resolved) !== path.resolve(directory))
    throw new Error("Retained source reference is invalid.");
  return resolved;
}

function keyBytes(keyHex: string) {
  if (!/^[a-fA-F0-9]{64}$/.test(keyHex))
    throw new Error("Statement import storage is unavailable.");
  return Buffer.from(keyHex, "hex");
}

export async function retainEncryptedSource(
  bytes: Uint8Array,
  config = getImportConfig(),
) {
  const storageKey = `${randomBytes(16).toString("hex")}.bin`;
  const iv = randomBytes(12);
  const cipher = createCipheriv(
    "aes-256-gcm",
    keyBytes(config.encryptionKey),
    iv,
  );
  const ciphertext = Buffer.concat([
    cipher.update(Buffer.from(bytes)),
    cipher.final(),
  ]);
  const payload = Buffer.concat([
    Buffer.from([VERSION]),
    iv,
    cipher.getAuthTag(),
    ciphertext,
  ]);
  await mkdir(config.storageDirectory, { recursive: true });
  await writeFile(storagePath(storageKey, config.storageDirectory), payload, {
    flag: "wx",
  });
  return storageKey;
}

export async function readEncryptedSource(
  storageKey: string,
  config = getImportConfig(),
) {
  const payload = await readFile(
    storagePath(storageKey, config.storageDirectory),
  );
  if (payload.length < HEADER_SIZE || payload[0] !== VERSION)
    throw new Error("The retained source could not be authenticated.");
  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      keyBytes(config.encryptionKey),
      payload.subarray(1, 13),
    );
    decipher.setAuthTag(payload.subarray(13, 29));
    return Buffer.concat([
      decipher.update(payload.subarray(HEADER_SIZE)),
      decipher.final(),
    ]);
  } catch {
    throw new Error("The retained source could not be authenticated.");
  }
}

export async function deleteRetainedSource(
  storageKey: string,
  config = getImportConfig(),
) {
  try {
    await unlink(storagePath(storageKey, config.storageDirectory));
    return "deleted" as const;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT")
      return "missing" as const;
    throw new Error("The retained source could not be deleted.");
  }
}
