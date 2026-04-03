/**
 * questionGenerator.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Generates new LOMLOE multiple-choice questions via the LLM and appends them
 * to the static knowledge bank file (lomloeKnowledgeBank.ts).
 *
 * This module is called:
 *  1. By the weekly scheduled task (every Monday at 04:00)
 *  2. By the admin tRPC procedure `lomloe.generateNewQuestions` for on-demand use
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { invokeLLM } from "./_core/llm";
import { LOMLOE_QUESTIONS, COMPETENCY_META, type CompetencyCode, type YearGroup } from "./knowledge/lomloeKnowledgeBank";

// ESM-compatible __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const KB_PATH = path.resolve(__dirname, "./knowledge/lomloeKnowledgeBank.ts");

const COMPETENCY_CODES: CompetencyCode[] = ["CCL", "CP", "STEM", "CD", "CPSAA", "CC", "CE", "CCEC"];
const YEAR_GROUPS: YearGroup[] = ["junior", "primary", "secondary"];

interface GeneratedQuestion {
  question: string;
  options: [string, string, string, string];
  correctIndex: number;
  explanation: string;
}

/**
 * Ask the LLM to generate `count` multiple-choice questions for the given
 * competency and year group.
 */
async function generateBatch(
  competency: CompetencyCode,
  yearGroup: YearGroup,
  count: number
): Promise<GeneratedQuestion[]> {
  const meta = COMPETENCY_META[competency];
  const yearLabel =
    yearGroup === "junior" ? "early primary (ages 6–8)"
    : yearGroup === "primary" ? "upper primary (ages 9–12)"
    : "secondary school (ages 12–16)";

  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `You are an expert in Spain's LOMLOE education law. Generate ${count} unique multiple-choice questions about the "${meta.name}" (${competency}) competency for ${yearLabel} students and teachers. Each question must:
- Be relevant to classroom teaching practice and the LOMLOE curriculum
- Have exactly 4 answer options
- Have the correct answer placed at a RANDOM position (0, 1, 2, or 3) — do NOT always put it at position 1
- Include a brief explanation of why the correct answer is right
- Be distinct from common knowledge and test genuine understanding
- Be written in English
Return ONLY a valid JSON array, no markdown.`,
      },
      {
        role: "user",
        content: `Generate ${count} questions now.`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "questions",
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
                  options: {
                    type: "array",
                    items: { type: "string" },
                  },
                  correctIndex: { type: "number" },
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

  const raw = response.choices?.[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(typeof raw === "string" ? raw : JSON.stringify(raw));
  const items: GeneratedQuestion[] = (parsed.questions ?? []).filter(
    (q: GeneratedQuestion) =>
      typeof q.question === "string" &&
      Array.isArray(q.options) &&
      q.options.length === 4 &&
      typeof q.correctIndex === "number" &&
      q.correctIndex >= 0 &&
      q.correctIndex <= 3
  );
  return items;
}

/**
 * Escape text for use inside a TypeScript template literal.
 */
function escapeTs(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
}

/**
 * Generate `totalCount` new questions (spread across competencies and year groups),
 * rebalance correctIndex distribution, and append them to the knowledge bank file.
 *
 * Returns a summary of what was added.
 */
export async function generateAndAppendQuestions(totalCount: number = 30): Promise<{
  added: number;
  breakdown: Record<string, number>;
  newTotal: number;
}> {
  // Determine next sequential question ID
  const existingIds = LOMLOE_QUESTIONS.map((q) => q.id);
  const maxNum = existingIds.reduce((max, id) => {
    const n = parseInt(id.replace("q", ""), 10);
    return isNaN(n) ? max : Math.max(max, n);
  }, 0);

  // Spread totalCount across competencies and year groups as evenly as possible
  // Each slot = (competency, yearGroup) pair — 24 slots total
  const slots: Array<{ competency: CompetencyCode; yearGroup: YearGroup }> = [];
  for (let i = 0; i < totalCount; i++) {
    const comp = COMPETENCY_CODES[i % COMPETENCY_CODES.length];
    const yg = YEAR_GROUPS[Math.floor(i / COMPETENCY_CODES.length) % YEAR_GROUPS.length];
    slots.push({ competency: comp, yearGroup: yg });
  }

  // Group slots by (competency, yearGroup) to batch LLM calls
  const batchMap = new Map<string, { competency: CompetencyCode; yearGroup: YearGroup; count: number }>();
  for (const slot of slots) {
    const key = `${slot.competency}:${slot.yearGroup}`;
    const existing = batchMap.get(key);
    if (existing) {
      existing.count++;
    } else {
      batchMap.set(key, { ...slot, count: 1 });
    }
  }

  // Generate questions for each batch
  const allNew: Array<GeneratedQuestion & { competency: CompetencyCode; yearGroup: YearGroup }> = [];
  for (const [, batch] of Array.from(batchMap)) {
    try {
      const items = await generateBatch(batch.competency, batch.yearGroup, batch.count);
      for (const item of items.slice(0, batch.count)) {
        allNew.push({ ...item, competency: batch.competency, yearGroup: batch.yearGroup });
      }
    } catch (err) {
      console.error(`[QuestionGenerator] Failed batch ${batch.competency}/${batch.yearGroup}:`, err);
    }
  }

  if (allNew.length === 0) {
    return { added: 0, breakdown: {}, newTotal: LOMLOE_QUESTIONS.length };
  }

  // Rebalance correctIndex evenly across 0/1/2/3
  const baseOffset = maxNum % 4; // continue the rotation from where we left off
  allNew.forEach((q, i) => {
    const target = (baseOffset + i) % 4;
    const current = q.correctIndex;
    if (current !== target) {
      const correct = q.options[current];
      const newOpts = q.options.filter((_, j) => j !== current);
      newOpts.splice(target, 0, correct);
      q.options = newOpts as [string, string, string, string];
      q.correctIndex = target;
      q.explanation = `The correct answer is '${correct}', which aligns with the ${q.competency} competency.`;
    }
  });

  // Build TypeScript source blocks
  const tsBlocks: string[] = [];
  allNew.forEach((q, i) => {
    const id = `q${String(maxNum + i + 1).padStart(3, "0")}`;
    const opts = q.options.map((o) => `\`${escapeTs(o)}\``).join(", ");
    tsBlocks.push(
      `  {\n` +
      `    id: '${id}',\n` +
      `    competency: '${q.competency}',\n` +
      `    yearGroup: '${q.yearGroup}',\n` +
      `    question: \`${escapeTs(q.question)}\`,\n` +
      `    options: [${opts}],\n` +
      `    correctIndex: ${q.correctIndex},\n` +
      `    explanation: \`${escapeTs(q.explanation)}\`,\n` +
      `  },`
    );
  });

  // Insert before the closing ]; of the LOMLOE_QUESTIONS array
  const content = fs.readFileSync(KB_PATH, "utf8");
  const insertMarker = "\n];";
  const insertPos = content.lastIndexOf(insertMarker);
  if (insertPos === -1) {
    throw new Error("[QuestionGenerator] Cannot find array end marker in knowledge bank file");
  }

  const newContent =
    content.slice(0, insertPos) +
    "\n" +
    tsBlocks.join("\n") +
    insertMarker +
    content.slice(insertPos + insertMarker.length);

  fs.writeFileSync(KB_PATH, newContent, "utf8");

  // Build breakdown by competency
  const breakdown: Record<string, number> = {};
  for (const q of allNew) {
    breakdown[q.competency] = (breakdown[q.competency] ?? 0) + 1;
  }

  return {
    added: allNew.length,
    breakdown,
    newTotal: LOMLOE_QUESTIONS.length + allNew.length,
  };
}
