import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { ENV } from "../_core/env";
import { invokeLLM } from "../_core/llm";
import { checkBias } from "../biasGuard";
import { generateImage } from "../_core/imageGeneration";
import { storagePut } from "../storage";
import {
  savePracticeSession,
  getSessionsByUser,
  saveMaterial,
  getMaterialsByUser,
  getMaterialById,
  deleteMaterial,
  updateMaterial,
} from "../db";
import { COMPETENCY_META, getQuestions, type CompetencyCode, type YearGroup } from "../knowledge/lomloeKnowledgeBank";

const CompetencyCodeSchema = z.enum(["CCL", "CP", "STEM", "CD", "CPSAA", "CC", "CE", "CCEC"]);
const YearGroupSchema = z.enum(["infantil", "lower_primary", "junior", "primary", "secondary"]);
const MaterialTypeSchema = z.enum(["quiz", "slides", "crossword", "missing_words", "wordsearch", "flashcards", "paraula"]);

// --- Helpers ---

function ygLabel(yg?: string) {
  if (yg === "infantil") return "Educació Infantil (0–6 anys, Decret 21/2023)";
  if (yg === "lower_primary") return "Primary (Years 1–2, ages 5–7)";
  if (yg === "junior") return "Primary (Years 3–4, ages 8–10)";
  if (yg === "primary") return "Upper Primary (Years 5–6, ages 10–12)";
  if (yg === "secondary") return "Secondary (Years 7–10, ages 12–16)";
  return "all year groups";
}

function compLabel(c?: string) {
  if (!c) return "all 8 LOMLOE competencies";
  const m = COMPETENCY_META[c as CompetencyCode];
  return m ? `${m.name} (${c}) — ${m.description}` : c;
}

// --- Rich system prompts ---

