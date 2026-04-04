/**
 * regenerate_english_kb.mjs
 * Regenerates all 240 knowledge bank questions in English (30 per competency,
 * 10 per year group), balances correctIndex, and writes the full TS file.
 *
 * Run from project root: node scripts/regenerate_english_kb.mjs
 */
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../.env") });

const FORGE_API_URL = process.env.BUILT_IN_FORGE_API_URL;
const FORGE_API_KEY = process.env.BUILT_IN_FORGE_API_KEY;

const COMPETENCIES = [
  { code: "CCL", name: "Linguistic Communication", description: "ability to use language effectively for communication, understanding, and expression" },
  { code: "CP",  name: "Plurilingual Competency", description: "ability to use multiple languages for communication and learning" },
  { code: "STEM", name: "STEM Competency", description: "scientific, technological, engineering and mathematical thinking and problem solving" },
  { code: "CD",  name: "Digital Competency", description: "safe, critical and responsible use of digital technologies" },
  { code: "CPSAA", name: "Personal, Social and Learning to Learn", description: "self-awareness, social skills, and strategies for lifelong learning" },
  { code: "CC",  name: "Citizenship Competency", description: "understanding democratic values, rights, responsibilities and civic participation" },
  { code: "CE",  name: "Entrepreneurial Competency", description: "creativity, initiative, and ability to turn ideas into action" },
  { code: "CCEC", name: "Cultural Awareness and Expression", description: "appreciation and expression of cultural heritage, arts and creativity" },
];
const YEAR_GROUPS = [
  { code: "junior",    desc: "ages 6-9 (Primary Years 1-3)" },
  { code: "primary",   desc: "ages 9-12 (Primary Years 4-6)" },
  { code: "secondary", desc: "ages 12-16 (Secondary ESO)" },
];

async function callLLM(messages, schema) {
  const baseUrl = (FORGE_API_URL || "https://forge.manus.im").replace(/\/$/, "");
  const res = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${FORGE_API_KEY}`,
    },
    body: JSON.stringify({
      messages,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "questions_array",
          strict: true,
          schema,
        },
      },
    }),
  });
  if (!res.ok) throw new Error(`LLM error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Empty LLM response");
  return typeof content === "string" ? JSON.parse(content) : content;
}

async function generateBatch(comp, yg, count) {
  const prompt = `You are an expert in Spain's LOMLOE education curriculum.

CRITICAL: ALL output MUST be in English. Do not write any Spanish, Catalan, or other language.

Generate exactly ${count} multiple-choice questions about the "${comp.name}" competency (${comp.description}) for students aged ${yg.desc}.

Requirements:
- Write EVERYTHING in English only
- Each question must have exactly 4 options
- Distribute correct answer positions evenly: use 0, 1, 2, 3 across questions
- Questions should be clear, age-appropriate, and curriculum-aligned
- Include a brief English explanation of why the correct answer is right
- Test understanding, not just recall`;

  const schema = {
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
  };

  const result = await callLLM(
    [
      { role: "system", content: "You are an expert curriculum designer. You ALWAYS write in English only. Return only valid JSON." },
      { role: "user", content: prompt },
    ],
    schema
  );
  return (result.questions ?? []).filter(
    (q) =>
      q.question && Array.isArray(q.options) && q.options.length === 4 &&
      typeof q.correctIndex === "number" && q.correctIndex >= 0 && q.correctIndex <= 3 && q.explanation
  );
}

function escapeTs(str) {
  return str.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$/g, "\\$");
}

async function main() {
  const allQuestions = [];
  let qNum = 1;

  for (const comp of COMPETENCIES) {
    for (const yg of YEAR_GROUPS) {
      console.log(`Generating ${comp.code}/${yg.code}...`);
      let batch = [];
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          batch = await generateBatch(comp, yg, 10);
          if (batch.length >= 8) break;
          console.log(`  Retry ${attempt + 1} (got ${batch.length})`);
        } catch (e) {
          console.error(`  Error attempt ${attempt + 1}:`, e.message);
        }
      }
      // Take up to 10
      for (const q of batch.slice(0, 10)) {
        allQuestions.push({ ...q, competency: comp.code, yearGroup: yg.code, num: qNum++ });
      }
      // Small delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 500));
    }
  }

  console.log(`\nGenerated ${allQuestions.length} questions total.`);

  // Rebalance correctIndex: within each (competency, yearGroup) group cycle 0,1,2,3
  const groups = {};
  for (const q of allQuestions) {
    const key = `${q.competency}-${q.yearGroup}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(q);
  }
  for (const qs of Object.values(groups)) {
    qs.forEach((q, i) => {
      const target = i % 4;
      if (q.correctIndex !== target) {
        const correct = q.options[q.correctIndex];
        const displaced = q.options[target];
        q.options[target] = correct;
        q.options[q.correctIndex] = displaced;
        q.correctIndex = target;
      }
    });
  }

  // Read the existing file to preserve the header (type definitions, COMPETENCY_META, helper functions)
  const existingFile = readFileSync(join(__dirname, "../server/knowledge/lomloeKnowledgeBank.ts"), "utf8");

  // Find where LOMLOE_QUESTIONS array starts
  const arrayStart = existingFile.indexOf("export const LOMLOE_QUESTIONS");
  // Find where the helper functions start (after the closing ]; of the array)
  const helperStart = existingFile.indexOf("\nexport function", arrayStart);

  const header = existingFile.slice(0, arrayStart);
  const helpers = existingFile.slice(helperStart);

  // Build the new array
  let arrayTs = "export const LOMLOE_QUESTIONS: LOMLOEQuestion[] = [\n";
  for (const q of allQuestions) {
    const id = `q${String(q.num).padStart(3, "0")}`;
    const opts = q.options.map(o => `\`${escapeTs(o)}\``).join(", ");
    arrayTs += `  {\n`;
    arrayTs += `    id: '${id}',\n`;
    arrayTs += `    competency: '${q.competency}',\n`;
    arrayTs += `    yearGroup: '${q.yearGroup}',\n`;
    arrayTs += `    question: \`${escapeTs(q.question)}\`,\n`;
    arrayTs += `    options: [${opts}],\n`;
    arrayTs += `    correctIndex: ${q.correctIndex},\n`;
    arrayTs += `    explanation: \`${escapeTs(q.explanation)}\`,\n`;
    arrayTs += `  },\n`;
  }
  arrayTs += "];\n";

  const newFile = header + arrayTs + helpers;
  writeFileSync(join(__dirname, "../server/knowledge/lomloeKnowledgeBank.ts"), newFile, "utf8");
  console.log(`\nWrote ${allQuestions.length} questions to lomloeKnowledgeBank.ts`);

  // Verify distribution
  const dist = {};
  for (const q of allQuestions) {
    dist[q.competency] = (dist[q.competency] || 0) + 1;
  }
  console.log("\nPer-competency distribution:");
  for (const [k, v] of Object.entries(dist)) console.log(`  ${k}: ${v}`);

  const ciDist = [0,0,0,0];
  for (const q of allQuestions) ciDist[q.correctIndex]++;
  console.log("\ncorrectIndex distribution:", ciDist);
}

main().catch(console.error);
