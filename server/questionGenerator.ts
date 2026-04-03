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
const YEAR_GROUPS: YearGroup[] = ["junior", "primary", "secondary"];

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
  const yearDesc =
    yearGroup === "junior"
      ? "ages 6-9 (Primary Years 1-3)"
      : yearGroup === "primary"
      ? "ages 9-12 (Primary Years 4-6)"
      : "ages 12-16 (Secondary ESO)";

  const prompt = `You are an expert in Spain's LOMLOE education curriculum. Generate exactly ${count} multiple-choice questions about the "${meta.name}" competency (${meta.description}) for students aged ${yearDesc}.

Requirements:
- Each question must have exactly 4 options (A, B, C, D)
- Distribute the correct answer position: use different positions (0, 1, 2, 3) across questions — do NOT always put the correct answer at position 1
- Questions should be clear, age-appropriate, and curriculum-aligned
- Include a brief explanation of why the correct answer is right
- Questions should test understanding, not just recall

Return a JSON array of exactly ${count} objects with this structure:
{
  "question": "Question text here?",
  "options": ["Option A", "Option B", "Option C", "Option D"],
  "correctIndex": 0,
  "explanation": "Brief explanation of the correct answer"
}`;

  const response = await invokeLLM({
    messages: [
      { role: "system", content: "You are an expert curriculum designer. Return only valid JSON arrays, no markdown." },
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
 * all 8 competencies and 3 year groups, balance correctIndex, and save to DB as 'pending'.
 */
export async function generateAndAppendQuestions(totalCount: number = 30): Promise<{
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

  // Rebalance correctIndex evenly across 0/1/2/3
  allNew.forEach((q, i) => {
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

  for (const q of allNew) {
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
        status: "pending",
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
