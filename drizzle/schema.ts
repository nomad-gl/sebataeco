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
  /** AI-generated assignment content (markdown) — null if not yet generated */
  aiContent: text("aiContent"),
  /** Teacher-edited version of the assignment content */
  editedContent: text("editedContent"),
  /** Assignment type — e.g. 'worksheet', 'essay', 'quiz', 'project' */
  assignmentType: varchar("assignmentType", { length: 64 }),
  /** Student's submitted response text (entered by teacher for AI assessment) */
  studentResponse: text("studentResponse"),
  /** AI-generated assessment feedback (markdown) */
  aiFeedback: text("aiFeedback"),
  /** AI-assigned score 0-100 */
  aiScore: int("aiScore"),
  /** When the AI assessment was last run */
  aiAssessedAt: timestamp("aiAssessedAt"),
  /** S3 key of the uploaded student submission file */
  submissionKey: text("submissionKey"),
  /** Public URL of the uploaded student submission file */
  submissionUrl: text("submissionUrl"),
  /** MIME type of the uploaded submission (image/jpeg, application/pdf, etc.) */
  submissionMime: varchar("submissionMime", { length: 128 }),
  /** Original filename of the uploaded submission */
  submissionName: varchar("submissionName", { length: 255 }),
  /** When the submission was uploaded */
  submissionUploadedAt: timestamp("submissionUploadedAt"),
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
  /** JSON map of lang -> translated body, e.g. {"es":"...","ca":"..."} */
  translatedBodies: text("translatedBodies"),
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

/**
 * Aina adaptive learning profiles — one row per teacher.
 * Updated after every chat turn to reflect evolving style signals.
 */
export const ainaUserProfiles = mysqlTable("aina_user_profiles", {
  userId: int("userId").primaryKey(),
  /** Total number of questions asked across all sessions */
  questionCount: int("questionCount").default(0).notNull(),
  /** Rolling average word count of the user's questions */
  avgQuestionLength: int("avgQuestionLength").default(0).notNull(),
  /**
   * JSON object: { CCL:3, STEM:5, ... } — frequency counts per competency
   * Used to identify the teacher's primary curriculum focus areas
   */
  competencyFrequency: text("competencyFrequency").default("{}").notNull(),
  /**
   * JSON array of the top recurring topic keywords extracted from questions
   * e.g. ["differentiation", "assessment", "group work"]
   */
  topicKeywords: text("topicKeywords").default("[]").notNull(),
  /**
   * Inferred communication style: 'concise' | 'detailed' | 'conversational' | 'formal'
   * Derived from question length, vocabulary, and sentence structure patterns
   */
  communicationStyle: varchar("communicationStyle", { length: 32 }).default("conversational").notNull(),
  /**
   * Preferred response depth: 'brief' | 'moderate' | 'thorough'
   * Inferred from how the user engages with follow-up chips and question depth
   */
  responseDepthPreference: varchar("responseDepthPreference", { length: 16 }).default("moderate").notNull(),
  /**
   * JSON array of year groups most frequently asked about
   * e.g. ["primary", "secondary"]
   */
  preferredYearGroups: text("preferredYearGroups").default("[]").notNull(),
  /**
   * Free-text summary of the user's teaching context and interests,
   * generated and updated by the LLM after every few interactions
   */
  teachingContextSummary: text("teachingContextSummary"),
  /** Timestamp of last profile update */
  lastUpdated: timestamp("lastUpdated").defaultNow().onUpdateNow().notNull(),
});

export type AinaUserProfile = typeof ainaUserProfiles.$inferSelect;
export type InsertAinaUserProfile = typeof ainaUserProfiles.$inferInsert;

/**
 * Aina message ratings — thumbs-up/down feedback on individual assistant responses.
 * One row per user per message (upsert on re-rating).
 */
