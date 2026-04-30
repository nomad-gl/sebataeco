/**
 * Field-level AES-256-GCM encryption for sensitive database columns.
 * Uses Node.js built-in `crypto` module — no external dependencies.
 *
 * Format: base64(iv[12] + authTag[16] + ciphertext)
 *
 * Key derivation: PBKDF2-SHA256 from JWT_SECRET (32 bytes).
 * The derived key is cached in memory after first use.
 */
import crypto from "crypto";
import { ENV } from "./env.js";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;   // 96-bit IV recommended for GCM
const TAG_LENGTH = 16;  // 128-bit auth tag

let _derivedKey: Buffer | null = null;

function getDerivedKey(): Buffer {
  if (_derivedKey) return _derivedKey;
  // Derive a 32-byte key from JWT_SECRET using PBKDF2
  _derivedKey = crypto.pbkdf2Sync(
    ENV.cookieSecret,
    "seba-field-encryption-v1",
    100_000,
    32,
    "sha256"
  );
  return _derivedKey;
}

/**
 * Encrypt a plaintext string.
 * Returns a base64-encoded string containing IV + authTag + ciphertext.
 * Returns null if input is null/undefined.
 */
export function encryptField(plaintext: string | null | undefined): string | null {
  if (plaintext == null) return null;
  const key = getDerivedKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: TAG_LENGTH,
  });
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  // Pack: iv (12) + authTag (16) + ciphertext
  const packed = Buffer.concat([iv, authTag, encrypted]);
  return packed.toString("base64");
}

/**
 * Decrypt a base64-encoded encrypted field.
 * Returns null if input is null/undefined or decryption fails.
 */
export function decryptField(encoded: string | null | undefined): string | null {
  if (encoded == null) return null;
  try {
    const key = getDerivedKey();
    const packed = Buffer.from(encoded, "base64");
    if (packed.length < IV_LENGTH + TAG_LENGTH + 1) return null;
    const iv = packed.subarray(0, IV_LENGTH);
    const authTag = packed.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const ciphertext = packed.subarray(IV_LENGTH + TAG_LENGTH);
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
      authTagLength: TAG_LENGTH,
    });
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);
    return decrypted.toString("utf8");
  } catch {
    // Decryption failure (tampered data, wrong key, etc.)
    return null;
  }
}

/**
 * Encrypt an object's specified fields in-place, returning a new object.
 * Fields not in the list are passed through unchanged.
 *
 * @example
 * const row = encryptFields(input, ["notes", "personalDetails"]);
 */
export function encryptFields<T extends Record<string, unknown>>(
  obj: T,
  fields: (keyof T)[]
): T {
  const result = { ...obj };
  for (const field of fields) {
    const val = result[field];
    if (typeof val === "string") {
      (result as Record<string, unknown>)[field as string] = encryptField(val);
    }
  }
  return result;
}

/**
 * Decrypt an object's specified fields in-place, returning a new object.
 */
export function decryptFields<T extends Record<string, unknown>>(
  obj: T,
  fields: (keyof T)[]
): T {
  const result = { ...obj };
  for (const field of fields) {
    const val = result[field];
    if (typeof val === "string") {
      (result as Record<string, unknown>)[field as string] = decryptField(val);
    }
  }
  return result;
}
