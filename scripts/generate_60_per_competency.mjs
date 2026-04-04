/**
 * generate_60_per_competency.mjs
 *
 * Generates 480 English questions (60 per competency × 8 competencies,
 * 20 per year group per competency), balances correctIndex, and writes
 * a clean lomloeKnowledgeBank.ts replacing all existing questions.
 *
 * Run from project root: node scripts/generate_60_per_competency.mjs
 */
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../.env") });

const FORGE_API_URL = (process.env.BUILT_IN_FORGE_API_URL || "https://forge.manus.im").replace(/\/$/, "");
const FORGE_API_KEY = process.env.BUILT_IN_FORGE_API_KEY;

const COMPETENCIES = [
  { code: "CCL",   name: "Linguistic Communication",       desc: "using language effectively for communication, understanding, and expression in reading, writing, speaking and listening" },
  { code: "CP",    name: "Plurilingual Competency",         desc: "using multiple languages for communication, learning and intercultural understanding" },
  { code: "STEM",  name: "STEM Competency",                 desc: "scientific, technological, engineering and mathematical thinking, inquiry, problem solving and data literacy" },
  { code: "CD",    name: "Digital Competency",              desc: "safe, critical and responsible use of digital technologies, online safety, data privacy and digital citizenship" },
  { code: "CPSAA", name: "Personal, Social and Learning to Learn", desc: "self-awareness, emotional regulation, social skills, collaboration and strategies for lifelong learning" },
  { code: "CC",    name: "Citizenship Competency",          desc: "democratic values, human rights, civic participation, rule of law and responsible citizenship" },
  { code: "CE",    name: "Entrepreneurial Competency",      desc: "creativity, initiative, planning, risk-taking and turning ideas into action in real-world contexts" },
  { code: "CCEC",  name: "Cultural Awareness and Expression", desc: "appreciation, analysis and expression of cultural heritage, arts, music, literature and creativity" },
];

const YEAR_GROUPS = [
  { code: "junior",    label: "ages 6–9 (Primary Years 1–3)",   difficulty: "simple vocabulary, concrete examples, everyday situations" },
  { code: "primary",   label: "ages 9–12 (Primary Years 4–6)",  difficulty: "moderate complexity, some abstract thinking, real-world scenarios" },
  { code: "secondary", label: "ages 12–16 (Secondary ESO)",     difficulty: "higher-order thinking, critical analysis, nuanced scenarios" },
];

async function callLLM(messages) {
  const schema = {
    type: "object",
    properties: {
      questions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            question:     { type: "string" },
            options:      { type: "array", items: { type: "string" } },
            correctIndex: { type: "integer" },
            explanation:  { type: "string" },
          },
          required: ["question", "options", "correctIndex", "explanation"],
          additionalProperties: false,
        },
      },
    },
    required: ["questions"],
    additionalProperties: false,
  };

  const res = await fetch(`${FORGE_API_URL}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${FORGE_API_KEY}`,
    },
    body: JSON.stringify({
      messages,
      response_format: { type: "json_schema", json_schema: { name: "questions_array", strict: true, schema } },
    }),
  });

  if (!res.ok) throw new Error(`LLM ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Empty LLM response");
  const parsed = typeof content === "string" ? JSON.parse(content) : content;
  return (parsed.questions ?? []).filter(
    (q) => q.question && Array.isArray(q.options) && q.options.length === 4 &&
           typeof q.correctIndex === "number" && q.correctIndex >= 0 && q.correctIndex <= 3 && q.explanation
  );
}

async function generateBatch(comp, yg, batchNum, batchSize) {
  const prompt = `You are an expert in Spain's LOMLOE education curriculum.

CRITICAL RULES:
1. Write ALL output in English ONLY. No Spanish, Catalan, or any other language.
2. Generate exactly ${batchSize} multiple-choice questions.
3. Each question must have exactly 4 answer options.
4. Vary the correct answer position: use 0, 1, 2, and 3 roughly equally across the batch.
5. Questions must be age-appropriate for students ${yg.label}.
6. Use ${yg.difficulty}.
7. Each question must test a different aspect of the competency.
8. Do NOT repeat questions from previous batches.

Competency: ${comp.name}
Focus: ${comp.desc}
Year group: ${yg.label}
Batch: ${batchNum} (generate different questions than previous batches)

Return JSON only.`;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const qs = await callLLM([
        { role: "system", content: "You are an expert LOMLOE curriculum designer. You ALWAYS write in English only. Return only valid JSON." },
        { role: "user",   content: prompt },
      ]);
      if (qs.length >= Math.floor(batchSize * 0.7)) return qs.slice(0, batchSize);
      console.log(`  Retry ${attempt + 1}: got ${qs.length}/${batchSize}`);
    } catch (e) {
      console.error(`  Error attempt ${attempt + 1}:`, e.message);
    }
    await new Promise(r => setTimeout(r, 1000));
  }
  return [];
}

function escapeTs(str) {
  return str.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$/g, "\\$");
}

async function main() {
  const allQuestions = [];
  let qNum = 1;

  // 20 questions per (competency × yearGroup) = 60 per competency = 480 total
  // We generate in 2 batches of 10 per (comp, yg) to get variety
  for (const comp of COMPETENCIES) {
    for (const yg of YEAR_GROUPS) {
      console.log(`Generating ${comp.code}/${yg.code} (20 questions in 2 batches)...`);
      const batchA = await generateBatch(comp, yg, 1, 10);
      await new Promise(r => setTimeout(r, 600));
      const batchB = await generateBatch(comp, yg, 2, 10);
      const combined = [...batchA, ...batchB].slice(0, 20);
      console.log(`  Got ${combined.length} questions`);
      for (const q of combined) {
        allQuestions.push({ ...q, competency: comp.code, yearGroup: yg.code, num: qNum++ });
      }
      await new Promise(r => setTimeout(r, 400));
    }
  }

  console.log(`\nTotal generated: ${allQuestions.length}`);

  // Rebalance correctIndex: within each (competency, yearGroup) group, cycle 0,1,2,3
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
        const correct   = q.options[q.correctIndex];
        const displaced = q.options[target];
        q.options[target]          = correct;
        q.options[q.correctIndex]  = displaced;
        q.correctIndex             = target;
      }
    });
  }

  // Read existing file to preserve header (type defs, COMPETENCY_META) and helper functions
  const existingFile = readFileSync(join(__dirname, "../server/knowledge/lomloeKnowledgeBank.ts"), "utf8");
  const arrayStart   = existingFile.indexOf("export const LOMLOE_QUESTIONS");
  const helperStart  = existingFile.indexOf("\nexport function", arrayStart);
  const header  = existingFile.slice(0, arrayStart);
  const helpers = existingFile.slice(helperStart);

  // Build the new array
  let arrayTs = "export const LOMLOE_QUESTIONS: LOMLOEQuestion[] = [\n";
  for (const q of allQuestions) {
    const id   = `q${String(q.num).padStart(3, "0")}`;
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

  // Distribution summary
  const perComp = {};
  const ciDist  = [0, 0, 0, 0];
  for (const q of allQuestions) {
    perComp[q.competency] = (perComp[q.competency] || 0) + 1;
    ciDist[q.correctIndex]++;
  }
  console.log("\nPer-competency count:");
  for (const [k, v] of Object.entries(perComp)) console.log(`  ${k}: ${v}`);
  console.log("\ncorrectIndex distribution:", ciDist);
}

main().catch(console.error);
