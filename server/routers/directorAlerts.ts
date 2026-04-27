/**
 * directorAlerts router — system-generated alerts for school directors.
 *
 * Two alert types are supported:
 *   unassigned_cover   — a teacher absence has no confirmed cover after 2 hours
 *   high_absence_rate  — a class group had >25% student absences in the last 7 days
 *
 * Deduplication: one active (non-dismissed) alert per dedupeKey per tenant.
 * The checkAndCreateAlerts procedure is called on every director page load.
 */
import { z } from "zod";
import { and, desc, eq, lt, sql } from "drizzle-orm";
import { router, adminProcedure } from "../_core/trpc";
import { getDb } from "../db";
import {
  directorAlerts,
  classRegister,
  coverAssignment,
  attendanceRecords,
  classGroups,
  groupStudents,
} from "../../drizzle/schema";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** ISO week string e.g. "2025-W42" for deduplication of weekly absence alerts */
function isoWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const directorAlertsRouter = router({

  /**
   * getAlerts — returns all active (non-dismissed) alerts for the director's tenant,
   * newest first, max 100 rows.
   */
  getAlerts: adminProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db || !ctx.user.tenantId) return [];
    const rows = await db
      .select()
      .from(directorAlerts)
      .where(
        and(
          eq(directorAlerts.tenantId, ctx.user.tenantId),
          eq(directorAlerts.isDismissed, false)
        )
      )
      .orderBy(desc(directorAlerts.createdAt))
      .limit(100);
    return rows;
  }),

  /**
   * getUnreadCount — returns the count of unread, non-dismissed alerts.
   * Used to drive the notification bell badge.
   */
  getUnreadCount: adminProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db || !ctx.user.tenantId) return 0;
    const [row] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(directorAlerts)
      .where(
        and(
          eq(directorAlerts.tenantId, ctx.user.tenantId),
          eq(directorAlerts.isRead, false),
          eq(directorAlerts.isDismissed, false)
        )
      );
    return Number(row?.count ?? 0);
  }),

  /** markRead — marks a single alert as read */
  markRead: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db || !ctx.user.tenantId) return;
      await db
        .update(directorAlerts)
        .set({ isRead: true })
        .where(
          and(
            eq(directorAlerts.id, input.id),
            eq(directorAlerts.tenantId, ctx.user.tenantId)
          )
        );
    }),

  /** markAllRead — marks all non-dismissed alerts as read */
  markAllRead: adminProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db || !ctx.user.tenantId) return;
    await db
      .update(directorAlerts)
      .set({ isRead: true })
      .where(
        and(
          eq(directorAlerts.tenantId, ctx.user.tenantId),
          eq(directorAlerts.isDismissed, false)
        )
      );
  }),

  /** dismissAlert — hides an alert from the list permanently */
  dismissAlert: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db || !ctx.user.tenantId) return;
      await db
        .update(directorAlerts)
        .set({ isDismissed: true, isRead: true })
        .where(
          and(
            eq(directorAlerts.id, input.id),
            eq(directorAlerts.tenantId, ctx.user.tenantId)
          )
        );
    }),

  /**
   * checkAndCreateAlerts — scans the DB for situations that warrant an alert
   * and inserts new rows if they don't already exist (deduplication via dedupeKey).
   *
   * Called on every director page load (lightweight — only inserts when needed).
   *
   * Detection logic:
   *   1. Unassigned covers: class_register rows with isAbsence=true created more
   *      than 2 hours ago that have no confirmed cover_assignment.
   *   2. High absence rate: for each class group, count distinct students marked
   *      absent in the last 7 days. If > 25% of the group's studentCount, alert.
   */
  checkAndCreateAlerts: adminProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db || !ctx.user.tenantId) return { created: 0 };
    const tenantId = ctx.user.tenantId;
    let created = 0;

    // ── 1. Unassigned cover detection ────────────────────────────────────────
    try {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

      // Fetch absence rows older than 2 hours with no confirmed cover
      const absenceRows = await db
        .select({
          registerId: classRegister.id,
          classGroupId: classRegister.classGroupId,
          lessonDate: classRegister.lessonDate,
          tenantId: classRegister.tenantId,
          groupName: classGroups.className,
        })
        .from(classRegister)
        .leftJoin(classGroups, eq(classGroups.id, classRegister.classGroupId))
        .where(
          and(
            eq(classRegister.tenantId, tenantId),
            eq(classRegister.isAbsence, true),
            lt(classRegister.createdAt, twoHoursAgo)
          )
        )
        .limit(50);

      for (const absence of absenceRows) {
        // Check for a confirmed cover
        const [cover] = await db
          .select({ id: coverAssignment.id })
          .from(coverAssignment)
          .where(
            and(
              eq(coverAssignment.registerId, absence.registerId),
              eq(coverAssignment.status, "confirmed"),
              eq(coverAssignment.tenantId, tenantId)
            )
          )
          .limit(1);

        if (cover) continue; // already covered — skip

        const dedupeKey = `unassigned_cover:${absence.registerId}`;

        // Check if we already have an active (non-dismissed) alert for this
        const [existing] = await db
          .select({ id: directorAlerts.id })
          .from(directorAlerts)
          .where(
            and(
              eq(directorAlerts.tenantId, tenantId),
              eq(directorAlerts.dedupeKey, dedupeKey),
              eq(directorAlerts.isDismissed, false)
            )
          )
          .limit(1);

        if (existing) continue; // already alerted

        const dateStr = absence.lessonDate instanceof Date
          ? absence.lessonDate.toLocaleDateString("ca-ES", { day: "2-digit", month: "2-digit" })
          : String(absence.lessonDate);
        const groupLabel = absence.groupName ?? `Group ${absence.classGroupId}`;

        await db.insert(directorAlerts).values({
          tenantId,
          type: "unassigned_cover",
          severity: "critical",
          title: `Cover not assigned: ${groupLabel}`,
          body: `${groupLabel} (${dateStr}) has a teacher absence with no confirmed cover teacher assigned.`,
          link: "/director/cover-requests",
          relatedRegisterId: absence.registerId,
          dedupeKey,
          isRead: false,
          isDismissed: false,
        });
        created++;
      }
    } catch (err) {
      console.warn("[directorAlerts] Unassigned cover check failed:", err);
    }

    // ── 2. High absence rate detection ───────────────────────────────────────
    try {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const weekKey = isoWeek(new Date());

      // Fetch all class groups for this tenant
      const groups = await db
        .select({
          id: classGroups.id,
          className: classGroups.className,
          studentCount: classGroups.studentCount,
        })
        .from(classGroups)
        .where(eq(classGroups.tenantId, tenantId));

      for (const group of groups) {
        const totalStudents = group.studentCount ?? 0;
        if (totalStudents === 0) continue;

        // Count distinct students with an absence record in the last 7 days
        const [absRow] = await db
          .select({ absentCount: sql<number>`COUNT(DISTINCT ${attendanceRecords.studentId})` })
          .from(attendanceRecords)
          .where(
            and(
              eq(attendanceRecords.classGroupId, group.id),
              eq(attendanceRecords.status, "absent"),
              sql`${attendanceRecords.date} >= ${sevenDaysAgo.toISOString().slice(0, 10)}`
            )
          );

        const absentCount = Number(absRow?.absentCount ?? 0);
        const rate = absentCount / totalStudents;

        if (rate < 0.25) continue; // below threshold

        const dedupeKey = `high_absence_rate:${group.id}:${weekKey}`;

        // Check for existing active alert this week
        const [existing] = await db
          .select({ id: directorAlerts.id })
          .from(directorAlerts)
          .where(
            and(
              eq(directorAlerts.tenantId, tenantId),
              eq(directorAlerts.dedupeKey, dedupeKey),
              eq(directorAlerts.isDismissed, false)
            )
          )
          .limit(1);

        if (existing) continue;

        const pct = Math.round(rate * 100);
        const severity = rate >= 0.5 ? "critical" : "warning";

        await db.insert(directorAlerts).values({
          tenantId,
          type: "high_absence_rate",
          severity,
          title: `High absence rate: ${group.className}`,
          body: `${group.className} has ${absentCount} of ${totalStudents} students (${pct}%) absent in the last 7 days — above the 25% alert threshold.`,
          link: "/director/teacher-attendance",
          relatedGroupId: group.id,
          dedupeKey,
          isRead: false,
          isDismissed: false,
        });
        created++;
      }
    } catch (err) {
      console.warn("[directorAlerts] High absence rate check failed:", err);
    }

    return { created };
  }),
});
