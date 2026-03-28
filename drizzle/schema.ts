import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Practice session results — one row per completed 10-question session.
 */
export const practiceSessions = mysqlTable("practice_sessions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  competency: varchar("competency", { length: 16 }),
  yearGroup: varchar("yearGroup", { length: 16 }),
  score: int("score").notNull(),
  total: int("total").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PracticeSession = typeof practiceSessions.$inferSelect;
export type InsertPracticeSession = typeof practiceSessions.$inferInsert;

/**
 * Teaching materials — AI-generated activities saved per teacher.
 */
export const teachingMaterials = mysqlTable("teaching_materials", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  type: mysqlEnum("type", [
    "quiz",
    "slides",
    "crossword",
    "missing_words",
    "wordsearch",
    "flashcards",
  ]).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  topic: varchar("topic", { length: 255 }).notNull(),
  competency: varchar("competency", { length: 16 }),
  yearGroup: varchar("yearGroup", { length: 16 }),
  content: text("content").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type TeachingMaterial = typeof teachingMaterials.$inferSelect;
export type InsertTeachingMaterial = typeof teachingMaterials.$inferInsert;

/**
 * Class Challenge sessions — teacher-hosted live quiz rooms.
 */
export const classChallenges = mysqlTable("class_challenges", {
  id: int("id").autoincrement().primaryKey(),
  hostId: int("hostId").notNull(),
  roomCode: varchar("roomCode", { length: 8 }).notNull().unique(),
  title: varchar("title", { length: 255 }).notNull(),
  competency: varchar("competency", { length: 16 }),
  yearGroup: varchar("yearGroup", { length: 16 }),
  /** JSON array of question objects */
  questions: text("questions").notNull(),
  status: mysqlEnum("status", ["waiting", "active", "finished"]).default("waiting").notNull(),
  currentQuestion: int("currentQuestion").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ClassChallenge = typeof classChallenges.$inferSelect;
export type InsertClassChallenge = typeof classChallenges.$inferInsert;

/**
 * Challenge participants — one row per student per challenge.
 */
export const challengeParticipants = mysqlTable("challenge_participants", {
  id: int("id").autoincrement().primaryKey(),
  challengeId: int("challengeId").notNull(),
  nickname: varchar("nickname", { length: 64 }).notNull(),
  score: int("score").default(0).notNull(),
  /** JSON array of answer indices submitted */
  answers: text("answers"),
  joinedAt: timestamp("joinedAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ChallengeParticipant = typeof challengeParticipants.$inferSelect;
export type InsertChallengeParticipant = typeof challengeParticipants.$inferInsert;
