import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import {
  timetableSlots,
  attendanceRecords,
  classGroups,
  groupStudents,
  users,
} from "../../drizzle/schema";
import { eq, and, gte, lte, inArray } from "drizzle-orm";

// ─── Timetable ────────────────────────────────────────────────────────────────

export const hosRouter = router({
  /**
   * Get all timetable slots for a given academic year.
   * Returns slots enriched with teacher name and class group name.
   */
  getTimetable: protectedProcedure
    .input(z.object({ academicYear: z.string().default("2025-26") }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      const slots = await db
        .select()
        .from(timetableSlots)
        .where(eq(timetableSlots.academicYear, input.academicYear));

      // Enrich with teacher names
      const teacherIds = Array.from(new Set(slots.map((s) => s.teacherId).filter((x): x is number => x != null)));
      const classGroupIds = Array.from(new Set(slots.map((s) => s.classGroupId).filter((x): x is number => x != null)));

      const teacherMap: Record<number, string> = {};
      const groupMap: Record<number, string> = {};

      if (teacherIds.length > 0) {
        const teachers = await db
          .select({ id: users.id, name: users.name })
          .from(users)
          .where(inArray(users.id, teacherIds));
        teachers.forEach((t) => { if (t.name) teacherMap[t.id] = t.name; });
      }

      if (classGroupIds.length > 0) {
        const groups = await db
          .select({ id: classGroups.id, className: classGroups.className })
          .from(classGroups)
          .where(inArray(classGroups.id, classGroupIds));
        groups.forEach((g) => { groupMap[g.id] = g.className; });
      }

      return slots.map((s) => ({
        ...s,
        teacherName: s.teacherId ? (teacherMap[s.teacherId] ?? null) : null,
        classGroupName: s.classGroupId ? (groupMap[s.classGroupId] ?? null) : null,
      }));
    }),

  /**
   * Upsert a timetable slot (create or update by dayOfWeek + periodNumber + academicYear).
   */
  saveSlot: protectedProcedure
    .input(
      z.object({
        id: z.number().optional(),
        dayOfWeek: z.number().min(1).max(5),
        periodNumber: z.number().min(1).max(12),
        startTime: z.string(),
        endTime: z.string(),
        teacherId: z.number().nullable().optional(),
        classGroupId: z.number().nullable().optional(),
        subject: z.string().nullable().optional(),
        room: z.string().nullable().optional(),
        academicYear: z.string().default("2025-26"),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      if (input.id) {
        await db
          .update(timetableSlots)
          .set({
            teacherId: input.teacherId ?? null,
            classGroupId: input.classGroupId ?? null,
            subject: input.subject ?? null,
            room: input.room ?? null,
            startTime: input.startTime,
            endTime: input.endTime,
          })
          .where(eq(timetableSlots.id, input.id));
        return { success: true };
      }

      await db.insert(timetableSlots).values({
        dayOfWeek: input.dayOfWeek,
        periodNumber: input.periodNumber,
        startTime: input.startTime,
        endTime: input.endTime,
        teacherId: input.teacherId ?? null,
        classGroupId: input.classGroupId ?? null,
        subject: input.subject ?? null,
        room: input.room ?? null,
        academicYear: input.academicYear,
      });

      return { success: true };
    }),

  /**
   * Delete a timetable slot by ID.
   */
  deleteSlot: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db.delete(timetableSlots).where(eq(timetableSlots.id, input.id));
      return { success: true };
    }),

  /**
   * Get all teachers (users) for the timetable slot assignment dropdown.
   */
  getTeachers: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users);
  }),

  /**
   * Get all class groups across all teachers for the timetable slot assignment dropdown.
   */
  getAllClassGroups: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db
      .select({ id: classGroups.id, className: classGroups.className, level: classGroups.level })
      .from(classGroups);
  }),

  // ─── Attendance ──────────────────────────────────────────────────────────────

  /**
   * Get attendance records for a class group within a date range.
   * Returns records enriched with student name.
   */
  getAttendance: protectedProcedure
    .input(
      z.object({
        classGroupId: z.number(),
        fromDate: z.string(), // ISO date string YYYY-MM-DD
        toDate: z.string(),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { records: [], students: [] };

      // Get students in this group
      const students = await db
        .select()
        .from(groupStudents)
        .where(eq(groupStudents.groupId, input.classGroupId));

      // Get attendance records in date range
      const records = await db
        .select()
        .from(attendanceRecords)
        .where(
          and(
            eq(attendanceRecords.classGroupId, input.classGroupId),
            gte(attendanceRecords.date, input.fromDate as unknown as Date),
            lte(attendanceRecords.date, input.toDate as unknown as Date)
          )
        );

      return { records, students };
    }),

  /**
   * Get 30-day absence rate summary per class group (for the chart).
   */
  getAbsenceSummary: protectedProcedure
    .input(z.object({ days: z.number().default(30) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - input.days);
      const fromStr = fromDate.toISOString().slice(0, 10);
      const toStr = new Date().toISOString().slice(0, 10);

      const groups = await db.select().from(classGroups);
      const results = [];

      for (const group of groups) {
        const students = await db
          .select()
          .from(groupStudents)
          .where(eq(groupStudents.groupId, group.id));

        const records = await db
          .select()
          .from(attendanceRecords)
          .where(
            and(
              eq(attendanceRecords.classGroupId, group.id),
              gte(attendanceRecords.date, fromStr as unknown as Date),
              lte(attendanceRecords.date, toStr as unknown as Date)
            )
          );

        const totalRecords = records.length;
        const absentRecords = records.filter((r) => r.status === "absent" || r.status === "late").length;
        const absenceRate = totalRecords > 0 ? Math.round((absentRecords / totalRecords) * 100) : 0;

        results.push({
          groupId: group.id,
          className: group.className,
          level: group.level,
          studentCount: students.length,
          totalRecords,
          absentRecords,
          absenceRate,
        });
      }

      return results;
    }),

  /**
   * Save (upsert) an attendance record for a student on a specific date.
   */
  saveAttendance: protectedProcedure
    .input(
      z.object({
        classGroupId: z.number(),
        studentId: z.number(),
        date: z.string(), // YYYY-MM-DD
        status: z.enum(["present", "absent", "late", "excused"]),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      // Try update first
      const existing = await db
        .select()
        .from(attendanceRecords)
        .where(
          and(
            eq(attendanceRecords.studentId, input.studentId),
            eq(attendanceRecords.date, input.date as unknown as Date)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(attendanceRecords)
          .set({
            status: input.status,
            notes: input.notes ?? null,
            recordedBy: ctx.user.id,
          })
          .where(eq(attendanceRecords.id, existing[0].id));
      } else {
        await db.insert(attendanceRecords).values({
          classGroupId: input.classGroupId,
          studentId: input.studentId,
          date: input.date as unknown as Date,
          status: input.status,
          notes: input.notes ?? null,
          recordedBy: ctx.user.id,
        });
      }

      return { success: true };
    }),

  /**
   * Bulk save attendance for an entire class on a given date.
   */
  bulkSaveAttendance: protectedProcedure
    .input(
      z.object({
        classGroupId: z.number(),
        date: z.string(),
        records: z.array(
          z.object({
            studentId: z.number(),
            status: z.enum(["present", "absent", "late", "excused"]),
            notes: z.string().optional(),
          })
        ),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      for (const rec of input.records) {
        const existing = await db
          .select()
          .from(attendanceRecords)
          .where(
            and(
              eq(attendanceRecords.studentId, rec.studentId),
              eq(attendanceRecords.date, input.date as unknown as Date)
            )
          )
          .limit(1);

        if (existing.length > 0) {
          await db
            .update(attendanceRecords)
            .set({ status: rec.status, notes: rec.notes ?? null, recordedBy: ctx.user.id })
            .where(eq(attendanceRecords.id, existing[0].id));
        } else {
          await db.insert(attendanceRecords).values({
            classGroupId: input.classGroupId,
            studentId: rec.studentId,
            date: input.date as unknown as Date,
            status: rec.status,
            notes: rec.notes ?? null,
            recordedBy: ctx.user.id,
          });
        }
      }

      return { success: true };
    }),
});
