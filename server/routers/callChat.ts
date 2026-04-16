/**
 * callChat router — persists in-call text chat messages and exposes
 * a post-call history query so participants can review the conversation.
 */
import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { callChatMessages } from "../../drizzle/schema";
import { eq, asc, and } from "drizzle-orm";

export const callChatRouter = router({
  /** Save a chat message sent during a call. */
  saveMessage: protectedProcedure
    .input(
      z.object({
        callId:  z.number().int().positive(),
        message: z.string().min(1).max(4000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      await db.insert(callChatMessages).values({
        callId:     input.callId,
        userId:     ctx.user.id,
        senderName: ctx.user.name ?? `User ${ctx.user.id}`,
        message:    input.message,
      });

      return { ok: true };
    }),

  /** Get all chat messages for a completed call (both participants can view). */
  getHistory: protectedProcedure
    .input(z.object({ callId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];

      const rows = await db
        .select()
        .from(callChatMessages)
        .where(eq(callChatMessages.callId, input.callId))
        .orderBy(asc(callChatMessages.sentAt));

      return rows.map((r) => ({
        id:         r.id,
        userId:     r.userId,
        senderName: r.senderName,
        message:    r.message,
        sentAt:     r.sentAt.getTime(),
        own:        r.userId === ctx.user.id,
      }));
    }),
});
