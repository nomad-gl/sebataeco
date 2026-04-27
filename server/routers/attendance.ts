import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { attendanceRecords, attendanceChanges, groupStudents, classGroups, users } from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import { buildTenantWhere } from "../tenantFilter";

export const attendanceRouter = router({
  /**
   * Get all students in a group and their attendance status for a given date.
   * Returns a merged list: every student in the group, with their attendance record (if any).
   */
  getByGroupAndDate: protectedProcedure
    .input(z.object({
      groupId: z.number().int().positive(),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      // Get all students in this group
      const students = await db
        .select()
        .from(groupStudents)
        .where(eq(groupStudents.groupId, input.groupId))
        .orderBy(groupStudents.studentNumber);

      // Get existing attendance records for this group + date
      const records = await db
        .select()
        .from(attendanceRecords)
        .where(
          and(
            eq(attendanceRecords.classGroupId, input.groupId),
            eq(attendanceRecords.date, input.date as any)
          )
        );

      // Merge: one entry per student
      const recordMap = new Map(records.map(r => [r.studentId, r]));
      return students.map(s => ({
        student: s,
        record: recordMap.get(s.id) ?? null,
      }));
    }),

  /**
   * Mark (or update) a student's attendance for a given date.
   * Logs the change in attendance_changes.
   */
  markAttendance: protectedProcedure
    .input(z.object({
      groupId: z.number().int().positive(),
      studentId: z.number().int().positive(),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      status: z.enum(["present", "absent", "late", "excused"]),
      notes: z.string().max(500).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      // Find existing record
      const [existing] = await db
        .select()
        .from(attendanceRecords)
        .where(
          and(
            eq(attendanceRecords.classGroupId, input.groupId),
            eq(attendanceRecords.studentId, input.studentId),
            eq(attendanceRecords.date, input.date as any)
          )
        )
        .limit(1);

      const changerName = ctx.user.name ?? ctx.user.email ?? `User ${ctx.user.id}`;

      if (existing) {
        // Update existing record
        await db
          .update(attendanceRecords)
          .set({
            status: input.status,
            notes: input.notes ?? existing.notes,
            recordedBy: ctx.user.id,
          })
          .where(eq(attendanceRecords.id, existing.id));

        // Log the change
        await db.insert(attendanceChanges).values({
          attendanceRecordId: existing.id,
          changedBy: ctx.user.id,
          changedByName: changerName,
          previousStatus: existing.status,
          newStatus: input.status,
          note: input.notes,
        });

        return { success: true, recordId: existing.id };
      } else {
        // Insert new record
        const [result] = await db
          .insert(attendanceRecords)
          .values({
            classGroupId: input.groupId,
            studentId: input.studentId,
            date: input.date as any,
            status: input.status,
            notes: input.notes,
            recordedBy: ctx.user.id,
          });

        const newId = (result as any).insertId as number;

        // Log the creation
        await db.insert(attendanceChanges).values({
          attendanceRecordId: newId,
          changedBy: ctx.user.id,
          changedByName: changerName,
          previousStatus: undefined,
          newStatus: input.status,
          note: input.notes,
        });

        return { success: true, recordId: newId };
      }
    }),

  /**
   * Get the most recent N changes across all attendance records for a group.
   * Used to show the audit trail of who made the last few changes.
   */
  getRecentChanges: protectedProcedure
    .input(z.object({
      groupId: z.number().int().positive(),
      limit: z.number().int().min(1).max(50).default(10),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      // Get recent changes for records in this group
      const records = await db
        .select({ id: attendanceRecords.id })
        .from(attendanceRecords)
        .where(eq(attendanceRecords.classGroupId, input.groupId));

      if (records.length === 0) return [];

      const recordIds = records.map(r => r.id);

      // Fetch changes for these records
      const changes = await db
        .select()
        .from(attendanceChanges)
        .orderBy(desc(attendanceChanges.changedAt))
        .limit(input.limit);

      // Filter to only changes for this group's records
      return changes.filter(c => recordIds.includes(c.attendanceRecordId));
    }),

  /**
   * Get all class groups (for the group selector dropdown).
   */
  getGroups: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    const tenantWhere = buildTenantWhere(ctx.user, classGroups);
    return db
      .select()
      .from(classGroups)
      .where(tenantWhere ?? eq(classGroups.userId, ctx.user.id))
      .orderBy(classGroups.yearGroup, classGroups.className);
  }),
});
