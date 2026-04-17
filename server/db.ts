import { eq, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, InsertPracticeSession, InsertTeachingMaterial, users, practiceSessions, teachingMaterials, classChallenges, challengeParticipants, ainaUserProfiles, ainaMessageRatings, questionAnswers, questionReviewStatus, type AinaUserProfile } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    // Auto-assign director position to the app owner on every login
    if (user.openId === ENV.ownerOpenId) {
      values.position = 'director';
      updateSet.position = 'director';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// TODO: add feature queries here as your schema grows.

// ─── Practice Sessions ────────────────────────────────────────────────────────

export async function savePracticeSession(data: InsertPracticeSession): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(practiceSessions).values(data);
}

export async function getSessionsByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(practiceSessions)
    .where(eq(practiceSessions.userId, userId))
    .orderBy(desc(practiceSessions.createdAt))
    .limit(100);
}

// ─── Teaching Materials ───────────────────────────────────────────────────────

export async function saveMaterial(data: InsertTeachingMaterial): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(teachingMaterials).values(data);
  return (result as unknown as [{ insertId: number }])[0].insertId;
}

export async function getMaterialsByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: teachingMaterials.id,
      type: teachingMaterials.type,
      title: teachingMaterials.title,
      topic: teachingMaterials.topic,
      competency: teachingMaterials.competency,
      yearGroup: teachingMaterials.yearGroup,
      content: teachingMaterials.content,
      createdAt: teachingMaterials.createdAt,
      updatedAt: teachingMaterials.updatedAt,
    })
    .from(teachingMaterials)
    .where(eq(teachingMaterials.userId, userId))
    .orderBy(desc(teachingMaterials.createdAt));
}

export async function getMaterialById(id: number, userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db
    .select()
    .from(teachingMaterials)
    .where(eq(teachingMaterials.id, id))
    .limit(1);
  const row = rows[0];
  if (!row || row.userId !== userId) return undefined;
  return row;
}

export async function deleteMaterial(id: number, userId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const row = await getMaterialById(id, userId);
  if (!row) return false;
  await db.delete(teachingMaterials).where(eq(teachingMaterials.id, id));
  return true;
}

export async function updateMaterial(id: number, userId: number, content: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const row = await getMaterialById(id, userId);
  if (!row) return false;
  await db
    .update(teachingMaterials)
    .set({ content })
    .where(eq(teachingMaterials.id, id));
  return true;
}

// ─── Class Challenge helpers ───────────────────────────────────────────────────

export async function createChallenge(data: {
  hostId: number;
  roomCode: string;
  title: string;
  competency: string | null;
  yearGroup: string | null;
  questions: string;
}): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(classChallenges).values({
    hostId: data.hostId,
    roomCode: data.roomCode,
    title: data.title,
    competency: data.competency ?? undefined,
    yearGroup: data.yearGroup ?? undefined,
    questions: data.questions,
    status: "waiting",
    currentQuestion: 0,
  });
  return (result as unknown as [{ insertId: number }])[0].insertId;
}

export async function getChallengeByCode(roomCode: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(classChallenges).where(eq(classChallenges.roomCode, roomCode)).limit(1);
  return rows[0] ?? null;
}

