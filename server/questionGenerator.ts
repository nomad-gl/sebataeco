/**
 * questionGenerator.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Generates new LOMLOE multiple-choice questions via the LLM and saves them
 * to the `generated_questions` database table (status = 'pending').
 *
 * Questions only appear in Practice/Challenge once an admin approves them.
 *
 * This module is called:
 *  1. By the weekly scheduled task (every Monday at 04:00)
 *  2. By the admin tRPC procedure `lomloe.generateNewQuestions` for on-demand use
 */

import { invokeLLM } from "./_core/llm";
import { getDb } from "./db";
import { generatedQuestions } from "../drizzle/schema";
import { LOMLOE_QUESTIONS, COMPETENCY_META, type CompetencyCode, type YearGroup } from "./knowledge/lomloeKnowledgeBank";

const COMPETENCY_CODES: CompetencyCode[] = ["CCL", "CP", "STEM", "CD", "CPSAA", "CC", "CE", "CCEC"];
const YEAR_GROUPS: YearGroup[] = ["lower_primary", "junior", "primary", "secondary"];

interface GeneratedQuestion {
  question: string;
  options: [string, string, string, string];
  correctIndex: number;
  explanation: string;
}

/**
 * Generate a batch of questions for a specific competency and year group.
 */
async function generateBatch(
  competency: CompetencyCode,
  yearGroup: YearGroup,
  count: number
): Promise<GeneratedQuestion[]> {
  const meta = COMPETENCY_META[competency];

  // ── Language calibration by year group ─────────────────────────────────────
  // Each profile defines the exact language register, vocabulary level,
  // sentence complexity, and question style appropriate for that age group.
  const LANGUAGE_PROFILES: Record<string, {
    ageRange: string;
    stage: string;
    vocabulary: string;
    sentenceStyle: string;
    questionStyle: string;
    explanationStyle: string;
    avoidList: string;
    exampleStyle: string;
  }> = {
    infantil: {
      ageRange: "ages 3–6",
      stage: "Educació Infantil (Pre-school)",
      vocabulary: "Use only the simplest everyday words a 3–6 year old knows. No abstract nouns. No subject-specific terminology.",
      sentenceStyle: "Very short sentences (max 8 words). Simple present tense only. Use 'you', 'your', 'we'. No subordinate clauses.",
      questionStyle: "Questions about concrete, visible, everyday actions: sharing, listening, helping, playing, drawing, counting. Use 'What do you do when...?' or 'Which one is...?'",
      explanationStyle: "One very short sentence (max 10 words). Use 'because' to explain. No abstract reasoning.",
      avoidList: "No academic terms, no multi-step reasoning, no hypothetical scenarios, no negative constructions like 'which is NOT'.",
      exampleStyle: "Real classroom or playground situations: 'at school', 'with your friends', 'in the classroom'."
    },
    lower_primary: {
      ageRange: "ages 6–8",
      stage: "Primary Years 1–2 (Cicle Inicial)",
      vocabulary: "Simple, familiar words. Introduce one subject-specific word per question at most, always explained in context. Avoid jargon.",
      sentenceStyle: "Short sentences (max 12 words). Simple present and simple past. Use 'you', 'your teacher', 'your classmates'. One idea per sentence.",
      questionStyle: "Concrete, observable actions and situations. 'What should you do when...?', 'Which is the best way to...?', 'What does ... mean?'. Avoid hypotheticals.",
      explanationStyle: "2–3 short sentences. Explain the 'why' in plain language. Use relatable comparisons ('just like when you...').",
      avoidList: "No academic vocabulary, no multi-step logic, no negative constructions ('which is NOT'), no abstract concepts without concrete examples.",
      exampleStyle: "Everyday school situations: reading a book, working in a group, asking for help, counting objects."
    },
    junior: {
      ageRange: "ages 8–10",
      stage: "Primary Years 3–4 (Cicle Mitjà)",
      vocabulary: "Everyday language plus basic curriculum vocabulary (e.g., 'teamwork', 'opinion', 'information', 'problem'). Define any new term within the question.",
      sentenceStyle: "Medium sentences (max 18 words). Mix of present, past, and conditional ('What would you do if...'). Compound sentences with 'and', 'but', 'because'.",
      questionStyle: "Scenario-based: 'Your class is working on a project and...'. 'Which is the best way to...?'. Some 'why' questions. Avoid purely abstract questions.",
      explanationStyle: "3–4 sentences. Explain the reasoning step by step. Use school-relevant examples.",
      avoidList: "No advanced academic vocabulary, no complex subordinate clauses, no questions requiring prior knowledge of specific legislation or theory.",
      exampleStyle: "School projects, group activities, reading tasks, simple real-world problems."
    },
    primary: {
      ageRange: "ages 10–12",
      stage: "Primary Years 5–6 (Cicle Superior)",
      vocabulary: "Curriculum-standard vocabulary (e.g., 'evaluate', 'analyse', 'strategy', 'evidence', 'perspective'). Subject-specific terms used correctly.",
      sentenceStyle: "Medium-to-long sentences (max 25 words). Mix of tenses including conditional and passive. Subordinate clauses acceptable.",
      questionStyle: "Analytical and evaluative: 'Which strategy would be most effective...?', 'What is the main purpose of...?', 'How does ... help...?'. Some 'best answer' questions.",
      explanationStyle: "3–5 sentences. Explain the concept and why the other options are less correct. Reference the LOMLOE competency where relevant.",
      avoidList: "Avoid highly specialised academic jargon. Avoid questions requiring university-level knowledge.",
      exampleStyle: "Real-world and school-based scenarios, cross-curricular connections, current events at age-appropriate level."
    },
    secondary: {
      ageRange: "ages 12–16",
      stage: "ESO (Secondary Obligatory Education)",
      vocabulary: "Full academic vocabulary appropriate to secondary level (e.g., 'rhetorical device', 'bias', 'synthesis', 'critique', 'methodology', 'ethical implications'). LOMLOE terminology used precisely.",
      sentenceStyle: "Complex sentences with multiple clauses. Full range of tenses. Formal register. Precise, unambiguous language.",
      questionStyle: "Higher-order thinking: analysis, evaluation, synthesis. 'Which approach best demonstrates...?', 'What is the most significant limitation of...?', 'How does ... relate to...?'. Scenario-based with nuanced distractors.",
      explanationStyle: "4–6 sentences. Detailed explanation of the correct answer and why each distractor is incorrect. Reference LOMLOE articles or competency descriptors where appropriate.",
      avoidList: "Avoid oversimplification. Questions must genuinely challenge secondary students.",
      exampleStyle: "Real-world problems, ethical dilemmas, cross-disciplinary connections, current societal issues."
    },
  };

  const profile = LANGUAGE_PROFILES[yearGroup] ?? LANGUAGE_PROFILES["primary"];

  const prompt = `You are an expert in Spain's LOMLOE education curriculum and an experienced teacher of ${profile.stage}.

Generate exactly ${count} multiple-choice questions about the "${meta.name}" competency (${meta.description}) for ${profile.stage} — ${profile.ageRange}.

IMPORTANT: All questions, options, and explanations MUST be written in English. Do not use Spanish, Catalan, or any other language.

## Language calibration for ${profile.stage} (${profile.ageRange})
- **Vocabulary:** ${profile.vocabulary}
- **Sentence style:** ${profile.sentenceStyle}
- **Question style:** ${profile.questionStyle}
- **Explanation style:** ${profile.explanationStyle}
- **Avoid:** ${profile.avoidList}
- **Example contexts:** ${profile.exampleStyle}

## Question requirements
- Each question must have exactly 4 options (A, B, C, D)
- Distribute the correct answer position: use different positions (0, 1, 2, 3) across questions — do NOT always put the correct answer at position 1
- Questions must be genuinely age-appropriate — a ${profile.stage} teacher or student should immediately recognise the language as right for their level
- Questions should test understanding, not just recall
- Include a brief explanation of why the correct answer is right (following the explanation style above)

Return a JSON array of exactly ${count} objects with this structure:
{
  "question": "Question text here?",
  "options": ["Option A", "Option B", "Option C", "Option D"],
  "correctIndex": 0,
  "explanation": "Brief explanation of the correct answer"
}`;
  const response = await invokeLLM({
    messages: [
      { role: "system", content: "You are an expert curriculum designer. You ALWAYS write in English. Return only valid JSON arrays, no markdown." },
      { role: "user", content: prompt },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "questions_array",
        strict: true,
        schema: {
          type: "object",
          properties: {
            questions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  question: { type: "string" },
                  options: { type: "array", items: { type: "string" } },
                  correctIndex: { type: "integer" },
                  explanation: { type: "string" },
                },
                required: ["question", "options", "correctIndex", "explanation"],
                additionalProperties: false,
              },
            },
          },
          required: ["questions"],
          additionalProperties: false,
        },
      },
    },
  });

  const content = response.choices?.[0]?.message?.content;
  if (!content) return [];

  try {
    const parsed = typeof content === "string" ? JSON.parse(content) : content;
    const arr: GeneratedQuestion[] = parsed.questions ?? parsed;
    return arr.filter(
      (q) =>
        q.question &&
        Array.isArray(q.options) &&
        q.options.length === 4 &&
        typeof q.correctIndex === "number" &&
        q.correctIndex >= 0 &&
        q.correctIndex <= 3 &&
        q.explanation
    );
  } catch {
    return [];
  }
}

