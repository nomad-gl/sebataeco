import * as dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { writeFileSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: "/home/ubuntu/seba-ai-studio/.env" });

const FORGE_API_URL = (process.env.BUILT_IN_FORGE_API_URL?.replace(/\/$/, "") ?? "https://forge.manus.ai") + "/v1/chat/completions";
const FORGE_API_KEY = process.env.BUILT_IN_FORGE_API_KEY;

if (!FORGE_API_KEY) {
  console.error("BUILT_IN_FORGE_API_KEY not set");
  process.exit(1);
}

console.log("Using API:", FORGE_API_URL);

const COMPETENCIES = [
  { code: "CCL", name: "Linguistic Communication", description: "reading comprehension, writing skills, literary devices, grammar, vocabulary, text analysis, oral communication" },
  { code: "CP", name: "Multilingual Competence", description: "language learning strategies, bilingualism, translation, linguistic diversity, language awareness, communication in different languages" },
  { code: "STEM", name: "Mathematics & STEM", description: "mathematical reasoning, problem solving, scientific method, data analysis, geometry, algebra, statistics, technology, engineering thinking" },
  { code: "CD", name: "Digital Competence", description: "digital literacy, internet safety, online communication, data management, programming concepts, digital tools, cybersecurity, social media" },
  { code: "CPSAA", name: "Personal, Social & Learning to Learn", description: "self-regulation, growth mindset, teamwork, conflict resolution, emotional intelligence, study skills, metacognition, resilience" },
  { code: "CC", name: "Civic Competence", description: "democracy, human rights, citizenship, Spanish constitution, European Union, social justice, community participation, environmental responsibility" },
  { code: "CE", name: "Entrepreneurial Competence", description: "creativity, initiative, project planning, risk assessment, financial literacy, innovation, business ideas, problem identification, value creation" },
  { code: "CCEC", name: "Cultural Awareness & Expression", description: "art history, music, theatre, cultural heritage, creative expression, aesthetic appreciation, Spanish and world cultures, artistic techniques" },
];

const YEAR_GROUPS = [
  { code: "junior", label: "Primary Years 3-4 (ages 8-10)", ageNote: "simple vocabulary, concrete concepts, age-appropriate examples" },
  { code: "primary", label: "Upper Primary Years 5-6 (ages 10-12)", ageNote: "intermediate vocabulary, some abstract thinking, relatable examples" },
  { code: "secondary", label: "Secondary Years 7-10 (ages 12-16)", ageNote: "advanced vocabulary, abstract concepts, analytical thinking" },
];

async function callLLM(prompt) {
  const response = await fetch(FORGE_API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${FORGE_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content: "You are an expert Spanish LOMLOE curriculum question writer. Generate multiple-choice questions that are educationally rigorous, age-appropriate, and clearly aligned to the specified competency. Always respond with valid JSON only.",
        },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
      max_tokens: 8192,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`LLM error ${response.status}: ${text.substring(0, 200)}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error(`Empty content. finish_reason: ${data.choices?.[0]?.finish_reason}, usage: ${JSON.stringify(data.usage)}`);
  }
  return JSON.parse(content);
}

const allNewQuestions = [];
let questionCounter = 97; // Start from q097

for (const comp of COMPETENCIES) {
  console.log(`\nGenerating questions for ${comp.code} (${comp.name})...`);

  for (const yg of YEAR_GROUPS) {
    const count = yg.code === "secondary" ? 8 : 9;
    console.log(`  ${yg.code}: requesting ${count} questions...`);

    const prompt = `Generate exactly ${count} multiple-choice questions for the LOMLOE competency: ${comp.code} - ${comp.name}.

Topics to cover: ${comp.description}

Year group: ${yg.label}
Age-appropriate guidance: ${yg.ageNote}

Requirements:
- Each question must have exactly 4 answer options (array of 4 strings)
- Questions must be distinct and cover different aspects of the competency
- Vary the correctIndex across 0, 1, 2, 3 (do NOT always put the correct answer at the same position — spread them evenly)
- The explanation field must say: "The correct answer is '[exact correct option text]', which aligns with the ${comp.name} (${comp.code}) competency."
- Questions should be practical and scenario-based where possible
- All distractors must be plausible but clearly wrong

Return a JSON object with this exact structure:
{
  "questions": [
    {
      "question": "...",
      "options": ["option A", "option B", "option C", "option D"],
      "correctIndex": 0,
      "explanation": "The correct answer is '...', which aligns with the ${comp.name} (${comp.code}) competency."
    }
  ]
}

Return exactly ${count} questions in the array.`;

    try {
      const result = await callLLM(prompt);
      const questions = result.questions || [];

      for (const q of questions) {
        if (!Array.isArray(q.options) || q.options.length !== 4) {
          console.warn(`  WARNING: Question has ${q.options?.length} options (expected 4), skipping`);
          continue;
        }
        if (q.correctIndex < 0 || q.correctIndex >= q.options.length) {
          console.warn(`  WARNING: Invalid correctIndex ${q.correctIndex}, skipping`);
          continue;
        }
        allNewQuestions.push({
          id: `q${String(questionCounter).padStart(3, "0")}`,
          competency: comp.code,
          yearGroup: yg.code,
          question: q.question,
          options: q.options,
          correctIndex: q.correctIndex,
          explanation: q.explanation,
        });
        questionCounter++;
      }

      console.log(`  ✓ Got ${questions.length} questions (total so far: ${allNewQuestions.length})`);

      // Small delay to avoid rate limiting
      await new Promise((r) => setTimeout(r, 600));
    } catch (err) {
      console.error(`  ERROR for ${comp.code}/${yg.code}:`, err.message);
    }
  }
}

console.log(`\nTotal new questions generated: ${allNewQuestions.length}`);

// Save to JSON for review and processing
writeFileSync("/tmp/new_questions.json", JSON.stringify(allNewQuestions, null, 2));
console.log("Saved to /tmp/new_questions.json");
