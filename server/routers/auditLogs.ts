import { z } from "zod";
import { router, protectedProcedure, adminProcedure } from "../_core/router";
import { getDb } from "../db";
import { auditLogs } from "../../drizzle/schema";
import { and, gte, lte, eq } from "drizzle-orm";
import { createHash } from "crypto";
import { v4 as uuidv4 } from "uuid";

/**
 * Audit Log Router - EU AI Act Compliance Tracking
 * Tracks all AI-generated content with timestamps, device IDs, models, and encryption hashes
 */
export const auditLogsRouter = router({
  /**
   * Log an AI operation (transcription, generation, chat, analysis)
   * Called automatically by backend procedures
   */
  log: protectedProcedure
    .input(
      z.object({
        contentType: z.enum(["transcription", "generation", "chat", "analysis"]),
        content: z.string(),
        deviceId: z.string(),
        inputTokens: z.number().optional(),
        outputTokens: z.number().optional(),
        processingTimeMs: z.number().optional(),
        status: z.enum(["success", "partial", "failed"]).default("success"),
        errorMessage: z.string().optional(),
        metadata: z.record(z.any()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();

      // Generate hashes for compliance
      const contentHash = createHash("sha256").update(input.content).digest("hex");
      const encryptionHash = createHash("sha256")
        .update(`${ctx.user.id}:${input.deviceId}:${Date.now()}`)
        .digest("hex");

      // Calculate data retention expiration (3 years for EU AI Act compliance)
      const expiresAt = new Date();
      expiresAt.setFullYear(expiresAt.getFullYear() + 3);

      const auditLog = await db.insert(auditLogs).values({
        id: uuidv4(),
        userId: ctx.user.id,
        deviceId: input.deviceId,
        modelUsed: "AINA Salamandra",
        contentType: input.contentType,
        contentHash,
        encryptionHash,
        inputTokens: input.inputTokens || 0,
        outputTokens: input.outputTokens || 0,
        processingTimeMs: input.processingTimeMs || 0,
        status: input.status,
        errorMessage: input.errorMessage,
        metadata: input.metadata ? JSON.stringify(input.metadata) : null,
        createdAt: new Date(),
        expiresAt,
      });

      return { success: true, auditLogId: auditLog.insertId };
    }),

  /**
   * Get audit logs for the current user (with filtering)
   */
  getUserLogs: protectedProcedure
    .input(
      z.object({
        contentType: z.enum(["transcription", "generation", "chat", "analysis"]).optional(),
        status: z.enum(["success", "partial", "failed"]).optional(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
        limit: z.number().default(50).max(500),
        offset: z.number().default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();

      const conditions = [eq(auditLogs.userId, ctx.user.id)];

      if (input.contentType) {
        conditions.push(eq(auditLogs.contentType, input.contentType));
      }

      if (input.status) {
        conditions.push(eq(auditLogs.status, input.status));
      }

      if (input.startDate) {
        conditions.push(gte(auditLogs.createdAt, input.startDate));
      }

      if (input.endDate) {
        conditions.push(lte(auditLogs.createdAt, input.endDate));
      }

      const logs = await db
        .select()
        .from(auditLogs)
        .where(and(...conditions))
        .orderBy(auditLogs.createdAt)
        .limit(input.limit)
        .offset(input.offset);

      return logs;
    }),

  /**
   * Get audit log statistics for compliance reporting
   */
  getStats: protectedProcedure
    .input(
      z.object({
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();

      const conditions = [eq(auditLogs.userId, ctx.user.id)];

      if (input.startDate) {
        conditions.push(gte(auditLogs.createdAt, input.startDate));
      }

      if (input.endDate) {
        conditions.push(lte(auditLogs.createdAt, input.endDate));
      }

      const logs = await db
        .select()
        .from(auditLogs)
        .where(and(...conditions));

      // Calculate statistics
      const stats = {
        totalOperations: logs.length,
        successCount: logs.filter((l) => l.status === "success").length,
        partialCount: logs.filter((l) => l.status === "partial").length,
        failedCount: logs.filter((l) => l.status === "failed").length,
        totalInputTokens: logs.reduce((sum, l) => sum + (l.inputTokens || 0), 0),
        totalOutputTokens: logs.reduce((sum, l) => sum + (l.outputTokens || 0), 0),
        averageProcessingTimeMs:
          logs.length > 0
            ? logs.reduce((sum, l) => sum + (l.processingTimeMs || 0), 0) / logs.length
            : 0,
        byContentType: {
          transcription: logs.filter((l) => l.contentType === "transcription").length,
          generation: logs.filter((l) => l.contentType === "generation").length,
          chat: logs.filter((l) => l.contentType === "chat").length,
          analysis: logs.filter((l) => l.contentType === "analysis").length,
        },
      };

      return stats;
    }),

  /**
   * Admin: Get all audit logs across all users (for compliance reporting)
   */
  getAllLogs: adminProcedure
    .input(
      z.object({
        userId: z.number().optional(),
        contentType: z.enum(["transcription", "generation", "chat", "analysis"]).optional(),
        status: z.enum(["success", "partial", "failed"]).optional(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
        limit: z.number().default(100).max(1000),
        offset: z.number().default(0),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();

      const conditions = [];

      if (input.userId) {
        conditions.push(eq(auditLogs.userId, input.userId));
      }

      if (input.contentType) {
        conditions.push(eq(auditLogs.contentType, input.contentType));
      }

      if (input.status) {
        conditions.push(eq(auditLogs.status, input.status));
      }

      if (input.startDate) {
        conditions.push(gte(auditLogs.createdAt, input.startDate));
      }

      if (input.endDate) {
        conditions.push(lte(auditLogs.createdAt, input.endDate));
      }

      const logs = await db
        .select()
        .from(auditLogs)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(auditLogs.createdAt)
        .limit(input.limit)
        .offset(input.offset);

      return logs;
    }),

  /**
   * Export audit logs as CSV for compliance reporting
   */
  exportLogs: protectedProcedure
    .input(
      z.object({
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();

      const conditions = [eq(auditLogs.userId, ctx.user.id)];

      if (input.startDate) {
        conditions.push(gte(auditLogs.createdAt, input.startDate));
      }

      if (input.endDate) {
        conditions.push(lte(auditLogs.createdAt, input.endDate));
      }

      const logs = await db
        .select()
        .from(auditLogs)
        .where(and(...conditions))
        .orderBy(auditLogs.createdAt);

      // Generate CSV
      const headers = [
        "Timestamp",
        "Device ID",
        "Model Used",
        "Content Type",
        "Status",
        "Input Tokens",
        "Output Tokens",
        "Processing Time (ms)",
        "Content Hash",
        "Encryption Hash",
      ];

      const rows = logs.map((log) => [
        log.createdAt?.toISOString() || "",
        log.deviceId,
        log.modelUsed,
        log.contentType,
        log.status,
        log.inputTokens || 0,
        log.outputTokens || 0,
        log.processingTimeMs || 0,
        log.contentHash,
        log.encryptionHash,
      ]);

      const csv = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n");

      return { csv, filename: `audit-logs-${Date.now()}.csv` };
    }),
});
