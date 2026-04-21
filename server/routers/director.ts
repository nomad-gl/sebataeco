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
import { count, eq, gte, sql, desc, and, lt, inArray, isNotNull, isNull, gt } from "drizzle-orm";
import crypto from "crypto";
import { passwordResetTokens } from "../../drizzle/schema";
import { appSettings, schoolSettings, adminAuditLogs } from "../../drizzle/schema";
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

// ─── Invite cleanup helper ────────────────────────────────────────────────────
/**
 * Deletes teacher invite rows that:
 *   - have never been used (usedAt IS NULL), AND
 *   - expired more than INVITE_PURGE_AFTER_DAYS days ago.
 *
 * Called lazily (fire-and-forget) from listTeacherInvites and
 * getPendingInviteCount, and also on a daily schedule at server startup.
 */
const INVITE_PURGE_AFTER_DAYS = 30;

async function purgeExpiredInvites(): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const { teacherInvites } = await import("../../drizzle/schema");
  const cutoff = new Date(Date.now() - INVITE_PURGE_AFTER_DAYS * 24 * 60 * 60 * 1000);
  await db
    .delete(teacherInvites)
    .where(
      and(
        isNull(teacherInvites.usedAt),
        lt(teacherInvites.expiresAt, cutoff)
      )
    );
}

