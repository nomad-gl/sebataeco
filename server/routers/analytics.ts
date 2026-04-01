/**
 * Admin analytics router — usage metrics for the Admin dashboard.
 * All procedures are admin-only.
 */

import { TRPCError } from "@trpc/server";
import { and, count, desc, gte, sql } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import {
  users,
  teachingMaterials,
  practiceSessions,
  classChallenges,
  forumMessages,
  forumPresence,
} from "../../drizzle/schema";

/** Guard: only admins may call these procedures */
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admins only" });
  }
  return next({ ctx });
});

export const analyticsRouter = router({
  /**
   * Returns a full usage dashboard snapshot:
   * - total registered users
   * - users active in the last 7 days (seen in forum_presence or created materials)
   * - materials created per week for the last 8 weeks
   * - top 8 competencies by material count
   * - total practice sessions, challenges, and forum messages
   */
  getDashboard: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    const now = Date.now();
    const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const eightWeeksAgo = new Date(now - 8 * 7 * 24 * 60 * 60 * 1000);

    // ── Total users ──────────────────────────────────────────────────────────
    const [{ totalUsers }] = await db
      .select({ totalUsers: count() })
      .from(users);

    // ── Active users (last 7 days via forum presence) ─────────────────────
    const [{ activeUsers }] = await db
      .select({ activeUsers: count() })
      .from(forumPresence)
      .where(gte(forumPresence.lastSeen, sevenDaysAgo));

    // ── Materials per week (last 8 weeks) ────────────────────────────────
    const materialsRaw = await db
      .select({
        week: sql<string>`DATE_FORMAT(${teachingMaterials.createdAt}, '%Y-%u')`,
        weekStart: sql<string>`DATE_FORMAT(DATE_SUB(${teachingMaterials.createdAt}, INTERVAL WEEKDAY(${teachingMaterials.createdAt}) DAY), '%Y-%m-%d')`,
        total: count(),
      })
      .from(teachingMaterials)
      .where(gte(teachingMaterials.createdAt, eightWeeksAgo))
      .groupBy(
        sql`DATE_FORMAT(${teachingMaterials.createdAt}, '%Y-%u')`,
        sql`DATE_FORMAT(DATE_SUB(${teachingMaterials.createdAt}, INTERVAL WEEKDAY(${teachingMaterials.createdAt}) DAY), '%Y-%m-%d')`
      )
      .orderBy(sql`DATE_FORMAT(${teachingMaterials.createdAt}, '%Y-%u')`);

    // Fill in any missing weeks with 0
    const weeklyMaterials = buildWeeklyBuckets(materialsRaw, 8);

    // ── Top competencies by material count ───────────────────────────────
    const topCompetencies = await db
      .select({
        competency: teachingMaterials.competency,
        total: count(),
      })
      .from(teachingMaterials)
      .groupBy(teachingMaterials.competency)
      .orderBy(desc(count()))
      .limit(8);

    // ── Total practice sessions ──────────────────────────────────────────
    const [{ totalSessions }] = await db
      .select({ totalSessions: count() })
      .from(practiceSessions);

    // ── Total challenges ─────────────────────────────────────────────────
    const [{ totalChallenges }] = await db
      .select({ totalChallenges: count() })
      .from(classChallenges);

    // ── Total forum messages ─────────────────────────────────────────────
    const [{ totalForumMessages }] = await db
      .select({ totalForumMessages: count() })
      .from(forumMessages);

    // ── Total materials ──────────────────────────────────────────────────
    const [{ totalMaterials }] = await db
      .select({ totalMaterials: count() })
      .from(teachingMaterials);

    // ── Recent signups (last 7 days) ─────────────────────────────────────
    const [{ newUsers }] = await db
      .select({ newUsers: count() })
      .from(users)
      .where(gte(users.createdAt, sevenDaysAgo));

    return {
      totalUsers,
      activeUsers,
      newUsers,
      totalMaterials,
      totalSessions,
      totalChallenges,
      totalForumMessages,
      weeklyMaterials,
      topCompetencies: topCompetencies.map((r) => ({
        competency: r.competency ?? "General",
        total: r.total,
      })),
    };
  }),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildWeeklyBuckets(
  rows: Array<{ week: string; weekStart: string; total: number }>,
  count: number
): Array<{ label: string; total: number }> {
  // Build a map of weekStart → total
  const map = new Map<string, number>();
  for (const r of rows) {
    map.set(r.weekStart, r.total);
  }

  // Generate the last `count` Monday-aligned weeks
  const result: Array<{ label: string; total: number }> = [];
  const now = new Date();
  // Find the most recent Monday
  const day = now.getDay(); // 0=Sun, 1=Mon, ...
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7));
  monday.setHours(0, 0, 0, 0);

  for (let i = count - 1; i >= 0; i--) {
    const weekStart = new Date(monday);
    weekStart.setDate(monday.getDate() - i * 7);
    const key = weekStart.toISOString().slice(0, 10);
    const label = weekStart.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    result.push({ label, total: map.get(key) ?? 0 });
  }

  return result;
}