export const ainaMessageRatings = mysqlTable("aina_message_ratings", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  /** Client-generated stable message ID (uuid) */
  messageId: varchar("messageId", { length: 64 }).notNull(),
  /** 'up' | 'down' */
  rating: mysqlEnum("rating", ["up", "down"]).notNull(),
  /** First 500 chars of the assistant message for context */
  messageSnippet: varchar("messageSnippet", { length: 500 }),
  /** The user question that prompted this response */
  userQuestion: varchar("userQuestion", { length: 500 }),
  /** Optional structured reason when rating is 'down' */
  reportReason: mysqlEnum("reportReason", ["wrong_info", "not_relevant", "too_long", "too_short", "other"]),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AinaMessageRating = typeof ainaMessageRatings.$inferSelect;
export type InsertAinaMessageRating = typeof ainaMessageRatings.$inferInsert;

/**
 * Question answers — one row per question attempt in Practice mode.
 * Used to compute per-question difficulty analytics in the Admin dashboard.
 */
export const questionAnswers = mysqlTable("question_answers", {
  id: int("id").autoincrement().primaryKey(),
  /** Knowledge bank question ID, e.g. 'q001' */
  questionId: varchar("questionId", { length: 16 }).notNull(),
  /** Competency code for quick filtering */
  competency: varchar("competency", { length: 16 }).notNull(),
  /** Year group for quick filtering */
  yearGroup: varchar("yearGroup", { length: 16 }).notNull(),
  /** Whether the user selected the correct answer */
  isCorrect: boolean("isCorrect").notNull(),
  /** Logged-in user ID, null for anonymous practice */
  userId: int("userId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type QuestionAnswer = typeof questionAnswers.$inferSelect;
export type InsertQuestionAnswer = typeof questionAnswers.$inferInsert;

/**
 * Question review status — admin decisions on auto-generated questions.
 * Questions not in this table default to "approved" (all original 240 questions).
 * New auto-generated questions are inserted here as "pending" immediately after generation.
 */
export const questionReviewStatus = mysqlTable("question_review_status", {
  /** Knowledge bank question ID, e.g. 'q241' */
  questionId: varchar("questionId", { length: 16 }).primaryKey(),
  /** Review decision */
  status: mysqlEnum("status", ["pending", "approved", "rejected"]).default("pending").notNull(),
  /** Admin user ID who reviewed, null if still pending */
  reviewedBy: int("reviewedBy"),
  /** Optional notes from the reviewer */
  notes: text("notes"),
  /** When the question was first submitted for review */
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  /** When the review decision was made */
  reviewedAt: timestamp("reviewedAt"),
});

export type QuestionReviewStatus = typeof questionReviewStatus.$inferSelect;
export type InsertQuestionReviewStatus = typeof questionReviewStatus.$inferInsert;

/**
 * Generated questions — LLM-generated LOMLOE questions stored in the DB.
 * These are merged with the static knowledge bank at query time.
 * New questions start as 'pending' and only appear in Practice/Challenge once 'approved'.
 */
export const generatedQuestions = mysqlTable("generated_questions", {
  id: int("id").autoincrement().primaryKey(),
  /** Unique question ID, e.g. 'gq001' (prefixed with 'gq' to distinguish from static 'q' IDs) */
  questionId: varchar("questionId", { length: 16 }).notNull().unique(),
  competency: varchar("competency", { length: 16 }).notNull(),
  yearGroup: varchar("yearGroup", { length: 16 }).notNull(),
  question: text("question").notNull(),
  /** JSON array of 4 option strings */
  options: text("options").notNull(),
  /** Index of the correct answer (0-3) */
  correctIndex: int("correctIndex").notNull(),
  explanation: text("explanation").notNull(),
  /** Review status: pending until admin approves */
  status: mysqlEnum("status", ["pending", "approved", "rejected"]).default("pending").notNull(),
  reviewedBy: int("reviewedBy"),
  notes: text("notes"),
  reviewedAt: timestamp("reviewedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type GeneratedQuestion = typeof generatedQuestions.$inferSelect;
export type InsertGeneratedQuestion = typeof generatedQuestions.$inferInsert;

/**
 * School calendars — named calendar instances per teacher.
 * One teacher can have multiple calendars (e.g. "4th Primary English", "2nd Secondary Maths").
 */
export const schoolCalendars = mysqlTable("school_calendars", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  /** Human-readable name, e.g. '4th Primary English 2025-26' */
  name: varchar("name", { length: 255 }).notNull(),
  schoolName: varchar("schoolName", { length: 255 }),
  tutorName: varchar("tutorName", { length: 128 }),
  subject: varchar("subject", { length: 128 }),
  yearLevel: varchar("yearLevel", { length: 64 }),
  academicYear: varchar("academicYear", { length: 16 }).notNull(),
  /** 'full_year' = standard academic year calendar; 'topic_block' = short-term unit with defined start/end */
  calendarType: mysqlEnum("calendarType", ["full_year", "topic_block"]).default("full_year").notNull(),
  /** For topic_block calendars: first day of the unit (stored as UTC midnight) */
  startDate: timestamp("startDate"),
  /** For topic_block calendars: last day of the unit (stored as UTC midnight) */
  endDate: timestamp("endDate"),
  /** Optional description of the topic/unit — used by AI infill to scope lesson generation */
  topicDescription: text("topicDescription"),
  /** Optional link to a class group — lesson events are auto-created as assignments for this group */
  linkedGroupId: int("linkedGroupId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SchoolCalendar = typeof schoolCalendars.$inferSelect;
export type InsertSchoolCalendar = typeof schoolCalendars.$inferInsert;

/**
 * School calendar events — holidays, special days, and teacher-defined events
 * mapped across a full academic year.
 */
export const schoolCalendarEvents = mysqlTable("school_calendar_events", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  /** FK to school_calendars — null for legacy rows created before multi-calendar */
  calendarId: int("calendarId"),
  /** Academic year label e.g. '2025-2026' */
  academicYear: varchar("academicYear", { length: 16 }).notNull(),
  /** Event date (stored as UTC midnight) */
  eventDate: timestamp("eventDate").notNull(),
  /** 'holiday' | 'special' | 'exam' | 'excursion' | 'event' | 'lesson' */
  eventType: mysqlEnum("eventType", ["holiday", "special", "exam", "excursion", "event", "lesson", "ai_generated"]).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  /** LOMLOE competency code if this event is a lesson/activity */
  competency: varchar("competency", { length: 16 }),
  /** Year group this event applies to */
  yearGroup: varchar("yearGroup", { length: 16 }),
  /** Subject area */
  subject: varchar("subject", { length: 128 }),
  /** Whether this was AI-generated as infill */
  aiGenerated: boolean("aiGenerated").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SchoolCalendarEvent = typeof schoolCalendarEvents.$inferSelect;
export type InsertSchoolCalendarEvent = typeof schoolCalendarEvents.$inferInsert;

/**
 * Lesson plans — full LOMLOE-compliant lesson plans created by teachers.
 */
export const lessonPlans = mysqlTable("lesson_plans", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  /** Unit name/number */
  unit: varchar("unit", { length: 128 }),
  lessonNumber: varchar("lessonNumber", { length: 16 }),
  academicYear: varchar("academicYear", { length: 16 }),
  /** Duration in minutes */
  duration: int("duration"),
  title: varchar("title", { length: 255 }).notNull(),
  /** Year group / course e.g. '4th Primary' */
  yearGroup: varchar("yearGroup", { length: 64 }),
  subject: varchar("subject", { length: 128 }),
  /** JSON: { listening, speaking, reading, writing } booleans */
  skills: text("skills"),
  /** JSON: { grammar, phonology, lexis, function, discourse } booleans */
  systems: text("systems"),
  /** JSON array of specific competence codes */
  specificCompetences: text("specificCompetences"),
  /** JSON array of saberes básicos */
  saberesBasicos: text("saberesBasicos"),
  /** JSON array of learning outcome strings */
  learningOutcomes: text("learningOutcomes"),
  /** JSON array of evaluation criteria strings */
  evaluationCriteria: text("evaluationCriteria"),
  previousKnowledge: text("previousKnowledge"),
  materials: text("materials"),
  spaces: text("spaces"),
  /** JSON array of procedure steps: { timing, stage, activities, grouping } */
  procedures: text("procedures"),
  /** JSON array of LOMLOE competency codes covered */
  competencies: text("competencies"),
  /** Whether this plan was AI-generated */
  aiGenerated: boolean("aiGenerated").default(false).notNull(),
  /** Whether this plan is saved as a reusable template */
  isTemplate: boolean("isTemplate").default(false).notNull(),
  /** Optional display name for the template (defaults to title if blank) */
  templateName: varchar("templateName", { length: 255 }),
  /** Calendar event this lesson plan is linked to (optional) */
  calendarEventId: int("calendarEventId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type LessonPlan = typeof lessonPlans.$inferSelect;
export type InsertLessonPlan = typeof lessonPlans.$inferInsert;

/**
 * Question translations — stores ES and CA translations for static knowledge bank questions.
 * Keyed by questionId (matches LomloeQuestion.id from the static bank or generatedQuestions.questionId).
 * One row per (questionId, locale) pair.
 */
export const questionTranslations = mysqlTable("question_translations", {
  id: int("id").autoincrement().primaryKey(),
  /** Matches LomloeQuestion.id or generatedQuestions.questionId */
  questionId: varchar("questionId", { length: 32 }).notNull(),
  /** Language code: 'es' or 'ca' */
  locale: varchar("locale", { length: 8 }).notNull(),
  /** Translated question text */
  question: text("question").notNull(),
  /** JSON array of 4 translated option strings */
  options: text("options").notNull(),
  /** Translated explanation */
  explanation: text("explanation").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type QuestionTranslation = typeof questionTranslations.$inferSelect;
export type InsertQuestionTranslation = typeof questionTranslations.$inferInsert;

// ─── AI Governance Tables ────────────────────────────────────────────────────

/**
 * AI-generated assessments — one row per AI evaluation of a student's
 * competency performance. Teachers can override the AI grade.
 */
export const aiAssessments = mysqlTable("ai_assessments", {
  id: int("id").autoincrement().primaryKey(),
  /** Teacher who requested the assessment */
  teacherId: int("teacherId").notNull(),
  /** Student being assessed (references users.id) */
  studentId: int("studentId").notNull(),
  /** LOMLOE competency code e.g. 'CCL' */
  competency: varchar("competency", { length: 16 }).notNull(),
  /** Year group e.g. 'junior', 'primary', 'secondary' */
  yearGroup: varchar("yearGroup", { length: 32 }),
  /** AI-generated score 0–100 */
  aiScore: int("aiScore").notNull(),
  /** AI-generated performance summary */
  aiSummary: text("aiSummary").notNull(),
  /** Evidence used by the AI (JSON array of practice session IDs) */
  evidenceSessionIds: text("evidenceSessionIds"),
  /** Whether a teacher has overridden this assessment */
  overridden: boolean("overridden").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type AiAssessment = typeof aiAssessments.$inferSelect;
export type InsertAiAssessment = typeof aiAssessments.$inferInsert;

/**
 * Teacher grade overrides — full audit trail of every time a teacher
 * changes an AI-generated grade. Immutable once written.
 */
export const aiGradeOverrides = mysqlTable("ai_grade_overrides", {
  id: int("id").autoincrement().primaryKey(),
  /** The AI assessment being overridden */
  assessmentId: int("assessmentId").notNull(),
  /** Teacher performing the override */
  teacherId: int("teacherId").notNull(),
  /** Original AI score */
  aiScore: int("aiScore").notNull(),
  /** Teacher's replacement score 0–100 */
  teacherScore: int("teacherScore").notNull(),
  /** Mandatory justification — teacher must explain the override */
  reason: text("reason").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type AiGradeOverride = typeof aiGradeOverrides.$inferSelect;
export type InsertAiGradeOverride = typeof aiGradeOverrides.$inferInsert;

/**
 * AI bias flags — logged whenever the bias-guard middleware detects
 * potentially biased content in an AI response.
 */
export const aiBiasFlags = mysqlTable("ai_bias_flags", {
  id: int("id").autoincrement().primaryKey(),
  /** Session or request identifier */
  sessionId: varchar("sessionId", { length: 64 }),
  /** User who triggered the request */
  userId: int("userId"),
  /** The input prompt that led to the flagged output */
  inputText: text("inputText").notNull(),
  /** The AI output that was flagged */
  outputText: text("outputText").notNull(),
  /** Short description of the detected bias */
  flagReason: text("flagReason").notNull(),
  /** 'low' | 'medium' | 'high' */
  severity: mysqlEnum("severity", ["low", "medium", "high"]).default("medium").notNull(),
  /** Whether an admin has reviewed and resolved this flag */
  resolved: boolean("resolved").default(false).notNull(),
  resolvedAt: timestamp("resolvedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type AiBiasFlag = typeof aiBiasFlags.$inferSelect;
export type InsertAiBiasFlag = typeof aiBiasFlags.$inferInsert;

/**
 * AI learning path recommendations — each row is a full personalised
 * learning path generated for a student, with a structured justification
 * that a teacher or parent can audit.
 */
export const aiLearningPaths = mysqlTable("ai_learning_paths", {
  id: int("id").autoincrement().primaryKey(),
  /** Teacher who requested the path */
  teacherId: int("teacherId").notNull(),
  /** Student the path is for */
  studentId: int("studentId").notNull(),
  /** LOMLOE competency focus */
  competency: varchar("competency", { length: 16 }).notNull(),
  /** Year group */
  yearGroup: varchar("yearGroup", { length: 32 }),
  /** JSON array of path steps: { step, activity, duration, resources } */
  recommendedPath: text("recommendedPath").notNull(),
  /** Plain-language justification paragraph citing LOMLOE evidence */
  justification: text("justification").notNull(),
  /** JSON: evidence summary used — session scores, competency gaps */
  evidenceSummary: text("evidenceSummary"),
  /** LOMLOE article / competency references cited */
  lomloeReferences: text("lomloeReferences"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type AiLearningPath = typeof aiLearningPaths.$inferSelect;
export type InsertAiLearningPath = typeof aiLearningPaths.$inferInsert;

/**
 * Admin audit logs — records every significant admin or teacher action
 * for compliance, GDPR accountability, and EU AI Act audit trail requirements.
 */
export const adminAuditLogs = mysqlTable("admin_audit_logs", {
  id: int("id").autoincrement().primaryKey(),
  /** User who performed the action */
  userId: int("userId").notNull(),
  /** Action verb: e.g. 'grade_override', 'bias_resolve', 'data_delete', 'question_approve' */
  action: varchar("action", { length: 128 }).notNull(),
  /** Resource type: e.g. 'assessment', 'bias_flag', 'question', 'user' */
  resource: varchar("resource", { length: 128 }).notNull(),
  /** ID of the affected resource */
  resourceId: varchar("resourceId", { length: 64 }),
  /** JSON details of the action (before/after values, reason, etc.) */
  details: text("details"),
  /** Client IP address (anonymised to /24 prefix for privacy) */
  ipAddress: varchar("ipAddress", { length: 64 }),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});
export type AdminAuditLog = typeof adminAuditLogs.$inferSelect;
export type InsertAdminAuditLog = typeof adminAuditLogs.$inferInsert;

/**
 * DPA acceptances — records each user's acceptance of the Data Processing Agreement.
 * Required for GDPR Article 28 compliance (documented consent to data processing).
 */
export const dpaAcceptances = mysqlTable("dpa_acceptances", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  /** DPA version string, e.g. "1.0" */
  dpaVersion: varchar("dpaVersion", { length: 16 }).notNull().default("1.0"),
  /** UTC timestamp of acceptance */
  acceptedAt: timestamp("acceptedAt").defaultNow().notNull(),
  /** Anonymised IP address (/24 prefix) for audit trail */
  ipAddress: varchar("ipAddress", { length: 64 }),
});
export type DpaAcceptance = typeof dpaAcceptances.$inferSelect;
export type InsertDpaAcceptance = typeof dpaAcceptances.$inferInsert;

/**
 * Student progress reports — stores AI-generated and teacher-edited LOMLOE reports.
 * One row per (groupId, studentId) — upserted on each save.
 */
export const studentReports = mysqlTable("student_reports", {
  id: int("id").autoincrement().primaryKey(),
  groupId: int("groupId").notNull(),
  studentId: int("studentId").notNull(),
  /** The original AI-generated report text (markdown) */
  aiText: text("aiText").notNull(),
  /** Teacher-edited version (null = not yet edited, use aiText) */
  editedText: text("editedText"),
  /** LOMLOE grade derived by the AI */
  grade: varchar("grade", { length: 32 }),
  /** Overall score at time of generation */
  overall: int("overall"),
  /** userId of the teacher who last saved an edit */
  lastEditedBy: int("lastEditedBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type StudentReport = typeof studentReports.$inferSelect;
export type InsertStudentReport = typeof studentReports.$inferInsert;
