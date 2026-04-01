import { boolean, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

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
  /** Whether the teacher has revealed the answer for the current question */
  answerRevealed: boolean("answerRevealed").default(false).notNull(),
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

/**
 * Student progress records — per-student scores per challenge per competency.
 * Links a group student to a challenge log entry with competency-level scores.
 */
export const studentProgress = mysqlTable("student_progress", {
  id: int("id").autoincrement().primaryKey(),
  groupId: int("groupId").notNull(),
  studentId: int("studentId").notNull(),
  challengeLogId: int("challengeLogId"),
  /** Competency code: CCL, CP, STEM, CD, CPSAA, CC, CE, CCEC */
  competency: varchar("competency", { length: 16 }).notNull(),
  /** Score 0-100 for this competency in this activity */
  score: int("score").notNull(),
  /** Activity type: challenge, assignment, practice */
  activityType: varchar("activityType", { length: 32 }).notNull(),
  activityTitle: varchar("activityTitle", { length: 255 }),
  recordedAt: timestamp("recordedAt").defaultNow().notNull(),
});

export type StudentProgress = typeof studentProgress.$inferSelect;
export type InsertStudentProgress = typeof studentProgress.$inferInsert;

/**
 * Assignments — teacher-created daily/weekly tasks assigned to a group.
 */
export const assignments = mysqlTable("assignments", {
  id: int("id").autoincrement().primaryKey(),
  groupId: int("groupId").notNull(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  competency: varchar("competency", { length: 16 }),
  dueDate: timestamp("dueDate"),
  frequency: mysqlEnum("frequency", ["once", "daily", "weekly"]).default("once").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Assignment = typeof assignments.$inferSelect;
export type InsertAssignment = typeof assignments.$inferInsert;

/**
 * Assignment completions — tracks which students completed which assignments.
 */
export const assignmentCompletions = mysqlTable("assignment_completions", {
  id: int("id").autoincrement().primaryKey(),
  assignmentId: int("assignmentId").notNull(),
  studentId: int("studentId").notNull(),
  /** Score 0-100 if graded, null if just marked complete */
  score: int("score"),
  notes: text("notes"),
  completedAt: timestamp("completedAt").defaultNow().notNull(),
});

export type AssignmentCompletion = typeof assignmentCompletions.$inferSelect;
export type InsertAssignmentCompletion = typeof assignmentCompletions.$inferInsert;

/**
 * Forum channels — public chat rooms visible to all logged-in users.
 */
export const forumChannels = mysqlTable("forum_channels", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 64 }).notNull(),
  description: varchar("description", { length: 255 }),
  emoji: varchar("emoji", { length: 8 }).notNull().default("💬"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ForumChannel = typeof forumChannels.$inferSelect;
export type InsertForumChannel = typeof forumChannels.$inferInsert;

/**
 * Forum messages — messages posted in a channel by a logged-in user.
 */
export const forumMessages = mysqlTable("forum_messages", {
  id: int("id").autoincrement().primaryKey(),
  channelId: int("channelId").notNull(),
  userId: int("userId").notNull(),
  body: text("body").notNull(),
  /** Optional: translated body cached per language */
  translatedBodies: text("translatedBodies"),
  /** 'text' | 'voice' */
  messageType: varchar("messageType", { length: 10 }).default("text").notNull(),
  /** S3 URL for voice messages */
  audioUrl: text("audioUrl"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ForumMessage = typeof forumMessages.$inferSelect;
export type InsertForumMessage = typeof forumMessages.$inferInsert;

/**
 * Forum direct messages — 1-to-1 private messages between users.
 */
export const forumDirectMessages = mysqlTable("forum_direct_messages", {
  id: int("id").autoincrement().primaryKey(),
  fromUserId: int("fromUserId").notNull(),
  toUserId: int("toUserId").notNull(),
  body: text("body").notNull(),
  /** Whether the recipient has read this message */
  read: boolean("read").default(false).notNull(),
  /** 'text' | 'voice' */
  messageType: varchar("messageType", { length: 10 }).default("text").notNull(),
  /** S3 URL for voice messages */
  audioUrl: text("audioUrl"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ForumDirectMessage = typeof forumDirectMessages.$inferSelect;
export type InsertForumDirectMessage = typeof forumDirectMessages.$inferInsert;

/**
 * Forum user presence — tracks when a user was last active.
 */
export const notifications = mysqlTable("notifications", {
  id: int("id").primaryKey().autoincrement(),
  userId: varchar("userId", { length: 255 }).notNull(),
  type: varchar("type", { length: 50 }).notNull(), // 'challenge_started' | 'material_assigned' | 'challenge_joined'
  title: varchar("title", { length: 255 }).notNull(),
  body: text("body").notNull(),
  link: varchar("link", { length: 500 }),
  isRead: boolean("isRead").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const forumPresence = mysqlTable("forum_presence", {
  userId: int("userId").primaryKey(),
  lastSeen: timestamp("lastSeen").defaultNow().notNull(),
});

export type ForumPresence = typeof forumPresence.$inferSelect;
export type InsertForumPresence = typeof forumPresence.$inferInsert;
