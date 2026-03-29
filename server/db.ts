import { eq, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, InsertPracticeSession, InsertTeachingMaterial, users, practiceSessions, teachingMaterials, classChallenges, challengeParticipants } from "../drizzle/schema";
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
  return (result as unknown as { insertId: number }).insertId;
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
  return (result as unknown as { insertId: number }).insertId;
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

export async function joinChallenge(data: { challengeId: number; nickname: string }): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(challengeParticipants).values({
    challengeId: data.challengeId,
    nickname: data.nickname,
    score: 0,
    answers: null,
  });
  return (result as unknown as { insertId: number }).insertId;
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
