import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";
import {
  savePracticeSession,
  getSessionsByUser,
  saveMaterial,
  getMaterialsByUser,
  getMaterialById,
  deleteMaterial,
  updateMaterial,
} from "../db";
import { COMPETENCY_META, getQuestions, type CompetencyCode, type YearGroup } from "../knowledge/lomloeKnowledgeBank";

const CompetencyCodeSchema = z.enum(["CCL", "CP", "STEM", "CD", "CPSAA", "CC", "CE", "CCEC"]);
const YearGroupSchema = z.enum(["junior", "primary", "secondary"]);
const MaterialTypeSchema = z.enum(["quiz", "slides", "crossword", "missing_words", "wordsearch", "flashcards"]);

// ─── System prompts for each activity type ────────────────────────────────────

function buildSystemPrompt(type: string, competency?: string, yearGroup?: string) {
  const compName = competency ? `${COMPETENCY_META[competency as CompetencyCode]?.name} (${competency})` : "all 8 LOMLOE competencies";
  const ygLabel = yearGroup === "junior" ? "Junior (Years 3–4)" : yearGroup === "primary" ? "Primary (Years 5–6)" : yearGroup === "secondary" ? "Secondary (Years 7–10)" : "all year groups";

  const base = `You are an expert Spanish curriculum designer aligned to LOMLOE standards. 
Competency context: ${compName}. Year group: ${ygLabel}.
All content must be appropriate, educational, and directly aligned to LOMLOE competency goals.
Respond ONLY with valid JSON matching the exact schema requested. No markdown, no explanation.`;

  const schemas: Record<string, string> = {
    quiz: `Generate a quiz with exactly 8 multiple-choice questions.
JSON schema: { "title": string, "questions": [{ "question": string, "options": [string, string, string, string], "correctIndex": number, "explanation": string }] }`,

    slides: `Generate a slide presentation with 6–8 slides.
JSON schema: { "title": string, "slides": [{ "slideNumber": number, "heading": string, "bullets": [string], "speakerNote": string, "imagePrompt": string }] }
imagePrompt should describe a relevant educational illustration (no photos).`,

    crossword: `Generate a crossword puzzle with exactly 8 words.
JSON schema: { "title": string, "words": [{ "word": string, "clue": string, "direction": "across"|"down", "row": number, "col": number }] }
Words must intersect properly. Use uppercase letters. Numbers start at 1.`,

    missing_words: `Generate a fill-in-the-blank passage with 8–10 blanks.
JSON schema: { "title": string, "passage": string, "blanks": [{ "position": number, "answer": string, "hint": string }] }
Use ___ (three underscores) for each blank in the passage. Number blanks sequentially.`,

    wordsearch: `Generate a word search with exactly 10 keywords related to the topic.
JSON schema: { "title": string, "words": [string], "gridSize": 12, "directions": ["horizontal","vertical","diagonal"] }
Words should be single words, uppercase, relevant to the topic and competency.`,

    flashcards: `Generate 10 flashcard pairs.
JSON schema: { "title": string, "cards": [{ "term": string, "definition": string, "competencyHint": string }] }`,
  };

  return `${base}\n\n${schemas[type] ?? ""}`;
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const materialsRouter = router({
  // ── Progress tracker ──────────────────────────────────────────────────────

  saveSession: protectedProcedure
    .input(z.object({
      competency: CompetencyCodeSchema.optional(),
      yearGroup: YearGroupSchema.optional(),
      score: z.number().min(0),
      total: z.number().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      await savePracticeSession({
        userId: ctx.user.id,
        competency: input.competency ?? null,
        yearGroup: input.yearGroup ?? null,
        score: input.score,
        total: input.total,
      });
      return { success: true };
    }),

  getMyProgress: protectedProcedure.query(async ({ ctx }) => {
    const sessions = await getSessionsByUser(ctx.user.id);
    // Aggregate by competency for the chart
    const byCompetency: Record<string, { sessions: number; totalScore: number; totalQ: number }> = {};
    for (const s of sessions) {
      const key = s.competency ?? "all";
      if (!byCompetency[key]) byCompetency[key] = { sessions: 0, totalScore: 0, totalQ: 0 };
      byCompetency[key].sessions++;
      byCompetency[key].totalScore += s.score;
      byCompetency[key].totalQ += s.total;
    }
    const chart = Object.entries(byCompetency).map(([code, d]) => ({
      code,
      name: code === "all" ? "All Competencies" : (COMPETENCY_META[code as CompetencyCode]?.name ?? code),
      avgPct: d.totalQ > 0 ? Math.round((d.totalScore / d.totalQ) * 100) : 0,
      sessions: d.sessions,
    }));
    return { sessions: sessions.slice(0, 20), chart };
  }),

  // ── Teaching materials ────────────────────────────────────────────────────

  create: protectedProcedure
    .input(z.object({
      type: MaterialTypeSchema,
      topic: z.string().min(2).max(200),
      competency: CompetencyCodeSchema.optional(),
      yearGroup: YearGroupSchema.optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const systemPrompt = buildSystemPrompt(input.type, input.competency, input.yearGroup);

      // Add relevant knowledge bank context
      const contextQs = getQuestions(
        input.competency as CompetencyCode | undefined,
        input.yearGroup as YearGroup | undefined
      ).slice(0, 8);
      const contextText = contextQs.length > 0
        ? `\n\nRelevant LOMLOE knowledge bank examples:\n${contextQs.map(q => `- ${q.question} → ${q.options[q.correctIndex]}`).join("\n")}`
        : "";

      const userPrompt = `Topic: "${input.topic}"${contextText}\n\nGenerate the ${input.type} activity now.`;

      const response = await invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      });

      const rawContent = String(response.choices?.[0]?.message?.content ?? "{}");

      // Parse and validate JSON
      let parsed: unknown;
      try {
        // Strip markdown code fences if present
        const cleaned = rawContent.replace(/^```json?\n?/, "").replace(/\n?```$/, "").trim();
        parsed = JSON.parse(cleaned);
      } catch {
        throw new Error("AI returned invalid JSON. Please try again.");
      }

      const title = (parsed as Record<string, unknown>)?.title as string ?? `${input.type} – ${input.topic}`;

      const id = await saveMaterial({
        userId: ctx.user.id,
        type: input.type,
        title,
        topic: input.topic,
        competency: input.competency ?? null,
        yearGroup: input.yearGroup ?? null,
        content: JSON.stringify(parsed),
      });

      return { id, title, content: parsed };
    }),

  list: protectedProcedure.query(async ({ ctx }) => {
    return getMaterialsByUser(ctx.user.id);
  }),

  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const row = await getMaterialById(input.id, ctx.user.id);
      if (!row) return null;
      return { ...row, content: JSON.parse(row.content) };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const ok = await deleteMaterial(input.id, ctx.user.id);
      return { success: ok };
    }),

  update: protectedProcedure
    .input(z.object({ id: z.number(), content: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const ok = await updateMaterial(input.id, ctx.user.id, input.content);
      return { success: ok };
    }),
});