/** Schedule a daily purge run at server startup (fire-and-forget). */
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
purgeExpiredInvites().catch(() => {});
setInterval(() => purgeExpiredInvites().catch(() => {}), TWENTY_FOUR_HOURS_MS).unref();

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

  /** Update a user's role - sends owner notification when promoting to admin */
  updateUserRole: adminProcedure
    .input(z.object({
      userId: z.union([z.string(), z.number()]),
      role: z.enum(["user", "admin", "director", "head_of_study", "territorial_director", "teacher"]),
      /** Only relevant when role === 'director' */
      schoolLocation: z.string().max(64).optional().nullable(),
      schoolLanguage: z.string().max(8).optional().nullable(),
      schoolName: z.string().max(256).optional().nullable(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const numericId = typeof input.userId === "string" ? parseInt(input.userId, 10) : input.userId;
      // Prevent self-demotion from admin
      if (numericId === ctx.user.id && input.role !== "admin") {
        throw new Error("Cannot change your own role");
      }
      // Fetch current role before updating
      const [targetUser] = await db
        .select({ name: users.name, email: users.email, role: users.role, passwordHash: users.passwordHash })
        .from(users)
        .where(eq(users.id, numericId));
      if (!targetUser) throw new Error("User not found");
      const oldRole = targetUser.role;
      // Build update payload — persist location/language only when promoting to director
      type UserUpdate = Parameters<ReturnType<typeof db.update<typeof users>>['set']>[0];
      const updatePayload: UserUpdate = { role: input.role };
      if (input.role === "director") {
        if (input.schoolLocation !== undefined) (updatePayload as Record<string, unknown>).schoolLocation = input.schoolLocation ?? null;
        if (input.schoolLanguage !== undefined) (updatePayload as Record<string, unknown>).schoolLanguage = input.schoolLanguage ?? null;
        if (input.schoolName !== undefined) (updatePayload as Record<string, unknown>).schoolName = input.schoolName ?? null;
      }
      await db.update(users).set(updatePayload).where(eq(users.id, numericId));
      // Write audit log entry
      await db.insert(adminAuditLogs).values({
        userId: ctx.user.id,
        action: "update_user_role",
        resource: "user",
        resourceId: String(numericId),
        details: JSON.stringify({ targetUserId: numericId, oldRole, newRole: input.role }),
      });
      // Notify owner on significant promotions
      const notifyRoles = ["admin", "director", "territorial_director"];
      if (notifyRoles.includes(input.role) && oldRole !== input.role) {
        try {
          await notifyOwner({
            title: `SEBA: User role changed to ${input.role}`,
            content: `Role updated on SEBA.\n\nName: ${targetUser?.name ?? "Unknown"}\nEmail: ${targetUser?.email ?? "Unknown"}\nOld role: ${oldRole}\nNew role: ${input.role}\nChanged at: ${new Date().toISOString()}`,
          });
        } catch {
          // Non-fatal — role update already succeeded
        }
      }
      return { success: true, newRole: input.role };
    }),

  /**
   * SEBA admin: list ALL local accounts across all tenants.
   * Returns id, displayName, email, role, position, tenantId, lastSignedIn, deactivatedAt,
   * schoolLocation, schoolLanguage.
   */
  listAllUsersForAdmin: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    const { tenants } = await import("../../drizzle/schema");
    const rows = await db
      .select({
        id: users.id,
        displayName: users.displayName,
        email: users.email,
        role: users.role,
        position: users.position,
        tenantId: users.tenantId,
        tenantName: tenants.name,
        lastSignedIn: users.lastSignedIn,
        createdAt: users.createdAt,
        deactivatedAt: users.deactivatedAt,
        schoolLocation: users.schoolLocation,
        schoolLanguage: users.schoolLanguage,
        schoolName: users.schoolName,
      })
      .from(users)
      .leftJoin(tenants, eq(users.tenantId, tenants.id))
      .orderBy(desc(users.lastSignedIn));
    return rows;
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

  /**
   * Director: list all local (email+password) accounts.
   * Returns id, displayName, email, role, position, lastSignedIn, createdAt.
   */
  listLocalUsers: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    const rows = await db
      .select({
        id: users.id,
        displayName: users.displayName,
        email: users.email,
        role: users.role,
        position: users.position,
        lastSignedIn: users.lastSignedIn,
        createdAt: users.createdAt,
        deactivatedAt: users.deactivatedAt,
      })
      .from(users)
      .where(isNotNull(users.passwordHash))
      .orderBy(desc(users.lastSignedIn));
    return rows;
  }),

  /**
   * Director: trigger a password reset on behalf of a local user.
   * Invalidates existing tokens, creates a new one, and notifies the owner.
   */
  adminRequestReset: adminProcedure
    .input(z.object({ userId: z.number().int().positive(), origin: z.string().url() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      const [user] = await db
        .select({ id: users.id, displayName: users.displayName, email: users.email })
        .from(users)
        .where(and(eq(users.id, input.userId), isNotNull(users.passwordHash)))
        .limit(1);

      if (!user) throw new Error("User not found or not a local account");

      // Invalidate old tokens
      await db
        .update(passwordResetTokens)
        .set({ usedAt: new Date() })
        .where(eq(passwordResetTokens.userId, user.id));

      const token = crypto.randomBytes(48).toString("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await db.insert(passwordResetTokens).values({ userId: user.id, token, expiresAt });

      const resetUrl = `${input.origin}/reset-password?token=${token}&expiresAt=${expiresAt.getTime()}`;

      await notifyOwner({
        title: `Password reset issued for ${user.email ?? user.displayName ?? String(user.id)}`,
        content: `A Director has issued a password reset for user ${user.displayName ?? user.email}.\n\nReset link (expires in 1 hour):\n${resetUrl}`,
      });

      // Audit log entry for the reset
      await db.insert(adminAuditLogs).values({
        userId: user.id,
        action: "admin_password_reset",
        resource: "user",
        resourceId: String(user.id),
        details: JSON.stringify({ issuedBy: "director", email: user.email }),
      });

      return { success: true, resetUrl, expiresAt };
    }),

  /**
   * Director: deactivate a local account (prevents login, data preserved).
   */
  deactivateUser: adminProcedure
    .input(z.object({ userId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db
        .update(users)
        .set({ deactivatedAt: new Date() })
        .where(and(eq(users.id, input.userId), isNotNull(users.passwordHash)));
      await db.insert(adminAuditLogs).values({
        userId: ctx.user.id,
        action: "deactivate_user",
        resource: "user",
        resourceId: String(input.userId),
        details: JSON.stringify({ targetUserId: input.userId }),
      });
      return { success: true };
    }),

  /**
   * Director: reactivate a previously deactivated local account.
   */
  reactivateUser: adminProcedure
    .input(z.object({ userId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db
        .update(users)
        .set({ deactivatedAt: null })
        .where(and(eq(users.id, input.userId), isNotNull(users.passwordHash)));
      await db.insert(adminAuditLogs).values({
        userId: ctx.user.id,
        action: "reactivate_user",
        resource: "user",
        resourceId: String(input.userId),
        details: JSON.stringify({ targetUserId: input.userId }),
      });
      return { success: true };
    }),

  bulkDeactivateUsers: adminProcedure
    .input(z.object({ userIds: z.array(z.number()).min(1).max(100) }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const safeIds = input.userIds.filter((id) => id !== ctx.user.id);
      if (safeIds.length === 0) throw new Error("Cannot deactivate your own account");
      await db
        .update(users)
        .set({ deactivatedAt: new Date() })
        .where(and(inArray(users.id, safeIds), isNotNull(users.passwordHash)));
      for (const userId of safeIds) {
        await db.insert(adminAuditLogs).values({
          userId: ctx.user.id,
          action: "deactivate_user",
          resource: "user",
          resourceId: String(userId),
          details: JSON.stringify({ targetUserId: userId, bulk: true }),
        });
      }
      return { count: safeIds.length };
    }),

  createTeacherInvite: adminProcedure
    .input(z.object({ email: z.string().email().optional(), origin: z.string().url() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const { teacherInvites } = await import("../../drizzle/schema");
      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
      // Stamp the invite with the director's tenantId so invited teachers
      // are automatically placed in the same school group on registration.
      await db.insert(teacherInvites).values({
        token,
        email: input.email ?? null,
        createdByUserId: ctx.user.id,
        expiresAt,
        tenantId: ctx.user.tenantId ?? null,
      });
      const inviteUrl = `${input.origin}/register?invite=${token}`;
      await notifyOwner({
        title: "New Teacher Invite Generated",
        content: `A Director generated a teacher registration link${input.email ? ` for ${input.email}` : ""}. Link: ${inviteUrl} (expires ${expiresAt.toISOString()})`,
      });
      return { inviteUrl, expiresAt };
    }),

  listTeacherInvites: adminProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const { teacherInvites } = await import("../../drizzle/schema");
      // Lazy cleanup: fire-and-forget, never blocks the response
      purgeExpiredInvites().catch(() => {});
      const now = new Date();
      const rows = await db
        .select()
        .from(teacherInvites)
        .orderBy(desc(teacherInvites.createdAt));
      return rows.map((r) => ({
        id: r.id,
        token: r.token,
        email: r.email,
        createdAt: r.createdAt,
        expiresAt: r.expiresAt,
        usedAt: r.usedAt,
        status: r.usedAt ? "used" : r.expiresAt < now ? "expired" : "pending",
      }));
    }),

  /**
   * Returns the count of teacher invites that are pending:
   * not yet used and not yet expired.
   * Used by the NavBar to show a badge on the Director menu item.
   */
  getPendingInviteCount: adminProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) return { count: 0 };
      const { teacherInvites } = await import("../../drizzle/schema");
      // Lazy cleanup: fire-and-forget
      purgeExpiredInvites().catch(() => {});
      const now = new Date();
      const rows = await db
        .select({ id: teacherInvites.id })
        .from(teacherInvites)
        .where(
          and(
            isNull(teacherInvites.usedAt),
            gt(teacherInvites.expiresAt, now)
          )
        );
      return { count: rows.length };
    }),

  resendTeacherInvite: adminProcedure
    .input(z.object({ inviteId: z.number(), origin: z.string().url() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const { teacherInvites } = await import("../../drizzle/schema");
      const [existing] = await db
        .select()
        .from(teacherInvites)
        .where(eq(teacherInvites.id, input.inviteId))
        .limit(1);
      if (!existing) throw new Error("Invite not found");
      if (existing.usedAt) throw new Error("Invite already used");
      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
      await db
        .update(teacherInvites)
        .set({ token, expiresAt })
        .where(eq(teacherInvites.id, input.inviteId));
      const inviteUrl = `${input.origin}/register?invite=${token}`;
      await notifyOwner({
        title: "Teacher Invite Resent",
        content: `A Director resent a teacher registration link${existing.email ? ` for ${existing.email}` : ""}. New link: ${inviteUrl} (expires ${expiresAt.toISOString()})`,
      });
       return { inviteUrl, expiresAt };
    }),

  /**
   * Update editable profile fields for any user.
   * SEBA admin only — used from the Role Management Users card.
   * All fields are optional; only provided fields are updated.
   */
  updateUserProfile: adminProcedure
    .input(z.object({
      userId: z.number().int().positive(),
      name: z.string().min(1).max(255).optional(),
      email: z.string().email().max(255).optional(),
      position: z.string().max(128).optional().nullable(),
      schoolName: z.string().max(256).optional().nullable(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      const updates: Record<string, unknown> = {};
      if (input.name !== undefined) updates.name = input.name;
      if (input.email !== undefined) updates.email = input.email;
      if (input.position !== undefined) updates.position = input.position;
      if (input.schoolName !== undefined) updates.schoolName = input.schoolName;

      if (Object.keys(updates).length === 0) return { success: true };

      await db.update(users).set(updates as Parameters<ReturnType<typeof db.update<typeof users>>['set']>[0]).where(eq(users.id, input.userId));
      return { success: true };
    }),
});
