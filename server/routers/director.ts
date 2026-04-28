/**
 * Director router — admin-only procedures for school-level oversight.
 * All procedures use adminProcedure (requires role === 'admin').
 */
import { router, adminProcedure, publicProcedure, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
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
  attendanceRecords,
} from "../../drizzle/schema";
import { count, eq, gte, sql, desc, and, lt, inArray, isNotNull, isNull, gt, like, or, max, avg } from "drizzle-orm";
import crypto from "crypto";
import { passwordResetTokens } from "../../drizzle/schema";
import { appSettings, schoolSettings, adminAuditLogs, roleChangeAudit, pendingTeacherSubmissions, tenants } from "../../drizzle/schema";
import { notifyOwner } from "../_core/notification";
import { createNotification } from "./notifications";
import { generateDirectorReportPdf } from "../directorReportPdf";
import { storagePut } from "../storage";
import bcrypt from "bcryptjs";
import { sendTempPasswordEmail } from "../email";
import { runI18nScanAndNotify, i18nScanStatus, autoFixMissingKeys, i18nAutoFixStatus, runI18nScan } from "../i18nScan";

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
  getStats: adminProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const tid = ctx.tenantId;

    const [
      [totalTeachers],
      [totalLessonPlans],
      [aiGeneratedPlans],
      [totalPracticeSessions],
      [totalCalendarEvents],
      [openBiasFlags],
      [recentScanRuns],
    ] = await Promise.all([
      db.select({ count: count() }).from(users).where(tid != null ? and(inArray(users.role, ["user", "teacher"]), eq(users.tenantId, tid)) : inArray(users.role, ["user", "teacher"])),
      tid != null ? db.select({ count: count() }).from(lessonPlans).where(eq(lessonPlans.tenantId, tid)) : db.select({ count: count() }).from(lessonPlans),
      tid != null ? db.select({ count: count() }).from(lessonPlans).where(and(eq(lessonPlans.tenantId, tid), eq(lessonPlans.aiGenerated, true))) : db.select({ count: count() }).from(lessonPlans).where(eq(lessonPlans.aiGenerated, true)),
      db.select({ count: count() }).from(practiceSessions),
      tid != null ? db.select({ count: count() }).from(schoolCalendarEvents).where(eq(schoolCalendarEvents.tenantId, tid)) : db.select({ count: count() }).from(schoolCalendarEvents),
      db.select({ count: count() }).from(aiBiasFlags).where(eq(aiBiasFlags.resolved, false)),
      db.select({ count: count() }).from(biasScanRuns).where(gte(biasScanRuns.runAt, thirtyDaysAgo)),
    ]);

    // Competency coverage: count lesson plans that include each competency code
    const allPlans = await db
      .select({ competencies: lessonPlans.competencies })
      .from(lessonPlans)
      .where(tid != null ? and(eq(lessonPlans.tenantId, tid), sql`${lessonPlans.competencies} IS NOT NULL`) : sql`${lessonPlans.competencies} IS NOT NULL`);

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
  getStaffActivity: adminProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    const tid = ctx.tenantId;

    const allTeachers = await db
      .select({ id: users.id, name: users.name, email: users.email, createdAt: users.createdAt, lastSignedIn: users.lastSignedIn })
      .from(users)
      .where(tid != null ? and(inArray(users.role, ["user", "teacher"]), eq(users.tenantId, tid)) : inArray(users.role, ["user", "teacher"]))
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
  getTrends: adminProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    const tid = ctx.tenantId;
    const weeks: { label: string; plansCreated: number; aiPlans: number }[] = [];
    for (let i = 7; i >= 0; i--) {
      const weekStart = new Date(Date.now() - (i + 1) * 7 * 24 * 60 * 60 * 1000);
      const weekEnd = new Date(Date.now() - i * 7 * 24 * 60 * 60 * 1000);
      const label = weekStart.toLocaleDateString("en-GB", { month: "short", day: "numeric" });
      const [[allRow], [aiRow]] = await Promise.all([
        tid != null
          ? db.select({ count: count() }).from(lessonPlans).where(and(eq(lessonPlans.tenantId, tid), gte(lessonPlans.createdAt, weekStart), lt(lessonPlans.createdAt, weekEnd)))
          : db.select({ count: count() }).from(lessonPlans).where(and(gte(lessonPlans.createdAt, weekStart), lt(lessonPlans.createdAt, weekEnd))),
        tid != null
          ? db.select({ count: count() }).from(lessonPlans).where(and(eq(lessonPlans.tenantId, tid), gte(lessonPlans.createdAt, weekStart), lt(lessonPlans.createdAt, weekEnd), eq(lessonPlans.aiGenerated, true)))
          : db.select({ count: count() }).from(lessonPlans).where(and(gte(lessonPlans.createdAt, weekStart), lt(lessonPlans.createdAt, weekEnd), eq(lessonPlans.aiGenerated, true))),
      ]);
      weeks.push({ label, plansCreated: allRow?.count ?? 0, aiPlans: aiRow?.count ?? 0 });
    }
    return { weeks };
  }),

  /** Aggregated data for report exports */
  getReportsData: adminProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    const tid = ctx.tenantId;
    const [allPlans, allScans, allFlags, allTeachers] = await Promise.all([
      tid != null
        ? db.select({ id: lessonPlans.id, title: lessonPlans.title, subject: lessonPlans.subject, yearGroup: lessonPlans.yearGroup, competencies: lessonPlans.competencies, aiGenerated: lessonPlans.aiGenerated, createdAt: lessonPlans.createdAt }).from(lessonPlans).where(eq(lessonPlans.tenantId, tid)).orderBy(desc(lessonPlans.createdAt))
        : db.select({ id: lessonPlans.id, title: lessonPlans.title, subject: lessonPlans.subject, yearGroup: lessonPlans.yearGroup, competencies: lessonPlans.competencies, aiGenerated: lessonPlans.aiGenerated, createdAt: lessonPlans.createdAt }).from(lessonPlans).orderBy(desc(lessonPlans.createdAt)),
      db.select().from(biasScanRuns).orderBy(desc(biasScanRuns.runAt)),
      tid != null
        ? db.select().from(aiBiasFlags).where(eq(aiBiasFlags.tenantId, tid)).orderBy(desc(aiBiasFlags.createdAt))
        : db.select().from(aiBiasFlags).orderBy(desc(aiBiasFlags.createdAt)),
      tid != null
        ? db.select({ id: users.id, name: users.name, email: users.email, role: users.role, createdAt: users.createdAt }).from(users).where(eq(users.tenantId, tid))
        : db.select({ id: users.id, name: users.name, email: users.email, role: users.role, createdAt: users.createdAt }).from(users),
    ]);
    return { allPlans, allScans, allFlags, allTeachers };
  }),

  /** Generate a school-wide director PDF report and return a download URL */
  generateDirectorPdf: adminProcedure
    .input(z.object({
      locale: z.enum(["en", "es", "ca"]).default("en"),
      directorName: z.string().max(120).nullable().optional(),
      directorTitle: z.string().max(120).nullable().optional(),
      directorLogoUrl: z.string().nullable().optional(), // accepts data: URL or https URL
      schoolName: z.string().max(256).nullable().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const tid = ctx.tenantId;

      // Gather all data needed for the report
      const [statsData, staffData, complianceData, settingsRows, schoolSettingsRows, classGroupsData] = await Promise.all([
        (async () => {
          const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
          const [[totalTeachers], [totalLessonPlans], [aiGeneratedPlans], [totalPracticeSessions], [openBiasFlags], [recentScanRuns]] = await Promise.all([
            db.select({ count: count() }).from(users).where(tid != null ? and(inArray(users.role, ["user", "teacher"]), eq(users.tenantId, tid)) : inArray(users.role, ["user", "teacher"])),
            tid != null ? db.select({ count: count() }).from(lessonPlans).where(eq(lessonPlans.tenantId, tid)) : db.select({ count: count() }).from(lessonPlans),
            tid != null ? db.select({ count: count() }).from(lessonPlans).where(and(eq(lessonPlans.tenantId, tid), eq(lessonPlans.aiGenerated, true))) : db.select({ count: count() }).from(lessonPlans).where(eq(lessonPlans.aiGenerated, true)),
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
            .from(users)
            .where(tid != null ? and(inArray(users.role, ["user", "teacher"]), eq(users.tenantId, tid)) : inArray(users.role, ["user", "teacher"]))
            .orderBy(desc(users.lastSignedIn));
          return Promise.all(allTeachers.map(async (teacher) => {
            const [[plans], [aiPlansRow]] = await Promise.all([
              db.select({ count: count() }).from(lessonPlans).where(eq(lessonPlans.userId, teacher.id)),
              db.select({ count: count() }).from(lessonPlans).where(and(eq(lessonPlans.userId, teacher.id), eq(lessonPlans.aiGenerated, true))),
            ]);
            return { name: teacher.name, email: teacher.email, lastActive: teacher.lastSignedIn, plansCreated: plans?.count ?? 0, aiPlans: aiPlansRow?.count ?? 0 };
          }));
        })(),
        (async () => {
          const allPlans = await db
            .select({ competencies: lessonPlans.competencies, subject: lessonPlans.subject })
            .from(lessonPlans)
            .where(tid != null ? eq(lessonPlans.tenantId, tid) : undefined);
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
        (async () => {
          // Prefer tenant-scoped row; fall back to the legacy singleton (id = 1)
          if (tid != null) {
            const tenantRows = await db.select().from(schoolSettings).where(eq(schoolSettings.tenantId, tid));
            if (tenantRows.length > 0) return tenantRows;
          }
          return db.select().from(schoolSettings).where(eq(schoolSettings.id, 1));
        })(),
        db.select({
          id: classGroups.id,
          className: classGroups.className,
          yearGroup: classGroups.yearGroup,
          academicYear: classGroups.academicYear,
          studentCount: classGroups.studentCount,
        }).from(classGroups)
          .where(tid != null
            ? and(eq(classGroups.academicYear, "2025-26"), eq(classGroups.tenantId, tid))
            : eq(classGroups.academicYear, "2025-26"))
          .orderBy(classGroups.yearGroup, classGroups.className),
      ]);

      const settings: Record<string, string> = {};
      for (const row of settingsRows) settings[row.key] = row.value;
      const schoolBranding = schoolSettingsRows[0] ?? null;

      // ── Student progress heatmap data ────────────────────────────────────────
      const ALL_LOMLOE_CODES = LOMLOE_COMPETENCIES.map(c => c.code);
      let studentProgressData: {
        groups: {
          groupId: number; className: string; level: string;
          studentCount: number; totalActivities: number;
          overall: number | null;
          competencyAverages: { code: string; average: number | null }[];
        }[];
        schoolAverages: { code: string; average: number | null }[];
      } | undefined;
      if (classGroupsData.length > 0) {
        const groupIds = classGroupsData.map(g => g.id);
        const [allProgressRecords, studentCountRows] = await Promise.all([
          db.select().from(studentProgress).where(inArray(studentProgress.groupId, groupIds)),
          db.select({ groupId: groupStudents.groupId, cnt: count() })
            .from(groupStudents)
            .where(inArray(groupStudents.groupId, groupIds))
            .groupBy(groupStudents.groupId),
        ]);
        const studentCountMap: Record<number, number> = {};
        for (const row of studentCountRows) studentCountMap[row.groupId] = row.cnt;
        const groupSummaries = classGroupsData.map(group => {
          const groupRecords = allProgressRecords.filter(r => r.groupId === group.id);
          const totals: Record<string, { sum: number; count: number }> = {};
          for (const r of groupRecords) {
            if (!totals[r.competency]) totals[r.competency] = { sum: 0, count: 0 };
            totals[r.competency].sum += r.score;
            totals[r.competency].count += 1;
          }
          const competencyAverages = ALL_LOMLOE_CODES.map(code => ({
            code,
            average: totals[code] ? Math.round(totals[code].sum / totals[code].count) : null,
          }));
          const scored = competencyAverages.filter(c => c.average !== null);
          const overall = scored.length > 0
            ? Math.round(scored.reduce((s, c) => s + (c.average ?? 0), 0) / scored.length)
            : null;
          return {
            groupId: group.id,
            className: group.className,
            level: group.yearGroup ?? "",
            studentCount: studentCountMap[group.id] ?? group.studentCount ?? 0,
            totalActivities: groupRecords.length,
            overall,
            competencyAverages,
          };
        });
        const schoolTotals: Record<string, { sum: number; count: number }> = {};
        for (const r of allProgressRecords) {
          if (!schoolTotals[r.competency]) schoolTotals[r.competency] = { sum: 0, count: 0 };
          schoolTotals[r.competency].sum += r.score;
          schoolTotals[r.competency].count += 1;
        }
        const schoolAverages = ALL_LOMLOE_CODES.map(code => ({
          code,
          average: schoolTotals[code] ? Math.round(schoolTotals[code].sum / schoolTotals[code].count) : null,
        }));
        studentProgressData = { groups: groupSummaries, schoolAverages };
      }

      // ── Infantil progress data ────────────────────────────────────────────────
      const EIXOS = ["EIX1", "EIX2", "EIX3", "EIX4"] as const;
      const infantilPlans = await db
        .select({ id: lessonPlans.id, infantilEix: lessonPlans.infantilEix, infantilCycle: lessonPlans.infantilCycle, userId: lessonPlans.userId })
        .from(lessonPlans)
        .where(tid != null
          ? and(isNotNull(lessonPlans.infantilEix), eq(lessonPlans.tenantId, tid))
          : isNotNull(lessonPlans.infantilEix));
      const infantilProgressData = infantilPlans.length > 0 ? {
        totalInfantilPlans: infantilPlans.length,
        teacherCount: new Set(infantilPlans.map(p => p.userId)).size,
        eixSummary: EIXOS.map(eix => ({
          eix,
          cycle03: infantilPlans.filter(p => p.infantilEix === eix && p.infantilCycle === "0-3").length,
          cycle36: infantilPlans.filter(p => p.infantilEix === eix && p.infantilCycle === "3-6").length,
          total: infantilPlans.filter(p => p.infantilEix === eix).length,
        })),
      } : undefined;

      const pdfBuffer = await generateDirectorReportPdf({
        schoolName: input.schoolName ?? schoolBranding?.schoolName ?? settings.school_name ?? null,
        logoUrl: schoolBranding?.logoUrl ?? null,
        directorName: input.directorName ?? null,
        directorTitle: input.directorTitle ?? null,
        directorLogoUrl: input.directorLogoUrl ?? null,
        generatedAt: new Date(),
        locale: input.locale,
        stats: statsData,
        competencyCoverage: complianceData.competencyCoverage,
        staffActivity: staffData,
        subjectCoverage: complianceData.subjectCoverage,
        classGroups: classGroupsData.map((g) => ({
          className: g.className,
          yearGroup: (g.yearGroup ?? "secondary") as "infantil" | "junior" | "primary" | "secondary",
          academicYear: g.academicYear ?? "2025-26",
          studentCount: g.studentCount ?? 0,
        })),
        studentProgress: studentProgressData,
        infantilProgress: infantilProgressData,
      });

      const fileKey = `director-reports/seba-director-report-${Date.now()}.pdf`;
      const { url } = await storagePut(fileKey, pdfBuffer, "application/pdf");
      return { url, filename: `seba-director-report-${new Date().toISOString().slice(0, 10)}.pdf` };
    }),

  /** Get school-wide settings */
  getSchoolSettings: adminProcedure.query(async ({ ctx }) => {
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
  getUsersForAdmin: adminProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    const tid = ctx.tenantId;
    // Non-super-admins (directors, HoS) must never see platform-level admins (role='admin')
    // Super-admins (isSuperAdmin=true, tid=null) see all users
    const whereClause = tid != null
      ? and(eq(users.tenantId, tid), sql`${users.role} != 'admin'`)
      : undefined;
    return db.select({ id: users.id, name: users.name, email: users.email, role: users.role, createdAt: users.createdAt, lastSignedIn: users.lastSignedIn }).from(users).where(whereClause).orderBy(desc(users.createdAt));
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
      // Write to adminAuditLogs (general audit trail)
      await db.insert(adminAuditLogs).values({
        userId: ctx.user.id,
        action: "update_user_role",
        resource: "user",
        resourceId: String(numericId),
        details: JSON.stringify({ targetUserId: numericId, oldRole, newRole: input.role }),
      });
      // Also write to roleChangeAudit so the Role Change Audit Log shows this change
      await db.insert(roleChangeAudit).values({
        actingUserId: ctx.user.id,
        targetUserId: numericId,
        oldRole: oldRole ?? null,
        newRole: input.role,
        action: "grant",
        reason: `Role Management: ${oldRole ?? "none"} → ${input.role}`,
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
  listAllUsersForAdmin: adminProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    const { tenants } = await import("../../drizzle/schema");
    const rows = await db
      .select({
        id: users.id,
        name: users.name,
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
  getCurriculumCompliance: adminProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    const tid = ctx.tenantId;

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
      .where(tid != null ? eq(lessonPlans.tenantId, tid) : undefined)
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
  getSchoolWideStudentProgress: adminProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    const tid = ctx.tenantId;

    // Get all class groups (scoped to tenant if applicable)
    const allGroups = await db
      .select({
        id: classGroups.id,
        className: classGroups.className,
        level: classGroups.level,
        userId: classGroups.userId,
      })
      .from(classGroups)
      .where(tid != null ? eq(classGroups.tenantId, tid) : undefined)
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
  getSchoolBranding: adminProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return { id: 1, schoolName: null, logoUrl: null, logoKey: null, updatedAt: new Date() };
    const tid = ctx.tenantId;
    // Try tenant-scoped row first, then fall back to legacy singleton
    let rows = tid != null
      ? await db.select().from(schoolSettings).where(eq(schoolSettings.tenantId, tid))
      : [];
    if (rows.length === 0) {
      rows = await db.select().from(schoolSettings).where(eq(schoolSettings.id, 1));
    }
    if (rows.length === 0) {
      await db.insert(schoolSettings).values({ id: 1 });
      return { id: 1, schoolName: null, logoUrl: null, logoKey: null, updatedAt: new Date() };
    }
    return rows[0];
  }),

  /**
   * Get the current director's name, role/position, and school name for PDF pre-fill.
   */
  getDirectorInfo: adminProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return { name: null, position: null, schoolName: null, schoolLogoUrl: null };

    // Fetch the director's own user row
    const [dirUser] = await db
      .select({ name: users.name, displayName: users.displayName, position: users.position, schoolName: users.schoolName })
      .from(users)
      .where(eq(users.id, ctx.user.id))
      .limit(1);

    // Fetch school branding for the logo
    // ctx.tenantId is null for superadmin (role==='admin'); fall back to the user's own tenantId
    const tid = ctx.tenantId ?? ctx.user.tenantId ?? null;
    let brandingRows = tid != null
      ? await db.select({ logoUrl: schoolSettings.logoUrl, schoolName: schoolSettings.schoolName }).from(schoolSettings).where(eq(schoolSettings.tenantId, tid))
      : [];
    if (brandingRows.length === 0) {
      brandingRows = await db.select({ logoUrl: schoolSettings.logoUrl, schoolName: schoolSettings.schoolName }).from(schoolSettings).where(eq(schoolSettings.id, 1));
    }
    const branding = brandingRows[0] ?? null;

    const resolvedName = dirUser?.displayName ?? dirUser?.name ?? null;
    const resolvedSchoolName = dirUser?.schoolName ?? branding?.schoolName ?? null;
    const positionLabel = dirUser?.position === "director" ? "Director/a" :
      dirUser?.position === "head_of_study" ? "Cap d'Estudis" :
      dirUser?.position === "teacher" ? "Mestre/a" : null;

    return {
      name: resolvedName,
      position: positionLabel,
      schoolName: resolvedSchoolName,
      schoolLogoUrl: branding?.logoUrl ?? null,
    };
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
  listUsers: adminProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    const tid = ctx.tenantId;
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
      // Non-super-admins (directors, HoS) must never see platform-level admins (role='admin')
      .where(tid != null ? and(eq(users.tenantId, tid), sql`${users.role} != 'admin'`) : undefined)
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
  listLocalUsers: adminProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    const tid = ctx.tenantId;
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
        isPermanent: users.isPermanent,
      })
      .from(users)
      .where(tid != null ? and(isNotNull(users.passwordHash), eq(users.tenantId, tid)) : isNotNull(users.passwordHash))
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
    .input(z.object({
      userId: z.number().int().positive(),
      reason: z.string().max(512).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db
        .update(users)
        .set({ deactivatedAt: new Date(), deactivationReason: input.reason ?? null })
        .where(and(eq(users.id, input.userId), isNotNull(users.passwordHash)));
      await db.insert(adminAuditLogs).values({
        userId: ctx.user.id,
        action: "deactivate_user",
        resource: "user",
        resourceId: String(input.userId),
        details: JSON.stringify({ targetUserId: input.userId, reason: input.reason ?? null }),
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
    .input(z.object({
      userIds: z.array(z.number()).min(1).max(100),
      reason: z.string().max(512).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const safeIds = input.userIds.filter((id) => id !== ctx.user.id);
      if (safeIds.length === 0) throw new Error("Cannot deactivate your own account");
      await db
        .update(users)
        .set({ deactivatedAt: new Date(), deactivationReason: input.reason ?? null })
        .where(and(inArray(users.id, safeIds), isNotNull(users.passwordHash)));
      for (const userId of safeIds) {
        await db.insert(adminAuditLogs).values({
          userId: ctx.user.id,
          action: "deactivate_user",
          resource: "user",
          resourceId: String(userId),
          details: JSON.stringify({ targetUserId: userId, bulk: true, reason: input.reason ?? null }),
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

  /**
   * Create a local (email+password) account for a teacher or user directly,
   * bypassing the invite-link flow. Generates a secure temporary password,
   * sets mustChangePassword=true, and emails the credentials to the user.
   * Admin only.
   */
  createLocalUserWithTempPassword: adminProcedure
    .input(z.object({
      name: z.string().min(1).max(255),
      email: z.string().email().max(320),
      role: z.enum(["user", "teacher", "head_of_study", "director"]).default("teacher"),
      tenantId: z.number().int().positive().optional(),
      schoolName: z.string().max(256).optional().nullable(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      // Guard: email must be unique
      const [existing] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, input.email.toLowerCase().trim()))
        .limit(1);
      if (existing) throw new Error("An account with this email already exists.");

      // Resolve school name from tenant if not provided
      let resolvedSchoolName = input.schoolName ?? null;
      if (!resolvedSchoolName && input.tenantId) {
        const { tenants } = await import("../../drizzle/schema");
        const [tenant] = await db
          .select({ name: tenants.name })
          .from(tenants)
          .where(eq(tenants.id, input.tenantId))
          .limit(1);
        resolvedSchoolName = tenant?.name ?? null;
      }

      const tempPassword = crypto.randomBytes(9).toString("base64url");
      const passwordHash = await bcrypt.hash(tempPassword, 12);
      const openId = `local:${input.email.toLowerCase().trim()}`;

      const positionMap: Record<string, string> = {
        teacher: "teacher",
        head_of_study: "head_of_study",
        director: "director",
        user: "unassigned",
      };

      const [insertResult] = await db.insert(users).values({
        name: input.name,
        displayName: input.name,
        email: input.email.toLowerCase().trim(),
        openId,
        passwordHash,
        loginMethod: "local",
        role: input.role,
        position: (positionMap[input.role] ?? "unassigned") as any,
        tenantId: input.tenantId ?? null,
        schoolName: resolvedSchoolName,
        mustChangePassword: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      } as any);
      const userId = (insertResult as any).insertId as number;

      // Log the creation
      await db.insert(adminAuditLogs).values({
        userId: ctx.user.id,
        action: "create_local_user",
        resource: "user",
        resourceId: String(userId),
        details: JSON.stringify({ name: input.name, email: input.email, role: input.role, tenantId: input.tenantId ?? null }),
      });

      // Fire-and-forget: email the temporary credentials
      void sendTempPasswordEmail({
        to: input.email,
        name: input.name,
        tempPassword,
        schoolName: resolvedSchoolName,
        loginUrl: "https://aina.forum/login",
        role: input.role,
      });

      return { success: true, userId, tempPassword };
    }),

  /**
   * List all local-account users with their password status for the admin
   * Password Management card. Never returns the actual hash.
   */
  listUsersPasswordStatus: adminProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const rows = await db
        .select({
          id: users.id,
          name: users.name,
          displayName: users.displayName,
          email: users.email,
          role: users.role,
          hasPassword: sql<number>`CASE WHEN ${users.passwordHash} IS NOT NULL THEN 1 ELSE 0 END`,
          mustChangePassword: users.mustChangePassword,
          lastSignedIn: users.lastSignedIn,
          deactivatedAt: users.deactivatedAt,
          schoolName: users.schoolName,
        })
        .from(users)
        .orderBy(desc(users.lastSignedIn));
      return rows.map(r => ({
        ...r,
        hasPassword: r.hasPassword === 1,
      }));
    }),

  /**
   * Admin: reset a user's password to a new temporary password,
   * set mustChangePassword=true, and email the user their new credentials.
   */
  adminResetUserPassword: adminProcedure
    .input(z.object({ userId: z.number(), customPassword: z.string().min(6).max(128).optional() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const [targetUser] = await db
        .select({ id: users.id, name: users.name, displayName: users.displayName, email: users.email, role: users.role, tenantId: users.tenantId })
        .from(users)
        .where(eq(users.id, input.userId))
        .limit(1);
      if (!targetUser) throw new Error("User not found");
      if (!targetUser.email) throw new Error("User has no email address");
      // Use custom password if provided, otherwise generate a 12-char temp password
      const tempPassword = input.customPassword ?? crypto.randomBytes(9).toString("base64url").slice(0, 12);
      const hash = await bcrypt.hash(tempPassword, 12);
      await db.update(users).set({ passwordHash: hash, mustChangePassword: true }).where(eq(users.id, input.userId));
      // Audit log
      await db.insert(adminAuditLogs).values({
        userId: ctx.user.id,
        action: "admin_password_reset",
        resource: "user",
        resourceId: String(input.userId),
        details: JSON.stringify({ targetUserId: input.userId, email: targetUser.email }),
      });
      // Email the new temp password
      void sendTempPasswordEmail({
        to: targetUser.email,
        name: targetUser.name ?? targetUser.displayName ?? targetUser.email,
        tempPassword,
        schoolName: null,
        loginUrl: "https://aina.forum/login",
        role: targetUser.role ?? "user",
      });
      return { success: true, tempPassword, email: targetUser.email };
    }),

  // ─── Pending Teacher Submissions (Director approval) ──────────────────────────

  /**
   * List all pending teacher submissions for the Director's school.
   * Admins see all submissions across all schools.
   */
  listPendingTeacherSubmissions: adminProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    const submittedBy = users;
    const rows = await db
      .select({
        id: pendingTeacherSubmissions.id,
        teacherName: pendingTeacherSubmissions.teacherName,
        teacherEmail: pendingTeacherSubmissions.teacherEmail,
        note: pendingTeacherSubmissions.note,
        pts_status: pendingTeacherSubmissions.pts_status,
        rejectionReason: pendingTeacherSubmissions.rejectionReason,
        reviewedAt: pendingTeacherSubmissions.reviewedAt,
        createdAt: pendingTeacherSubmissions.createdAt,
        tenantId: pendingTeacherSubmissions.tenantId,
        submittedByUserId: pendingTeacherSubmissions.submittedByUserId,
        submittedByName: submittedBy.name,
        submittedByEmail: submittedBy.email,
      })
      .from(pendingTeacherSubmissions)
      .leftJoin(submittedBy, eq(pendingTeacherSubmissions.submittedByUserId, submittedBy.id))
      .orderBy(pendingTeacherSubmissions.createdAt);
    return rows;
  }),

  /**
   * Approve a pending teacher submission.
   * Creates a local user account with a temp password, assigns to the school,
   * sets role=teacher, and emails the new teacher their credentials.
   */
  approvePendingTeacher: adminProcedure
    .input(z.object({ submissionId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const [submission] = await db
        .select()
        .from(pendingTeacherSubmissions)
        .where(eq(pendingTeacherSubmissions.id, input.submissionId))
        .limit(1);
      if (!submission) throw new Error("Submission not found.");
      if (submission.pts_status !== "pending") throw new Error("Submission is no longer pending.");

      // Check email not already taken
      const [existingUser] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, submission.teacherEmail))
        .limit(1);
      if (existingUser) throw new Error("A user with this email already exists.");

      // Get school name for the email
      const [tenant] = await db
        .select({ name: tenants.name })
        .from(tenants)
        .where(eq(tenants.id, submission.tenantId))
        .limit(1);

      // Generate temp password
      const tempPassword = crypto.randomBytes(8).toString("base64url").slice(0, 12);
      const passwordHash = await bcrypt.hash(tempPassword, 10);

      // Create user account
      const [insertResult] = await db.insert(users).values({
        openId: `local_${crypto.randomUUID()}`,
        name: submission.teacherName,
        email: submission.teacherEmail,
        loginMethod: "local",
        role: "teacher",
        position: "teacher",
        tenantId: submission.tenantId,
        schoolName: tenant?.name ?? null,
        passwordHash,
        mustChangePassword: true,
        displayName: submission.teacherName,
      });
      const newUserId = (insertResult as unknown as { insertId: number }).insertId;

      // Mark submission as approved
      await db
        .update(pendingTeacherSubmissions)
        .set({
          pts_status: "approved",
          reviewedByUserId: ctx.user.id,
          reviewedAt: new Date(),
          createdUserId: newUserId,
        })
        .where(eq(pendingTeacherSubmissions.id, input.submissionId));

      // Send temp password email
      void sendTempPasswordEmail({
        to: submission.teacherEmail,
        name: submission.teacherName,
        tempPassword,
        schoolName: tenant?.name ?? null,
        loginUrl: "https://aina.forum/login",
        role: "teacher",
      });

      // Audit log
      await db.insert(adminAuditLogs).values({
        userId: ctx.user.id,
        action: "approve_teacher_submission",
        resource: "pending_teacher_submissions",
        resourceId: String(input.submissionId),
        details: JSON.stringify({ teacherEmail: submission.teacherEmail, newUserId }),
      });

      // Notify the Head of Study who submitted this request
      void createNotification({
        userId: String(submission.submittedByUserId),
        type: "teacher_submission_approved",
        title: "Teacher submission approved",
        body: `Your submission for ${submission.teacherName} (${submission.teacherEmail}) has been approved. Their account has been created and credentials emailed.`,
        link: "/head-of-study/add-teacher",
      });

      return { success: true, tempPassword, teacherEmail: submission.teacherEmail, newUserId };
    }),

  /**
   * Reject a pending teacher submission with an optional reason.
   */
  rejectPendingTeacher: adminProcedure
    .input(z.object({
      submissionId: z.number().int().positive(),
      reason: z.string().max(512).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const [submission] = await db
        .select({ id: pendingTeacherSubmissions.id, pts_status: pendingTeacherSubmissions.pts_status })
        .from(pendingTeacherSubmissions)
        .where(eq(pendingTeacherSubmissions.id, input.submissionId))
        .limit(1);
      if (!submission) throw new Error("Submission not found.");
      if (submission.pts_status !== "pending") throw new Error("Submission is no longer pending.");

      await db
        .update(pendingTeacherSubmissions)
        .set({
          pts_status: "rejected",
          rejectionReason: input.reason ?? null,
          reviewedByUserId: ctx.user.id,
          reviewedAt: new Date(),
        })
        .where(eq(pendingTeacherSubmissions.id, input.submissionId));

      await db.insert(adminAuditLogs).values({
        userId: ctx.user.id,
        action: "reject_teacher_submission",
        resource: "pending_teacher_submissions",
        resourceId: String(input.submissionId),
        details: JSON.stringify({ reason: input.reason }),
      });

      // Notify the Head of Study who submitted this request
      // Re-fetch submission to get submittedByUserId and teacherName
      const [fullSub] = await db
        .select({ submittedByUserId: pendingTeacherSubmissions.submittedByUserId, teacherName: pendingTeacherSubmissions.teacherName, teacherEmail: pendingTeacherSubmissions.teacherEmail })
        .from(pendingTeacherSubmissions)
        .where(eq(pendingTeacherSubmissions.id, input.submissionId))
        .limit(1);
      if (fullSub) {
        void createNotification({
          userId: String(fullSub.submittedByUserId),
          type: "teacher_submission_rejected",
          title: "Teacher submission rejected",
          body: `Your submission for ${fullSub.teacherName} (${fullSub.teacherEmail}) was rejected.${
            input.reason ? ` Reason: ${input.reason}` : ""
          }`,
          link: "/head-of-study/add-teacher",
        });
      }

      return { success: true };
    }),

  /**
   * Count pending teacher submissions for the badge on the Approvals nav item.
   */
  pendingTeacherSubmissionsCount: adminProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) return { count: 0 };
      const [row] = await db
        .select({ count: count() })
        .from(pendingTeacherSubmissions)
        .where(eq(pendingTeacherSubmissions.pts_status, "pending"));
      return { count: row?.count ?? 0 };
    }),

  editPendingTeacher: adminProcedure
    .input(z.object({
      submissionId: z.number().int().positive(),
      teacherName: z.string().min(1).max(255),
      teacherEmail: z.string().email().max(255),
      note: z.string().max(512).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const [existing] = await db
        .select({ id: pendingTeacherSubmissions.id, status: pendingTeacherSubmissions.pts_status })
        .from(pendingTeacherSubmissions)
        .where(eq(pendingTeacherSubmissions.id, input.submissionId))
        .limit(1);
      if (!existing) throw new Error("Submission not found.");
      if (existing.status !== "pending") throw new Error("Only pending submissions can be edited.");
      await db
        .update(pendingTeacherSubmissions)
        .set({
          teacherName: input.teacherName.trim(),
          teacherEmail: input.teacherEmail.toLowerCase().trim(),
          note: input.note ?? null,
        })
        .where(eq(pendingTeacherSubmissions.id, input.submissionId));
      return { success: true };
    }),

  /**
   * Trigger an on-demand i18n hardcoded string scan and return the result.
   * Admin-only. Also sends an owner notification if issues are found.
   */
  triggerI18nScan: adminProcedure.mutation(async () => {
    await runI18nScanAndNotify();
    return i18nScanStatus.lastResult ?? { summary: "No result yet", scannedFiles: 0, hardcodedStrings: [], missingKeys: [], unusedKeys: [], ranAt: new Date() };
  }),

  /**
   * Return the status of the last i18n scan without triggering a new one.
   */
  getI18nScanStatus: adminProcedure.query(() => {
    return {
      lastRunAt: i18nScanStatus.lastRunAt,
      lastError: i18nScanStatus.lastError,
      lastResult: i18nScanStatus.lastResult,
      autoFix: {
        running: i18nAutoFixStatus.running,
        lastResult: i18nAutoFixStatus.lastResult,
        lastError: i18nAutoFixStatus.lastError,
      },
    };
  }),

  /**
   * Auto-fix missing translation keys: translate them via LLM and patch
   * I18nContext.tsx. Optionally accepts a list of specific keys to fix;
   * if omitted, uses the missing keys from the last scan result.
   */
  autoFixI18nKeys: adminProcedure
    .input(
      z.object({
        keys: z.array(z.string()).optional(),
      }).optional()
    )
    .mutation(async ({ input }) => {
      if (i18nAutoFixStatus.running) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Auto-fix is already running. Please wait.",
        });
      }

      // Determine which keys to fix
      let missingKeys: string[] = input?.keys ?? [];
      if (missingKeys.length === 0) {
        // Use keys from last scan, or run a fresh scan first
        if (!i18nScanStatus.lastResult) {
          const scanResult = await runI18nScan();
          i18nScanStatus.lastResult = scanResult;
          i18nScanStatus.lastRunAt = new Date();
        }
        missingKeys = i18nScanStatus.lastResult?.missingKeys ?? [];
      }

      if (missingKeys.length === 0) {
        return { fixedKeys: 0, keys: [], errors: [], ranAt: new Date() };
      }

      i18nAutoFixStatus.running = true;
      i18nAutoFixStatus.lastError = null;

      try {
        const fixResult = await autoFixMissingKeys(missingKeys);
        i18nAutoFixStatus.lastResult = fixResult;

        // Re-run scan so the UI reflects the updated state
        const freshScan = await runI18nScan();
        i18nScanStatus.lastResult = freshScan;
        i18nScanStatus.lastRunAt = new Date();

        return fixResult;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        i18nAutoFixStatus.lastError = msg;
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: msg });
      } finally {
        i18nAutoFixStatus.running = false;
      }
    }),

  /**
   * Resend welcome email with a fresh temp password to a newly approved teacher.
   * Used from the approval shortcut banner in DirectorApprovals.
   */
  sendWelcomeEmail: adminProcedure
    .input(z.object({ userId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const [targetUser] = await db
        .select({ id: users.id, name: users.name, displayName: users.displayName, email: users.email, role: users.role, tenantId: users.tenantId, schoolName: users.schoolName })
        .from(users)
        .where(eq(users.id, input.userId))
        .limit(1);
      if (!targetUser) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      if (!targetUser.email) throw new TRPCError({ code: "BAD_REQUEST", message: "User has no email address" });

      // Generate a fresh temp password and reset mustChangePassword
      const tempPassword = crypto.randomBytes(9).toString("base64url").slice(0, 12);
      const hash = await bcrypt.hash(tempPassword, 12);
      await db.update(users).set({ passwordHash: hash, mustChangePassword: true }).where(eq(users.id, input.userId));

      // Audit log
      await db.insert(adminAuditLogs).values({
        userId: ctx.user.id,
        action: "send_welcome_email",
        resource: "user",
        resourceId: String(input.userId),
        details: JSON.stringify({ targetUserId: input.userId, email: targetUser.email }),
      });

      // Send the welcome email with credentials
      await sendTempPasswordEmail({
        to: targetUser.email,
        name: targetUser.name ?? targetUser.displayName ?? targetUser.email,
        tempPassword,
        schoolName: targetUser.schoolName ?? null,
        loginUrl: "https://aina.forum/login",
        role: targetUser.role ?? "teacher",
      });

      return { success: true, email: targetUser.email };
    }),

  // ─── ZER (Zona Escolar Rural) dual-role procedures ──────────────────────────

  /**
   * getZerStatus — returns the ZER configuration for the current user's tenant.
   * Available to any authenticated user so the frontend can react accordingly.
   */
  getZerStatus: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    if (!ctx.user.tenantId) return { isZer: false, zerActsAsHos: false };
    const [tenant] = await db
      .select({ isZer: tenants.isZer })
      .from(tenants)
      .where(eq(tenants.id, ctx.user.tenantId))
      .limit(1);
    return {
      isZer: tenant?.isZer ?? false,
      zerActsAsHos: ctx.user.zerActsAsHos ?? false,
    };
  }),

  /**
   * setZerStatus — admin or director can mark their school as a ZER school.
   * Directors can only update their own tenant; admins can target any tenant.
   */
  setZerStatus: protectedProcedure
    .input(z.object({ isZer: z.boolean(), tenantId: z.number().optional() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const isAdmin = ctx.user.role === "admin";
      const isDirector = ctx.user.role === "director";
      if (!isAdmin && !isDirector) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only admins or directors can set ZER status" });
      }
      // Directors can only update their own tenant
      const targetTenantId = isAdmin && input.tenantId ? input.tenantId : ctx.user.tenantId;
      if (!targetTenantId) throw new TRPCError({ code: "BAD_REQUEST", message: "No tenant associated" });
      await db.update(tenants).set({ isZer: input.isZer }).where(eq(tenants.id, targetTenantId));
      // If ZER is being disabled, also clear zerActsAsHos for all directors in this tenant
      if (!input.isZer) {
        await db
          .update(users)
          .set({ zerActsAsHos: false })
          .where(and(eq(users.tenantId, targetTenantId), eq(users.role, "director")));
      }
      return { success: true, isZer: input.isZer };
    }),

  /**
   * setZerActsAsHos — director opts in/out of acting as head of study.
   * Only available when the school is a ZER school.
   */
  setZerActsAsHos: protectedProcedure
    .input(z.object({ zerActsAsHos: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      if (ctx.user.role !== "director" && ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only directors can toggle ZER HoS role" });
      }
      if (!ctx.user.tenantId) throw new TRPCError({ code: "BAD_REQUEST", message: "No tenant associated" });
      // Verify the school is actually a ZER school before allowing opt-in
      if (input.zerActsAsHos) {
        const [tenant] = await db
          .select({ isZer: tenants.isZer })
          .from(tenants)
          .where(eq(tenants.id, ctx.user.tenantId))
          .limit(1);
        if (!tenant?.isZer) {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "School is not registered as a ZER school" });
        }
      }
      await db
        .update(users)
        .set({ zerActsAsHos: input.zerActsAsHos })
        .where(eq(users.id, ctx.user.id));
      return { success: true, zerActsAsHos: input.zerActsAsHos };
    }),

  // ─── Infantil Progress (Follow-up 2) ─────────────────────────────────────────

  /**
   * Returns lesson plan counts per Eix de Desenvolupament (EIX1–EIX4) for both
   * Infantil cycles, grouped by class group. Used by the Director Student Progress
   * page to show an Infantil-specific progress view anchored to Decree 21/2023.
   */
  getInfantilProgress: adminProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");

    const EIXOS = ["EIX1", "EIX2", "EIX3", "EIX4"] as const;
    const CYCLES = ["0-3", "3-6"] as const;

    // Fetch all lesson plans that have an infantilEix set
    const infantilPlans = await db
      .select({
        id: lessonPlans.id,
        infantilEix: lessonPlans.infantilEix,
        infantilCycle: lessonPlans.infantilCycle,
        yearGroup: lessonPlans.yearGroup,
        userId: lessonPlans.userId,
        calendarEventId: lessonPlans.calendarEventId,
      })
      .from(lessonPlans)
      .where(isNotNull(lessonPlans.infantilEix));

    // Aggregate by eix + cycle
    const totals: Record<string, Record<string, number>> = {};
    for (const plan of infantilPlans) {
      const eix = plan.infantilEix ?? "unknown";
      const cycle = plan.infantilCycle ?? "unknown";
      const key = `${eix}::${cycle}`;
      totals[key] = (totals[key] ?? 0) as any;
      (totals[key] as any) = ((totals[key] as any) || 0) + 1;
    }

    // Build structured summary
    const eixSummary = EIXOS.map(eix => ({
      eix,
      cycle03: (infantilPlans.filter(p => p.infantilEix === eix && p.infantilCycle === "0-3").length),
      cycle36: (infantilPlans.filter(p => p.infantilEix === eix && p.infantilCycle === "3-6").length),
      total: infantilPlans.filter(p => p.infantilEix === eix).length,
    }));

    const totalInfantilPlans = infantilPlans.length;
    const teacherCount = new Set(infantilPlans.map(p => p.userId)).size;

    return { eixSummary, totalInfantilPlans, teacherCount };
  }),

  /**
   * Director: permanently delete a local user and all their credentials.
   * Safety guards:
   *  - Cannot delete yourself
   *  - Cannot delete the platform owner (openId matches OWNER_OPEN_ID)
   *  - Cannot delete users from a different tenant
   *  - Cannot delete users without a local password (OAuth-only accounts)
   */
  deleteLocalUser: adminProcedure
    .input(z.object({
      userId: z.number().int().positive(),
      reason: z.string().max(512).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const [target] = await db
        .select({
          id: users.id,
          openId: users.openId,
          email: users.email,
          displayName: users.displayName,
          tenantId: users.tenantId,
          passwordHash: users.passwordHash,
        })
        .from(users)
        .where(eq(users.id, input.userId))
        .limit(1);

      if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });

      // Guard: cannot delete yourself
      if (target.id === ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You cannot delete your own account" });
      }

      // Guard: cannot delete the platform owner
      const ownerOpenId = process.env.OWNER_OPEN_ID;
      if (ownerOpenId && target.openId === ownerOpenId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "The platform owner account cannot be deleted" });
      }

      // Guard: must be a local account (has a password)
      if (!target.passwordHash) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Only local (email/password) accounts can be deleted here" });
      }

      // Guard: must be in the same tenant
      if (target.tenantId !== ctx.user.tenantId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You can only delete users in your own school" });
      }

      // 1. Invalidate all password reset tokens
      await db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, target.id));

      // 2. Delete ALL teacher invite history rows for this email (user is gone, no need to keep history)
      if (target.email) {
        const { teacherInvites } = await import("../../drizzle/schema");
        await db.delete(teacherInvites).where(eq(teacherInvites.email, target.email));
      }

      // 3. Log the deletion for audit trail before removing the row
      await db.insert(adminAuditLogs).values({
        userId: ctx.user.id,
        action: "delete_local_user",
        resource: "user",
        resourceId: String(target.id),
        details: JSON.stringify({
          deletedEmail: target.email,
          deletedDisplayName: target.displayName,
          deletedOpenId: target.openId,
          deletedAt: new Date().toISOString(),
          reason: input.reason ?? null,
        }),
      });

      // 4. Delete the user row (DB-level cascades handle child rows where configured)
      await db.delete(users).where(eq(users.id, target.id));

      return { success: true, deletedEmail: target.email, deletedName: target.displayName };
    }),

  /**
   * Director: bulk password reset — generates a reset link for each selected user.
   * Returns an array of { userId, email, displayName, resetUrl, expiresAt }.
   */
  bulkResetPasswords: adminProcedure
    .input(z.object({
      userIds: z.array(z.number().int().positive()).min(1).max(200),
      origin: z.string().url(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const results: Array<{
        userId: number;
        email: string | null;
        displayName: string | null;
        resetUrl: string;
        expiresAt: Date;
      }> = [];
      for (const userId of input.userIds) {
        const [user] = await db
          .select({ id: users.id, displayName: users.displayName, email: users.email })
          .from(users)
          .where(and(eq(users.id, userId), isNotNull(users.passwordHash)))
          .limit(1);
        if (!user) continue; // skip OAuth-only accounts
        // Invalidate old tokens
        await db
          .update(passwordResetTokens)
          .set({ usedAt: new Date() })
          .where(eq(passwordResetTokens.userId, user.id));
        const token = crypto.randomBytes(48).toString("hex");
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
        await db.insert(passwordResetTokens).values({ userId: user.id, token, expiresAt });
        const resetUrl = `${input.origin}/reset-password?token=${token}&expiresAt=${expiresAt.getTime()}`;
        await db.insert(adminAuditLogs).values({
          userId: ctx.user.id,
          action: "admin_password_reset",
          resource: "user",
          resourceId: String(user.id),
          details: JSON.stringify({ issuedBy: "director", email: user.email, bulk: true }),
        });
        results.push({ userId: user.id, email: user.email, displayName: user.displayName, resetUrl, expiresAt });
      }
      return { success: true, results };
    }),

  /**
   * Director: delete a single teacher invite row from the invite history.
   */
  deleteTeacherInvite: adminProcedure
    .input(z.object({ inviteId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const { teacherInvites } = await import("../../drizzle/schema");
      const [invite] = await db
        .select({ id: teacherInvites.id, email: teacherInvites.email, tenantId: teacherInvites.tenantId })
        .from(teacherInvites)
        .where(eq(teacherInvites.id, input.inviteId))
        .limit(1);
      if (!invite) throw new Error("Invite not found");
      // Tenant guard — director can only delete invites from their own school
      if (invite.tenantId !== ctx.user.tenantId) throw new Error("Forbidden");
      await db.delete(teacherInvites).where(eq(teacherInvites.id, input.inviteId));
      await db.insert(adminAuditLogs).values({
        userId: ctx.user.id,
        action: "delete_teacher_invite",
        resource: "teacher_invite",
        resourceId: String(input.inviteId),
        details: JSON.stringify({ deletedEmail: invite.email }),
      });
      return { success: true, deletedEmail: invite.email };
    }),

  // ─── Student Directory ────────────────────────────────────────────────────────

  /**
   * List all students across all class groups for this tenant.
   * Supports optional search by name (first or last), pagination, and optional
   * filtering by yearGroup or academicYear.
   */
  listAllStudents: adminProcedure
    .input(
      z.object({
        search: z.string().optional(),
        yearGroup: z.string().optional(),
        academicYear: z.string().optional(),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(200).default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const tid = ctx.tenantId;

      // Build group filter
      const groupConditions = [];
      if (tid != null) groupConditions.push(eq(classGroups.tenantId, tid));
      if (input.yearGroup) groupConditions.push(eq(classGroups.yearGroup, input.yearGroup as "infantil" | "junior" | "primary" | "secondary"));
      if (input.academicYear) groupConditions.push(eq(classGroups.academicYear, input.academicYear));

      // Get all matching groups
      const matchingGroups = await db
        .select({
          id: classGroups.id,
          className: classGroups.className,
          level: classGroups.level,
          yearGroup: classGroups.yearGroup,
          academicYear: classGroups.academicYear,
          formTutorId: classGroups.formTutorId,
        })
        .from(classGroups)
        .where(groupConditions.length > 0 ? and(...groupConditions) : undefined)
        .orderBy(classGroups.className);

      if (matchingGroups.length === 0) {
        return { students: [], total: 0, page: input.page, pageSize: input.pageSize };
      }

      const groupIds = matchingGroups.map(g => g.id);
      const groupMap = Object.fromEntries(matchingGroups.map(g => [g.id, g]));

      // Build student conditions
      const studentConditions: ReturnType<typeof eq>[] = [inArray(groupStudents.groupId, groupIds) as ReturnType<typeof eq>];
      if (input.search && input.search.trim().length > 0) {
        const pattern = `%${input.search.trim()}%`;
        studentConditions.push(like(groupStudents.name, pattern) as ReturnType<typeof eq>);
      }

      // Count total
      const [{ total }] = await db
        .select({ total: count() })
        .from(groupStudents)
        .where(and(...studentConditions));

      // Fetch page
      const offset = (input.page - 1) * input.pageSize;
      const rows = await db
        .select()
        .from(groupStudents)
        .where(and(...studentConditions))
        .orderBy(groupStudents.name)
        .limit(input.pageSize)
        .offset(offset);

      const students = rows.map(s => ({
        id: s.id,
        name: s.name,
        email: s.email,
        studentNumber: s.studentNumber,
        groupId: s.groupId,
        className: groupMap[s.groupId]?.className ?? "",
        level: groupMap[s.groupId]?.level ?? "",
        yearGroup: groupMap[s.groupId]?.yearGroup ?? null,
        academicYear: groupMap[s.groupId]?.academicYear ?? null,
      }));

      return { students, total, page: input.page, pageSize: input.pageSize };
    }),

  /**
   * Get full details for a single student: basic info, class group, progress
   * summary (per-competency averages), and attendance summary.
   * Accessible only to directors and heads of study (adminProcedure).
   */
  getStudentDetails: adminProcedure
    .input(z.object({ studentId: z.number().int() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const tid = ctx.tenantId;

      // Fetch the student row
      const [student] = await db
        .select()
        .from(groupStudents)
        .where(eq(groupStudents.id, input.studentId));
      if (!student) throw new TRPCError({ code: "NOT_FOUND", message: "Student not found" });

      // Fetch the class group and verify tenant access
      const [group] = await db
        .select()
        .from(classGroups)
        .where(
          tid != null
            ? and(eq(classGroups.id, student.groupId), eq(classGroups.tenantId, tid))
            : eq(classGroups.id, student.groupId)
        );
      if (!group) throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });

      // Progress: per-competency averages
      const progressRows = await db
        .select({
          competency: studentProgress.competency,
          avgScore: avg(studentProgress.score),
          recordCount: count(),
          lastActive: max(studentProgress.recordedAt),
        })
        .from(studentProgress)
        .where(
          and(
            eq(studentProgress.groupId, student.groupId),
            eq(studentProgress.studentId, student.id)
          )
        )
        .groupBy(studentProgress.competency);

      const competencyAverages = ALL_COMPETENCY_CODES.map(code => {
        const row = progressRows.find(r => r.competency === code);
        return {
          code,
          average: row ? Math.round(Number(row.avgScore)) : null,
          recordCount: row?.recordCount ?? 0,
        };
      });

      const scoredComps = competencyAverages.filter(c => c.average !== null);
      const overallAverage = scoredComps.length > 0
        ? Math.round(scoredComps.reduce((s, c) => s + (c.average ?? 0), 0) / scoredComps.length)
        : null;

      const lastActive = progressRows.reduce((latest, r) => {
        if (!r.lastActive) return latest;
        const d = new Date(r.lastActive);
        return !latest || d > latest ? d : latest;
      }, null as Date | null);

      // Attendance summary
      const attendanceRows = await db
        .select({ status: attendanceRecords.status, cnt: count() })
        .from(attendanceRecords)
        .where(
          and(
            eq(attendanceRecords.classGroupId, student.groupId),
            eq(attendanceRecords.studentId, student.id)
          )
        )
        .groupBy(attendanceRecords.status);

      const attendanceSummary = { present: 0, absent: 0, late: 0, excused: 0, total: 0 };
      for (const row of attendanceRows) {
        attendanceSummary[row.status as keyof typeof attendanceSummary] = row.cnt;
        attendanceSummary.total += row.cnt;
      }
      const attendanceRate = attendanceSummary.total > 0
        ? Math.round((attendanceSummary.present / attendanceSummary.total) * 100)
        : null;

      // Recent attendance records (last 20)
      const recentAttendance = await db
        .select()
        .from(attendanceRecords)
        .where(
          and(
            eq(attendanceRecords.classGroupId, student.groupId),
            eq(attendanceRecords.studentId, student.id)
          )
        )
        .orderBy(desc(attendanceRecords.date))
        .limit(20);

      return {
        student,
        group: {
          id: group.id,
          className: group.className,
          level: group.level,
          yearGroup: group.yearGroup,
          academicYear: group.academicYear,
        },
        competencyAverages,
        overallAverage,
        lastActive,
        attendanceSummary,
        attendanceRate,
          recentAttendance,
      };
    }),

  /** Fetch lesson plans for a specific teacher (director-only) */
  getTeacherPlans: adminProcedure
    .input(z.object({
      userId: z.number(),
      aiOnly: z.boolean().optional(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const conditions = [eq(lessonPlans.userId, input.userId)];
      if (input.aiOnly) conditions.push(eq(lessonPlans.aiGenerated, true));
      const plans = await db
        .select({
          id: lessonPlans.id,
          title: lessonPlans.title,
          subject: lessonPlans.subject,
          yearGroup: lessonPlans.yearGroup,
          lessonDate: lessonPlans.lessonDate,
          aiGenerated: lessonPlans.aiGenerated,
          unit: lessonPlans.unit,
          lessonNumber: lessonPlans.lessonNumber,
          duration: lessonPlans.duration,
          competencies: lessonPlans.competencies,
          learningOutcomes: lessonPlans.learningOutcomes,
          procedures: lessonPlans.procedures,
          createdAt: lessonPlans.createdAt,
        })
        .from(lessonPlans)
        .where(and(...conditions))
        .orderBy(desc(lessonPlans.createdAt))
        .limit(100);
      return plans;
    }),
});
