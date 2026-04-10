/**
 * audit.ts — Admin audit log router
 *
 * Provides a comprehensive audit trail of all significant actions in SEBA,
 * including AI decisions, human overrides, bias flags, and data access events.
 * Only accessible to admin users.
 */

import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import {
  aiGradeOverrides,
  aiBiasFlags,
  aiLearningPaths,
  aiAssessments,
  adminAuditLogs,
} from "../../drizzle/schema";
import { desc, gte, and, eq, sql, lt } from "drizzle-orm";
import { writeAuditLog } from "../auditLog";

// ─── Audit retention constants ────────────────────────────────────────────────
const AUDIT_RETENTION_MONTHS = 24;

/** In-memory record of the last audit retention purge run. */
export const auditRetentionStatus: {
  lastRunAt: number | null;
  lastDeletedCount: number | null;
  lastError: string | null;
} = {
  lastRunAt: null,
  lastDeletedCount: null,
  lastError: null,
};

/**
 * Delete admin_audit_logs rows older than AUDIT_RETENTION_MONTHS months.
 * Returns the number of rows deleted.
 * Called by the nightly cron and by the admin tRPC procedure.
 */
export async function runAuditRetentionPurge(triggeredByUserId?: number): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - AUDIT_RETENTION_MONTHS);

  const result = await db
    .delete(adminAuditLogs)
    .where(lt(adminAuditLogs.createdAt, cutoff));

  const deleted = (result as any)[0]?.affectedRows ?? 0;

  // Update in-memory status
  auditRetentionStatus.lastRunAt = Date.now();
  auditRetentionStatus.lastDeletedCount = deleted;
  auditRetentionStatus.lastError = null;

  // Write an audit log entry for the purge itself (system user = 0 if cron)
  if (triggeredByUserId !== undefined) {
    await writeAuditLog({
      userId: triggeredByUserId,
      action: "retention_purge",
      resource: "admin_audit_logs",
      details: { deleted, cutoffDate: cutoff.toISOString(), retentionMonths: AUDIT_RETENTION_MONTHS },
    });
  }

  return deleted;
}

// Admin guard middleware
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
  return next({ ctx });
});