export async function getChallengeById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(classChallenges).where(eq(classChallenges.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getChallengesByHost(hostId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(classChallenges).where(eq(classChallenges.hostId, hostId)).orderBy(desc(classChallenges.createdAt));
}

export async function updateChallengeStatus(id: number, status: "waiting" | "active" | "finished", currentQuestion?: number) {
  const db = await getDb();
  if (!db) return;
  const set: Record<string, unknown> = { status };
  if (currentQuestion !== undefined) set.currentQuestion = currentQuestion;
  await db.update(classChallenges).set(set).where(eq(classChallenges.id, id));
}

export async function setAnswerRevealed(id: number, revealed: boolean) {
  const db = await getDb();
  if (!db) return;
  await db.update(classChallenges).set({ answerRevealed: revealed }).where(eq(classChallenges.id, id));
}

export async function updateChallengeQuestions(id: number, questions: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(classChallenges).set({ questions }).where(eq(classChallenges.id, id));
}

export async function resetParticipantScores(challengeId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(challengeParticipants)
    .set({ score: 0, answers: null })
    .where(eq(challengeParticipants.challengeId, challengeId));
}

export async function joinChallenge(data: { challengeId: number; nickname: string }): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(challengeParticipants).values({
    challengeId: data.challengeId,
    nickname: data.nickname,
    score: 0,
    answers: null,
  });
  return (result as unknown as [{ insertId: number }])[0].insertId;
}

export async function submitAnswer(participantId: number, answerIndex: number, correct: boolean) {
  const db = await getDb();
  if (!db) return;
  const rows = await db.select().from(challengeParticipants).where(eq(challengeParticipants.id, participantId)).limit(1);
  const p = rows[0];
  if (!p) return;
  const answers: number[] = JSON.parse(p.answers ?? "[]");
  answers.push(answerIndex);
  const newScore = p.score + (correct ? 1 : 0);
  await db.update(challengeParticipants).set({ score: newScore, answers: JSON.stringify(answers) }).where(eq(challengeParticipants.id, participantId));
}

export async function getParticipants(challengeId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(challengeParticipants).where(eq(challengeParticipants.challengeId, challengeId)).orderBy(desc(challengeParticipants.score));
}

// ─── Aina adaptive learning profiles ────────────────────────────────────────

/** Fetch the Aina learning profile for a user, or null if none exists yet. */
export async function getAinaProfile(userId: number): Promise<AinaUserProfile | null> {
  const db = await getDb();
  if (!db) return null;
  try {
    const rows = await db
      .select()
      .from(ainaUserProfiles)
      .where(eq(ainaUserProfiles.userId, userId))
      .limit(1);
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

/**
 * Upsert the Aina learning profile for a user.
 * Merges the supplied patch into the existing row (or creates a new one).
 */
export async function upsertAinaProfile(
  userId: number,
  patch: {
    questionCount?: number;
    avgQuestionLength?: number;
    competencyFrequency?: string;
    topicKeywords?: string;
    communicationStyle?: string;
    responseDepthPreference?: string;
    preferredYearGroups?: string;
    teachingContextSummary?: string;
  }
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  try {
    await db
      .insert(ainaUserProfiles)
      .values({
        userId,
        questionCount: patch.questionCount ?? 0,
        avgQuestionLength: patch.avgQuestionLength ?? 0,
        competencyFrequency: patch.competencyFrequency ?? "{}",
        topicKeywords: patch.topicKeywords ?? "[]",
        communicationStyle: patch.communicationStyle ?? "conversational",
        responseDepthPreference: patch.responseDepthPreference ?? "moderate",
        preferredYearGroups: patch.preferredYearGroups ?? "[]",
        teachingContextSummary: patch.teachingContextSummary ?? null,
      })
      .onDuplicateKeyUpdate({ set: patch });
  } catch (err) {
    console.error("[Aina] Failed to upsert profile:", err);
  }
}

// ─── Aina message ratings ────────────────────────────────────────────────────

/**
 * Upsert a thumbs-up/down rating for a specific assistant message.
 * If the user has already rated this message, the rating is updated.
 */
export async function rateMessage(data: {
  userId: number;
  messageId: string;
  rating: "up" | "down";
  messageSnippet?: string;
  userQuestion?: string;
  reportReason?: "wrong_info" | "not_relevant" | "too_long" | "too_short" | "other";
}): Promise<void> {
  const db = await getDb();
  if (!db) return;
  try {
    await db
      .insert(ainaMessageRatings)
      .values({
        userId: data.userId,
        messageId: data.messageId,
        rating: data.rating,
        messageSnippet: data.messageSnippet?.slice(0, 500) ?? null,
        userQuestion: data.userQuestion?.slice(0, 500) ?? null,
        reportReason: data.reportReason ?? null,
      })
      .onDuplicateKeyUpdate({
        set: { rating: data.rating, reportReason: data.reportReason ?? null, updatedAt: new Date() },
      });
  } catch (err) {
    console.error("[Aina] Failed to save rating:", err);
  }
}

/**
 * Get recent ratings for a user — used to surface quality signals in the adaptive profile.
 */
export async function getUserRatings(userId: number, limit = 20) {
  const db = await getDb();
  if (!db) return [];
  try {
    return db
      .select()
      .from(ainaMessageRatings)
      .where(eq(ainaMessageRatings.userId, userId))
      .orderBy(desc(ainaMessageRatings.updatedAt))
      .limit(limit);
  } catch {
    return [];
  }
}

/**
 * Record a single question answer attempt for analytics.
 * Fire-and-forget safe — errors are swallowed so they never block the UI.
 */
export async function saveQuestionAnswer(data: {
  questionId: string;
  competency: string;
  yearGroup: string;
  isCorrect: boolean;
  userId?: number | null;
}): Promise<void> {
  const db = await getDb();
  if (!db) return;
  try {
    await db.insert(questionAnswers).values({
      questionId: data.questionId,
      competency: data.competency,
      yearGroup: data.yearGroup,
      isCorrect: data.isCorrect,
      userId: data.userId ?? null,
    });
  } catch (err) {
    console.warn("[DB] saveQuestionAnswer failed:", err);
  }
}

/**
 * Aggregate per-question analytics for the Admin dashboard.
 * Returns up to `limit` questions sorted by ascending correct rate
 * (hardest first), with total attempts and correct count.
 */
export async function getQuestionAnalytics(limit = 50): Promise<Array<{
  questionId: string;
  competency: string;
  yearGroup: string;
  total: number;
  correct: number;
  correctRate: number;
}>> {
  const db = await getDb();
  if (!db) return [];
  try {
    const { sql, count, sum } = await import("drizzle-orm");
    const rows = await db
      .select({
        questionId: questionAnswers.questionId,
        competency: questionAnswers.competency,
        yearGroup: questionAnswers.yearGroup,
        total: count(questionAnswers.id),
        correct: sum(sql<number>`CASE WHEN ${questionAnswers.isCorrect} = 1 THEN 1 ELSE 0 END`),
      })
      .from(questionAnswers)
      .groupBy(questionAnswers.questionId, questionAnswers.competency, questionAnswers.yearGroup)
      .orderBy(sql`SUM(CASE WHEN ${questionAnswers.isCorrect} = 1 THEN 1 ELSE 0 END) / COUNT(*) ASC`)
      .limit(limit);

    return rows.map((r) => {
      const total = Number(r.total) || 0;
      const correct = Number(r.correct) || 0;
      return {
        questionId: r.questionId,
        competency: r.competency,
        yearGroup: r.yearGroup,
        total,
        correct,
        correctRate: total > 0 ? Math.round((correct / total) * 100) : 0,
      };
    });
  } catch (err) {
    console.warn("[DB] getQuestionAnalytics failed:", err);
    return [];
  }
}

// ─── Question Review Status ───────────────────────────────────────────────────

/**
 * Mark a newly generated question as pending review.
 * Called by questionGenerator.ts after appending new questions to the knowledge bank.
 */
export async function markQuestionPending(questionId: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  try {
    await db
      .insert(questionReviewStatus)
      .values({ questionId, status: "pending" })
      .onDuplicateKeyUpdate({ set: { status: "pending" } });
  } catch (err) {
    console.warn("[DB] markQuestionPending failed:", err);
  }
}

/**
 * Get all questions currently awaiting review (status = 'pending').
 */
export async function getPendingQuestions(): Promise<Array<{ questionId: string; createdAt: Date }>> {
  const db = await getDb();
  if (!db) return [];
  try {
    return await db
      .select({ questionId: questionReviewStatus.questionId, createdAt: questionReviewStatus.createdAt })
      .from(questionReviewStatus)
      .where(eq(questionReviewStatus.status, "pending"))
      .orderBy(desc(questionReviewStatus.createdAt));
  } catch (err) {
    console.warn("[DB] getPendingQuestions failed:", err);
    return [];
  }
}

/**
 * Get the review status for a set of question IDs.
 * Returns a map of questionId -> status for quick lookup.
 */
export async function getReviewStatuses(questionIds: string[]): Promise<Map<string, "pending" | "approved" | "rejected">> {
  const db = await getDb();
  const map = new Map<string, "pending" | "approved" | "rejected">();
  if (!db || questionIds.length === 0) return map;
  try {
    const rows = await db
      .select({ questionId: questionReviewStatus.questionId, status: questionReviewStatus.status })
      .from(questionReviewStatus);
    for (const row of rows) {
      map.set(row.questionId, row.status);
    }
  } catch (err) {
    console.warn("[DB] getReviewStatuses failed:", err);
  }
  return map;
}

/**
 * Approve or reject a question. Updates the review record with the admin's decision.
 */
export async function reviewQuestion(
  questionId: string,
  status: "approved" | "rejected",
  reviewedBy: number,
  notes?: string
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  try {
    await db
      .insert(questionReviewStatus)
      .values({ questionId, status, reviewedBy, notes: notes ?? null, reviewedAt: new Date() })
      .onDuplicateKeyUpdate({ set: { status, reviewedBy, notes: notes ?? null, reviewedAt: new Date() } });
  } catch (err) {
    console.warn("[DB] reviewQuestion failed:", err);
  }
}