function buildSystemPrompt(type: string, competency?: string, yearGroup?: string): string {
  const comp = compLabel(competency);
  const yg = ygLabel(yearGroup);

  const base = `You are an expert Spanish curriculum designer and subject-matter researcher aligned to LOMLOE standards.
Competency: ${comp}.
Year group: ${yg}.

Your task is to research the given topic thoroughly and create a high-quality, educationally rich ${type} activity.
- Content must be accurate, age-appropriate, and directly aligned to the stated LOMLOE competency goals.
- Use real facts, proper terminology, and curriculum-relevant examples.
- Respond ONLY with valid JSON matching the exact schema below. No markdown fences, no commentary, no extra keys.`;

  const schemas: Record<string, string> = {
    quiz: `
Schema:
{
  "title": string,                    // e.g. "The Water Cycle – STEM Quiz"
  "subject": string,                  // subject area
  "competency": string,               // competency code
  "yearGroup": string,                // year group label
  "questions": [
    {
      "question": string,             // clear, unambiguous question
      "options": [string, string, string, string],  // 4 plausible options; only one correct
      "correctIndex": number,         // 0-based index of correct option
      "explanation": string           // 2-3 sentence explanation of why the answer is correct, referencing the topic
    }
  ]
}
Generate exactly 10 questions. Vary question types (factual recall, application, analysis). Ensure distractors are plausible but clearly wrong.`,

    slides: `
Schema:
{
  "title": string,
  "subject": string,
  "competency": string,
  "yearGroup": string,
  "keyVocabulary": [{ "term": string, "definition": string }],   // 6-8 key terms
  "slides": [
    {
      "heading": string,
      "bullets": [string],            // 3-5 substantive bullet points with real content
      "speakerNote": string,          // 2-3 sentences for the teacher; teaching tips, pacing guidance
      "talkingPoints": [string],      // 3-4 open-ended discussion questions or prompts the tutor can use to spark class conversation about this slide's content
      "imagePrompt": string           // descriptive prompt for an educational diagram or illustration
    }
  ]
}
Generate 8-10 slides total using this FIXED structure:
- Slide 1 (FRONT PAGE): Title slide. heading = presentation title. bullets = [subject, year group, competency, teacher name placeholder]. speakerNote = brief welcome/intro note. talkingPoints = []. imagePrompt = a relevant hero illustration for the topic.
- Slides 2 to N-2 (CONTENT SLIDES): Each covers a distinct subtopic or concept. 3-5 substantive bullets with real factual content. talkingPoints must be genuine open-ended questions that encourage critical thinking and discussion.
- Slide N-1 (SUMMARY / RECAP): heading = "Summary & Key Takeaways". bullets = 4-6 concise takeaways recapping the most important points from the content slides. talkingPoints = 2-3 reflection questions. speakerNote = guidance on how to run a class recap activity.
- Slide N (CLOSING / THANK YOU): heading = "Thank You & Resources". bullets = ["Thank you for attending!", "Further reading: [2-3 real book/website titles relevant to the topic]", "Image credits: [list any notable image sources]", "Prepared with SEBA AI Studio – aina.forum"]. speakerNote = closing remarks and Q&A invitation. talkingPoints = []. imagePrompt = a warm, positive closing illustration.
Each bullet must contain real factual content, not generic placeholders.`,

    crossword: `
Schema:
{
  "title": string,
  "subject": string,
  "competency": string,
  "yearGroup": string,
  "words": [
    {
      "number": number,               // clue number (1-based)
      "word": string,                 // UPPERCASE, single word, no spaces
      "clue": string,                 // clear definition or description clue
      "direction": "across" | "down",
      "row": number,                  // 0-based row of first letter
      "col": number                   // 0-based column of first letter
    }
  ]
}
Generate exactly 12 words. Words MUST intersect at shared letters (standard crossword rules). Place words in a 15×15 grid. Mix across and down. Use topic-specific vocabulary. Clues should be educational definitions, not just synonyms.`,

    missing_words: `
Schema:
{
  "title": string,
  "subject": string,
  "competency": string,
  "yearGroup": string,
  "introduction": string,            // 1-2 sentence context for the passage
  "passage": string,                 // 150-200 word passage; use ___ for each blank (exactly 10 blanks)
  "wordBank": [string],              // the 10 correct answers in shuffled order
  "blanks": [
    {
      "position": number,            // 1-based blank number in order of appearance
      "answer": string,              // correct word
      "hint": string                 // grammatical or contextual hint, e.g. "noun, plural" or "past tense verb"
    }
  ]
}
The passage must be coherent, educational, and contain exactly 10 blanks (___). The word bank must be shuffled (not in order of appearance). All blanked words must be key topic vocabulary.`,

    wordsearch: `
Schema:
{
  "title": string,
  "subject": string,
  "competency": string,
  "yearGroup": string,
  "words": [
    {
      "word": string,                // UPPERCASE single word
      "clue": string                 // brief definition or description
    }
  ],
  "grid": [[string]],               // 15×15 2D array of uppercase letters; words placed correctly, remaining cells filled with random uppercase letters
  "gridSize": 15
}
Generate exactly 15 words. Place ALL words correctly in the grid (horizontally left-to-right, vertically top-to-bottom, or diagonally). Fill remaining cells with random uppercase letters. Words must not overlap incorrectly.`,

    flashcards: `
Schema:
{
  "title": string,
  "subject": string,
  "competency": string,
  "yearGroup": string,
  "cards": [
    {
      "term": string,                // key term, concept, or question
      "definition": string,         // clear, age-appropriate definition or answer (2-3 sentences)
      "example": string,            // concrete real-world example
      "competencyHint": string      // how this term relates to the LOMLOE competency
    }
  ]
}
Generate exactly 16 flashcards. Cover the most important concepts, vocabulary, and facts for the topic. Definitions must be substantive, not one-word answers.`,

    paraula: `
Schema:
{
  "title": string,                   // e.g. "El Cicle de l'Aigua – PARAULA"
  "subject": string,
  "competency": string,
  "yearGroup": string,
  "lang": "ca" | "es" | "en",        // primary language of the words
  "words": [string],                 // EXACTLY 20 topic-related 5-letter words, UPPERCASE, no accents, no spaces, no hyphens
  "clues": [string]                  // one short clue/definition per word (same order as words array)
}
Rules:
- Every word must be EXACTLY 5 letters (A-Z only, no accents, no special chars).
- Words must be real vocabulary directly related to the topic.
- For Catalan topics use Catalan words; for Spanish topics use Spanish; for English topics use English.
- Strip accents: ÀÁÂÃÄ→A, ÈÉÊË→E, ÌÍÎÏ→I, ÒÓÔÕÖ→O, ÙÚÛÜ→U, Ç→C (for word list only).
- Generate exactly 20 words. No duplicates.
- Each clue must be a brief educational definition (max 8 words).`,
  };

  return `${base}\n${schemas[type] ?? ""}`;
}

