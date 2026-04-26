import { boolean, date, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin", "head_of_study", "territorial_director", "director", "teacher"]).default("user").notNull(),
  /** Position assigned by the Director — controls which nav menus are visible */
  position: mysqlEnum("position", ["unassigned", "teacher", "head_of_study", "director"]).default("unassigned").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
  ttsVoice: mysqlEnum("ttsVoice", ["nova", "shimmer", "alloy", "fable"]).default("nova"),
  /** Bcrypt hash for local email+password auth. NULL for Manus OAuth users. */
  passwordHash: varchar("passwordHash", { length: 255 }),
  /** Preferred display name set during local registration. */
  displayName: varchar("displayName", { length: 128 }),
  /** Set by a Director to prevent login without deleting data. NULL = active. */
  deactivatedAt: timestamp("deactivatedAt"),
  /**
   * Incremented on every "sign out from all devices" action.
   * The current value is embedded in the JWT; any token carrying an older
   * version is rejected, instantly invalidating all other active sessions.
   */
  sessionVersion: int("sessionVersion").default(1).notNull(),
  /**
   * JSON blob persisting the user's video-call preferences.
   * Shape: { backgroundId: string; filterId: string; blurIntensity: number }
   * Stored as TEXT so it works on all MySQL/TiDB versions without JSON column type.
   */
  callPrefs: text("callPrefs"),
  /**
   * Multi-tenant isolation key.
   * NULL = SEBA admin (bypasses all tenant filters and can see all data).
   * Non-null = the tenant group this user belongs to.
   * Set when a director is promoted or when an invited user registers.
   */
  tenantId: int("tenantId"),
  /**
   * For users with role='director': the physical location of their school.
   * NULL for all other roles.
   */
  schoolLocation: varchar("schoolLocation", { length: 64 }),
  /**
   * For users with role='director': the preferred school language (en/es/ca).
   * NULL for all other roles.
   */
  schoolLanguage: varchar("schoolLanguage", { length: 8 }),
  /**
   * For users with role='director': the full official school name selected from
   * the Generalitat de Catalunya directory. NULL for all other roles.
   */
  schoolName: varchar("schoolName", { length: 256 }),
  /**
   * When true the user must change their password before accessing the app.
   * Set to true for accounts created by admins with a temporary password.
   * Cleared to false once the user successfully changes their password.
   */
  mustChangePassword: boolean("mustChangePassword").default(false).notNull(),
  /**
   * Target contracted weekly teaching minutes for this teacher.
   * Used to render the hours progress bar in the Director's Teacher Profiles page.
   * NULL = no target set (progress bar hidden).
   */
  /** @migration 0047 */
  contractedWeeklyMinutes: int("contractedWeeklyMinutes"),
  /**
   * Whether this teacher is a permanent (fixed) member of staff.
   * Set to false for substitute / temporary teachers.
   * Directors and HoS see a visual badge when this is false.
   * NULL treated as true (permanent) for backwards compatibility.
   */
  /** @migration 0048 */
  isPermanent: boolean("isPermanent").default(true),
  /**
   * ZER (Zona Escolar Rural) opt-in per director.
   * When true AND the school tenant has isZer=true, this director also has
   * head-of-study capabilities without a separate HoS account.
   * @migration 0052
   */
  zerActsAsHos: boolean("zerActsAsHos").default(false).notNull(),
  /**
   * CUTCG (Col·legi Oficial de Doctors i Llicenciats en Filosofia i Lletres i en Ciències de Catalunya)
   * membership number for teachers. Displayed alongside the CUTCG badge.
   * NULL = not a CUTCG member or number not provided.
   * @migration 0053
   */
  cutcgMemberNumber: varchar("cutcgMemberNumber", { length: 32 }),
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
    "paraula",
    "image",
  ]).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  topic: varchar("topic", { length: 255 }).notNull(),
  competency: varchar("competency", { length: 16 }),
  yearGroup: varchar("yearGroup", { length: 16 }),
  content: text("content").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  /** Tenant isolation key — matches users.tenantId of the creating teacher */
  tenantId: int("tenantId"),
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
  /** Tenant isolation key */
  tenantId: int("tenantId"),
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
  /** HOS fields — added in migration 0033 */
  /** Year group: infantil | junior | primary | secondary */
  yearGroup: mysqlEnum("yearGroup", ["infantil", "junior", "primary", "secondary"]).default("secondary"),
  /** Academic year e.g. "2025-26" */
  academicYear: varchar("academicYear", { length: 16 }).default("2025-26"),
  /** FK to users.id — form tutor */
  formTutorId: int("formTutorId"),
  /** Approximate student count */
  studentCount: int("studentCount").default(0),
  /** Optional notes */
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  /** Tenant isolation key */
  tenantId: int("tenantId"),
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
  /** Tenant isolation key */
  tenantId: int("tenantId"),
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
  /** Tenant isolation key */
  tenantId: int("tenantId"),
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
  /** Tenant isolation key */
  tenantId: int("tenantId"),
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
  /** Tenant isolation key */
  tenantId: int("tenantId"),
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
  /** First day of the academic year / topic block (stored as UTC midnight). Also anchors Week 1 numbering. */
  startDate: timestamp("startDate"),
  /** Last day of the academic year / topic block (stored as UTC midnight) */
  endDate: timestamp("endDate"),
  /** Term 1 start date — for full_year calendars with 3 semesters (e.g. Catalonia) */
  term1Start: timestamp("term1Start"),
  /** Term 1 end date */
  term1End: timestamp("term1End"),
  /** Term 2 start date */
  term2Start: timestamp("term2Start"),
  /** Term 2 end date */
  term2End: timestamp("term2End"),
  /** Term 3 start date */
  term3Start: timestamp("term3Start"),
  /** Term 3 end date */
  term3End: timestamp("term3End"),
  /** Optional description of the topic/unit — used by AI infill to scope lesson generation */
  topicDescription: text("topicDescription"),
  /** Optional link to a class group — lesson events are auto-created as assignments for this group */
  linkedGroupId: int("linkedGroupId"),
  /** JSON array of weekday numbers (1=Mon … 5=Fri) for lesson infill, e.g. '[1,3,5]' */
  lessonDays: varchar("lessonDays", { length: 32 }),
  /** Spanish autonomous community for regional holiday auto-insert, e.g. 'catalonia' */
  region: varchar("region", { length: 32 }).default("catalonia"),
  /** Default lesson start time for this calendar, e.g. '09:00' — pre-fills new lesson events */
  defaultStartTime: varchar("defaultStartTime", { length: 8 }),
  /** Default lesson end time for this calendar, e.g. '10:00' — pre-fills new lesson events */
  defaultEndTime: varchar("defaultEndTime", { length: 8 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  /** Tenant isolation key */
  tenantId: int("tenantId"),
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
  /** Optional start time string e.g. '09:00' */
  startTime: varchar("startTime", { length: 8 }),
  /** Optional end time string e.g. '10:00' */
  endTime: varchar("endTime", { length: 8 }),
  /** UUID shared by all events in a recurring series — null for one-off events */
  seriesId: varchar("seriesId", { length: 36 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  /** Tenant isolation key */
  tenantId: int("tenantId"),
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
  /** Date of the actual lesson (ISO date string YYYY-MM-DD from the calendar event) */
  lessonDate: varchar("lessonDate", { length: 16 }),
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
  /**
   * JSON: differentiated instruction for three learner tiers.
   * Shape: { advanced: { objectives, activities, assessment }, standard: { ... }, slower: { ... } }
   */
  differentiation: text("differentiation"),
  /** Whether this plan was AI-generated */
  aiGenerated: boolean("aiGenerated").default(false).notNull(),
  /** Whether this plan is saved as a reusable template */
  isTemplate: boolean("isTemplate").default(false).notNull(),
  /** Optional display name for the template (defaults to title if blank) */
  templateName: varchar("templateName", { length: 255 }),
  /** Session time e.g. '09:00-10:00' */
  sessionTime: varchar("sessionTime", { length: 32 }),
  /** Calendar event this lesson plan is linked to (optional) */
  calendarEventId: int("calendarEventId"),
  /** Educació Infantil: Eix de Desenvolupament code (EIX1–EIX4, Decree 21/2023). NULL for non-Infantil plans. */
  infantilEix: varchar("infantilEix", { length: 8 }),
  /** Educació Infantil: cycle ('0-3' or '3-6'). NULL for non-Infantil plans. */
  infantilCycle: varchar("infantilCycle", { length: 8 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  /** Tenant isolation key */
  tenantId: int("tenantId"),
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
  /** Tenant isolation key */
  tenantId: int("tenantId"),
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
  /** Tenant isolation key */
  tenantId: int("tenantId"),
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
  /** Tenant isolation key */
  tenantId: int("tenantId"),
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
  /** Tenant isolation key */
  tenantId: int("tenantId"),
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
  /** Tenant isolation key */
  tenantId: int("tenantId"),
});
export type StudentReport = typeof studentReports.$inferSelect;
export type InsertStudentReport = typeof studentReports.$inferInsert;

/**
 * What's New dismissals — tracks which app versions a user has already seen.
 * One row per (userId, version). Guests use localStorage; this table is for
 * authenticated teachers so their dismissal persists across devices.
 */
export const whatsNewDismissals = mysqlTable("whats_new_dismissals", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  /** App version string, e.g. "2025-04-11" */
  version: varchar("version", { length: 32 }).notNull(),
  dismissedAt: timestamp("dismissedAt").defaultNow().notNull(),
});
export type WhatsNewDismissal = typeof whatsNewDismissals.$inferSelect;
export type InsertWhatsNewDismissal = typeof whatsNewDismissals.$inferInsert;

/**
 * Error log — every captured server error and client crash is stored here.
 * The self-healing system reads this table to decide what to fix automatically.
 */
export const errorLogs = mysqlTable("error_logs", {
  id: int("id").autoincrement().primaryKey(),
  /** Where the error originated: "server" | "client" | "health_check" */
  source: varchar("source", { length: 32 }).notNull(),
  /** tRPC error code or HTTP status string */
  errorCode: varchar("errorCode", { length: 64 }),
  /** Human-readable error message (sanitised — no stack traces) */
  errorMessage: text("errorMessage"),
  /** JSON blob: procedure name, userId, input shape, page URL, etc. */
  context: text("context"),
  /** Set when the self-healing system resolves this error automatically */
  resolvedAt: timestamp("resolvedAt"),
  /** Short description of the fix that was applied, if any */
  fixApplied: text("fixApplied"),
  /** True when the error cannot be auto-fixed and needs human review */
  requiresEscalation: boolean("requiresEscalation").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type ErrorLog = typeof errorLogs.$inferSelect;
export type InsertErrorLog = typeof errorLogs.$inferInsert;

/**
 * Fix history — one row per automated fix attempt made by the self-healing system.
 */
export const fixHistory = mysqlTable("fix_history", {
  id: int("id").autoincrement().primaryKey(),
  /** References error_logs.id that triggered this fix (nullable for proactive fixes) */
  errorLogId: int("errorLogId"),
  /** Category: "create_missing_table" | "add_missing_column" | "rebuild_index" | "restart_service" */
  fixType: varchar("fixType", { length: 64 }).notNull(),
  /** Human-readable description of what was done */
  fixDescription: text("fixDescription").notNull(),
  appliedAt: timestamp("appliedAt").defaultNow().notNull(),
  /** Whether the fix succeeded */
  success: boolean("success").default(true).notNull(),
  /** Any error message if the fix itself failed */
  failureReason: text("failureReason"),
});
export type FixHistory = typeof fixHistory.$inferSelect;
export type InsertFixHistory = typeof fixHistory.$inferInsert;

/**
 * Calendar session entries — multiple named lesson slots per calendar.
 * Each entry defines a name (e.g. "Monday English"), lesson days (JSON array of
 * weekday numbers 1=Mon…5=Fri), a start time and end time for the session.
 * Used for clash detection across calendars.
 */
export const calendarSessions = mysqlTable("calendar_sessions", {
  id: int("id").autoincrement().primaryKey(),
  calendarId: int("calendarId").notNull(),
  userId: int("userId").notNull(),
  /** Human-readable label for this session slot, e.g. "Monday English" */
  name: varchar("name", { length: 128 }).notNull(),
  /** JSON array of weekday numbers (1=Mon … 5=Fri), e.g. '[1,3]' */
  lessonDays: varchar("lessonDays", { length: 32 }).notNull().default("[]"),
  /** Session start time in HH:MM format, e.g. '09:00' */
  startTime: varchar("startTime", { length: 8 }).notNull(),
  /** Session end time in HH:MM format, e.g. '10:00' */
  endTime: varchar("endTime", { length: 8 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  /** Tenant isolation key */
  tenantId: int("tenantId"),
});

export type CalendarSession = typeof calendarSessions.$inferSelect;
export type InsertCalendarSession = typeof calendarSessions.$inferInsert;

// ── Session Entry Templates ────────────────────────────────────────────────
export const sessionTemplates = mysqlTable("session_templates", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  /** Human-readable name for this template, e.g. "Standard Week" */
  name: varchar("name", { length: 128 }).notNull(),
  /** JSON array of session entry objects: {name, lessonDays, startTime, endTime} */
  sessions: text("sessions").notNull().default("[]"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  /** Tenant isolation key */
  tenantId: int("tenantId"),
});

export type SessionTemplate = typeof sessionTemplates.$inferSelect;
export type InsertSessionTemplate = typeof sessionTemplates.$inferInsert;

/**
 * Lesson plan templates — reusable plan structures saved by teachers.
 * The `data` column stores a JSON snapshot of all lesson plan fields
 * (excluding title and lessonNumber so they can be set fresh on apply).
 */
export const lessonPlanTemplates = mysqlTable("lesson_plan_templates", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  /** Display name for this template, e.g. "Standard Primary Science Lesson" */
  name: varchar("name", { length: 128 }).notNull(),
  /** Optional short description */
  description: varchar("description", { length: 255 }),
  /** JSON snapshot of all lesson plan fields (subject, yearGroup, competencies, sections, etc.) */
  data: text("data").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  /** Tenant isolation key */
  tenantId: int("tenantId"),
});

export type LessonPlanTemplate = typeof lessonPlanTemplates.$inferSelect;
export type InsertLessonPlanTemplate = typeof lessonPlanTemplates.$inferInsert;

/**
 * Bias scan runs — one row per 24-hour automated scan of unresolved bias flags.
 * Tracks when the scan ran, how many incidents were found, and how many fixes
 * were automatically applied.
 */
export const biasScanRuns = mysqlTable("bias_scan_runs", {
  id: int("id").autoincrement().primaryKey(),
  /** UTC timestamp when the scan started */
  runAt: timestamp("runAt").defaultNow().notNull(),
  /** 'running' | 'completed' | 'failed' */
  status: mysqlEnum("status", ["running", "completed", "failed"]).default("running").notNull(),
  /** Total unresolved bias flags found at scan time */
  incidentCount: int("incidentCount").default(0).notNull(),
  /** Number of incidents for which a fix suggestion was generated */
  fixesGenerated: int("fixesGenerated").default(0).notNull(),
  /** Number of incidents automatically resolved during this scan */
  fixesApplied: int("fixesApplied").default(0).notNull(),
  /** Plain-language summary of the scan result */
  summary: text("summary"),
  /** Error message if status = 'failed' */
  errorMessage: text("errorMessage"),
});
export type BiasScanRun = typeof biasScanRuns.$inferSelect;
export type InsertBiasScanRun = typeof biasScanRuns.$inferInsert;

/**
 * Bias scan fix suggestions — one row per bias flag that was analysed during
 * a scan. Stores the LLM-generated fix suggestion and whether it was applied.
 */
export const biasScanFixSuggestions = mysqlTable("bias_scan_fix_suggestions", {
  id: int("id").autoincrement().primaryKey(),
  /** References bias_scan_runs.id */
  scanRunId: int("scanRunId").notNull(),
  /** References ai_bias_flags.id */
  biasFlagId: int("biasFlagId").notNull(),
  /** LLM-generated explanation of why this output is biased */
  biasExplanation: text("biasExplanation").notNull(),
  /** LLM-generated replacement/corrected output text */
  suggestedFix: text("suggestedFix").notNull(),
  /** Whether the fix has been applied (flag resolved) */
  applied: boolean("applied").default(false).notNull(),
  appliedAt: timestamp("appliedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type BiasScanFixSuggestion = typeof biasScanFixSuggestions.$inferSelect;
export type InsertBiasScanFixSuggestion = typeof biasScanFixSuggestions.$inferInsert;

/**
 * App settings — generic key-value store for admin-configurable settings.
 * Used to persist the bias scan schedule hour and other runtime config.
 */
export const appSettings = mysqlTable("app_settings", {
  id: int("id").autoincrement().primaryKey(),
  /** Setting key, e.g. "bias_scan_hour" */
  key: varchar("key", { length: 128 }).notNull().unique(),
  /** Setting value (stored as string) */
  value: text("value").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type AppSetting = typeof appSettings.$inferSelect;
export type InsertAppSetting = typeof appSettings.$inferInsert;

/**
 * Timetable slots — Head of Study weekly schedule grid.
 * One row per period per day. dayOfWeek: 1=Mon … 5=Fri.
 */
export const timetableSlots = mysqlTable("timetable_slots", {
  id: int("id").autoincrement().primaryKey(),
  /** 1=Monday … 5=Friday */
  dayOfWeek: int("dayOfWeek").notNull(),
  /** 1-based period index within the day */
  periodNumber: int("periodNumber").notNull(),
  /** HH:MM e.g. '09:00' */
  startTime: varchar("startTime", { length: 8 }).notNull(),
  /** HH:MM e.g. '10:00' */
  endTime: varchar("endTime", { length: 8 }).notNull(),
  /** FK to users.id — null means unassigned */
  teacherId: int("teacherId"),
  /** FK to class_groups.id — null means unassigned */
  classGroupId: int("classGroupId"),
  subject: varchar("subject", { length: 128 }),
  room: varchar("room", { length: 64 }),
  academicYear: varchar("academicYear", { length: 16 }).notNull().default("2025-26"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  /** Tenant isolation key */
  tenantId: int("tenantId"),
});

export type TimetableSlot = typeof timetableSlots.$inferSelect;
export type InsertTimetableSlot = typeof timetableSlots.$inferInsert;

/**
 * Attendance records — daily register per student per class group.
 * One row per student per date (unique constraint).
 */
export const attendanceRecords = mysqlTable("attendance_records", {
  id: int("id").autoincrement().primaryKey(),
  /** FK to class_groups.id */
  classGroupId: int("classGroupId").notNull(),
  /** FK to group_students.id */
  studentId: int("studentId").notNull(),
  date: date("date").notNull(),
  status: mysqlEnum("status", ["present", "absent", "late", "excused"]).notNull().default("present"),
  notes: text("notes"),
  /** FK to users.id — who marked the register */
  recordedBy: int("recordedBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AttendanceRecord = typeof attendanceRecords.$inferSelect;
export type InsertAttendanceRecord = typeof attendanceRecords.$inferInsert;


/**
 * Assessment events — HOS term-based calendar of exams, evaluations, and deadlines.
 */
export const assessmentEvents = mysqlTable("assessment_events", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 256 }).notNull(),
  eventType: mysqlEnum("eventType", ["exam", "evaluation", "deadline", "meeting", "other"]).notNull().default("exam"),
  /** Optional year group filter — null means school-wide */
  yearGroup: varchar("yearGroup", { length: 64 }),
  /** Optional subject */
  subject: varchar("subject", { length: 128 }),
  /** Start date (YYYY-MM-DD) */
  startDate: varchar("startDate", { length: 16 }).notNull(),
  /** End date (YYYY-MM-DD) — same as startDate for single-day events */
  endDate: varchar("endDate", { length: 16 }).notNull(),
  notes: text("notes"),
  /** FK to users.id — who created the event */
  createdBy: int("createdBy"),
  academicYear: varchar("academicYear", { length: 16 }).notNull().default("2025-26"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  /** Tenant isolation key */
  tenantId: int("tenantId"),
});
export type AssessmentEvent = typeof assessmentEvents.$inferSelect;
export type InsertAssessmentEvent = typeof assessmentEvents.$inferInsert;

/**
 * Saved Situacions d'Aprenentatge — teacher personal library.
 */
export const savedSituacions = mysqlTable("saved_situacions", {
  id: int("id").autoincrement().primaryKey(),
  /** FK to users.id */
  userId: int("userId").notNull(),
  title: varchar("title", { length: 256 }).notNull(),
  topic: varchar("topic", { length: 256 }).notNull(),
  subject: varchar("subject", { length: 128 }).notNull(),
  yearGroup: varchar("yearGroup", { length: 32 }).notNull(),
  /** Comma-separated competency codes e.g. "CCL,STEM,CD" */
  competencies: varchar("competencies", { length: 128 }).notNull(),
  /** Full JSON result blob */
  resultJson: text("resultJson").notNull(),
  language: varchar("language", { length: 8 }).notNull().default("ca"),
  /** Whether this SA is shared school-wide (set by HOS/admin) */
  isShared: boolean("isShared").default(false).notNull(),
  /** Display name of the author (denormalised for shared library) */
  sharedBy: varchar("sharedBy", { length: 128 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  /** Tenant isolation key */
  tenantId: int("tenantId"),
});
export type SavedSituacio = typeof savedSituacions.$inferSelect;
export type InsertSavedSituacio = typeof savedSituacions.$inferInsert;

/**
 * School-wide settings — logo, name, and branding.
 * Single-row table (id = 1 always).
 */
export const schoolSettings = mysqlTable("school_settings", {
  id: int("id").primaryKey().autoincrement(),
  schoolName: varchar("schoolName", { length: 256 }),
  logoUrl: text("logoUrl"),
  logoKey: varchar("logoKey", { length: 512 }),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  /** Tenant isolation key */
  tenantId: int("tenantId"),
});
export type SchoolSettings = typeof schoolSettings.$inferSelect;
export type InsertSchoolSettings = typeof schoolSettings.$inferInsert;

/**
 * Wake words — admin-configurable trigger words for the voice assistant.
 * The primary word is shown in the UI hint; all active words are checked
 * during speech recognition.
 */
export const wakeWords = mysqlTable("wake_words", {
  id: int("id").primaryKey().autoincrement(),
  /** The trigger word (lowercase, e.g. "aina") */
  word: varchar("word", { length: 64 }).notNull(),
  /**
   * JSON array of phonetic near-miss variants that speech recognition
   * may produce, e.g. ["ayna","anna","haina","ina"]
   */
  phoneticVariants: text("phoneticVariants").notNull(),
  /** If true, this word is shown in the mic status hint text */
  isPrimary: boolean("isPrimary").default(false).notNull(),
  /** If false, the word is disabled but not deleted */
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  /** Tenant isolation key */
  tenantId: int("tenantId"),
});
export type WakeWord = typeof wakeWords.$inferSelect;
export type InsertWakeWord = typeof wakeWords.$inferInsert;

/**
 * Custom audio responses — admin-uploaded audio files that play back
 * when the assistant's reply contains a matching trigger phrase.
 */
export const audioResponses = mysqlTable("audio_responses", {
  id: int("id").primaryKey().autoincrement(),
  /** Human-readable label, e.g. "Welcome greeting" */
  label: varchar("label", { length: 256 }).notNull(),
  /** JSON array of trigger phrases (lowercase), e.g. ["hello","welcome","hola"] */
  triggerPhrases: text("triggerPhrases").notNull(),
  /** Public S3 URL for the audio file */
  fileUrl: text("fileUrl").notNull(),
  /** S3 key used for deletion */
  fileKey: varchar("fileKey", { length: 512 }).notNull(),
  /** MIME type, e.g. "audio/mpeg" */
  mimeType: varchar("mimeType", { length: 64 }).notNull().default("audio/mpeg"),
  /** Duration in seconds (optional, filled after upload) */
  durationSecs: int("durationSecs"),
  /** Whether this audio response is enabled */
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  /** Owner user id */
  createdBy: varchar("createdBy", { length: 128 }),
  /** Tenant isolation key */
  tenantId: int("tenantId"),
});
export type AudioResponse = typeof audioResponses.$inferSelect;
export type InsertAudioResponse = typeof audioResponses.$inferInsert;

/**
 * Attendance changes — audit trail of who changed each attendance record.
 */
export const attendanceChanges = mysqlTable("attendance_changes", {
  id: int("id").autoincrement().primaryKey(),
  /** FK to attendance_records.id */
  attendanceRecordId: int("attendanceRecordId").notNull(),
  /** FK to users.id — who made the change */
  changedBy: int("changedBy").notNull(),
  changedByName: varchar("changedByName", { length: 256 }).notNull(),
  changedAt: timestamp("changedAt").defaultNow().notNull(),
  previousStatus: mysqlEnum("previousStatus", ["present", "absent", "late", "excused"]),
  newStatus: mysqlEnum("newStatus", ["present", "absent", "late", "excused"]).notNull(),
  note: text("note"),
  /** Tenant isolation key */
  tenantId: int("tenantId"),
});

export type AttendanceChange = typeof attendanceChanges.$inferSelect;
export type InsertAttendanceChange = typeof attendanceChanges.$inferInsert;

// ─── SEBA Espai de Col·laboració — Extended Tables ────────────────────────────

/**
 * Forum message reactions — emoji reactions on channel messages.
 * One row per (messageId, userId, emoji) — unique constraint prevents duplicates.
 */
export const forumReactions = mysqlTable("forum_reactions", {
  id: int("id").autoincrement().primaryKey(),
  messageId: int("messageId").notNull(),
  userId: int("userId").notNull(),
  emoji: varchar("emoji", { length: 8 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type ForumReaction = typeof forumReactions.$inferSelect;
export type InsertForumReaction = typeof forumReactions.$inferInsert;

/**
 * Forum pinned messages — announcements pinned to a channel by a teacher/HOS/Director.
 */
export const forumPins = mysqlTable("forum_pins", {
  id: int("id").autoincrement().primaryKey(),
  channelId: int("channelId").notNull(),
  messageId: int("messageId").notNull(),
  pinnedBy: int("pinnedBy").notNull(),
  pinnedAt: timestamp("pinnedAt").defaultNow().notNull(),
});
export type ForumPin = typeof forumPins.$inferSelect;
export type InsertForumPin = typeof forumPins.$inferInsert;

/**
 * Channel files — files uploaded to a channel, stored in S3.
 */
export const channelFiles = mysqlTable("channel_files", {
  id: int("id").autoincrement().primaryKey(),
  channelId: int("channelId").notNull(),
  uploadedBy: int("uploadedBy").notNull(),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  fileKey: text("fileKey").notNull(),
  fileUrl: text("fileUrl").notNull(),
  mimeType: varchar("mimeType", { length: 128 }).notNull(),
  fileSize: int("fileSize").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type ChannelFile = typeof channelFiles.$inferSelect;
export type InsertChannelFile = typeof channelFiles.$inferInsert;

/**
 * Message threads — reply threads on channel messages (like Teams thread replies).
 */
export const forumThreadReplies = mysqlTable("forum_thread_replies", {
  id: int("id").autoincrement().primaryKey(),
  parentMessageId: int("parentMessageId").notNull(),
  channelId: int("channelId").notNull(),
  userId: int("userId").notNull(),
  body: text("body").notNull(),
  translatedBodies: text("translatedBodies"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type ForumThreadReply = typeof forumThreadReplies.$inferSelect;
export type InsertForumThreadReply = typeof forumThreadReplies.$inferInsert;

// ─── SEBA Connect (Teams-style collaboration) ───────────────────────────────

/**
 * SEBA Connect channels — subject, year group, or general spaces.
 */
export const teamsChannels = mysqlTable("teams_channels", {
  id: int("id").primaryKey().autoincrement(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  /** general | subject | year_group | announcement */
  type: varchar("type", { length: 30 }).notNull().default("general"),
  /** Optional hex colour accent for the channel icon */
  colour: varchar("colour", { length: 10 }),
  createdBy: varchar("createdBy", { length: 128 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  isArchived: boolean("isArchived").default(false).notNull(),
  /** Tenant isolation key */
  tenantId: int("tenantId"),
});
export type TeamsChannel = typeof teamsChannels.$inferSelect;

/**
 * SEBA Connect messages — per-channel messages with cached translations.
 */
export const teamsMessages = mysqlTable("teams_messages", {
  id: int("id").primaryKey().autoincrement(),
  channelId: int("channelId").notNull(),
  userId: varchar("userId", { length: 128 }).notNull(),
  /** Original content as typed by the sender */
  content: text("content").notNull(),
  /** JSON map { en, es, ca } — cached after first translation request */
  translations: text("translations"),
  attachmentUrl: text("attachmentUrl"),
  attachmentKey: text("attachmentKey"),
  attachmentName: varchar("attachmentName", { length: 255 }),
  replyToId: int("replyToId"),
  isDeleted: boolean("isDeleted").default(false).notNull(),
  editedAt: timestamp("editedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type TeamsMessage = typeof teamsMessages.$inferSelect;

/**
 * SEBA Connect assignments — tasks created by teachers/HOS/Director per channel.
 */
export const teamsAssignments = mysqlTable("teams_assignments", {
  id: int("id").primaryKey().autoincrement(),
  channelId: int("channelId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  dueDate: timestamp("dueDate"),
  createdBy: varchar("createdBy", { length: 128 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  maxScore: int("maxScore").default(100),
  isPublished: boolean("isPublished").default(true).notNull(),
  /** Tenant isolation key */
  tenantId: int("tenantId"),
});
export type TeamsAssignment = typeof teamsAssignments.$inferSelect;

/**
 * SEBA Connect submissions — student responses to assignments.
 */
export const teamsSubmissions = mysqlTable("teams_submissions", {
  id: int("id").primaryKey().autoincrement(),
  assignmentId: int("assignmentId").notNull(),
  userId: varchar("userId", { length: 128 }).notNull(),
  content: text("content"),
  fileUrl: text("fileUrl"),
  fileKey: text("fileKey"),
  fileName: varchar("fileName", { length: 255 }),
  submittedAt: timestamp("submittedAt").defaultNow().notNull(),
  score: int("score"),
  feedback: text("feedback"),
  gradedBy: varchar("gradedBy", { length: 128 }),
  gradedAt: timestamp("gradedAt"),
});
export type TeamsSubmission = typeof teamsSubmissions.$inferSelect;

/**
 * SEBA Connect files — shared files per channel (S3-backed).
 */
export const teamsFiles = mysqlTable("teams_files", {
  id: int("id").primaryKey().autoincrement(),
  channelId: int("channelId").notNull(),
  uploadedBy: varchar("uploadedBy", { length: 128 }).notNull(),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  fileUrl: text("fileUrl").notNull(),
  fileKey: text("fileKey").notNull(),
  mimeType: varchar("mimeType", { length: 100 }),
  fileSize: int("fileSize"),
  uploadedAt: timestamp("uploadedAt").defaultNow().notNull(),
  /** Tenant isolation key */
  tenantId: int("tenantId"),
});
export type TeamsFile = typeof teamsFiles.$inferSelect;

/**
 * DM call records — one row per direct-message video/audio call between two users.
 * status: 'pending' = ringing, 'active' = accepted, 'declined' = callee declined,
 *         'missed' = no answer (expired), 'ended' = call ended normally.
 */
export const dmCalls = mysqlTable("dm_calls", {
  id: int("id").autoincrement().primaryKey(),
  callerId: int("callerId").notNull(),
  calleeId: int("calleeId").notNull(),
  roomName: varchar("roomName", { length: 128 }).notNull(),
  status: mysqlEnum("status", ["pending", "active", "declined", "missed", "ended"])
    .default("pending")
    .notNull(),
  audioOnly: boolean("audioOnly").default(false).notNull(),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  acceptedAt: timestamp("acceptedAt"),
  endedAt: timestamp("endedAt"),
  durationSeconds: int("durationSeconds"),
  /** Tenant isolation key */
  tenantId: int("tenantId"),
});
export type DmCall = typeof dmCalls.$inferSelect;
export type InsertDmCall = typeof dmCalls.$inferInsert;

/**
 * WebRTC signalling — sovereign peer-to-peer video/audio for SebaMeet.
 * webrtc_sessions: one row per active call room (channel or DM).
 * webrtc_signals: SDP offer/answer and ICE candidates exchanged via polling.
 */
export const webrtcSessions = mysqlTable("webrtc_sessions", {
  id: int("id").autoincrement().primaryKey(),
  roomName: varchar("roomName", { length: 128 }).notNull().unique(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  endedAt: timestamp("endedAt"),
  /** Tenant isolation key */
  tenantId: int("tenantId"),
});
export type WebrtcSession = typeof webrtcSessions.$inferSelect;

export const webrtcSignals = mysqlTable("webrtc_signals", {
  id: int("id").autoincrement().primaryKey(),
  roomName: varchar("roomName", { length: 128 }).notNull(),
  fromUserId: int("fromUserId").notNull(),
  toUserId: int("toUserId"),
  type: varchar("type", { length: 32 }).notNull(),
  payload: text("payload").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  consumed: boolean("consumed").default(false).notNull(),
});
export type WebrtcSignal = typeof webrtcSignals.$inferSelect;

/**
 * webrtc_participants: one row per user currently in a room.
 * Heartbeat-based presence — rows older than 30 s are treated as gone.
 */
export const webrtcParticipants = mysqlTable("webrtc_participants", {
  id: int("id").autoincrement().primaryKey(),
  roomName: varchar("roomName", { length: 128 }).notNull(),
  userId: int("userId").notNull(),
  joinedAt: timestamp("joinedAt").defaultNow().notNull(),
  lastSeen: timestamp("lastSeen").defaultNow().notNull(),
});
export type WebrtcParticipant = typeof webrtcParticipants.$inferSelect;

/**
 * meeting_invitations: scheduled meeting invitations between users.
 * Sender proposes a date/time + optional message; recipient accepts or declines.
 */
export const meetingInvitations = mysqlTable("meeting_invitations", {
  id: int("id").autoincrement().primaryKey(),
  fromUserId: int("fromUserId").notNull(),
  toUserId: int("toUserId").notNull(),
  title: varchar("title", { length: 256 }).notNull(),
  proposedAt: timestamp("proposedAt").notNull(),
  durationMinutes: int("durationMinutes").default(30).notNull(),
  message: text("message"),
  agenda: text("agenda"),
  recurrence: mysqlEnum("recurrence", ["none", "weekly", "biweekly"]).default("none").notNull(),
  reminderSentAt: timestamp("reminderSentAt"),
  roomName: varchar("roomName", { length: 128 }).notNull(),
  status: mysqlEnum("status", ["pending", "accepted", "declined", "cancelled"]).default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  respondedAt: timestamp("respondedAt"),
  /** Tenant isolation key */
  tenantId: int("tenantId"),
});
export type MeetingInvitation = typeof meetingInvitations.$inferSelect;

/**
 * call_chat_messages: in-call text chat messages persisted per DM call.
 * Messages are sent over WebRTC data channel during the call and saved
 * server-side for post-call review.
 */
export const callChatMessages = mysqlTable("call_chat_messages", {
  id:         int("id").autoincrement().primaryKey(),
  callId:     int("callId").notNull(),        // references dm_calls.id
  userId:     int("userId").notNull(),
  senderName: varchar("senderName", { length: 256 }).notNull(),
  message:    text("message").notNull(),
  sentAt:     timestamp("sentAt").defaultNow().notNull(),
  /** Tenant isolation key */
  tenantId: int("tenantId"),
});
export type CallChatMessage = typeof callChatMessages.$inferSelect;

/**
 * password_reset_tokens: time-limited tokens for the sovereign password reset flow.
 * One active token per user at a time; old tokens are invalidated on use or expiry.
 */
export const passwordResetTokens = mysqlTable("password_reset_tokens", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  token: varchar("token", { length: 128 }).notNull().unique(),
  expiresAt: timestamp("expiresAt").notNull(),
  usedAt: timestamp("usedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;


/**
 * teacher_invites: one-time registration links generated by a Director.
 * Token is valid for 48 hours and can only be used once.
 */
export const teacherInvites = mysqlTable("teacher_invites", {
  id: int("id").autoincrement().primaryKey(),
  token: varchar("token", { length: 128 }).notNull().unique(),
  email: varchar("email", { length: 320 }),
  createdByUserId: int("createdByUserId").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  /** Set when the invite is accepted — references the new teacher's user ID */
  usedByUserId: int("usedByUserId"),
  usedAt: timestamp("usedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  /** Tenant isolation key — set to the inviting director's tenantId */
  tenantId: int("tenantId"),
});
export type TeacherInvite = typeof teacherInvites.$inferSelect;
export type InsertTeacherInvite = typeof teacherInvites.$inferInsert;

/**
 * individual_learning_plans: AI-generated personalised learning plans for individual students.
 * Each plan targets one student and is authored by a teacher.
 */
export const individualLearningPlans = mysqlTable("individual_learning_plans", {
  id: int("id").autoincrement().primaryKey(),
  /** Teacher who created the plan */
  teacherId: int("teacherId").notNull(),
  /** Student name (free text — no user account required; optional) */
  studentName: varchar("studentName", { length: 256 }),
  /** Year group / age range */
  yearGroup: varchar("yearGroup", { length: 32 }),
  /** Subject or area of focus */
  subject: varchar("subject", { length: 128 }),
  /** LOMLOE competency codes targeted (comma-separated) */
  competencies: varchar("competencies", { length: 512 }),
  /** Duration of the plan (e.g. "4 weeks", "1 term") */
  duration: varchar("duration", { length: 64 }),
  /** Student's current level / context provided by teacher */
  studentContext: text("studentContext"),
  /** Learning goals set by the teacher */
  learningGoals: text("learningGoals"),
  /** Full AI-generated plan content (markdown) */
  planContent: text("planContent"),
  /** Language the plan was generated in: en | es | ca */
  language: varchar("language", { length: 8 }).default("en").notNull(),
  /** Status: draft | active | completed | archived */
  status: mysqlEnum("status", ["draft", "active", "completed", "archived"]).default("draft").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  /** Tenant isolation key */
  tenantId: int("tenantId"),
});
export type IndividualLearningPlan = typeof individualLearningPlans.$inferSelect;
export type InsertIndividualLearningPlan = typeof individualLearningPlans.$inferInsert;

/**
 * individual_lesson_plans: AI-generated lesson plans tailored to an individual student.
 * Linked to a learning plan or standalone.
 */
export const individualLessonPlans = mysqlTable("individual_lesson_plans", {
  id: int("id").autoincrement().primaryKey(),
  /** Teacher who created the plan */
  teacherId: int("teacherId").notNull(),
  /** Optional link to a parent learning plan */
  learningPlanId: int("learningPlanId"),
  /** Student name (optional) */
  studentName: varchar("studentName", { length: 256 }),
  /** Year group */
  yearGroup: varchar("yearGroup", { length: 32 }),
  /** Subject */
  subject: varchar("subject", { length: 128 }),
  /** Topic / lesson title */
  topic: varchar("topic", { length: 256 }),
  /** LOMLOE competency codes (comma-separated) */
  competencies: varchar("competencies", { length: 512 }),
  /** Lesson duration in minutes */
  durationMinutes: int("durationMinutes").default(60),
  /** Student context / differentiation notes */
  studentContext: text("studentContext"),
  /** Learning objectives */
  objectives: text("objectives"),
  /** Full AI-generated lesson plan content (markdown) */
  planContent: text("planContent"),
  /** Language: en | es | ca */
  language: varchar("language", { length: 8 }).default("en").notNull(),
  /** Status: draft | ready | delivered */
  status: mysqlEnum("status", ["draft", "ready", "delivered"]).default("draft").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  /** Tenant isolation key */
  tenantId: int("tenantId"),
});
export type IndividualLessonPlan = typeof individualLessonPlans.$inferSelect;
export type InsertIndividualLessonPlan = typeof individualLessonPlans.$inferInsert;

/**
 * Tenants — one row per director/school group.
 * Created automatically when a director first signs in or is promoted.
 * All invited users inherit the director's tenant_id.
 * SEBA admins (role === 'admin') have tenant_id = NULL and bypass all tenant filters.
 */
export const tenants = mysqlTable("tenants", {
  id: int("id").autoincrement().primaryKey(),
  /** Human-readable school/organisation name */
  name: varchar("name", { length: 255 }).notNull(),
  /** FK to users.id — the director who owns this tenant */
  ownerUserId: int("ownerUserId"),
  /** FK to territories.id — the geographic territory this school belongs to */
  territoryId: int("territoryId"),
  /**
   * Whether this school is recognised as a Zona Escolar Rural (ZER).
   * When true, directors of this school may optionally act as head of study.
   * @migration 0052
   */
  isZer: boolean("isZer").default(false).notNull(),
  /** Minutes a teacher has to respond to cover before auto-escalation. Default 30. @migration 0055 */
  coverResponseDeadlineMinutes: int("coverResponseDeadlineMinutes").default(30).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Tenant = typeof tenants.$inferSelect;
export type InsertTenant = typeof tenants.$inferInsert;

// ─── Territorial Services ────────────────────────────────────────────────────

/**
 * territories — geographic/administrative regions managed by SEBA.
 * Each territory is overseen by one or more territorial directors.
 * Example: "Terres de l'Ebre" (Catalonia, Spain).
 */
export const territories = mysqlTable("territories", {
  id: int("id").autoincrement().primaryKey(),
  /** Official name of the territory, e.g. "Terres de l'Ebre" */
  name: varchar("name", { length: 255 }).notNull(),
  /** Optional region/province label for display */
  region: varchar("region", { length: 128 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Territory = typeof territories.$inferSelect;
export type InsertTerritory = typeof territories.$inferInsert;

/**
 * territorial_director_territories — junction table linking a
 * territorial_director user to the territories they oversee.
 * A single user may oversee more than one territory.
 * Only SEBA admins can insert/delete rows here.
 */
export const territorialDirectorTerritories = mysqlTable("territorial_director_territories", {
  id: int("id").autoincrement().primaryKey(),
  /** FK to users.id — must have role = 'territorial_director' */
  userId: int("userId").notNull(),
  /** FK to territories.id */
  territoryId: int("territoryId").notNull(),
  /** SEBA admin who granted this assignment */
  grantedByUserId: int("grantedByUserId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type TerritorialDirectorTerritory = typeof territorialDirectorTerritories.$inferSelect;
export type InsertTerritorialDirectorTerritory = typeof territorialDirectorTerritories.$inferInsert;

/**
 * role_change_audit — immutable audit trail for every role grant/revoke action.
 * Written by server-side procedures only; never modified after insert.
 * SEBA admins can read all records; no other role has access.
 */
export const roleChangeAudit = mysqlTable("role_change_audit", {
  id: int("id").autoincrement().primaryKey(),
  /** The SEBA admin who performed the action */
  actingUserId: int("actingUserId").notNull(),
  /** The user whose role was changed */
  targetUserId: int("targetUserId").notNull(),
  /** Role value before the change (null if user was newly created) */
  oldRole: varchar("oldRole", { length: 64 }),
  /** Role value after the change */
  newRole: varchar("newRole", { length: 64 }).notNull(),
  /** Optional free-text reason provided by the admin */
  reason: varchar("reason", { length: 512 }),
  /** Territory assigned/removed (for territorial_director grants) */
  territoryId: int("territoryId"),
  /** 'grant' | 'revoke' | 'assign_territory' | 'remove_territory' */
  action: varchar("action", { length: 64 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type RoleChangeAudit = typeof roleChangeAudit.$inferSelect;
export type InsertRoleChangeAudit = typeof roleChangeAudit.$inferInsert;

/**
 * director_invites — SEBA-admin-generated invite links for onboarding new school directors.
 * Each invite is pre-set with a tenantId and role=director so the director can register
 * without a manual post-registration assignment step.
 */
export const directorInvites = mysqlTable("director_invites", {
  id: int("id").autoincrement().primaryKey(),
  /** Secure random token used in the invite URL */
  token: varchar("token", { length: 128 }).notNull().unique(),
  /** The tenant (school) the new director will be assigned to */
  tenantId: int("tenantId").notNull(),
  /** Pre-filled email for the invite (optional — director can change on acceptance) */
  email: varchar("email", { length: 320 }),
  /** The SEBA admin who created the invite */
  createdByUserId: int("createdByUserId").notNull(),
  /** When the invite expires (default 7 days from creation) */
  expiresAt: timestamp("expiresAt").notNull(),
  /** Set when the invite is accepted — references the new director's user ID */
  usedByUserId: int("usedByUserId"),
  /** Timestamp when the invite was accepted */
  usedAt: timestamp("usedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type DirectorInvite = typeof directorInvites.$inferSelect;
export type InsertDirectorInvite = typeof directorInvites.$inferInsert;

/**
 * assignment_requests — pending user-to-school assignment requests submitted by
 * a Head of Study. A Director (or SEBA admin) must approve or reject each one
 * before the user is actually moved into the school.
 *
 * Workflow:
 *   1. HoS submits request  → status = 'pending'
 *   2. Director approves    → status = 'approved', user.tenantId is updated
 *      Director rejects     → status = 'rejected', optional reason stored
 */
export const assignmentRequests = mysqlTable("assignment_requests", {
  id: int("id").autoincrement().primaryKey(),
  /** The Head of Study (or admin) who submitted the request */
  requestedByUserId: int("requestedByUserId").notNull(),
  /** The unassigned user to be moved into a school */
  targetUserId: int("targetUserId").notNull(),
  /** The school (tenant) the target user should be assigned to */
  tenantId: int("tenantId").notNull(),
  /** Workflow status */
  status: mysqlEnum("status", ["pending", "approved", "rejected"]).default("pending").notNull(),
  /** Optional note from the HoS explaining the request */
  requestNote: varchar("requestNote", { length: 512 }),
  /** Optional reason from the Director when rejecting */
  rejectionReason: varchar("rejectionReason", { length: 512 }),
  /** Director or admin who reviewed the request */
  reviewedByUserId: int("reviewedByUserId"),
  /** When the request was reviewed */
  reviewedAt: timestamp("reviewedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type AssignmentRequest = typeof assignmentRequests.$inferSelect;
export type InsertAssignmentRequest = typeof assignmentRequests.$inferInsert;

/**
 * pending_teacher_submissions — new teacher accounts submitted by a Head of Study
 * for Director approval before the account is actually created.
 *
 * Workflow:
 *   1. HoS fills in name + email (+ optional note) → status = 'pending'
 *   2. Director approves → status = 'approved', a local user account is created
 *                          and a temp-password email is sent to the teacher.
 *      Director rejects  → status = 'rejected', optional reason stored.
 */
export const pendingTeacherSubmissions = mysqlTable("pending_teacher_submissions", {
  id: int("id").autoincrement().primaryKey(),
  /** The Head of Study who submitted the request */
  submittedByUserId: int("submittedByUserId").notNull(),
  /** The school (tenant) the new teacher should be added to */
  tenantId: int("tenantId").notNull(),
  /** Proposed teacher full name */
  teacherName: varchar("teacherName", { length: 255 }).notNull(),
  /** Proposed teacher email — will become their login */
  teacherEmail: varchar("teacherEmail", { length: 255 }).notNull(),
  /** Optional subject / note from the HoS */
  note: varchar("note", { length: 512 }),
  /** Workflow status */
  pts_status: mysqlEnum("pts_status", ["pending", "approved", "rejected"]).default("pending").notNull(),
  /** Optional reason from the Director when rejecting */
  rejectionReason: varchar("rejectionReason", { length: 512 }),
  /** Director or admin who reviewed the submission */
  reviewedByUserId: int("reviewedByUserId"),
  /** When the submission was reviewed */
  reviewedAt: timestamp("reviewedAt"),
  /** The user account created on approval */
  createdUserId: int("createdUserId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type PendingTeacherSubmission = typeof pendingTeacherSubmissions.$inferSelect;
export type InsertPendingTeacherSubmission = typeof pendingTeacherSubmissions.$inferInsert;

/**
 * teacher_attendance — daily check-in record per teacher per date.
 * One row per (userId, date) pair; upserted when a teacher checks in.
 */
export const teacherAttendance = mysqlTable("teacher_attendance", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  attendanceDate: date("attendanceDate").notNull(),
  status: mysqlEnum("att_status", ["present", "absent_notified", "absent_alarm"]).default("present").notNull(),
  checkInAt: timestamp("checkInAt"),
  notes: varchar("notes", { length: 512 }),
  tenantId: int("tenantId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type TeacherAttendance = typeof teacherAttendance.$inferSelect;
export type InsertTeacherAttendance = typeof teacherAttendance.$inferInsert;

/**
 * teacher_absence_notifications — advance absence requests submitted by teachers.
 */
export const teacherAbsenceNotifications = mysqlTable("teacher_absence_notifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  absenceDate: date("absenceDate").notNull(),
  reason: varchar("reason", { length: 512 }).notNull(),
  absenceStatus: mysqlEnum("absence_status", ["pending", "approved", "rejected"]).default("pending").notNull(),
  reviewedByUserId: int("reviewedByUserId"),
  reviewedAt: timestamp("reviewedAt"),
  reviewNote: varchar("reviewNote", { length: 512 }),
  tenantId: int("tenantId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type TeacherAbsenceNotification = typeof teacherAbsenceNotifications.$inferSelect;
export type InsertTeacherAbsenceNotification = typeof teacherAbsenceNotifications.$inferInsert;

/**
 * attendance_daily_comments — director/HoS notes and system alarm entries.
 */
export const attendanceDailyComments = mysqlTable("attendance_daily_comments", {
  id: int("id").autoincrement().primaryKey(),
  commentDate: date("commentDate").notNull(),
  authorId: int("authorId"),
  comment: text("comment").notNull(),
  isAlarm: boolean("isAlarm").default(false).notNull(),
  acknowledged: boolean("acknowledged").default(false).notNull(),
  tenantId: int("tenantId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type AttendanceDailyComment = typeof attendanceDailyComments.$inferSelect;
export type InsertAttendanceDailyComment = typeof attendanceDailyComments.$inferInsert;

// ─────────────────────────────────────────────────────────────────────────────
// Teacher Profile Enhancement
// ─────────────────────────────────────────────────────────────────────────────

/**
 * teacher_subjects — subjects and levels a teacher is qualified/assigned to teach.
 * Managed by director/HoS; visible to the teacher in their profile.
 */
export const teacherSubjects = mysqlTable("teacher_subjects", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  subject: varchar("subject", { length: 128 }).notNull(),
  level: varchar("level", { length: 128 }).notNull(),
  notes: varchar("notes", { length: 512 }),
  tenantId: int("tenantId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type TeacherSubject = typeof teacherSubjects.$inferSelect;
export type InsertTeacherSubject = typeof teacherSubjects.$inferInsert;

/**
 * teacher_schedule — per-semester lesson slots assigned to a teacher.
 * Each row represents one lesson slot (day + period + time) for one semester.
 * Hours are derived from (endTime - startTime) for analytics.
 */
export const teacherSchedule = mysqlTable("teacher_schedule", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  semester: mysqlEnum("semester", ["1", "2", "full_year"]).notNull(),
  academicYear: varchar("academic_year", { length: 9 }).notNull(),
  dayOfWeek: mysqlEnum("day_of_week", ["monday", "tuesday", "wednesday", "thursday", "friday"]).notNull(),
  lessonSlot: varchar("lesson_slot", { length: 64 }).notNull(),
  startTime: varchar("start_time", { length: 5 }).notNull(),
  endTime: varchar("end_time", { length: 5 }).notNull(),
  subject: varchar("subject", { length: 128 }).notNull(),
  groupName: varchar("group_name", { length: 128 }),
  tenantId: int("tenantId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type TeacherScheduleRow = typeof teacherSchedule.$inferSelect;
export type InsertTeacherScheduleRow = typeof teacherSchedule.$inferInsert;


// ─────────────────────────────────────────────────────────────────────────────
// Attendance Register & Cover Teacher System
// ─────────────────────────────────────────────────────────────────────────────

/**
 * class_register — one row per class session, recording who marked the register
 * and whether the assigned teacher was present or absent.
 *
 * When markedByTeacherId ≠ assignedTeacherId the isAbsence flag is set to true
 * and the director is notified automatically.
 */
export const classRegister = mysqlTable("class_register", {
  id: int("id").autoincrement().primaryKey(),
  /** FK → class_groups.id */
  classGroupId: int("classGroupId").notNull(),
  /** The date of the lesson (YYYY-MM-DD) */
  lessonDate: date("lessonDate").notNull(),
  /** FK → users.id — the teacher who should have taught this class */
  assignedTeacherId: int("assignedTeacherId").notNull(),
  /** FK → users.id — the teacher who actually marked the register */
  markedByTeacherId: int("markedByTeacherId").notNull(),
  /** When the register was marked */
  markedAt: timestamp("markedAt").defaultNow().notNull(),
  /** True when markedBy ≠ assigned (i.e. the assigned teacher was absent) */
  isAbsence: boolean("isAbsence").default(false).notNull(),
  /** Reason for absence — only set when isAbsence = true */
  absenceReason: mysqlEnum("absence_reason", ["absent", "sick", "holiday", "other"]),
  /** Free-text notes added by the marking teacher or director */
  notes: varchar("notes", { length: 1024 }),
  /** Tenant isolation */
  tenantId: int("tenantId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type ClassRegister = typeof classRegister.$inferSelect;
export type InsertClassRegister = typeof classRegister.$inferInsert;

/**
 * cover_assignment — records which teacher was assigned to cover an absent
 * teacher's class, as confirmed by the director.
 *
 * A payback row is a second cover_assignment where the roles are reversed:
 * the originally absent teacher covers a future session for the cover teacher.
 */
export const coverAssignment = mysqlTable("cover_assignment", {
  id: int("id").autoincrement().primaryKey(),
  /** FK → class_register.id — the absence event this cover is for */
  registerId: int("registerId").notNull(),
  /** FK → users.id — the teacher assigned to cover */
  coverTeacherId: int("coverTeacherId").notNull(),
  /** FK → users.id — the director who confirmed this cover */
  confirmedByDirectorId: int("confirmedByDirectorId"),
  /** When the director confirmed */
  confirmedAt: timestamp("confirmedAt"),
  /** Workflow status */
  status: mysqlEnum("cover_status", ["pending", "confirmed", "declined", "cancelled"]).default("pending").notNull(),
  /** Whether a payback session has been scheduled for this cover */
  paybackScheduled: boolean("paybackScheduled").default(false).notNull(),
  /** FK → cover_assignment.id — the payback assignment (self-referential) */
  paybackSessionId: int("paybackSessionId"),
  /** AI reasoning text shown to the director when suggesting this teacher */
  aiReasoning: text("aiReasoning"),
  /** When the teacher's response is due. NULL = no deadline. @migration 0055 */
  deadlineAt: timestamp("deadlineAt"),
  /** When the escalation notification was sent to the director. NULL = not escalated. @migration 0055 */
  escalationSentAt: timestamp("escalationSentAt"),
  /** When the cover was cancelled by the Director. NULL = not cancelled. @migration 0054 */
  cancelledAt: timestamp("cancelledAt"),
  /** FK → users.id — the Director who cancelled. @migration 0054 */
  cancelledByUserId: int("cancelledByUserId"),
  /** Reason given by the Director for cancelling. @migration 0054 */
  cancelReason: text("cancelReason"),
  /** Tenant isolation */
  tenantId: int("tenantId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type CoverAssignment = typeof coverAssignment.$inferSelect;
export type InsertCoverAssignment = typeof coverAssignment.$inferInsert;

/**
 * hour_adjustment — audit log of every change to a teacher's teaching contact
 * hours (extra cover hours added, payback hours deducted, etc.).
 *
 * This table never modifies the schedule directly; it is an additive ledger.
 * The net balance is computed at query time by summing adjustmentMinutes.
 */
export const hourAdjustment = mysqlTable("hour_adjustment", {
  id: int("id").autoincrement().primaryKey(),
  /** FK → users.id — the teacher whose hours are being adjusted */
  userId: int("userId").notNull(),
  /** Positive = extra hours added; negative = hours deducted (payback) */
  adjustmentMinutes: int("adjustmentMinutes").notNull(),
  /** Human-readable reason (auto-generated or director-edited) */
  reason: varchar("reason", { length: 512 }).notNull(),
  /** Type of adjustment for display and filtering */
  adjustmentType: mysqlEnum("adj_type", ["extra_cover", "payback", "manual"]).default("manual").notNull(),
  /** FK → class_register.id — the absence event that triggered this adjustment */
  relatedRegisterId: int("relatedRegisterId"),
  /** FK → cover_assignment.id — the cover assignment that triggered this */
  relatedCoverAssignmentId: int("relatedCoverAssignmentId"),
  /** FK → users.id — who created this record (director or system) */
  createdByUserId: int("createdByUserId").notNull(),
  /** Tenant isolation */
  tenantId: int("tenantId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type HourAdjustment = typeof hourAdjustment.$inferSelect;
export type InsertHourAdjustment = typeof hourAdjustment.$inferInsert;

/**
 * teacher_notification — in-app notifications sent to teachers when a cover
 * assignment is created, a payback is scheduled, or a response is required.
 *
 * requiresResponse = true means the notification has Accept / Decline buttons.
 * Once the teacher responds, response and respondedAt are set.
 */
export const teacherNotification = mysqlTable("teacher_notification", {
  id: int("id").autoincrement().primaryKey(),
  /** FK → users.id — the recipient teacher */
  userId: int("userId").notNull(),
  /** Notification category for icon/colour selection */
  type: mysqlEnum("notif_type", ["cover_request", "cover_assigned", "payback_scheduled", "register_absence", "cover_response", "general"]).default("general").notNull(),
  /** Short title shown in the notification bell */
  title: varchar("title", { length: 256 }).notNull(),
  /** Full notification body */
  body: text("body").notNull(),
  /** FK → class_register.id */
  relatedRegisterId: int("relatedRegisterId"),
  /** FK → cover_assignment.id */
  relatedCoverAssignmentId: int("relatedCoverAssignmentId"),
  /** Whether the teacher has opened/read this notification */
  isRead: boolean("isRead").default(false).notNull(),
  /** Whether this notification requires an Accept/Decline response */
  requiresResponse: boolean("requiresResponse").default(false).notNull(),
  /** Teacher's response (null until responded) */
  response: mysqlEnum("notif_response", ["accepted", "declined"]),
  /** When the teacher responded */
  respondedAt: timestamp("respondedAt"),
  /** Tenant isolation */
  tenantId: int("tenantId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type TeacherNotification = typeof teacherNotification.$inferSelect;
export type InsertTeacherNotification = typeof teacherNotification.$inferInsert;
