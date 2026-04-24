import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import {
  teacherAttendance,
  teacherAbsenceNotifications,
  attendanceDailyComments,
  users,
} from "../../drizzle/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
import { notifyOwner } from "../_core/notification";

// ─── helpers ────────────────────────────────────────────────────────────────

/** Returns today's date as YYYY-MM-DD in the server's local timezone */
function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Returns true if the caller is a director or head_of_study */
function isAdminOrHos(role: string, position: string) {
  return (
    role === "admin" ||
    role === "director" ||
    role === "head_of_study" ||
    position === "director" ||
    position === "head_of_study"
  );
}

// ─── router ─────────────────────────────────────────────────────────────────

export const teacherAttendanceRouter = router({
  /**
   * Teacher: check in for today.
   * Creates or updates the attendance record for the calling teacher.
   */
  checkIn: protectedProcedure
    .input(
      z.object({
        notes: z.string().max(512).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      if (!ctx.user.tenantId)
        throw new TRPCError({ code: "FORBIDDEN", message: "No school assigned" });

      const today = todayStr();
      const now = new Date();

      // Check if already checked in
      const [existing] = await db
        .select()
        .from(teacherAttendance)
        .where(
          and(
            eq(teacherAttendance.userId, ctx.user.id),
            eq(teacherAttendance.attendanceDate, today as any)
          )
        )
        .limit(1);

      if (existing) {
        // Update existing record
        await db
          .update(teacherAttendance)
          .set({ status: "present", checkInAt: now, notes: input.notes ?? existing.notes })
          .where(eq(teacherAttendance.id, existing.id));
        return { success: true, alreadyCheckedIn: true };
      }

      // Insert new record
      await db.insert(teacherAttendance).values({
        userId: ctx.user.id,
        attendanceDate: today as any,
        status: "present",
        checkInAt: now,
        notes: input.notes,
        tenantId: ctx.user.tenantId,
      });

      return { success: true, alreadyCheckedIn: false };
    }),

  /**
   * Teacher: get my attendance status for today.
   */
  getMyStatus: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

    const today = todayStr();
    const [record] = await db
      .select()
      .from(teacherAttendance)
      .where(
        and(
          eq(teacherAttendance.userId, ctx.user.id),
          eq(teacherAttendance.attendanceDate, today as any)
        )
      )
      .limit(1);

    // Also get any pending/approved absence notification for today
    const [absenceNote] = await db
      .select()
      .from(teacherAbsenceNotifications)
      .where(
        and(
          eq(teacherAbsenceNotifications.userId, ctx.user.id),
          eq(teacherAbsenceNotifications.absenceDate, today as any)
        )
      )
      .limit(1);

    return { record: record ?? null, absenceNotification: absenceNote ?? null };
  }),

  /**
   * Teacher: submit an advance absence notification for a future (or today's) date.
   */
  notifyAbsence: protectedProcedure
    .input(
      z.object({
        absenceDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
        reason: z.string().min(5).max(512),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      if (!ctx.user.tenantId)
        throw new TRPCError({ code: "FORBIDDEN", message: "No school assigned" });

      // Upsert: one notification per (userId, absenceDate)
      const [existing] = await db
        .select()
        .from(teacherAbsenceNotifications)
        .where(
          and(
            eq(teacherAbsenceNotifications.userId, ctx.user.id),
            eq(teacherAbsenceNotifications.absenceDate, input.absenceDate as any)
          )
        )
        .limit(1);

      if (existing) {
        await db
          .update(teacherAbsenceNotifications)
          .set({
            reason: input.reason,
            absenceStatus: "pending",
            reviewedByUserId: undefined,
            reviewedAt: undefined,
            reviewNote: undefined,
          })
          .where(eq(teacherAbsenceNotifications.id, existing.id));
        return { success: true, id: existing.id };
      }

      const [result] = await db.insert(teacherAbsenceNotifications).values({
        userId: ctx.user.id,
        absenceDate: input.absenceDate as any,
        reason: input.reason,
        tenantId: ctx.user.tenantId,
      });

      // Notify owner
      const teacherName = ctx.user.displayName ?? ctx.user.name ?? ctx.user.email ?? `Teacher #${ctx.user.id}`;
      await notifyOwner({
        title: "Absence Notification",
        content: `${teacherName} has notified an absence on ${input.absenceDate}. Reason: ${input.reason}`,
      }).catch(() => {});

      return { success: true, id: (result as any).insertId as number };
    }),

  /**
   * Teacher: get my upcoming absence notifications.
   */
  getMyAbsenceNotifications: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

    return db
      .select()
      .from(teacherAbsenceNotifications)
      .where(eq(teacherAbsenceNotifications.userId, ctx.user.id))
      .orderBy(desc(teacherAbsenceNotifications.absenceDate))
      .limit(20);
  }),

  /**
   * Director / HoS: get the full attendance register for a given date.
   * Returns all teachers in the school with their status for that day.
   */
  getRegister: protectedProcedure
    .input(
      z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      if (!isAdminOrHos(ctx.user.role, ctx.user.position))
        throw new TRPCError({ code: "FORBIDDEN" });

      const tenantId = ctx.user.tenantId;
      if (!tenantId) throw new TRPCError({ code: "FORBIDDEN", message: "No school assigned" });

      // All teachers in this school
      const teachers = await db
        .select({
          id: users.id,
          name: users.name,
          displayName: users.displayName,
          email: users.email,
          position: users.position,
          role: users.role,
        })
        .from(users)
        .where(
          and(
            eq(users.tenantId, tenantId),
            eq(users.position, "teacher")
          )
        );

      if (teachers.length === 0) return { teachers: [], records: [], absenceNotifications: [] };

      const teacherIds = teachers.map((t) => t.id);

      // Attendance records for this date
      const records = await db
        .select()
        .from(teacherAttendance)
        .where(
          and(
            eq(teacherAttendance.attendanceDate, input.date as any),
            inArray(teacherAttendance.userId, teacherIds)
          )
        );

      // Absence notifications for this date
      const absenceNotifications = await db
        .select()
        .from(teacherAbsenceNotifications)
        .where(
          and(
            eq(teacherAbsenceNotifications.absenceDate, input.date as any),
            inArray(teacherAbsenceNotifications.userId, teacherIds)
          )
        );

      return { teachers, records, absenceNotifications };
    }),

  /**
   * Director / HoS: review (approve/reject) an absence notification.
   */
  reviewAbsenceNotification: protectedProcedure
    .input(
      z.object({
        notificationId: z.number().int().positive(),
        decision: z.enum(["approved", "rejected"]),
        reviewNote: z.string().max(512).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      if (!isAdminOrHos(ctx.user.role, ctx.user.position))
        throw new TRPCError({ code: "FORBIDDEN" });

      await db
        .update(teacherAbsenceNotifications)
        .set({
          absenceStatus: input.decision,
          reviewedByUserId: ctx.user.id,
          reviewedAt: new Date(),
          reviewNote: input.reviewNote,
        })
        .where(eq(teacherAbsenceNotifications.id, input.notificationId));

      return { success: true };
    }),

  /**
   * Director / HoS: add a manual comment to the daily log.
   */
  addDailyComment: protectedProcedure
    .input(
      z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        comment: z.string().min(1).max(2000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      if (!isAdminOrHos(ctx.user.role, ctx.user.position))
        throw new TRPCError({ code: "FORBIDDEN" });

      const tenantId = ctx.user.tenantId;
      if (!tenantId) throw new TRPCError({ code: "FORBIDDEN" });

      await db.insert(attendanceDailyComments).values({
        commentDate: input.date as any,
        authorId: ctx.user.id,
        comment: input.comment,
        isAlarm: false,
        acknowledged: true,
        tenantId,
      });

      return { success: true };
    }),

  /**
   * Director / HoS: get all daily comments for a given date.
   */
  getDailyComments: protectedProcedure
    .input(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      if (!isAdminOrHos(ctx.user.role, ctx.user.position))
        throw new TRPCError({ code: "FORBIDDEN" });

      const tenantId = ctx.user.tenantId;
      if (!tenantId) throw new TRPCError({ code: "FORBIDDEN" });

      return db
        .select()
        .from(attendanceDailyComments)
        .where(
          and(
            eq(attendanceDailyComments.commentDate, input.date as any),
            eq(attendanceDailyComments.tenantId, tenantId)
          )
        )
        .orderBy(attendanceDailyComments.createdAt);
    }),

  /**
   * Director / HoS: get unacknowledged alarm comments for today (for popup).
   */
  getUnacknowledgedAlarms: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

    if (!isAdminOrHos(ctx.user.role, ctx.user.position)) return [];

    const tenantId = ctx.user.tenantId;
    if (!tenantId) return [];

    const today = todayStr();
    return db
      .select()
      .from(attendanceDailyComments)
      .where(
        and(
          eq(attendanceDailyComments.commentDate, today as any),
          eq(attendanceDailyComments.tenantId, tenantId),
          eq(attendanceDailyComments.isAlarm, true),
          eq(attendanceDailyComments.acknowledged, false)
        )
      )
      .orderBy(attendanceDailyComments.createdAt);
  }),

  /**
   * Director / HoS: acknowledge (dismiss) an alarm popup.
   */
  acknowledgeAlarm: protectedProcedure
    .input(z.object({ commentId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      if (!isAdminOrHos(ctx.user.role, ctx.user.position))
        throw new TRPCError({ code: "FORBIDDEN" });

      await db
        .update(attendanceDailyComments)
        .set({ acknowledged: true })
        .where(eq(attendanceDailyComments.id, input.commentId));

      return { success: true };
    }),

  /**
   * Director / HoS: acknowledge ALL unacknowledged alarms for today at once.
   */
  acknowledgeAllAlarms: protectedProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

    if (!isAdminOrHos(ctx.user.role, ctx.user.position))
      throw new TRPCError({ code: "FORBIDDEN" });

    const tenantId = ctx.user.tenantId;
    if (!tenantId) throw new TRPCError({ code: "FORBIDDEN" });

    const today = todayStr();
    await db
      .update(attendanceDailyComments)
      .set({ acknowledged: true })
      .where(
        and(
          eq(attendanceDailyComments.commentDate, today as any),
          eq(attendanceDailyComments.tenantId, tenantId),
          eq(attendanceDailyComments.isAlarm, true),
          eq(attendanceDailyComments.acknowledged, false)
        )
      );

    return { success: true };
  }),

  /**
   * Internal / cron: fire the 09:00 alarm for a given tenant.
   * Called by the server cron job — not exposed to end users.
   * Exported separately as a standalone function too (see attendanceAlarm.ts).
   */
  triggerAlarmCheck: protectedProcedure
    .input(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      if (!isAdminOrHos(ctx.user.role, ctx.user.position))
        throw new TRPCError({ code: "FORBIDDEN" });

      const tenantId = ctx.user.tenantId;
      if (!tenantId) throw new TRPCError({ code: "FORBIDDEN" });

      const date = input.date ?? todayStr();
      const alarmsCreated = await runAttendanceAlarmForTenant(tenantId, date);
      return { success: true, alarmsCreated };
    }),
});

