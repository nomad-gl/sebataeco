/**
 * Short-lived re-authentication tokens for sensitive admin operations.
 *
 * Flow:
 *   1. Admin calls `verifyAdminReauth` (password or TOTP) → receives a signed token.
 *   2. Admin passes that token as `reauthToken` in the sensitive mutation input.
 *   3. The mutation calls `validateReauthToken(userId, token)` before proceeding.
 *
 * Tokens are in-memory only (no DB round-trip) and expire after REAUTH_TTL_MS.
 * Each token is single-use — it is deleted from the store on first validation.
 */

import crypto from "crypto";
import { ENV } from "./env";

const REAUTH_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface ReauthEntry {
  userId: number;
  token: string;
  expiresAt: number;
}

// In-memory store keyed by token value
const reauthStore = new Map<string, ReauthEntry>();

// Periodic cleanup of expired tokens (runs every minute)
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of reauthStore.entries()) {
    if (entry.expiresAt < now) reauthStore.delete(key);
  }
}, 60_000);

/**
 * Issue a new re-auth token for the given user.
 * Returns the raw token string to be returned to the client.
 */
export function issueReauthToken(userId: number): string {
  // Derive a HMAC so the token is unforgeable without the JWT_SECRET
  const random = crypto.randomBytes(24).toString("hex");
  const hmac = crypto
    .createHmac("sha256", ENV.jwtSecret ?? "fallback-secret")
    .update(`${userId}:${random}`)
    .digest("hex");
  const token = `${random}.${hmac}`;

  reauthStore.set(token, {
    userId,
    token,
    expiresAt: Date.now() + REAUTH_TTL_MS,
  });

  return token;
}

/**
 * Validate a re-auth token for the given user.
 * Throws an Error if the token is invalid, expired, or belongs to a different user.
 * Deletes the token on success (single-use).
 */
export function validateReauthToken(userId: number, token: string): void {
  const entry = reauthStore.get(token);

  if (!entry) {
    throw new Error("Re-authentication required. Please confirm your credentials and try again.");
  }

  if (entry.expiresAt < Date.now()) {
    reauthStore.delete(token);
    throw new Error("Re-authentication token has expired. Please confirm your credentials again.");
  }

  if (entry.userId !== userId) {
    throw new Error("Re-authentication token mismatch.");
  }

  // Single-use: delete after successful validation
  reauthStore.delete(token);
}
