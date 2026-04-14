import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { generateAndAppendQuestions } from "../questionGenerator";
import { notifyOwner } from "../_core/notification";
import {
  getQuestions,
  getCoverageStats,
  COMPETENCY_META,
  LOMLOE_QUESTIONS,
  type CompetencyCode,
  type YearGroup,
} from "../knowledge/lomloeKnowledgeBank";
import { invokeLLM } from "../_core/llm";
import { ainaTranslateBatch } from "../ainaTranslation";
import { getAinaProfile, upsertAinaProfile, rateMessage, getUserRatings, saveQuestionAnswer, getQuestionAnalytics, getPendingQuestions, reviewQuestion } from "../db";
import { getDb } from "../db";
import { generatedQuestions, questionTranslations } from "../../drizzle/schema";
import { eq, and, inArray } from "drizzle-orm";

const CompetencyCodeSchema = z.enum(["CCL", "CP", "STEM", "CD", "CPSAA", "CC", "CE", "CCEC"]);
const YearGroupSchema = z.enum(["junior", "primary", "secondary"]);

/**
 * Returns a copy of the question with its options shuffled into a random order
 * and correctIndex updated to match the new position of the correct answer.
 * This prevents students from noticing that the correct answer is almost always
 * at index 1 in the raw knowledge bank data.
 */
function shuffleQuestion<T extends { options: string[]; correctIndex: number }>(q: T): T {
  const correctAnswer = q.options[q.correctIndex];
  const shuffled = [...q.options].sort(() => Math.random() - 0.5);
  const newCorrectIndex = shuffled.indexOf(correctAnswer);
  return { ...q, options: shuffled, correctIndex: newCorrectIndex };
}

// ─── Profile update helper (runs async, never blocks the response) ────────────

/**
 * Extracts style signals from the latest user message + assistant response
 * and persists them to the aina_user_profiles table.
 * Called fire-and-forget after every chat turn.
 */
