/**
 * Meeting Invitation Router
 *
 * Allows users to send scheduled meeting invitations with a date/time slot,
 * duration, title, and optional message. Recipients can accept or decline.
 * Accepted invitations create a SebaMeet room that both parties can join.
 */
import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { meetingInvitations, users } from "../../drizzle/schema";
import { and, eq, or, desc, lte, isNull } from "drizzle-orm";
import { notifyOwner } from "../_core/notification";

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
        agenda: z.string().max(4000).optional(),
        recurrence: z.enum(["none", "weekly", "biweekly"]).default("none"),
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
        agenda: input.agenda ?? null,
        recurrence: input.recurrence,
        roomName,
        status: "pending",
      });

      // Notify the owner (project owner = school admin) so they can see new invitations
      // Also build a user-facing notification message for the recipient
      const senderRows = await db
        .select({ name: users.name })
        .from(users)
        .where(eq(users.id, ctx.user.id))
        .limit(1);
      const senderName = senderRows[0]?.name ?? `User ${ctx.user.id}`;
      const proposedStr = input.proposedAt.toLocaleString("en-GB", {
        day: "numeric", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      });
      await notifyOwner({
        title: `📅 New meeting invitation: ${input.title}`,
        content: `${senderName} invited you to "${input.title}" on ${proposedStr} (${input.durationMinutes} min).${input.message ? ` Message: ${input.message}` : ""}`,
      }).catch(() => { /* non-critical */ });

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

      // Notify the sender that their invitation was accepted
      const acceptorRows = await db
        .select({ name: users.name })
        .from(users)
        .where(eq(users.id, ctx.user.id))
        .limit(1);
      const acceptorName = acceptorRows[0]?.name ?? `User ${ctx.user.id}`;
      const proposedStr = rows[0].proposedAt.toLocaleString("en-GB", {
        day: "numeric", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      });
      await notifyOwner({
        title: `✅ Meeting accepted: ${rows[0].title}`,
        content: `${acceptorName} accepted your meeting invitation "${rows[0].title}" scheduled for ${proposedStr}.`,
      }).catch(() => { /* non-critical */ });

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

  /**
   * Check and send 15-minute reminders for accepted meetings.
   * Called periodically by the frontend (every 5 min) for the logged-in user.
   * Finds accepted meetings where proposedAt is within 15–20 min from now
   * and reminderSentAt is NULL, then sends a notification and marks it sent.
   */
  checkReminders: protectedProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return { sent: 0 };

    const now   = new Date();
    const soon  = new Date(now.getTime() + 20 * 60_000); // 20 min window
    const start = new Date(now.getTime() + 14 * 60_000); // 14 min from now

    // Find accepted meetings for this user (as sender or recipient) in the reminder window
    const rows = await db
      .select()
      .from(meetingInvitations)
      .where(
        and(
          eq(meetingInvitations.status, "accepted"),
          isNull(meetingInvitations.reminderSentAt),
          lte(meetingInvitations.proposedAt, soon)
        )
      );

    // Filter: proposedAt >= start (within 14-20 min window) and involves this user
    const due = rows.filter(
      (r) =>
        r.proposedAt >= start &&
        (r.fromUserId === ctx.user.id || r.toUserId === ctx.user.id)
    );

    let sent = 0;
    for (const inv of due) {
      // Resolve the other participant's name
      const otherId = inv.fromUserId === ctx.user.id ? inv.toUserId : inv.fromUserId;
      const otherRows = await db
        .select({ name: users.name })
        .from(users)
        .where(eq(users.id, otherId))
        .limit(1);
      const otherName = otherRows[0]?.name ?? `User ${otherId}`;

      const minutesAway = Math.round((inv.proposedAt.getTime() - now.getTime()) / 60_000);

      await notifyOwner({
        title: `⏰ Meeting in ${minutesAway} min: ${inv.title}`,
        content: `Your meeting “${inv.title}” with ${otherName} starts in about ${minutesAway} minutes. Room: ${inv.roomName}`,
      });

      // Mark reminder sent
      await db
        .update(meetingInvitations)
        .set({ reminderSentAt: now })
        .where(eq(meetingInvitations.id, inv.id));

      sent++;
    }

    return { sent };
  }),
});
