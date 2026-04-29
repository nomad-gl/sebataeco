import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { customQuestionSets, customQuestions } from "../../drizzle/schema";
import { invokeLLM } from "../_core/llm";
import { TRPCError } from "@trpc/server";

const COMPETENCY_CODES = ["CCL", "CP", "STEM", "CD", "CPSAA", "CC", "CE", "CCEC"] as const;
const YEAR_GROUPS = ["infantil", "lower_primary", "junior", "primary", "secondary"] as const;

const QuestionInputSchema = z.object({
  question: z.string().min(5).max(1000),
  options: z.array(z.string().min(1).max(400)).length(4),
  correctIndex: z.number().int().min(0).max(3),
  explanation: z.string().min(5).max(2000),
  competency: z.enum(COMPETENCY_CODES).nullish(),
  yearGroup: z.enum(YEAR_GROUPS).nullish(),
});

/** AI-validate which LOMLOE competency a question best maps to */
async function detectCompetency(question: string): Promise<string | null> {
  try {
    const resp = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are a LOMLOE curriculum expert. Given a question, return ONLY the single most relevant LOMLOE competency code from: CCL, CP, STEM, CD, CPSAA, CC, CE, CCEC. Return only the code, nothing else.`,
        },
        { role: "user", content: question },
      ],
    });
    const code = (String(resp.choices[0]?.message?.content ?? "")).trim().toUpperCase();
    return COMPETENCY_CODES.includes(code as typeof COMPETENCY_CODES[number]) ? code : null;
  } catch {
    return null;
  }
}

export const customSetsRouter = router({
  /** List all custom question sets for the current user */
  listSets: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const sets = await db
      .select()
      .from(customQuestionSets)
      .where(eq(customQuestionSets.userId, ctx.user.id))
      .orderBy(desc(customQuestionSets.updatedAt));
    return sets;
  }),

  /** Get a single set with all its questions */
  getSet: protectedProcedure
    .input(z.object({ setId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const [set] = await db
        .select()
        .from(customQuestionSets)
        .where(and(eq(customQuestionSets.id, input.setId), eq(customQuestionSets.userId, ctx.user.id)));
      if (!set) throw new TRPCError({ code: "NOT_FOUND", message: "Set not found" });
      const questions = await db
        .select()
        .from(customQuestions)
        .where(and(eq(customQuestions.setId, input.setId), eq(customQuestions.userId, ctx.user.id)));
      return { ...set, questions };
    }),

  /** Create a new empty set */
  createSet: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(255),
        description: z.string().max(1000).optional(),
        competency: z.enum(COMPETENCY_CODES).nullish(),
        yearGroup: z.enum(YEAR_GROUPS).nullish(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const [result] = await db.insert(customQuestionSets).values({
        userId: ctx.user.id,
        name: input.name,
        description: input.description ?? null,
        competency: input.competency ?? null,
        yearGroup: input.yearGroup ?? null,
        questionCount: 0,
      });
      return { id: result.insertId };
    }),

  /** Update set metadata */
  updateSet: protectedProcedure
    .input(
      z.object({
        setId: z.number().int().positive(),
        name: z.string().min(1).max(255).optional(),
        description: z.string().max(1000).optional(),
        competency: z.enum(COMPETENCY_CODES).nullish(),
        yearGroup: z.enum(YEAR_GROUPS).nullish(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const [existing] = await db
        .select()
        .from(customQuestionSets)
        .where(and(eq(customQuestionSets.id, input.setId), eq(customQuestionSets.userId, ctx.user.id)));
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      await db
        .update(customQuestionSets)
        .set({
          name: input.name ?? existing.name,
          description: input.description !== undefined ? input.description : existing.description,
          competency: input.competency !== undefined ? input.competency ?? null : existing.competency,
          yearGroup: input.yearGroup !== undefined ? input.yearGroup ?? null : existing.yearGroup,
          updatedAt: new Date(),
        })
        .where(eq(customQuestionSets.id, input.setId));
      return { ok: true };
    }),

  /** Delete a set and all its questions */
  deleteSet: protectedProcedure
    .input(z.object({ setId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const [existing] = await db
        .select()
        .from(customQuestionSets)
        .where(and(eq(customQuestionSets.id, input.setId), eq(customQuestionSets.userId, ctx.user.id)));
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      await db.delete(customQuestions).where(eq(customQuestions.setId, input.setId));
      await db.delete(customQuestionSets).where(eq(customQuestionSets.id, input.setId));
      return { ok: true };
    }),

  /** Add a question to a set (with AI competency detection if not provided) */
  addQuestion: protectedProcedure
    .input(z.object({ setId: z.number().int().positive() }).merge(QuestionInputSchema))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const [set] = await db
        .select()
        .from(customQuestionSets)
        .where(and(eq(customQuestionSets.id, input.setId), eq(customQuestionSets.userId, ctx.user.id)));
      if (!set) throw new TRPCError({ code: "NOT_FOUND" });

      // Auto-detect competency if not provided
      const competency = input.competency ?? (await detectCompetency(input.question));

      const [result] = await db.insert(customQuestions).values({
        setId: input.setId,
        userId: ctx.user.id,
        question: input.question,
        options: JSON.stringify(input.options),
        correctIndex: input.correctIndex,
        explanation: input.explanation,
        competency: competency ?? null,
        yearGroup: input.yearGroup ?? null,
        sortOrder: set.questionCount,
      });

      // Update cached count
      await db
        .update(customQuestionSets)
        .set({ questionCount: set.questionCount + 1, updatedAt: new Date() })
        .where(eq(customQuestionSets.id, input.setId));

      return { id: result.insertId, competency };
    }),

  /** Update an existing question */
  updateQuestion: protectedProcedure
    .input(z.object({ questionId: z.number().int().positive() }).merge(QuestionInputSchema.partial()))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const [existing] = await db
        .select()
        .from(customQuestions)
        .where(and(eq(customQuestions.id, input.questionId), eq(customQuestions.userId, ctx.user.id)));
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

      await db
        .update(customQuestions)
        .set({
          question: input.question ?? existing.question,
          options: input.options ? JSON.stringify(input.options) : existing.options,
          correctIndex: input.correctIndex ?? existing.correctIndex,
          explanation: input.explanation ?? existing.explanation,
          competency: input.competency !== undefined ? input.competency ?? null : existing.competency,
          yearGroup: input.yearGroup !== undefined ? input.yearGroup ?? null : existing.yearGroup,
          updatedAt: new Date(),
        })
        .where(eq(customQuestions.id, input.questionId));
      return { ok: true };
    }),

  /** Delete a question from a set */
  deleteQuestion: protectedProcedure
    .input(z.object({ questionId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const [existing] = await db
        .select()
        .from(customQuestions)
        .where(and(eq(customQuestions.id, input.questionId), eq(customQuestions.userId, ctx.user.id)));
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

      await db.delete(customQuestions).where(eq(customQuestions.id, input.questionId));

      // Decrement cached count
      const [set] = await db
        .select()
        .from(customQuestionSets)
        .where(eq(customQuestionSets.id, existing.setId));
      if (set) {
        await db
          .update(customQuestionSets)
          .set({ questionCount: Math.max(0, set.questionCount - 1), updatedAt: new Date() })
          .where(eq(customQuestionSets.id, existing.setId));
      }
      return { ok: true };
    }),

  /** Get a random question from a custom set for practice (excludes already-seen IDs) */
  getCustomQuestion: protectedProcedure
    .input(
      z.object({
        setId: z.number().int().positive(),
        excludeIds: z.array(z.number().int()).default([]),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const [set] = await db
        .select()
        .from(customQuestionSets)
        .where(and(eq(customQuestionSets.id, input.setId), eq(customQuestionSets.userId, ctx.user.id)));
      if (!set) throw new TRPCError({ code: "NOT_FOUND" });

      const all = await db
        .select()
        .from(customQuestions)
        .where(and(eq(customQuestions.setId, input.setId), eq(customQuestions.userId, ctx.user.id)));

      const pool = all.filter((q) => !input.excludeIds.includes(q.id));
      if (pool.length === 0) return null;
      const q = pool[Math.floor(Math.random() * pool.length)];
      return {
        id: q.id,
        question: q.question,
        options: JSON.parse(q.options) as string[],
        correctIndex: q.correctIndex,
        explanation: q.explanation,
        competency: q.competency,
        yearGroup: q.yearGroup,
      };
    }),

  /** AI-generate questions for a custom set based on a topic */
  generateQuestions: protectedProcedure
    .input(
      z.object({
        setId: z.number().int().positive(),
        topic: z.string().min(3).max(500),
        yearGroup: z.enum(YEAR_GROUPS),
        count: z.number().int().min(1).max(20).default(5),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const [set] = await db
        .select()
        .from(customQuestionSets)
        .where(and(eq(customQuestionSets.id, input.setId), eq(customQuestionSets.userId, ctx.user.id)));
      if (!set) throw new TRPCError({ code: "NOT_FOUND" });

      const yearDescs: Record<string, string> = {
        infantil: "children aged 3-6 (Educació Infantil). Use the simplest vocabulary, max 8-word sentences, concrete visible actions only.",
        lower_primary: "children aged 6-8 (Year 1-2). Use familiar words, max 12-word sentences, observable actions.",
        junior: "children aged 8-10 (Year 3-4). Use everyday + basic curriculum terms, max 18-word sentences.",
        primary: "students aged 10-12 (Year 5-6). Use curriculum-standard vocabulary, analytical questions.",
        secondary: "students aged 12-16 (ESO). Use full academic vocabulary, higher-order thinking questions.",
      };

      const prompt = `Generate exactly ${input.count} multiple-choice questions about "${input.topic}" for ${yearDescs[input.yearGroup]}.
Each question must have exactly 4 options and one correct answer.
Return a JSON array only, no markdown, no explanation outside JSON:
[{"question":"...","options":["A","B","C","D"],"correctIndex":0,"explanation":"...","competency":"CCL"}]
competency must be one of: CCL, CP, STEM, CD, CPSAA, CC, CE, CCEC`;

      const resp = await invokeLLM({
        messages: [
          { role: "system", content: "You are an expert LOMLOE curriculum designer. Return only valid JSON arrays." },
          { role: "user", content: prompt },
        ],
      });

      let raw = (String(resp.choices[0]?.message?.content ?? "")).trim();
      if (raw.startsWith("```")) raw = raw.replace(/^```[a-z]*\n?/, "").replace(/\n?```$/, "");

      let generated: Array<{
        question: string;
        options: string[];
        correctIndex: number;
        explanation: string;
        competency?: string;
      }>;
      try {
        generated = JSON.parse(raw);
      } catch {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "AI returned invalid JSON" });
      }

      let added = 0;
      for (const q of generated) {
        if (!q.question || !Array.isArray(q.options) || q.options.length !== 4) continue;
        const competency = COMPETENCY_CODES.includes(q.competency as typeof COMPETENCY_CODES[number])
          ? q.competency
          : null;
        await db.insert(customQuestions).values({
          setId: input.setId,
          userId: ctx.user.id,
          question: q.question,
          options: JSON.stringify(q.options),
          correctIndex: Math.min(3, Math.max(0, q.correctIndex ?? 0)),
          explanation: q.explanation ?? "",
          competency: competency ?? null,
          yearGroup: input.yearGroup,
          sortOrder: set.questionCount + added,
        });
        added++;
      }

      await db
        .update(customQuestionSets)
        .set({ questionCount: set.questionCount + added, updatedAt: new Date() })
        .where(eq(customQuestionSets.id, input.setId));

      return { added };
    }),
});
