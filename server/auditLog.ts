/**
 * auditLog.ts — Centralised audit logging helper.
 *
 * Every significant admin or teacher action (grade overrides, bias resolutions,
 * data deletions, question approvals) is written here for EU AI Act and GDPR
 * accountability requirements.
 *
 * IP addresses are anonymised to the /24 prefix (last octet zeroed) before storage.
 */

import { getDb } from "./db";
import { adminAuditLogs } from "../drizzle/schema";

export type AuditAction =
  | "grade_override"
  | "bias_resolve"
  | "data_delete"
  | "data_export"
  | "question_approve"
  | "question_reject"
  | "question_generate"
  | "translation_run"
  | "learning_path_generate"
  | "assessment_create"
  | "login"
  | "admin_access"
  | "retention_purge";

export interface AuditEntry {
  userId: number;
  action: AuditAction;
  resource: string;
  resourceId?: string | number;
  details?: Record<string, unknown>;
  ipAddress?: string;
}

/**
 * Anonymise an IP address by zeroing the last octet (IPv4) or last 64 bits (IPv6).
 */
function anonymiseIp(ip?: string): string | undefined {
  if (!ip) return undefined;
  // IPv4: zero last octet
  const ipv4 = ip.match(/^(\d+\.\d+\.\d+)\.\d+$/);
  if (ipv4) return `${ipv4[1]}.0`;
  // IPv6: zero last 64 bits (last 4 groups)
  const ipv6Parts = ip.split(":");
  if (ipv6Parts.length >= 4) {
    return ipv6Parts.slice(0, 4).join(":") + ":0:0:0:0";
  }
  return undefined; // Don't store unrecognised formats
}

/**
 * Write an audit log entry. Failures are swallowed (never block the main action).
 */
export async function writeAuditLog(entry: AuditEntry): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;
    await db.insert(adminAuditLogs).values({
      userId: entry.userId,
      action: entry.action,
      resource: entry.resource,
      resourceId: entry.resourceId !== undefined ? String(entry.resourceId) : undefined,
      details: entry.details ? JSON.stringify(entry.details) : undefined,
      ipAddress: anonymiseIp(entry.ipAddress),
    });
  } catch {
    // Audit log failures must never break the main action
  }
}
