/**
 * Director router — admin-only procedures for school-level oversight.
 * All procedures use adminProcedure (requires role === 'admin').
 */
import { router, adminProcedure } from "../_core/trpc";
import { z } from "zod";
import { getDb } from "../db";
import {
  users,
  lessonPlans,
  practiceSessions,
  schoolCalendarEvents,
  aiBiasFlags,
  biasScanRuns,
} from "../../drizzle/schema";
import { count, eq, gte, sql, desc, and, lt } from "drizzle-orm";
import { appSettings } from "../../drizzle/schema";

/** The 8 LOMLOE key competencies */
const LOMLOE_COMPETENCIES = [
  { code: "CCL", label: "Comunicación lingüística" },
  { code: "CP", label: "Plurilingüe" },
  { code: "STEM", label: "Matemática, ciencia y tecnología" },
  { code: "CD", label: "Digital" },
  { code: "CPSAA", label: "Personal, social y aprender a aprender" },
  { code: "CC", label: "Ciudadana" },
  { code: "CE", label: "Emprendedora" },
  { code: "CCEC", label: "Conciencia y expresiones culturales" },
];

export const directorRouter = router({
  /** School-wide overview stats */
  getStats: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [
      [totalTeachers],
      [totalLessonPlans],
      [aiGeneratedPlans],
      [totalPracticeSessions],
      [totalCalendarEvents],
      [openBiasFlags],
      [recentScanRuns],
    ] = await Promise.all([
      db.select({ count: count() }).from(users).where(eq(users.role, "user")),
      db.select({ count: count() }).from(lessonPlans),
      db.select({ count: count() }).from(lessonPlans).where(eq(lessonPlans.aiGenerated, true)),
      db.select({ count: count() }).from(practiceSessions),
      db.select({ count: count() }).from(schoolCalendarEvents),
      db.select({ count: count() }).from(aiBiasFlags).where(eq(aiBiasFlags.resolved, false)),
      db.select({ count: count() }).from(biasScanRuns).where(gte(biasScanRuns.runAt, thirtyDaysAgo)),
    ]);

    // Competency coverage: count lesson plans that include each competency code
    const allPlans = await db
      .select({ competencies: lessonPlans.competencies })
      .from(lessonPlans)
      .where(sql`${lessonPlans.competencies} IS NOT NULL`);

    const competencyCounts: Record<string, number> = {};
    for (const { code } of LOMLOE_COMPETENCIES) competencyCounts[code] = 0;

    for (const plan of allPlans) {
      if (!plan.competencies) continue;
      try {
        const codes: string[] = JSON.parse(plan.competencies);
        for (const code of codes) {
          if (code in competencyCounts) competencyCounts[code]++;
        }
      } catch {
        // malformed JSON — skip
      }
    }

    const totalPlansCount = totalLessonPlans?.count ?? 0;
    const competencyCoverage = LOMLOE_COMPETENCIES.map(({ code, label }) => ({
      code,
      label,
      count: competencyCounts[code] ?? 0,
      percentage: totalPlansCount > 0
        ? Math.round(((competencyCounts[code] ?? 0) / totalPlansCount) * 100)
        : 0,
    }));

    return {
      totalTeachers: totalTeachers?.count ?? 0,
      totalLessonPlans: totalPlansCount,
      aiGeneratedPlans: aiGeneratedPlans?.count ?? 0,
      totalPracticeSessions: totalPracticeSessions?.count ?? 0,
      totalCalendarEvents: totalCalendarEvents?.count ?? 0,
      openBiasFlags: openBiasFlags?.count ?? 0,
      recentScanRuns: recentScanRuns?.count ?? 0,
      competencyCoverage,
    };
  }),

  /** Per-teacher activity breakdown */
  getStaffActivity: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");

    const allTeachers = await db
      .select({ id: users.id, name: users.name, email: users.email, createdAt: users.createdAt, lastSignedIn: users.lastSignedIn })
      .from(users)
      .where(eq(users.role, "user"))
      .orderBy(desc(users.lastSignedIn));

    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const teacherActivity = await Promise.all(
      allTeachers.map(async (teacher) => {
        const [[plans], [aiPlansRow]] = await Promise.all([
          db.select({ count: count() }).from(lessonPlans).where(eq(lessonPlans.userId, teacher.id)),
          db.select({ count: count() }).from(lessonPlans).where(and(eq(lessonPlans.userId, teacher.id), eq(lessonPlans.aiGenerated, true))),
        ]);
        return {
          id: teacher.id,
          name: teacher.name,
          email: teacher.email,
          lastActive: teacher.lastSignedIn,
          plansCreated: plans?.count ?? 0,
          aiPlans: aiPlansRow?.count ?? 0,
        };
      })
    );

    const totalPlansCreated = teacherActivity.reduce((s, t) => s + t.plansCreated, 0);
    const totalAiPlans = teacherActivity.reduce((s, t) => s + t.aiPlans, 0);
    const activeThisWeek = allTeachers.filter(t => t.lastSignedIn && t.lastSignedIn >= oneWeekAgo).length;

    return {
      totalTeachers: allTeachers.length,
      activeThisWeek,
      totalPlansCreated,
      totalAiPlans,
      teachers: teacherActivity,
    };
  }),

  /** Week-over-week trends for lesson plans and AI usage */
  getTrends: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    const weeks: { label: string; plansCreated: number; aiPlans: number }[] = [];
    for (let i = 7; i >= 0; i--) {
      const weekStart = new Date(Date.now() - (i + 1) * 7 * 24 * 60 * 60 * 1000);
      const weekEnd = new Date(Date.now() - i * 7 * 24 * 60 * 60 * 1000);
      const label = weekStart.toLocaleDateString("en-GB", { month: "short", day: "numeric" });
      const [[allRow], [aiRow]] = await Promise.all([
        db.select({ count: count() }).from(lessonPlans).where(and(gte(lessonPlans.createdAt, weekStart), lt(lessonPlans.createdAt, weekEnd))),
        db.select({ count: count() }).from(lessonPlans).where(and(gte(lessonPlans.createdAt, weekStart), lt(lessonPlans.createdAt, weekEnd), eq(lessonPlans.aiGenerated, true))),
      ]);
      weeks.push({ label, plansCreated: allRow?.count ?? 0, aiPlans: aiRow?.count ?? 0 });
    }
    return { weeks };
  }),

  /** Aggregated data for report exports */
  getReportsData: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    const [allPlans, allScans, allFlags, allTeachers] = await Promise.all([
      db.select({ id: lessonPlans.id, title: lessonPlans.title, subject: lessonPlans.subject, yearGroup: lessonPlans.yearGroup, competencies: lessonPlans.competencies, aiGenerated: lessonPlans.aiGenerated, createdAt: lessonPlans.createdAt }).from(lessonPlans).orderBy(desc(lessonPlans.createdAt)),
      db.select().from(biasScanRuns).orderBy(desc(biasScanRuns.runAt)),
      db.select().from(aiBiasFlags).orderBy(desc(aiBiasFlags.createdAt)),
      db.select({ id: users.id, name: users.name, email: users.email, role: users.role, createdAt: users.createdAt }).from(users),
    ]);
    return { allPlans, allScans, allFlags, allTeachers };
  }),

  /** Get school-wide settings */
  getSchoolSettings: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    const rows = await db.select().from(appSettings);
    const settings: Record<string, string> = {};
    for (const row of rows) settings[row.key] = row.value;
    return settings;
  }),

  /** Update a school-wide setting */
  updateSchoolSetting: adminProcedure
    .input(z.object({ key: z.string(), value: z.string() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db.insert(appSettings).values({ key: input.key, value: input.value })
        // @ts-ignore
        .onDuplicateKeyUpdate({ set: { value: input.value } });
      return { success: true };
    }),

  /** List all users for admin management */
  getUsersForAdmin: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    return db.select({ id: users.id, name: users.name, email: users.email, role: users.role, createdAt: users.createdAt, lastSignedIn: users.lastSignedIn }).from(users).orderBy(desc(users.createdAt));
  }),

  /** Update a user's role */
  updateUserRole: adminProcedure
    .input(z.object({ userId: z.string(), role: z.enum(["user", "admin"]) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db.update(users).set({ role: input.role }).where(eq(users.id, parseInt(input.userId, 10)));
      return { success: true };
    }),

  /** LOMLOE curriculum compliance — competency gap analysis across all lesson plans */
  getCurriculumCompliance: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");

    const allPlans = await db
      .select({
        id: lessonPlans.id,
        title: lessonPlans.title,
        subject: lessonPlans.subject,
        yearGroup: lessonPlans.yearGroup,
        competencies: lessonPlans.competencies,
        specificCompetences: lessonPlans.specificCompetences,
        createdAt: lessonPlans.createdAt,
      })
      .from(lessonPlans)
      .orderBy(desc(lessonPlans.createdAt));

    const totalPlans = allPlans.length;

    // Per-competency stats
    const stats: Record<string, { count: number; plans: { id: number; title: string; subject: string | null; yearGroup: string | null }[] }> = {};
    for (const { code } of LOMLOE_COMPETENCIES) stats[code] = { count: 0, plans: [] };

    for (const plan of allPlans) {
      if (!plan.competencies) continue;
      try {
        const codes: string[] = JSON.parse(plan.competencies);
        for (const code of codes) {
          if (code in stats) {
            stats[code].count++;
            if (stats[code].plans.length < 5) {
              stats[code].plans.push({ id: plan.id, title: plan.title, subject: plan.subject, yearGroup: plan.yearGroup });
            }
          }
        }
      } catch {
        // skip
      }
    }

    const competencies = LOMLOE_COMPETENCIES.map(({ code, label }) => ({
      code,
      label,
      count: stats[code].count,
      percentage: totalPlans > 0 ? Math.round((stats[code].count / totalPlans) * 100) : 0,
      recentPlans: stats[code].plans,
      gap: totalPlans > 0 && stats[code].count === 0,
    }));

    // Subject breakdown
    const subjectMap: Record<string, Set<string>> = {};
    for (const plan of allPlans) {
      const subject = plan.subject ?? "Unknown";
      if (!subjectMap[subject]) subjectMap[subject] = new Set();
      if (!plan.competencies) continue;
      try {
        const codes: string[] = JSON.parse(plan.competencies);
        for (const code of codes) subjectMap[subject].add(code);
      } catch { /* skip */ }
    }

    const subjectCoverage = Object.entries(subjectMap).map(([subject, codes]) => ({
      subject,
      competenciesCovered: codes.size,
      competencyList: Array.from(codes),
    })).sort((a, b) => b.competenciesCovered - a.competenciesCovered);

    return {
      totalPlans,
      competencies,
      subjectCoverage,
      gapCount: competencies.filter(c => c.gap).length,
    };
  }),
});
