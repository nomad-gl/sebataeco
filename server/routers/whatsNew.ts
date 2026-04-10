import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";

/**
 * The current app version string. Bump this whenever you want to show a new
 * "What's New" notification to all teachers. Format: YYYY-MM-DD[-suffix].
 */
export const CURRENT_WHATS_NEW_VERSION = "2025-04-11";

export const whatsNewRouter = router({
  /**
   * Returns whether the current user has already dismissed the current version.
   * Public procedure so guests can also call it (returns false for guests).
   */
  isDismissed: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.user) return { dismissed: false, version: CURRENT_WHATS_NEW_VERSION };
    const db = await getDb();
    if (!db) return { dismissed: false, version: CURRENT_WHATS_NEW_VERSION };
    const { whatsNewDismissals } = await import("../../drizzle/schema");
    const { eq, and } = await import("drizzle-orm");
    const rows = await db
      .select({ id: whatsNewDismissals.id })
      .from(whatsNewDismissals)
      .where(
        and(
          eq(whatsNewDismissals.userId, ctx.user.id),
          eq(whatsNewDismissals.version, CURRENT_WHATS_NEW_VERSION)
        )
      )
      .limit(1);
    return { dismissed: rows.length > 0, version: CURRENT_WHATS_NEW_VERSION };
  }),

  /** Marks the current version as dismissed for the logged-in user. */
  dismiss: protectedProcedure.input(z.object({ version: z.string().max(32) })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) return { success: false };
    const { whatsNewDismissals } = await import("../../drizzle/schema");
    const { eq, and } = await import("drizzle-orm");
    // Idempotent — only insert if not already dismissed
    const existing = await db
      .select({ id: whatsNewDismissals.id })
      .from(whatsNewDismissals)
      .where(
        and(
          eq(whatsNewDismissals.userId, ctx.user.id),
          eq(whatsNewDismissals.version, input.version)
        )
      )
      .limit(1);
    if (existing.length === 0) {
      await db.insert(whatsNewDismissals).values({
        userId: ctx.user.id,
        version: input.version,
      });
    }
    return { success: true };
  }),
});
