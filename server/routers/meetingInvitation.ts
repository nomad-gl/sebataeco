/**
 * Meeting Invitation Router
 *
 * Allows users to send scheduled meeting invitations with a date/time slot,
 * duration, title, and optional message. Recipients can accept or decline.
 * Accepted invitations create a SebaMeet room that both parties can join.
 */
import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { meetingInvitations, users } from "../../drizzle/schema";
import { and, eq, or, desc } from "drizzle-orm";

export const meetingInvitationRouter = router({
  /** Send a meeting invitation to another user. */
  send: protectedProcedure
    .input(
      z.object({
        toUserId: z.number().int().positive(),
        title: z.string().min(1).max(256),
        proposedAt: z.date(),
        durationMinutes: z.number().int().min(5).max(480).default(30),
        message: z.string().max(1000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      // Deterministic room name: meeting-{min}-{max}-{timestamp}
      const a = Math.min(ctx.user.id, input.toUserId);
      const b = Math.max(ctx.user.id, input.toUserId);
      const roomName = `meeting-${a}-${b}-${Date.now()}`;

      const result = await db.insert(meetingInvitations).values({
        fromUserId: ctx.user.id,
        toUserId: input.toUserId,
        title: input.title,
        proposedAt: input.proposedAt,
        durationMinutes: input.durationMinutes,
        message: input.message ?? null,
        roomName,
        status: "pending",
      });

      return { invitationId: Number((result as any).insertId), roomName };
    }),

  /** Get pending invitations addressed to the current user. */
  getPending: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];

    const rows = await db
      .select()
      .from(meetingInvitations)
      .where(
        and(
          eq(meetingInvitations.toUserId, ctx.user.id),
          eq(meetingInvitations.status, "pending")
        )
      )
      .orderBy(desc(meetingInvitations.createdAt));

    // Enrich with sender name
    const enriched = [];
    for (const row of rows) {
      const senderRows = await db
        .select({ name: users.name })
        .from(users)
        .where(eq(users.id, row.fromUserId))
        .limit(1);
      enriched.push({
        ...row,
        fromName: senderRows[0]?.name ?? `User ${row.fromUserId}`,
      });
    }
    return enriched;
  }),

  /** Get pending invitations sent by the current user (to track responses). */
  getSent: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];

    const rows = await db
      .select()
      .from(meetingInvitations)
      .where(eq(meetingInvitations.fromUserId, ctx.user.id))
      .orderBy(desc(meetingInvitations.createdAt))
      .limit(20);

    const enriched = [];
    for (const row of rows) {
      const toRows = await db
        .select({ name: users.name })
        .from(users)
        .where(eq(users.id, row.toUserId))
        .limit(1);
      enriched.push({
        ...row,
        toName: toRows[0]?.name ?? `User ${row.toUserId}`,
      });
    }
    return enriched;
  }),

  /** Get all invitations (sent + received) for history view. */
  getHistory: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];

    const rows = await db
      .select()
      .from(meetingInvitations)
      .where(
        or(
          eq(meetingInvitations.fromUserId, ctx.user.id),
          eq(meetingInvitations.toUserId, ctx.user.id)
        )
      )
      .orderBy(desc(meetingInvitations.createdAt))
      .limit(30);

    const enriched = [];
    for (const row of rows) {
      const fromRows = await db.select({ name: users.name }).from(users).where(eq(users.id, row.fromUserId)).limit(1);
      const toRows   = await db.select({ name: users.name }).from(users).where(eq(users.id, row.toUserId)).limit(1);
      enriched.push({
        ...row,
        fromName: fromRows[0]?.name ?? `User ${row.fromUserId}`,
        toName:   toRows[0]?.name   ?? `User ${row.toUserId}`,
        isMine: row.fromUserId === ctx.user.id,
      });
    }
    return enriched;
  }),

  /** Count pending invitations for badge display. */
  getPendingCount: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return { count: 0 };
    const rows = await db
      .select()
      .from(meetingInvitations)
      .where(and(eq(meetingInvitations.toUserId, ctx.user.id), eq(meetingInvitations.status, "pending")));
    return { count: rows.length };
  }),

  /** Accept an invitation. */
  accept: protectedProcedure
    .input(z.object({ invitationId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      const rows = await db
        .select()
        .from(meetingInvitations)
        .where(and(eq(meetingInvitations.id, input.invitationId), eq(meetingInvitations.toUserId, ctx.user.id)))
        .limit(1);

      if (!rows[0]) throw new Error("Invitation not found");

      await db
        .update(meetingInvitations)
        .set({ status: "accepted", respondedAt: new Date() })
        .where(eq(meetingInvitations.id, input.invitationId));

      return { roomName: rows[0].roomName };
    }),

  /** Decline an invitation. */
  decline: protectedProcedure
    .input(z.object({ invitationId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      await db
        .update(meetingInvitations)
        .set({ status: "declined", respondedAt: new Date() })
        .where(
          and(
            eq(meetingInvitations.id, input.invitationId),
            eq(meetingInvitations.toUserId, ctx.user.id)
          )
        );

      return { ok: true };
    }),

  /** Cancel an invitation (sender only). */
  cancel: protectedProcedure
    .input(z.object({ invitationId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      await db
        .update(meetingInvitations)
        .set({ status: "cancelled" })
        .where(
          and(
            eq(meetingInvitations.id, input.invitationId),
            eq(meetingInvitations.fromUserId, ctx.user.id)
          )
        );

      return { ok: true };
    }),
});
