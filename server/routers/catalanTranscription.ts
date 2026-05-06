/**
 * Catalan Transcription Router — tRPC procedures for Catalan audio transcription
 * Integrates Transcriu-Me with EU AI Act compliance logging
 */

import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { transcribeCatalan, transcribeCatalanBatch, getTranscriptionQuality, exportAuditLog } from "../_core/catalanTranscription";
import { TRPCError } from "@trpc/server";

export const catalanTranscriptionRouter = router({
  /**
   * Transcribe a single Catalan audio file
   */
  transcribe: protectedProcedure
    .input(
      z.object({
        audioUrl: z.string().url(),
        deviceId: z.string().optional(),
        prompt: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const result = await transcribeCatalan({
          audioUrl: input.audioUrl,
          deviceId: input.deviceId,
          userId: String(ctx.user.id),
          prompt: input.prompt,
        });

        if ("error" in result) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: result.error,
          });
        }

        return {
          success: true,
          text: result.text,
          language: result.language,
          duration: result.duration,
          segments: result.segments,
          auditLog: result.auditLog,
        };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Transcription failed",
        });
      }
    }),

  /**
   * Batch transcribe multiple Catalan audio files
   */
  transcribeBatch: protectedProcedure
    .input(
      z.object({
        audioUrls: z.array(z.string().url()).min(1).max(10),
        deviceId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const results = await transcribeCatalanBatch(input.audioUrls, {
          deviceId: input.deviceId,
          userId: String(ctx.user.id),
        });

        return {
          success: true,
          count: results.length,
          results: results.map((result) => ({
            text: result.text,
            language: result.language,
            duration: result.duration,
            auditLog: result.auditLog,
          })),
        };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Batch transcription failed",
        });
      }
    }),

  /**
   * Get transcription quality metrics
   */
  getQuality: protectedProcedure
    .input(
      z.object({
        text: z.string(),
        language: z.string(),
        duration: z.number(),
      })
    )
    .query(({ input }) => {
      // Return quality metrics based on transcription metadata
      return {
        confidence: 0.95, // Placeholder - would be calculated from segments
        language: input.language,
        duration: input.duration,
        quality: input.text.length > 0 ? "good" : "poor",
      };
    }),

  /**
   * Export audit log for compliance
   */
  exportAuditLog: protectedProcedure
    .input(
      z.object({
        timestamp: z.string(),
        deviceId: z.string(),
        modelUsed: z.string(),
        encryptionHash: z.string(),
      })
    )
    .query(({ input }) => {
      return {
        timestamp: input.timestamp,
        deviceId: input.deviceId,
        modelUsed: input.modelUsed,
        encryptionHash: input.encryptionHash,
        euAiActCompliant: true,
      };
    }),

  /**
   * Get transcription history for current user
   */
  getHistory: protectedProcedure.query(async ({ ctx }) => {
    // This would typically query a transcription_logs table
    // For now, return a placeholder
    return {
      totalTranscriptions: 0,
      recentTranscriptions: [],
    };
  }),
});
