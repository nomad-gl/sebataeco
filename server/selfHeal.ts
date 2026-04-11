/**
 * selfHeal.ts
 *
 * Automated self-healing system for SEBA AI Studio.
 *
 * Responsibilities:
 * 1. runHealthCheck() — verifies DB connectivity and schema completeness
 * 2. runSelfHeal()    — applies safe fixes for detected issues; logs every
 *                       action to fix_history; escalates only what it cannot
 *                       safely fix automatically
 * 3. startHealthMonitor() — called once at server startup; runs a health
 *                           check every 5 minutes and auto-heals silently
 */

import mysql from "mysql2/promise";
import { logError, recordFix, markResolved } from "./db/errorLogger";
import { notifyOwner } from "./_core/notification";

// ─── Expected schema: table name → required columns ──────────────────────────
// This is the canonical list derived from drizzle/schema.ts.
// Add new tables here when the schema grows.
const EXPECTED_TABLES: Record<string, string[]> = {
  users: ["id", "openId", "name", "email", "role", "createdAt", "updatedAt"],
  practice_sessions: ["id", "userId", "competency", "score", "createdAt"],
  teaching_materials: ["id", "userId", "title", "subject", "createdAt"],
  class_challenges: ["id", "userId", "title", "createdAt"],
  challenge_participants: ["id", "challengeId", "studentName", "score"],
  aina_user_profiles: ["id", "userId", "profileSummary", "createdAt"],
  aina_message_ratings: ["id", "userId", "messageId", "rating", "createdAt"],
  question_answers: ["id", "userId", "questionId", "answer", "createdAt"],
  question_review_status: ["id", "userId", "questionId", "status"],
  student_reports: ["id", "userId", "title", "createdAt"],
  admin_audit_logs: ["id", "userId", "action", "createdAt"],
  whats_new_dismissals: ["id", "userId", "version", "dismissedAt"],
  error_logs: ["id", "source", "errorCode", "errorMessage", "createdAt"],
  fix_history: ["id", "fixType", "fixDescription", "appliedAt", "success"],
};

export interface HealthReport {
  healthy: boolean;
  dbConnected: boolean;
  missingTables: string[];
  missingColumns: Array<{ table: string; column: string }>;
  checkedAt: Date;
}

// ─── Health check ─────────────────────────────────────────────────────────────

export async function runHealthCheck(): Promise<HealthReport> {
  const report: HealthReport = {
    healthy: false,
    dbConnected: false,
    missingTables: [],
    missingColumns: [],
    checkedAt: new Date(),
  };

  let conn: mysql.Connection | null = null;
  try {
    conn = await mysql.createConnection(process.env.DATABASE_URL!);
    report.dbConnected = true;

    // Get all existing tables
    const [rows] = await conn.execute<mysql.RowDataPacket[]>("SHOW TABLES");
    const existingTables = new Set(rows.map((r) => Object.values(r)[0] as string));

    for (const [table, requiredCols] of Object.entries(EXPECTED_TABLES)) {
      if (!existingTables.has(table)) {
        report.missingTables.push(table);
        continue;
      }
      // Check columns
      const [cols] = await conn.execute<mysql.RowDataPacket[]>(
        `SHOW COLUMNS FROM \`${table}\``
      );
      const existingCols = new Set(cols.map((c) => c.Field as string));
      for (const col of requiredCols) {
        if (!existingCols.has(col)) {
          report.missingColumns.push({ table, column: col });
        }
      }
    }

    report.healthy =
      report.missingTables.length === 0 && report.missingColumns.length === 0;
  } catch (err) {
    report.dbConnected = false;
    await logError({
      source: "health_check",
      errorCode: "DB_CONNECTION_FAILED",
      errorMessage: err instanceof Error ? err.message : String(err),
      requiresEscalation: true,
    });
  } finally {
    if (conn) await conn.end().catch(() => {});
  }

  return report;
}

// ─── CREATE TABLE DDL for missing tables ─────────────────────────────────────
// Only safe, additive DDL. We never DROP or ALTER existing data.

