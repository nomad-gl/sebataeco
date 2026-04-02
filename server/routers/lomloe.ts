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
import { getClaraProfile, upsertClaraProfile } from "../db";

const CompetencyCodeSchema = z.enum(["CCL", "CP", "STEM", "CD", "CPSAA", "CC", "CE", "CCEC"]);
const YearGroupSchema = z.enum(["junior", "primary", "secondary"]);

// ─── Profile update helper (runs async, never blocks the response) ────────────

/**
 * Extracts style signals from the latest user message + assistant response
 * and persists them to the clara_user_profiles table.
 * Called fire-and-forget after every chat turn.
 */
async function updateClaraProfile(
  userId: number,
  userMessage: string,
  assistantResponse: string,
  competency: string | undefined,
  yearGroup: string | undefined,
  langName: string
): Promise<void> {
  try {
    // Fetch current profile (may be null for first-time users)
    const current = await getClaraProfile(userId);

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

    await upsertClaraProfile(userId, {
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
    console.error("[Clara] Profile update failed:", err);
  }
}

// ─── Build the adaptive context block from a user's profile ──────────────────

function buildAdaptiveContext(profile: Awaited<ReturnType<typeof getClaraProfile>>): string {
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
  lines.push("--- End of profile ---");

  return lines.filter(Boolean).join("\n");
}

// ─── Router ───────────────────────────────────────────────────────────────────

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
        competency: CompetencyCodeSchema.optional(),
        yearGroup: YearGroupSchema.optional(),
        /** Active UI language — Clara must always respond in this language */
        uiLang: z.enum(["en", "es", "ca"]).optional(),
        /** Authenticated user ID — used to load/update the adaptive profile */
        userId: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      // Load adaptive profile (non-blocking — null for anonymous/first-time users)
      const profile = input.userId ? await getClaraProfile(input.userId) : null;
      const adaptiveContext = buildAdaptiveContext(profile);

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

      const langName =
        input.uiLang === "es" ? "Spanish (Castilian)" : input.uiLang === "ca" ? "Catalan" : "English";

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
${adaptiveContext}

Guidelines:
1. Focus your responses on LOMLOE curriculum topics, teaching strategies, and classroom practice.
2. If a question falls outside your scope, gently redirect with a warm explanation and offer what help you can.
3. Always reference the relevant LOMLOE competency when discussing curriculum content.
4. When a teacher shares a challenge or frustration, acknowledge it empathetically before offering solutions.
5. End responses with an open invitation — e.g. "Would you like me to expand on any of this?" or "Let me know if you'd like a specific activity idea!" — to keep the conversation going.
6. **IMPORTANT — Adaptive behaviour:** Use the teacher profile above (if present) to calibrate your tone, response length, and examples. A teacher who prefers brief answers should get shorter responses; one who prefers thorough answers should get more detail.
7. **IMPORTANT — Language rule:** Always respond in the language specified below, regardless of what language the teacher's question appears to be in.
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
          updateClaraProfile(
            input.userId,
            lastUserMsg.content,
            content,
            input.competency,
            input.yearGroup,
            langName
          ).catch(() => {/* silently ignore */});
        }
      }

      return { content, followUpQuestions };
    }),

  /** Get the Clara learning profile for the current user */
  getClaraProfile: protectedProcedure.query(async ({ ctx }) => {
    const profile = await getClaraProfile(ctx.user.id);
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
});