/**
 * Normalise a question string for comparison: lowercase, remove punctuation, collapse whitespace.
 */
function normalise(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
}

/**
 * Compute word-level Jaccard similarity between two strings (0 = no overlap, 1 = identical).
 */
function similarity(a: string, b: string): number {
  const wordsA = normalise(a).split(" ");
  const wordsB = normalise(b).split(" ");
  const setA = new Set(wordsA);
  const setB = new Set(wordsB);
  const intersectionSize = wordsA.filter((w) => setB.has(w)).length;
  const unionSize = new Set(wordsA.concat(wordsB)).size;
  return unionSize === 0 ? 0 : intersectionSize / unionSize;
}

/**
 * Get the next available generated question ID (gq001, gq002, ...).
 */
async function getNextGqId(): Promise<number> {
  const db = await getDb();
  if (!db) return 1;
  try {
    const rows = await db
      .select({ questionId: generatedQuestions.questionId })
      .from(generatedQuestions);
    if (rows.length === 0) return 1;
    const maxNum = rows.reduce((max, r) => {
      const n = parseInt(r.questionId.replace("gq", ""), 10);
      return isNaN(n) ? max : Math.max(max, n);
    }, 0);
    return maxNum + 1;
  } catch {
    return 1;
  }
}

/**
 * Main entry point: generate `totalCount` new questions, distribute evenly across
 * all 8 competencies and 3 year groups, balance correctIndex, and save to DB.
 * By default autoApprove=true so questions are immediately available in Practice/Challenge.
 */
