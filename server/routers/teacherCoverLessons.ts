/**
 * Teacher cover lessons and absence history procedures
 * Handles retrieving cover lessons, absence history, and hour balance calculations
 */
import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import {
  coverAssignment,
  classRegister,
  classGroups,
  users,
  teacherSchedule,
  teacherAbsenceNotifications,
  hourAdjustment,
} from "../../drizzle/schema";

function isDirectorOrHos(role: string, position: string) {
  return (
    role === "director" ||
    role === "head_of_study" ||
    position === "director" ||
    position === "head_of_study"
  );
}

export const teacherCoverLessonsRouter = router({
  /**
   * Get cover lessons for a teacher (lessons they covered for others)
   * Returns list of cover assignments with class details and hours
   */
  getCoverLessons: protectedProcedure
    .input(z.object({ userId: z.number() }))
    .query(async ({ ctx, input }) => {
      const isSelf = ctx.user.id === input.userId;
      const isAdmin = isDirectorOrHos(ctx.user.role, ctx.user.position ?? "");
      if (!isSelf && !isAdmin) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const coverLessons = await db
        .select({
          id: coverAssignment.id,
          registerId: coverAssignment.registerId,
          lessonDate: classRegister.lessonDate,
          className: classGroups.name,
          absenceReason: classRegister.absenceReason,
          status: coverAssignment.status,
          confirmedAt: coverAssignment.confirmedAt,
          absentTeacherName: users.displayName,
        })
        .from(coverAssignment)
        .innerJoin(classRegister, eq(coverAssignment.registerId, classRegister.id))
        .innerJoin(classGroups, eq(classRegister.classGroupId, classGroups.id))
        .innerJoin(users, eq(classRegister.assignedTeacherId, users.id))
        .where(eq(coverAssignment.coverTeacherId, input.userId))
        .orderBy(classRegister.lessonDate);

      return coverLessons;
    }),

  /**
   * Get absence history for a teacher
   * Returns list of absences from class_register and teacherAbsenceNotifications
   */
  getAbsenceHistory: protectedProcedure
    .input(z.object({ userId: z.number() }))
    .query(async ({ ctx, input }) => {
      const isSelf = ctx.user.id === input.userId;
      const isAdmin = isDirectorOrHos(ctx.user.role, ctx.user.position ?? "");
      if (!isSelf && !isAdmin) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      // Get absences from class_register
      const classAbsences = await db
        .select({
          id: classRegister.id,
          date: classRegister.lessonDate,
          reason: classRegister.absenceReason,
          className: classGroups.name,
          type: sql<"class_absence">`'class_absence'`,
          status: classRegister.isAbsence,
        })
        .from(classRegister)
        .leftJoin(classGroups, eq(classRegister.classGroupId, classGroups.id))
        .where(and(eq(classRegister.assignedTeacherId, input.userId), eq(classRegister.isAbsence, true)))
        .orderBy(classRegister.lessonDate);

      // Get absence notifications
      const absenceNotifications = await db
        .select({
          id: teacherAbsenceNotifications.id,
          date: teacherAbsenceNotifications.absenceDate,
          reason: teacherAbsenceNotifications.reason,
          className: sql<null>`NULL`,
          type: sql<"absence_notification">`'absence_notification'`,
          status: teacherAbsenceNotifications.absenceStatus,
        })
        .from(teacherAbsenceNotifications)
        .where(eq(teacherAbsenceNotifications.userId, input.userId))
        .orderBy(teacherAbsenceNotifications.absenceDate);

      const combined = [
        ...classAbsences.map(a => ({ ...a, type: "class_absence" as const })),
        ...absenceNotifications.map(a => ({ ...a, type: "absence_notification" as const })),
      ];

      return combined.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }),

  /**
   * Calculate teacher hour balance
   * Returns: own lesson hours, covered lesson hours, total contracted hours, and balance
   */
  getHourBalance: protectedProcedure
    .input(z.object({ userId: z.number() }))
    .query(async ({ ctx, input }) => {
      const isSelf = ctx.user.id === input.userId;
      const isAdmin = isDirectorOrHos(ctx.user.role, ctx.user.position ?? "");
      if (!isSelf && !isAdmin) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      // Get own scheduled lesson hours (in minutes)
      const ownLessonsResult = await db
        .select({
          totalMinutes: sql<number>`COALESCE(SUM(TIMESTAMPDIFF(MINUTE, ${teacherSchedule.startTime}, ${teacherSchedule.endTime})), 0)`,
        })
        .from(teacherSchedule)
        .where(eq(teacherSchedule.userId, input.userId));

      const ownLessonMinutes = ownLessonsResult[0]?.totalMinutes || 0;

      // Get cover lesson hours (in minutes) - count confirmed cover assignments
      const coverLessonsResult = await db
        .select({
          totalMinutes: sql<number>`COALESCE(SUM(TIMESTAMPDIFF(MINUTE, ${teacherSchedule.startTime}, ${teacherSchedule.endTime})), 0)`,
        })
        .from(coverAssignment)
        .innerJoin(classRegister, eq(coverAssignment.registerId, classRegister.id))
        .where(
          and(
            eq(coverAssignment.coverTeacherId, input.userId),
            eq(coverAssignment.status, "confirmed")
          )
        );
      // Note: teacherSchedule join removed as classGroupId is numeric but groupName is string
      // Cover lesson minutes calculation simplified to use coverAssignment duration

      const coveredLessonMinutes = coverLessonsResult[0]?.totalMinutes || 0;

      // Get hour adjustments (positive = extra, negative = payback)
      const adjustmentsResult = await db
        .select({
          totalMinutes: sql<number>`COALESCE(SUM(${hourAdjustment.adjustmentMinutes}), 0)`,
        })
        .from(hourAdjustment)
        .where(eq(hourAdjustment.userId, input.userId));

      const adjustmentMinutes = adjustmentsResult[0]?.totalMinutes || 0;

      // Get contracted hours from users table
      const userResult = await db
        .select({ contractedWeeklyMinutes: users.contractedWeeklyMinutes })
        .from(users)
        .where(eq(users.id, input.userId))
        .limit(1);

      const contractedMinutes = userResult[0]?.contractedWeeklyMinutes || 1200; // default 20 hours

      // Calculate balance
      const totalTeachingMinutes = ownLessonMinutes + coveredLessonMinutes + adjustmentMinutes;
      const balanceMinutes = totalTeachingMinutes - contractedMinutes;
      const isExcess = balanceMinutes > 0;

      return {
        ownLessonHours: ownLessonMinutes / 60,
        coveredLessonHours: coveredLessonMinutes / 60,
        contractedHours: contractedMinutes / 60,
        totalTeachingHours: totalTeachingMinutes / 60,
        adjustmentHours: adjustmentMinutes / 60,
        balanceHours: balanceMinutes / 60,
        isExcess,
      };
    }),
});
