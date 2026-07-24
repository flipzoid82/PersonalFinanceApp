import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { getPlaidConfig } from "./config";

const VERSION = "v1";
const ALGORITHM = "aes-256-gcm";

function keyBytes(keyHex?: string) {
  const value = keyHex ?? getPlaidConfig().encryptionKey;
  if (!/^[a-fA-F0-9]{64}$/.test(value))
    throw new Error("Plaid token encryption is unavailable.");
  return Buffer.from(value, "hex");
}

export function encryptAccessToken(accessToken: string, keyHex?: string) {
  if (!accessToken) throw new Error("Plaid access token is unavailable.");
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, keyBytes(keyHex), iv);
  const ciphertext = Buffer.concat([
    cipher.update(accessToken, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    VERSION,
    iv.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

export function decryptAccessToken(payload: string, keyHex?: string) {
  const [version, ivValue, tagValue, ciphertextValue, extra] =
    payload.split(".");
  if (version !== VERSION || !ivValue || !tagValue || !ciphertextValue || extra)
    throw new Error("Encrypted Plaid token is invalid.");

  try {
    const decipher = createDecipheriv(
      ALGORITHM,
      keyBytes(keyHex),
      Buffer.from(ivValue, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertextValue, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new Error("Encrypted Plaid token could not be authenticated.");
  }
}
