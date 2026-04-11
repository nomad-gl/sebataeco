/**
 * errorLogger.ts
 *
 * Centralised error capture helper. Every tRPC INTERNAL_SERVER_ERROR,
 * client crash, and health-check failure is funnelled through here so the
 * self-healing system has a single source of truth.
 */

import { getDb } from "../db";
import { eq } from "drizzle-orm";
import { errorLogs, fixHistory } from "../../drizzle/schema";

export interface ErrorLogInput {
  source: "server" | "client" | "health_check";
  errorCode?: string;
  errorMessage?: string;
  /** Arbitrary context: procedure name, userId, page URL, etc. */
  context?: Record<string, unknown>;
  requiresEscalation?: boolean;
}

/**
 * Insert a new error_log row. Returns the inserted id, or null if the DB is
 * unavailable (we never throw from the logger itself).
 */
export async function logError(input: ErrorLogInput): Promise<number | null> {
  try {
    const db = await getDb();
    if (!db) return null;
    const result = await db.insert(errorLogs).values({
      source: input.source,
      errorCode: input.errorCode ?? null,
      errorMessage: input.errorMessage
        ? input.errorMessage.slice(0, 2000) // cap length
        : null,
      context: input.context ? JSON.stringify(input.context) : null,
      requiresEscalation: input.requiresEscalation ?? false,
    });
    return (result as unknown as { insertId: number }).insertId ?? null;
  } catch {
    // Logger must never throw — swallow silently
    return null;
  }
}

/**
 * Mark an error_log row as resolved with the fix description.
 */
export async function markResolved(
  errorLogId: number,
  fixApplied: string
): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;
    await db
      .update(errorLogs)
      .set({ resolvedAt: new Date(), fixApplied })
      .where(eq(errorLogs.id, errorLogId));
  } catch {
    // Swallow
  }
}

export interface FixHistoryInput {
  errorLogId?: number;
  fixType: string;
  fixDescription: string;
  success: boolean;
  failureReason?: string;
}

/**
 * Record a fix attempt in fix_history.
 */
export async function recordFix(input: FixHistoryInput): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;
    await db.insert(fixHistory).values({
      errorLogId: input.errorLogId ?? null,
      fixType: input.fixType,
      fixDescription: input.fixDescription,
      success: input.success,
      failureReason: input.failureReason ?? null,
    });
  } catch {
    // Swallow
  }
}