// --- Content rule validators / auto-fixers ---

function validateAndFixSlides(parsed: Record<string, unknown>): Record<string, unknown> {
  const slides = (parsed.slides as Array<Record<string, unknown>> | undefined) ?? [];
  const fixed = slides
    .filter((s) => s.heading)
    .map((s) => ({
      heading: String(s.heading ?? ""),
      bullets: Array.isArray(s.bullets) ? s.bullets.map(String) : [],
      speakerNote: String(s.speakerNote ?? ""),
      talkingPoints: Array.isArray(s.talkingPoints) ? s.talkingPoints.map(String) : [],
      imagePrompt: String(s.imagePrompt ?? ""),
      keyVocabulary: Array.isArray(s.keyVocabulary) ? s.keyVocabulary : [],
    }));
  return { ...parsed, slides: fixed.length >= 3 ? fixed : slides };
}

function validateAndFixQuiz(parsed: Record<string, unknown>): Record<string, unknown> {
  const questions = (parsed.questions as Array<Record<string, unknown>> | undefined) ?? [];
  const fixed = questions
    .filter((q) => q.question && Array.isArray(q.options))
    .map((q) => {
      // Ensure exactly 4 options
      const opts = (q.options as string[]).slice(0, 4);
      while (opts.length < 4) opts.push(`Option ${opts.length + 1}`);
      // Clamp correctIndex
      const ci = Math.max(0, Math.min(3, Number(q.correctIndex ?? 0)));
      // Ensure explanation exists
      const explanation = (q.explanation as string) || `The correct answer is "${opts[ci]}".`;
      return { ...q, options: opts, correctIndex: ci, explanation };
    });
  // Ensure at least 5 questions
  return { ...parsed, questions: fixed.length >= 5 ? fixed : questions };
}

function validateAndFixCrossword(parsed: Record<string, unknown>): Record<string, unknown> {
  const words = (parsed.words as Array<Record<string, unknown>> | undefined) ?? [];
  // Ensure words are uppercase single tokens
  const fixed = words.map((w, i) => ({
    ...w,
    number: w.number ?? i + 1,
    word: String(w.word ?? "").toUpperCase().replace(/[^A-Z]/g, ""),
    clue: w.clue ?? `Definition of ${w.word}`,
    direction: w.direction === "down" ? "down" : "across",
    row: Number(w.row ?? 0),
    col: Number(w.col ?? 0),
  })).filter((w) => w.word.length >= 3);
  return { ...parsed, words: fixed };
}

function validateAndFixMissingWords(parsed: Record<string, unknown>): Record<string, unknown> {
  const passage = String(parsed.passage ?? "");
  const blanks = (parsed.blanks as Array<Record<string, unknown>> | undefined) ?? [];
  const wordBank = (parsed.wordBank as string[] | undefined) ?? [];
  // Count blanks in passage
  const blankCount = (passage.match(/___/g) ?? []).length;
  // Ensure wordBank has at least as many entries as blanks
  const fixedBank = wordBank.length >= blankCount ? wordBank : [
    ...wordBank,
    ...blanks.map((b) => String(b.answer ?? "")).filter((a) => !wordBank.includes(a)),
  ];
  return { ...parsed, wordBank: fixedBank, blanks };
}

function validateAndFixWordsearch(parsed: Record<string, unknown>, size = 15): Record<string, unknown> {
  const words = (parsed.words as Array<{ word: string; clue: string } | string> | undefined) ?? [];
  const wordList = words.map((w) =>
    typeof w === "string" ? w.toUpperCase() : w.word.toUpperCase()
  ).filter((w) => w.length >= 3 && w.length <= size);
  // Auto-size grid: min 12, max 20, at least word_count + 2
  const autoSize = Math.max(12, Math.min(20, wordList.length + 2));
  const gridSize = Number(parsed.gridSize ?? autoSize);
  const finalSize = Math.max(gridSize, autoSize);
  // Always rebuild grid server-side for correctness
  const grid = buildWordsearchGrid(wordList, finalSize);
  return { ...parsed, words, grid, gridSize: finalSize };
}

