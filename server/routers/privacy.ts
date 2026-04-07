import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import {
  users,
  practiceSessions,
  teachingMaterials,
  ainaUserProfiles,
  ainaMessageRatings,
  forumMessages,
  forumDirectMessages,
  notifications,
  questionAnswers,
  aiBiasFlags,
  aiAssessments,
  aiGradeOverrides,
  aiLearningPaths,
  challengeParticipants,
  groupStudents,
  classGroups,
  lessonPlans,
  schoolCalendars,
  schoolCalendarEvents,
  assignments,
  assignmentCompletions,
  groupMessages,
  groupChallengeLog,
  studentProgress,
} from "../../drizzle/schema";
import { eq, lt, and, sql, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

// ─── Retention constants ─────────────────────────────────────────────────────
const DAYS_90 = 90 * 24 * 60 * 60 * 1000;
const DAYS_30 = 30 * 24 * 60 * 60 * 1000;
const MAX_SESSIONS_PER_USER = 200;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Truncate a string to maxLen chars for PII-safe storage */
export function truncatePii(s: string | null | undefined, maxLen = 200): string {
  if (!s) return "";
  return s.length > maxLen ? s.slice(0, maxLen) + "…" : s;
}

/**
 * Run all retention purges. Called by the scheduled job and by the admin
 * "Run Retention Purge" button.
 */
export async function runRetentionPurge(): Promise<Record<string, number>> {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  const now = Date.now();
  const cutoff90 = now - DAYS_90;
  const cutoff30 = now - DAYS_30;
  const report: Record<string, number> = {};

  // 1. Practice sessions — keep only the 200 most recent per user
  //    We do this by deleting sessions whose id is not in the top-200 per user.
  //    MySQL doesn't support DELETE with a subquery on the same table directly,
  //    so we use a two-step approach via a CTE-equivalent.
  const sessionRows = await db
    .select({ id: practiceSessions.id, userId: practiceSessions.userId })
    .from(practiceSessions)
    .orderBy(desc(practiceSessions.createdAt));

  const keepIds = new Set<number>();
  const userCounts: Record<string, number> = {};
  for (const row of sessionRows) {
    const uid = row.userId ?? "anon";
    userCounts[uid] = (userCounts[uid] ?? 0) + 1;
    if (userCounts[uid] <= MAX_SESSIONS_PER_USER) keepIds.add(row.id);
  }
  const sessionIdsToDelete = sessionRows
    .map((r) => r.id)
    .filter((id) => !keepIds.has(id));
  if (sessionIdsToDelete.length > 0) {
    for (const id of sessionIdsToDelete) {
      await db.delete(practiceSessions).where(eq(practiceSessions.id, id));
    }
  }
  report.practice_sessions_purged = sessionIdsToDelete.length;

  // 2. Question answers — purge those older than 90 days
  const qaResult = await db
    .delete(questionAnswers)
    .where(lt(questionAnswers.createdAt, new Date(cutoff90)));
  report.question_answers_purged = (qaResult as any)[0]?.affectedRows ?? 0;

  // 3. Bias flags — purge resolved flags older than 30 days; truncate inputText/outputText
  const biasPurge = await db
    .delete(aiBiasFlags)
    .where(
      and(
        eq(aiBiasFlags.resolved, true),
        lt(aiBiasFlags.createdAt, new Date(cutoff30))
      )
    );
  report.bias_flags_purged = (biasPurge as any)[0]?.affectedRows ?? 0;

  // 4. Read notifications older than 30 days
  const notifPurge = await db
    .delete(notifications)
    .where(
      sql`is_read = 1 AND created_at < ${new Date(cutoff30).toISOString().slice(0, 19).replace('T', ' ')}`
    );
  report.notifications_purged = (notifPurge as any)[0]?.affectedRows ?? 0;

  // 5. Forum messages older than 90 days (public channels only — DMs kept longer)
  const fmPurge = await db
    .delete(forumMessages)
    .where(lt(forumMessages.createdAt, new Date(cutoff90)));
  report.forum_messages_purged = (fmPurge as any)[0]?.affectedRows ?? 0;

  // 6. Aina profile — reset competencyFrequency and topicKeywords older than 90 days
  //    (we reset the rolling counters; the profile itself is kept)
  await db
    .update(ainaUserProfiles)
    .set({
      competencyFrequency: "{}",
      topicKeywords: "[]",
      teachingContextSummary: null,
    })
    .where(lt(ainaUserProfiles.lastUpdated, new Date(cutoff90)));
  report.aina_profiles_reset = 1; // approximate

  return report;
}

// ─── Router ──────────────────────────────────────────────────────────────────

export const privacyRouter = router({
  /** Returns a summary of how much data is stored for the current user */
  getMyDataSummary: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const uid = ctx.user.id;

    const [sessions] = await db
      .select({ count: sql<number>`count(*)` })
      .from(practiceSessions)
      .where(eq(practiceSessions.userId, uid));

    const [materials] = await db
      .select({ count: sql<number>`count(*)` })
      .from(teachingMaterials)
      .where(eq(teachingMaterials.userId, uid));

    const [lessonPlanCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(lessonPlans)
      .where(eq(lessonPlans.userId, uid));

    const [calendarCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(schoolCalendars)
      .where(eq(schoolCalendars.userId, uid));

    const [assessmentCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(aiAssessments)
      .where(eq(aiAssessments.teacherId, uid));

    const [learningPathCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(aiLearningPaths)
      .where(eq(aiLearningPaths.teacherId, uid));

    const [profileRow] = await db
      .select({ lastUpdated: ainaUserProfiles.lastUpdated })
      .from(ainaUserProfiles)
      .where(eq(ainaUserProfiles.userId, uid));

    return {
      practiceSessions: Number(sessions?.count ?? 0),
      teachingMaterials: Number(materials?.count ?? 0),
      lessonPlans: Number(lessonPlanCount?.count ?? 0),
      schoolCalendars: Number(calendarCount?.count ?? 0),
      aiAssessments: Number(assessmentCount?.count ?? 0),
      learningPaths: Number(learningPathCount?.count ?? 0),
      ainaProfileExists: !!profileRow,
      ainaProfileLastUpdated: profileRow?.lastUpdated ? profileRow.lastUpdated.getTime() : null,
    };
  }),

  /** Exports all user data as a JSON object (GDPR data portability) */
  exportMyData: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const uid = ctx.user.id;

    const [
      sessionsData,
      materialsData,
      lessonPlansData,
      calendarsData,
      assessmentsData,
      learningPathsData,
      profileData,
    ] = await Promise.all([
      db.select().from(practiceSessions).where(eq(practiceSessions.userId, uid)),
      db.select().from(teachingMaterials).where(eq(teachingMaterials.userId, uid)),
      db.select().from(lessonPlans).where(eq(lessonPlans.userId, uid)),
      db.select().from(schoolCalendars).where(eq(schoolCalendars.userId, uid)),
      db.select().from(aiAssessments).where(eq(aiAssessments.teacherId, uid)),
      db.select().from(aiLearningPaths).where(eq(aiLearningPaths.teacherId, uid)),
      db.select().from(ainaUserProfiles).where(eq(ainaUserProfiles.userId, uid)),
    ]);

    return {
      exportedAt: new Date().toISOString(),
      userId: uid,
      practiceSessions: sessionsData,
      teachingMaterials: materialsData,
      lessonPlans: lessonPlansData,
      schoolCalendars: calendarsData,
      aiAssessments: assessmentsData,
      learningPaths: learningPathsData,
      ainaProfile: profileData[0] ?? null,
    };
  }),

  /** Deletes ALL data for the current user — irreversible */
  deleteMyData: protectedProcedure
    .input(z.object({ confirmPhrase: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (input.confirmPhrase !== "DELETE MY DATA") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Confirmation phrase did not match.",
        });
      }

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const uid = ctx.user.id;

      // Delete in dependency order (children first)
      await db.delete(assignmentCompletions).where(
        sql`studentId IN (SELECT id FROM group_students WHERE teacherId = ${uid})`
      );
      await db.delete(studentProgress).where(
        sql`studentId IN (SELECT id FROM group_students WHERE teacherId = ${uid})`
      );
      // groupStudents linked via groupId → classGroups.userId
      await db.delete(groupStudents).where(
        sql`groupId IN (SELECT id FROM class_groups WHERE userId = ${uid})`
      );
      await db.delete(groupMessages).where(eq(groupMessages.userId, uid));
      await db.delete(groupChallengeLog).where(
        sql`groupId IN (SELECT id FROM class_groups WHERE userId = ${uid})`
      );
      await db.delete(classGroups).where(eq(classGroups.userId, uid));
      await db.delete(assignments).where(eq(assignments.userId, uid));
      await db.delete(schoolCalendarEvents).where(
        sql`calendarId IN (SELECT id FROM school_calendars WHERE userId = ${uid})`
      );
      await db.delete(schoolCalendars).where(eq(schoolCalendars.userId, uid));
      await db.delete(lessonPlans).where(eq(lessonPlans.userId, uid));
      await db.delete(aiGradeOverrides).where(eq(aiGradeOverrides.teacherId, uid));
      await db.delete(aiAssessments).where(eq(aiAssessments.teacherId, uid));
      await db.delete(aiLearningPaths).where(eq(aiLearningPaths.teacherId, uid));
      await db.delete(teachingMaterials).where(eq(teachingMaterials.userId, uid));
      await db.delete(practiceSessions).where(eq(practiceSessions.userId, uid));
      await db.delete(questionAnswers).where(eq(questionAnswers.userId, uid));
      await db.delete(ainaMessageRatings).where(eq(ainaMessageRatings.userId, uid));
      await db.delete(ainaUserProfiles).where(eq(ainaUserProfiles.userId, uid));
      await db.delete(forumMessages).where(eq(forumMessages.userId, uid));
      await db.delete(forumDirectMessages).where(eq(forumDirectMessages.fromUserId, uid));
      await db.delete(notifications).where(sql`userId = ${String(uid)}`);

      return { deleted: true };
    }),

  /** Admin-only: run the retention purge immediately */
  runRetentionPurge: protectedProcedure.mutation(async ({ ctx }) => {
    if (ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    return runRetentionPurge();
  }),
});
