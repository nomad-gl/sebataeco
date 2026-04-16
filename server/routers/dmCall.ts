import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import {
  initiateCall,
  acceptCall,
  declineCall,
  endCall,
  getPendingCallForUser,
  getCallHistory,
} from "../dmCalls";
import { getDb } from "../db";
import { users } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

export const dmCallRouter = router({
  /** Initiate a DM call — caller creates a pending record. */
  initiate: protectedProcedure
    .input(
      z.object({
        calleeId: z.number().int().positive(),
        roomName: z.string().min(1).max(128),
        audioOnly: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const callId = await initiateCall(
        ctx.user.id,
        input.calleeId,
        input.roomName,
        input.audioOnly
      );
      return { callId };
    }),

  /** Accept an incoming call. */
  accept: protectedProcedure
    .input(z.object({ callId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await acceptCall(input.callId, ctx.user.id);
      return { ok: true };
    }),

  /** Decline an incoming call. */
  decline: protectedProcedure
    .input(z.object({ callId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await declineCall(input.callId, ctx.user.id);
      return { ok: true };
    }),

  /** End an active call. */
  end: protectedProcedure
    .input(z.object({ callId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await endCall(input.callId, ctx.user.id);
      return { ok: true };
    }),

  /** Poll for an incoming pending call (callee polls this). */
  getPending: protectedProcedure.query(async ({ ctx }) => {
    const call = await getPendingCallForUser(ctx.user.id);
    if (!call) return null;
    // Enrich with caller name
    const db = await getDb();
    let callerName = "Unknown";
    if (db) {
      const callerRows = await db
        .select({ name: users.name })
        .from(users)
        .where(eq(users.id, call.callerId))
        .limit(1);
      callerName = callerRows[0]?.name ?? "Unknown";
    }
    return { ...call, callerName };
  }),

  /** Get call history for the current user (last 20 calls). */
  getHistory: protectedProcedure.query(async ({ ctx }) => {
    const calls = await getCallHistory(ctx.user.id);
    const db = await getDb();
    if (!db) return calls.map((c) => ({ ...c, callerName: null, calleeName: null }));

    // Enrich with user names
    const userIds = Array.from(new Set(calls.map((c) => c.callerId).concat(calls.map((c) => c.calleeId))));
    const userRows = await db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(eq(users.id, userIds[0])); // Drizzle doesn't support IN easily; fetch individually
    // Build a map
    const nameMap: Record<number, string> = {};
    for (const uid of userIds) {
      const rows = await db
        .select({ name: users.name })
        .from(users)
        .where(eq(users.id, uid))
        .limit(1);
      nameMap[uid] = rows[0]?.name ?? "Unknown";
    }

    return calls.map((c) => ({
      ...c,
      callerName: nameMap[c.callerId] ?? null,
      calleeName: nameMap[c.calleeId] ?? null,
    }));
  }),
});
