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

/**
 * Class groups — teacher-managed class rosters.
 */
export const classGroups = mysqlTable("class_groups", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  className: varchar("className", { length: 128 }).notNull(),
  level: varchar("level", { length: 64 }).notNull(),
  assessmentTitle: varchar("assessmentTitle", { length: 255 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ClassGroup = typeof classGroups.$inferSelect;
export type InsertClassGroup = typeof classGroups.$inferInsert;

/**
 * Group students — numbered roster entries per class group.
 */
export const groupStudents = mysqlTable("group_students", {
  id: int("id").autoincrement().primaryKey(),
  groupId: int("groupId").notNull(),
  studentNumber: int("studentNumber").notNull(),
  name: varchar("name", { length: 128 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type GroupStudent = typeof groupStudents.$inferSelect;
export type InsertGroupStudent = typeof groupStudents.$inferInsert;

/**
 * Group messages — alerts/messages sent to a class group.
 */
export const groupMessages = mysqlTable("group_messages", {
  id: int("id").autoincrement().primaryKey(),
  groupId: int("groupId").notNull(),
  userId: int("userId").notNull(),
  subject: varchar("subject", { length: 255 }).notNull(),
  body: text("body").notNull(),
  sentAt: timestamp("sentAt").defaultNow().notNull(),
});

export type GroupMessage = typeof groupMessages.$inferSelect;
export type InsertGroupMessage = typeof groupMessages.$inferInsert;

/**
 * Group challenge log — records which challenges were run for a group,
 * with date stamp and competencies covered.
 */
export const groupChallengeLog = mysqlTable("group_challenge_log", {
  id: int("id").autoincrement().primaryKey(),
  groupId: int("groupId").notNull(),
  challengeId: int("challengeId"),
  challengeTitle: varchar("challengeTitle", { length: 255 }).notNull(),
  /** JSON array of competency codes covered */
  competencies: text("competencies").notNull(),
  runAt: timestamp("runAt").defaultNow().notNull(),
});

export type GroupChallengeLog = typeof groupChallengeLog.$inferSelect;
export type InsertGroupChallengeLog = typeof groupChallengeLog.$inferInsert;
