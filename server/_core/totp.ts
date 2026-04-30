/**
 * TOTP (Time-based One-Time Password) implementation — RFC 6238 / RFC 4226
 * Uses Node.js built-in `crypto` module only — no external dependencies.
 *
 * Compatible with Google Authenticator, Authy, and any RFC 6238 app.
 */
import crypto from "crypto";

const TOTP_DIGITS = 6;
const TOTP_STEP = 30; // seconds
const TOTP_WINDOW = 1; // allow ±1 step for clock drift

/**
 * Generate a cryptographically random Base32-encoded secret (160 bits).
 */
export function generateTotpSecret(): string {
  const bytes = crypto.randomBytes(20);
  return base32Encode(bytes);
}

/**
 * Generate a TOTP code for the given secret and time step.
 */
export function generateTotp(secret: string, step?: number): string {
  const key = base32Decode(secret);
  const counter = Math.floor((step ?? Date.now() / 1000) / TOTP_STEP);
  return hotp(key, counter);
}

/**
 * Verify a TOTP code — allows ±TOTP_WINDOW steps for clock drift.
 */
export function verifyTotp(secret: string, token: string): boolean {
  if (!/^\d{6}$/.test(token)) return false;
  const key = base32Decode(secret);
  const now = Math.floor(Date.now() / 1000 / TOTP_STEP);
  for (let delta = -TOTP_WINDOW; delta <= TOTP_WINDOW; delta++) {
    if (hotp(key, now + delta) === token) return true;
  }
  return false;
}

/**
 * Build an otpauth:// URI for QR code generation.
 * Compatible with Google Authenticator, Authy, etc.
 */
export function buildOtpauthUri(opts: {
  secret: string;
  label: string;   // e.g. "user@example.com"
  issuer: string;  // e.g. "SEBA AI Studio"
}): string {
  const params = new URLSearchParams({
    secret: opts.secret,
    issuer: opts.issuer,
    algorithm: "SHA1",
    digits: String(TOTP_DIGITS),
    period: String(TOTP_STEP),
  });
  const label = encodeURIComponent(opts.label);
  return `otpauth://totp/${label}?${params.toString()}`;
}

// ─── HOTP (HMAC-based OTP) — RFC 4226 ────────────────────────────────────────

function hotp(key: Buffer, counter: number): string {
  const msg = Buffer.alloc(8);
  // Write counter as big-endian 64-bit integer (upper 32 bits are 0 for practical counters)
  msg.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  msg.writeUInt32BE(counter >>> 0, 4);
  const hmac = crypto.createHmac("sha1", key).update(msg).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(code % Math.pow(10, TOTP_DIGITS)).padStart(TOTP_DIGITS, "0");
}

// ─── Base32 codec (RFC 4648) ──────────────────────────────────────────────────

const BASE32_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_CHARS[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_CHARS[(value << (5 - bits)) & 31];
  }
  return output;
}

function base32Decode(str: string): Buffer {
  const clean = str.toUpperCase().replace(/=+$/, "");
  let bits = 0;
  let value = 0;
  const output: number[] = [];
  for (const char of clean) {
    const idx = BASE32_CHARS.indexOf(char);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(output);
}