export const auditRouter = router({
  /**
   * Get a paginated audit log of all significant events.
   */
  getAuditLog: publicProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(200).default(50),
        offset: z.number().min(0).default(0),
        eventType: z
          .enum(["all", "grade_override", "bias_flag", "learning_path", "assessment"])
          .default("all"),
        since: z.number().nullish(), // Unix timestamp ms
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const sinceDate = input.since ? new Date(input.since) : null;

      const events: Array<{
        id: string;
        type: string;
        typeLabel: string;
        severity: string;
        summary: string;
        userId: number | null;
        createdAt: number;
        resolved: boolean;
        details: Record<string, unknown>;
      }> = [];

      // Grade overrides
      if (input.eventType === "all" || input.eventType === "grade_override") {
        const overrides = await db
          .select()
          .from(aiGradeOverrides)
          .where(sinceDate ? gte(aiGradeOverrides.createdAt, sinceDate) : undefined)
          .orderBy(desc(aiGradeOverrides.createdAt))
          .limit(input.eventType === "all" ? 20 : input.limit);

        for (const o of overrides) {
          events.push({
            id: `override-${o.id}`,
            type: "grade_override",
            typeLabel: "Grade Override",
            severity: "info",
            summary: `AI score ${o.aiScore} → Teacher score ${o.teacherScore}`,
            userId: o.teacherId,
            createdAt: o.createdAt instanceof Date ? o.createdAt.getTime() : Number(o.createdAt),
            resolved: true,
            details: {
              assessmentId: o.assessmentId,
              aiScore: o.aiScore,
              teacherScore: o.teacherScore,
              reason: o.reason,
            },
          });
        }
      }

      // Bias flags
      if (input.eventType === "all" || input.eventType === "bias_flag") {
        const flags = await db
          .select()
          .from(aiBiasFlags)
          .where(sinceDate ? gte(aiBiasFlags.createdAt, sinceDate) : undefined)
          .orderBy(desc(aiBiasFlags.createdAt))
          .limit(input.eventType === "all" ? 20 : input.limit);

        for (const f of flags) {
          events.push({
            id: `bias-${f.id}`,
            type: "bias_flag",
            typeLabel: "Bias Flag",
            severity:
              f.severity === "high" ? "critical" : f.severity === "medium" ? "warning" : "info",
            summary: f.flagReason ?? "Bias detected in AI output",
            userId: f.userId ?? null,
            createdAt: f.createdAt instanceof Date ? f.createdAt.getTime() : Number(f.createdAt),
            resolved: f.resolved ?? false,
            details: {
              severity: f.severity,
              inputPreview: f.inputText?.slice(0, 100),
              outputPreview: f.outputText?.slice(0, 100),
              resolvedAt:
                f.resolvedAt instanceof Date ? f.resolvedAt.getTime() : f.resolvedAt ?? null,
            },
          });
        }
      }

      // Learning path generations
      if (input.eventType === "all" || input.eventType === "learning_path") {
        const paths = await db
          .select()
          .from(aiLearningPaths)
          .where(sinceDate ? gte(aiLearningPaths.createdAt, sinceDate) : undefined)
          .orderBy(desc(aiLearningPaths.createdAt))
          .limit(input.eventType === "all" ? 20 : input.limit);

        for (const p of paths) {
          events.push({
            id: `path-${p.id}`,
            type: "learning_path",
            typeLabel: "Learning Path",
            severity: "info",
            summary: `Learning path generated for student ${p.studentId} — ${p.competency ?? "all competencies"}`,
            userId: p.teacherId,
            createdAt: p.createdAt instanceof Date ? p.createdAt.getTime() : Number(p.createdAt),
            resolved: true,
            details: {
              studentId: p.studentId,
              competency: p.competency,
              yearGroup: p.yearGroup,
            },
          });
        }
      }

      // AI assessments
      if (input.eventType === "all" || input.eventType === "assessment") {
        const assessmentRows = await db
          .select()
          .from(aiAssessments)
          .where(sinceDate ? gte(aiAssessments.createdAt, sinceDate) : undefined)
          .orderBy(desc(aiAssessments.createdAt))
          .limit(input.eventType === "all" ? 20 : input.limit);

        for (const a of assessmentRows) {
          events.push({
            id: `assessment-${a.id}`,
            type: "assessment",
            typeLabel: "AI Assessment",
            severity: a.overridden ? "warning" : "info",
            summary: `AI assessed student ${a.studentId} — ${a.competency ?? "general"} — score ${a.aiScore}`,
            userId: a.teacherId,
            createdAt: a.createdAt instanceof Date ? a.createdAt.getTime() : Number(a.createdAt),
            resolved: !a.overridden,
            details: {
              competency: a.competency,
              yearGroup: a.yearGroup,
              aiScore: a.aiScore,
              overridden: a.overridden,
            },
          });
        }
      }

      // Sort all events by createdAt desc
      events.sort((a, b) => b.createdAt - a.createdAt);

      return {
        events: events.slice(input.offset, input.offset + input.limit),
        total: events.length,
      };
    }),

  /**
   * Export the full audit log as a CSV string.
   */
  exportCsv: adminProcedure
    .input(
      z.object({
        eventType: z
          .enum(["all", "grade_override", "bias_flag", "learning_path", "assessment"])
          .default("all"),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const events: Array<{
        id: string;
        type: string;
        typeLabel: string;
        severity: string;
        summary: string;
        userId: number | null;
        createdAt: number;
        resolved: boolean;
      }> = [];

      if (input.eventType === "all" || input.eventType === "grade_override") {
        const overrides = await db
          .select()
          .from(aiGradeOverrides)
          .orderBy(desc(aiGradeOverrides.createdAt))
          .limit(1000);
        for (const o of overrides) {
          events.push({
            id: `override-${o.id}`,
            type: "grade_override",
            typeLabel: "Grade Override",
            severity: "info",
            summary: `AI score ${o.aiScore} → Teacher score ${o.teacherScore} (${o.reason ?? "no reason"})`,
            userId: o.teacherId,
            createdAt: o.createdAt instanceof Date ? o.createdAt.getTime() : Number(o.createdAt),
            resolved: true,
          });
        }
      }

      if (input.eventType === "all" || input.eventType === "bias_flag") {
        const flags = await db
          .select()
          .from(aiBiasFlags)
          .orderBy(desc(aiBiasFlags.createdAt))
          .limit(1000);
        for (const f of flags) {
          events.push({
            id: `bias-${f.id}`,
            type: "bias_flag",
            typeLabel: "Bias Flag",
            severity: f.severity === "high" ? "critical" : f.severity === "medium" ? "warning" : "info",
            summary: f.flagReason ?? "Bias detected in AI output",
            userId: f.userId ?? null,
            createdAt: f.createdAt instanceof Date ? f.createdAt.getTime() : Number(f.createdAt),
            resolved: f.resolved ?? false,
          });
        }
      }

      if (input.eventType === "all" || input.eventType === "learning_path") {
        const paths = await db
          .select()
          .from(aiLearningPaths)
          .orderBy(desc(aiLearningPaths.createdAt))
          .limit(1000);
        for (const p of paths) {
          events.push({
            id: `path-${p.id}`,
            type: "learning_path",
            typeLabel: "Learning Path",
            severity: "info",
            summary: `Learning path generated for student ${p.studentId} — ${p.competency ?? "all competencies"}`,
            userId: p.teacherId,
            createdAt: p.createdAt instanceof Date ? p.createdAt.getTime() : Number(p.createdAt),
            resolved: true,
          });
        }
      }

      if (input.eventType === "all" || input.eventType === "assessment") {
        const assessmentRows = await db
          .select()
          .from(aiAssessments)
          .orderBy(desc(aiAssessments.createdAt))
          .limit(1000);
        for (const a of assessmentRows) {
          events.push({
            id: `assessment-${a.id}`,
            type: "assessment",
            typeLabel: "AI Assessment",
            severity: a.overridden ? "warning" : "info",
            summary: `AI assessed student ${a.studentId} — ${a.competency ?? "general"} — score ${a.aiScore}`,
            userId: a.teacherId,
            createdAt: a.createdAt instanceof Date ? a.createdAt.getTime() : Number(a.createdAt),
            resolved: !a.overridden,
          });
        }
      }

      events.sort((a, b) => b.createdAt - a.createdAt);

      // Build CSV
      const header = "id,type,typeLabel,severity,summary,userId,date,resolved";
      const rows = events.map((e) => {
        const date = new Date(e.createdAt).toISOString();
        const summary = `"${(e.summary ?? "").replace(/"/g, '""')}"`;
        return `${e.id},${e.type},${e.typeLabel},${e.severity},${summary},${e.userId ?? ""},${date},${e.resolved}`;
      });

      return { csv: [header, ...rows].join("\n"), count: events.length };
    }),

  /**
   * Manually trigger the audit log retention purge (admin only).
   * Deletes all admin_audit_logs rows older than 24 months.
   */
  runRetentionPurge: adminProcedure.mutation(async ({ ctx }) => {
    try {
      const deleted = await runAuditRetentionPurge(ctx.user.id);
      return { success: true, deleted };
    } catch (err) {
      auditRetentionStatus.lastError = err instanceof Error ? err.message : String(err);
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Purge failed" });
    }
  }),

  /**
   * Return the in-memory status of the last audit retention purge run.
   */
  getRetentionStatus: publicProcedure.query(() => ({
    lastRunAt: auditRetentionStatus.lastRunAt,
    lastDeletedCount: auditRetentionStatus.lastDeletedCount,
    lastError: auditRetentionStatus.lastError,
    retentionMonths: AUDIT_RETENTION_MONTHS,
  })),

  /**
   * Get aggregate statistics for the audit dashboard.
   */
  getStats: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [overrideCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(aiGradeOverrides)
      .where(gte(aiGradeOverrides.createdAt, thirtyDaysAgo));

    const [biasTotal] = await db
      .select({ count: sql<number>`count(*)` })
      .from(aiBiasFlags)
      .where(gte(aiBiasFlags.createdAt, thirtyDaysAgo));

    const [biasUnresolved] = await db
      .select({ count: sql<number>`count(*)` })
      .from(aiBiasFlags)
      .where(and(gte(aiBiasFlags.createdAt, thirtyDaysAgo), eq(aiBiasFlags.resolved, false)));

    const [pathCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(aiLearningPaths)
      .where(gte(aiLearningPaths.createdAt, thirtyDaysAgo));

    const [assessmentCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(aiAssessments)
      .where(gte(aiAssessments.createdAt, thirtyDaysAgo));

    return {
      last30Days: {
        gradeOverrides: Number(overrideCount?.count ?? 0),
        biasFlags: Number(biasTotal?.count ?? 0),
        unresolvedBiasFlags: Number(biasUnresolved?.count ?? 0),
        learningPaths: Number(pathCount?.count ?? 0),
        aiAssessments: Number(assessmentCount?.count ?? 0),
      },
    };
  }),
});
