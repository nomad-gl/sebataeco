/**
 * teacherProfile router
 * Handles teacher subjects/levels assignment and schedule management.
 * Director/HoS can assign subjects and schedule slots; teachers can view their own profile.
 */
import { z } from "zod";
import { and, eq, gte, lte } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../_core/trpc";
import { encryptField, decryptField } from "../_core/fieldEncryption";
import { getDb } from "../db";
import type { InferSelectModel } from "drizzle-orm";
import {
  teacherSubjects,
  teacherSchedule,
  schoolCalendarEvents,
  users,
  teacherProfiles,
  teacherHolidayRecords,
  acTeachers,
  acSessions,
  acSemesterDates,
  academicCalendars,
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
          cutcgMemberNumber: users.cutcgMemberNumber,
          schoolName: users.schoolName,
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
            schoolName: t.schoolName || "Unassigned",
          };
        })
      );

      // Sort by schoolName, then by name
      return results.sort((a, b) => {
        const schoolCmp = (a.schoolName || "").localeCompare(b.schoolName || "");
        return schoolCmp !== 0 ? schoolCmp : a.name.localeCompare(b.name);
      });
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

  setContractedHours: protectedProcedure
    .input(z.object({ userId: z.number().int().positive(), contractedWeeklyMinutes: z.number().int().min(0).nullable() }))
    .mutation(async ({ ctx, input }) => {
      if (!isDirectorOrHos(ctx.user.role, ctx.user.position ?? "")) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const tenantId = ctx.user.tenantId;
      if (!tenantId) throw new TRPCError({ code: "BAD_REQUEST", message: "No tenant" });
      const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      await db
        .update(users)
        .set({ contractedWeeklyMinutes: input.contractedWeeklyMinutes })
        .where(and(eq(users.id, input.userId), eq(users.tenantId, tenantId)));

      return { success: true };
    }),

  copySchedule: protectedProcedure
    .input(z.object({
      fromUserId: z.number().int().positive(),
      toUserId: z.number().int().positive(),
      academicYear: z.string(),
      overwrite: z.boolean().optional().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!isDirectorOrHos(ctx.user.role, ctx.user.position ?? "")) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const tenantId = ctx.user.tenantId;
      if (!tenantId) throw new TRPCError({ code: "BAD_REQUEST", message: "No tenant" });
      const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const [fromTeacher, toTeacher] = await Promise.all([
        db.select({ id: users.id }).from(users).where(and(eq(users.id, input.fromUserId), eq(users.tenantId, tenantId))).limit(1),
        db.select({ id: users.id }).from(users).where(and(eq(users.id, input.toUserId), eq(users.tenantId, tenantId))).limit(1),
      ]);
      if (!fromTeacher.length || !toTeacher.length) throw new TRPCError({ code: "NOT_FOUND", message: "Teacher not found" });

      const sourceSlots = await db
        .select()
        .from(teacherSchedule)
        .where(and(eq(teacherSchedule.userId, input.fromUserId), eq(teacherSchedule.academicYear, input.academicYear)));

      if (!sourceSlots.length) return { copied: 0 };

      if (input.overwrite) {
        await db.delete(teacherSchedule).where(
          and(eq(teacherSchedule.userId, input.toUserId), eq(teacherSchedule.academicYear, input.academicYear))
        );
      }

      const newSlots = sourceSlots.map(({ id: _id, userId: _uid, createdAt: _ca, ...rest }) => ({
        ...rest,
        userId: input.toUserId,
      }));
      await db.insert(teacherSchedule).values(newSlots);

      return { copied: newSlots.length };
    }),

  // ── Teacher Profiles (standalone, by name) ──────────────────────────────────

  /** List all teacher profiles owned by the current user */
  listProfiles: protectedProcedure
    .query(async ({ ctx }) => {
      const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const ownerId = String(ctx.user.id);
      
      // Get teacher profiles from teacherProfiles table
      const profiles = await db
        .select()
        .from(teacherProfiles)
        .where(eq(teacherProfiles.ownerId, ownerId))
        .orderBy(teacherProfiles.name);
      
      // Get teachers from acTeachers table who have subjects assigned
      // Note: acTeachers doesn't have ownerId; it's linked via calendar
      const rawAcTeachers = await db
        .select({
          id: acTeachers.id,
          name: acTeachers.name,
          email: acTeachers.email,
          calendarId: acTeachers.calendarId,
        })
        .from(acTeachers);
      // Filter to only those from calendars owned by this user
      const userCalendars = await db
        .select({ id: academicCalendars.id })
        .from(academicCalendars)
        .where(eq(academicCalendars.userId, parseInt(ownerId)));
      const userCalendarIds = new Set(userCalendars.map(c => c.id));
      const filteredAcTeachers = rawAcTeachers.filter(t => userCalendarIds.has(t.calendarId));
      // Map to match profile structure
      const acTeachersFormatted = filteredAcTeachers.map(t => ({
        id: 0,
        ownerId: ownerId as any,
        name: t.name,
        email: t.email || null,
        contractedHoursPerWeek: "0",
        prepHoursPerWeek: "0",
        annualHolidayDays: "0",
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));
      
      // Merge both lists, avoiding duplicates (by name)
      const profileNames = new Set(profiles.map(p => p.name));
      const merged = [
        ...profiles,
        ...acTeachersFormatted.filter(t => !profileNames.has(t.name))
      ];
      
      return merged.sort((a, b) => a.name.localeCompare(b.name));
    }),

  /** Upsert a teacher profile (create or update by name) */
  upsertProfile: protectedProcedure
    .input(z.object({
      id: z.number().optional(),
      name: z.string().min(1).max(255),
      email: z.string().email().optional().or(z.literal("")).optional(),
      contractedHoursPerWeek: z.number().min(0).max(80).default(20),
      prepHoursPerWeek: z.number().min(0).max(40).default(5),
      annualHolidayDays: z.number().min(0).max(60).default(25),
      notes: z.string().max(2000).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const ownerId = String(ctx.user.id);
      if (input.id) {
        // Verify ownership
        const existing = await db.select({ id: teacherProfiles.id }).from(teacherProfiles)
          .where(and(eq(teacherProfiles.id, input.id), eq(teacherProfiles.ownerId, ownerId))).limit(1);
        if (!existing.length) throw new TRPCError({ code: "NOT_FOUND" });
        await db.update(teacherProfiles).set({
          name: input.name,
          email: input.email || null,
          contractedHoursPerWeek: String(input.contractedHoursPerWeek),
          prepHoursPerWeek: String(input.prepHoursPerWeek),
          annualHolidayDays: String(input.annualHolidayDays),
          notes: input.notes || null,
          updatedAt: new Date(),
        }).where(eq(teacherProfiles.id, input.id));
        return { id: input.id };
      } else {
        const result = await db.insert(teacherProfiles).values({
          ownerId,
          name: input.name,
          email: input.email || null,
          contractedHoursPerWeek: String(input.contractedHoursPerWeek),
          prepHoursPerWeek: String(input.prepHoursPerWeek),
          annualHolidayDays: String(input.annualHolidayDays),
          notes: input.notes || null,
        });
        return { id: Number((result as any).insertId) };
      }
    }),

  /** Delete a teacher profile */
  deleteProfile: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const ownerId = String(ctx.user.id);
      const existing = await db.select({ id: teacherProfiles.id }).from(teacherProfiles)
        .where(and(eq(teacherProfiles.id, input.id), eq(teacherProfiles.ownerId, ownerId))).limit(1);
      if (!existing.length) throw new TRPCError({ code: "NOT_FOUND" });
      await db.delete(teacherHolidayRecords).where(eq(teacherHolidayRecords.teacherProfileId, input.id));
      await db.delete(teacherProfiles).where(eq(teacherProfiles.id, input.id));
      return { success: true };
    }),

  // ── Holiday Records ──────────────────────────────────────────────────────────

  /** List holiday records for a teacher profile */
  listHolidayRecords: protectedProcedure
    .input(z.object({ teacherProfileId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const ownerId = String(ctx.user.id);
      // Verify ownership
      const profile = await db.select({ id: teacherProfiles.id }).from(teacherProfiles)
        .where(and(eq(teacherProfiles.id, input.teacherProfileId), eq(teacherProfiles.ownerId, ownerId))).limit(1);
      if (!profile.length) throw new TRPCError({ code: "NOT_FOUND" });
      return db
        .select()
        .from(teacherHolidayRecords)
        .where(eq(teacherHolidayRecords.teacherProfileId, input.teacherProfileId))
        .orderBy(teacherHolidayRecords.date);
    }),

  /** Add a holiday record */
  addHolidayRecord: protectedProcedure
    .input(z.object({
      teacherProfileId: z.number(),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      type: z.enum(["taken", "owed"]),
      hours: z.number().min(0.5).max(24).default(7.5),
      notes: z.string().max(500).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const ownerId = String(ctx.user.id);
      const profile = await db.select({ id: teacherProfiles.id }).from(teacherProfiles)
        .where(and(eq(teacherProfiles.id, input.teacherProfileId), eq(teacherProfiles.ownerId, ownerId))).limit(1);
      if (!profile.length) throw new TRPCError({ code: "NOT_FOUND" });
      const result = await db.insert(teacherHolidayRecords).values({
        teacherProfileId: input.teacherProfileId,
        date: new Date(input.date),
        type: input.type,
        hours: String(input.hours),
        // MED-02: Encrypt sensitive notes field at rest
        notes: encryptField(input.notes || null),
      });
      return { id: Number((result as any).insertId) };
    }),

  /** Delete a holiday record */
  deleteHolidayRecord: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      await db.delete(teacherHolidayRecords).where(eq(teacherHolidayRecords.id, input.id));
      return { success: true };
    }),

  /**
   * getProfileStats — compute teaching hours, contracted hours, prep hours,
   * holiday balance for a teacher profile, pulling sessions from ac_sessions.
   */
  getProfileStats: protectedProcedure
    .input(z.object({
      teacherProfileId: z.number(),
      calendarId: z.number().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const ownerId = String(ctx.user.id);

      // Fetch profile
      const [profile] = await db.select().from(teacherProfiles)
        .where(and(eq(teacherProfiles.id, input.teacherProfileId), eq(teacherProfiles.ownerId, ownerId))).limit(1);
      if (!profile) throw new TRPCError({ code: "NOT_FOUND" });

      const contractedHPW = parseFloat(String(profile.contractedHoursPerWeek));
      const prepHPW = parseFloat(String(profile.prepHoursPerWeek));
      const annualHolidayDays = parseFloat(String(profile.annualHolidayDays));
      const hoursPerDay = 7.5;
      const annualHolidayHours = annualHolidayDays * hoursPerDay;

      // Fetch holiday records
      const holidayRecords = await db.select().from(teacherHolidayRecords)
        .where(eq(teacherHolidayRecords.teacherProfileId, input.teacherProfileId));
      const holidayTakenHours = holidayRecords
        .filter(r => r.type === "taken")
        .reduce((acc, r) => acc + parseFloat(String(r.hours)), 0);
      const holidayOwedHours = holidayRecords
        .filter(r => r.type === "owed")
        .reduce((acc, r) => acc + parseFloat(String(r.hours)), 0);
      const holidayBalance = annualHolidayHours + holidayOwedHours - holidayTakenHours;

      // Find ac_teachers matching this name
      const matchingTeachers = await db.select().from(acTeachers)
        .where(eq(acTeachers.name, profile.name));

      // Filter by calendarId if provided
      const relevantTeachers = input.calendarId
        ? matchingTeachers.filter(t => t.calendarId === input.calendarId)
        : matchingTeachers;

      // Fetch all sessions for these teachers
      const teacherIds = relevantTeachers.map(t => t.id);
      let allSessions: typeof acSessions.$inferSelect[] = [];
      if (teacherIds.length > 0) {
        for (const tid of teacherIds) {
          const sessions = await db.select().from(acSessions).where(eq(acSessions.teacherId, tid));
          allSessions = allSessions.concat(sessions);
        }
      }

      // Compute session duration in hours
      function sessionHours(s: typeof acSessions.$inferSelect): number {
        const [sh, sm] = s.startTime.split(":").map(Number);
        const [eh, em] = s.endTime.split(":").map(Number);
        return Math.max(0, (eh * 60 + em - sh * 60 - sm)) / 60;
      }

      // Weekly teaching hours (unique day+subject+time combos, recurring)
      const recurringSlots = allSessions.filter(s => !s.sessionDate);
      const weeklyTeachingHours = recurringSlots.reduce((acc, s) => acc + sessionHours(s), 0);

      // Semester totals — fetch semester dates
      const semDateRows = input.calendarId
        ? await db.select().from(acSemesterDates).where(eq(acSemesterDates.calendarId, input.calendarId))
        : [];

      // Build semester week counts
      function weeksBetween(start: Date, end: Date): number {
        const ms = end.getTime() - start.getTime();
        return Math.max(1, Math.round(ms / (7 * 86400000)));
      }

      const semesterStats = semDateRows.map(sd => {
        const semSessions = allSessions.filter(s => {
          // For recurring, include all; for dated, check if date falls in semester
          if (!s.sessionDate) return true;
          const d = new Date(s.sessionDate as unknown as string).toISOString().slice(0, 10);
          const start = new Date(sd.startDate as unknown as string).toISOString().slice(0, 10);
          const end = new Date(sd.endDate as unknown as string).toISOString().slice(0, 10);
          return d >= start && d <= end;
        });
        const recurringInSem = semSessions.filter(s => !s.sessionDate);
        const weeks = weeksBetween(
          new Date(sd.startDate as unknown as string),
          new Date(sd.endDate as unknown as string)
        );
        const semTeachingHours = recurringInSem.reduce((acc, s) => acc + sessionHours(s), 0) * weeks;
        const semContractedHours = contractedHPW * weeks;
        const semPrepHours = prepHPW * weeks;
        return {
          semesterNumber: sd.semesterNumber,
          weeks,
          teachingHours: Math.round(semTeachingHours * 10) / 10,
          contractedHours: Math.round(semContractedHours * 10) / 10,
          prepHours: Math.round(semPrepHours * 10) / 10,
        };
      });

      // Annual totals
      const totalWeeks = semesterStats.reduce((a, s) => a + s.weeks, 0) || 36;
      const annualTeachingHours = semesterStats.length > 0
        ? semesterStats.reduce((a, s) => a + s.teachingHours, 0)
        : weeklyTeachingHours * totalWeeks;
      const annualContractedHours = contractedHPW * totalWeeks;
      const annualPrepHours = prepHPW * totalWeeks;

      // Monthly teaching hours (approximate: annual / 10 teaching months)
      const monthlyTeachingHours = Math.round((annualTeachingHours / 10) * 10) / 10;
      const monthlyContractedHours = Math.round((annualContractedHours / 10) * 10) / 10;
      const monthlyPrepHours = Math.round((annualPrepHours / 10) * 10) / 10;

      // Free period sessions per week (slots with no subject assigned, or gaps in schedule)
      // We define free periods as recurring slots that are marked as "free" or "prep" in subject name
      const freePeriodSessions = recurringSlots.filter(s =>
        /free|prep|planning|break|recess/i.test(s.subject)
      );

      // Weekly schedule grid (Mon-Fri, all recurring sessions)
      const weeklyGrid: Record<number, Array<{ subject: string; startTime: string; endTime: string; classGroup: string | null; hours: number }>> = {};
      for (let d = 1; d <= 5; d++) {
        weeklyGrid[d] = recurringSlots
          .filter(s => s.dayOfWeek === d)
          .sort((a, b) => a.startTime.localeCompare(b.startTime))
          .map(s => ({
            subject: s.subject,
            startTime: s.startTime,
            endTime: s.endTime,
            classGroup: s.classGroup ?? null,
            hours: Math.round(sessionHours(s) * 10) / 10,
          }));
      }

      return {
        profile: {
          ...profile,
          contractedHoursPerWeek: contractedHPW,
          prepHoursPerWeek: prepHPW,
          annualHolidayDays,
        },
        weekly: {
          teachingHours: Math.round(weeklyTeachingHours * 10) / 10,
          contractedHours: contractedHPW,
          prepHours: prepHPW,
          totalHours: Math.round((weeklyTeachingHours + prepHPW) * 10) / 10,
        },
        monthly: {
          teachingHours: monthlyTeachingHours,
          contractedHours: monthlyContractedHours,
          prepHours: monthlyPrepHours,
        },
        annual: {
          teachingHours: Math.round(annualTeachingHours * 10) / 10,
          contractedHours: Math.round(annualContractedHours * 10) / 10,
          prepHours: Math.round(annualPrepHours * 10) / 10,
        },
        semesterStats,
        holiday: {
          entitlementDays: annualHolidayDays,
          entitlementHours: Math.round(annualHolidayHours * 10) / 10,
          takenHours: Math.round(holidayTakenHours * 10) / 10,
          owedHours: Math.round(holidayOwedHours * 10) / 10,
          balanceHours: Math.round(holidayBalance * 10) / 10,
          balanceDays: Math.round((holidayBalance / hoursPerDay) * 10) / 10,
          // MED-02: Decrypt notes field before returning to client
          records: holidayRecords.map(r => ({ ...r, notes: decryptField(r.notes) })),
        },
        weeklyGrid,
        freePeriodSessions: freePeriodSessions.map(s => ({
          dayOfWeek: s.dayOfWeek,
          subject: s.subject,
          startTime: s.startTime,
          endTime: s.endTime,
          classGroup: s.classGroup ?? null,
        })),
        linkedCalendars: relevantTeachers.map(t => t.calendarId),
      };
    }),

  /**
   * Get cover availability: all teachers' free/prep periods for a given academic calendar.
   * Returns a weekly grid (Mon-Fri) of available slots per teacher.
   */
  getCoverAvailability: protectedProcedure
    .input(z.object({ calendarId: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return { teachers: [], days: [] };

      // Get all teachers in the specified calendar (or all calendars if not specified)
      let teacherRows;
      if (input.calendarId) {
        teacherRows = await db
          .select()
          .from(acTeachers)
          .where(eq(acTeachers.calendarId, input.calendarId));
      } else {
        teacherRows = await db.select().from(acTeachers);
      }

      const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

      // For each teacher, get their sessions and compute free periods
      const teacherData = await Promise.all(
        teacherRows.map(async (teacher) => {
          const sessions = await db
            .select()
            .from(acSessions)
            .where(eq(acSessions.teacherId, teacher.id));

          // Build occupied slots per day
          const occupied: Record<number, Array<{ startTime: string; endTime: string; subject: string }>> = {};
          for (let d = 1; d <= 5; d++) occupied[d] = [];
          for (const s of sessions) {
            if (s.dayOfWeek >= 1 && s.dayOfWeek <= 5) {
              occupied[s.dayOfWeek].push({
                startTime: s.startTime,
                endTime: s.endTime,
                subject: s.subject,
              });
            }
          }

          // Free periods = sessions explicitly labelled free/prep/planning
          const freePeriods: Array<{ day: number; dayName: string; startTime: string; endTime: string; label: string }> = [];
          for (const s of sessions) {
            if (/free|prep|planning|break|recess|cover/i.test(s.subject)) {
              freePeriods.push({
                day: s.dayOfWeek,
                dayName: DAY_NAMES[s.dayOfWeek - 1] ?? `Day ${s.dayOfWeek}`,
                startTime: s.startTime,
                endTime: s.endTime,
                label: s.subject,
              });
            }
          }

          // Sort by day then start time
          freePeriods.sort((a, b) => a.day - b.day || a.startTime.localeCompare(b.startTime));

          // Weekly teaching hours
          const weeklyHours = sessions
            .filter(s => !/free|prep|planning|break|recess/i.test(s.subject))
            .reduce((sum, s) => {
              const [sh, sm] = s.startTime.split(":").map(Number);
              const [eh, em] = s.endTime.split(":").map(Number);
              return sum + Math.max(0, (eh * 60 + em - sh * 60 - sm) / 60);
            }, 0);

          return {
            id: teacher.id,
            name: teacher.name,
            email: teacher.email ?? "",
            weeklyHours: Math.round(weeklyHours * 10) / 10,
            freePeriods,
            sessionCount: sessions.filter(s => !/free|prep|planning|break|recess/i.test(s.subject)).length,
          };
        })
      );

      // Deduplicate teachers by name (keep the one with most free periods)
      const seen = new Map<string, typeof teacherData[0]>();
      for (const t of teacherData) {
        const existing = seen.get(t.name);
        if (!existing || t.freePeriods.length > existing.freePeriods.length) {
          seen.set(t.name, t);
        }
      }

      return {
        teachers: Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name)),
        days: DAY_NAMES,
      };
    }),
});
