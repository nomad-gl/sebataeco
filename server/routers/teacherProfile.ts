/**
 * teacherProfile router
 * Handles teacher subjects/levels assignment and schedule management.
 * Director/HoS can assign subjects and schedule slots; teachers can view their own profile.
 */
import { z } from "zod";
import { and, eq, gte, lte } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import type { InferSelectModel } from "drizzle-orm";
import {
  teacherSubjects,
  teacherSchedule,
  schoolCalendarEvents,
  users,
} from "../../drizzle/schema";

// ─── helpers ──────────────────────────────────────────────────────────────────

function isDirectorOrHos(role: string, position: string) {
  return (
    role === "director" ||
    role === "head_of_study" ||
    position === "director" ||
    position === "head_of_study"
  );
}

/** Parse HH:MM → minutes since midnight */
function toMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

/** Minutes → "Xh Ym" label */
function fmtHours(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// ─── router ───────────────────────────────────────────────────────────────────

export const teacherProfileRouter = router({
  // ── Subjects ────────────────────────────────────────────────────────────────

  /** List subjects for a teacher (director/HoS or self) */
  getSubjects: protectedProcedure
    .input(z.object({ userId: z.number() }))
    .query(async ({ ctx, input }) => {
      const isSelf = ctx.user.id === input.userId;
      const isAdmin = isDirectorOrHos(ctx.user.role, ctx.user.position ?? "");
      if (!isSelf && !isAdmin) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      return db
        .select()
        .from(teacherSubjects)
        .where(eq(teacherSubjects.userId, input.userId));
    }),

  /** Add a subject/level for a teacher (director/HoS only) */
  addSubject: protectedProcedure
    .input(
      z.object({
        userId: z.number(),
        subject: z.string().min(1).max(128),
        level: z.string().min(1).max(128),
        notes: z.string().max(512).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!isDirectorOrHos(ctx.user.role, ctx.user.position ?? "")) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const tenantId = ctx.user.tenantId;
      if (!tenantId) throw new TRPCError({ code: "BAD_REQUEST", message: "No tenant" });
      const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      await db.insert(teacherSubjects).values({
        userId: input.userId,
        subject: input.subject,
        level: input.level,
        notes: input.notes ?? null,
        tenantId,
      });
      return { success: true };
    }),

  /** Update a subject row (director/HoS only) */
  updateSubject: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        subject: z.string().min(1).max(128).optional(),
        level: z.string().min(1).max(128).optional(),
        notes: z.string().max(512).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!isDirectorOrHos(ctx.user.role, ctx.user.position ?? "")) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const { id, ...fields } = input;
      const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      await db
        .update(teacherSubjects)
        .set(fields)
        .where(eq(teacherSubjects.id, id));
      return { success: true };
    }),

  /** Delete a subject row (director/HoS only) */
  deleteSubject: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (!isDirectorOrHos(ctx.user.role, ctx.user.position ?? "")) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      await db
        .delete(teacherSubjects)
        .where(eq(teacherSubjects.id, input.id));
      return { success: true };
    }),

  // ── Schedule ─────────────────────────────────────────────────────────────────

  /** Get schedule for a teacher (director/HoS or self) */
  getSchedule: protectedProcedure
    .input(
      z.object({
        userId: z.number(),
        academicYear: z.string().optional(),
        semester: z.enum(["1", "2", "full_year"]).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const isSelf = ctx.user.id === input.userId;
      const isAdmin = isDirectorOrHos(ctx.user.role, ctx.user.position ?? "");
      if (!isSelf && !isAdmin) throw new TRPCError({ code: "FORBIDDEN" });

      const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const conditions = [eq(teacherSchedule.userId, input.userId)];
      if (input.academicYear) {
        conditions.push(eq(teacherSchedule.academicYear, input.academicYear));
      }
      if (input.semester) {
        conditions.push(eq(teacherSchedule.semester, input.semester));
      }
      return db
        .select()
        .from(teacherSchedule)
        .where(and(...conditions));
    }),

  /** Add a schedule slot (director/HoS only) */
  addScheduleSlot: protectedProcedure
    .input(
      z.object({
        userId: z.number(),
        semester: z.enum(["1", "2", "full_year"]),
        academicYear: z.string().min(4).max(9),
        dayOfWeek: z.enum(["monday", "tuesday", "wednesday", "thursday", "friday"]),
        lessonSlot: z.string().min(1).max(64),
        startTime: z.string().regex(/^\d{2}:\d{2}$/),
        endTime: z.string().regex(/^\d{2}:\d{2}$/),
        subject: z.string().min(1).max(128),
        groupName: z.string().max(128).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!isDirectorOrHos(ctx.user.role, ctx.user.position ?? "")) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const tenantId = ctx.user.tenantId;
      if (!tenantId) throw new TRPCError({ code: "BAD_REQUEST", message: "No tenant" });
      const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      // ── Conflict detection ──────────────────────────────────────────────────
      // Fetch all existing slots for this teacher on the same day/semester/year
      const existingSlots = await db
        .select()
        .from(teacherSchedule)
        .where(
          and(
            eq(teacherSchedule.userId, input.userId),
            eq(teacherSchedule.dayOfWeek, input.dayOfWeek),
            eq(teacherSchedule.semester, input.semester),
            eq(teacherSchedule.academicYear, input.academicYear)
          )
        );

      const newStart = toMinutes(input.startTime);
      const newEnd = toMinutes(input.endTime);
      if (newEnd <= newStart) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "tp_conflict_end_before_start",
        });
      }

      const conflict = existingSlots.find((slot) => {
        const s = toMinutes(slot.startTime);
        const e = toMinutes(slot.endTime);
        // Overlapping if new interval intersects existing interval
        return newStart < e && newEnd > s;
      });

      if (conflict) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `tp_conflict_overlap|${conflict.subject}|${conflict.startTime}-${conflict.endTime}`,
        });
      }
      // ────────────────────────────────────────────────────────────────────────

      await db.insert(teacherSchedule).values({
        userId: input.userId,
        semester: input.semester,
        academicYear: input.academicYear,
        dayOfWeek: input.dayOfWeek,
        lessonSlot: input.lessonSlot,
        startTime: input.startTime,
        endTime: input.endTime,
        subject: input.subject,
        groupName: input.groupName ?? null,
        tenantId,
      });
      return { success: true };
    }),

  /** Update a schedule slot (director/HoS only) */
  updateScheduleSlot: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        semester: z.enum(["1", "2", "full_year"]).optional(),
        academicYear: z.string().optional(),
        dayOfWeek: z.enum(["monday", "tuesday", "wednesday", "thursday", "friday"]).optional(),
        lessonSlot: z.string().max(64).optional(),
        startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
        endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
        subject: z.string().max(128).optional(),
        groupName: z.string().max(128).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!isDirectorOrHos(ctx.user.role, ctx.user.position ?? "")) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const { id, ...fields } = input;
      const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      await db
        .update(teacherSchedule)
        .set(fields)
        .where(eq(teacherSchedule.id, id));
      return { success: true };
    }),

  /** Delete a schedule slot (director/HoS only) */
  deleteScheduleSlot: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (!isDirectorOrHos(ctx.user.role, ctx.user.position ?? "")) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      await db
        .delete(teacherSchedule)
        .where(eq(teacherSchedule.id, input.id));
      return { success: true };
    }),

  // ── Teaching Hours Analytics ─────────────────────────────────────────────────

  /**
   * getTeachingHoursSummary
   * Returns weekly, per-semester, and full-year teaching hour totals for a teacher.
   * Also derives contracted school days from the calendar and flags over/under hours.
   *
   * Contracted hours = (school days in period × daily contracted hours).
   * We approximate contracted hours as: number of teaching lesson slots × slot duration.
   * Over/under is: scheduled hours vs calendar-derived teaching days × average daily hours.
   */
  getTeachingHoursSummary: protectedProcedure
    .input(
      z.object({
        userId: z.number(),
        academicYear: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const isSelf = ctx.user.id === input.userId;
      const isAdmin = isDirectorOrHos(ctx.user.role, ctx.user.position ?? "");
      if (!isSelf && !isAdmin) throw new TRPCError({ code: "FORBIDDEN" });

      const tenantId = ctx.user.tenantId;
      const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      // Fetch all schedule slots for this teacher + academic year
      const slots = await db
        .select()
        .from(teacherSchedule)
        .where(
          and(
            eq(teacherSchedule.userId, input.userId),
            eq(teacherSchedule.academicYear, input.academicYear)
          )
        );

      // Group by semester
      const semesterMap: Record<string, (typeof slots)> = {};
      for (const slot of slots) {
        if (!semesterMap[slot.semester]) semesterMap[slot.semester] = [];
        semesterMap[slot.semester].push(slot);
      }

      // Weekly hours per semester = sum of slot durations for unique (day, slot) pairs
      // (assumes the schedule repeats every week)
      const semesterSummary: Array<{
        semester: string;
        weeklyMinutes: number;
        weeklyHours: string;
        slots: number;
      }> = [];

      let totalWeeklyMinutes = 0;

      for (const [sem, semSlots] of Object.entries(semesterMap)) {
        const weeklyMins = semSlots.reduce((acc: number, s) => {
          return acc + Math.max(0, toMinutes(s.endTime) - toMinutes(s.startTime));
        }, 0);
        totalWeeklyMinutes = Math.max(totalWeeklyMinutes, weeklyMins);
        semesterSummary.push({
          semester: sem,
          weeklyMinutes: weeklyMins,
          weeklyHours: fmtHours(weeklyMins),
          slots: semSlots.length,
        });
      }

      // Fetch school calendar events to count teaching days in the academic year
      // Teaching days = all non-holiday weekdays in the academic year
      // We use lesson + ai_generated events as a proxy for school days if available,
      // otherwise fall back to counting weekdays between term start/end.
      let calendarTeachingDays = 0;
      let calendarTeachingMinutes = 0;

      if (tenantId) {
        const calEvents = await db
          .select()
          .from(schoolCalendarEvents)
          .where(
            and(
              eq(schoolCalendarEvents.tenantId, tenantId),
              eq(schoolCalendarEvents.academicYear, input.academicYear)
            )
          );

        // Count non-holiday weekday events as teaching days
        const holidayDates = new Set(
          calEvents
            .filter((e) => e.eventType === "holiday")
            .map((e) => new Date(e.eventDate as unknown as string).toISOString().slice(0, 10))
        );

        // Derive teaching days from calendar start/end if we have lesson events
        const lessonEvents = calEvents.filter(
          (e) => e.eventType === "lesson" || e.eventType === "ai_generated"
        );

        if (lessonEvents.length > 0) {
          calendarTeachingDays = lessonEvents.length;
          // Estimate minutes from lesson events that have start/end times
          calendarTeachingMinutes = lessonEvents.reduce((acc: number, e) => {
            if (e.startTime && e.endTime) {
              return acc + Math.max(0, toMinutes(e.endTime) - toMinutes(e.startTime));
            }
            return acc + 60; // default 1h per lesson
          }, 0);
        } else {
          // Fallback: count weekdays in academic year not marked as holidays
          // Academic year: assume Sep 1 to Jun 30 of next year
          const [startYr] = input.academicYear.split("-");
          const yearStart = new Date(`${startYr}-09-01`);
          const yearEnd = new Date(`${parseInt(startYr) + 1}-06-30`);
          const cur = new Date(yearStart);
          while (cur <= yearEnd) {
            const dow = cur.getDay();
            if (dow >= 1 && dow <= 5) {
              const ds = cur.toISOString().slice(0, 10);
              if (!holidayDates.has(ds)) calendarTeachingDays++;
            }
            cur.setDate(cur.getDate() + 1);
          }
          // Weekly minutes from schedule × number of weeks
          const weeks = Math.round(calendarTeachingDays / 5);
          calendarTeachingMinutes = totalWeeklyMinutes * weeks;
        }
      }

      // Scheduled total minutes for the full year
        const scheduledTotalMinutes = slots.reduce((acc: number, s) => {
        // Each slot repeats every week — estimate weeks per semester
        // Semester 1 ≈ 18 weeks, Semester 2 ≈ 18 weeks, full_year ≈ 36 weeks
        const weeksMap: Record<string, number> = { "1": 18, "2": 18, full_year: 36 };
        const weeks = weeksMap[s.semester] ?? 18;
        return acc + Math.max(0, toMinutes(s.endTime) - toMinutes(s.startTime)) * weeks;
      }, 0);

      const overUnderMinutes = scheduledTotalMinutes - calendarTeachingMinutes;

      return {
        academicYear: input.academicYear,
        semesterSummary,
        weeklyHours: fmtHours(totalWeeklyMinutes),
        weeklyMinutes: totalWeeklyMinutes,
        scheduledTotalHours: fmtHours(scheduledTotalMinutes),
        scheduledTotalMinutes,
        calendarTeachingDays,
        calendarTeachingHours: fmtHours(calendarTeachingMinutes),
        calendarTeachingMinutes,
        overUnderMinutes,
        overUnderHours: fmtHours(Math.abs(overUnderMinutes)),
        status: overUnderMinutes > 0 ? "over" : overUnderMinutes < 0 ? "under" : "balanced",
      };
    }),

  /** List all teachers in the tenant with their subject count and weekly hours */
  getTeacherRoster: protectedProcedure
    .input(z.object({ academicYear: z.string() }))
    .query(async ({ ctx, input }) => {
      if (!isDirectorOrHos(ctx.user.role, ctx.user.position ?? "")) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const tenantId = ctx.user.tenantId;
      if (!tenantId) throw new TRPCError({ code: "BAD_REQUEST", message: "No tenant" });
      const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      // Get all teachers in this tenant
      const teachers = await db
        .select({
          id: users.id,
          displayName: users.displayName,
          name: users.name,
          email: users.email,
          role: users.role,
          position: users.position,
          contractedWeeklyMinutes: users.contractedWeeklyMinutes,
          isPermanent: users.isPermanent,
        })
        .from(users)
        .where(
          and(
            eq(users.tenantId, tenantId),
            eq(users.position, "teacher")
          )
        );

      // For each teacher, get subject count and weekly minutes
      const results = await Promise.all(
        teachers.map(async (t) => {
          const subjects = await db
            .select()
            .from(teacherSubjects)
            .where(eq(teacherSubjects.userId, t.id));

          const slots = await db
            .select()
            .from(teacherSchedule)
            .where(
              and(
                eq(teacherSchedule.userId, t.id),
                eq(teacherSchedule.academicYear, input.academicYear)
              )
            );

          const weeklyMinutes = slots.reduce((acc: number, s) => {
            return acc + Math.max(0, toMinutes(s.endTime) - toMinutes(s.startTime));
          }, 0);

          return {
            ...t,
            subjectCount: subjects.length,
            subjects: subjects.map((s) => `${s.subject} (${s.level})`),
            weeklyMinutes,
            weeklyHours: fmtHours(weeklyMinutes),
            scheduleSlots: slots.length,
            contractedWeeklyMinutes: t.contractedWeeklyMinutes ?? null,
            isPermanent: t.isPermanent ?? true,
          };
        })
      );

      return results;
    }),

  setTeacherPermanent: protectedProcedure
    .input(z.object({ userId: z.number().int().positive(), isPermanent: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      if (!isDirectorOrHos(ctx.user.role, ctx.user.position ?? "")) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const tenantId = ctx.user.tenantId;
      if (!tenantId) throw new TRPCError({ code: "BAD_REQUEST", message: "No tenant" });
      const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      await db
        .update(users)
        .set({ isPermanent: input.isPermanent })
        .where(and(eq(users.id, input.userId), eq(users.tenantId, tenantId)));

      return { success: true };
    }),
});
