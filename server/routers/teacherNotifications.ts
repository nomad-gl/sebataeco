import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { TRPCError } from "@trpc/server";
import { sql } from "drizzle-orm";

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

      // Build query
      let query = db
        .selectFrom("teacher_notifications")
        .selectAll()
        .where("teacher_id", "=", ctx.user.id);

      if (input.unreadOnly) {
        query = query.where("is_read", "=", false);
      }

      // Get total count
      const countResult = await query.execute();
      const total = countResult.length;

      // Get paginated results
      const notifications = await query
        .orderBy("created_at", "desc")
        .limit(input.limit)
        .offset(offset)
        .execute();

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
      .selectFrom("teacher_notifications")
      .select(sql`COUNT(*) as count`.as("count"))
      .where("teacher_id", "=", ctx.user.id)
      .where("is_read", "=", false)
      .execute();

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
        .selectFrom("teacher_notifications")
        .selectAll()
        .where("id", "=", input.notificationId)
        .executeTakeFirst();

      if (!notification) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      if (notification.teacher_id !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      await db
        .updateTable("teacher_notifications")
        .set({ is_read: true })
        .where("id", "=", input.notificationId)
        .execute();

      return { success: true };
    }),

  // Mark all notifications as read
  markAllAsRead: protectedProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    await db
      .updateTable("teacher_notifications")
      .set({ is_read: true })
      .where("teacher_id", "=", ctx.user.id)
      .execute();

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
        .selectFrom("teacher_notifications")
        .selectAll()
        .where("id", "=", input.notificationId)
        .executeTakeFirst();

      if (!notification) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      if (notification.teacher_id !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      await db
        .deleteFrom("teacher_notifications")
        .where("id", "=", input.notificationId)
        .execute();

      return { success: true };
    }),

  // Clear all notifications
  clearAll: protectedProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    await db
      .deleteFrom("teacher_notifications")
      .where("teacher_id", "=", ctx.user.id)
      .execute();

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
        .insertInto("teacher_notifications")
        .values({
          teacher_id: input.teacher_id,
          notification_type: input.notification_type,
          title: input.title,
          message: input.message,
          related_id: input.related_id || null,
          is_read: false,
        })
        .execute();

      return { success: true, id: result[0]?.insertId };
    }),

  // Get notification by ID
  getNotificationById: protectedProcedure
    .input(z.object({ notificationId: z.number().int() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const notification = await db
        .selectFrom("teacher_notifications")
        .selectAll()
        .where("id", "=", input.notificationId)
        .executeTakeFirst();

      if (!notification) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      if (notification.teacher_id !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      return notification;
    }),
});
