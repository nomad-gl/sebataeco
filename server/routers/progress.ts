import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";
import { getDb } from "../db";
import {
  studentProgress,
  assignments,
  assignmentCompletions,
  groupStudents,
  classGroups,
} from "../../drizzle/schema";
import { eq, and, desc, inArray } from "drizzle-orm";

const COMPETENCY_NAMES: Record<string, string> = {
  CCL: "Communication & Linguistic Competency",
  CP: "Plurilingual Competency",
  STEM: "STEM Competency",
  CD: "Digital Competency",
  CPSAA: "Personal, Social & Learning Competency",
  CC: "Citizenship Competency",
  CE: "Entrepreneurial Competency",
  CCEC: "Cultural & Artistic Competency",
};

const ALL_COMPETENCIES = Object.keys(COMPETENCY_NAMES);

// ── Procedures ────────────────────────────────────────────────────────────────

export const progressRouter = router({
  /** Log one or more competency scores for a student (e.g. after a challenge) */
  logScores: protectedProcedure
    .input(
      z.object({
        groupId: z.number(),
        studentId: z.number(),
        activityType: z.enum(["challenge", "assignment", "practice"]),
        activityTitle: z.string().optional(),
        challengeLogId: z.number().optional(),
        scores: z.array(
          z.object({
            competency: z.string(),
            score: z.number().min(0).max(100),
          })
        ),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const rows = input.scores.map((s) => ({
        groupId: input.groupId,
        studentId: input.studentId,
        challengeLogId: input.challengeLogId ?? null,
        competency: s.competency,
        score: s.score,
        activityType: input.activityType,
        activityTitle: input.activityTitle ?? null,
      }));
      await db.insert(studentProgress).values(rows);
      return { ok: true };
    }),

  /** Get all progress records for a specific student */
  getStudentProgress: protectedProcedure
    .input(z.object({ groupId: z.number(), studentId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const records = await db
        .select()
        .from(studentProgress)
        .where(
          and(
            eq(studentProgress.groupId, input.groupId),
            eq(studentProgress.studentId, input.studentId)
          )
        )
        .orderBy(desc(studentProgress.recordedAt));
      return records;
    }),

  /** Get aggregated competency averages for a student */
  getStudentSummary: protectedProcedure
    .input(z.object({ groupId: z.number(), studentId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const records = await db
        .select()
        .from(studentProgress)
        .where(
          and(
            eq(studentProgress.groupId, input.groupId),
            eq(studentProgress.studentId, input.studentId)
          )
        );

      // Aggregate averages per competency
      const totals: Record<string, { sum: number; count: number }> = {};
      for (const r of records) {
        if (!totals[r.competency]) totals[r.competency] = { sum: 0, count: 0 };
        totals[r.competency].sum += r.score;
        totals[r.competency].count += 1;
      }

      const competencyAverages = ALL_COMPETENCIES.map((code) => ({
        code,
        name: COMPETENCY_NAMES[code],
        average: totals[code]
          ? Math.round(totals[code].sum / totals[code].count)
          : null,
        count: totals[code]?.count ?? 0,
      }));

      const overall =
        competencyAverages.filter((c) => c.average !== null).length > 0
          ? Math.round(
              competencyAverages
                .filter((c) => c.average !== null)
                .reduce((s, c) => s + (c.average ?? 0), 0) /
                competencyAverages.filter((c) => c.average !== null).length
            )
          : null;

      return { competencyAverages, overall, totalActivities: records.length };
    }),

  /** Get all students' summaries for a group (for the group progress view) */
  getGroupSummary: protectedProcedure
    .input(z.object({ groupId: z.number() }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      // Verify group belongs to this teacher
      const [group] = await db
        .select()
        .from(classGroups)
        .where(
          and(
            eq(classGroups.id, input.groupId),
            eq(classGroups.userId, ctx.user.id)
          )
        );
      if (!group) throw new Error("Group not found");

      const students = await db
        .select()
        .from(groupStudents)
        .where(eq(groupStudents.groupId, input.groupId))
        .orderBy(groupStudents.studentNumber);

      if (students.length === 0) return { students: [], competencyAverages: [] };

      const studentIds = students.map((s) => s.id);
      const allRecords = await db
        .select()
        .from(studentProgress)
        .where(
          and(
            eq(studentProgress.groupId, input.groupId),
            inArray(studentProgress.studentId, studentIds)
          )
        );

      // Build per-student summaries
      const studentSummaries = students.map((student) => {
        const records = allRecords.filter((r) => r.studentId === student.id);
        const totals: Record<string, { sum: number; count: number }> = {};
        for (const r of records) {
          if (!totals[r.competency]) totals[r.competency] = { sum: 0, count: 0 };
          totals[r.competency].sum += r.score;
          totals[r.competency].count += 1;
        }
        const competencyScores = ALL_COMPETENCIES.map((code) => ({
          code,
          average: totals[code]
            ? Math.round(totals[code].sum / totals[code].count)
            : null,
        }));
        const scoredComps = competencyScores.filter((c) => c.average !== null);
        const overall =
          scoredComps.length > 0
            ? Math.round(
                scoredComps.reduce((s, c) => s + (c.average ?? 0), 0) /
                  scoredComps.length
              )
            : null;
        return {
          student,
          competencyScores,
          overall,
          totalActivities: records.length,
        };
      });

      // Class-level competency averages
      const classTotals: Record<string, { sum: number; count: number }> = {};
      for (const r of allRecords) {
        if (!classTotals[r.competency])
          classTotals[r.competency] = { sum: 0, count: 0 };
        classTotals[r.competency].sum += r.score;
        classTotals[r.competency].count += 1;
      }
      const competencyAverages = ALL_COMPETENCIES.map((code) => ({
        code,
        name: COMPETENCY_NAMES[code],
        average: classTotals[code]
          ? Math.round(classTotals[code].sum / classTotals[code].count)
          : null,
      }));

      return { students: studentSummaries, competencyAverages, group };
    }),

  // ── Assignments ─────────────────────────────────────────────────────────────

  /** Create an assignment for a group */
  createAssignment: protectedProcedure
    .input(
      z.object({
        groupId: z.number(),
        title: z.string().min(1).max(255),
        description: z.string().optional(),
        competency: z.string().optional(),
        dueDate: z.string().optional(), // ISO date string
        frequency: z.enum(["once", "daily", "weekly"]).default("once"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const [result] = await db.insert(assignments).values({
        groupId: input.groupId,
        userId: ctx.user.id,
        title: input.title,
        description: input.description ?? null,
        competency: input.competency ?? null,
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        frequency: input.frequency,
      });
      return { id: (result as any).insertId };
    }),

  /** List assignments for a group */
  listAssignments: protectedProcedure
    .input(z.object({ groupId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      return db
        .select()
        .from(assignments)
        .where(eq(assignments.groupId, input.groupId))
        .orderBy(desc(assignments.createdAt));
    }),

  /** Delete an assignment */
  deleteAssignment: protectedProcedure
    .input(z.object({ assignmentId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db
        .delete(assignments)
        .where(
          and(
            eq(assignments.id, input.assignmentId),
            eq(assignments.userId, ctx.user.id)
          )
        );
      return { ok: true };
    }),

  /** Mark a student's assignment as complete (with optional score) */
  completeAssignment: protectedProcedure
    .input(
      z.object({
        assignmentId: z.number(),
        studentId: z.number(),
        score: z.number().min(0).max(100).optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      // Remove existing completion first (idempotent)
      await db
        .delete(assignmentCompletions)
        .where(
          and(
            eq(assignmentCompletions.assignmentId, input.assignmentId),
            eq(assignmentCompletions.studentId, input.studentId)
          )
        );
      await db.insert(assignmentCompletions).values({
        assignmentId: input.assignmentId,
        studentId: input.studentId,
        score: input.score ?? null,
        notes: input.notes ?? null,
      });
      return { ok: true };
    }),

  /** Get all completions for an assignment */
  getAssignmentCompletions: protectedProcedure
    .input(z.object({ assignmentId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      return db
        .select()
        .from(assignmentCompletions)
        .where(eq(assignmentCompletions.assignmentId, input.assignmentId));
    }),

  // ── AI Reports ──────────────────────────────────────────────────────────────

  /** Generate an AI progress report for a single student */
  generateStudentReport: protectedProcedure
    .input(
      z.object({
        groupId: z.number(),
        studentId: z.number(),
        studentName: z.string(),
        lang: z.enum(["en", "es", "ca"]).default("en"),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const records = await db
        .select()
        .from(studentProgress)
        .where(
          and(
            eq(studentProgress.groupId, input.groupId),
            eq(studentProgress.studentId, input.studentId)
          )
        )
        .orderBy(desc(studentProgress.recordedAt));

      if (records.length === 0) {
        return {
          report: "No progress data available yet for this student.",
          grade: null,
        };
      }

      // Build competency averages
      const totals: Record<string, { sum: number; count: number }> = {};
      for (const r of records) {
        if (!totals[r.competency]) totals[r.competency] = { sum: 0, count: 0 };
        totals[r.competency].sum += r.score;
        totals[r.competency].count += 1;
      }
      const compSummary = ALL_COMPETENCIES.map((code) => ({
        code,
        name: COMPETENCY_NAMES[code],
        average: totals[code]
          ? Math.round(totals[code].sum / totals[code].count)
          : "No data",
      }));

      const overall =
        compSummary.filter((c) => c.average !== "No data").length > 0
          ? Math.round(
              (compSummary
                .filter((c) => c.average !== "No data")
                .reduce((s, c) => s + (c.average as number), 0) /
                compSummary.filter((c) => c.average !== "No data").length)
            )
          : null;

      const langLabel =
        input.lang === "es"
          ? "Spanish"
          : input.lang === "ca"
          ? "Catalan"
          : "English";

      const prompt = `You are an expert educational assessor specialising in Spain's LOMLOE curriculum framework.

Student: ${input.studentName}
Total activities recorded: ${records.length}
Overall average score: ${overall !== null ? overall + "/100" : "Insufficient data"}

Competency scores (0-100 scale, LOMLOE framework):
${compSummary.map((c) => `- ${c.code} (${c.name}): ${c.average}`).join("\n")}

Write a detailed, professional progress report in ${langLabel} for this student. The report must include:
1. **Overall LOMLOE Grade** — assign a grade using the Spanish grading scale: Insuficiente (0-49), Suficiente (50-59), Bien (60-69), Notable (70-89), Sobresaliente (90-100). Explain the grade briefly.
2. **Strengths** — identify 2-3 competencies where the student excels, with specific observations.
3. **Areas for Development** — identify 2-3 competencies needing improvement, with constructive feedback.
4. **Growth Opportunities** — suggest 3 specific, actionable strategies aligned to LOMLOE standards to help the student progress.
5. **Summary** — a brief encouraging closing paragraph.

Use a warm, professional tone suitable for sharing with parents and students. Format with clear headings.`;

      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content:
              "You are an expert educational assessor for Spain's LOMLOE curriculum. Write professional, constructive progress reports.",
          },
          { role: "user", content: prompt },
        ],
      });

      const report =
        response.choices?.[0]?.message?.content ?? "Report generation failed.";

      // Derive letter grade
      const grade =
        overall === null
          ? null
          : overall >= 90
          ? "Sobresaliente"
          : overall >= 70
          ? "Notable"
          : overall >= 60
          ? "Bien"
          : overall >= 50
          ? "Suficiente"
          : "Insuficiente";

      return { report, grade, overall };
    }),

  /** Generate an AI group summary report */
  generateGroupReport: protectedProcedure
    .input(
      z.object({
        groupId: z.number(),
        className: z.string(),
        lang: z.enum(["en", "es", "ca"]).default("en"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      const [group] = await db
        .select()
        .from(classGroups)
        .where(
          and(
            eq(classGroups.id, input.groupId),
            eq(classGroups.userId, ctx.user.id)
          )
        );
      if (!group) throw new Error("Group not found");

      const students = await db
        .select()
        .from(groupStudents)
        .where(eq(groupStudents.groupId, input.groupId));

      if (students.length === 0) {
        return { report: "No students in this group yet.", grade: null };
      }

      const studentIds = students.map((s) => s.id);
      const allRecords = await db
        .select()
        .from(studentProgress)
        .where(
          and(
            eq(studentProgress.groupId, input.groupId),
            inArray(studentProgress.studentId, studentIds)
          )
        );

      if (allRecords.length === 0) {
        return {
          report: "No progress data recorded for this group yet.",
          grade: null,
        };
      }

      // Class-level competency averages
      const classTotals: Record<string, { sum: number; count: number }> = {};
      for (const r of allRecords) {
        if (!classTotals[r.competency])
          classTotals[r.competency] = { sum: 0, count: 0 };
        classTotals[r.competency].sum += r.score;
        classTotals[r.competency].count += 1;
      }
      const compSummary = ALL_COMPETENCIES.map((code) => ({
        code,
        name: COMPETENCY_NAMES[code],
        average: classTotals[code]
          ? Math.round(classTotals[code].sum / classTotals[code].count)
          : "No data",
      }));

      const classOverall =
        compSummary.filter((c) => c.average !== "No data").length > 0
          ? Math.round(
              compSummary
                .filter((c) => c.average !== "No data")
                .reduce((s, c) => s + (c.average as number), 0) /
                compSummary.filter((c) => c.average !== "No data").length
            )
          : null;

      const langLabel =
        input.lang === "es"
          ? "Spanish"
          : input.lang === "ca"
          ? "Catalan"
          : "English";

      const prompt = `You are an expert educational assessor specialising in Spain's LOMLOE curriculum framework.

Class: ${input.className}
Number of students: ${students.length}
Total activity records: ${allRecords.length}
Class overall average: ${classOverall !== null ? classOverall + "/100" : "Insufficient data"}

Class competency averages (0-100 scale, LOMLOE framework):
${compSummary.map((c) => `- ${c.code} (${c.name}): ${c.average}`).join("\n")}

Write a detailed class summary report in ${langLabel}. The report must include:
1. **Class LOMLOE Grade** — assign an overall class grade using the Spanish scale: Insuficiente (0-49), Suficiente (50-59), Bien (60-69), Notable (70-89), Sobresaliente (90-100).
2. **Class Strengths** — identify the 2-3 competencies where the class performs best.
3. **Class Weaknesses** — identify the 2-3 competencies needing the most attention.
4. **Recommended Teaching Strategies** — suggest 3-4 specific LOMLOE-aligned teaching interventions to address the weaknesses.
5. **Growth Areas** — highlight emerging competencies showing positive trends.
6. **Summary** — a brief professional closing paragraph for the teacher.

Use a professional, analytical tone. Format with clear headings.`;

      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content:
              "You are an expert educational assessor for Spain's LOMLOE curriculum. Write professional class summary reports for teachers.",
          },
          { role: "user", content: prompt },
        ],
      });

      const report =
        response.choices?.[0]?.message?.content ?? "Report generation failed.";

      const grade =
        classOverall === null
          ? null
          : classOverall >= 90
          ? "Sobresaliente"
          : classOverall >= 70
          ? "Notable"
          : classOverall >= 60
          ? "Bien"
          : classOverall >= 50
          ? "Suficiente"
          : "Insuficiente";

      return { report, grade, overall: classOverall };
    }),
});