// --- Wordsearch grid builder (server-side fallback) ---

function buildWordsearchGrid(words: string[], size = 15): string[][] {
  const grid: string[][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => String.fromCharCode(65 + Math.floor(Math.random() * 26)))
  );
  const directions = [
    [0, 1],   // horizontal
    [1, 0],   // vertical
    [1, 1],   // diagonal down-right
  ];
  for (const word of words) {
    let placed = false;
    for (let attempt = 0; attempt < 200 && !placed; attempt++) {
      const [dr, dc] = directions[Math.floor(Math.random() * directions.length)]!;
      const maxRow = dr === 0 ? size - 1 : size - word.length;
      const maxCol = dc === 0 ? size - 1 : size - word.length;
      if (maxRow < 0 || maxCol < 0) continue;
      const row = Math.floor(Math.random() * (maxRow + 1));
      const col = Math.floor(Math.random() * (maxCol + 1));
      // Check no conflict
      let ok = true;
      for (let i = 0; i < word.length; i++) {
        const r = row + dr * i, c = col + dc * i;
        if (grid[r]![c] !== word[i] && grid[r]![c] !== grid[r]![c]) {
          // cell already has a different letter from a previous word
          const existing = grid[r]![c]!;
          if (existing !== word[i] && existing.match(/[A-Z]/) && words.some(w => w.includes(existing))) {
            ok = false; break;
          }
        }
      }
      if (ok) {
        for (let i = 0; i < word.length; i++) {
          grid[row + dr * i]![col + dc * i] = word[i]!;
        }
        placed = true;
      }
    }
  }
  return grid;
}

function validateAndFixParaula(parsed: Record<string, unknown>): Record<string, unknown> {
  const rawWords = (parsed.words as string[] | undefined) ?? [];
  const rawClues = (parsed.clues as string[] | undefined) ?? [];
  // Keep only valid 5-letter uppercase words (strip accents, non-alpha)
  const fixed: string[] = [];
  const fixedClues: string[] = [];
  for (let i = 0; i < rawWords.length; i++) {
    const w = String(rawWords[i] ?? "")
      .toUpperCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Z]/g, "");
    if (w.length === 5 && !fixed.includes(w)) {
      fixed.push(w);
      fixedClues.push(String(rawClues[i] ?? `Word ${fixed.length}`));
    }
  }
  // Pad to 20 if LLM returned fewer valid words
  const lang = String(parsed.lang ?? "ca");
  const fallbacks = lang === "es"
    ? ["LIBRO","CLASE","PAPEL","LAPIZ","TABLA","CAMPO","CIELO","TIERRA","FUEGO","AGUA0","PLUMA","CARTA","BOLSA","COCHE","TECHO","SUELO","PUERTA","MANOS","OJOS0","BOCA0"]
    : lang === "en"
    ? ["WATER","EARTH","LIGHT","PLANT","CLOUD","STONE","FLAME","RIVER","OCEAN","STORM","GRASS","FIELD","TOWER","BREAD","CHAIR","TABLE","CLOCK","PAPER","BRUSH","PAINT"]
    : ["PLUJA","TERRA","LLUNA","SOLEI","FLORS","ARBOR","CAMPS","PRATS","RIURE","CANTS","PORTA","TAULA","PAPER","LLUMS","VENTS","MARES","PEIXS","OCELL","HERBA","PEDRA"];
  let fi = 0;
  while (fixed.length < 20 && fi < fallbacks.length) {
    const fb = fallbacks[fi++]!;
    if (!fixed.includes(fb)) { fixed.push(fb); fixedClues.push(`Paraula ${fixed.length}`); }
  }
  return { ...parsed, words: fixed.slice(0, 20), clues: fixedClues.slice(0, 20), lang };
}

// --- Router ---

