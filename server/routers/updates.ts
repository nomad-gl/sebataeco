import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { appUpdates, viewedUpdates } from "../../drizzle/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

export const updatesRouter = router({
  /**
   * Get the latest unviewed updates for the current user.
   * Only returns updates matching Catalan language ("ca") by default.
   * Users can optionally pass their current language to see language-specific updates.
   */
  getLatest: protectedProcedure
    .input(z.object({ language: z.string().default("ca") }).optional())
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      // Always filter to Catalan-only updates
      const targetLanguage = "ca";

      try {
        // Get all Catalan updates ordered by creation date (newest first)
        const allUpdates = await db
          .select({
            id: appUpdates.id,
            title: appUpdates.title,
            description: appUpdates.description,
            version: appUpdates.version,
            language: appUpdates.language,
            createdAt: appUpdates.createdAt,
          })
          .from(appUpdates)
          .where(eq(appUpdates.language, targetLanguage))
          .orderBy(desc(appUpdates.createdAt))
          .limit(10);

        if (allUpdates.length === 0) {
          return [];
        }

        // Get updates that this user has already viewed
        const viewedUpdateIds = await db
          .select({ updateId: viewedUpdates.updateId })
          .from(viewedUpdates)
          .where(eq(viewedUpdates.userId, ctx.user.id));

        const viewedIds = new Set(viewedUpdateIds.map(v => v.updateId));

        // Filter to show only unviewed updates
        const unviewedUpdates = allUpdates.filter(update => !viewedIds.has(update.id));

        return unviewedUpdates;
      } catch (error) {
        console.error("[Updates] Error fetching latest updates:", error);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to fetch updates" });
      }
    }),

  /**
   * Mark an update as viewed by the current user.
   */
  markAsViewed: protectedProcedure
    .input(z.object({ updateId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      try {
        // Check if the update exists
        const update = await db
          .select({ id: appUpdates.id })
          .from(appUpdates)
          .where(eq(appUpdates.id, input.updateId))
          .limit(1);

        if (update.length === 0) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Update not found" });
        }

        // Insert a record that this user has viewed this update
        // If it already exists, the unique constraint will prevent duplicates
        await db
          .insert(viewedUpdates)
          .values({
            userId: ctx.user.id,
            updateId: input.updateId,
          })
          .onDuplicateKeyUpdate({
            set: { viewedAt: sql`CURRENT_TIMESTAMP` },
          });

        return { success: true };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("[Updates] Error marking update as viewed:", error);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to mark update as viewed" });
      }
    }),

  /**
   * Get all updates with view counts (admin only).
   */
  getAll: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

    // Only admins can view all updates
    if (ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: "Only admins can view all updates" });
    }

    try {
      const updates = await db
        .select({
          id: appUpdates.id,
          title: appUpdates.title,
          description: appUpdates.description,
          version: appUpdates.version,
          language: appUpdates.language,
          displayedCount: appUpdates.displayedCount,
          createdAt: appUpdates.createdAt,
          viewCount: sql<number>`(SELECT COUNT(*) FROM viewed_updates WHERE updateId = ${appUpdates.id})`,
        })
        .from(appUpdates)
        .orderBy(desc(appUpdates.createdAt));

      return updates;
    } catch (error) {
      console.error("[Updates] Error fetching all updates:", error);
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to fetch updates" });
    }
  }),

  /**
   * Create a new update (admin only).
   * Language defaults to "ca" (Catalan) — all updates are Catalan-only.
   */
  create: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1).max(255),
        description: z.string().min(1),
        version: z.string().min(1).max(32),
        language: z.enum(["ca"]).default("ca"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      // Only admins can create updates
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only admins can create updates" });
      }

      try {
        const result = await db.insert(appUpdates).values({
          title: input.title,
          description: input.description,
          version: input.version,
          language: input.language,
          displayedCount: 0,
        });

        return { success: true, id: (result as any).insertId };
      } catch (error) {
        console.error("[Updates] Error creating update:", error);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create update" });
      }
    }),
});
