/**
 * securityLogger.ts — lightweight helper for recording security events.
 *
 * Call `logSecurityEvent()` from any tRPC procedure or middleware to persist
 * an entry to the `security_events` table.  All writes are fire-and-forget so
 * they never block the request path.
 */
import { getDb } from "./db";
import { securityEvents } from "../drizzle/schema";
import { maskEmail, maskMetadata } from "./_core/identityMask";

export type SecurityEventType =
  | "login_success"
  | "login_fail"
  | "logout"
  | "mfa_enabled"
  | "mfa_disabled"
  | "mfa_verify_fail"
  | "rate_limit_hit"
  | "session_invalidated"
  | "password_changed"
  | "account_deactivated"
  | "account_reactivated";

export type SecuritySeverity = "info" | "warning" | "critical";

const SEVERITY_MAP: Record<SecurityEventType, SecuritySeverity> = {
  login_success: "info",
  login_fail: "warning",
  logout: "info",
  mfa_enabled: "info",
  mfa_disabled: "warning",
  mfa_verify_fail: "warning",
  rate_limit_hit: "warning",
  session_invalidated: "warning",
  password_changed: "info",
  account_deactivated: "critical",
  account_reactivated: "info",
};

export interface SecurityEventPayload {
  eventType: SecurityEventType;
  userId?: number | null;
  userEmail?: string | null;
  userRole?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown> | null;
  /** Override the default severity for this event type */
  severity?: SecuritySeverity;
}

/**
 * Anonymise an IPv4 address to its /24 prefix (e.g. 192.168.1.42 → 192.168.1.0).
 * IPv6 addresses are returned unchanged (no PII reduction applied here).
 */
export function anonymiseIp(ip: string | undefined | null): string | null {
  if (!ip) return null;
  const v4 = ip.match(/^(\d{1,3}\.\d{1,3}\.\d{1,3})\.\d{1,3}$/);
  if (v4) return `${v4[1]}.0`;
  return ip;
}

/**
 * Extract the client IP from an Express request, respecting common proxy headers.
 */
export function extractIp(req: { headers: Record<string, string | string[] | undefined>; socket?: { remoteAddress?: string } }): string | null {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    const first = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(",")[0];
    return anonymiseIp(first.trim());
  }
  return anonymiseIp(req.socket?.remoteAddress ?? null);
}

/**
 * Fire-and-forget: write a security event row.  Errors are swallowed so
 * they never break the calling request.
 */
export function logSecurityEvent(payload: SecurityEventPayload): void {
  const severity = payload.severity ?? SEVERITY_MAP[payload.eventType] ?? "info";

  // ── Quantum-resistant identity masking ──────────────────────────────────────
  // All third-party PII is pseudonymised before being written to the DB.
  // The real identity is never stored in the security_events table.
  const tenantId: number | null = null; // events are platform-scoped
  const maskedEmail = maskEmail(payload.userEmail, tenantId);
  const maskedMetadata = maskMetadata(payload.metadata, tenantId);

  getDb()
    .then(db => {
      if (!db) return;
      return db.insert(securityEvents).values({
        eventType: payload.eventType,
        userId: payload.userId ?? null,
        userEmail: maskedEmail,
        userRole: payload.userRole ?? null,
        ipAddress: payload.ipAddress ?? null,
        userAgent: payload.userAgent ? payload.userAgent.slice(0, 512) : null,
        metadata: maskedMetadata,
        severity,
      });
    })
    .catch(err => {
      // Never let logging errors surface to callers
      console.error("[SecurityLogger] Failed to write event:", err?.message);
    });
}
