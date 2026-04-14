import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { wakeWords } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

export const wakeWordsRouter = router({
  /** Public — voice hooks call this to get all active wake words */
  getActive: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(wakeWords).where(eq(wakeWords.isActive, true));
  }),

  /** Admin — get all wake words (active + inactive) */
  getAll: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
    const db = await getDb();
    if (!db) return [];
    return db.select().from(wakeWords);
  }),

  /** Admin — add a new wake word */
  add: protectedProcedure
    .input(
      z.object({
        word: z.string().min(1).max(64).toLowerCase(),
        phoneticVariants: z.array(z.string()).default([]),
        isPrimary: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // If new word is primary, demote existing primary
      if (input.isPrimary) {
        await db.update(wakeWords).set({ isPrimary: false }).where(eq(wakeWords.isPrimary, true));
      }

      await db.insert(wakeWords).values({
        word: input.word.toLowerCase().trim(),
        phoneticVariants: JSON.stringify(input.phoneticVariants),
        isPrimary: input.isPrimary,
        isActive: true,
      });
      return { success: true };
    }),

  /** Admin — delete a wake word */
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(wakeWords).where(eq(wakeWords.id, input.id));
      return { success: true };
    }),

  /** Admin — toggle active state */
  toggleActive: protectedProcedure
    .input(z.object({ id: z.number(), isActive: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(wakeWords).set({ isActive: input.isActive }).where(eq(wakeWords.id, input.id));
      return { success: true };
    }),

  /** Admin — set a word as the primary (shown in UI hint) */
  setPrimary: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      // Demote all, then promote the target
      await db.update(wakeWords).set({ isPrimary: false }).where(eq(wakeWords.isPrimary, true));
      await db.update(wakeWords).set({ isPrimary: true }).where(eq(wakeWords.id, input.id));
      return { success: true };
    }),

  /** Admin — update phonetic variants for a word */
  updateVariants: protectedProcedure
    .input(z.object({ id: z.number(), phoneticVariants: z.array(z.string()) }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db
        .update(wakeWords)
        .set({ phoneticVariants: JSON.stringify(input.phoneticVariants) })
        .where(eq(wakeWords.id, input.id));
      return { success: true };
    }),
});
