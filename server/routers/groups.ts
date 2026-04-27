import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and, desc, max, inArray } from "drizzle-orm";
import { getDb } from "../db";
import { protectedProcedure, router } from "../_core/trpc";
import { buildTenantWhere, getTenantIdForInsert } from "../tenantFilter";
import {
  classGroups,
  groupStudents,
  groupMessages,
  groupChallengeLog,
  studentProgress,
} from "../../drizzle/schema";

export const groupsRouter = router({
  // -- Groups CRUD ----------------------------------------------------------

  /** List all groups owned by the current teacher, with student count */
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    // Tenant filter: admins see all groups; regular users see their tenant's groups
    const tenantWhere = buildTenantWhere(ctx.user, classGroups);
    const rows = await db
      .select()
      .from(classGroups)
      .where(tenantWhere ?? eq(classGroups.userId, ctx.user.id))
      .orderBy(desc(classGroups.createdAt));
    // Fetch counts for all groups in one pass
    const countMap: Record<number, number> = {};
    if (rows.length) {
      const allSt = await db
        .select({ groupId: groupStudents.groupId })
        .from(groupStudents);
      for (const s of allSt) {
        countMap[s.groupId] = (countMap[s.groupId] ?? 0) + 1;
      }
    }
    return rows.map((r) => ({ ...r, studentCount: countMap[r.id] ?? 0 }));
  }),


  /** Create a new class group */
  create: protectedProcedure
    .input(
      z.object({
        className: z.string().min(1).max(128),
        level: z.string().min(1).max(64),
        assessmentTitle: z.string().min(1).max(255),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const result = await db.insert(classGroups).values({
        userId: ctx.user.id,
        className: input.className,
        level: input.level,
        assessmentTitle: input.assessmentTitle,
        tenantId: getTenantIdForInsert(ctx.user),
      });
      return { id: (result as any)[0].insertId as number };
    }),

  /** Update a group's details */
  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        className: z.string().min(1).max(128).nullish(),
        level: z.string().min(1).max(64).nullish(),
        assessmentTitle: z.string().min(1).max(255).nullish(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const { id, ...rawFields } = input;
      // Strip null values — Drizzle set() does not accept null for non-nullable columns
      const fields = Object.fromEntries(
        Object.entries(rawFields).filter(([, v]) => v !== null)
      );
      await db
        .update(classGroups)
        .set(fields)
        .where(and(eq(classGroups.id, id), eq(classGroups.userId, ctx.user.id)));
      return { success: true };
    }),

  /** Delete a group and all its students, messages, and challenge logs */
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      // Verify ownership
      const [group] = await db
        .select()
        .from(classGroups)
        .where(and(eq(classGroups.id, input.id), eq(classGroups.userId, ctx.user.id)));
      if (!group) throw new TRPCError({ code: "NOT_FOUND", message: "Group not found" });

      // Cascade delete children
      await db.delete(groupStudents).where(eq(groupStudents.groupId, input.id));
      await db.delete(groupMessages).where(eq(groupMessages.groupId, input.id));
      await db.delete(groupChallengeLog).where(eq(groupChallengeLog.groupId, input.id));
      await db.delete(classGroups).where(eq(classGroups.id, input.id));
      return { success: true };
    }),

  // -- Students -------------------------------------------------------------

  /** List students in a group (ordered by studentNumber) */
  listStudents: protectedProcedure
    .input(z.object({ groupId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];
      // Verify ownership
      const [group] = await db
        .select()
        .from(classGroups)
        .where(and(eq(classGroups.id, input.groupId), eq(classGroups.userId, ctx.user.id)));
      if (!group) throw new TRPCError({ code: "NOT_FOUND", message: "Group not found" });

      const rows = await db
        .select()
        .from(groupStudents)
        .where(eq(groupStudents.groupId, input.groupId))
        .orderBy(groupStudents.studentNumber);

      // Derive last-active per student from student_progress.recordedAt
      let lastActiveMap: Record<number, Date | null> = {};
      if (rows.length) {
        const studentIds = rows.map((r) => r.id);
        const activityRows = await db
          .select({
            studentId: studentProgress.studentId,
            lastActive: max(studentProgress.recordedAt),
          })
          .from(studentProgress)
          .where(inArray(studentProgress.studentId, studentIds))
          .groupBy(studentProgress.studentId);
        for (const a of activityRows) {
          lastActiveMap[a.studentId] = a.lastActive ? new Date(a.lastActive) : null;
        }
      }

      return rows.map((r) => ({
        ...r,
        lastActive: lastActiveMap[r.id] ?? null,
      }));
    }),

  /** Add a student to a group (auto-assigns next studentNumber) */
  addStudent: protectedProcedure
    .input(
      z.object({
        groupId: z.number(),
        name: z.string().min(1).max(128),
        email: z.string().max(320).optional().default(""),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      // Verify ownership
      const [group] = await db
        .select()
        .from(classGroups)
        .where(and(eq(classGroups.id, input.groupId), eq(classGroups.userId, ctx.user.id)));
      if (!group) throw new TRPCError({ code: "NOT_FOUND", message: "Group not found" });

      // Duplicate name check (case-insensitive, same group)
      const allInGroup = await db
        .select({ name: groupStudents.name })
        .from(groupStudents)
        .where(eq(groupStudents.groupId, input.groupId));
      const normalised = input.name.trim().toLowerCase();
      const duplicate = allInGroup.find((s) => s.name.trim().toLowerCase() === normalised);
      if (duplicate) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `DUPLICATE_STUDENT:${input.name.trim()}`,
        });
      }

      // Get next student number
      const existing = allInGroup.length > 0
        ? await db
            .select({ studentNumber: groupStudents.studentNumber })
            .from(groupStudents)
            .where(eq(groupStudents.groupId, input.groupId))
            .orderBy(desc(groupStudents.studentNumber))
        : [];
      const nextNumber = existing.length > 0 ? existing[0].studentNumber + 1 : 1;

      const result = await db.insert(groupStudents).values({
        groupId: input.groupId,
        studentNumber: nextNumber,
        name: input.name,
        email: input.email,
      });
      return { id: (result as any)[0].insertId as number, studentNumber: nextNumber };
    }),

  /** Update a student's name and/or email */
  updateStudent: protectedProcedure
    .input(
      z.object({
        studentId: z.number(),
        groupId: z.number(),
        name: z.string().min(1).max(128).nullish(),
        email: z.string().max(320).nullish(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const [group] = await db
        .select()
        .from(classGroups)
        .where(and(eq(classGroups.id, input.groupId), eq(classGroups.userId, ctx.user.id)));
      if (!group) throw new TRPCError({ code: "NOT_FOUND", message: "Group not found" });
      const updates: Record<string, unknown> = {};
      if (input.name) updates.name = input.name.trim();
      if (input.email) updates.email = input.email.trim();
      if (Object.keys(updates).length === 0) return { success: true };
      await db
        .update(groupStudents)
        .set(updates)
        .where(and(eq(groupStudents.id, input.studentId), eq(groupStudents.groupId, input.groupId)));
      return { success: true };
    }),

  /** Bulk-add multiple students to a group */
  bulkAddStudents: protectedProcedure
    .input(
      z.object({
        groupId: z.number(),
        students: z.array(
          z.object({
            name: z.string().min(1).max(128),
            email: z.string().max(320),
          })
        ).min(1).max(200),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const [group] = await db
        .select()
        .from(classGroups)
        .where(and(eq(classGroups.id, input.groupId), eq(classGroups.userId, ctx.user.id)));
      if (!group) throw new TRPCError({ code: "NOT_FOUND", message: "Group not found" });

      // Get existing names for duplicate check
      const existingStudents = await db
        .select({ name: groupStudents.name, studentNumber: groupStudents.studentNumber })
        .from(groupStudents)
        .where(eq(groupStudents.groupId, input.groupId))
        .orderBy(desc(groupStudents.studentNumber));
      const existingNames = new Set(existingStudents.map((s) => s.name.trim().toLowerCase()));
      let nextNumber = existingStudents.length > 0 ? existingStudents[0].studentNumber + 1 : 1;

      // Filter out duplicates (case-insensitive)
      const newStudents = input.students.filter((s) => {
        const n = s.name.trim().toLowerCase();
        if (existingNames.has(n)) return false;
        existingNames.add(n); // prevent intra-batch duplicates too
        return true;
      });
      const skipped = input.students.length - newStudents.length;

      if (newStudents.length === 0) {
        return { added: 0, skipped };
      }

      const rows = newStudents.map((s) => ({
        groupId: input.groupId,
        studentNumber: nextNumber++,
        name: s.name.trim(),
        email: s.email.trim(),
      }));
      await db.insert(groupStudents).values(rows);
      return { added: rows.length, skipped };
    }),

  /** Remove a student from a group */
  removeStudent: protectedProcedure
    .input(z.object({ studentId: z.number(), groupId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      // Verify ownership
      const [group] = await db
        .select()
        .from(classGroups)
        .where(and(eq(classGroups.id, input.groupId), eq(classGroups.userId, ctx.user.id)));
      if (!group) throw new TRPCError({ code: "NOT_FOUND", message: "Group not found" });

      await db
        .delete(groupStudents)
        .where(
          and(
            eq(groupStudents.id, input.studentId),
            eq(groupStudents.groupId, input.groupId)
          )
        );
      return { success: true };
    }),

  // -- Messages -------------------------------------------------------------

  /** List messages sent to a group */
  listMessages: protectedProcedure
    .input(z.object({ groupId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];
      const [group] = await db
        .select()
        .from(classGroups)
        .where(and(eq(classGroups.id, input.groupId), eq(classGroups.userId, ctx.user.id)));
      if (!group) throw new TRPCError({ code: "NOT_FOUND", message: "Group not found" });

      const rows = await db
        .select()
        .from(groupMessages)
        .where(eq(groupMessages.groupId, input.groupId))
        .orderBy(desc(groupMessages.sentAt));
      return rows;
    }),

  /** Send a message/alert to a group (logged to DB) */
  sendMessage: protectedProcedure
    .input(
      z.object({
        groupId: z.number(),
        subject: z.string().min(1).max(255),
        body: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const [group] = await db
        .select()
        .from(classGroups)
        .where(and(eq(classGroups.id, input.groupId), eq(classGroups.userId, ctx.user.id)));
      if (!group) throw new TRPCError({ code: "NOT_FOUND", message: "Group not found" });

      const result = await db.insert(groupMessages).values({
        groupId: input.groupId,
        userId: ctx.user.id,
        subject: input.subject,
        body: input.body,
      });
      return { id: (result as any)[0].insertId as number };
    }),

  // -- Challenge Log ---------------------------------------------------------

  /** List challenge history for a group */
  listChallengeLog: protectedProcedure
    .input(z.object({ groupId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];
      const [group] = await db
        .select()
        .from(classGroups)
        .where(and(eq(classGroups.id, input.groupId), eq(classGroups.userId, ctx.user.id)));
      if (!group) throw new TRPCError({ code: "NOT_FOUND", message: "Group not found" });

      const rows = await db
        .select()
        .from(groupChallengeLog)
        .where(eq(groupChallengeLog.groupId, input.groupId))
        .orderBy(desc(groupChallengeLog.runAt));
      return rows.map((r) => ({
        ...r,
        competencies: JSON.parse(r.competencies as string) as string[],
      }));
    }),

  /** Class summary: per-student grades per activity + competency coverage */
  getClassSummary: protectedProcedure
    .input(z.object({ groupId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return { students: [], activities: [] };

      // Verify ownership
      const [group] = await db
        .select()
        .from(classGroups)
        .where(and(eq(classGroups.id, input.groupId), eq(classGroups.userId, ctx.user.id)));
      if (!group) throw new TRPCError({ code: "NOT_FOUND", message: "Group not found" });

      // Fetch all students in the group
      const students = await db
        .select({ id: groupStudents.id, name: groupStudents.name })
        .from(groupStudents)
        .where(eq(groupStudents.groupId, input.groupId))
        .orderBy(groupStudents.studentNumber);

      if (!students.length) return { students: [], activities: [] };

      const studentIds = students.map((s) => s.id);

      // Fetch all progress rows for these students in this group
      const progressRows = await db
        .select()
        .from(studentProgress)
        .where(
          and(
            eq(studentProgress.groupId, input.groupId),
            inArray(studentProgress.studentId, studentIds)
          )
        )
        .orderBy(studentProgress.recordedAt);

      // Collect unique activity titles (each distinct activityTitle = one assessment column)
      const activitySet = new Map<string, { title: string; type: string }>();
      for (const row of progressRows) {
        const key = row.activityTitle ?? "Untitled";
        if (!activitySet.has(key)) {
          activitySet.set(key, { title: key, type: row.activityType });
        }
      }
      const activities = Array.from(activitySet.values());

      // Build per-student summary
      const studentSummaries = students.map((student) => {
        const myRows = progressRows.filter((r) => r.studentId === student.id);

        // Per-activity: average score across all competencies in that activity
        const activityScores: Record<string, number | null> = {};
        for (const act of activities) {
          const actRows = myRows.filter((r) => (r.activityTitle ?? "Untitled") === act.title);
          if (actRows.length === 0) {
            activityScores[act.title] = null;
          } else {
            const avg = Math.round(actRows.reduce((sum, r) => sum + r.score, 0) / actRows.length);
            activityScores[act.title] = avg;
          }
        }

        // All unique competencies covered across all activities
        const competencies = Array.from(new Set(myRows.map((r) => r.competency))).sort();

        return {
          studentId: student.id,
          studentName: student.name,
          activityScores,
          competencies,
        };
      });

      return { students: studentSummaries, activities };
    }),

  /** Log a challenge run against a group */
  logChallenge: protectedProcedure
    .input(
      z.object({
        groupId: z.number(),
        challengeId: z.number().nullish(),
        challengeTitle: z.string().min(1).max(255),
        competencies: z.array(z.string()),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const [group] = await db
        .select()
        .from(classGroups)
        .where(and(eq(classGroups.id, input.groupId), eq(classGroups.userId, ctx.user.id)));
      if (!group) throw new TRPCError({ code: "NOT_FOUND", message: "Group not found" });

      const result = await db.insert(groupChallengeLog).values({
        groupId: input.groupId,
        challengeId: input.challengeId ?? null,
        challengeTitle: input.challengeTitle,
        competencies: JSON.stringify(input.competencies),
      });
      return { id: (result as any)[0].insertId as number };
    }),
});
