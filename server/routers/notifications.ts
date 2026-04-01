/**
 * Notifications router — in-app notification system for students and teachers.
 */

import { z } from "zod";
import { and, desc, eq, sql } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { notifications } from "../../drizzle/schema";

export const notificationsRouter = router({
  /** Get all notifications for the current user (newest first, max 50) */
  getMyNotifications: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    const rows = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, ctx.user.openId))
      .orderBy(desc(notifications.createdAt))
      .limit(50);
    return rows;
  }),

  /** Count unread notifications for the current user */
  getUnreadCount: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return 0;
    const [row] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, ctx.user.openId),
          eq(notifications.isRead, false)
        )
      );
    return row?.count ?? 0;
  }),

  /** Mark a single notification as read */
  markRead: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return;
      await db
        .update(notifications)
        .set({ isRead: true })
        .where(
          and(
            eq(notifications.id, input.id),
            eq(notifications.userId, ctx.user.openId)
          )
        );
    }),

  /** Mark all notifications as read */
  markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return;
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.userId, ctx.user.openId));
  }),

  /** Delete a notification */
  deleteNotification: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return;
      await db
        .delete(notifications)
        .where(
          and(
            eq(notifications.id, input.id),
            eq(notifications.userId, ctx.user.openId)
          )
        );
    }),
});

/**
 * Helper: create a notification for a specific user.
 * Called from other routers (challenge, materials) to alert students.
 */
export async function createNotification({
  userId,
  type,
  title,
  body,
  link,
}: {
  userId: string;
  type: string;
  title: string;
  body: string;
  link?: string;
}) {
  try {
    const db = await getDb();
    if (!db) return;
    await db.insert(notifications).values({ userId, type, title, body, link: link ?? null });
  } catch (err) {
    console.warn("[Notifications] Failed to create notification:", err);
  }
}