async function updateAinaProfile(
  userId: number,
  userMessage: string,
  assistantResponse: string,
  competency: string | undefined,
  yearGroup: string | undefined,
  langName: string
): Promise<void> {
  try {
    // Fetch current profile (may be null for first-time users)
    const current = await getAinaProfile(userId);

    const newCount = (current?.questionCount ?? 0) + 1;
    const wordCount = userMessage.trim().split(/\s+/).length;
    const prevAvg = current?.avgQuestionLength ?? 0;
    // Rolling average: weighted towards recent questions
    const newAvg = Math.round(prevAvg * 0.8 + wordCount * 0.2);

    // Update competency frequency map
    const freqMap: Record<string, number> = JSON.parse(current?.competencyFrequency ?? "{}");
    if (competency) {
      freqMap[competency] = (freqMap[competency] ?? 0) + 1;
    }

    // Update year group preference list (keep top 3 most frequent)
    const ygMap: Record<string, number> = {};
    const existingYgs: string[] = JSON.parse(current?.preferredYearGroups ?? "[]");
    existingYgs.forEach((yg) => { ygMap[yg] = (ygMap[yg] ?? 0) + 1; });
    if (yearGroup) {
      ygMap[yearGroup] = (ygMap[yearGroup] ?? 0) + 1;
    }
    const topYgs = Object.entries(ygMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([yg]) => yg);

    // Use LLM to extract style signals and topic keywords from this turn
    const profileUpdateResponse = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are an AI that analyses teacher–assistant conversations to build a learning profile. 
Analyse the teacher's message and extract:
1. communicationStyle: one of "concise" | "detailed" | "conversational" | "formal" based on sentence length, vocabulary, and tone
2. responseDepthPreference: one of "brief" | "moderate" | "thorough" based on how specific and detailed the question is
3. topicKeywords: up to 5 short keywords (1-3 words each) representing the teaching topics in this message
4. teachingContextSummary: a 1-2 sentence plain-text summary of what this teacher seems to focus on and care about, written in ${langName}

Respond ONLY in ${langName}. Return JSON only.`,
        },
        {
          role: "user",
          content: `Teacher's message: "${userMessage}"\n\nAssistant's response (for context): "${assistantResponse.slice(0, 400)}"`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "profile_signals",
          strict: true,
          schema: {
            type: "object",
            properties: {
              communicationStyle: { type: "string" },
              responseDepthPreference: { type: "string" },
              topicKeywords: { type: "array", items: { type: "string" } },
              teachingContextSummary: { type: "string" },
            },
            required: ["communicationStyle", "responseDepthPreference", "topicKeywords", "teachingContextSummary"],
            additionalProperties: false,
          },
        },
      },
    });

    const raw = profileUpdateResponse.choices?.[0]?.message?.content ?? "{}";
    const signals = JSON.parse(typeof raw === "string" ? raw : JSON.stringify(raw));

    // Merge new topic keywords with existing ones, keeping the top 20 most recent
    const existingKeywords: string[] = JSON.parse(current?.topicKeywords ?? "[]");
    const newKeywords = Array.isArray(signals.topicKeywords) ? signals.topicKeywords : [];
    const mergedKeywords = Array.from(new Set([...newKeywords, ...existingKeywords])).slice(0, 20);

    // Only update context summary every 3 turns to avoid thrashing
    const shouldUpdateSummary = newCount % 3 === 0 || !current?.teachingContextSummary;

    await upsertAinaProfile(userId, {
      questionCount: newCount,
      avgQuestionLength: newAvg,
      competencyFrequency: JSON.stringify(freqMap),
      topicKeywords: JSON.stringify(mergedKeywords),
      communicationStyle: signals.communicationStyle ?? current?.communicationStyle ?? "conversational",
      responseDepthPreference: signals.responseDepthPreference ?? current?.responseDepthPreference ?? "moderate",
      preferredYearGroups: JSON.stringify(topYgs),
      teachingContextSummary: shouldUpdateSummary
        ? (signals.teachingContextSummary ?? current?.teachingContextSummary ?? null)
        : current?.teachingContextSummary ?? null,
    });
  } catch (err) {
    // Profile updates are non-critical — log but never throw
    console.error("[Aina] Profile update failed:", err);
  }
}

// ─── Build the adaptive context block from a user's profile ──────────────────

function buildAdaptiveContext(
  profile: Awaited<ReturnType<typeof getAinaProfile>>,
  ratings?: Awaited<ReturnType<typeof getUserRatings>>
): string {
  if (!profile || profile.questionCount < 2) return "";

  const styleMap: Record<string, string> = {
    concise: "This teacher prefers short, direct answers. Be efficient and avoid padding.",
    detailed: "This teacher enjoys detailed explanations. Feel free to elaborate with examples.",
    conversational: "This teacher has a conversational style. Match their friendly, informal tone.",
    formal: "This teacher uses formal language. Mirror their professional register.",
  };

  const depthMap: Record<string, string> = {
    brief: "Keep responses brief and to the point.",
    moderate: "Provide balanced responses — not too short, not overwhelming.",
    thorough: "This teacher appreciates thorough, comprehensive answers with examples and practical steps.",
  };

  const freqMap: Record<string, number> = JSON.parse(profile.competencyFrequency ?? "{}");
  const topCompetencies = Object.entries(freqMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([code]) => code);

  const keywords: string[] = JSON.parse(profile.topicKeywords ?? "[]");
  const yearGroups: string[] = JSON.parse(profile.preferredYearGroups ?? "[]");

  const lines: string[] = [
    `\n--- Adaptive Teacher Profile (${profile.questionCount} interactions) ---`,
    styleMap[profile.communicationStyle] ?? "",
    depthMap[profile.responseDepthPreference] ?? "",
  ];

  if (topCompetencies.length > 0) {
    lines.push(`This teacher most frequently asks about: ${topCompetencies.join(", ")}.`);
  }
  if (yearGroups.length > 0) {
    lines.push(`Preferred year groups: ${yearGroups.join(", ")}.`);
  }
  if (keywords.length > 0) {
    lines.push(`Recurring topics of interest: ${keywords.slice(0, 8).join(", ")}.`);
  }
  if (profile.teachingContextSummary) {
    lines.push(`Teaching context: ${profile.teachingContextSummary}`);
  }
  // Incorporate rating quality signals
  if (ratings && ratings.length > 0) {
    const upCount = ratings.filter((r) => r.rating === "up").length;
    const downCount = ratings.filter((r) => r.rating === "down").length;
    const total = upCount + downCount;
    if (total > 0) {
      const pct = Math.round((upCount / total) * 100);
      if (pct >= 80) {
        lines.push(`Quality signal: This teacher has found ${pct}% of your recent responses helpful. Keep the same style and depth.`);
      } else if (pct <= 40) {
        lines.push(`Quality signal: Only ${pct}% of your recent responses were rated helpful. Try adjusting your approach — consider being more practical, concrete, and directly relevant to classroom teaching.`);
      }
      // Surface topics from down-rated messages so Aina can improve on them
      const downRated = ratings.filter((r) => r.rating === "down" && r.userQuestion);
      if (downRated.length > 0) {
        const topics = downRated.slice(0, 3).map((r) => r.userQuestion?.slice(0, 60)).filter(Boolean);
        if (topics.length > 0) {
          lines.push(`Topics where previous responses were not helpful (improve on these): ${topics.join(" | ")}`);
        }
      }
    }
  }

  lines.push("--- End of profile ---");

  return lines.filter(Boolean).join("\n");
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const lomloeRouter = router({
  /** Get all competency metadata */
  getCompetencies: publicProcedure.query(() => {
    return Object.values(COMPETENCY_META);
  }),

  /** Get questions filtered by competency and/or year group — includes approved DB-generated questions */
  getQuestions: publicProcedure
    .input(
      z.object({
        competency: CompetencyCodeSchema.nullish(),
        yearGroup: YearGroupSchema.nullish(),
        limit: z.number().min(1).max(500).default(500),
        shuffle: z.boolean().default(false),
        /** UI locale — when 'es' or 'ca', translated text is returned if available */
        locale: z.enum(["en", "es", "ca"]).default("ca"),
      })
    )
    .query(async ({ input, ctx }) => {
      // 1. Static knowledge bank questions
      let staticQs = getQuestions(
        input.competency as CompetencyCode | undefined,
        input.yearGroup as YearGroup | undefined
      );

      // 2. Approved DB-generated questions
      const db = await getDb();
      let dbQs: typeof staticQs = [];
      if (db) {
        try {
          const conditions = [eq(generatedQuestions.status, "approved")];
          if (input.competency) conditions.push(eq(generatedQuestions.competency, input.competency));
          if (input.yearGroup) conditions.push(eq(generatedQuestions.yearGroup, input.yearGroup));
          const rows = await db
            .select()
            .from(generatedQuestions)
            .where(conditions.length === 1 ? conditions[0] : and(...conditions));
          dbQs = rows.map((r) => ({
            id: r.questionId,
            competency: r.competency as CompetencyCode,
            yearGroup: r.yearGroup as YearGroup,
            question: r.question,
            options: JSON.parse(r.options) as string[],
            correctIndex: r.correctIndex,
            explanation: r.explanation,
          }));
        } catch (err) {
          console.error("[getQuestions] DB merge error:", err);
        }
      }

      let questions = [...staticQs, ...dbQs];

      // 3. If locale is ES or CA, overlay translations where available
      if (input.locale !== "en" && db) {
        try {
          const allIds = questions.map((q) => q.id);
          if (allIds.length > 0) {
            const translations = await db
              .select()
              .from(questionTranslations)
              .where(
                and(
                  eq(questionTranslations.locale, input.locale),
                  inArray(questionTranslations.questionId, allIds)
                )
              );
            const translationMap = new Map(
              translations.map((t) => [t.questionId, t])
            );
            questions = questions.map((q) => {
              const tr = translationMap.get(q.id);
              if (!tr) return q;
              return {
                ...q,
                question: tr.question,
                options: JSON.parse(tr.options) as string[],
                explanation: tr.explanation,
              };
            });
          }
        } catch (err) {
          console.error("[getQuestions] Translation merge error:", err);
        }
      }

      if (input.shuffle) {
        questions = questions.sort(() => Math.random() - 0.5);
      }
      // Always shuffle options within each question so the correct answer
      // is not predictably at the same position across all questions.
      return questions.slice(0, input.limit).map(shuffleQuestion);
    }),

  /** Get a single random question for practice — includes approved DB-generated questions */
  getRandomQuestion: publicProcedure
    .input(
      z.object({
        competency: CompetencyCodeSchema.nullish(),
        yearGroup: YearGroupSchema.nullish(),
        excludeIds: z.array(z.string()).default([]),
        /** UI locale — when 'es' or 'ca', translated text is returned if available */
        locale: z.enum(["en", "es", "ca"]).default("ca"),
      })
    )
    .query(async ({ input }) => {
      // 1. Static pool
      let pool = getQuestions(
        input.competency as CompetencyCode | undefined,
        input.yearGroup as YearGroup | undefined
      );

      // 2. Merge approved DB questions
      const db = await getDb();
      if (db) {
        try {
          const conditions = [eq(generatedQuestions.status, "approved")];
          if (input.competency) conditions.push(eq(generatedQuestions.competency, input.competency));
          if (input.yearGroup) conditions.push(eq(generatedQuestions.yearGroup, input.yearGroup));
          const rows = await db
            .select()
            .from(generatedQuestions)
            .where(conditions.length === 1 ? conditions[0] : and(...conditions));
          const dbQs = rows.map((r) => ({
            id: r.questionId,
            competency: r.competency as CompetencyCode,
            yearGroup: r.yearGroup as YearGroup,
            question: r.question,
            options: JSON.parse(r.options) as string[],
            correctIndex: r.correctIndex,
            explanation: r.explanation,
          }));
          pool = [...pool, ...dbQs];
        } catch (err) {
          console.error("[getRandomQuestion] DB merge error:", err);
        }
      }

      if (input.excludeIds.length > 0) {
        pool = pool.filter((q) => !input.excludeIds.includes(q.id));
      }
      if (pool.length === 0) return null;

      const q = pool[Math.floor(Math.random() * pool.length)];

      // 3. Apply translation overlay if locale is ES or CA
      if (input.locale !== "en" && db) {
        try {
          const [tr] = await db
            .select()
            .from(questionTranslations)
            .where(
              and(
                eq(questionTranslations.locale, input.locale),
                eq(questionTranslations.questionId, q.id)
              )
            );
          if (tr) {
            const translatedQ = {
              ...q,
              question: tr.question,
              options: JSON.parse(tr.options) as string[],
              explanation: tr.explanation,
            };
            return shuffleQuestion(translatedQ);
          }

          // No cached translation — translate on-the-fly via Aina and cache the result
          const textsToTranslate = [q.question, ...q.options, q.explanation];
          const translated = await ainaTranslateBatch(textsToTranslate, input.locale, 1);
          if (translated.length === 6) {
            const translatedQuestion = translated[0];
            const translatedOptions = translated.slice(1, 5);
            const translatedExplanation = translated[5];
            // Cache in DB for future requests (fire-and-forget)
            db.insert(questionTranslations).values({
              questionId: q.id,
              locale: input.locale,
              question: translatedQuestion,
              options: JSON.stringify(translatedOptions),
              explanation: translatedExplanation,
            }).catch((e: Error) => console.warn("[getRandomQuestion] Cache insert skipped:", e.message));
            const translatedQ = {
              ...q,
              question: translatedQuestion,
              options: translatedOptions,
              explanation: translatedExplanation,
            };
            return shuffleQuestion(translatedQ);
          }
        } catch (err) {
          console.error("[getRandomQuestion] Translation lookup error:", err);
        }
      }

      return shuffleQuestion(q);
    }),

  /** Get knowledge bank coverage statistics — includes approved DB-generated questions */
  getStats: publicProcedure.query(async () => {
    const stats = getCoverageStats();
    let total = LOMLOE_QUESTIONS.length;
    const competencies = Object.keys(COMPETENCY_META).length;
    const yearGroups = ["junior", "primary", "secondary"];

    // Merge DB approved counts into breakdown
    const dbCounts: Record<string, Record<string, number>> = {};
    const db = await getDb();
    if (db) {
      try {
        const rows = await db
          .select()
          .from(generatedQuestions)
          .where(eq(generatedQuestions.status, "approved"));
        for (const r of rows) {
          if (!dbCounts[r.competency]) dbCounts[r.competency] = {};
          dbCounts[r.competency][r.yearGroup] = (dbCounts[r.competency][r.yearGroup] ?? 0) + 1;
          total++;
        }
      } catch {}
    }

    const breakdown = Object.entries(stats).map(([code, yearData]) => ({
      code,
      name: COMPETENCY_META[code as CompetencyCode]?.name ?? code,
      emoji: COMPETENCY_META[code as CompetencyCode]?.emoji ?? "",
      total: Object.values(yearData).reduce((a, b) => a + b, 0) + Object.values(dbCounts[code] ?? {}).reduce((a, b) => a + b, 0),
      junior: (yearData["junior"] ?? 0) + (dbCounts[code]?.["junior"] ?? 0),
      primary: (yearData["primary"] ?? 0) + (dbCounts[code]?.["primary"] ?? 0),
      secondary: (yearData["secondary"] ?? 0) + (dbCounts[code]?.["secondary"] ?? 0),
    }));

    return {
      totalQuestions: total,
      totalCompetencies: competencies,
      totalYearGroups: yearGroups.length,
      breakdown,
    };
  }),

  /** AI chat with LOMLOE knowledge bank context + adaptive user profile */
  chat: publicProcedure
    .input(
      z.object({
        messages: z.array(
          z.object({
            role: z.enum(["user", "assistant"]),
            content: z.string(),
          })
        ),
        competency: CompetencyCodeSchema.nullish(),
        yearGroup: YearGroupSchema.nullish(),
        /** Active UI language — Aina must always respond in this language */
        uiLang: z.enum(["en", "es", "ca"]).nullish(),
        /** Catalan dialect variant — only relevant when uiLang is 'ca' */
        caDialect: z.enum(["central", "valencian", "balearic", "northern", "alguerese", "standard"]).nullish(),
        /** Authenticated user ID — used to load/update the adaptive profile */
        userId: z.number().nullish(),
      })
    )
    .mutation(async ({ input }) => {
      // Load adaptive profile and recent ratings (non-blocking — null for anonymous/first-time users)
      const [profile, ratings] = input.userId
        ? await Promise.all([getAinaProfile(input.userId), getUserRatings(input.userId, 20)])
        : [null, []];
      const adaptiveContext = buildAdaptiveContext(profile, ratings);

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
        ? `Year group: ${input.yearGroup === "junior" ? "Primary (Years 3–4)" : input.yearGroup === "primary" ? "Upper Primary (Years 5–6)" : "Secondary (Years 7–10)"}`
        : "All year groups";

      const dialectNote = input.uiLang === "ca" && input.caDialect && input.caDialect !== "central" && input.caDialect !== "standard"
        ? ` (${{
            valencian: "Valencian dialect — use Valencian vocabulary: 'xiquet/a' for child, 'hui' for today, 'ahir' for yesterday, 'col·legi' for school, 'huit' for eight, 'eixir' for to go out. Use AVL norms.",
            balearic:  "Balearic dialect — use Balearic vocabulary: 'al·lot/a' for boy/girl, 'jo som' for I am, 'bon dia' greeting. Use IEC norms adapted for Balearic.",
            northern:  "Northern Catalan (Roussillonnais) — use 'bonjorn' as greeting, slightly French-influenced vocabulary. Keep formal IEC register.",
            alguerese: "Algherese Catalan — use archaic forms and 'bona jornada' greeting. Sardinian-influenced vocabulary.",
          }[input.caDialect] ?? ""})`
        : "";
      const langName =
        input.uiLang === "es" ? "Spanish (Castilian)" : input.uiLang === "ca" ? `Catalan${dialectNote}` : "English";

      const systemPrompt = `You are Aina, a warm, encouraging, and deeply knowledgeable teaching assistant specialised in Spain's LOMLOE curriculum (Ley Orgánica 3/2020). You exist to support teachers — not students — with expert guidance, practical ideas, and genuine enthusiasm for education.

## Your personality
- You are warm, approachable, and genuinely excited about teaching and learning.
- You speak to teachers as trusted colleagues: professional, respectful, and never condescending.
- You celebrate teachers' efforts and acknowledge the real challenges of the classroom.
- You are encouraging and constructive — when a teacher is unsure, you reassure them and guide them forward with confidence.
- You use a conversational, human tone. Avoid jargon unless the teacher uses it first.
- You are concise but never curt. Every response should feel helpful, not rushed.

## Your expertise
- You have deep knowledge of Spain's LOMLOE curriculum and all 8 key competencies:
  • **CCL** — Competencia en Comunicación Lingüística (Linguistic Communication)
  • **CP** — Competencia Plurilingüe (Multilingual Competence)
  • **STEM** — Competencia Matemática y en Ciencia, Tecnología e Ingeniería
  • **CD** — Competencia Digital
  • **CPSAA** — Competencia Personal, Social y de Aprender a Aprender
  • **CC** — Competencia Ciudadana (Civic Competence)
  • **CE** — Competencia Emprendedora (Entrepreneurial Competence)
  • **CCEC** — Competencia en Conciencia y Expresión Culturales
- You know the LOMLOE's key articles: Art. 1 (principles), Art. 17 (primary objectives), Art. 23 (secondary objectives), Art. 25 (evaluation), Real Decreto 157/2022 (primary curriculum), Real Decreto 217/2022 (secondary curriculum).
- You can suggest lesson plans, activities, assessment rubrics, differentiation strategies, and cross-curricular links.
- You understand the realities of Spanish classrooms: mixed abilities, time pressures, curriculum demands, and the transition from LOMCE to LOMLOE.
- You are familiar with the Situaciones de Aprendizaje (learning situations) methodology central to LOMLOE.

## Current context
${competencyContext} | ${yearGroupContext}

## Relevant curriculum knowledge
${contextText}
${adaptiveContext}

## Response format guidelines
Structure your responses clearly. Use these patterns depending on the question type:

**For curriculum questions:**
→ Start with a direct answer (1–2 sentences).
→ Cite the relevant competency tag in bold, e.g. **[CCL]** or **[STEM + CD]**.
→ Give 2–4 concrete, classroom-ready examples or steps.
→ If relevant, cite the LOMLOE article or Real Decreto (e.g. *RD 217/2022, Anexo I*).
→ Close with an open invitation to continue.

**For lesson planning / activity requests:**
→ Provide a brief structured outline: Objective → Key competencies → Activity steps → Assessment idea.
→ Keep it practical and immediately usable.
→ Mention the Situación de Aprendizaje framework if appropriate.

**For emotional support / venting:**
→ Acknowledge the feeling first (1–2 sentences of genuine empathy).
→ Then offer one practical, realistic suggestion.
→ Keep it short and human.

**For factual / quick questions:**
→ Answer directly and concisely. No need for headers or lists.

## Core guidelines
1. Focus on LOMLOE curriculum topics, teaching strategies, and classroom practice.
2. If a question falls outside your scope, gently redirect with a warm explanation and offer what help you can.
3. Always tag the relevant LOMLOE competency code(s) in bold brackets, e.g. **[CCL]**, **[STEM]**, when discussing curriculum content — this helps teachers quickly see the curricular alignment.
4. When citing LOMLOE legislation, use the format: *Ley Orgánica 3/2020* or *RD 217/2022, Art. X*.
5. When a teacher shares a challenge or frustration, acknowledge it empathetically before offering solutions.
6. End responses with an open invitation — e.g. "Would you like me to expand on any of this?" or "Let me know if you'd like a specific activity idea!" — to keep the conversation going.
7. **Adaptive behaviour:** Use the teacher profile above (if present) to calibrate your tone, response length, and examples. A teacher who prefers brief answers should get shorter responses; one who prefers thorough answers should get more detail and structured formatting.
8. **Language rule:** Always respond in the language specified below, regardless of what language the teacher's question appears to be in. Translate competency names and LOMLOE terminology appropriately for the target language.
   Respond in: ${langName}.`;

      const llmMessages = [
        { role: "system" as const, content: systemPrompt },
        ...input.messages.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      ];

      const response = await invokeLLM({ messages: llmMessages });
      const rawContent = response.choices?.[0]?.message?.content ?? "I'm sorry, I couldn't generate a response. Please try again.";
      const content = typeof rawContent === "string" ? rawContent : "I'm sorry, I couldn't generate a response. Please try again.";

      // Generate 2–3 contextual follow-on question chips
      let followUpQuestions: string[] = [];
      try {
        const followUpResponse = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `You are a helpful assistant that generates short follow-on questions for a teacher using a LOMLOE curriculum assistant. Based on the conversation, suggest 2 or 3 short, natural follow-on questions the teacher might want to ask next. Each question should be concise (max 10 words), practical, and directly related to the last exchange. Respond ONLY in ${langName}. Return a JSON array of strings, nothing else.`,
            },
            ...llmMessages.slice(1), // conversation without system prompt
            { role: "assistant" as const, content },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "follow_up_questions",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  questions: {
                    type: "array",
                    items: { type: "string" },
                    description: "2 or 3 short follow-on questions",
                  },
                },
                required: ["questions"],
                additionalProperties: false,
              },
            },
          },
        });
        const raw = followUpResponse.choices?.[0]?.message?.content ?? "{}";
        const parsed = JSON.parse(typeof raw === "string" ? raw : JSON.stringify(raw));
        followUpQuestions = Array.isArray(parsed.questions) ? parsed.questions.slice(0, 3) : [];
      } catch {
        followUpQuestions = [];
      }

      // Fire-and-forget profile update (never blocks the response)
      if (input.userId) {
        const lastUserMsg = [...input.messages].reverse().find((m) => m.role === "user");
        if (lastUserMsg) {
          updateAinaProfile(
            input.userId,
            lastUserMsg.content,
            content,
            input.competency ?? undefined,
            input.yearGroup ?? undefined,
            langName
          ).catch(() => {/* silently ignore */});
        }
      }

      return { content, followUpQuestions };
    }),

  /** Get the Aina learning profile for the current user */
  getAinaProfile: protectedProcedure.query(async ({ ctx }) => {
    const profile = await getAinaProfile(ctx.user.id);
    if (!profile) return null;
    return {
      questionCount: profile.questionCount,
      communicationStyle: profile.communicationStyle,
      responseDepthPreference: profile.responseDepthPreference,
      topicKeywords: JSON.parse(profile.topicKeywords ?? "[]") as string[],
      preferredYearGroups: JSON.parse(profile.preferredYearGroups ?? "[]") as string[],
      topCompetencies: Object.entries(
        JSON.parse(profile.competencyFrequency ?? "{}") as Record<string, number>
      )
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([code]) => code),
      teachingContextSummary: profile.teachingContextSummary ?? null,
      lastUpdated: profile.lastUpdated,
    };
  }),

  /** Rate a Aina assistant message thumbs-up or thumbs-down */
  rateMessage: protectedProcedure
    .input(
      z.object({
        messageId: z.string().min(1).max(64),
        rating: z.enum(["up", "down"]),
        messageSnippet: z.string().max(500).nullish(),
        userQuestion: z.string().max(500).nullish(),
        reportReason: z.enum(["wrong_info", "not_relevant", "too_long", "too_short", "other"]).nullish(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await rateMessage({
        userId: ctx.user.id,
        messageId: input.messageId,
        rating: input.rating,
        messageSnippet: input.messageSnippet ?? undefined,
        userQuestion: input.userQuestion ?? undefined,
        reportReason: input.reportReason ?? undefined,
      });
      return { ok: true };
    }),

  /** Get a summary of the current user's Aina ratings */
  getAinaRatingSummary: protectedProcedure.query(async ({ ctx }) => {
    const ratings = await getUserRatings(ctx.user.id, 100);
    const upCount = ratings.filter((r) => r.rating === "up").length;
    const downCount = ratings.filter((r) => r.rating === "down").length;
    const total = upCount + downCount;
    const pctHelpful = total > 0 ? Math.round((upCount / total) * 100) : null;
    return { upCount, downCount, total, pctHelpful };
  }),

  /** Reset the Aina adaptive learning profile for the current user */
  resetAinaProfile: protectedProcedure.mutation(async ({ ctx }) => {
    await upsertAinaProfile(ctx.user.id, {
      questionCount: 0,
      avgQuestionLength: 0,
      competencyFrequency: "{}",
      preferredYearGroups: "[]",
      topicKeywords: "[]",
      responseDepthPreference: "moderate",
      communicationStyle: "conversational",
      teachingContextSummary: undefined,
    });
    return { ok: true };
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
    const raw = response.choices?.[0]?.message?.content ?? msg.content;
          const translatedContent = typeof raw === "string" ? raw : msg.content;
          return { role: msg.role, content: translatedContent };
        })
      );

      return { messages: translated };
    }),

  /** Record a single question answer attempt for analytics (fire-and-forget) */
  saveAnswer: publicProcedure
    .input(
      z.object({
        questionId: z.string(),
        competency: z.string(),
        yearGroup: z.string(),
        isCorrect: z.boolean(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await saveQuestionAnswer({
        questionId: input.questionId,
        competency: input.competency,
        yearGroup: input.yearGroup,
        isCorrect: input.isCorrect,
        userId: ctx.user?.id ?? null,
      });
      return { ok: true };
    }),

  /** Admin: per-question analytics sorted by hardest first */
  getQuestionAnalytics: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin") {
      throw new (await import("@trpc/server")).TRPCError({ code: "FORBIDDEN" });
    }
    return getQuestionAnalytics(100);
  }),

  /** Admin: get all questions pending review */
  getQuestionsForReview: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin") {
      throw new (await import("@trpc/server")).TRPCError({ code: "FORBIDDEN" });
    }
    const db = await getDb();
    if (!db) return [];
    const rows = await db
      .select()
      .from(generatedQuestions)
      .where(eq(generatedQuestions.status, "pending"))
      .orderBy(generatedQuestions.createdAt);
    return rows.map((r) => ({
      ...r,
      options: JSON.parse(r.options) as string[],
    }));
  }),

  /** Admin: approve or reject a generated question */
  reviewGeneratedQuestion: protectedProcedure
    .input(
      z.object({
        questionId: z.string(),
        status: z.enum(["approved", "rejected"]),
        notes: z.string().nullish(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new (await import("@trpc/server")).TRPCError({ code: "FORBIDDEN" });
      }
      const db = await getDb();
      if (!db) throw new Error("DB not available");
      await db
        .update(generatedQuestions)
        .set({
          status: input.status,
          reviewedBy: ctx.user.id,
          notes: input.notes ?? null,
          reviewedAt: new Date(),
        })
        .where(eq(generatedQuestions.questionId, input.questionId));
      return { ok: true };
    }),

  /**
   * Batch-translate questions into ES or CA and store in question_translations.
   * Translates up to `batchSize` untranslated questions per call.
   * Can be called repeatedly until all questions are translated.
   */
  translateQuestions: protectedProcedure
    .input(
      z.object({
        locale: z.enum(["es", "ca"]),
        batchSize: z.number().min(1).max(50).default(20),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new (await import("@trpc/server")).TRPCError({ code: "FORBIDDEN" });
      }
      const db = await getDb();
      if (!db) throw new (await import("@trpc/server")).TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      // Get all static question IDs
      const allStaticQs = getQuestions();
      const allIds = allStaticQs.map((q) => q.id);

      // Find which IDs already have a translation for this locale
      const existing = await db
        .select({ questionId: questionTranslations.questionId })
        .from(questionTranslations)
        .where(eq(questionTranslations.locale, input.locale));
      const existingIds = new Set(existing.map((r) => r.questionId));

      // Pick untranslated questions up to batchSize
      const toTranslate = allStaticQs
        .filter((q) => !existingIds.has(q.id))
        .slice(0, input.batchSize);

      if (toTranslate.length === 0) {
        return { translated: 0, remaining: 0, message: "All questions already translated" };
      }

      const localeName = input.locale === "es" ? "Spanish" : "Catalan";

      // Build flat list of all strings to translate per question:
      // [question, opt0, opt1, opt2, opt3, explanation]  × N questions
      const allTexts: string[] = [];
      for (const q of toTranslate) {
        allTexts.push(q.question, ...q.options, q.explanation);
      }

      // Translate all strings in parallel batches via Aina (HF Inference API)
      let translatedTexts: string[];
      try {
        translatedTexts = await ainaTranslateBatch(allTexts, input.locale, 5);
      } catch (err) {
        throw new (await import("@trpc/server")).TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Aina translation failed: ${(err as Error).message}`,
        });
      }

      // Re-assemble per-question translation objects
      let inserted = 0;
      for (let i = 0; i < toTranslate.length; i++) {
        const base = i * 6; // question + 4 options + explanation
        const q = toTranslate[i];
        const translatedQuestion = translatedTexts[base];
        const translatedOptions = translatedTexts.slice(base + 1, base + 5);
        const translatedExplanation = translatedTexts[base + 5];
        if (!translatedQuestion || translatedOptions.length !== 4 || !translatedExplanation) continue;
        try {
          await db.insert(questionTranslations).values({
            questionId: q.id,
            locale: input.locale,
            question: translatedQuestion,
            options: JSON.stringify(translatedOptions),
            explanation: translatedExplanation,
          });
          inserted++;
        } catch (err) {
          // Skip duplicates silently
          console.warn("[translateQuestions] Insert skipped:", (err as Error).message);
        }
      }

      const remaining = allIds.filter((id) => !existingIds.has(id)).length - inserted;
      return { translated: inserted, remaining: Math.max(0, remaining), message: `Translated ${inserted} questions into ${localeName}` };
    }),

  /**
   * Export a PDF worksheet for selected questions in the requested locale.
   * Returns base64-encoded PDFs for both with-answers and without-answers versions.
   */
  exportWorksheet: publicProcedure
    .input(
      z.object({
        questionIds: z.array(z.string()).min(1).max(100),
        locale: z.enum(["en", "es", "ca"]).default("en"),
        title: z.string().max(120).default("LOMLOE Question Worksheet"),
        subtitle: z.string().max(200).nullish(),
        logoDataUrl: z.string().max(600_000).nullish(), // base64 data URL from client localStorage
      })
    )
    .mutation(async ({ input }) => {
      const { generateWorksheets } = await import("../worksheetPdf");

      // Fetch all questions (with locale translations if applicable)
      const allStatic = getQuestions();
      const db = await getDb();

      // Build a map of all questions by id
      const questionMap = new Map(allStatic.map((q) => [q.id, q]));

      // Overlay translations if locale is ES or CA
      if (input.locale !== "en" && db) {
        try {
          const translations = await db
            .select()
            .from(questionTranslations)
            .where(
              and(
                eq(questionTranslations.locale, input.locale),
                inArray(questionTranslations.questionId, input.questionIds)
              )
            );
          for (const tr of translations) {
            const q = questionMap.get(tr.questionId);
            if (q) {
              questionMap.set(tr.questionId, {
                ...q,
                question: tr.question,
                options: JSON.parse(tr.options) as string[],
                explanation: tr.explanation,
              });
            }
          }
        } catch (err) {
          console.error("[exportWorksheet] Translation overlay error:", err);
        }
      }

      // Collect requested questions in order
      const questions = input.questionIds
        .map((id) => questionMap.get(id))
        .filter(Boolean) as Array<{
          id: string;
          question: string;
          options: string[];
          correctIndex: number;
          competency: string;
          yearGroup: string;
          explanation: string;
        }>;

      if (questions.length === 0) {
        throw new (await import("@trpc/server")).TRPCError({ code: "BAD_REQUEST", message: "No valid questions found" });
      }

      const result = await generateWorksheets({
        title: input.title,
        subtitle: input.subtitle ?? undefined,
        questions,
        locale: input.locale,
        logoDataUrl: input.logoDataUrl ?? undefined,
      });

      return result; // { withAnswers: base64, withoutAnswers: base64 }
    }),

  /**
   * Admin: get translation progress for ES and CA locales.
   * Returns total static questions and translated count per locale.
   */
  getTranslationProgress: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin") {
      throw new (await import("@trpc/server")).TRPCError({ code: "FORBIDDEN" });
    }
    const db = await getDb();
    const totalStatic = getQuestions().length; // 480 static questions
    if (!db) return { total: totalStatic, es: 0, ca: 0 };

    const rows = await db
      .select({ locale: questionTranslations.locale })
      .from(questionTranslations);

    const esCnt = rows.filter((r) => r.locale === "es").length;
    const caCnt = rows.filter((r) => r.locale === "ca").length;
    return { total: totalStatic, es: esCnt, ca: caCnt };
  }),

  /**
   * Admin: generate new LOMLOE questions and append them to the knowledge bank.
   * Also used by the weekly scheduled task.
   */
  generateNewQuestions: protectedProcedure
    .input(
      z.object({
        count: z.number().min(1).max(100).default(30),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new (await import("@trpc/server")).TRPCError({ code: "FORBIDDEN" });
      }
      const result = await generateAndAppendQuestions(input.count);
      // Notify the owner with a summary
      const breakdownText = Object.entries(result.breakdown)
        .map(([code, n]) => `${code}: +${n}`)
        .join(", ");
      await notifyOwner({
        title: `SEBA: ${result.added} new questions added to knowledge bank`,
        content: `Weekly question generation completed.\n\nAdded: ${result.added} questions\nBreakdown: ${breakdownText}\nNew total: ${result.newTotal} questions`,
      }).catch(() => {});
      return result;
    }),

  /**
   * Generate a structured Situació d'Aprenentatge (SA) aligned to LOMLOE.
   * Returns a JSON object with context, task, competencies, criteria, and activities.
   */
  generateSituacio: protectedProcedure
    .input(
      z.object({
        topic: z.string().min(3).max(300),
        yearGroup: YearGroupSchema,
        subject: z.string().min(2).max(128),
        competencies: z.array(CompetencyCodeSchema).min(1).max(8),
        language: z.enum(["ca", "es", "en"]).default("ca"),
      })
    )
    .mutation(async ({ input }) => {
      const compList = input.competencies.join(", ");
      const langInstruction =
        input.language === "ca"
          ? "Respond entirely in Catalan (català)."
          : input.language === "es"
          ? "Respond entirely in Spanish (castellano)."
          : "Respond entirely in English.";

      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `You are an expert Catalan secondary school curriculum designer with deep knowledge of Spain's LOMLOE education law (RD 217/2022) and the Catalan curriculum framework (Decret 175/2022). You specialise in designing Situacions d'Aprenentatge (SA) — project-based learning units that integrate multiple LOMLOE key competencies through authentic, meaningful tasks. ${langInstruction}`,
          },
          {
            role: "user",
            content: `Design a complete Situació d'Aprenentatge for the following parameters:

- Topic/Context: ${input.topic}
- Year Group: ${input.yearGroup}
- Subject: ${input.subject}
- Target LOMLOE Competencies: ${compList}

Return ONLY a valid JSON object (no markdown, no code fences) with exactly these fields:
{
  "title": "Short evocative title for the SA",
  "context": "2-3 sentences situating the SA in a real-world or local Catalan context, explaining why it is relevant to students",
  "task": "1-2 sentences describing the central challenge or product students will create",
  "competencies": [
    { "code": "CCL", "description": "How this competency is developed in this SA" }
  ],
  "criteria": [
    "Specific, observable assessment criterion 1",
    "Specific, observable assessment criterion 2",
    "Specific, observable assessment criterion 3"
  ],
  "activities": [
    { "phase": "Activació", "description": "Brief description of the activation activity" },
    { "phase": "Exploració", "description": "Brief description of the exploration activity" },
    { "phase": "Aplicació", "description": "Brief description of the application activity" },
    { "phase": "Avaluació", "description": "Brief description of the evaluation activity" }
  ],
  "lomloeRef": "Relevant LOMLOE article reference, e.g. RD 217/2022, Art. 12"
}`,
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "situacio_aprenentatge",
            strict: true,
            schema: {
              type: "object",
              properties: {
                title: { type: "string" },
                context: { type: "string" },
                task: { type: "string" },
                competencies: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      code: { type: "string" },
                      description: { type: "string" },
                    },
                    required: ["code", "description"],
                    additionalProperties: false,
                  },
                },
                criteria: { type: "array", items: { type: "string" } },
                activities: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      phase: { type: "string" },
                      description: { type: "string" },
                    },
                    required: ["phase", "description"],
                    additionalProperties: false,
                  },
                },
                lomloeRef: { type: "string" },
              },
              required: ["title", "context", "task", "competencies", "criteria", "activities", "lomloeRef"],
              additionalProperties: false,
            },
          },
        },
      });

      const rawContent = response.choices[0]?.message?.content ?? "{}";
      const raw = typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent);
      try {
        return JSON.parse(raw);
      } catch {
        throw new (await import("@trpc/server")).TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to parse LLM response as JSON",
        });
      }
    }),
});
