/**
 * navOrder router
 *
 * Persists per-user navigation link ordering for super-admins.
 * The order is stored as a JSON array of href strings in the `navLinkOrder`
 * TEXT column on the `users` table (migration 0069).
 *
 * Only super-admins (ctx.isSuperAdmin) are allowed to read/write this data.
 * All other users receive a FORBIDDEN error.
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { adminProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { users } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

export const navOrderRouter = router({
  /**
   * Returns the super-admin's saved nav link order.
   * Returns null if no custom order has been saved yet (UI uses default order).
   */
  getNavOrder: adminProcedure.query(async ({ ctx }) => {
    if (!ctx.isSuperAdmin) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Super-admin only" });
    }
    const db = await getDb();
    if (!db) return { order: null };
    const [row] = await db
      .select({ navLinkOrder: users.navLinkOrder })
      .from(users)
      .where(eq(users.id, ctx.user.id))
      .limit(1);
    if (!row?.navLinkOrder) return { order: null };
    try {
      const parsed = JSON.parse(row.navLinkOrder);
      if (Array.isArray(parsed)) return { order: parsed as string[] };
      return { order: null };
    } catch {
      return { order: null };
    }
  }),

  /**
   * Saves the super-admin's preferred nav link order.
   * Accepts an array of href strings (the keys that identify each nav section).
   */
  saveNavOrder: adminProcedure
    .input(
      z.object({
        order: z.array(z.string()).min(1).max(50),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.isSuperAdmin) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Super-admin only" });
      }
      const db = await getDb();
      if (!db) return { ok: false };
      await db
        .update(users)
        .set({ navLinkOrder: JSON.stringify(input.order) })
        .where(eq(users.id, ctx.user.id));
      return { ok: true };
    }),
});
