import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import {
  getQuestions,
  getCoverageStats,
  COMPETENCY_META,
  LOMLOE_QUESTIONS,
  type CompetencyCode,
  type YearGroup,
} from "../knowledge/lomloeKnowledgeBank";
import { invokeLLM } from "../_core/llm";

const CompetencyCodeSchema = z.enum(["CCL", "CP", "STEM", "CD", "CPSAA", "CC", "CE", "CCEC"]);
const YearGroupSchema = z.enum(["junior", "primary", "secondary"]);

export const lomloeRouter = router({
  /** Get all competency metadata */
  getCompetencies: publicProcedure.query(() => {
    return Object.values(COMPETENCY_META);
  }),

  /** Get questions filtered by competency and/or year group */
  getQuestions: publicProcedure
    .input(
      z.object({
        competency: CompetencyCodeSchema.optional(),
        yearGroup: YearGroupSchema.optional(),
        limit: z.number().min(1).max(200).default(200),
        shuffle: z.boolean().default(false),
      })
    )
    .query(({ input }) => {
      let questions = getQuestions(
        input.competency as CompetencyCode | undefined,
        input.yearGroup as YearGroup | undefined
      );
      if (input.shuffle) {
        questions = [...questions].sort(() => Math.random() - 0.5);
      }
      return questions.slice(0, input.limit);
    }),

  /** Get a single random question for practice */
  getRandomQuestion: publicProcedure
    .input(
      z.object({
        competency: CompetencyCodeSchema.optional(),
        yearGroup: YearGroupSchema.optional(),
        excludeIds: z.array(z.string()).default([]),
      })
    )
    .query(({ input }) => {
      let pool = getQuestions(
        input.competency as CompetencyCode | undefined,
        input.yearGroup as YearGroup | undefined
      );
      if (input.excludeIds.length > 0) {
        pool = pool.filter((q) => !input.excludeIds.includes(q.id));
      }
      if (pool.length === 0) return null;
      return pool[Math.floor(Math.random() * pool.length)];
    }),

  /** Get knowledge bank coverage statistics */
  getStats: publicProcedure.query(() => {
    const stats = getCoverageStats();
    const total = LOMLOE_QUESTIONS.length;
    const competencies = Object.keys(COMPETENCY_META).length;
    const yearGroups = ["junior", "primary", "secondary"];

    const breakdown = Object.entries(stats).map(([code, yearData]) => ({
      code,
      name: COMPETENCY_META[code as CompetencyCode]?.name ?? code,
      emoji: COMPETENCY_META[code as CompetencyCode]?.emoji ?? "",
      total: Object.values(yearData).reduce((a, b) => a + b, 0),
      junior: yearData["junior"] ?? 0,
      primary: yearData["primary"] ?? 0,
      secondary: yearData["secondary"] ?? 0,
    }));

    return {
      totalQuestions: total,
      totalCompetencies: competencies,
      totalYearGroups: yearGroups.length,
      breakdown,
    };
  }),

  /** AI chat with LOMLOE knowledge bank context */
  chat: publicProcedure
    .input(
      z.object({
        messages: z.array(
          z.object({
            role: z.enum(["user", "assistant"]),
            content: z.string(),
          })
        ),
        competency: CompetencyCodeSchema.optional(),
        yearGroup: YearGroupSchema.optional(),
      })
    )
    .mutation(async ({ input }) => {
      // Build context from relevant questions
      const contextQuestions = getQuestions(
        input.competency as CompetencyCode | undefined,
        input.yearGroup as YearGroup | undefined
      ).slice(0, 20);

      const contextText = contextQuestions
        .map(
          (q) =>
            `Q: ${q.question}\nCorrect Answer: ${q.options[q.correctIndex]}\nOther options: ${q.options
              .filter((_, i) => i !== q.correctIndex)
              .join(", ")}`
        )
        .join("\n\n");

      const competencyContext = input.competency
        ? `Focus competency: ${COMPETENCY_META[input.competency as CompetencyCode]?.name} (${input.competency})`
        : "All 8 LOMLOE competencies";

      const yearGroupContext = input.yearGroup
        ? `Year group: ${input.yearGroup === "junior" ? "Junior (Years 3–4)" : input.yearGroup === "primary" ? "Primary (Years 5–6)" : "Secondary (Years 7–10)"}`
        : "All year groups";

      const systemPrompt = `You are Clara, a warm, encouraging, and deeply knowledgeable teaching assistant specialised in Spain's LOMLOE curriculum. You exist to support teachers — not students — with expert guidance, practical ideas, and genuine enthusiasm for education.

Your personality:
- You are warm, approachable, and genuinely excited about teaching and learning.
- You speak to teachers as trusted colleagues: professional, respectful, and never condescending.
- You celebrate teachers' efforts and acknowledge the real challenges of the classroom.
- You are encouraging and constructive — when a teacher is unsure, you reassure them and guide them forward with confidence.
- You use a conversational, human tone. Avoid jargon unless the teacher uses it first.
- You are concise but never curt. Every response should feel helpful, not rushed.

Your expertise:
- You have deep knowledge of Spain's LOMLOE curriculum and all 8 key competencies:
  CCL (Linguistic Communication), CP (Multilingual Competence), STEM (Mathematics & STEM),
  CD (Digital Competence), CPSAA (Personal, Social & Learning to Learn),
  CC (Civic Competence), CE (Entrepreneurial Competence), CCEC (Cultural Awareness & Expression).
- You can suggest lesson plans, activities, assessment ideas, differentiation strategies, and cross-curricular links.
- You understand the realities of Spanish classrooms: mixed abilities, time pressures, and curriculum demands.

Current context: ${competencyContext} | ${yearGroupContext}

Relevant curriculum knowledge:
${contextText}

Guidelines:
1. Focus your responses on LOMLOE curriculum topics, teaching strategies, and classroom practice.
2. If a question falls outside your scope, gently redirect with a warm explanation and offer what help you can.
3. Always reference the relevant LOMLOE competency when discussing curriculum content.
4. When a teacher shares a challenge or frustration, acknowledge it empathetically before offering solutions.
5. End responses with an open invitation — e.g. "Would you like me to expand on any of this?" or "Let me know if you'd like a specific activity idea!" — to keep the conversation going.
6. Respond in the same language the teacher uses (Spanish, Catalan, or English).`;

      const llmMessages = [
        { role: "system" as const, content: systemPrompt },
        ...input.messages.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      ];

      const response = await invokeLLM({ messages: llmMessages });
      const content = response.choices?.[0]?.message?.content ?? "I'm sorry, I couldn't generate a response. Please try again.";

      return { content };
    }),

  translateMessages: publicProcedure
    .input(
      z.object({
        messages: z.array(
          z.object({
            role: z.enum(["user", "assistant"]),
            content: z.string(),
          })
        ),
        targetLang: z.enum(["en", "es", "ca"]),
      })
    )
    .mutation(async ({ input }) => {
      const langNames: Record<string, string> = {
        en: "English",
        es: "Spanish (Castilian)",
        ca: "Catalan",
      };
      const targetLangName = langNames[input.targetLang];

      // Translate each message individually, preserving markdown formatting
      const translated = await Promise.all(
        input.messages.map(async (msg) => {
          const response = await invokeLLM({
            messages: [
              {
                role: "system",
                content: `You are a professional translator. Translate the following text into ${targetLangName}. Preserve all markdown formatting, bullet points, headers, and structure exactly. Only translate the text content, do not add any explanation or preamble. Return only the translated text.`,
              },
              { role: "user", content: msg.content },
            ],
          });
          const translatedContent =
            response.choices?.[0]?.message?.content ?? msg.content;
          return { role: msg.role, content: translatedContent };
        })
      );

      return { messages: translated };
    }),
});
