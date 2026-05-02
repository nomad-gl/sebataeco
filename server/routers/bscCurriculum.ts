/**
 * BSC Curriculum Router
 *
 * Provides tRPC procedures for managing BSC (Catalan Competency-Based Curriculum) data:
 * - Load competencies from Hugging Face
 * - Sync to knowledge bank
 * - Query competencies by year group or keyword
 * - Get assessment criteria and proficiency levels
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { adminOnlyProcedure, router } from "../_core/trpc";
import { BSCCurriculumLoader, initializeBSCCurriculum } from "../bscCurriculumLoader";
import { db } from "../db";
import { knowledgeBank } from "../../drizzle/schema";
import { eq, and, ilike } from "drizzle-orm";

export const bscCurriculumRouter = router({
  /**
   * Initialize BSC curriculum from Hugging Face dataset
   * Admin-only operation
   */
  initialize: adminOnlyProcedure
    .input(
      z.object({
        datasetId: z.string().optional(),
        force: z.boolean().optional()
      })
    )
    .mutation(async ({ input, ctx }) => {
      const hfApiKey = process.env.HF_API_KEY;
      if (!hfApiKey) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "HF_API_KEY environment variable is not set"
        });
      }

      try {
        const loader = new BSCCurriculumLoader(hfApiKey);
        const datasetId = input.datasetId || process.env.BSC_DATASET_ID || "bsc-primary-curriculum";

        console.log(`[bscCurriculum.initialize] Loading from dataset: ${datasetId}`);

        const competencies = await loader.loadCompetencies(datasetId);
        if (competencies.length === 0) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: `No competencies found in dataset: ${datasetId}`
          });
        }

        await loader.syncToKnowledgeBank(competencies);

        // Log admin action
        console.log(
          `[bscCurriculum.initialize] Admin ${ctx.user.id} loaded ${competencies.length} BSC competencies`
        );

        return {
          success: true,
          competenciesLoaded: competencies.length,
          message: `Successfully loaded ${competencies.length} competencies from ${datasetId}`
        };
      } catch (error) {
        console.error("[bscCurriculum.initialize] Error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to initialize BSC curriculum: ${error instanceof Error ? error.message : "Unknown error"}`
        });
      }
    }),

  /**
   * Get competencies by year group
   */
  getByYearGroup: adminOnlyProcedure
    .input(
      z.object({
        yearGroup: z.string(),
        limit: z.number().default(50)
      })
    )
    .query(async ({ input }) => {
      try {
        const results = await db
          .select()
          .from(knowledgeBank)
          .where(
            and(
              eq(knowledgeBank.source, "bsc-curriculum"),
              ilike(knowledgeBank.metadata, `%${input.yearGroup}%`)
            )
          )
          .limit(input.limit);

        return results;
      } catch (error) {
        console.error("[bscCurriculum.getByYearGroup] Error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to retrieve competencies"
        });
      }
    }),

  /**
   * Search competencies by keyword
   */
  search: adminOnlyProcedure
    .input(
      z.object({
        keyword: z.string().min(2),
        limit: z.number().default(20)
      })
    )
    .query(async ({ input }) => {
      try {
        const results = await db
          .select()
          .from(knowledgeBank)
          .where(
            and(
              eq(knowledgeBank.source, "bsc-curriculum"),
              ilike(knowledgeBank.title, `%${input.keyword}%`)
            )
          )
          .limit(input.limit);

        return results;
      } catch (error) {
        console.error("[bscCurriculum.search] Error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to search competencies"
        });
      }
    }),

  /**
   * Get detailed competency with assessment criteria
   */
  getCompetency: adminOnlyProcedure
    .input(
      z.object({
        competencyId: z.string()
      })
    )
    .query(async ({ input }) => {
      try {
        const competency = await db
          .select()
          .from(knowledgeBank)
          .where(
            and(
              eq(knowledgeBank.id, input.competencyId),
              eq(knowledgeBank.source, "bsc-curriculum")
            )
          )
          .limit(1);

        if (competency.length === 0) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Competency not found"
          });
        }

        return competency[0];
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("[bscCurriculum.getCompetency] Error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to retrieve competency"
        });
      }
    }),

  /**
   * Get BSC curriculum statistics
   */
  getStats: adminOnlyProcedure.query(async () => {
    try {
      const results = await db
        .select()
        .from(knowledgeBank)
        .where(eq(knowledgeBank.source, "bsc-curriculum"));

      const yearGroups = new Set<string>();
      const tags = new Set<string>();

      results.forEach((item) => {
        if (item.metadata?.yearGroups && Array.isArray(item.metadata.yearGroups)) {
          item.metadata.yearGroups.forEach((yg: string) => yearGroups.add(yg));
        }
        if (item.tags && Array.isArray(item.tags)) {
          item.tags.forEach((tag: string) => tags.add(tag));
        }
      });

      return {
        totalCompetencies: results.length,
        yearGroups: Array.from(yearGroups),
        tags: Array.from(tags),
        lastUpdated: results.length > 0
          ? Math.max(...results.map((r) => r.updatedAt || 0))
          : null
      };
    } catch (error) {
      console.error("[bscCurriculum.getStats] Error:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to retrieve statistics"
      });
    }
  }),

  /**
   * Clear all BSC curriculum data
   * Admin-only, use with caution
   */
  clearData: adminOnlyProcedure
    .input(
      z.object({
        confirm: z.literal(true)
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        // Delete all BSC curriculum entries
        const result = await db
          .delete(knowledgeBank)
          .where(eq(knowledgeBank.source, "bsc-curriculum"));

        console.log(
          `[bscCurriculum.clearData] Admin ${ctx.user.id} cleared BSC curriculum data`
        );

        return {
          success: true,
          message: "BSC curriculum data cleared"
        };
      } catch (error) {
        console.error("[bscCurriculum.clearData] Error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to clear BSC curriculum data"
        });
      }
    })
});
