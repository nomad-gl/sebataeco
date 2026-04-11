/**
 * accountability.ts — AI Governance tRPC Router
 *
 * Covers three compliance pillars:
 *  1. Grade Overrides  — teachers can override AI grades with a mandatory reason;
 *                        every override is immutably logged.
 *  2. Bias Flags       — admin/teacher view of bias-guard incidents.
 *  3. Learning Paths   — AI generates personalised learning paths with a
 *                        structured justification that parents/teachers can audit.
 */

import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import {
  aiAssessments,
  aiGradeOverrides,
  aiBiasFlags,
  aiLearningPaths,
  practiceSessions,
} from "../../drizzle/schema";
import { eq, desc, and } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";
import { COMPETENCY_META } from "../knowledge/lomloeKnowledgeBank";
import type { CompetencyCode } from "../knowledge/lomloeKnowledgeBank";

// ── Grade Override procedures ─────────────────────────────────────────────────

const gradeOverrideRouter = router({
  /**
   * Create an AI assessment for a student (teacher-initiated).
   * In a real deployment this would be triggered by a completed practice session
   * or an explicit teacher action. Here teachers can manually create one.
   */
  createAssessment: protectedProcedure
    .input(
      z.object({
        studentId: z.number(),
        competency: z.string(),
        yearGroup: z.string().nullish(),
        evidenceSessionIds: z.array(z.number()).nullish(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Fetch practice session evidence
      const sessions = input.evidenceSessionIds?.length
        ? await db
            .select()
            .from(practiceSessions)
            .where(eq(practiceSessions.userId, input.studentId))
        : await db
            .select()
            .from(practiceSessions)
            .where(
              and(
                eq(practiceSessions.userId, input.studentId),
                input.competency ? eq(practiceSessions.competency, input.competency) : undefined
              )
            )
            .limit(20);

      const totalSessions = sessions.length;
      const avgScore =
        totalSessions > 0
          ? Math.round(sessions.reduce((s, r) => s + (r.score / r.total) * 100, 0) / totalSessions)
          : 0;

      const competencyName =
        COMPETENCY_META[input.competency as CompetencyCode]?.name ?? input.competency;

      // Ask the LLM to generate a summary
      const summaryResponse = await invokeLLM({
        messages: [
          {
            role: "system",
            content:
              "You are an educational assessment assistant. Write a concise, objective, 2-3 sentence performance summary for a student based on their practice session data. Focus on LOMLOE competency performance. Be neutral and evidence-based.",
          },
          {
            role: "user",
            content: `Competency: ${competencyName}\nSessions completed: ${totalSessions}\nAverage score: ${avgScore}%\nIndividual scores: ${sessions.map((s) => `${s.score}/${s.total}`).join(", ")}`,
          },
        ],
      });

      const aiSummary =
        typeof summaryResponse.choices?.[0]?.message?.content === "string"
          ? summaryResponse.choices[0].message.content
          : `Student completed ${totalSessions} practice sessions in ${competencyName} with an average score of ${avgScore}%.`;

      const result = await db.insert(aiAssessments).values({
        teacherId: ctx.user.id,
        studentId: input.studentId,
        competency: input.competency,
        yearGroup: input.yearGroup,
        aiScore: avgScore,
        aiSummary,
        evidenceSessionIds: JSON.stringify(input.evidenceSessionIds ?? sessions.map((s) => s.id)),
        overridden: false,
      });

      return { id: (result as unknown as [{ insertId: number }])[0].insertId, aiScore: avgScore, aiSummary };
    }),

  /** List all AI assessments created by this teacher. */
  listAssessments: protectedProcedure
    .input(z.object({ studentId: z.number().nullish() }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return [];

      const rows = await db
        .select()
        .from(aiAssessments)
        .where(
          input.studentId
            ? and(
                eq(aiAssessments.teacherId, ctx.user.id),
                eq(aiAssessments.studentId, input.studentId)
              )
            : eq(aiAssessments.teacherId, ctx.user.id)
        )
        .orderBy(desc(aiAssessments.createdAt))
        .limit(100);

      return rows;
    }),

  /**
   * Override an AI grade. The teacher must supply a mandatory reason.
   * The original AI score is preserved; a new override row is written.
   */
  overrideGrade: protectedProcedure
    .input(
      z.object({
        assessmentId: z.number(),
        teacherScore: z.number().min(0).max(100),
        reason: z.string().min(10, "Please provide at least 10 characters explaining the override"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Fetch the original assessment
      const [assessment] = await db
        .select()
        .from(aiAssessments)
        .where(
          and(
            eq(aiAssessments.id, input.assessmentId),
            eq(aiAssessments.teacherId, ctx.user.id)
          )
        );

      if (!assessment) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Assessment not found" });
      }

      // Write the override record (immutable audit trail)
      await db.insert(aiGradeOverrides).values({
        assessmentId: input.assessmentId,
        teacherId: ctx.user.id,
        aiScore: assessment.aiScore,
        teacherScore: input.teacherScore,
        reason: input.reason,
      });

      // Mark the assessment as overridden
      await db
        .update(aiAssessments)
        .set({ overridden: true })
        .where(eq(aiAssessments.id, input.assessmentId));

      return { success: true };
    }),

  /** Full audit log of all grade overrides by this teacher. */
  listOverrides: protectedProcedure
    .input(z.object({ assessmentId: z.number().nullish() }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return [];

      const rows = await db
        .select()
        .from(aiGradeOverrides)
        .where(
          input.assessmentId
            ? and(
                eq(aiGradeOverrides.teacherId, ctx.user.id),
                eq(aiGradeOverrides.assessmentId, input.assessmentId)
              )
            : eq(aiGradeOverrides.teacherId, ctx.user.id)
        )
        .orderBy(desc(aiGradeOverrides.createdAt))
        .limit(200);

      return rows;
    }),
});

// ── Bias Flag procedures ──────────────────────────────────────────────────────

const biasFlagRouter = router({
  /** List bias flags — teachers see their own; admins see all. */
  listFlags: protectedProcedure
    .input(
      z.object({
        resolved: z.boolean().nullish(),
        limit: z.number().min(1).max(200).default(50),
      })
    )
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return [];

      const isAdmin = ctx.user.role === "admin";

      const rows = await db
        .select()
        .from(aiBiasFlags)
        .where(
          !isAdmin
            ? and(
                eq(aiBiasFlags.userId, ctx.user.id),
                input.resolved != null
                  ? eq(aiBiasFlags.resolved, input.resolved)
                  : undefined
              )
            : input.resolved != null
            ? eq(aiBiasFlags.resolved, input.resolved)
            : undefined
        )
        .orderBy(desc(aiBiasFlags.createdAt))
        .limit(input.limit);

      return rows;
    }),

  /** Mark a bias flag as resolved (admin only). */
  resolveFlag: protectedProcedure
    .input(z.object({ flagId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      await db
        .update(aiBiasFlags)
        .set({ resolved: true, resolvedAt: new Date() })
        .where(eq(aiBiasFlags.id, input.flagId));

      return { success: true };
    }),
});

// ── Learning Path procedures ──────────────────────────────────────────────────

const learningPathRouter = router({
  /**
   * Generate a personalised learning path for a student with a full
   * structured justification that a teacher or parent can audit.
   */
  generate: protectedProcedure
    .input(
      z.object({
        studentId: z.number(),
        studentName: z.string(),
        competency: z.string(),
        yearGroup: z.string().nullish(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Gather evidence: practice sessions for this student
      const sessions = await db
        .select()
        .from(practiceSessions)
        .where(
          and(
            eq(practiceSessions.userId, input.studentId),
            eq(practiceSessions.competency, input.competency)
          )
        )
        .orderBy(desc(practiceSessions.createdAt))
        .limit(20);

      const totalSessions = sessions.length;
      const avgScore =
        totalSessions > 0
          ? Math.round(sessions.reduce((s, r) => s + (r.score / r.total) * 100, 0) / totalSessions)
          : null;

      const competencyName =
        COMPETENCY_META[input.competency as CompetencyCode]?.name ?? input.competency;
      const competencyDesc =
        COMPETENCY_META[input.competency as CompetencyCode]?.description ?? "";

      const evidenceSummary = {
        totalSessions,
        avgScore,
        recentScores: sessions.slice(0, 5).map((s) => ({
          score: s.score,
          total: s.total,
          pct: Math.round((s.score / s.total) * 100),
          date: s.createdAt,
        })),
      };

      // Generate the learning path + justification in one LLM call
      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `You are an expert LOMLOE curriculum specialist. Generate a personalised learning path for a student and a detailed justification that a parent or teacher can audit. The justification must:
1. Reference specific LOMLOE competency criteria
2. Cite the student's performance evidence
3. Explain WHY each recommended step was chosen
4. Be written in plain language that a parent can understand
5. Be completely free of bias related to gender, ethnicity, socioeconomic status, or background

Return a JSON object with exactly these fields:
{
  "steps": [{ "step": number, "activity": string, "duration": string, "resources": string, "rationale": string }],
  "justification": string,
  "lomloeReferences": [string],
  "evidenceUsed": string
}`,
          },
          {
            role: "user",
            content: `Student: ${input.studentName}
Competency: ${competencyName} (${input.competency})
Competency description: ${competencyDesc}
Year group: ${input.yearGroup ?? "Not specified"}
Practice sessions completed: ${totalSessions}
Average score: ${avgScore !== null ? `${avgScore}%` : "No data yet"}
Recent performance: ${sessions.slice(0, 5).map((s) => `${Math.round((s.score / s.total) * 100)}%`).join(", ") || "No sessions yet"}

Generate a 4-6 step personalised learning path with a full justification.`,
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "learning_path",
            strict: true,
            schema: {
              type: "object",
              properties: {
                steps: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      step: { type: "number" },
                      activity: { type: "string" },
                      duration: { type: "string" },
                      resources: { type: "string" },
                      rationale: { type: "string" },
                    },
                    required: ["step", "activity", "duration", "resources", "rationale"],
                    additionalProperties: false,
                  },
                },
                justification: { type: "string" },
                lomloeReferences: { type: "array", items: { type: "string" } },
                evidenceUsed: { type: "string" },
              },
              required: ["steps", "justification", "lomloeReferences", "evidenceUsed"],
              additionalProperties: false,
            },
          },
        },
      });

      const raw = response.choices?.[0]?.message?.content ?? "{}";
      const parsed = JSON.parse(typeof raw === "string" ? raw : JSON.stringify(raw));

      const result = await db.insert(aiLearningPaths).values({
        teacherId: ctx.user.id,
        studentId: input.studentId,
        competency: input.competency,
        yearGroup: input.yearGroup,
        recommendedPath: JSON.stringify(parsed.steps ?? []),
        justification: parsed.justification ?? "",
        evidenceSummary: JSON.stringify(evidenceSummary),
        lomloeReferences: JSON.stringify(parsed.lomloeReferences ?? []),
      });

      return {
        id: (result as unknown as [{ insertId: number }])[0].insertId,
        steps: parsed.steps ?? [],
        justification: parsed.justification ?? "",
        lomloeReferences: parsed.lomloeReferences ?? [],
        evidenceUsed: parsed.evidenceUsed ?? "",
        evidenceSummary,
      };
    }),

  /** List all learning paths generated by this teacher. */
  list: protectedProcedure
    .input(z.object({ studentId: z.number().nullish() }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return [];

      const rows = await db
        .select()
        .from(aiLearningPaths)
        .where(
          input.studentId
            ? and(
                eq(aiLearningPaths.teacherId, ctx.user.id),
                eq(aiLearningPaths.studentId, input.studentId)
              )
            : eq(aiLearningPaths.teacherId, ctx.user.id)
        )
        .orderBy(desc(aiLearningPaths.createdAt))
        .limit(100);

      return rows.map((r) => ({
        ...r,
        steps: JSON.parse(r.recommendedPath || "[]"),
        lomloeRefs: JSON.parse(r.lomloeReferences || "[]"),
        evidence: JSON.parse(r.evidenceSummary || "{}"),
      }));
    }),

  /** Get a single learning path with full justification (for audit/print). */
  getJustification: protectedProcedure
    .input(z.object({ pathId: z.number() }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [row] = await db
        .select()
        .from(aiLearningPaths)
        .where(
          and(
            eq(aiLearningPaths.id, input.pathId),
            eq(aiLearningPaths.teacherId, ctx.user.id)
          )
        );

      if (!row) throw new TRPCError({ code: "NOT_FOUND" });

      return {
        ...row,
        steps: JSON.parse(row.recommendedPath || "[]"),
        lomloeRefs: JSON.parse(row.lomloeReferences || "[]"),
        evidence: JSON.parse(row.evidenceSummary || "{}"),
      };
    }),
});

// ── Combined router ───────────────────────────────────────────────────────────

export const accountabilityRouter = router({
  grades: gradeOverrideRouter,
  bias: biasFlagRouter,
  paths: learningPathRouter,
});
