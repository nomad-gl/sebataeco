import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { TRPCError } from "@trpc/server";
import { eq, desc, and, sql } from "drizzle-orm";
import { teacher_notifications } from "../drizzle/schema";

export const teacherNotificationsRouter = router({
  // Get all notifications for current teacher
  getNotifications: protectedProcedure
    .input(
      z.object({
        page: z.number().int().positive().default(1),
        limit: z.number().int().positive().max(50).default(10),
        unreadOnly: z.boolean().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const offset = (input.page - 1) * input.limit;

      // Build where conditions
      const conditions = [eq(teacher_notifications.teacher_id, ctx.user.id)];
      if (input.unreadOnly) {
        conditions.push(eq(teacher_notifications.is_read, false));
      }

      // Get total count
      const countResult = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(teacher_notifications)
        .where(and(...conditions));
      
      const total = countResult[0]?.count || 0;

      // Get paginated results
      const notifications = await db
        .select()
        .from(teacher_notifications)
        .where(and(...conditions))
        .orderBy(desc(teacher_notifications.created_at))
        .limit(input.limit)
        .offset(offset);

      return {
        notifications,
        total,
        page: input.page,
        limit: input.limit,
        pages: Math.ceil(total / input.limit),
      };
    }),

  // Get unread notification count
  getUnreadCount: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    const result = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(teacher_notifications)
      .where(
        and(
          eq(teacher_notifications.teacher_id, ctx.user.id),
          eq(teacher_notifications.is_read, false)
        )
      );

    return result[0]?.count || 0;
  }),

  // Mark notification as read
  markAsRead: protectedProcedure
    .input(z.object({ notificationId: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Verify ownership
      const notification = await db
        .select()
        .from(teacher_notifications)
        .where(eq(teacher_notifications.id, input.notificationId))
        .limit(1);

      if (!notification || notification.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      if (notification[0].teacher_id !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      await db
        .update(teacher_notifications)
        .set({ is_read: true })
        .where(eq(teacher_notifications.id, input.notificationId));

      return { success: true };
    }),

  // Mark all notifications as read
  markAllAsRead: protectedProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    await db
      .update(teacher_notifications)
      .set({ is_read: true })
      .where(eq(teacher_notifications.teacher_id, ctx.user.id));

    return { success: true };
  }),

  // Delete notification
  deleteNotification: protectedProcedure
    .input(z.object({ notificationId: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Verify ownership
      const notification = await db
        .select()
        .from(teacher_notifications)
        .where(eq(teacher_notifications.id, input.notificationId))
        .limit(1);

      if (!notification || notification.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      if (notification[0].teacher_id !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      await db
        .delete(teacher_notifications)
        .where(eq(teacher_notifications.id, input.notificationId));

      return { success: true };
    }),

  // Clear all notifications
  clearAll: protectedProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    await db
      .delete(teacher_notifications)
      .where(eq(teacher_notifications.teacher_id, ctx.user.id));

    return { success: true };
  }),

  // Create notification (admin/system only)
  createNotification: protectedProcedure
    .input(
      z.object({
        teacher_id: z.number().int(),
        notification_type: z.enum([
          "profile_update",
          "subject_assignment",
          "schedule_change",
          "assignment_history",
          "general",
        ]),
        title: z.string().min(1).max(255),
        message: z.string().min(1),
        related_id: z.number().int().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Only directors/admins can create notifications
      if (ctx.user.role !== "admin" && ctx.user.position !== "director") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const result = await db
        .insert(teacher_notifications)
        .values({
          teacher_id: input.teacher_id,
          notification_type: input.notification_type,
          title: input.title,
          message: input.message,
          related_id: input.related_id || null,
          is_read: false,
          created_at: new Date(),
          updated_at: new Date(),
        });

      return { success: true };
    }),

  // Get notification by ID
  getNotificationById: protectedProcedure
    .input(z.object({ notificationId: z.number().int() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const notification = await db
        .select()
        .from(teacher_notifications)
        .where(eq(teacher_notifications.id, input.notificationId))
        .limit(1);

      if (!notification || notification.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      if (notification[0].teacher_id !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      return notification[0];
    }),
});
