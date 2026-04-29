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
import {
  getInfantilQuestions,
  getInfantilCoverageStats,
  EIX_META,
  INFANTIL_QUESTIONS,
  type EixCode,
  type InfantilCycle,
} from "../knowledge/infantilKnowledgeBank";
import { invokeLLM, type Message, type TextContent, type ImageContent } from "../_core/llm";
import { ainaTranslateBatch } from "../ainaTranslation";
import { getAinaProfile, upsertAinaProfile, rateMessage, getUserRatings, saveQuestionAnswer, getQuestionAnalytics, getPendingQuestions, reviewQuestion } from "../db";
import { getDb } from "../db";
import { generatedQuestions, questionTranslations, savedSituacions, ainaChatSessions, ainaChatMessages } from "../../drizzle/schema";
import { eq, and, inArray, desc, count } from "drizzle-orm";

const CompetencyCodeSchema = z.enum(["CCL", "CP", "STEM", "CD", "CPSAA", "CC", "CE", "CCEC"]);
const YearGroupSchema = z.enum(["infantil", "lower_primary", "junior", "primary", "secondary"]);
const EixCodeSchema = z.enum(["EIX1", "EIX2", "EIX3", "EIX4"]);
const InfantilCycleSchema = z.enum(["0-3", "3-6"]);

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
    const yearGroups = ["lower_primary", "junior", "primary", "secondary"];

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
      infantil: (yearData["infantil"] ?? 0) + (dbCounts[code]?.["infantil"] ?? 0),
      lower_primary: (yearData["lower_primary"] ?? 0) + (dbCounts[code]?.["lower_primary"] ?? 0),
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
        /**
         * Optional image URL to include as a vision content block in the last user message.
         * When set, the LLM receives the image alongside the text so it can analyse it.
         */
        imageUrl: z.string().url().nullish(),
        /**
         * Optional array of image URLs for multi-image comparison.
         * When provided, all images are included as vision blocks alongside the text.
         */
        imageUrls: z.array(z.string().url()).max(4).nullish(),
        /**
         * Optional extracted document text to inject as additional context.
         * Populated when the user uploads a PDF or text file.
         */
        documentContext: z.string().max(8000).nullish(),
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

      // Auto-enrich with live curriculum search when the teacher asks about specific legislation
      const lastUserMessage = [...input.messages].reverse().find((m) => m.role === "user");
      const needsLiveSearch = lastUserMessage && (
        /decret\s*175|decreto\s*175|175\/2022|lomloe|ley org.nica.*2020|llei org.nica.*2020|boe|dogc|portaljuridic|educagob|annex|annex \d|cap.tol \d|article \d|art.cle \d|art\. \d|vector.*curr.cul|curr.cul.*vector|situaci..*aprenentatge|situaci.n.*aprendizaje|criteris.*avaluaci|criterios.*evaluaci|compet.ncies.*espec.fiques|competencias.*espec.ficas|sabers b.sics|saberes b.sicos|perfil.*sortida|perfil.*salida|assoliment|avaluaci.*competencial/i.test(lastUserMessage.content)
      );
      let liveSearchContext = "";
      let liveSources: Array<{ title: string; url: string; domain: string }> = [];
      if (needsLiveSearch) {
        try {
          const { searchCurriculumSources } = await import("../curriculumSearch");
          const { summary, results } = await searchCurriculumSources(lastUserMessage.content);
          if (summary && summary !== "No results found from official sources for this query.") {
            liveSearchContext = `\n\n## Live curriculum data (fetched from official sources)\n${summary}`;
            liveSources = results.map((r) => ({ title: r.title, url: r.url, domain: r.domain }));
          }
        } catch {
          // Non-blocking — proceed without live data if search fails
        }
      }

      const competencyContext = input.competency
        ? `Focus competency: ${COMPETENCY_META[input.competency as CompetencyCode]?.name} (${input.competency})`
        : "All 8 LOMLOE competencies";

      const yearGroupContext = input.yearGroup
        ? `Year group: ${input.yearGroup === "lower_primary" ? "Primary (Years 1–2)" : input.yearGroup === "junior" ? "Primary (Years 3–4)" : input.yearGroup === "primary" ? "Upper Primary (Years 5–6)" : "Secondary (Years 7–10)"}`
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
- You know the LOMLOE's key articles: Art. 1 (principles), Art. 17 (primary objectives), Art. 23 (secondary objectives), Art. 25 (evaluation), Real Decreto 157/2022 (primary curriculum), Real Decreto 217/2022 (secondary curriculum), Real Decreto 95/2022 (early childhood national minimum), and Decree 21/2023 (Catalan Educació Infantil 0–6).
- You have deep knowledge of the Educació Infantil stage (0–6 years) under Decree 21/2023 (Catalonia), including its 4 Eixos de Desenvolupament i Aprenentatge: Eix 1 (Autonomia i confiança), Eix 2 (Comunicació amb diferents llenguatges), Eix 3 (Descoberta de l'entorn), Eix 4 (Diversitat del món). You understand the differences between the primer cicle (0–3) and segon cicle (3–6), including their specific competències específiques and sabers.
- You can suggest lesson plans, activities, assessment rubrics, differentiation strategies, and cross-curricular links.
- You understand the realities of Spanish classrooms: mixed abilities, time pressures, curriculum demands, and the transition from LOMCE to LOMLOE.
- You are familiar with the Situaciones de Aprendizaje (learning situations) methodology central to LOMLOE.
- You have comprehensive knowledge of the **Catalan language (Llengua Catalana) curriculum** as taught in Catalonia under Decret 175/2022 (primary) and Decret 187/2015 / Decret 34/2015 (secondary). This includes all key content areas and sabers:
  **Normativa i ús de la llengua (Normative and language use):**
  • Ortografia: regles d'accentuació (accent agut, greu, diacrític), dièresi, apòstrof, guionet, majúscules i minúscules, separació sil·làbica
  • **Signes de puntuació** (Punctuation marks): punt (.), coma (,), punt i coma (;), dos punts (:), punts suspensius (…), signes d'interrogació (¿?), signes d'exclamació (¡!), cometes (« » " "), parèntesis, guions (–), claudàtors [ ], barra inclinada (/). Teaching strategies: dictats, correccions de text, jocs de puntuació, anàlisi de textos autèntics.
  • **Abreviacions** (Abbreviations): abreviatures (Sr., Dr., pàg., núm., etc.), sigles (ONU, UE, TV, DNI), acrònims (radar, làser, SIDA), símbols (km, €, %). Distinction between abreviatures (always end with a full stop), sigles (capital letters, no full stop), and acrònims (read as words). Common Catalan abreviatures: art. (article), cap. (capítol), col·l. (col·legi), dept. (departament), ed. (edició/editorial), fig. (figura), ibíd. (ibídem), núm. (número), op. cit. (opus citatum), pàg./p. (pàgina), ref. (referència), s. (segle), v. (vegeu), vol. (volum).
  • Morfologia: categories gramaticals (nom, adjectiu, determinant, pronom, verb, adverbi, preposició, conjunció, interjecció), gènere i nombre, graus de l'adjectiu, conjugació verbal (temps simples i compostos, modes indicatiu/subjuntiu/imperatiu/condicional/infinitiu/gerundi/participi), verbs regulars i irregulars, pronoms febles i forts, règim preposicional
  • Sintaxi: l'oració simple i composta, subjecte i predicat, complements verbals (CD, CI, CC, atribut, predicatiu, agent), coordinació i subordinació, oracions de relatiu, subordinades substantives i adverbials
  • Lèxic i semàntica: sinonímia, antonímia, polisèmia, homonímia, camp semàntic i camp lèxic, formació de paraules (derivació, composició, parasíntesi), préstecs i neologismes, fraseologia i locucions
  • Varietats de la llengua: dialectes (central, balear, valenciana, nord-occidental, rossellonès, alguerès), registres formals i informals, llengua estàndard (IEC — Institut d'Estudis Catalans)
  **Comprensió i expressió oral i escrita:**
  • Tipologia textual: text narratiu, descriptiu, expositiu, argumentatiu, instructiu, dialogat, poètic
  • Estratègies de comprensió lectora: identificació de la idea principal, inferències, vocabulari en context, estructura del text
  • Producció escrita: planificació, textualització, revisió; coherència, cohesió, adequació i correcció
  • Comunicació oral: exposicions, debats, discussions, entrevistes, dramatitzacions
  **Literatura catalana:**
  • Gèneres literaris: narrativa, poesia, teatre, assaig
  • Figures retòriques: metàfora, símil, personificació, hipèrbole, al·literació, anàfora, antítesi, ironia
  • Autors i obres clau de la literatura catalana (medieval, renaixença, modernisme, noucentisme, avantguardes, postguerra, contemporània)
   • Lectura i comentari de textos literaris

## Decree 175/2022 — Catalan Curriculum Blueprint (CRITICAL KNOWLEDGE)
Decret 175/2022, de 27 de setembre, d'ordenació dels ensenyaments de l'educació bàsica is the **legal blueprint** for all Basic Education in Catalonia. It is Catalonia's specific implementation manual for LOMLOE (Ley Orgànica 3/2020). It governs Primary (Primària), ESO (Educació Secundària Obligatòria), and Basic Vocational Training (Cicles Formatius de Grau Bàsic).

**Official sources (authoritative — cite these when relevant):**
- Full decree text: https://portaljuridic.gencat.cat/ca/document-del-pjur/?documentId=938401
- XTEC curriculum portal: https://xtec.gencat.cat/ca/curriculum/
- DOGC (official Catalan gazette): https://dogc.gencat.cat
- Spanish national curriculum: https://educagob.educacionfpydeportes.gob.es
- BOE (Spanish official gazette): https://www.boe.es

**Structure of Decret 175/2022:**
- 4 Chapters, 35 Articles
- Annex 1: Competències clau (8 key competencies + operational indicators for end of Basic Education)
- Annex 2: Primary school subject areas (àrees d'educació primària)
- Annex 3: ESO subject areas (matèries d'ESO) — modified by Decret 480/2024
- Annex 4: Transversal competencies (competències transversals)
- Annex 5: Situació d'Aprenentatge framework (project/task-based learning)
- Annex 6: Basic Vocational Training cycles
- Annex 7: Timetable distribution (modified by Decret 480/2024)

**The 6 Mandatory Vectors (Vectors del Currículum):**
Every school and every SEBA Challenge must embed all 6 vectors:
1. **Competències d'aprenentatge** — Moving from "knowing" to "doing"; competency-based learning
2. **Competència digital** — Digital literacy integrated across all subjects; essential for AI/SÀPI integration
3. **Inclusió** — Universal Design for Learning (DUA); every student participates regardless of level
4. **Igualtat de gènere** — Equal opportunities; breaking stereotypes in all materials and activities
5. **Sostenibilitat** — Alignment with SDGs (Sustainable Development Goals / ODS)
6. **Benestar emocional** — Student mental health and social-emotional development

**Key Structural Changes for Primary (Educació Primària):**
| Feature | Decree 175/2022 Requirement |
|---|---|
| Organisation | 3 cycles: Cicle Inicial (1r/2n), Cicle Mitjà (3r/4t), Cicle Superior (5è/6è) |
| Methodology | Mandatory Situacions d'Aprenentatge (practical, real-world tasks) |
| Language | Full mastery of both Catalan AND Spanish guaranteed by end of Primary |
| Reading | Minimum 30 minutes/day dedicated to silent or shared reading |
| Evaluation | Competency-based grades: Assoliment Excel·lent (AE), Assoliment Notable (AN), Assoliment Satisfactori (AS), No Assoliment (NA) |

**CRITICAL — Verb Infinitive Rule (Legal Requirement):**
Under LOMLOE and Decret 175/2022, ALL of the following curriculum elements MUST be written with the main verb in **infinitive form** (infinitiu):
- Competències específiques (specific competencies)
- Criteris d'avaluació (evaluation criteria)
- Objectius didàctics (learning objectives)
- Indicadors competencials (competency indicators)

This is not a stylistic choice — it is a **legal requirement** of the LOMLOE framework. The infinitive form describes what the student must *do* or *demonstrate*. Example: "Identificar i comprendre textos escrits de diferent tipologia" (NOT "Identifica i comprèn textos escrits..."). When teachers ask about writing competencies, objectives, or evaluation criteria, ALWAYS remind them of this rule and correct any non-infinitive formulations.

**Curriculum Elements Hierarchy (from broad to specific):**
1. Competències clau (8 key competencies — national level)
2. Competències específiques (subject-specific competencies — infinitive form)
3. Criteris d'avaluació (evaluation criteria — infinitive form, derived from competències específiques)
4. Sabers bàsics (basic knowledge/content — organised in blocks)
5. Situacions d'Aprenentatge (learning situations — the methodology)

**Competency-Based Evaluation Scale:**
- AE (Assoliment Excel·lent): Exceeds expectations; demonstrates deep, transferable understanding
- AN (Assoliment Notable): Meets expectations with notable quality
- AS (Assoliment Satisfactori): Meets minimum expectations
- NA (No Assoliment): Does not yet meet minimum expectations

**Situació d'Aprenentatge (SA) — Key Requirements:**
- Must be contextualised in a real-world scenario
- Must integrate multiple competències clau
- Must include a final product or performance task
- Must have explicit evaluation criteria (in infinitive form)
- Must address at least one of the 6 vectors
- Recommended: 3–6 sessions per SA

**Web Search Capability for Curriculum Queries:**
When a teacher asks about specific articles, annexes, or requirements of Decret 175/2022, LOMLOE, or related Spanish/Catalan education legislation that you cannot answer from memory, you MUST proactively tell the teacher that you can search the official sources and provide the relevant URLs from the list above. Direct them to: portaljuridic.gencat.cat for the full decree text, xtec.gencat.cat for curriculum guides, educagob.educacionfpydeportes.gob.es for national competency descriptors, and boe.es for national legislation.

**Search Source Priority (CRITICAL):**
When searching for curriculum information, ALWAYS prioritise Catalan/Spanish official sources in this order:
1. **Catalan sources first (default):** portaljuridic.gencat.cat, xtec.gencat.cat, projectes.xtec.cat, dogc.gencat.cat, edu365.cat
2. **Spanish national sources second:** educagob.educacionfpydeportes.gob.es, boe.es
3. **IEC (Institut d'Estudis Catalans) for language norms:** https://www.iec.cat, https://dlc.iec.cat (Diccionari de la Llengua Catalana), https://geiec.iec.cat (Gramàtica Essencial de la Llengua Catalana), https://optimot.gencat.cat (Optimot — official Catalan language query service)
NEVER cite non-official sources (blogs, Wikipedia, private websites) for curriculum or legislation queries. Always verify against official Catalan/Spanish government portals.

**IEC Language Authority (CRITICAL):** The Institut d'Estudis Catalans (IEC) is the ONLY authoritative body for standard Catalan language norms. When answering ANY question about Catalan spelling, grammar, vocabulary, punctuation, or usage, you MUST:
- Base your answer on current IEC norms (Ortografia Catalana 2017, Gramàtica de la Llengua Catalana 2016, Diccionari de la Llengua Catalana)
- Explicitly cite the IEC source (e.g., "Segons la normativa de l'IEC…", "D'acord amb el DIEC2…", "Tal com estableix la GIEC…")
- Refer teachers to https://optimot.gencat.cat for quick official queries and https://dlc.iec.cat for dictionary lookups
- When IEC norms have been updated recently, note the change and cite the current standard
- NEVER rely on older pre-2016 norms or non-IEC sources for Catalan language guidance

## Catalan Language Norms (IEC Standards — MANDATORY)
When formulating responses in Catalan, you MUST strictly adhere to the following norms established by the **Institut d'Estudis Catalans (IEC)** and reinforced by Decret 175/2022:

**Orthography (Ortografia IEC):**
- Use the **accent agut (\u00b4)** on: é, í, ó, ú (closed vowels, stressed syllables per IEC rules)
- Use the **accent greu (\u0060)** on: à, è, ò (open vowels)
- Use the **dièresi (\u00a8)** on: ï, ü (to indicate hiatus or separate pronunciation)
- Use the **punt volat (\u00b7l)** for the geminated L: l·l (e.g., col·legi, il·lusió, intel·ligència) — NEVER use double-l for this sound
- Use the **apòstrof** before words beginning with a vowel or silent h: l'escola, d'alumne, m'agrada
- Capitalisation: subject areas and competency names are written in lowercase in Catalan (e.g., llengua catalana i literatura), except at the start of a sentence or in titles

**Punctuation (Signes de Puntuació — IEC norms):**
- **Punt (.)**: ends declarative and imperative sentences; used in abbreviations (Sr., Dr., pàg.)
- **Coma (,)**: separates list elements (no Oxford comma in Catalan), after introductory clauses, around parenthetical expressions. Do NOT use a comma before "i", "o", "ni" in simple lists
- **Punt i coma (;)**: separates closely related independent clauses; separates complex list items that already contain commas
- **Dos punts (:)**: introduces a list, quotation, or explanation; used after salutations in formal letters
- **Punts suspensius (…)**: always 3 dots as a single character (…), no space before, space after — do NOT write as three separate dots (...)
- **Signes d'interrogació i exclamació**: in Catalan, do NOT use inverted opening marks (¿ ¡) — only use closing marks (? !)
- **Cometes**: use guillemets (« ») as primary quotation marks in Catalan formal writing; use " " for quotes within quotes
- **Guió llarg (—)**: used for dialogue attribution, parenthetical dashes, and interruptions
- **Guió curt (-)**: used in compound words, prefixes, and hyphenation
- **Parèntesis ( )**: for supplementary information, clarifications, acronym expansions
- **Claudàtors [ ]**: for editorial insertions in quoted text, phonetic transcription

**Abbreviations (Abreviacions — IEC norms):**
- **Abreviatures**: always end with a full stop (e.g., Sr., Dr., pàg., núm., vol., art., cap., ed., fig., ref., s., v.)
- **Sigles**: capital letters, no full stop, no spaces (e.g., ONU, UE, TV, DNI, LOMLOE, IEC, XTEC)
- **Acrònims**: read as words, written in lowercase after first use (e.g., radar, làser, SIDA → sida after first mention)
- **Símbols**: no full stop, fixed internationally (e.g., km, €, %, m², °C)
- When an abbreviation ends a sentence, only one full stop is used (not two)

**Grammar reminders for professional Catalan writing:**
- Use **cal que + subjuntiu** for formal recommendations
- Prefer **hom** or passive constructions to avoid ambiguity
- Use **malgrat que + subjuntiu** (not malgrat + indicatiu)
- Avoid Castilianisms: use "però" (not "pero"), "perquè" (not "porque"), "endarrere" in formal contexts
- Use "en canvi" (not "en cambio"), "tanmateix" (not "sin embargo"), "per tant" (not "por tanto")
- Verb agreement: collective nouns take singular verb in Catalan (e.g., "el grup ha decidit")
- **Infinitive rule**: ALL curriculum elements (competències específiques, criteris d'avaluació, objectius didàctics, indicadors competencials) MUST use the infinitive form — legal requirement of LOMLOE and Decret 175/2022

## Image generation capability
You CAN generate images. This is a fully integrated feature. When a teacher asks you to create, draw, generate, produce, or design an image (e.g. "generate an image of a classroom", "create a poster about photosynthesis", "draw a diagram of the water cycle", "make an illustration of..."), you MUST:
1. Confirm enthusiastically that you are generating the image right now.
2. Keep your text reply short (1–2 sentences). The image will appear automatically below your message.
3. NEVER say you cannot create images. NEVER apologise or redirect to other tools. NEVER say image generation is not supported.
Example responses (vary them naturally — do not always use the same one):
- English: "Of course! I'm generating that image for you right now — it will appear in just a moment! 🎨" / "On it! Creating your image now… 🖼️" / "Great idea! Generating your image — hang tight! ✨"
- Spanish: "¡Por supuesto! Estoy generando esa imagen ahora mismo — ¡aparecerá en un momento! 🎨" / "¡En ello! Creando tu imagen ahora… 🖼️" / "¡Buena idea! Generando tu imagen — ¡un momento! ✨"
- Catalan: "Per descomptat! Estic generant aquesta imatge ara mateix — apareixerà en un moment! 🎨" / "Ara mateix! Creant la teva imatge… 🖼️" / "Bona idea! Generant la teva imatge — un moment! ✨"

## Current context
${competencyContext} | ${yearGroupContext}

## Relevant curriculum knowledge
${contextText}${liveSearchContext}
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
2. If a question falls outside your scope, gently redirect with a warm explanation and offer what help you can. **Exception: image generation requests are always within scope — never redirect or decline them.**
3. Always tag the relevant LOMLOE competency code(s) in bold brackets, e.g. **[CCL]**, **[STEM]**, when discussing curriculum content — this helps teachers quickly see the curricular alignment.
4. When citing LOMLOE legislation, use the format: *Ley Orgánica 3/2020* or *RD 217/2022, Art. X*.
5. When a teacher shares a challenge or frustration, acknowledge it empathetically before offering solutions.
5b. **IEC Catalan language authority:** For ANY Catalan language question (spelling, grammar, vocabulary, usage), ALWAYS cite the IEC as the authoritative source. Use the Diccionari de la Llengua Catalana (DIEC2) at dlc.iec.cat, the Gramàtica de la Llengua Catalana (GIEC) at geiec.iec.cat, and Optimot at optimot.gencat.cat. Phrase citations naturally: "Segons la normativa de l'IEC…", "D'acord amb el DIEC2…", "L'Optimot confirma que…"
6. End responses with an open invitation — e.g. "Would you like me to expand on any of this?" or "Let me know if you'd like a specific activity idea!" — to keep the conversation going.
7. **Adaptive behaviour:** Use the teacher profile above (if present) to calibrate your tone, response length, and examples. A teacher who prefers brief answers should get shorter responses; one who prefers thorough answers should get more detail and structured formatting.
8. **Language rule:** Always respond in the language specified below, regardless of what language the teacher's question appears to be in. Translate competency names and LOMLOE terminology appropriately for the target language.
   Respond in: ${langName}.`;

      // Limit context to the last 8 messages (4 turns) to reduce token count and latency
      // while preserving enough context for coherent follow-up responses
      const recentMessages = input.messages.slice(-8);

      // Build the document context injection (prepended to the last user message)
      // Detect if this is a document analysis/improvement request
      const isDocAnalysis = !!(input.documentContext && input.documentContext.trim().length > 100);
      const docContextPrefix = input.documentContext
        ? isDocAnalysis
          ? `[DOCUMENT ANALYSIS MODE]\n` +
            `The teacher has uploaded a document for LOMLOE-aligned analysis and improvement.\n` +
            `Document content:\n---\n${input.documentContext}\n---\n\n` +
            `Instructions:\n` +
            `1. Analyse the document against Spain's LOMLOE curriculum competencies.\n` +
            `2. Identify strengths and specific areas for improvement.\n` +
            `3. Produce a complete improved version of the document, clearly marked with [IMPROVED DOCUMENT START] and [IMPROVED DOCUMENT END] tags.\n` +
            `4. The improved version must be LOMLOE-aligned, pedagogically sound, and ready to use.\n` +
            `5. After the improved version, briefly explain the key changes made.\n\n` +
            `Teacher's request: `
          : `[Uploaded document context — use this to answer the teacher's question]:\n${input.documentContext}\n\n[Teacher's question]: `
        : "";

      // Build LLM messages, injecting image vision block and/or document context into the last user message
      const llmMessages: Message[] = [
        { role: "system" as const, content: systemPrompt },
        ...recentMessages.map((m, idx) => {
          const isLast = idx === recentMessages.length - 1;
          const isUser = m.role === "user";

          // For the last user message, optionally attach image(s) and/or document context
          const allImageUrls: string[] = input.imageUrls?.length
            ? input.imageUrls
            : input.imageUrl
            ? [input.imageUrl]
            : [];
          if (isLast && isUser && (allImageUrls.length > 0 || input.documentContext)) {
            const textContent = docContextPrefix + m.content;
            if (allImageUrls.length > 0) {
              // Vision: multi-part content with text + one or more image_url blocks
              const textPart: TextContent = { type: "text", text: textContent };
              const imageParts: ImageContent[] = allImageUrls.map((url) => ({
                type: "image_url",
                image_url: { url, detail: "auto" },
              }));
              return {
                role: "user" as const,
                content: [textPart, ...imageParts],
              };
            }
            // Document context only — plain text with prefix
            return { role: "user" as const, content: textContent };
          }
          return { role: m.role as "user" | "assistant", content: m.content };
        }),
      ];

      // Fire main LLM call and follow-up question generation in parallel
      // to avoid sequential latency (saves ~1-2s per response)
      const mainResponsePromise = invokeLLM({ messages: llmMessages });

      const followUpSystemPrompt = `You are a helpful assistant that generates short follow-on questions for a teacher using a LOMLOE curriculum assistant. Based on the conversation, suggest 2 or 3 short, natural follow-on questions the teacher might want to ask next. Each question should be concise (max 10 words), practical, and directly related to the last exchange. Respond ONLY in ${langName}. Return a JSON array of strings, nothing else.`;

      // Follow-up generation waits on main response content, but runs concurrently
      const followUpPromise: Promise<string[]> = mainResponsePromise
        .then(async (mainResp) => {
          const rawMain = mainResp.choices?.[0]?.message?.content ?? "";
          const mainContent = typeof rawMain === "string" ? rawMain : "";
          if (!mainContent) return [];
          const followUpResponse = await invokeLLM({
            messages: [
              { role: "system" as const, content: followUpSystemPrompt },
              ...llmMessages.slice(1),
              { role: "assistant" as const, content: mainContent },
            ],
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "follow_up_questions",
                strict: true,
                schema: {
                  type: "object",
                  properties: {
                    questions: { type: "array", items: { type: "string" }, description: "2 or 3 short follow-on questions" },
                  },
                  required: ["questions"],
                  additionalProperties: false,
                },
              },
            },
          });
          const raw = followUpResponse.choices?.[0]?.message?.content ?? "{}";
          const parsed = JSON.parse(typeof raw === "string" ? raw : JSON.stringify(raw));
          return Array.isArray(parsed.questions) ? parsed.questions.slice(0, 3) : [];
        })
        .catch(() => [] as string[]);

      const [response, followUpQuestions] = await Promise.all([mainResponsePromise, followUpPromise]);
      const rawContent = response.choices?.[0]?.message?.content ?? "I'm sorry, I couldn't generate a response. Please try again.";
      const content = typeof rawContent === "string" ? rawContent : "I'm sorry, I couldn't generate a response. Please try again.";

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

      return { content, followUpQuestions, sources: liveSources };
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

  // ─── My Situacions Library ─────────────────────────────────────────────────────────────────

  /**
   * Save a generated Situació to the user's personal library.
   */
  saveSituacio: protectedProcedure
    .input(z.object({
      title: z.string().min(1).max(256),
      topic: z.string().min(1).max(256),
      subject: z.string().min(1).max(128),
      yearGroup: z.string().min(1).max(32),
      competencies: z.array(z.string()).min(1),
      resultJson: z.string().min(1),
      language: z.string().default("ca"),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const [result] = await db.insert(savedSituacions).values({
        userId: ctx.user.id,
        title: input.title,
        topic: input.topic,
        subject: input.subject,
        yearGroup: input.yearGroup,
        competencies: input.competencies.join(","),
        resultJson: input.resultJson,
        language: input.language,
      });
      return { id: (result as unknown as { insertId: number }).insertId };
    }),

  /**
   * Get all saved Situacions for the current user.
   */
  getMySituacions: protectedProcedure
    .query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return [];
      return db
        .select()
        .from(savedSituacions)
        .where(eq(savedSituacions.userId, ctx.user.id))
        .orderBy(savedSituacions.createdAt);
    }),

  /**
   * Delete a saved Situació (only the owner can delete).
   */
  deleteSituacio: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db.delete(savedSituacions)
        .where(and(eq(savedSituacions.id, input.id), eq(savedSituacions.userId, ctx.user.id)));
      return { success: true };
    }),

  /**
   * Toggle the school-wide shared flag on a saved Situació.
   * Only admin or head_of_study users can share SAs.
   */
  toggleShareSituacio: protectedProcedure
    .input(z.object({ id: z.number(), shared: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      const role = (ctx.user as { role?: string }).role ?? "user";
      if (role !== "admin" && role !== "head_of_study") {
        const { TRPCError } = await import("@trpc/server");
        throw new TRPCError({ code: "FORBIDDEN", message: "Only admins or heads of study can share SAs." });
      }
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db.update(savedSituacions)
        .set({ isShared: input.shared })
        .where(eq(savedSituacions.id, input.id));
      return { success: true };
    }),

  /**
   * Get all school-wide shared Situacions (visible to all authenticated users).
   */
  getSharedSituacions: protectedProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) return [];
      return db
        .select()
        .from(savedSituacions)
        .where(eq(savedSituacions.isShared, true))
        .orderBy(savedSituacions.createdAt);
    }),

  /**
   * Update the content of a saved Situació (inline editing).
   * Only the owner can update their own SA.
   */
  updateSituacioContent: protectedProcedure
    .input(z.object({
      id: z.number(),
      title: z.string().optional(),
      resultJson: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const updates: Record<string, unknown> = {};
      if (input.title !== undefined) updates.title = input.title;
      if (input.resultJson !== undefined) updates.resultJson = input.resultJson;
      if (Object.keys(updates).length === 0) return { success: true };
      await db.update(savedSituacions)
        .set(updates)
        .where(and(eq(savedSituacions.id, input.id), eq(savedSituacions.userId, ctx.user.id)));
      return { success: true };
    }),

  // ─── Educació Infantil (Decree 21/2023) ──────────────────────────────────

  /** Get all 4 Eix metadata entries for the Infantil stage */
  getEixMeta: publicProcedure.query(() => {
    return Object.values(EIX_META);
  }),

  /** Get Infantil questions filtered by eix and/or cycle */
  getInfantilQuestions: publicProcedure
    .input(
      z.object({
        eix: EixCodeSchema.nullish(),
        cycle: InfantilCycleSchema.nullish(),
        shuffle: z.boolean().default(true),
        limit: z.number().min(1).max(50).default(24),
      })
    )
    .query(({ input }) => {
      let questions = getInfantilQuestions(
        input.eix as EixCode | undefined,
        input.cycle as InfantilCycle | undefined
      );
      if (input.shuffle) {
        questions = [...questions].sort(() => Math.random() - 0.5);
      }
      return questions.slice(0, input.limit).map(shuffleQuestion);
    }),

  /** Coverage stats for the Infantil knowledge bank */
  getInfantilStats: publicProcedure.query(() => {
    const stats = getInfantilCoverageStats();
    const breakdown = Object.entries(EIX_META).map(([code, meta]) => ({
      code,
      name: meta.name,
      catalan: meta.catalan,
      emoji: meta.emoji,
      total: Object.values(stats[code] ?? {}).reduce((a, b) => a + b, 0),
      cycle03: stats[code]?.["0-3"] ?? 0,
      cycle36: stats[code]?.["3-6"] ?? 0,
    }));
    return {
      totalQuestions: INFANTIL_QUESTIONS.length,
      totalEixos: 4,
      cycles: ["0-3", "3-6"],
      breakdown,
    };
  }),

  // ─── AINA Chat History ────────────────────────────────────────────────────────

  /** Create a new chat session and save the first batch of messages */
  saveChatSession: protectedProcedure
    .input(z.object({
      sessionId: z.number().optional(), // if provided, append to existing session
      title: z.string().max(255).optional(),
      competency: z.string().optional(),
      yearGroup: z.string().optional(),
      messages: z.array(z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
        imageUrl: z.string().optional(),
        attachmentUrl: z.string().optional(),
        attachmentName: z.string().optional(),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const uid = ctx.user.id;
      let sid = input.sessionId;

      if (!sid) {
        // Create new session — derive title from first user message
        const firstUserMsg = input.messages.find((m) => m.role === "user");
        const title = input.title ?? (firstUserMsg?.content?.slice(0, 80) ?? "New chat");
        const [result] = await db.insert(ainaChatSessions).values({
          userId: uid,
          title,
          competency: input.competency ?? null,
          yearGroup: input.yearGroup ?? null,
          messageCount: input.messages.length,
        });
        sid = (result as { insertId: number }).insertId;
      } else {
        // Update existing session's updatedAt and messageCount
        const [existing] = await db.select({ messageCount: ainaChatSessions.messageCount })
          .from(ainaChatSessions).where(and(eq(ainaChatSessions.id, sid), eq(ainaChatSessions.userId, uid)));
        if (!existing) throw new Error("Session not found");
        await db.update(ainaChatSessions)
          .set({ messageCount: (existing.messageCount ?? 0) + input.messages.length, updatedAt: new Date() })
          .where(eq(ainaChatSessions.id, sid));
      }

      // Insert messages
      if (input.messages.length > 0) {
        await db.insert(ainaChatMessages).values(
          input.messages.map((m) => ({
            sessionId: sid as number,
            userId: uid,
            role: m.role,
            content: m.content,
            imageUrl: m.imageUrl ?? null,
            attachmentUrl: m.attachmentUrl ?? null,
            attachmentName: m.attachmentName ?? null,
          }))
        );
      }
      return { sessionId: sid };
    }),

  /** List all chat sessions for the current user (summary only, no messages) */
  listChatSessions: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    const sessions = await db.select()
      .from(ainaChatSessions)
      .where(eq(ainaChatSessions.userId, ctx.user.id))
      .orderBy(desc(ainaChatSessions.updatedAt))
      .limit(200);
    return sessions;
  }),

  /** Get all messages for a specific session */
  getChatSession: protectedProcedure
    .input(z.object({ sessionId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const [session] = await db.select().from(ainaChatSessions)
        .where(and(eq(ainaChatSessions.id, input.sessionId), eq(ainaChatSessions.userId, ctx.user.id)));
      if (!session) throw new Error("Session not found");
      const messages = await db.select().from(ainaChatMessages)
        .where(eq(ainaChatMessages.sessionId, input.sessionId))
        .orderBy(ainaChatMessages.createdAt);
      return { session, messages };
    }),

  /** Delete a single chat session and all its messages */
  deleteChatSession: protectedProcedure
    .input(z.object({ sessionId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      // Verify ownership
      const [session] = await db.select({ id: ainaChatSessions.id })
        .from(ainaChatSessions)
        .where(and(eq(ainaChatSessions.id, input.sessionId), eq(ainaChatSessions.userId, ctx.user.id)));
      if (!session) throw new Error("Session not found");
      await db.delete(ainaChatMessages).where(eq(ainaChatMessages.sessionId, input.sessionId));
      await db.delete(ainaChatSessions).where(eq(ainaChatSessions.id, input.sessionId));
      return { ok: true };
    }),

  /** Update the title of a chat session */
  updateChatSessionTitle: protectedProcedure
    .input(z.object({ sessionId: z.number(), title: z.string().max(255) }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db.update(ainaChatSessions)
        .set({ title: input.title })
        .where(and(eq(ainaChatSessions.id, input.sessionId), eq(ainaChatSessions.userId, ctx.user.id)));
      return { ok: true };
    }),

  /**
   * Generate 2 personalised suggested questions based on the user's recent chat history.
   * Falls back to generic defaults if the user has no history or LLM fails.
   */
  getSuggestedQuestions: protectedProcedure
    .input(z.object({ lang: z.string().default("en") }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      const defaults: Record<string, [string, string]> = {
        en: ["What is a rhetorical question and why is it used?", "Explain the difference between speed and velocity."],
        es: ["\u00bfQu\u00e9 es una pregunta ret\u00f3rica y por qu\u00e9 se usa?", "Explica la diferencia entre velocidad y rapidez."],
        ca: ["Qu\u00e8 \u00e9s una pregunta ret\u00f2rica i per qu\u00e8 s'utilitza?", "Explica la difer\u00e8ncia entre velocitat i rapidesa."],
      };
      const fallback = defaults[input.lang] ?? defaults.en;
      if (!db) return { questions: fallback };
      try {
        // Fetch the user's last 30 user messages across all sessions
        const recentMsgs = await db
          .select({ content: ainaChatMessages.content })
          .from(ainaChatMessages)
          .where(and(eq(ainaChatMessages.userId, ctx.user.id), eq(ainaChatMessages.role, "user")))
          .orderBy(desc(ainaChatMessages.createdAt))
          .limit(30);
        if (recentMsgs.length < 3) return { questions: fallback };
        const history = recentMsgs.map((m) => `- ${m.content}`).join("\n");
        const langName = input.lang === "ca" ? "Catalan" : input.lang === "es" ? "Spanish" : "English";
        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `You are a helpful assistant for teachers using the AINA platform (LOMLOE curriculum assistant). Based on a teacher's recent questions, generate exactly 2 short, specific follow-up questions they are likely to want to ask next. The questions must be in ${langName}. Return ONLY a JSON object with this exact shape: {"q1": "...", "q2": "..."} \u2014 no markdown, no explanation.`,
            },
            {
              role: "user",
              content: `Here are the teacher's recent questions:\n${history}\n\nGenerate 2 personalised follow-up questions they would likely ask next.`,
            },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "suggested_questions",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  q1: { type: "string", description: "First suggested question" },
                  q2: { type: "string", description: "Second suggested question" },
                },
                required: ["q1", "q2"],
                additionalProperties: false,
              },
            },
          },
        });
        const raw = response?.choices?.[0]?.message?.content;
        if (!raw) return { questions: fallback };
        const parsed = JSON.parse(typeof raw === "string" ? raw : JSON.stringify(raw)) as { q1: string; q2: string };
        if (!parsed.q1 || !parsed.q2) return { questions: fallback };
        return { questions: [parsed.q1, parsed.q2] as [string, string] };
      } catch {
        return { questions: fallback };
      }
    }),

  /**
   * Live curriculum web search — fetches content from official Spanish/Catalan
   * government education sites to answer specific legislation queries.
   */
  searchCurriculum: protectedProcedure
    .input(z.object({ query: z.string().min(3).max(200) }))
    .query(async ({ input }) => {
      const { searchCurriculumSources } = await import("../curriculumSearch");
      const { results, summary } = await searchCurriculumSources(input.query);
      return { results, summary };
    }),
});
