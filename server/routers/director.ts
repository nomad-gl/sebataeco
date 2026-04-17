/**
 * Director router — admin-only procedures for school-level oversight.
 * All procedures use adminProcedure (requires role === 'admin').
 */
import { router, adminProcedure, publicProcedure } from "../_core/trpc";
import { z } from "zod";
import { getDb } from "../db";
import {
  users,
  lessonPlans,
  practiceSessions,
  schoolCalendarEvents,
  aiBiasFlags,
  biasScanRuns,
  studentProgress,
  groupStudents,
  classGroups,
} from "../../drizzle/schema";
import { count, eq, gte, sql, desc, and, lt, inArray } from "drizzle-orm";
import { appSettings, schoolSettings } from "../../drizzle/schema";
import { notifyOwner } from "../_core/notification";
import { generateDirectorReportPdf } from "../directorReportPdf";
import { storagePut } from "../storage";

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

const ALL_COMPETENCY_CODES = LOMLOE_COMPETENCIES.map(c => c.code);

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

  /** Generate a school-wide director PDF report and return a download URL */
  generateDirectorPdf: adminProcedure
    .input(z.object({ locale: z.enum(["en", "es", "ca"]).default("en") }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      // Gather all data needed for the report
      const [statsData, staffData, complianceData, settingsRows, schoolSettingsRows, classGroupsData] = await Promise.all([
        (async () => {
          const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
          const [[totalTeachers], [totalLessonPlans], [aiGeneratedPlans], [totalPracticeSessions], [openBiasFlags], [recentScanRuns]] = await Promise.all([
            db.select({ count: count() }).from(users).where(eq(users.role, "user")),
            db.select({ count: count() }).from(lessonPlans),
            db.select({ count: count() }).from(lessonPlans).where(eq(lessonPlans.aiGenerated, true)),
            db.select({ count: count() }).from(practiceSessions),
            db.select({ count: count() }).from(aiBiasFlags).where(eq(aiBiasFlags.resolved, false)),
            db.select({ count: count() }).from(biasScanRuns).where(gte(biasScanRuns.runAt, thirtyDaysAgo)),
          ]);
          return {
            totalTeachers: totalTeachers?.count ?? 0,
            totalLessonPlans: totalLessonPlans?.count ?? 0,
            aiGeneratedPlans: aiGeneratedPlans?.count ?? 0,
            totalPracticeSessions: totalPracticeSessions?.count ?? 0,
            openBiasFlags: openBiasFlags?.count ?? 0,
            recentScanRuns: recentScanRuns?.count ?? 0,
          };
        })(),
        (async () => {
          const allTeachers = await db
            .select({ id: users.id, name: users.name, email: users.email, lastSignedIn: users.lastSignedIn })
            .from(users).where(eq(users.role, "user")).orderBy(desc(users.lastSignedIn));
          return Promise.all(allTeachers.map(async (teacher) => {
            const [[plans], [aiPlansRow]] = await Promise.all([
              db.select({ count: count() }).from(lessonPlans).where(eq(lessonPlans.userId, teacher.id)),
              db.select({ count: count() }).from(lessonPlans).where(and(eq(lessonPlans.userId, teacher.id), eq(lessonPlans.aiGenerated, true))),
            ]);
            return { name: teacher.name, email: teacher.email, lastActive: teacher.lastSignedIn, plansCreated: plans?.count ?? 0, aiPlans: aiPlansRow?.count ?? 0 };
          }));
        })(),
        (async () => {
          const allPlans = await db.select({ competencies: lessonPlans.competencies, subject: lessonPlans.subject }).from(lessonPlans);
          const totalPlans = allPlans.length;
          const competencyCounts: Record<string, number> = {};
          for (const { code } of LOMLOE_COMPETENCIES) competencyCounts[code] = 0;
          const subjectMap: Record<string, Set<string>> = {};
          for (const plan of allPlans) {
            const subject = plan.subject ?? "Unknown";
            if (!subjectMap[subject]) subjectMap[subject] = new Set();
            if (!plan.competencies) continue;
            try {
              const codes: string[] = JSON.parse(plan.competencies);
              for (const code of codes) {
                if (code in competencyCounts) competencyCounts[code]++;
                subjectMap[subject].add(code);
              }
            } catch { /* skip */ }
          }
          const competencyCoverage = LOMLOE_COMPETENCIES.map(({ code, label }) => ({
            code, label,
            count: competencyCounts[code] ?? 0,
            percentage: totalPlans > 0 ? Math.round(((competencyCounts[code] ?? 0) / totalPlans) * 100) : 0,
          }));
          const subjectCoverage = Object.entries(subjectMap).map(([subject, codes]) => ({
            subject,
            competenciesCovered: codes.size,
            competencyList: Array.from(codes),
          })).sort((a, b) => b.competenciesCovered - a.competenciesCovered);
          return { competencyCoverage, subjectCoverage };
        })(),
        db.select().from(appSettings),
        db.select().from(schoolSettings).where(eq(schoolSettings.id, 1)),
        db.select({
          id: classGroups.id,
          className: classGroups.className,
          yearGroup: classGroups.yearGroup,
          academicYear: classGroups.academicYear,
          studentCount: classGroups.studentCount,
        }).from(classGroups)
          .where(eq(classGroups.academicYear, "2025-26"))
          .orderBy(classGroups.yearGroup, classGroups.className),
      ]);

      const settings: Record<string, string> = {};
      for (const row of settingsRows) settings[row.key] = row.value;
      const schoolBranding = schoolSettingsRows[0] ?? null;

      const pdfBuffer = await generateDirectorReportPdf({
        schoolName: schoolBranding?.schoolName ?? settings.school_name ?? null,
        logoUrl: schoolBranding?.logoUrl ?? null,
        generatedAt: new Date(),
        locale: input.locale,
        stats: statsData,
        competencyCoverage: complianceData.competencyCoverage,
        staffActivity: staffData,
        subjectCoverage: complianceData.subjectCoverage,
        classGroups: classGroupsData.map((g) => ({
          className: g.className,
          yearGroup: (g.yearGroup ?? "secondary") as "junior" | "primary" | "secondary",
          academicYear: g.academicYear ?? "2025-26",
          studentCount: g.studentCount ?? 0,
        })),
      });

      const fileKey = `director-reports/seba-director-report-${Date.now()}.pdf`;
      const { url } = await storagePut(fileKey, pdfBuffer, "application/pdf");
      return { url, filename: `seba-director-report-${new Date().toISOString().slice(0, 10)}.pdf` };
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

  /** Update a user's role — sends owner notification when promoting to admin */
  updateUserRole: adminProcedure
    .input(z.object({ userId: z.string(), role: z.enum(["user", "admin"]) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      // Fetch current role before updating
      const [targetUser] = await db
        .select({ name: users.name, email: users.email, role: users.role })
        .from(users)
        .where(eq(users.id, parseInt(input.userId, 10)));

      await db.update(users).set({ role: input.role }).where(eq(users.id, parseInt(input.userId, 10)));

      // Notify owner when a user is promoted to admin
      if (input.role === "admin" && targetUser?.role !== "admin") {
        try {
          await notifyOwner({
            title: "SEBA: New Admin Promoted",
            content: `A user has been promoted to Director/Admin on SEBA.\n\nName: ${targetUser?.name ?? "Unknown"}\nEmail: ${targetUser?.email ?? "Unknown"}\nPromoted at: ${new Date().toISOString()}`,
          });
        } catch {
          // Non-fatal — role update already succeeded
        }
      }

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

  /** School-wide student progress: per-class competency heatmap for director view */
  getSchoolWideStudentProgress: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");

    // Get all class groups across all teachers
    const allGroups = await db
      .select({
        id: classGroups.id,
        className: classGroups.className,
        level: classGroups.level,
        userId: classGroups.userId,
      })
      .from(classGroups)
      .orderBy(classGroups.className);

    if (allGroups.length === 0) {
      return { groups: [], schoolAverages: ALL_COMPETENCY_CODES.map(code => ({ code, average: null })) };
    }

    const groupIds = allGroups.map(g => g.id);

    // Get all student progress records for all groups
    const allRecords = await db
      .select()
      .from(studentProgress)
      .where(inArray(studentProgress.groupId, groupIds));

    // Get student counts per group
    const studentCountRows = await db
      .select({ groupId: groupStudents.groupId, cnt: count() })
      .from(groupStudents)
      .where(inArray(groupStudents.groupId, groupIds))
      .groupBy(groupStudents.groupId);

    const studentCountMap: Record<number, number> = {};
    for (const row of studentCountRows) {
      studentCountMap[row.groupId] = row.cnt;
    }

    // Per-group competency averages
    const groupSummaries = allGroups.map(group => {
      const groupRecords = allRecords.filter(r => r.groupId === group.id);
      const totals: Record<string, { sum: number; count: number }> = {};
      for (const r of groupRecords) {
        if (!totals[r.competency]) totals[r.competency] = { sum: 0, count: 0 };
        totals[r.competency].sum += r.score;
        totals[r.competency].count += 1;
      }
      const competencyAverages = ALL_COMPETENCY_CODES.map(code => ({
        code,
        average: totals[code] ? Math.round(totals[code].sum / totals[code].count) : null,
        activityCount: totals[code]?.count ?? 0,
      }));
      const scored = competencyAverages.filter(c => c.average !== null);
      const overall = scored.length > 0
        ? Math.round(scored.reduce((s, c) => s + (c.average ?? 0), 0) / scored.length)
        : null;
      return {
        groupId: group.id,
        className: group.className,
        level: group.level,
        studentCount: studentCountMap[group.id] ?? 0,
        totalActivities: groupRecords.length,
        competencyAverages,
        overall,
      };
    });

    // School-wide averages across all groups
    const schoolTotals: Record<string, { sum: number; count: number }> = {};
    for (const r of allRecords) {
      if (!schoolTotals[r.competency]) schoolTotals[r.competency] = { sum: 0, count: 0 };
      schoolTotals[r.competency].sum += r.score;
      schoolTotals[r.competency].count += 1;
    }
    const schoolAverages = ALL_COMPETENCY_CODES.map(code => ({
      code,
      average: schoolTotals[code] ? Math.round(schoolTotals[code].sum / schoolTotals[code].count) : null,
    }));

    return { groups: groupSummaries, schoolAverages };
  }),

  // ─── School Settings (logo, name) ────────────────────────────────────────────

  /**
   * Get the school branding settings (logo, name) from the singleton school_settings row.
   */
  getSchoolBranding: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { id: 1, schoolName: null, logoUrl: null, logoKey: null, updatedAt: new Date() };
    const rows = await db.select().from(schoolSettings).where(eq(schoolSettings.id, 1));
    if (rows.length === 0) {
      await db.insert(schoolSettings).values({ id: 1 });
      return { id: 1, schoolName: null, logoUrl: null, logoKey: null, updatedAt: new Date() };
    }
    return rows[0];
  }),

  /**
   * Update school name.
   */
  updateSchoolName: adminProcedure
    .input(z.object({ schoolName: z.string().max(256) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db.update(schoolSettings)
        .set({ schoolName: input.schoolName })
        .where(eq(schoolSettings.id, 1));
      return { success: true };
    }),

  /**
   * Upload a school logo — accepts base64 data URL, stores in S3, saves URL to DB.
   */
  uploadSchoolLogo: adminProcedure
    .input(z.object({
      dataUrl: z.string(),
      mimeType: z.string().default("image/png"),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const base64 = input.dataUrl.includes(",") ? input.dataUrl.split(",")[1] : input.dataUrl;
      const buffer = Buffer.from(base64, "base64");
      const ext = input.mimeType.split("/")[1] ?? "png";
      const key = `school-logos/logo-${Date.now()}.${ext}`;
      const { url } = await storagePut(key, buffer, input.mimeType);
      await db.update(schoolSettings)
        .set({ logoUrl: url, logoKey: key })
        .where(eq(schoolSettings.id, 1));
      return { url };
    }),

  /**
   * Remove the school logo.
   */
  removeSchoolLogo: adminProcedure.mutation(async () => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    await db.update(schoolSettings)
      .set({ logoUrl: null, logoKey: null })
      .where(eq(schoolSettings.id, 1));
    return { success: true };
  }),

  /**
   * List all signed-up users with their position status.
   * Director-only: used for the staff management / member scan panel.
   */
  listUsers: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    const allUsers = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        position: users.position,
        role: users.role,
        lastSignedIn: users.lastSignedIn,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(desc(users.lastSignedIn));
    return allUsers;
  }),

  /**
   * Assign or update the position of a user.
   * Director-only.
   */
  setUserPosition: adminProcedure
    .input(z.object({
      userId: z.number(),
      position: z.enum(["unassigned", "teacher", "head_of_study", "director"]),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db.update(users)
        .set({ position: input.position })
        .where(eq(users.id, input.userId));
      return { success: true };
    }),

  /** Public: fetch the custom login background URL (null if not set) */
  getLoginBackground: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return null;
    const [row] = await db.select().from(appSettings).where(eq(appSettings.key, "login_bg_url"));
    return row?.value ?? null;
  }),

  /** Admin: upload a custom login background image to S3 and persist the URL */
  uploadLoginBackground: adminProcedure
    .input(z.object({ base64: z.string(), mimeType: z.string() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const buffer = Buffer.from(input.base64, "base64");
      const ext = input.mimeType.split("/")[1] ?? "jpg";
      const key = `login-bg/background-${Date.now()}.${ext}`;
      const { url } = await storagePut(key, buffer, input.mimeType);
      await db.insert(appSettings).values({ key: "login_bg_url", value: url })
        // @ts-ignore
        .onDuplicateKeyUpdate({ set: { value: url } });
      return { url };
    }),

  /** Admin: remove the custom login background (revert to default) */
  removeLoginBackground: adminProcedure.mutation(async () => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    await db.delete(appSettings).where(eq(appSettings.key, "login_bg_url"));
    return { success: true };
  }),
});
