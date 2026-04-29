/**
 * academicCalendar router — director-only procedures for managing academic year calendars.
 * Handles: calendars, teachers, sessions (subject/day/time), and semester breaks.
 */
import { router, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getDb } from "../db";
import {
  academicCalendars,
  acTeachers,
  acSessions,
  acBreaks,
} from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";

/** Utility: assert user is director or admin */
function assertDirector(role: string) {
  if (role !== "admin" && role !== "director") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Director access required." });
  }
}

/** Parse "HH:MM" into total minutes since midnight */
function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

/** Detect clashes: two sessions on same day with overlapping time ranges */
function detectClashes(sessions: { id: number; teacherId: number; teacherName: string; subject: string; dayOfWeek: number; startTime: string; endTime: string }[]) {
  const clashes: { sessionA: number; sessionB: number; teacherA: string; teacherB: string; day: number; time: string }[] = [];
  for (let i = 0; i < sessions.length; i++) {
    for (let j = i + 1; j < sessions.length; j++) {
      const a = sessions[i];
      const b = sessions[j];
      if (a.dayOfWeek !== b.dayOfWeek) continue;
      const aStart = timeToMinutes(a.startTime);
      const aEnd = timeToMinutes(a.endTime);
      const bStart = timeToMinutes(b.startTime);
      const bEnd = timeToMinutes(b.endTime);
      // Overlap if one starts before the other ends
      if (aStart < bEnd && bStart < aEnd) {
        clashes.push({
          sessionA: a.id,
          sessionB: b.id,
          teacherA: a.teacherName,
          teacherB: b.teacherName,
          day: a.dayOfWeek,
          time: `${a.startTime}–${a.endTime}`,
        });
      }
    }
  }
  return clashes;
}