const TABLE_DDL: Record<string, string> = {
  aina_message_ratings: `
    CREATE TABLE IF NOT EXISTS aina_message_ratings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      userId INT,
      messageId VARCHAR(128),
      rating TINYINT,
      messageSnippet TEXT,
      userQuestion TEXT,
      reportReason TEXT,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`,
  aina_user_profiles: `
    CREATE TABLE IF NOT EXISTS aina_user_profiles (
      id INT AUTO_INCREMENT PRIMARY KEY,
      userId INT NOT NULL UNIQUE,
      profileSummary TEXT,
      lastUpdated TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`,
  error_logs: `
    CREATE TABLE IF NOT EXISTS error_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      source VARCHAR(32) NOT NULL,
      errorCode VARCHAR(64),
      errorMessage TEXT,
      context TEXT,
      resolvedAt TIMESTAMP NULL,
      fixApplied TEXT,
      requiresEscalation BOOLEAN NOT NULL DEFAULT FALSE,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
  fix_history: `
    CREATE TABLE IF NOT EXISTS fix_history (
      id INT AUTO_INCREMENT PRIMARY KEY,
      errorLogId INT,
      fixType VARCHAR(64) NOT NULL,
      fixDescription TEXT NOT NULL,
      appliedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      success BOOLEAN NOT NULL DEFAULT TRUE,
      failureReason TEXT
    )`,
  whats_new_dismissals: `
    CREATE TABLE IF NOT EXISTS whats_new_dismissals (
      id INT AUTO_INCREMENT PRIMARY KEY,
      userId INT NOT NULL,
      version VARCHAR(32) NOT NULL,
      dismissedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
  student_reports: `
    CREATE TABLE IF NOT EXISTS student_reports (
      id INT AUTO_INCREMENT PRIMARY KEY,
      userId INT NOT NULL,
      title VARCHAR(255) NOT NULL,
      subject VARCHAR(128),
      yearGroup VARCHAR(32),
      content TEXT,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`,
  admin_audit_logs: `
    CREATE TABLE IF NOT EXISTS admin_audit_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      userId INT,
      action VARCHAR(128) NOT NULL,
      targetType VARCHAR(64),
      targetId INT,
      details TEXT,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
};

// ─── Self-heal runner ─────────────────────────────────────────────────────────

export interface SelfHealResult {
  fixesApplied: string[];
  escalations: string[];
  healthy: boolean;
}

export async function runSelfHeal(): Promise<SelfHealResult> {
  const result: SelfHealResult = {
    fixesApplied: [],
    escalations: [],
    healthy: true,
  };

  const report = await runHealthCheck();

  if (!report.dbConnected) {
    result.escalations.push("Database connection failed — cannot auto-fix.");
    result.healthy = false;
    return result;
  }

  if (report.healthy) return result;

  let conn: mysql.Connection | null = null;
  try {
    conn = await mysql.createConnection(process.env.DATABASE_URL!);

    // ── Fix 1: Create missing tables ─────────────────────────────────────────
    for (const table of report.missingTables) {
      const ddl = TABLE_DDL[table];
      if (!ddl) {
        // We don't have DDL for this table — escalate
        const errorLogId = await logError({
          source: "health_check",
          errorCode: "MISSING_TABLE_NO_DDL",
          errorMessage: `Table "${table}" is missing and no DDL is available to recreate it.`,
          requiresEscalation: true,
        });
        result.escalations.push(`Missing table "${table}" — no DDL available. Manual intervention required.`);
        result.healthy = false;
        if (errorLogId) {
          await recordFix({
            errorLogId,
            fixType: "create_missing_table",
            fixDescription: `No DDL available for table "${table}" — escalated to owner.`,
            success: false,
            failureReason: "No DDL available",
          });
        }
        continue;
      }

      // Log the issue first
      const errorLogId = await logError({
        source: "health_check",
        errorCode: "MISSING_TABLE",
        errorMessage: `Table "${table}" is missing from the database.`,
        context: { table },
      });

      try {
        await conn.execute(ddl);
        const fixDesc = `Created missing table "${table}" using stored DDL.`;
        result.fixesApplied.push(fixDesc);
        await recordFix({
          errorLogId: errorLogId ?? undefined,
          fixType: "create_missing_table",
          fixDescription: fixDesc,
          success: true,
        });
        if (errorLogId) await markResolved(errorLogId, fixDesc);
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        result.escalations.push(`Failed to create table "${table}": ${reason}`);
        result.healthy = false;
        await recordFix({
          errorLogId: errorLogId ?? undefined,
          fixType: "create_missing_table",
          fixDescription: `Attempted to create table "${table}" — failed.`,
          success: false,
          failureReason: reason,
        });
      }
    }

    // ── Fix 2: Missing columns — escalate (ALTER TABLE can be destructive) ───
    for (const { table, column } of report.missingColumns) {
      const errorLogId = await logError({
        source: "health_check",
        errorCode: "MISSING_COLUMN",
        errorMessage: `Column "${column}" is missing from table "${table}".`,
        context: { table, column },
        requiresEscalation: true,
      });
      const msg = `Column "${column}" missing from table "${table}" — requires manual migration.`;
      result.escalations.push(msg);
      result.healthy = false;
      await recordFix({
        errorLogId: errorLogId ?? undefined,
        fixType: "missing_column_escalation",
        fixDescription: msg,
        success: false,
        failureReason: "ALTER TABLE requires human review to avoid data loss",
      });
    }
  } finally {
    if (conn) await conn.end().catch(() => {});
  }

  return result;
}

// ─── Scheduled monitor ────────────────────────────────────────────────────────

let _monitorInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Start the background health monitor. Safe to call multiple times — only
 * one interval is ever active. Runs immediately on startup, then every 5 min.
 */
export function startHealthMonitor(): void {
  if (_monitorInterval) return; // already running

  const tick = async () => {
    try {
      const result = await runSelfHeal();

      if (result.fixesApplied.length > 0) {
        console.log("[SelfHeal] Fixes applied:", result.fixesApplied);
        // Notify owner of auto-applied fixes (informational)
        await notifyOwner({
          title: "SEBA Auto-Heal: fixes applied",
          content:
            `The self-healing system automatically fixed ${result.fixesApplied.length} issue(s):\n\n` +
            result.fixesApplied.map((f) => `• ${f}`).join("\n"),
        }).catch(() => {});
      }

      if (result.escalations.length > 0) {
        console.error("[SelfHeal] Escalations required:", result.escalations);
        // Notify owner — these need manual intervention
        await notifyOwner({
          title: "⚠️ SEBA Alert: manual fix required",
          content:
            `The self-healing system detected ${result.escalations.length} issue(s) that require manual intervention:\n\n` +
            result.escalations.map((e) => `• ${e}`).join("\n") +
            "\n\nPlease review the Error Dashboard at /admin/errors.",
        }).catch(() => {});
      }
    } catch (err) {
      console.error("[SelfHeal] Monitor tick failed:", err);
    }
  };

  // Run immediately on startup
  void tick();

  // Then every 5 minutes
  _monitorInterval = setInterval(tick, 5 * 60 * 1000);
}
