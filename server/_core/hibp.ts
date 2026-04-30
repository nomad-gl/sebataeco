/**
 * HaveIBeenPwned (HIBP) k-anonymity password breach check.
 *
 * Uses the Pwned Passwords API v3 range endpoint so the full password (or its
 * hash) is NEVER sent to the remote service.  Only the first 5 hex characters
 * of the SHA-1 hash are transmitted; the server returns all matching suffixes
 * and we check locally whether our full hash is present.
 *
 * Reference: https://haveibeenpwned.com/API/v3#PwnedPasswords
 */

import crypto from "crypto";

const HIBP_API = "https://api.pwnedpasswords.com/range/";
/** Timeout for the HIBP request — fail open (don't block the user) if slow */
const HIBP_TIMEOUT_MS = 3000;

export type HibpResult =
  | { breached: false }
  | { breached: true; count: number };

/**
 * Checks whether the given plain-text password appears in the HIBP breach
 * database using the k-anonymity range model.
 *
 * Returns `{ breached: false }` on any network/parse error so the caller is
 * never blocked by an external service outage.
 */
export async function checkPasswordBreached(
  plainPassword: string
): Promise<HibpResult> {
  try {
    const sha1 = crypto
      .createHash("sha1")
      .update(plainPassword)
      .digest("hex")
      .toUpperCase();

    const prefix = sha1.slice(0, 5);
    const suffix = sha1.slice(5);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), HIBP_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(`${HIBP_API}${prefix}`, {
        headers: {
          "Add-Padding": "true", // mitigates traffic analysis
          "User-Agent": "SEBA-AI-Studio/1.0 (+https://sebataeco.com)",
        },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      // Fail open — don't penalise the user for HIBP being unavailable
      console.warn(`[HIBP] API returned ${response.status} — skipping check`);
      return { breached: false };
    }

    const text = await response.text();
    const lines = text.split("\r\n");

    for (const line of lines) {
      const [hashSuffix, countStr] = line.split(":");
      if (hashSuffix?.trim().toUpperCase() === suffix) {
        const count = parseInt(countStr ?? "0", 10);
        return { breached: true, count: isNaN(count) ? 1 : count };
      }
    }

    return { breached: false };
  } catch (err) {
    // Network error, timeout, or parse failure — fail open
    console.warn("[HIBP] Check failed (fail-open):", (err as Error).message);
    return { breached: false };
  }
}