export const academicCalendarRouter = router({
  // ── Calendars ──────────────────────────────────────────────────────────────

  /** List all calendars for the current director */
  listCalendars: protectedProcedure.query(async ({ ctx }) => {
    assertDirector(ctx.user.role);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    return db.select().from(academicCalendars).where(eq(academicCalendars.userId, ctx.user.id));
  }),

  /** Create a new academic calendar */
  createCalendar: protectedProcedure
    .input(z.object({
      academicYear: z.string().min(1).max(16),
      semesterCount: z.number().int().min(1).max(3).default(2),
      schoolStartTime: z.string().regex(/^\d{2}:\d{2}$/).default("08:30"),
      schoolEndTime: z.string().regex(/^\d{2}:\d{2}$/).default("15:00"),
      morningBreakStart: z.string().regex(/^\d{2}:\d{2}$/).optional(),
      morningBreakEnd: z.string().regex(/^\d{2}:\d{2}$/).optional(),
      lunchBreakStart: z.string().regex(/^\d{2}:\d{2}$/).optional(),
      lunchBreakEnd: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      assertDirector(ctx.user.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [result] = await db.insert(academicCalendars).values({
        userId: ctx.user.id,
        academicYear: input.academicYear,
        semesterCount: input.semesterCount,
        schoolStartTime: input.schoolStartTime,
        schoolEndTime: input.schoolEndTime,
        morningBreakStart: input.morningBreakStart ?? null,
        morningBreakEnd: input.morningBreakEnd ?? null,
        lunchBreakStart: input.lunchBreakStart ?? null,
        lunchBreakEnd: input.lunchBreakEnd ?? null,
      });
      return { id: (result as any).insertId as number };
    }),

  /** Update calendar settings */
  updateCalendar: protectedProcedure
    .input(z.object({
      id: z.number().int(),
      academicYear: z.string().min(1).max(16).optional(),
      semesterCount: z.number().int().min(1).max(3).optional(),
      schoolStartTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
      schoolEndTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
      morningBreakStart: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
      morningBreakEnd: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
      lunchBreakStart: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
      lunchBreakEnd: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      assertDirector(ctx.user.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, ...fields } = input;
      await db.update(academicCalendars)
        .set({ ...fields, updatedAt: new Date() })
        .where(and(eq(academicCalendars.id, id), eq(academicCalendars.userId, ctx.user.id)));
      return { success: true };
    }),

  /** Delete a calendar and all its data */
  deleteCalendar: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      assertDirector(ctx.user.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      // Delete in dependency order
      const teachers = await db.select({ id: acTeachers.id }).from(acTeachers).where(eq(acTeachers.calendarId, input.id));
      for (const t of teachers) {
        await db.delete(acSessions).where(eq(acSessions.teacherId, t.id));
      }
      await db.delete(acTeachers).where(eq(acTeachers.calendarId, input.id));
      await db.delete(acBreaks).where(eq(acBreaks.calendarId, input.id));
      await db.delete(academicCalendars).where(and(eq(academicCalendars.id, input.id), eq(academicCalendars.userId, ctx.user.id)));
      return { success: true };
    }),

  /** Get full calendar data (calendar + teachers + sessions + breaks + clash analysis) */
  getCalendar: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .query(async ({ ctx, input }) => {
      assertDirector(ctx.user.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [cal] = await db.select().from(academicCalendars)
        .where(and(eq(academicCalendars.id, input.id), eq(academicCalendars.userId, ctx.user.id)));
      if (!cal) throw new TRPCError({ code: "NOT_FOUND" });
      const teachers = await db.select().from(acTeachers).where(eq(acTeachers.calendarId, input.id));
      const sessions = await db.select().from(acSessions).where(eq(acSessions.calendarId, input.id));
      const breaks = await db.select().from(acBreaks).where(eq(acBreaks.calendarId, input.id));

      // Compute live weekly hours per teacher (sum of session durations in minutes → hours)
      const teacherHours = teachers.map(t => {
        const tSessions = sessions.filter(s => s.teacherId === t.id);
        const weeklyMinutes = tSessions.reduce((sum, s) => {
          return sum + (timeToMinutes(s.endTime) - timeToMinutes(s.startTime));
        }, 0);
        return { teacherId: t.id, weeklyMinutes, weeklyHours: +(weeklyMinutes / 60).toFixed(2) };
      });

      // Clash detection — enrich sessions with teacher names
      const enriched = sessions.map(s => ({
        ...s,
        teacherName: teachers.find(t => t.id === s.teacherId)?.name ?? "Unknown",
      }));
      const clashes = detectClashes(enriched);

      return { calendar: cal, teachers, sessions, breaks, teacherHours, clashes };
    }),

  // ── Teachers ───────────────────────────────────────────────────────────────

  addTeacher: protectedProcedure
    .input(z.object({
      calendarId: z.number().int(),
      name: z.string().min(1).max(255),
      email: z.string().email().max(320),
      weeklyHours: z.number().int().min(1).max(60).default(20),
    }))
    .mutation(async ({ ctx, input }) => {
      assertDirector(ctx.user.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [result] = await db.insert(acTeachers).values({
        calendarId: input.calendarId,
        name: input.name,
        email: input.email,
        weeklyHours: input.weeklyHours,
      });
      return { id: (result as any).insertId as number };
    }),

  updateTeacher: protectedProcedure
    .input(z.object({
      id: z.number().int(),
      name: z.string().min(1).max(255).optional(),
      email: z.string().email().max(320).optional(),
      weeklyHours: z.number().int().min(1).max(60).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      assertDirector(ctx.user.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, ...fields } = input;
      await db.update(acTeachers).set(fields).where(eq(acTeachers.id, id));
      return { success: true };
    }),

  deleteTeacher: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      assertDirector(ctx.user.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(acSessions).where(eq(acSessions.teacherId, input.id));
      await db.delete(acTeachers).where(eq(acTeachers.id, input.id));
      return { success: true };
    }),

  // ── Sessions ───────────────────────────────────────────────────────────────

  addSession: protectedProcedure
    .input(z.object({
      calendarId: z.number().int(),
      teacherId: z.number().int(),
      subject: z.string().min(1).max(255),
      dayOfWeek: z.number().int().min(1).max(5),
      startTime: z.string().regex(/^\d{2}:\d{2}$/),
      endTime: z.string().regex(/^\d{2}:\d{2}$/),
    }))
    .mutation(async ({ ctx, input }) => {
      assertDirector(ctx.user.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      if (timeToMinutes(input.endTime) <= timeToMinutes(input.startTime)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "End time must be after start time." });
      }
      const [result] = await db.insert(acSessions).values(input);
      return { id: (result as any).insertId as number };
    }),

  updateSession: protectedProcedure
    .input(z.object({
      id: z.number().int(),
      subject: z.string().min(1).max(255).optional(),
      dayOfWeek: z.number().int().min(1).max(5).optional(),
      startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
      endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      assertDirector(ctx.user.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, ...fields } = input;
      await db.update(acSessions).set(fields).where(eq(acSessions.id, id));
      return { success: true };
    }),

  deleteSession: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      assertDirector(ctx.user.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(acSessions).where(eq(acSessions.id, input.id));
      return { success: true };
    }),

  // ── Breaks ─────────────────────────────────────────────────────────────────

  addBreak: protectedProcedure
    .input(z.object({
      calendarId: z.number().int(),
      semester: z.number().int().min(1).max(3),
      label: z.string().min(1).max(255),
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }))
    .mutation(async ({ ctx, input }) => {
      assertDirector(ctx.user.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [result] = await db.insert(acBreaks).values({
        calendarId: input.calendarId,
        semester: input.semester,
        label: input.label,
        startDate: new Date(input.startDate),
        endDate: new Date(input.endDate),
      });
      return { id: (result as any).insertId as number };
    }),

  updateBreak: protectedProcedure
    .input(z.object({
      id: z.number().int(),
      semester: z.number().int().min(1).max(3).optional(),
      label: z.string().min(1).max(255).optional(),
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      assertDirector(ctx.user.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, startDate, endDate, ...rest } = input;
      type BreakUpdate = { semester?: number; label?: string; startDate?: Date; endDate?: Date };
      const fields: BreakUpdate = { ...rest };
      if (startDate) fields.startDate = new Date(startDate);
      if (endDate) fields.endDate = new Date(endDate);
      await db.update(acBreaks).set(fields).where(eq(acBreaks.id, id));
      return { success: true };
    }),

  deleteBreak: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      assertDirector(ctx.user.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(acBreaks).where(eq(acBreaks.id, input.id));
      return { success: true };
    }),
});
