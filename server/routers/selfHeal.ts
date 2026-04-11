/**
 * selfHeal tRPC router
 *
 * Exposes the self-healing system to:
 * - Admin users (health check, manual trigger, error log, fix history)
 * - Public (client error reporting — called by ErrorBoundary and global error handlers)
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { publicProcedure, protectedProcedure, adminProcedure, router } from "../_core/trpc";
import { runHealthCheck, runSelfHeal } from "../selfHeal";
import { logError } from "../db/errorLogger";
import { getDb } from "../db";
import { errorLogs, fixHistory } from "../../drizzle/schema";
import { desc, eq } from "drizzle-orm";

export const selfHealRouter = router({
  /**
   * PUBLIC — called by the client ErrorBoundary and global mutation onError
   * to capture browser-side crashes into the server error log.
   */
  reportClientError: publicProcedure
    .input(
      z.object({
        errorCode: z.string().optional(),
        errorMessage: z.string().max(2000).optional(),
        context: z.record(z.string(), z.unknown()).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await logError({
        source: "client",
        errorCode: input.errorCode,
        errorMessage: input.errorMessage,
        context: {
          ...input.context,
          userId: ctx.user?.id ?? null,
        },
        requiresEscalation: false,
      });
      return { received: true };
    }),

  /**
   * ADMIN — returns the current health report (DB connectivity + schema drift).
   */
  healthCheck: adminProcedure.query(async () => {
    return runHealthCheck();
  }),

  /**
   * ADMIN — manually trigger the self-heal runner.
   * The background monitor calls this automatically every 5 minutes.
   */
  triggerSelfHeal: adminProcedure.mutation(async () => {
    return runSelfHeal();
  }),

  /**
   * ADMIN — paginated error log feed.
   */
  getErrorLogs: adminProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
        onlyEscalations: z.boolean().default(false),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      if (input.onlyEscalations) {
        return db
          .select()
          .from(errorLogs)
          .where(eq(errorLogs.requiresEscalation, true))
          .orderBy(desc(errorLogs.createdAt))
          .limit(input.limit)
          .offset(input.offset);
      }

      return db
        .select()
        .from(errorLogs)
        .orderBy(desc(errorLogs.createdAt))
        .limit(input.limit)
        .offset(input.offset);
    }),

  /**
   * ADMIN — paginated fix history log.
   */
  getFixHistory: adminProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      return db
        .select()
        .from(fixHistory)
        .orderBy(desc(fixHistory.appliedAt))
        .limit(input.limit)
        .offset(input.offset);
    }),
});