export async function generateAndAppendQuestions(totalCount: number = 30, autoApprove: boolean = true): Promise<{
  added: number;
  breakdown: Record<string, number>;
  newTotal: number;
  pendingIds: string[];
}> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  // Distribute questions across competencies and year groups
  const totalSlots = COMPETENCY_CODES.length * YEAR_GROUPS.length; // 24
  const perSlot = Math.max(1, Math.round(totalCount / totalSlots));

  const batches = COMPETENCY_CODES.flatMap((competency) =>
    YEAR_GROUPS.map((yearGroup) => ({ competency, yearGroup, count: perSlot }))
  );

  const allNew: Array<GeneratedQuestion & { competency: CompetencyCode; yearGroup: YearGroup }> = [];

  for (const batch of batches) {
    try {
      const questions = await generateBatch(batch.competency, batch.yearGroup, batch.count);
      for (const q of questions) {
        allNew.push({ ...q, competency: batch.competency, yearGroup: batch.yearGroup });
      }
    } catch (err) {
      console.error(`[QuestionGenerator] Failed batch ${batch.competency}/${batch.yearGroup}:`, err);
    }
  }

  if (allNew.length === 0) {
    return { added: 0, breakdown: {}, newTotal: LOMLOE_QUESTIONS.length, pendingIds: [] };
  }

  // ── Duplicate detection ──────────────────────────────────────────────────────
  // Build a corpus of all existing question texts (static + DB) to check against.
  const existingTexts: string[] = LOMLOE_QUESTIONS.map((q) => q.question);
  try {
    const dbRows = await db.select({ question: generatedQuestions.question }).from(generatedQuestions);
    for (const r of dbRows) existingTexts.push(r.question);
  } catch { /* ignore — deduplication is best-effort */ }

  const SIMILARITY_THRESHOLD = 0.8; // 80% word overlap = duplicate
  let skippedDuplicates = 0;
  const deduped = allNew.filter((q) => {
    const isDuplicate = existingTexts.some((existing) => similarity(q.question, existing) >= SIMILARITY_THRESHOLD);
    if (isDuplicate) {
      skippedDuplicates++;
      return false;
    }
    // Add to corpus so we also deduplicate within this batch
    existingTexts.push(q.question);
    return true;
  });
  if (skippedDuplicates > 0) {
    console.log(`[QuestionGenerator] Skipped ${skippedDuplicates} duplicate(s) out of ${allNew.length} generated.`);
  }
  const uniqueNew = deduped;

  // Rebalance correctIndex evenly across 0/1/2/3
  uniqueNew.forEach((q, i) => {
    const target = i % 4;
    const current = q.correctIndex;
    if (current !== target) {
      const correct = q.options[current];
      const displaced = q.options[target];
      q.options[target] = correct;
      q.options[current] = displaced;
      q.correctIndex = target;
    }
  });

  // Get next sequential ID
  let nextId = await getNextGqId();

  // Save to DB
  const pendingIds: string[] = [];
  const breakdown: Record<string, number> = {};

  for (const q of uniqueNew) {
    const questionId = `gq${String(nextId).padStart(3, "0")}`;
    nextId++;
    try {
      await db.insert(generatedQuestions).values({
        questionId,
        competency: q.competency,
        yearGroup: q.yearGroup,
        question: q.question,
        options: JSON.stringify(q.options),
        correctIndex: q.correctIndex,
        explanation: q.explanation,
        status: autoApprove ? "approved" : "pending",
      });
      pendingIds.push(questionId);
      breakdown[q.competency] = (breakdown[q.competency] ?? 0) + 1;
    } catch (err) {
      console.error(`[QuestionGenerator] Failed to save question ${questionId}:`, err);
    }
  }

  // Count existing DB approved questions for total
  const dbApprovedCount = await db
    .select({ questionId: generatedQuestions.questionId })
    .from(generatedQuestions)
    .then((rows) => rows.length)
    .catch(() => 0);

  return {
    added: pendingIds.length,
    breakdown,
    newTotal: LOMLOE_QUESTIONS.length + dbApprovedCount,
    pendingIds,
  };
}
