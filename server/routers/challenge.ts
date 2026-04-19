import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";
import {
  getChallengeByCode,
  getChallengeById,
  getChallengesByHost,
  createChallenge,
  updateChallengeStatus,
  updateChallengeQuestions,
  resetParticipantScores,
  setAnswerRevealed,
  joinChallenge,
  submitAnswer,
  getParticipants,
  deleteParticipant,
} from "../db";
import { COMPETENCY_META, getQuestions, type CompetencyCode, type YearGroup } from "../knowledge/lomloeKnowledgeBank";
import { createNotification } from "./notifications";

const CompetencyCodeSchema = z.enum(["CCL", "CP", "STEM", "CD", "CPSAA", "CC", "CE", "CCEC"]);
const YearGroupSchema = z.enum(["junior", "primary", "secondary"]);

function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export const challengeRouter = router({
  /** Teacher creates a challenge from any saved material */
  createFromMaterial: protectedProcedure
    .input(z.object({
      title: z.string().min(2).max(200),
      materialId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Load the material and verify ownership
      const { getMaterialById } = await import("../db");
      const row = await getMaterialById(input.materialId, ctx.user.id);
      if (!row) throw new Error("Material not found");

      const rawContent = JSON.parse(row.content) as Record<string, unknown>;

      type ChallengeQuestion = {
        id: string; question: string; options: string[];
        correctIndex: number; explanation: string; competency: string;
      };

      let questions: ChallengeQuestion[] = [];

      if (row.type === "quiz") {
        // Quiz: use questions directly
        const qs = (rawContent.questions ?? []) as Array<{
          question: string; options: string[]; correctIndex: number;
          explanation?: string; competency?: string;
        }>;
        const seen = new Set<string>();
        questions = qs
          .filter((q) => {
            if (!q.question || !Array.isArray(q.options) || q.options.length < 2) return false;
            if (seen.has(q.question)) return false;
            seen.add(q.question);
            return true;
          })
          .map((q, i) => ({
            id: `mat-${input.materialId}-${i}`,
            question: q.question,
            options: q.options,
            correctIndex: Math.min(q.correctIndex, q.options.length - 1),
            explanation: q.explanation ?? "",
            competency: q.competency ?? "",
          }));
      } else if (row.type === "flashcards") {
        // Flashcards: convert each card to a MCQ using the other cards as distractors
        const cards = (rawContent.cards ?? []) as Array<{ term: string; definition: string; competencyHint?: string }>;
        if (cards.length < 2) throw new Error("Not enough flashcards to create a challenge.");
        const shuffled = [...cards].sort(() => Math.random() - 0.5);
        questions = shuffled.slice(0, Math.min(10, shuffled.length)).map((card, i) => {
          const distractors = cards
            .filter((c) => c.definition !== card.definition)
            .sort(() => Math.random() - 0.5)
            .slice(0, 3)
            .map((c) => c.definition);
          const opts = [card.definition, ...distractors].sort(() => Math.random() - 0.5);
          const correctIndex = opts.indexOf(card.definition);
          return {
            id: `mat-${input.materialId}-${i}`,
            question: `What is the definition of "${card.term}"?`,
            options: opts,
            correctIndex,
            explanation: card.definition,
            competency: card.competencyHint ?? "",
          };
        });
      } else if (row.type === "paraula") {
        // PARAULA: each word becomes a "What word matches this clue?" question
        const words = (rawContent.words ?? []) as Array<{ word: string; clue: string }>;
        if (words.length < 2) throw new Error("Not enough PARAULA words to create a challenge.");
        const shuffled = [...words].sort(() => Math.random() - 0.5);
        questions = shuffled.slice(0, Math.min(10, shuffled.length)).map((w, i) => {
          // Build 3 distractor words from the same list
          const distractors = words
            .filter((x) => x.word !== w.word)
            .sort(() => Math.random() - 0.5)
            .slice(0, 3)
            .map((x) => x.word.toUpperCase());
          const opts = [w.word.toUpperCase(), ...distractors].sort(() => Math.random() - 0.5);
          return {
            id: `paraula-${input.materialId}-${i}`,
            question: `Quina paraula de 5 lletres significa: "${w.clue}"?`,
            options: opts,
            correctIndex: opts.indexOf(w.word.toUpperCase()),
            explanation: `La paraula correcta és ${w.word.toUpperCase()}.`,
            competency: "CCL",
          };
        });
      } else {
        // For slides, crossword, missing_words, wordsearch — derive MCQs via LLM
        const contentSummary = JSON.stringify(rawContent).slice(0, 3000);
        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `You are an expert LOMLOE curriculum designer. Based on the following educational material content, generate exactly 10 multiple-choice questions suitable for a classroom challenge. Return ONLY valid JSON array: [{"question":string,"options":[string,string,string,string],"correctIndex":number,"explanation":string,"competency":string}]. No markdown, no extra keys.`,
            },
            { role: "user", content: `Material title: "${row.title}"\nMaterial type: ${row.type}\nContent: ${contentSummary}\n\nGenerate 10 MCQ questions now.` },
          ],
        });
        try {
          const raw = String(response.choices?.[0]?.message?.content ?? "[]");
          const cleaned = raw.replace(/^```json?\n?/, "").replace(/\n?```$/, "").trim();
          const parsed = JSON.parse(cleaned) as Array<{ question: string; options: string[]; correctIndex: number; explanation: string; competency: string }>;
          questions = parsed.slice(0, 10).map((q, i) => ({
            id: `mat-${input.materialId}-llm-${i}`,
            question: q.question,
            options: q.options,
            correctIndex: q.correctIndex,
            explanation: q.explanation ?? "",
            competency: q.competency ?? "",
          }));
        } catch {
          throw new Error("Could not generate questions from this material. Please try again.");
        }
      }

      if (questions.length === 0) {
        throw new Error("No questions could be extracted from this material.");
      }

      let roomCode = generateRoomCode();
      for (let i = 0; i < 5; i++) {
        const existing = await getChallengeByCode(roomCode);
        if (!existing) break;
        roomCode = generateRoomCode();
      }

      const id = await createChallenge({
        hostId: ctx.user.id,
        roomCode,
        title: input.title,
        competency: null,
        yearGroup: null,
        questions: JSON.stringify(questions),
      });
      return { id, roomCode, title: input.title, questionCount: questions.length };
    }),

  /** Teacher creates a new challenge room */
  create: protectedProcedure
    .input(z.object({
      title: z.string().min(2).max(200),
      competency: CompetencyCodeSchema.nullish(),
      yearGroup: YearGroupSchema.nullish(),
      questionCount: z.number().min(5).max(20).default(10),
    }))
    .mutation(async ({ ctx, input }) => {
      // Pull questions from knowledge bank, no duplicates
      const pool = getQuestions(
        input.competency as CompetencyCode | undefined,
        input.yearGroup as YearGroup | undefined
      );
      const shuffled = [...pool].sort(() => Math.random() - 0.5);
      const selected = shuffled.slice(0, Math.min(input.questionCount, shuffled.length));

      // If not enough questions in bank, supplement with LLM
      let questions = selected.map((q) => ({
        id: q.id,
        question: q.question,
        options: q.options,
        correctIndex: q.correctIndex,
        explanation: q.explanation ?? "",
        competency: q.competency,
      }));

      if (questions.length < input.questionCount) {
        const needed = input.questionCount - questions.length;
        const comp = input.competency ? `${COMPETENCY_META[input.competency as CompetencyCode]?.name} (${input.competency})` : "all LOMLOE competencies";
        const yg = input.yearGroup ?? "all year groups";
        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `You are an expert LOMLOE curriculum designer. Generate exactly ${needed} multiple-choice questions for ${comp}, ${yg}. Return ONLY valid JSON array: [{"question":string,"options":[string,string,string,string],"correctIndex":number,"explanation":string,"competency":string}]. No markdown, no extra keys.`,
            },
            { role: "user", content: `Generate ${needed} LOMLOE quiz questions now.` },
          ],
        });
        try {
          const raw = String(response.choices?.[0]?.message?.content ?? "[]");
          const cleaned = raw.replace(/^```json?\n?/, "").replace(/\n?```$/, "").trim();
          const extra = JSON.parse(cleaned) as Array<{ question: string; options: string[]; correctIndex: number; explanation: string; competency: string }>;
          questions = [
            ...questions,
            ...extra.slice(0, needed).map((q, i) => ({
              id: `llm-${Date.now()}-${i}`,
              question: q.question,
              options: q.options,
              correctIndex: q.correctIndex,
              explanation: q.explanation,
              competency: (q.competency ?? input.competency ?? "CCL") as CompetencyCode,
            })),
          ];
        } catch {
          // Use what we have
        }
      }

      let roomCode = generateRoomCode();
      // Ensure uniqueness (retry up to 5 times)
      for (let i = 0; i < 5; i++) {
        const existing = await getChallengeByCode(roomCode);
        if (!existing) break;
        roomCode = generateRoomCode();
      }

      const id = await createChallenge({
        hostId: ctx.user.id,
        roomCode,
        title: input.title,
        competency: input.competency ?? null,
        yearGroup: input.yearGroup ?? null,
        questions: JSON.stringify(questions),
      });

      return { id, roomCode, title: input.title, questionCount: questions.length };
    }),

  /** Get teacher's own challenges */
  myRooms: protectedProcedure.query(async ({ ctx }) => {
    return getChallengesByHost(ctx.user.id);
  }),

  /** Get full session history with leaderboards for the History tab */
  getSessionHistory: protectedProcedure.query(async ({ ctx }) => {
    const sessions = await getChallengesByHost(ctx.user.id);
    // Only return finished sessions for the history tab
    const finished = sessions.filter((s) => s.status === "finished");
    // Fetch participants for each session in parallel
    const withParticipants = await Promise.all(
      finished.map(async (session) => {
        const participants = await getParticipants(session.id);
        let questionCount = 0;
        try { questionCount = (JSON.parse(session.questions) as unknown[]).length; } catch { /* ignore */ }
        return {
          id: session.id,
          title: session.title,
          roomCode: session.roomCode,
          competency: session.competency,
          yearGroup: session.yearGroup,
          createdAt: session.createdAt,
          questionCount,
          participants: participants.map((p) => ({
            id: p.id,
            nickname: p.nickname,
            score: p.score,
          })),
        };
      })
    );
    return withParticipants;
  }),

  /** Get challenge state (teacher view) */
  getRoom: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const challenge = await getChallengeById(input.id);
      if (!challenge || challenge.hostId !== ctx.user.id) return null;
      const participants = await getParticipants(input.id);
      return {
        ...challenge,
        questions: JSON.parse(challenge.questions) as Array<{
          id: string; question: string; options: string[]; correctIndex: number; explanation: string; competency: string;
        }>,
        participants,
      };
    }),

  /** Teacher controls: start, next, finish */
  control: protectedProcedure
    .input(z.object({
      id: z.number(),
      action: z.enum(["start", "next", "finish", "reveal"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const challenge = await getChallengeById(input.id);
      if (!challenge || challenge.hostId !== ctx.user.id) throw new Error("Not found");
      const questions = JSON.parse(challenge.questions) as unknown[];
      if (input.action === "start") {
        await setAnswerRevealed(input.id, false);
        await updateChallengeStatus(input.id, "active", 0);
        // Notify the host that the challenge is now live
        try {
          await createNotification({
            userId: challenge.hostId.toString(),
            type: "challenge_started",
            title: `Challenge live: ${challenge.title}`,
            body: `Your challenge is now active. Students can join with code ${challenge.roomCode}.`,
            link: `/challenge`,
          });
        } catch (err) {
          console.warn("[Challenge] Failed to send start notification:", err);
        }
      } else if (input.action === "reveal") {
        await setAnswerRevealed(input.id, true);
      } else if (input.action === "next") {
        const next = challenge.currentQuestion + 1;
        await setAnswerRevealed(input.id, false);
        if (next >= questions.length) {
          await updateChallengeStatus(input.id, "finished", next);
        } else {
          await updateChallengeStatus(input.id, "active", next);
        }
      } else {
        await setAnswerRevealed(input.id, false);
        await updateChallengeStatus(input.id, "finished");
      }
      return { success: true };
    }),

  /** Student: look up a room by code (public) */
  findRoom: publicProcedure
    .input(z.object({ roomCode: z.string().length(6) }))
    .query(async ({ input }) => {
      const challenge = await getChallengeByCode(input.roomCode.toUpperCase());
      if (!challenge) return null;
      return {
        id: challenge.id,
        title: challenge.title,
        status: challenge.status,
        competency: challenge.competency,
        yearGroup: challenge.yearGroup,
        questionCount: (JSON.parse(challenge.questions) as unknown[]).length,
      };
    }),

  /** Student: join a challenge */
  join: publicProcedure
    .input(z.object({ challengeId: z.number(), nickname: z.string().min(1).max(32) }))
    .mutation(async ({ input }) => {
      const challenge = await getChallengeById(input.challengeId);
      if (!challenge || challenge.status === "finished") throw new Error("Room not available");
      const participantId = await joinChallenge({ challengeId: input.challengeId, nickname: input.nickname });
      return { participantId };
    }),

  /** Student: get current question */
  currentQuestion: publicProcedure
    .input(z.object({ challengeId: z.number() }))
    .query(async ({ input }) => {
      const challenge = await getChallengeById(input.challengeId);
      if (!challenge) return null;
      const questions = JSON.parse(challenge.questions) as Array<{
        id: string; question: string; options: string[]; correctIndex: number; explanation: string; competency: string;
      }>;
      const q = questions[challenge.currentQuestion];
      if (!q) return null;
      return {
        status: challenge.status,
        currentIndex: challenge.currentQuestion,
        total: questions.length,
        question: q.question,
        options: q.options,
        competency: q.competency,
        // Reveal answer when teacher triggers reveal OR when challenge is finished
        correctIndex: (challenge.answerRevealed || challenge.status === "finished") ? q.correctIndex : undefined,
        explanation: (challenge.answerRevealed || challenge.status === "finished") ? q.explanation : undefined,
        answerRevealed: challenge.answerRevealed,
      };
    }),

  /** Student: submit an answer */
  submitAnswer: publicProcedure
    .input(z.object({
      participantId: z.number(),
      challengeId: z.number(),
      answerIndex: z.number(),
    }))
    .mutation(async ({ input }) => {
      const challenge = await getChallengeById(input.challengeId);
      if (!challenge) throw new Error("Room not found");
      const questions = JSON.parse(challenge.questions) as Array<{ correctIndex: number }>;
      const q = questions[challenge.currentQuestion];
      const correct = q ? q.correctIndex === input.answerIndex : false;
      await submitAnswer(input.participantId, input.answerIndex, correct);
      return { correct };
    }),

  /** Get leaderboard */
  leaderboard: publicProcedure
    .input(z.object({ challengeId: z.number() }))
    .query(async ({ input }) => {
      return getParticipants(input.challengeId);
    }),

  /** Teacher: create a live PARAULA word room from a material */
  createParaulaRoom: protectedProcedure
    .input(z.object({
      title: z.string().min(2).max(200),
      materialId: z.number(),
      wordIndex: z.number().min(0),  // which word from the material to use
    }))
    .mutation(async ({ ctx, input }) => {
      const { getMaterialById } = await import("../db");
      const row = await getMaterialById(input.materialId, ctx.user.id);
      if (!row) throw new Error("Material not found");
      const rawContent = JSON.parse(row.content) as { words?: string[]; clues?: string[] };
      const words = rawContent.words ?? [];
      const clues = rawContent.clues ?? [];
      if (words.length === 0) throw new Error("No words in this PARAULA material");
      const idx = Math.min(input.wordIndex, words.length - 1);
      const word = words[idx].toUpperCase().trim();
      const clue = clues[idx] ?? "";
      if (word.length !== 5) throw new Error(`Word "${word}" is not 5 letters`);

      let roomCode = generateRoomCode();
      for (let i = 0; i < 5; i++) {
        const existing = await getChallengeByCode(roomCode);
        if (!existing) break;
        roomCode = generateRoomCode();
      }
      // Store as a special paraula_live payload in the questions field
      const payload = JSON.stringify([{ type: "paraula_live", word, clue, materialId: input.materialId }]);
      const id = await createChallenge({
        hostId: ctx.user.id,
        roomCode,
        title: input.title,
        competency: null,
        yearGroup: null,
        questions: payload,
      });
      return { id, roomCode, word, clue };
    }),

  /** Student/Teacher: get the PARAULA live room details */
  getParaulaRoom: publicProcedure
    .input(z.object({ challengeId: z.number() }))
    .query(async ({ input }) => {
      const challenge = await getChallengeById(input.challengeId);
      if (!challenge) return null;
      let payload: Array<{ type: string; word: string; clue: string; round?: number }> = [];
      try { payload = JSON.parse(challenge.questions); } catch { return null; }
      if (!payload[0] || payload[0].type !== "paraula_live") return null;
      const { word, clue } = payload[0];
      const round = payload[0].round ?? 1;
      return {
        id: challenge.id,
        roomCode: challenge.roomCode,
        title: challenge.title,
        status: challenge.status,
        clue,
        // Reveal word when active (students need it to play) or finished
        word: (challenge.status === "active" || challenge.status === "finished") ? word : undefined,
        wordLength: word.length,
        round,
      };
    }),

  /** Student: submit PARAULA score (guesses used, 0 = failed) */
  submitParaulaScore: publicProcedure
    .input(z.object({
      participantId: z.number(),
      challengeId: z.number(),
      guesses: z.number().min(0).max(6),  // 0 = did not solve
      solved: z.boolean(),
    }))
    .mutation(async ({ input }) => {
      // Reuse submitAnswer: store guesses in answerIndex, solved in correct
      await submitAnswer(input.participantId, input.guesses, input.solved);
      return { success: true };
    }),

  /** Teacher: finish the PARAULA live room */
  finishParaulaRoom: protectedProcedure
    .input(z.object({ challengeId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const challenge = await getChallengeById(input.challengeId);
      if (!challenge || challenge.hostId !== ctx.user.id) throw new Error("Not authorised");
      await updateChallengeStatus(input.challengeId, "finished");
      return { success: true };
    }),

  /** Teacher: advance to the next word in a PARAULA live room (multi-round) */
  deleteParticipant: protectedProcedure
    .input(z.object({ participantId: z.number(), challengeId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      // Verify the teacher owns this challenge
      const room = await getChallengeById(input.challengeId);
      if (!room || room.hostId !== ctx.user.id) throw new Error("Not authorised");
      await deleteParticipant(input.participantId, input.challengeId);
      return { success: true };
    }),

  nextParaulaRound: protectedProcedure
    .input(z.object({
      challengeId: z.number(),
      wordIndex: z.number().min(0),
    }))
    .mutation(async ({ ctx, input }) => {
      const challenge = await getChallengeById(input.challengeId);
      if (!challenge || challenge.hostId !== ctx.user.id) throw new Error("Not authorised");
      // Load material to get the new word
      let payload: Array<{ type: string; word: string; clue: string; materialId?: number; round?: number }> = [];
      try { payload = JSON.parse(challenge.questions); } catch { throw new Error("Invalid room data"); }
      if (!payload[0] || payload[0].type !== "paraula_live") throw new Error("Not a PARAULA room");
      const materialId = payload[0].materialId;
      if (!materialId) throw new Error("No material linked to this room");
      const { getMaterialById } = await import("../db");
      const row = await getMaterialById(materialId, ctx.user.id);
      if (!row) throw new Error("Material not found");
      const rawContent = JSON.parse(row.content) as { words?: string[]; clues?: string[] };
      const words = rawContent.words ?? [];
      const clues = rawContent.clues ?? [];
      const idx = Math.min(input.wordIndex, words.length - 1);
      const word = words[idx].toUpperCase().trim();
      const clue = clues[idx] ?? "";
      if (word.length !== 5) throw new Error(`Word "${word}" is not 5 letters`);
      const currentRound = payload[0].round ?? 1;
      // Update the questions payload with the new word and increment round
      const newPayload = [{ ...payload[0], word, clue, round: currentRound + 1 }];
      // Reset room to waiting with new word, then set active
      await updateChallengeQuestions(input.challengeId, JSON.stringify(newPayload));
      await resetParticipantScores(input.challengeId);
      await updateChallengeStatus(input.challengeId, "active");
      return { success: true, word, clue, round: currentRound + 1 };
    }),
});