export const materialsRouter = router({
  //  - Progress tracker -

  saveSession: protectedProcedure
    .input(z.object({
      competency: CompetencyCodeSchema.nullish(),
      yearGroup: YearGroupSchema.nullish(),
      score: z.number().min(0),
      total: z.number().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      await savePracticeSession({
        userId: ctx.user.id,
        competency: input.competency ?? null,
        yearGroup: input.yearGroup ?? null,
        score: input.score,
        total: input.total,
      });
      return { success: true };
    }),

  getMyProgress: protectedProcedure.query(async ({ ctx }) => {
    const sessions = await getSessionsByUser(ctx.user.id);
    const byCompetency: Record<string, { sessions: number; totalScore: number; totalQ: number }> = {};
    for (const s of sessions) {
      const key = s.competency ?? "all";
      if (!byCompetency[key]) byCompetency[key] = { sessions: 0, totalScore: 0, totalQ: 0 };
      byCompetency[key].sessions++;
      byCompetency[key].totalScore += s.score;
      byCompetency[key].totalQ += s.total;
    }
    const chart = Object.entries(byCompetency).map(([code, d]) => ({
      code,
      name: code === "all" ? "All Competencies" : (COMPETENCY_META[code as CompetencyCode]?.name ?? code),
      avgPct: d.totalQ > 0 ? Math.round((d.totalScore / d.totalQ) * 100) : 0,
      sessions: d.sessions,
    }));
    return { sessions: sessions.slice(0, 20), chart };
  }),

  // Teaching materials

  // generate: LLM call + content rules, does NOT save to DB
  generate: protectedProcedure
    .input(z.object({
      type: MaterialTypeSchema,
      topic: z.string().min(2).max(200),
      competency: CompetencyCodeSchema.nullish(),
      yearGroup: YearGroupSchema.nullish(),
    }))
    .mutation(async ({ input }) => {
      const systemPrompt = buildSystemPrompt(input.type, input.competency ?? undefined, input.yearGroup ?? undefined);
      const contextQs = getQuestions(
        (input.competency ?? undefined) as CompetencyCode | undefined,
        (input.yearGroup ?? undefined) as YearGroup | undefined
      ).slice(0, 6);
      const contextText = contextQs.length > 0
        ? `\n\nLOMLOE knowledge bank alignment examples (use as style/difficulty reference only):\n${contextQs.map(q => `- ${q.question} → ${q.options[q.correctIndex]}`).join("\n")}`
        : "";
      const userPrompt = `Topic: "${input.topic}"${contextText}\n\nResearch this topic thoroughly and generate the complete ${input.type} activity now. All content must be factually accurate and educationally rich.`;
      const response = await invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      });
      const rawContent = String(response.choices?.[0]?.message?.content ?? "{}");
      // Bias guard: scan generated content before returning to teacher
      const biasResult = await checkBias(userPrompt, rawContent, undefined, undefined);
      const guardedContent = biasResult.safeOutput;
      let parsed: Record<string, unknown>;
      try {
        const cleaned = guardedContent.replace(/^```json?\n?/, "").replace(/\n?```$/, "").trim();
        parsed = JSON.parse(cleaned) as Record<string, unknown>;
      } catch (err) {
        console.error("JSON parsing failed. Raw content:", rawContent.substring(0, 500));
        console.error("Guarded content:", guardedContent.substring(0, 500));
        console.error("Parse error:", err instanceof Error ? err.message : String(err));
        throw new Error("AI returned invalid JSON. Please try again.");
      }
      if (input.type === "slides")        parsed = validateAndFixSlides(parsed);
      if (input.type === "quiz")          parsed = validateAndFixQuiz(parsed);
      if (input.type === "crossword")     parsed = validateAndFixCrossword(parsed);
      if (input.type === "missing_words") parsed = validateAndFixMissingWords(parsed);
      if (input.type === "wordsearch")    parsed = validateAndFixWordsearch(parsed);
      if (input.type === "paraula")       parsed = validateAndFixParaula(parsed);
      const title = (parsed.title as string) ?? `${input.type} – ${input.topic}`;
      return { title, type: input.type, topic: input.topic, content: parsed };
    }),

  // save: write a previously generated draft to DB
  save: protectedProcedure
    .input(z.object({
      type: MaterialTypeSchema,
      topic: z.string().min(2).max(200),
      competency: CompetencyCodeSchema.nullish(),
      yearGroup: YearGroupSchema.nullish(),
      title: z.string(),
      content: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const id = await saveMaterial({
        userId: ctx.user.id,
        type: input.type,
        title: input.title,
        topic: input.topic,
        competency: input.competency ?? null,
        yearGroup: input.yearGroup ?? null,
        content: input.content,
      });
      return { id, title: input.title };
    }),

  // create: legacy alias used by challenge derivation (generate + save in one step)
  create: protectedProcedure
    .input(z.object({
      type: MaterialTypeSchema,
      topic: z.string().min(2).max(200),
      competency: CompetencyCodeSchema.nullish(),
      yearGroup: YearGroupSchema.nullish(),
      slideCount: z.number().int().min(3).max(12).nullish(),
      includeTalkingPoints: z.boolean().nullish(),
      school: z.string().max(200).nullish(),
    }))
    .mutation(async ({ ctx, input }) => {
      // For slides, override the default count instruction if the user specified one
      let systemPrompt = buildSystemPrompt(input.type, input.competency ?? undefined, input.yearGroup ?? undefined);
      if (input.type === "slides" && input.slideCount) {
        // The 3 structural slides (front, summary, closing) are always included.
        // slideCount refers to content slides; total = slideCount + 3.
        const totalSlides = input.slideCount + 3;
        systemPrompt = systemPrompt.replace(
          /Generate \d+-\d+ slides total[^`]*/,
          `Generate exactly ${totalSlides} slides total using this FIXED structure:\n- Slide 1 (FRONT PAGE): Title slide. heading = presentation title. bullets = [subject, year group, competency, teacher name placeholder]. speakerNote = brief welcome/intro note. talkingPoints = []. imagePrompt = a relevant hero illustration for the topic.\n- Slides 2 to ${totalSlides - 2} (CONTENT SLIDES): Each covers a distinct subtopic or concept. 3-5 substantive bullets with real factual content. talkingPoints must be genuine open-ended questions that encourage critical thinking and discussion.\n- Slide ${totalSlides - 1} (SUMMARY / RECAP): heading = "Summary & Key Takeaways". bullets = 4-6 concise takeaways recapping the most important points from the content slides. talkingPoints = 2-3 reflection questions. speakerNote = guidance on how to run a class recap activity.\n- Slide ${totalSlides} (CLOSING / THANK YOU): heading = "Thank You & Resources". bullets = ["Thank you for attending!", "Further reading: [2-3 real book/website titles relevant to the topic]", "Image credits: [list any notable image sources]", "Prepared with SEBA AI Studio \u2013 aina.forum"]. speakerNote = closing remarks and Q&A invitation. talkingPoints = []. imagePrompt = a warm, positive closing illustration.\nEach bullet must contain real factual content, not generic placeholders.`
        );
      }
      // Conditionally strip talking points instruction from the prompt
      if (input.type === "slides" && input.includeTalkingPoints === false) {
        systemPrompt = systemPrompt.replace(
          /"talkingPoints"[^\n]*\n?[^\n]*\n?/g,
          ""
        ).replace(
          /talkingPoints: \["[^"]+"[^\]]*\]/g,
          "talkingPoints: []"
        );
      }

      // Enrich with knowledge bank examples for alignment
      const contextQs = getQuestions(
        (input.competency ?? undefined) as CompetencyCode | undefined,
        (input.yearGroup ?? undefined) as YearGroup | undefined
      ).slice(0, 6);
      const contextText = contextQs.length > 0
        ? `\n\nLOMLOE knowledge bank alignment examples (use as style/difficulty reference only):\n${contextQs.map(q => `- ${q.question} → ${q.options[q.correctIndex]}`).join("\n")}`
        : "";

      const userPrompt = `Topic: "${input.topic}"${contextText}\n\nResearch this topic thoroughly and generate the complete ${input.type} activity now. All content must be factually accurate and educationally rich.`;

      const response = await invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      });

      const rawContent = String(response.choices?.[0]?.message?.content ?? "{}");
      // Bias guard: scan generated content before saving
      const biasResult = await checkBias(userPrompt, rawContent, undefined, ctx.user.id);
      const guardedContent = biasResult.safeOutput;

      let parsed: Record<string, unknown>;
      try {
        const cleaned = guardedContent.replace(/^```json?\n?/, "").replace(/\n?```$/, "").trim();
        parsed = JSON.parse(cleaned) as Record<string, unknown>;
      } catch (err) {
        console.error("JSON parsing failed. Raw content:", rawContent.substring(0, 500));
        console.error("Guarded content:", guardedContent.substring(0, 500));
        console.error("Parse error:", err instanceof Error ? err.message : String(err));
        throw new Error("AI returned invalid JSON. Please try again.");
      }

      // Validate and fix slides
      if (input.type === "slides") {
        parsed = validateAndFixSlides(parsed);
      }

      // For wordsearch: if the LLM didn't build the grid, build it server-side
      if (input.type === "wordsearch") {
        const ws = parsed as { words?: Array<{ word: string; clue: string } | string>; grid?: string[][]; gridSize?: number };
        if (!ws.grid || !Array.isArray(ws.grid) || ws.grid.length < 5) {
          const wordList = (ws.words ?? []).map((w) =>
            typeof w === "string" ? w.toUpperCase() : w.word.toUpperCase()
          );
          ws.grid = buildWordsearchGrid(wordList, 15);
          ws.gridSize = 15;
        }
      }

      const title = (parsed.title as string) ?? `${input.type} – ${input.topic}`;

      const id = await saveMaterial({
        userId: ctx.user.id,
        type: input.type,
        title,
        topic: input.topic,
        competency: input.competency ?? null,
        yearGroup: input.yearGroup ?? null,
        content: JSON.stringify(parsed),
      });

      return { id, title, content: parsed };
    }),

  list: protectedProcedure.query(async ({ ctx }) => {
    return getMaterialsByUser(ctx.user.id);
  }),

  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const row = await getMaterialById(input.id, ctx.user.id);
      if (!row) return null;
      return { ...row, content: JSON.parse(row.content) };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const ok = await deleteMaterial(input.id, ctx.user.id);
      return { success: ok };
    }),

  update: protectedProcedure
    .input(z.object({ id: z.number(), content: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const ok = await updateMaterial(input.id, ctx.user.id, input.content);
      return { success: ok };
    }),

  // Fetch presentations from sebasnap.com using the admin API key
  listFromSebasnap: protectedProcedure.query(async () => {
    const apiKey = ENV.sebasnapApiKey;
    if (!apiKey) throw new Error("SEBASNAP_API_KEY not configured");

    const input = encodeURIComponent(JSON.stringify({ "0": { json: {} } }));
    const url = `https://sebasnap.com/api/trpc/presentation.list?batch=1&input=${input}`;

    const res = await fetch(url, {
      headers: { "x-api-key": apiKey },
    });
    if (!res.ok) throw new Error(`sebasnap API error: ${res.status}`);

    const data = (await res.json()) as Array<{
      result?: { data?: { json?: { presentations?: SebasnapPresentation[] } } };
    }>;
    const presentations = data[0]?.result?.data?.json?.presentations ?? [];
    return { presentations };
  }),

  // Generate an AI image for a slide using the imagePrompt
  generateSlideImage: protectedProcedure
    .input(z.object({ prompt: z.string().min(1).max(500) }))
    .mutation(async ({ input }) => {
      const { url } = await generateImage({
        prompt: `Educational illustration for a school presentation slide: ${input.prompt}. Clean, clear, suitable for students aged 8-16. No text overlays.`,
      });
      return { url };
    }),

  // Upload an image file for a slide (base64 encoded)
  uploadSlideImage: protectedProcedure
    .input(z.object({
      base64: z.string(),
      mimeType: z.string().default("image/jpeg"),
      filename: z.string().nullish(),
    }))
    .mutation(async ({ ctx, input }) => {
      const suffix = Math.random().toString(36).slice(2, 8);
      const ext = input.mimeType.split("/")[1] ?? "jpg";
      const key = `slide-images/${ctx.user.id}/${suffix}.${ext}`;
      const buffer = Buffer.from(input.base64, "base64");
      const { url } = await storagePut(key, buffer, input.mimeType);
      return { url };
    }),

  // Import a sebasnap presentation into SEBA | Teach materials
  importFromSebasnap: protectedProcedure
    .input(z.object({
      sebasnapId: z.string(),
      title: z.string().min(1).max(200),
      subject: z.string().nullish(),
      type: MaterialTypeSchema,
      content: z.string(), // JSON-stringified content already mapped
    }))
    .mutation(async ({ ctx, input }) => {
      const id = await saveMaterial({
        userId: ctx.user.id,
        type: input.type,
        title: input.title,
        topic: input.subject ?? input.title,
        competency: null,
        yearGroup: null,
        content: input.content,
      });
      return { id, title: input.title };
    }),

  /**
   * Export a saved slides material as a PDF and return a temporary S3 URL.
   */
  exportPdf: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const row = await getMaterialById(input.id, ctx.user.id);
      if (!row) throw new Error("Material not found");
      if (row.type !== "slides") throw new Error("Material is not a slides type");

      let parsed: {
        title?: string;
        subject?: string;
        yearGroup?: string;
        competency?: string;
        keyVocabulary?: Array<{ term: string; definition: string }>;
        slides?: Array<{
          heading?: string;
          bullets?: string[];
          speakerNote?: string;
          talkingPoints?: string[];
          imageUrl?: string;
        }>;
      } = {};
      try { parsed = JSON.parse(row.content ?? "{}"); } catch { parsed = {}; }

      const slides = (parsed.slides ?? []).map(s => ({
        title: s.heading ?? "",
        content: (s.bullets ?? []).join("\n"),
        speakerNotes: s.speakerNote,
        keyVocabulary: s.talkingPoints,
      }));

      const { generatePresentationPdf } = await import("./presentations");
      const pdfBuffer = await generatePresentationPdf({
        title: row.title,
        subject: parsed.subject,
        yearGroup: parsed.yearGroup,
        competency: parsed.competency,
        slides,
      });

      const fileKey = `material-exports/${ctx.user.id}-${input.id}-${Date.now()}.pdf`;
      const { url } = await storagePut(fileKey, pdfBuffer, "application/pdf");
      return { url };
    }),

  /** AI auto-assign difficulty (1-3 stars) to unrated PARAULA words */
  autoAssignParaulaDifficulty: protectedProcedure
    .input(z.object({ materialId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const mat = await getMaterialById(input.materialId, ctx.user.id);
      if (!mat || mat.type !== "paraula") throw new Error("Material not found or not a PARAULA type");

      let content: { words?: string[]; clues?: string[]; difficulties?: (number | null)[] } = {};
      try { content = JSON.parse(mat.content ?? "{}"); } catch { content = {}; }

      const words: string[] = content.words ?? [];
      const clues: string[] = content.clues ?? [];
      const existing: (number | null)[] = content.difficulties ?? words.map(() => null);

      // Find indices of unrated words
      const unrated = words.map((w, i) => ({ w, c: clues[i] ?? "", i })).filter((_, i) => !existing[i]);
      if (unrated.length === 0) return { updated: 0, difficulties: existing };

      // Ask LLM to rate each unrated word 1-3
      const prompt = `Rate each of the following Catalan words by difficulty for a language learner (1 = easy, 2 = medium, 3 = hard). Consider word frequency, length, and phonetic complexity. Return a JSON array of integers in the same order as the input.

Words (with clues):
${unrated.map((u, i) => `${i + 1}. word: "${u.w}", clue: "${u.c}"`).join("\n")}

Return only a JSON array like: [1, 3, 2, ...]`;

      const resp = await invokeLLM({
        messages: [
          { role: "system", content: "You are a Catalan language expert. Return only valid JSON." },
          { role: "user", content: prompt },
        ],
      });

      const raw = resp.choices?.[0]?.message?.content ?? "[]";
      const content2 = typeof raw === "string" ? raw : JSON.stringify(raw);
      const match = content2.match(/\[([\d,\s]+)\]/);
      const ratings: number[] = match ? JSON.parse(`[${match[1]}]`) : [];

      const updated = [...existing];
      unrated.forEach((u, i) => {
        const r = ratings[i];
        if (r === 1 || r === 2 || r === 3) updated[u.i] = r;
      });

      const newContent = JSON.stringify({ ...content, difficulties: updated });
      await updateMaterial(input.materialId, ctx.user.id, newContent);
      return { updated: unrated.length, difficulties: updated };
    }),
});

// Type for sebasnap presentation items
interface SebasnapPresentation {
  id: string;
  title: string;
  subject?: string;
  subjecte?: string;
  type?: string;
  createdAt?: string;
  slides?: unknown[];
  content?: unknown;
}
