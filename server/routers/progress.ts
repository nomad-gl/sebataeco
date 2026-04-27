import { z } from "zod";
import { randomUUID } from "crypto";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";
import { checkBias } from "../biasGuard";
import { getDb } from "../db";
import { storagePut } from "../storage";
import { PDFParse } from "pdf-parse";
import {
  studentProgress,
  assignments,
  assignmentCompletions,
  groupStudents,
  classGroups,
  studentReports,
  groupChallengeLog,
  classChallenges,
  challengeParticipants,
  progressWorksheets,
} from "../../drizzle/schema";
import { eq, and, desc, inArray, sql } from "drizzle-orm";

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

// -- Procedures ----------------------------------------------------------------

export const progressRouter = router({
  /** Log one or more competency scores for a student (e.g. after a challenge) */
  logScores: protectedProcedure
    .input(
      z.object({
        groupId: z.number(),
        studentId: z.number(),
        activityType: z.enum(["challenge", "assignment", "practice"]),
        activityTitle: z.string().nullish(),
        challengeLogId: z.number().nullish(),
        /** Optional: caller-supplied activityId (for re-attaching files to an existing entry) */
        activityId: z.string().nullish(),
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
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      // Generate a shared activityId so all competency rows (and any worksheet files)
      // from this single "Log Score" submission can be grouped together.
      const activityId = input.activityId ?? randomUUID();
      const rows = input.scores.map((s) => ({
        groupId: input.groupId,
        studentId: input.studentId,
        challengeLogId: input.challengeLogId ?? null,
        competency: s.competency,
        score: s.score,
        activityType: input.activityType,
        activityTitle: input.activityTitle ?? null,
        activityId,
      }));
      await db.insert(studentProgress).values(rows);
      return { ok: true, activityId };
    }),

  /** Get all progress records for a specific student */
  getStudentProgress: protectedProcedure
    .input(z.object({ groupId: z.number(), studentId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
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
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
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
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

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

  // -- Assignments -------------------------------------------------------------

  /** Create an assignment for a group */
  createAssignment: protectedProcedure
    .input(
      z.object({
        groupId: z.number(),
        title: z.string().min(1).max(255),
        description: z.string().nullish(),
        competency: z.string().nullish(),
        dueDate: z.string().nullish(), // ISO date string
        frequency: z.enum(["once", "daily", "weekly"]).default("once"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const result = await db.insert(assignments).values({
        groupId: input.groupId,
        userId: ctx.user.id,
        title: input.title,
        description: input.description ?? null,
        competency: input.competency ?? null,
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        frequency: input.frequency,
      });
      return { id: (result as any)[0].insertId };
    }),

  /** List assignments for a group */
  listAssignments: protectedProcedure
    .input(z.object({ groupId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
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
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
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
        score: z.number().min(0).max(100).nullish(),
        notes: z.string().nullish(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
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
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      return db
        .select()
        .from(assignmentCompletions)
        .where(eq(assignmentCompletions.assignmentId, input.assignmentId));
    }),

  // -- AI Reports --------------------------------------------------------------

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
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
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

      const rawReport = String(response.choices?.[0]?.message?.content ?? "Report generation failed.");
      // Bias guard: scan student report before returning
      const biasResult = await checkBias(prompt, rawReport, undefined, undefined);
      const report = biasResult.safeOutput;

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

      // Persist the AI report to DB so it can be loaded and edited later
      const db2 = await getDb();
      if (db2) {
        const existing = await db2
          .select({ id: studentReports.id })
          .from(studentReports)
          .where(and(eq(studentReports.groupId, input.groupId), eq(studentReports.studentId, input.studentId)))
          .limit(1);
        if (existing.length > 0) {
          await db2
            .update(studentReports)
            .set({ aiText: report, editedText: null, grade: grade ?? undefined, overall: overall ?? undefined })
            .where(eq(studentReports.id, existing[0].id));
        } else {
          await db2.insert(studentReports).values({
            groupId: input.groupId,
            studentId: input.studentId,
            aiText: report,
            editedText: null,
            grade: grade ?? undefined,
            overall: overall ?? undefined,
          });
        }
      }

      return { report, grade, overall };
    }),

  /** Fetch the saved (possibly teacher-edited) report for a student */
  getStudentReport: protectedProcedure
    .input(z.object({ groupId: z.number(), studentId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const rows = await db
        .select()
        .from(studentReports)
        .where(and(eq(studentReports.groupId, input.groupId), eq(studentReports.studentId, input.studentId)))
        .limit(1);
      return rows[0] ?? null;
    }),

  /** Save teacher edits to a student report */
  saveStudentReport: protectedProcedure
    .input(
      z.object({
        groupId: z.number(),
        studentId: z.number(),
        editedText: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const existing = await db
        .select({ id: studentReports.id })
        .from(studentReports)
        .where(and(eq(studentReports.groupId, input.groupId), eq(studentReports.studentId, input.studentId)))
        .limit(1);
      if (existing.length === 0) throw new Error("Report not found — generate it first");
      await db
        .update(studentReports)
        .set({ editedText: input.editedText, lastEditedBy: ctx.user.id })
        .where(eq(studentReports.id, existing[0].id));
      return { ok: true };
    }),

  /** Reset teacher edits — clears editedText so AI version is used */
  resetStudentReport: protectedProcedure
    .input(z.object({ groupId: z.number(), studentId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      await db
        .update(studentReports)
        .set({ editedText: null, lastEditedBy: null })
        .where(and(eq(studentReports.groupId, input.groupId), eq(studentReports.studentId, input.studentId)));
      return { ok: true };
    }),

  /**
   * Generate LOMLOE progress reports for ALL students in a group.
   * Runs sequentially to avoid overloading the LLM API.
   * Returns per-student results so the client can show live progress.
   */
  generateAllStudentReports: protectedProcedure
    .input(
      z.object({
        groupId: z.number(),
        lang: z.enum(["en", "es", "ca"]).default("en"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      // Verify the group belongs to this teacher
      const [group] = await db
        .select()
        .from(classGroups)
        .where(and(eq(classGroups.id, input.groupId), eq(classGroups.userId, ctx.user.id)));
      if (!group) throw new Error("Group not found");

      const students = await db
        .select()
        .from(groupStudents)
        .where(eq(groupStudents.groupId, input.groupId));

      if (students.length === 0) return { results: [], total: 0 };

      const langLabel =
        input.lang === "es" ? "Spanish" : input.lang === "ca" ? "Catalan" : "English";

      const ALL_COMP_NAMES: Record<string, string> = {
        CCL: "Communication & Linguistic Competency",
        CP: "Plurilingual Competency",
        STEM: "STEM Competency",
        CD: "Digital Competency",
        CPSAA: "Personal, Social & Learning Competency",
        CC: "Citizenship Competency",
        CE: "Entrepreneurial Competency",
        CCEC: "Cultural & Artistic Competency",
      };
      const ALL_COMP_KEYS = Object.keys(ALL_COMP_NAMES);

      const results: { studentId: number; studentName: string; ok: boolean; grade: string | null }[] = [];

      for (const student of students) {
        try {
          const records = await db
            .select()
            .from(studentProgress)
            .where(and(eq(studentProgress.groupId, input.groupId), eq(studentProgress.studentId, student.id)))
            .orderBy(desc(studentProgress.recordedAt));

          if (records.length === 0) {
            results.push({ studentId: student.id, studentName: student.name, ok: false, grade: null });
            continue;
          }

          // Compute competency averages
          const totals: Record<string, { sum: number; count: number }> = {};
          for (const r of records) {
            if (!totals[r.competency]) totals[r.competency] = { sum: 0, count: 0 };
            totals[r.competency].sum += r.score;
            totals[r.competency].count += 1;
          }
          const compSummary = ALL_COMP_KEYS.map((code) => ({
            code,
            name: ALL_COMP_NAMES[code],
            average: totals[code] ? Math.round(totals[code].sum / totals[code].count) : "No data",
          }));
          const withData = compSummary.filter((c) => c.average !== "No data");
          const overall = withData.length > 0
            ? Math.round(withData.reduce((s, c) => s + (c.average as number), 0) / withData.length)
            : null;

          const prompt = `You are an expert educational assessor specialising in Spain's LOMLOE curriculum framework.

Student: ${student.name}
Total activities recorded: ${records.length}
Overall average score: ${overall !== null ? overall + "/100" : "Insufficient data"}

Competency scores (0-100 scale, LOMLOE framework):
${compSummary.map((c) => `- ${c.code} (${c.name}): ${c.average}`).join("\n")}

Write a detailed, professional progress report in ${langLabel} for this student. The report must include:
1. **Overall LOMLOE Grade** — assign a grade using the Spanish grading scale: Insuficiente (0-49), Suficiente (50-59), Bien (60-69), Notable (70-89), Sobresaliente (90-100). Explain the grade briefly.
2. **Strengths** — identify 2-3 competencies where the student excels, with specific observations.
3. **Areas for Development** — identify 2-3 competencies needing improvement, with constructive feedback.
4. **Growth Opportunities** — suggest 3 specific, actionable strategies aligned to LOMLOE standards.
5. **Summary** — a brief encouraging closing paragraph.

Use a warm, professional tone suitable for sharing with parents and students. Format with clear headings.`;

          const response = await invokeLLM({
            messages: [
              { role: "system", content: "You are an expert educational assessor for Spain's LOMLOE curriculum. Write professional, constructive progress reports." },
              { role: "user", content: prompt },
            ],
          });

          const rawReport = String(response.choices?.[0]?.message?.content ?? "Report generation failed.");
          const biasResult = await checkBias(prompt, rawReport, undefined, undefined);
          const report = biasResult.safeOutput;

          const grade = overall === null ? null
            : overall >= 90 ? "Sobresaliente"
            : overall >= 70 ? "Notable"
            : overall >= 60 ? "Bien"
            : overall >= 50 ? "Suficiente"
            : "Insuficiente";

          // Upsert into student_reports
          const existing = await db
            .select({ id: studentReports.id })
            .from(studentReports)
            .where(and(eq(studentReports.groupId, input.groupId), eq(studentReports.studentId, student.id)))
            .limit(1);
          if (existing.length > 0) {
            await db
              .update(studentReports)
              .set({ aiText: report, editedText: null, grade: grade ?? undefined, overall: overall ?? undefined })
              .where(eq(studentReports.id, existing[0].id));
          } else {
            await db.insert(studentReports).values({
              groupId: input.groupId,
              studentId: student.id,
              aiText: report,
              editedText: null,
              grade: grade ?? undefined,
              overall: overall ?? undefined,
            });
          }

          results.push({ studentId: student.id, studentName: student.name, ok: true, grade });
        } catch {
          results.push({ studentId: student.id, studentName: student.name, ok: false, grade: null });
        }
      }

      return { results, total: students.length };
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
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

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

      const rawReport = String(response.choices?.[0]?.message?.content ?? "Report generation failed.");
      // Bias guard: scan class report before returning
      const classReportBias = await checkBias(prompt, rawReport, undefined, ctx.user.id);
      const report = classReportBias.safeOutput;

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

  /** Save challenge participant scores to a group's student progress records */
  saveChallengeToGroup: protectedProcedure
    .input(
      z.object({
        groupId: z.number(),
        challengeId: z.number(),
        challengeTitle: z.string(),
        competency: z.string().nullish(),
        /** Array of { nickname, score, total } from the leaderboard */
        participants: z.array(
          z.object({
            nickname: z.string(),
            score: z.number(),
            total: z.number(),
          })
        ),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      // Verify group belongs to this teacher
      const [group] = await db
        .select()
        .from(classGroups)
        .where(and(eq(classGroups.id, input.groupId), eq(classGroups.userId, ctx.user.id)));
      if (!group) throw new Error("Group not found");
      // Fetch students in this group
      const students = await db
        .select()
        .from(groupStudents)
        .where(eq(groupStudents.groupId, input.groupId));
      // Match participants to students by nickname (case-insensitive)
      const { groupChallengeLog } = await import("../../drizzle/schema");
      // Log the challenge in group_challenge_log
      const competencies = input.competency ? [input.competency] : [];
      await db.insert(groupChallengeLog).values({
        groupId: input.groupId,
        challengeId: input.challengeId,
        challengeTitle: input.challengeTitle,
        competencies: JSON.stringify(competencies),
        runAt: new Date(),
      });
      // Write student_progress rows for matched students
      let matched = 0;
      for (const p of input.participants) {
        const student = students.find(
          (s) => s.name.toLowerCase() === p.nickname.toLowerCase()
        );
        if (!student) continue;
        const pct = p.total > 0 ? Math.round((p.score / p.total) * 100) : 0;
        const comps = competencies.length > 0 ? competencies : ["CCL"];
        for (const comp of comps) {
          await db.insert(studentProgress).values({
            groupId: input.groupId,
            studentId: student.id,
            activityType: "challenge",
            activityTitle: input.challengeTitle,
            competency: comp,
            score: pct,
            recordedAt: new Date(),
          });
        }
        matched++;
      }
      return { matched, total: input.participants.length };
    }),

  /**
   * Get challenge history for a class group, with per-question breakdown.
   * Returns the last 20 challenge sessions saved to this group.
   */
  getChallengeHistory: protectedProcedure
    .input(z.object({ groupId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];
      // Verify group ownership
      const [group] = await db
        .select()
        .from(classGroups)
        .where(and(eq(classGroups.id, input.groupId), eq(classGroups.userId, ctx.user.id)));
      if (!group) throw new TRPCError({ code: "FORBIDDEN", message: "Group not found" });

      // Fetch last 20 challenge log entries
      const logs = await db
        .select()
        .from(groupChallengeLog)
        .where(eq(groupChallengeLog.groupId, input.groupId))
        .orderBy(desc(groupChallengeLog.runAt))
        .limit(20);

      // For each log entry, fetch the challenge room data (questions + participants)
      const results = await Promise.all(
        logs.map(async (log) => {
          if (!log.challengeId) return { log, questions: [], participants: [] };
          const [room] = await db
            .select()
            .from(classChallenges)
            .where(eq(classChallenges.id, log.challengeId));
          const participants = await db
            .select()
            .from(challengeParticipants)
            .where(eq(challengeParticipants.challengeId, log.challengeId))
            .orderBy(desc(challengeParticipants.score));
          return {
            log,
            questions: room ? (room.questions as unknown as Array<{ question: string; options: string[]; correctIndex: number }>) : [],
            participants: participants.map(p => ({
              nickname: p.nickname,
              score: p.score,
              answers: p.answers ? JSON.parse(p.answers) as number[] : [],
            })),
          };
        })
      );
      return results;
    }),

  /** Export a student progress report as a PDF (base64 encoded) */
  exportStudentPdf: protectedProcedure
    .input(
      z.object({
        groupId: z.number(),
        studentId: z.number(),
        studentName: z.string(),
        className: z.string(),
        reportText: z.string(),
        grade: z.string().nullable(),
        overall: z.number().nullable(),
        scores: z.array(z.object({ code: z.string(), name: z.string(), average: z.union([z.number(), z.string()]) })),
      })
    )
    .mutation(async ({ input }) => {
      // Dynamically import pdfkit to avoid bundling issues
      const PDFDocument = (await import("pdfkit")).default;
      const chunks: Buffer[] = [];
      const doc = new PDFDocument({ margin: 50, size: "A4" });
      await new Promise<void>((resolve, reject) => {
        doc.on("data", (chunk: Buffer) => chunks.push(chunk));
        doc.on("end", resolve);
        doc.on("error", reject);

        // Header
        doc.fontSize(20).fillColor("#4f46e5").text("SEBA | Teach", { align: "center" });
        doc.fontSize(12).fillColor("#6b7280").text("LOMLOE Student Progress Report", { align: "center" });
        doc.moveDown(0.5);
        doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#e5e7eb").stroke();
        doc.moveDown(0.5);

        // Student info
        doc.fontSize(14).fillColor("#111827").text(`Student: ${input.studentName}`);
        doc.fontSize(11).fillColor("#6b7280").text(`Class: ${input.className}`);
        doc.text(`Report Date: ${new Date().toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" })}`);
        if (input.grade) {
          doc.moveDown(0.3);
          doc.fontSize(13).fillColor("#4f46e5").text(`Overall Grade: ${input.grade}${input.overall !== null ? ` (${input.overall}/100)` : ""}`);
        }
        doc.moveDown(0.8);

        // Competency scores table
        doc.fontSize(13).fillColor("#111827").text("Competency Scores", { underline: true });
        doc.moveDown(0.4);
        for (const s of input.scores) {
          const score = typeof s.average === "number" ? `${s.average}/100` : s.average;
          doc.fontSize(10).fillColor("#374151").text(`${s.code}  –  ${s.name}`, { continued: true });
          doc.fillColor("#4f46e5").text(`  ${score}`, { align: "right" });
        }
        doc.moveDown(0.8);

        // AI Report text
        doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#e5e7eb").stroke();
        doc.moveDown(0.5);
        doc.fontSize(13).fillColor("#111827").text("AI Progress Report", { underline: true });
        doc.moveDown(0.4);
        doc.fontSize(10).fillColor("#374151").text(input.reportText, { lineGap: 4 });

        // Footer
        doc.moveDown(1);
        doc.fontSize(8).fillColor("#9ca3af").text("Powered by AINA | TA", { align: "center" });

        doc.end();
      });

      const pdfBuffer = Buffer.concat(chunks);
      return { base64: pdfBuffer.toString("base64") };
    }),

  /** Get all groups for the current teacher with their overall progress summary */
  getAllGroupsSummary: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];

    const groups = await db
      .select()
      .from(classGroups)
      .where(eq(classGroups.userId, ctx.user.id))
      .orderBy(desc(classGroups.createdAt));

    if (groups.length === 0) return [];

    const results = await Promise.all(
      groups.map(async (group) => {
        const students = await db
          .select()
          .from(groupStudents)
          .where(eq(groupStudents.groupId, group.id));

        const studentCount = students.length;

        if (studentCount === 0) {
          return { group, studentCount, totalActivities: 0, overall: null, grade: null, topCompetencies: [] };
        }

        const studentIds = students.map((s) => s.id);
        const allRecords = await db
          .select()
          .from(studentProgress)
          .where(
            and(
              eq(studentProgress.groupId, group.id),
              inArray(studentProgress.studentId, studentIds)
            )
          );

        const totalActivities = allRecords.length;

        // Compute per-competency class averages
        const classTotals: Record<string, { sum: number; count: number }> = {};
        for (const r of allRecords) {
          if (!classTotals[r.competency]) classTotals[r.competency] = { sum: 0, count: 0 };
          classTotals[r.competency].sum += r.score;
          classTotals[r.competency].count += 1;
        }

        const compAverages = ALL_COMPETENCIES.map((code) => ({
          code,
          average: classTotals[code]
            ? Math.round(classTotals[code].sum / classTotals[code].count)
            : null,
        }));

        const scored = compAverages.filter((c) => c.average !== null);
        const overall =
          scored.length > 0
            ? Math.round(scored.reduce((s, c) => s + (c.average ?? 0), 0) / scored.length)
            : null;

        const grade =
          overall === null ? null
          : overall >= 90 ? "Sobresaliente"
          : overall >= 70 ? "Notable"
          : overall >= 60 ? "Bien"
          : overall >= 50 ? "Suficiente"
          : "Insuficiente";

        // Top 3 competencies by average
        const topCompetencies = [...scored]
          .sort((a, b) => (b.average ?? 0) - (a.average ?? 0))
          .slice(0, 3)
          .map((c) => c.code);

        return { group, studentCount, totalActivities, overall, grade, topCompetencies };
      })
    );

    return results;
  }),

  /** Export all students' per-competency averages and LOMLOE grade as CSV */
  exportGroupGradesCSV: protectedProcedure
    .input(z.object({ groupId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      // Verify ownership
      const [group] = await db
        .select()
        .from(classGroups)
        .where(and(eq(classGroups.id, input.groupId), eq(classGroups.userId, ctx.user.id)));
      if (!group) throw new Error("Group not found");

      const students = await db
        .select()
        .from(groupStudents)
        .where(eq(groupStudents.groupId, input.groupId))
        .orderBy(groupStudents.studentNumber);

      const allRecords = students.length > 0
        ? await db
            .select()
            .from(studentProgress)
            .where(
              and(
                eq(studentProgress.groupId, input.groupId),
                inArray(studentProgress.studentId, students.map((s) => s.id))
              )
            )
        : [];

      // Build per-student per-competency averages
      const rows: string[] = [];
      const header = ["Student #", "Name", "Email", ...ALL_COMPETENCIES, "Overall Average", "LOMLOE Grade"];
      rows.push(header.join(","));

      for (const student of students) {
        const records = allRecords.filter((r) => r.studentId === student.id);
        const compTotals: Record<string, { sum: number; count: number }> = {};
        for (const r of records) {
          if (!compTotals[r.competency]) compTotals[r.competency] = { sum: 0, count: 0 };
          compTotals[r.competency].sum += r.score;
          compTotals[r.competency].count += 1;
        }
        const compAvgs = ALL_COMPETENCIES.map((code) =>
          compTotals[code] ? Math.round(compTotals[code].sum / compTotals[code].count) : ""
        );
        const scored = compAvgs.filter((v) => v !== "") as number[];
        const overall = scored.length > 0 ? Math.round(scored.reduce((a, b) => a + b, 0) / scored.length) : "";
        const grade =
          overall === "" ? ""
          : overall >= 90 ? "Sobresaliente"
          : overall >= 70 ? "Notable"
          : overall >= 60 ? "Bien"
          : overall >= 50 ? "Suficiente"
          : "Insuficiente";
        const name = `"${student.name.replace(/"/g, '""')}"`;
        const email = `"${student.email.replace(/"/g, '""')}"`;
        rows.push([student.studentNumber, name, email, ...compAvgs, overall, grade].join(","));
      }

      return { csv: rows.join("\n"), filename: `${group.className.replace(/[^a-z0-9]/gi, "_")}_grades.csv` };
    }),

  /** Check for overdue assignments and notify the owner */
  checkOverdueAssignments: protectedProcedure
    .input(z.object({ groupId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const now = new Date();
      const allAssignments = await db
        .select()
        .from(assignments)
        .where(eq(assignments.groupId, input.groupId));
      const overdue = allAssignments.filter(
        (a) => a.dueDate && new Date(a.dueDate) < now
      );
      if (overdue.length === 0) return { overdue: 0 };
      // Check which have zero completions
      const overdueIds = overdue.map((a) => a.id);
      const completions = await db
        .select()
        .from(assignmentCompletions)
        .where(inArray(assignmentCompletions.assignmentId, overdueIds));
      const completedIds = new Set(completions.map((c) => c.assignmentId));
      const uncompleted = overdue.filter((a) => !completedIds.has(a.id));
      if (uncompleted.length === 0) return { overdue: 0 };
      // Notify the owner
      const { notifyOwner } = await import("../_core/notification");
      await notifyOwner({
        title: `${uncompleted.length} overdue assignment${uncompleted.length > 1 ? "s" : ""} with no completions`,
        content: uncompleted
          .map((a) => `• ${a.title} (due ${new Date(a.dueDate!).toLocaleDateString()})`)
          .join("\n"),
      });
      return { overdue: uncompleted.length };
    }),

  /** Generate AI assignment content based on form inputs and student context */
  generateAssignment: protectedProcedure
    .input(
      z.object({
        assignmentId: z.number().nullish(), // if set, update existing; else just return content
        studentName: z.string(),
        title: z.string().min(1).max(255),
        description: z.string().nullish(),
        competency: z.string().nullish(),
        assignmentType: z.enum(["worksheet", "essay", "quiz", "project", "presentation", "research", "creative", "debate", "experiment", "other"]).default("worksheet"),
        yearGroup: z.enum(["infantil", "junior", "primary", "secondary"]).nullish(),
        difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
        uiLang: z.enum(["en", "es", "ca"]).default("en"),
        competencyScores: z.array(z.object({ code: z.string(), average: z.number().nullable() })).nullish(),
      })
    )
    .mutation(async ({ input }) => {
      const competencyName = input.competency ? (COMPETENCY_NAMES[input.competency] ?? input.competency) : "all LOMLOE competencies";
      const yearGroupLabel = input.yearGroup === "infantil" ? "Educació Infantil (ages 0–6, Decret 21/2023)"
        : input.yearGroup === "junior" ? "Primary Years 3\u20134 (ages 8\u201310)"
        : input.yearGroup === "primary" ? "Upper Primary Years 5\u20136 (ages 10\u201312)"
        : input.yearGroup === "secondary" ? "Secondary Years 7\u201310 (ages 12\u201316)"
        : "mixed year groups";
      const langName = input.uiLang === "es" ? "Spanish" : input.uiLang === "ca" ? "Catalan" : "English";
      const difficultyLabel = input.difficulty === "easy" ? "accessible/supportive" : input.difficulty === "hard" ? "challenging/extension" : "standard";

      const profileLines = (input.competencyScores ?? [])
        .filter((c) => c.average !== null)
        .sort((a, b) => (a.average ?? 0) - (b.average ?? 0))
        .map((c) => `  ${c.code}: ${c.average}/100`);
      const profileSection = profileLines.length > 0
        ? `\nStudent competency profile (lower scores = areas needing support):\n${profileLines.join("\n")}`
        : "";

      const typeInstructions: Record<string, string> = {
        worksheet: "Create a structured worksheet with clear instructions, 4\u20136 varied exercises (fill-in, short answer, matching, or diagram labelling), and a reflection question at the end.",
        essay: "Provide a clear essay prompt with guiding questions, a suggested structure (introduction, 2\u20133 body paragraphs, conclusion), a word count target, and assessment criteria.",
        quiz: "Create 8\u201310 questions in a mix of formats: multiple choice (4 options each), true/false, and 1\u20132 short-answer questions. Include an answer key at the end.",
        project: "Outline a project with a clear goal, step-by-step tasks, required materials/resources, a timeline suggestion, and an assessment rubric with 3\u20134 criteria.",
        presentation: "Provide a presentation brief with topic, suggested slide structure (6\u20138 slides), key points to cover, speaker notes guidance, and delivery tips.",
        research: "Design a research task with a guiding question, 3\u20134 sub-questions, suggested sources, a note-taking template, and a short write-up format.",
        creative: "Design a creative task with a clear brief, examples for inspiration, step-by-step guidance, and criteria for what makes a strong creative response.",
        debate: "Set up a debate with a clear motion, arguments for both sides (3 points each), suggested evidence, debate structure, and judging criteria.",
        experiment: "Design a simple experiment with hypothesis, materials list, step-by-step method, results table, and analysis questions.",
        other: "Create a well-structured, engaging assignment appropriate for the topic and year group.",
      };
      const typeGuide = typeInstructions[input.assignmentType] ?? typeInstructions.other;

      const systemPrompt = `You are an expert LOMLOE curriculum teacher creating a high-quality, ready-to-use assignment for a Spanish school. Write entirely in ${langName}. Format your response in clean Markdown.`;
      const userPrompt = `Create a complete, ready-to-use **${input.assignmentType}** assignment:\n\n**Student:** ${input.studentName}\n**Year group:** ${yearGroupLabel}\n**Competency focus:** ${competencyName}\n**Difficulty level:** ${difficultyLabel}\n**Assignment title:** ${input.title}${input.description ? `\n**Teacher notes:** ${input.description}` : ""}${profileSection}\n\n**Type instructions:** ${typeGuide}\n\n**Requirements:**\n- Align all tasks to LOMLOE ${competencyName} descriptors\n- Use age-appropriate language for ${yearGroupLabel}\n- Make it engaging and practical\n- Include clear student instructions at the top\n- Use Markdown formatting\n- End with a brief teacher note on how to assess/use this assignment`;

      const response = await invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      });
      const raw = response.choices?.[0]?.message?.content ?? "";
      const aiContent = typeof raw === "string" ? raw : JSON.stringify(raw);

      // Persist to DB if an assignmentId was provided
      if (input.assignmentId) {
        const db = await getDb();
        if (db) {
          await db.update(assignments)
            .set({ aiContent, assignmentType: input.assignmentType, editedContent: null })
            .where(eq(assignments.id, input.assignmentId));
        }
      }
      return { aiContent };
    }),

  /** Save teacher-edited assignment content */
  saveAssignmentEdit: protectedProcedure
    .input(z.object({
      assignmentId: z.number(),
      editedContent: z.string(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      await db.update(assignments)
        .set({ editedContent: input.editedContent })
        .where(eq(assignments.id, input.assignmentId));
      return { ok: true };
    }),

  /** AI-assess a student's response to an assignment */
  assessAssignment: protectedProcedure
    .input(z.object({
      assignmentId: z.number(),
      studentName: z.string(),
      studentResponse: z.string().min(1),
      uiLang: z.enum(["en", "es", "ca"]).default("en"),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      // Load the assignment to get its content and type
      const [assignment] = await db.select().from(assignments).where(eq(assignments.id, input.assignmentId));
      if (!assignment) throw new Error("Assignment not found");

      const assignmentContent = assignment.editedContent ?? assignment.aiContent ?? assignment.title;
      const langName = input.uiLang === "es" ? "Spanish" : input.uiLang === "ca" ? "Catalan" : "English";

      const systemPrompt = `You are an expert LOMLOE curriculum teacher providing detailed, constructive assessment feedback. Write entirely in ${langName}. Format your response in clean Markdown.`;
      const userPrompt = `Assess the following student response to a LOMLOE assignment.\n\n**Student:** ${input.studentName}\n**Assignment:** ${assignment.title}${assignment.competency ? ` (${assignment.competency})` : ""}\n\n**Assignment content:**\n${assignmentContent}\n\n**Student's response:**\n${input.studentResponse}\n\nProvide:\n1. A score from 0\u2013100 based on LOMLOE criteria\n2. An overall grade (Insuficiente / Suficiente / Bien / Notable / Sobresaliente)\n3. Detailed feedback covering: strengths, areas for improvement, and specific suggestions\n4. 2\u20133 follow-up activities to address any gaps\n\nFormat your response as follows:\n**Score:** [number 0-100]\n**Grade:** [grade name]\n\n[Then provide the detailed feedback in Markdown]`;

      const response = await invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      });
      const raw = response.choices?.[0]?.message?.content ?? "";
      const aiFeedback = typeof raw === "string" ? raw : JSON.stringify(raw);

      // Parse score from the response
      const scoreMatch = aiFeedback.match(/\*\*Score:\*\*\s*(\d+)/);
      const aiScore = scoreMatch ? Math.min(100, Math.max(0, parseInt(scoreMatch[1], 10))) : null;

      // Persist results
      await db.update(assignments)
        .set({
          studentResponse: input.studentResponse,
          aiFeedback,
          aiScore: aiScore ?? undefined,
          aiAssessedAt: new Date(),
        })
        .where(eq(assignments.id, input.assignmentId));

      return { aiFeedback, aiScore };
    }),

  // ── Upload student submission file ────────────────────────────────────────
  uploadAssignmentFile: protectedProcedure
    .input(z.object({
      assignmentId: z.number(),
      /** Base64-encoded file content */
      fileBase64: z.string(),
      /** Original filename */
      fileName: z.string(),
      /** MIME type */
      mimeType: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      // Verify assignment belongs to this teacher's group
      const [assignment] = await db.select().from(assignments)
        .where(eq(assignments.id, input.assignmentId)).limit(1);
      if (!assignment) throw new TRPCError({ code: "NOT_FOUND", message: "Assignment not found" });
      const [group] = await db.select().from(classGroups)
        .where(eq(classGroups.id, assignment.groupId)).limit(1);
      if (!group || group.userId !== ctx.user.id)
        throw new TRPCError({ code: "FORBIDDEN", message: "Not your assignment" });

      // Decode base64 and upload to S3
      const buffer = Buffer.from(input.fileBase64, "base64");
      const ext = input.fileName.split(".").pop() ?? "bin";
      const key = `assignment-submissions/${ctx.user.id}/${input.assignmentId}-${Date.now()}.${ext}`;
      const { url } = await storagePut(key, buffer, input.mimeType);

      // Persist file metadata to DB
      await db.update(assignments)
        .set({
          submissionKey: key,
          submissionUrl: url,
          submissionMime: input.mimeType,
          submissionName: input.fileName,
          submissionUploadedAt: new Date(),
          // Clear previous assessment when a new file is uploaded
          aiFeedback: null,
          aiScore: null,
          aiAssessedAt: null,
        })
        .where(eq(assignments.id, input.assignmentId));

      return { url, key, fileName: input.fileName, mimeType: input.mimeType };
    }),

  // ── Assess uploaded submission with AI vision ─────────────────────────────
  assessUploadedAssignment: protectedProcedure
    .input(z.object({
      assignmentId: z.number(),
      studentName: z.string().nullish(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const [assignment] = await db.select().from(assignments)
        .where(eq(assignments.id, input.assignmentId)).limit(1);
      if (!assignment) throw new TRPCError({ code: "NOT_FOUND", message: "Assignment not found" });
      if (!assignment.submissionUrl)
        throw new TRPCError({ code: "BAD_REQUEST", message: "No submission file uploaded" });

      const assignmentContent = assignment.editedContent ?? assignment.aiContent ?? assignment.title;
      const studentLabel = input.studentName ?? "the student";
      const mime = assignment.submissionMime ?? "";
      const isImage = mime.startsWith("image/");
      const isPdf = mime === "application/pdf";

      const systemPrompt = `You are an expert LOMLOE curriculum teacher and assessor.
You will be given a student assignment submission (either as an image of handwritten/printed work, or a PDF/document) and the original assignment brief.
Your task is to:
1. Read and understand the student's submission carefully (OCR the handwriting/text if needed).
2. Assess the quality, accuracy, and depth of the response against the assignment brief and LOMLOE competency standards.
3. Provide a score from 0 to 100 and a detailed, constructive feedback report in the same language as the assignment.

Format your response exactly as:
**Score:** [0-100]
**LOMLOE Grade:** [Insuficient / Suficient / Bé / Notable / Excel·lent]
**Summary:** [2-3 sentence overview]
**Strengths:**
- [strength 1]
- [strength 2]
**Areas for Improvement:**
- [area 1]
- [area 2]
**Detailed Feedback:**
[Full paragraph feedback]`;

      // For PDFs: extract text server-side with pdf-parse so the LLM gets
      // full textual content even for multi-page documents.
      let pdfExtractedText: string | null = null;
      if (isPdf) {
        try {
          const parser = new PDFParse({ url: assignment.submissionUrl });
          const result = await parser.getText();
          pdfExtractedText = result.text?.trim() || null;
        } catch (err) {
          console.warn("[assessUploadedAssignment] pdf-parse failed, falling back to file_url:", err);
        }
      }

      let userContent: any[];
      if (isImage) {
        userContent = [
          { type: "text", text: `Assignment brief:\n${assignmentContent}\n\nStudent: ${studentLabel}\n\nPlease assess the student's handwritten/printed submission shown in the image below:` },
          { type: "image_url", image_url: { url: assignment.submissionUrl, detail: "high" } },
        ];
      } else if (isPdf) {
        if (pdfExtractedText) {
          // Use extracted text — more reliable for multi-page PDFs
          userContent = [
            { type: "text", text: `Assignment brief:\n${assignmentContent}\n\nStudent: ${studentLabel}\n\nThe student's PDF submission text (extracted):\n\n${pdfExtractedText}\n\nPlease assess the above submission against the assignment brief and LOMLOE competency standards.` },
          ];
        } else {
          // Fallback: send as file_url for vision-capable models
          userContent = [
            { type: "text", text: `Assignment brief:\n${assignmentContent}\n\nStudent: ${studentLabel}\n\nPlease assess the student's submission in the attached PDF:` },
            { type: "file_url", file_url: { url: assignment.submissionUrl, mime_type: "application/pdf" as const } },
          ];
        }
      } else {
        // Fallback for docx/other formats
        userContent = [
          { type: "text", text: `Assignment brief:\n${assignmentContent}\n\nStudent: ${studentLabel}\n\nThe student has submitted a file (${assignment.submissionName}, type: ${mime}). Please assess based on the assignment brief and note that this file format could not be directly read — advise the teacher to convert it to PDF or image for best AI grading results.` },
        ];
      }

      const response = await invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
      });

      const raw = response.choices?.[0]?.message?.content ?? "";
      const aiFeedback = typeof raw === "string" ? raw : JSON.stringify(raw);
      const scoreMatch = aiFeedback.match(/\*\*Score:\*\*\s*(\d+)/);
      const aiScore = scoreMatch ? Math.min(100, Math.max(0, parseInt(scoreMatch[1], 10))) : null;

      await db.update(assignments)
        .set({ aiFeedback, aiScore: aiScore ?? undefined, aiAssessedAt: new Date() })
        .where(eq(assignments.id, input.assignmentId));

      return { aiFeedback, aiScore };
    }),

  // ── Worksheet file upload ──────────────────────────────────────────────────

  /** Upload a worksheet file (PDF or image) and attach it to a progress activity */
  uploadWorksheet: protectedProcedure
    .input(
      z.object({
        activityId: z.string(),
        groupId: z.number(),
        studentId: z.number(),
        fileName: z.string(),
        /** Base64-encoded file content */
        fileBase64: z.string(),
        mimeType: z.string(),
        fileSize: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const MAX_BYTES = 16 * 1024 * 1024; // 16 MB
      const buf = Buffer.from(input.fileBase64, "base64");
      if (buf.length > MAX_BYTES) {
        throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "File exceeds 16 MB limit" });
      }

      const ext = input.fileName.split(".").pop() ?? "bin";
      const fileKey = `worksheets/${input.groupId}/${input.studentId}/${input.activityId}-${randomUUID()}.${ext}`;
      const { url } = await storagePut(fileKey, buf, input.mimeType);

      await db.insert(progressWorksheets).values({
        activityId: input.activityId,
        groupId: input.groupId,
        studentId: input.studentId,
        fileKey,
        fileUrl: url,
        fileName: input.fileName,
        mimeType: input.mimeType,
        fileSize: input.fileSize ?? buf.length,
      });

      return { ok: true, url, fileKey, fileName: input.fileName, mimeType: input.mimeType };
    }),

  /** List all worksheet files attached to a given activityId */
  getWorksheets: protectedProcedure
    .input(z.object({ activityId: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      return db
        .select()
        .from(progressWorksheets)
        .where(eq(progressWorksheets.activityId, input.activityId))
        .orderBy(progressWorksheets.uploadedAt);
    }),

  /** List all worksheet files for a student (across all activities) */
  getStudentWorksheets: protectedProcedure
    .input(z.object({ groupId: z.number(), studentId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      return db
        .select()
        .from(progressWorksheets)
        .where(
          and(
            eq(progressWorksheets.groupId, input.groupId),
            eq(progressWorksheets.studentId, input.studentId)
          )
        )
        .orderBy(desc(progressWorksheets.uploadedAt));
    }),
});