// ─── standalone alarm function (used by cron) ───────────────────────────────

/**
 * Checks all teachers in a tenant for a given date.
 * For each teacher who has NOT checked in AND has no approved/pending absence notification,
 * inserts an alarm comment and sends an owner notification.
 * Returns the number of alarm entries created.
 */
export async function runAttendanceAlarmForTenant(
  tenantId: number,
  date: string
): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  // All teachers in this school
  const teachers = await db
    .select({ id: users.id, name: users.name, displayName: users.displayName, email: users.email })
    .from(users)
    .where(and(eq(users.tenantId, tenantId), eq(users.position, "teacher")));

  if (teachers.length === 0) return 0;

  const teacherIds = teachers.map((t) => t.id);

  // Who has checked in?
  const checkedIn = await db
    .select({ userId: teacherAttendance.userId })
    .from(teacherAttendance)
    .where(
      and(
        eq(teacherAttendance.attendanceDate, date as any),
        eq(teacherAttendance.status, "present"),
        inArray(teacherAttendance.userId, teacherIds)
      )
    );
  const checkedInIds = new Set(checkedIn.map((r) => r.userId));

  // Who has an absence notification (pending or approved)?
  const notified = await db
    .select({ userId: teacherAbsenceNotifications.userId })
    .from(teacherAbsenceNotifications)
    .where(
      and(
        eq(teacherAbsenceNotifications.absenceDate, date as any),
        inArray(teacherAbsenceNotifications.userId, teacherIds)
      )
    );
  const notifiedIds = new Set(notified.map((r) => r.userId));

  // Who already has an alarm entry today?
  const existingAlarms = await db
    .select({ comment: attendanceDailyComments.comment })
    .from(attendanceDailyComments)
    .where(
      and(
        eq(attendanceDailyComments.commentDate, date as any),
        eq(attendanceDailyComments.tenantId, tenantId),
        eq(attendanceDailyComments.isAlarm, true)
      )
    );
  const existingAlarmTexts = new Set(existingAlarms.map((a) => a.comment));

  const missing = teachers.filter(
    (t) => !checkedInIds.has(t.id) && !notifiedIds.has(t.id)
  );

  if (missing.length === 0) return 0;

  let created = 0;
  for (const teacher of missing) {
    const teacherName = teacher.displayName ?? teacher.name ?? teacher.email ?? `Teacher #${teacher.id}`;
    const alarmText = `⚠️ ATTENDANCE ALARM: ${teacherName} has not checked in by 09:00 and has not notified an absence for ${date}.`;

    // Avoid duplicate alarm entries
    if (existingAlarmTexts.has(alarmText)) continue;

    await db.insert(attendanceDailyComments).values({
      commentDate: date as any,
      authorId: null,
      comment: alarmText,
      isAlarm: true,
      acknowledged: false,
      tenantId,
    });

    // Also update the attendance record to absent_alarm if not already present
    const [existing] = await db
      .select()
      .from(teacherAttendance)
      .where(
        and(
          eq(teacherAttendance.userId, teacher.id),
          eq(teacherAttendance.attendanceDate, date as any)
        )
      )
      .limit(1);

    if (!existing) {
      await db.insert(teacherAttendance).values({
        userId: teacher.id,
        attendanceDate: date as any,
        status: "absent_alarm",
        tenantId,
      });
    } else if (existing.status !== "present") {
      await db
        .update(teacherAttendance)
        .set({ status: "absent_alarm" })
        .where(eq(teacherAttendance.id, existing.id));
    }

    created++;
  }

  if (created > 0) {
    const names = missing.map((t) => t.displayName ?? t.name ?? t.email ?? `#${t.id}`).join(", ");
    await notifyOwner({
      title: `⚠️ Attendance Alarm — ${date}`,
      content: `${created} teacher(s) have not checked in by 09:00 and have not notified an absence: ${names}`,
    }).catch(() => {});
  }

  return created;
}
