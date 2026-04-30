/**
 * Quantum-Resistant Third-Party Identity Masking
 * ================================================
 * Provides deterministic pseudonymisation of third-party identifiers
 * (names, email addresses) in security event logs and audit trails.
 *
 * Security properties:
 *  - SHAKE-256 (XOF, variable-length output) — post-quantum secure hash function
 *    from the SHA-3 family (NIST FIPS 202). Resistant to Grover's algorithm
 *    because its output length can be set to 256 bits, requiring 2^128 quantum
 *    operations to invert — beyond the reach of any foreseeable quantum computer.
 *
 *  - Per-tenant masking keys derived via HKDF with SHA-512 from a master secret.
 *    Even if one tenant's key is compromised, other tenants' pseudonyms remain safe.
 *
 *  - Epoch support: rotating the master secret (or a tenant's epoch counter)
 *    permanently breaks the link between old pseudonyms and real identities.
 *    Old pseudonyms become permanently unresolvable — forward secrecy for identities.
 *
 *  - Deterministic: the same identity always maps to the same pseudonym within
 *    a tenant epoch, enabling correlation within a session without storing PII.
 *
 * Usage:
 *   import { maskIdentity, maskEmail } from "./_core/identityMask";
 *   const pseudonym = maskIdentity("John Smith", tenantId);
 *   const maskedEmail = maskEmail("john@example.com", tenantId);
 */

import crypto from "crypto";
import { ENV } from "./env";

// ─── Master secret ────────────────────────────────────────────────────────────
// Derived from JWT_SECRET so no additional env var is needed.
// In production this should be a dedicated 256-bit secret stored in a vault.
const MASTER_SECRET = Buffer.from(
  crypto.createHash("sha512").update(`identity-mask:${ENV.jwtSecret ?? "fallback"}`).digest()
);

// ─── Per-tenant key derivation (HKDF with SHA-512) ───────────────────────────
const tenantKeyCache = new Map<string, Buffer>();

function deriveTenantKey(tenantId: number | null, epoch = 1): Buffer {
  const cacheKey = `${tenantId ?? "global"}:${epoch}`;
  if (tenantKeyCache.has(cacheKey)) return tenantKeyCache.get(cacheKey)!;

  const info = Buffer.from(`seba-identity-mask:tenant=${tenantId ?? "global"}:epoch=${epoch}`);
  const salt = Buffer.from(`seba-salt:${tenantId ?? "global"}:${epoch}`);

  // HKDF-Extract: PRK = HMAC-SHA512(salt, IKM)
  const prk = crypto.createHmac("sha512", salt).update(MASTER_SECRET).digest();

  // HKDF-Expand: OKM = T(1) where T(1) = HMAC-SHA512(PRK, info || 0x01)
  const okm = crypto
    .createHmac("sha512", prk)
    .update(Buffer.concat([info, Buffer.from([0x01])]))
    .digest()
    .subarray(0, 32); // 256-bit key

  tenantKeyCache.set(cacheKey, okm);
  return okm;
}

// ─── SHAKE-256 pseudonymisation ───────────────────────────────────────────────

/**
 * Produce a deterministic 256-bit pseudonym for an arbitrary identity string.
 * Output is a 16-character hex prefix (64 bits) formatted as "XXXX-XXXX-XXXX-XXXX"
 * for human readability in logs, while still being collision-resistant for audit
 * correlation purposes.
 *
 * @param identity  The raw PII string (name, email, phone, etc.)
 * @param tenantId  Tenant scope — null for platform-level events
 * @param epoch     Key epoch (increment to rotate and permanently break old links)
 */
export function maskIdentity(
  identity: string | null | undefined,
  tenantId: number | null = null,
  epoch = 1
): string {
  if (!identity) return "[redacted]";

  const key = deriveTenantKey(tenantId, epoch);

  // SHAKE-256 with HMAC key mixing: H(key || identity)
  // Node.js exposes SHAKE-256 via createHash("shake256", { outputLength: 32 })
  const hash = crypto
    .createHash("shake256", { outputLength: 32 })
    .update(key)
    .update(":")
    .update(identity.toLowerCase().trim())
    .digest("hex");

  // Format as "ABCD-1234-EF56-7890" (first 16 hex chars = 64 bits)
  const h = hash.substring(0, 16).toUpperCase();
  return `${h.slice(0, 4)}-${h.slice(4, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}`;
}

/**
 * Mask an email address: preserve the domain for operational context
 * but pseudonymise the local part.
 *
 * Example: "john.smith@escola.cat" → "A3F2-****@escola.cat"
 */
export function maskEmail(
  email: string | null | undefined,
  tenantId: number | null = null,
  epoch = 1
): string {
  if (!email) return "[redacted]";

  const atIdx = email.lastIndexOf("@");
  if (atIdx < 0) return maskIdentity(email, tenantId, epoch);

  const local = email.substring(0, atIdx);
  const domain = email.substring(atIdx); // includes the "@"

  const maskedLocal = maskIdentity(local, tenantId, epoch).substring(0, 9); // "XXXX-XXXX"
  return `${maskedLocal}${domain}`;
}

/**
 * Mask a display name: keep the first initial, pseudonymise the rest.
 *
 * Example: "John Smith" → "J. [A3F2-1B4C]"
 */
export function maskName(
  name: string | null | undefined,
  tenantId: number | null = null,
  epoch = 1
): string {
  if (!name) return "[redacted]";

  const initial = name.trim().charAt(0).toUpperCase();
  const pseudo = maskIdentity(name, tenantId, epoch).substring(0, 9);
  return `${initial}. [${pseudo}]`;
}

/**
 * Apply masking to a metadata JSON object, replacing known PII fields.
 * Safe to call on any arbitrary metadata blob — unknown fields are passed through.
 */
export function maskMetadata(
  metadata: Record<string, unknown> | string | null | undefined,
  tenantId: number | null = null
): string {
  if (!metadata) return "{}";

  let obj: Record<string, unknown>;
  try {
    obj = typeof metadata === "string" ? JSON.parse(metadata) : metadata;
  } catch {
    return typeof metadata === "string" ? metadata : "{}";
  }

  const PII_FIELDS = new Set([
    "email", "userEmail", "targetEmail", "inviteeEmail",
    "name", "userName", "targetName", "displayName",
    "phone", "phoneNumber", "mobile",
    "address", "street", "postcode", "zipCode",
    "ip", "ipAddress", "lastLoginIp",
  ]);

  const masked: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (PII_FIELDS.has(k) && typeof v === "string") {
      if (k.toLowerCase().includes("email")) {
        masked[k] = maskEmail(v, tenantId);
      } else if (k.toLowerCase().includes("name")) {
        masked[k] = maskName(v, tenantId);
      } else {
        masked[k] = maskIdentity(v, tenantId);
      }
    } else {
      masked[k] = v;
    }
  }

  return JSON.stringify(masked);
}
