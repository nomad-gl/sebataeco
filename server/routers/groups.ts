import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";
import { getDb } from "../db";
import { protectedProcedure, router } from "../_core/trpc";
import {
  classGroups,
  groupStudents,
  groupMessages,
  groupChallengeLog,
} from "../../drizzle/schema";

export const groupsRouter = router({
  // -- Groups CRUD ----------------------------------------------------------

  /** List all groups owned by the current teacher */
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    const rows = await db
      .select()
      .from(classGroups)
      .where(eq(classGroups.userId, ctx.user.id))
      .orderBy(desc(classGroups.createdAt));
    return rows;
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
      if (!db) throw new Error("DB unavailable");
      const [result] = await db.insert(classGroups).values({
        userId: ctx.user.id,
        className: input.className,
        level: input.level,
        assessmentTitle: input.assessmentTitle,
      });
      return { id: (result as any).insertId as number };
    }),

  /** Update a group's details */
  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        className: z.string().min(1).max(128).optional(),
        level: z.string().min(1).max(64).optional(),
        assessmentTitle: z.string().min(1).max(255).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const { id, ...fields } = input;
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
      if (!db) throw new Error("DB unavailable");
      // Verify ownership
      const [group] = await db
        .select()
        .from(classGroups)
        .where(and(eq(classGroups.id, input.id), eq(classGroups.userId, ctx.user.id)));
      if (!group) throw new Error("Group not found");

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
      if (!group) throw new Error("Group not found");

      const rows = await db
        .select()
        .from(groupStudents)
        .where(eq(groupStudents.groupId, input.groupId))
        .orderBy(groupStudents.studentNumber);
      return rows;
    }),

  /** Add a student to a group (auto-assigns next studentNumber) */
  addStudent: protectedProcedure
    .input(
      z.object({
        groupId: z.number(),
        name: z.string().min(1).max(128),
        email: z.string().email().max(320),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      // Verify ownership
      const [group] = await db
        .select()
        .from(classGroups)
        .where(and(eq(classGroups.id, input.groupId), eq(classGroups.userId, ctx.user.id)));
      if (!group) throw new Error("Group not found");

      // Get next student number
      const existing = await db
        .select()
        .from(groupStudents)
        .where(eq(groupStudents.groupId, input.groupId))
        .orderBy(desc(groupStudents.studentNumber));
      const nextNumber = existing.length > 0 ? existing[0].studentNumber + 1 : 1;

      const [result] = await db.insert(groupStudents).values({
        groupId: input.groupId,
        studentNumber: nextNumber,
        name: input.name,
        email: input.email,
      });
      return { id: (result as any).insertId as number, studentNumber: nextNumber };
    }),

  /** Remove a student from a group */
  removeStudent: protectedProcedure
    .input(z.object({ studentId: z.number(), groupId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      // Verify ownership
      const [group] = await db
        .select()
        .from(classGroups)
        .where(and(eq(classGroups.id, input.groupId), eq(classGroups.userId, ctx.user.id)));
      if (!group) throw new Error("Group not found");

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
      if (!group) throw new Error("Group not found");

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
      if (!db) throw new Error("DB unavailable");
      const [group] = await db
        .select()
        .from(classGroups)
        .where(and(eq(classGroups.id, input.groupId), eq(classGroups.userId, ctx.user.id)));
      if (!group) throw new Error("Group not found");

      const [result] = await db.insert(groupMessages).values({
        groupId: input.groupId,
        userId: ctx.user.id,
        subject: input.subject,
        body: input.body,
      });
      return { id: (result as any).insertId as number };
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
      if (!group) throw new Error("Group not found");

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

  /** Log a challenge run against a group */
  logChallenge: protectedProcedure
    .input(
      z.object({
        groupId: z.number(),
        challengeId: z.number().optional(),
        challengeTitle: z.string().min(1).max(255),
        competencies: z.array(z.string()),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const [group] = await db
        .select()
        .from(classGroups)
        .where(and(eq(classGroups.id, input.groupId), eq(classGroups.userId, ctx.user.id)));
      if (!group) throw new Error("Group not found");

      const [result] = await db.insert(groupChallengeLog).values({
        groupId: input.groupId,
        challengeId: input.challengeId ?? null,
        challengeTitle: input.challengeTitle,
        competencies: JSON.stringify(input.competencies),
      });
      return { id: (result as any).insertId as number };
    }),
});
