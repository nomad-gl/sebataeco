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
  acSubjects,
  acSemesterDates,
} from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { generateAcademicCalendarPdf } from "../academicCalendarPdf";

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
      classGroup: z.string().max(100).optional(),
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
      classGroup: z.string().max(100).optional().nullable(),
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

  // ── Subjects ───────────────────────────────────────────────────────────────

  listSubjects: protectedProcedure
    .input(z.object({ calendarId: z.number().int() }))
    .query(async ({ ctx, input }) => {
      assertDirector(ctx.user.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const rows = await db.select().from(acSubjects)
        .where(eq(acSubjects.calendarId, input.calendarId))
        .orderBy(acSubjects.semester, acSubjects.name);
      return rows.map(r => ({
        ...r,
        days: (() => { try { return JSON.parse(r.days); } catch { return []; } })() as number[],
      }));
    }),

  addSubject: protectedProcedure
    .input(z.object({
      calendarId: z.number().int(),
      semester: z.number().int().min(1).max(10),
      name: z.string().min(1).max(255),
      unit: z.string().max(255).optional(),
      classroom: z.string().max(100).optional(),
      maxStudents: z.number().int().min(1).optional(),
      totalAcademicHours: z.number().int().min(1).default(60),
      days: z.array(z.number().int().min(1).max(5)).default([]),
      startTime: z.string().regex(/^\d{2}:\d{2}$/).default("09:00"),
      endTime: z.string().regex(/^\d{2}:\d{2}$/).default("10:00"),
      color: z.string().max(20).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      assertDirector(ctx.user.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      if (timeToMinutes(input.endTime) <= timeToMinutes(input.startTime)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "End time must be after start time." });
      }
      const { days, ...rest } = input;
      const [result] = await db.insert(acSubjects).values({
        ...rest,
        days: JSON.stringify(days),
      });
      return { id: (result as any).insertId as number };
    }),

  updateSubject: protectedProcedure
    .input(z.object({
      id: z.number().int(),
      semester: z.number().int().min(1).max(10).optional(),
      name: z.string().min(1).max(255).optional(),
      unit: z.string().max(255).optional(),
      classroom: z.string().max(100).optional(),
      maxStudents: z.number().int().min(1).nullable().optional(),
      totalAcademicHours: z.number().int().min(1).optional(),
      days: z.array(z.number().int().min(1).max(5)).optional(),
      startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
      endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
      color: z.string().max(20).nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      assertDirector(ctx.user.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, days, ...rest } = input;
      type SubjectUpdate = Record<string, unknown>;
      const fields: SubjectUpdate = { ...rest };
      if (days !== undefined) fields.days = JSON.stringify(days);
      await db.update(acSubjects).set(fields).where(eq(acSubjects.id, id));
      return { success: true };
    }),

  deleteSubject: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      assertDirector(ctx.user.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(acSubjects).where(eq(acSubjects.id, input.id));
      return { success: true };
    }),

  // ── Semester Dates ───────────────────────────────────────────────────────────────────────────

  /** Upsert semester dates for a calendar (one row per semester). */
  setSemesterDates: protectedProcedure
    .input(z.object({
      calendarId: z.number().int(),
      semesters: z.array(z.object({
        semesterNumber: z.number().int().min(1),
        startDate: z.string().min(1),
        endDate: z.string().min(1),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      assertDirector(ctx.user.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(acSemesterDates).where(eq(acSemesterDates.calendarId, input.calendarId));
      if (input.semesters.length > 0) {
        await db.insert(acSemesterDates).values(
          input.semesters.map(s => ({
            calendarId: input.calendarId,
            semesterNumber: s.semesterNumber,
            startDate: new Date(s.startDate),
            endDate: new Date(s.endDate),
          }))
        );
      }
      return { success: true };
    }),

  /** Duplicate a calendar to a new academic year, copying all teachers, subjects, sessions, breaks, and semester dates. */
  duplicateCalendar: protectedProcedure
    .input(z.object({
      sourceId: z.number().int(),
      newAcademicYear: z.string().min(1).max(16),
    }))
    .mutation(async ({ ctx, input }) => {
      assertDirector(ctx.user.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Verify ownership
      const [source] = await db.select().from(academicCalendars)
        .where(and(eq(academicCalendars.id, input.sourceId), eq(academicCalendars.userId, ctx.user.id)));
      if (!source) throw new TRPCError({ code: "NOT_FOUND" });

      // Create new calendar
      const [newCal] = await db.insert(academicCalendars).values({
        userId: ctx.user.id,
        academicYear: input.newAcademicYear,
        semesterCount: source.semesterCount,
        schoolStartTime: source.schoolStartTime,
        schoolEndTime: source.schoolEndTime,
        morningBreakStart: source.morningBreakStart,
        morningBreakEnd: source.morningBreakEnd,
        lunchBreakStart: source.lunchBreakStart,
        lunchBreakEnd: source.lunchBreakEnd,
      });
      const newCalId = (newCal as any).insertId as number;

      // Copy teachers (keep a map of old id → new id)
      const teachers = await db.select().from(acTeachers).where(eq(acTeachers.calendarId, input.sourceId));
      const teacherMap: Record<number, number> = {};
      for (const t of teachers) {
        const [r] = await db.insert(acTeachers).values({ calendarId: newCalId, name: t.name, email: t.email, weeklyHours: t.weeklyHours });
        teacherMap[t.id] = (r as any).insertId as number;
      }

      // Copy sessions
      const sessions = await db.select().from(acSessions).where(eq(acSessions.calendarId, input.sourceId));
      for (const s of sessions) {
        const newTeacherId = teacherMap[s.teacherId];
        if (newTeacherId) {
          await db.insert(acSessions).values({ calendarId: newCalId, teacherId: newTeacherId, subject: s.subject, dayOfWeek: s.dayOfWeek, startTime: s.startTime, endTime: s.endTime });
        }
      }

      // Copy subjects
      const subjects = await db.select().from(acSubjects).where(eq(acSubjects.calendarId, input.sourceId));
      for (const sub of subjects) {
        await db.insert(acSubjects).values({ calendarId: newCalId, semester: sub.semester, name: sub.name, unit: sub.unit, classroom: sub.classroom, maxStudents: sub.maxStudents, totalAcademicHours: sub.totalAcademicHours, days: sub.days, startTime: sub.startTime, endTime: sub.endTime, color: sub.color });
      }

      // Copy breaks
      const breaks = await db.select().from(acBreaks).where(eq(acBreaks.calendarId, input.sourceId));
      for (const b of breaks) {
        await db.insert(acBreaks).values({ calendarId: newCalId, semester: b.semester, label: b.label, startDate: b.startDate, endDate: b.endDate });
      }

      // Copy semester dates (keep same dates as template — director can adjust)
      const semDates = await db.select().from(acSemesterDates).where(eq(acSemesterDates.calendarId, input.sourceId));
      for (const sd of semDates) {
        await db.insert(acSemesterDates).values({ calendarId: newCalId, semesterNumber: sd.semesterNumber, startDate: sd.startDate, endDate: sd.endDate });
      }

      return { id: newCalId };
    }),

  /** Get semester dates for a calendar. */
  getSemesterDates: protectedProcedure
    .input(z.object({ calendarId: z.number().int() }))
    .query(async ({ ctx, input }) => {
      assertDirector(ctx.user.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const rows = await db.select().from(acSemesterDates)
        .where(eq(acSemesterDates.calendarId, input.calendarId))
        .orderBy(acSemesterDates.semesterNumber);
      return rows;
    }),

  /** Suggest a free time slot for a clashing session. */
  suggestFix: protectedProcedure
    .input(z.object({ sessionId: z.number().int(), calendarId: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      assertDirector(ctx.user.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [session] = await db.select().from(acSessions).where(eq(acSessions.id, input.sessionId));
      if (!session) throw new TRPCError({ code: "NOT_FOUND" });
      const allSessions = await db.select().from(acSessions).where(eq(acSessions.calendarId, input.calendarId));
      const duration = timeToMinutes(session.endTime) - timeToMinutes(session.startTime);
      const days = [1, 2, 3, 4, 5];
      const slots = ["08:00","08:30","09:00","09:30","10:00","10:30","11:00","11:30","12:00","12:30","13:00","13:30","14:00","14:30","15:00"];
      for (const day of days) {
        for (const slot of slots) {
          const slotStart = timeToMinutes(slot);
          const slotEnd = slotStart + duration;
          if (slotEnd > 17 * 60) continue;
          const endStr = `${String(Math.floor(slotEnd / 60)).padStart(2,'0')}:${String(slotEnd % 60).padStart(2,'0')}`;
          const clash = allSessions.some(s => {
            if (s.id === input.sessionId) return false;
            if (s.teacherId !== session.teacherId) return false;
            if (s.dayOfWeek !== day) return false;
            const sStart = timeToMinutes(s.startTime);
            const sEnd = timeToMinutes(s.endTime);
            return slotStart < sEnd && slotEnd > sStart;
          });
          if (!clash) {
            await db.update(acSessions).set({ dayOfWeek: day, startTime: slot, endTime: endStr }).where(eq(acSessions.id, input.sessionId));
            return { dayOfWeek: day, startTime: slot, endTime: endStr };
          }
        }
      }
      throw new TRPCError({ code: "CONFLICT", message: "No free slot found for this teacher." });
    }),

  /** Publish or unpublish a calendar so teachers can view it. */
  publishCalendar: protectedProcedure
    .input(z.object({ id: z.number().int(), published: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      assertDirector(ctx.user.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(academicCalendars).set({ isPublished: input.published ? 1 : 0 })
        .where(and(eq(academicCalendars.id, input.id), eq(academicCalendars.userId, ctx.user.id)));
      return { success: true };
    }),

  /** List all published calendars (any logged-in user). */
  listPublishedCalendars: protectedProcedure
    .query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const cals = await db.select().from(academicCalendars)
        .where(eq(academicCalendars.isPublished, 1));
      return cals;
    }),

  getPublishedCalendar: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [cal] = await db.select().from(academicCalendars)
        .where(and(eq(academicCalendars.id, input.id), eq(academicCalendars.isPublished, 1)));
      if (!cal) throw new TRPCError({ code: "NOT_FOUND" });
      const teachers = await db.select().from(acTeachers).where(eq(acTeachers.calendarId, input.id));
      const sessions = await db.select().from(acSessions).where(eq(acSessions.calendarId, input.id));
      return { calendar: cal, teachers, sessions };
    }),

  /** Export the academic calendar as a PDF (base64 encoded). */
  exportCalendarPdf: protectedProcedure
    .input(z.object({
      id: z.number().int(),
      schoolName: z.string().optional(),
      lang: z.string().optional(),
      teacherId: z.number().int().optional(), // if set, export only this teacher's schedule
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [cal] = await db.select().from(academicCalendars)
        .where(and(eq(academicCalendars.id, input.id), eq(academicCalendars.userId, ctx.user.id)));
      if (!cal) throw new TRPCError({ code: "NOT_FOUND" });
      const allTeachers = await db.select().from(acTeachers).where(eq(acTeachers.calendarId, input.id));
      const teachers = input.teacherId ? allTeachers.filter(t => t.id === input.teacherId) : allTeachers;
      const allSessions = await db.select().from(acSessions).where(eq(acSessions.calendarId, input.id));
      const sessions = input.teacherId ? allSessions.filter(s => s.teacherId === input.teacherId) : allSessions;
      const breaks = await db.select().from(acBreaks).where(eq(acBreaks.calendarId, input.id));
      const subjects = await db.select().from(acSubjects).where(eq(acSubjects.calendarId, input.id));
      const semDates = await db.select().from(acSemesterDates).where(eq(acSemesterDates.calendarId, input.id));
      const pdfBuffer = await generateAcademicCalendarPdf({
        calendar: {
          academicYear: cal.academicYear,
          semesterCount: cal.semesterCount,
          schoolStartTime: cal.schoolStartTime,
          schoolEndTime: cal.schoolEndTime,
          morningBreakStart: cal.morningBreakStart,
          morningBreakEnd: cal.morningBreakEnd,
          lunchBreakStart: cal.lunchBreakStart,
          lunchBreakEnd: cal.lunchBreakEnd,
        },
        semesterDates: semDates.map(sd => ({ semesterNumber: sd.semesterNumber, startDate: String(sd.startDate), endDate: String(sd.endDate) })),
        teachers: teachers.map(t => ({ id: t.id, name: t.name, email: t.email, weeklyHours: t.weeklyHours })),
        sessions: sessions.map(s => ({ id: s.id, teacherId: s.teacherId, subject: s.subject, dayOfWeek: s.dayOfWeek, startTime: s.startTime, endTime: s.endTime })),
        breaks: breaks.map(b => ({ name: b.label, semesterNumber: b.semester, startDate: String(b.startDate), endDate: String(b.endDate) })),
        subjects: subjects.map(s => ({ name: s.name, unit: s.unit, classroom: s.classroom, maxStudents: s.maxStudents, totalAcademicHours: s.totalAcademicHours, semesterNumber: s.semester, color: s.color })),
        schoolName: input.schoolName,
        lang: input.lang,
      });
      return { pdf: pdfBuffer.toString("base64"), filename: `academic-calendar-${cal.academicYear}.pdf` };
    }),
});
