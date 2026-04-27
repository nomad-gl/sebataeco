import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import {
  timetableSlots,
  attendanceRecords,
  classGroups,
  groupStudents,
  users,
  assessmentEvents,
  lessonPlans,
  pendingTeacherSubmissions,
  tenants,
  adminAuditLogs,
} from "../../drizzle/schema";
import { eq, and, gte, lte, inArray, isNull } from "drizzle-orm";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { sendTempPasswordEmail } from "../email";
import { buildTenantWhere } from "../tenantFilter";

// ─── Timetable ────────────────────────────────────────────────────────────────

export const hosRouter = router({
  /**
   * Get all timetable slots for a given academic year.
   * Returns slots enriched with teacher name and class group name.
   */
  getTimetable: protectedProcedure
    .input(z.object({ academicYear: z.string().default("2025-26") }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      const slots = await db
        .select()
        .from(timetableSlots)
        .where(eq(timetableSlots.academicYear, input.academicYear));

      // Enrich with teacher names
      const teacherIds = Array.from(new Set(slots.map((s) => s.teacherId).filter((x): x is number => x != null)));
      const classGroupIds = Array.from(new Set(slots.map((s) => s.classGroupId).filter((x): x is number => x != null)));

      const teacherMap: Record<number, string> = {};
      const groupMap: Record<number, string> = {};

      if (teacherIds.length > 0) {
        const teachers = await db
          .select({ id: users.id, name: users.name })
          .from(users)
          .where(inArray(users.id, teacherIds));
        teachers.forEach((t) => { if (t.name) teacherMap[t.id] = t.name; });
      }

      if (classGroupIds.length > 0) {
        const groups = await db
          .select({ id: classGroups.id, className: classGroups.className })
          .from(classGroups)
          .where(inArray(classGroups.id, classGroupIds));
        groups.forEach((g) => { groupMap[g.id] = g.className; });
      }

      return slots.map((s) => ({
        ...s,
        teacherName: s.teacherId ? (teacherMap[s.teacherId] ?? null) : null,
        classGroupName: s.classGroupId ? (groupMap[s.classGroupId] ?? null) : null,
      }));
    }),

  /**
   * Upsert a timetable slot (create or update by dayOfWeek + periodNumber + academicYear).
   */
  saveSlot: protectedProcedure
    .input(
      z.object({
        id: z.number().optional(),
        dayOfWeek: z.number().min(1).max(5),
        periodNumber: z.number().min(1).max(12),
        startTime: z.string(),
        endTime: z.string(),
        teacherId: z.number().nullable().optional(),
        classGroupId: z.number().nullable().optional(),
        subject: z.string().nullable().optional(),
        room: z.string().nullable().optional(),
        academicYear: z.string().default("2025-26"),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      if (input.id) {
        await db
          .update(timetableSlots)
          .set({
            teacherId: input.teacherId ?? null,
            classGroupId: input.classGroupId ?? null,
            subject: input.subject ?? null,
            room: input.room ?? null,
            startTime: input.startTime,
            endTime: input.endTime,
          })
          .where(eq(timetableSlots.id, input.id));
        return { success: true };
      }

      await db.insert(timetableSlots).values({
        dayOfWeek: input.dayOfWeek,
        periodNumber: input.periodNumber,
        startTime: input.startTime,
        endTime: input.endTime,
        teacherId: input.teacherId ?? null,
        classGroupId: input.classGroupId ?? null,
        subject: input.subject ?? null,
        room: input.room ?? null,
        academicYear: input.academicYear,
      });

      return { success: true };
    }),

  /**
   * Delete a timetable slot by ID.
   */
  deleteSlot: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db.delete(timetableSlots).where(eq(timetableSlots.id, input.id));
      return { success: true };
    }),

  /**
   * Get all teachers (users) for the timetable slot assignment dropdown.
   */
  getTeachers: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db
      .select({ id: users.id, name: users.name, email: users.email, isPermanent: users.isPermanent })
      .from(users);
  }),

  /**
   * Get all class groups across all teachers for the timetable slot assignment dropdown.
   */
  getAllClassGroups: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    const tenantWhere = buildTenantWhere(ctx.user, classGroups);
    return db
      .select({ id: classGroups.id, className: classGroups.className, level: classGroups.level })
      .from(classGroups)
      .where(and(tenantWhere ?? eq(classGroups.userId, ctx.user.id), isNull(classGroups.deletedAt)));
  }),

  // ─── Attendance ──────────────────────────────────────────────────────────────

  /**
   * Get attendance records for a class group within a date range.
   * Returns records enriched with student name.
   */
  getAttendance: protectedProcedure
    .input(
      z.object({
        classGroupId: z.number(),
        fromDate: z.string(), // ISO date string YYYY-MM-DD
        toDate: z.string(),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { records: [], students: [] };

      // Get students in this group
      const students = await db
        .select()
        .from(groupStudents)
        .where(eq(groupStudents.groupId, input.classGroupId));

      // Get attendance records in date range
      const records = await db
        .select()
        .from(attendanceRecords)
        .where(
          and(
            eq(attendanceRecords.classGroupId, input.classGroupId),
            gte(attendanceRecords.date, input.fromDate as unknown as Date),
            lte(attendanceRecords.date, input.toDate as unknown as Date)
          )
        );

      return { records, students };
    }),

  /**
   * Get 30-day absence rate summary per class group (for the chart).
   */
  getAbsenceSummary: protectedProcedure
    .input(z.object({ days: z.number().default(30) }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return [];

      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - input.days);
      const fromStr = fromDate.toISOString().slice(0, 10);
      const toStr = new Date().toISOString().slice(0, 10);

      const tenantWhere = buildTenantWhere(ctx.user, classGroups);
      const groups = await db
        .select()
        .from(classGroups)
        .where(and(tenantWhere ?? eq(classGroups.userId, ctx.user.id), isNull(classGroups.deletedAt)));
      const results = [];

      for (const group of groups) {
        const students = await db
          .select()
          .from(groupStudents)
          .where(eq(groupStudents.groupId, group.id));

        const records = await db
          .select()
          .from(attendanceRecords)
          .where(
            and(
              eq(attendanceRecords.classGroupId, group.id),
              gte(attendanceRecords.date, fromStr as unknown as Date),
              lte(attendanceRecords.date, toStr as unknown as Date)
            )
          );

        const totalRecords = records.length;
        const absentRecords = records.filter((r) => r.status === "absent" || r.status === "late").length;
        const absenceRate = totalRecords > 0 ? Math.round((absentRecords / totalRecords) * 100) : 0;

        results.push({
          groupId: group.id,
          className: group.className,
          level: group.level,
          studentCount: students.length,
          totalRecords,
          absentRecords,
          absenceRate,
        });
      }

      return results;
    }),

  /**
   * Save (upsert) an attendance record for a student on a specific date.
   */
  saveAttendance: protectedProcedure
    .input(
      z.object({
        classGroupId: z.number(),
        studentId: z.number(),
        date: z.string(), // YYYY-MM-DD
        status: z.enum(["present", "absent", "late", "excused"]),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      // Try update first
      const existing = await db
        .select()
        .from(attendanceRecords)
        .where(
          and(
            eq(attendanceRecords.studentId, input.studentId),
            eq(attendanceRecords.date, input.date as unknown as Date)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(attendanceRecords)
          .set({
            status: input.status,
            notes: input.notes ?? null,
            recordedBy: ctx.user.id,
          })
          .where(eq(attendanceRecords.id, existing[0].id));
      } else {
        await db.insert(attendanceRecords).values({
          classGroupId: input.classGroupId,
          studentId: input.studentId,
          date: input.date as unknown as Date,
          status: input.status,
          notes: input.notes ?? null,
          recordedBy: ctx.user.id,
        });
      }

      return { success: true };
    }),

  /**
   * Bulk save attendance for an entire class on a given date.
   */
  bulkSaveAttendance: protectedProcedure
    .input(
      z.object({
        classGroupId: z.number(),
        date: z.string(),
        records: z.array(
          z.object({
            studentId: z.number(),
            status: z.enum(["present", "absent", "late", "excused"]),
            notes: z.string().optional(),
          })
        ),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      for (const rec of input.records) {
        const existing = await db
          .select()
          .from(attendanceRecords)
          .where(
            and(
              eq(attendanceRecords.studentId, rec.studentId),
              eq(attendanceRecords.date, input.date as unknown as Date)
            )
          )
          .limit(1);

        if (existing.length > 0) {
          await db
            .update(attendanceRecords)
            .set({ status: rec.status, notes: rec.notes ?? null, recordedBy: ctx.user.id })
            .where(eq(attendanceRecords.id, existing[0].id));
        } else {
          await db.insert(attendanceRecords).values({
            classGroupId: input.classGroupId,
            studentId: rec.studentId,
            date: input.date as unknown as Date,
            status: rec.status,
            notes: rec.notes ?? null,
            recordedBy: ctx.user.id,
          });
        }
      }

      return { success: true };
    }),

  // ─── Class Groups ─────────────────────────────────────────────────────────────

  /**
   * List all class groups for a given academic year, enriched with form tutor name.
   */
  getGroups: protectedProcedure
    .input(z.object({ academicYear: z.string().default("2025-26") }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      const groups = await db
        .select()
        .from(classGroups)
        .where(eq(classGroups.academicYear, input.academicYear));

      // Enrich with form tutor names
      const tutorIds = Array.from(
        new Set(groups.map((g) => g.formTutorId).filter((x): x is number => x != null))
      );
      const tutorMap: Record<number, string> = {};
      if (tutorIds.length > 0) {
        const tutors = await db
          .select({ id: users.id, name: users.name })
          .from(users)
          .where(inArray(users.id, tutorIds));
        tutors.forEach((t) => { if (t.name) tutorMap[t.id] = t.name; });
      }

      return groups.map((g) => ({
        ...g,
        formTutorName: g.formTutorId ? (tutorMap[g.formTutorId] ?? null) : null,
      }));
    }),

  /**
   * Create or update a class group (upsert by id).
   * Pass id=0 or omit to create; pass existing id to update.
   */
  upsertGroup: protectedProcedure
    .input(
      z.object({
        id: z.number().optional(),
        className: z.string().min(1).max(128),
        yearGroup: z.enum(["infantil", "junior", "primary", "secondary"]).default("secondary"),
        academicYear: z.string().default("2025-26"),
        formTutorId: z.number().nullable().optional(),
        studentCount: z.number().min(0).max(999).default(0),
        notes: z.string().max(1000).nullable().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      if (input.id && input.id > 0) {
        // Update
        await db
          .update(classGroups)
          .set({
            className: input.className,
            yearGroup: input.yearGroup,
            academicYear: input.academicYear,
            formTutorId: input.formTutorId ?? null,
            studentCount: input.studentCount,
            notes: input.notes ?? null,
          })
          .where(eq(classGroups.id, input.id));
        return { id: input.id };
      } else {
        // Insert — userId is required by the existing schema; use 0 as placeholder for HOS-created groups
        const [result] = await db.insert(classGroups).values({
          userId: 0,
          className: input.className,
          level: input.yearGroup,
          assessmentTitle: "",
          yearGroup: input.yearGroup,
          academicYear: input.academicYear,
          formTutorId: input.formTutorId ?? null,
          studentCount: input.studentCount,
          notes: input.notes ?? null,
        });
        return { id: (result as unknown as { insertId: number }).insertId };
      }
    }),

   /**
   * Delete a class group by id.
   */
  deleteGroup: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db.delete(classGroups).where(eq(classGroups.id, input.id));
      return { success: true };
    }),

  // ─── Assessment Calendar ──────────────────────────────────────────────────────

  /**
   * Get all assessment events for a given academic year.
   */
  getAssessmentEvents: protectedProcedure
    .input(z.object({ academicYear: z.string().default("2025-26") }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db
        .select()
        .from(assessmentEvents)
        .where(eq(assessmentEvents.academicYear, input.academicYear))
        .orderBy(assessmentEvents.startDate);
    }),

  /**
   * Create or update an assessment event.
   * If id is provided, update; otherwise insert.
   */
  upsertAssessmentEvent: protectedProcedure
    .input(z.object({
      id: z.number().optional(),
      title: z.string().min(1).max(256),
      eventType: z.enum(["exam", "evaluation", "deadline", "meeting", "other"]),
      yearGroup: z.string().optional(),
      subject: z.string().optional(),
      startDate: z.string(),
      endDate: z.string(),
      notes: z.string().optional(),
      academicYear: z.string().default("2025-26"),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      if (input.id) {
        await db.update(assessmentEvents)
          .set({
            title: input.title,
            eventType: input.eventType,
            yearGroup: input.yearGroup ?? null,
            subject: input.subject ?? null,
            startDate: input.startDate,
            endDate: input.endDate,
            notes: input.notes ?? null,
            academicYear: input.academicYear,
          })
          .where(eq(assessmentEvents.id, input.id));
        return { id: input.id };
      } else {
        const [result] = await db.insert(assessmentEvents).values({
          title: input.title,
          eventType: input.eventType,
          yearGroup: input.yearGroup ?? null,
          subject: input.subject ?? null,
          startDate: input.startDate,
          endDate: input.endDate,
          notes: input.notes ?? null,
          createdBy: ctx.user.id,
          academicYear: input.academicYear,
        });
        return { id: (result as unknown as { insertId: number }).insertId };
      }
    }),

  /**
   * Delete an assessment event by id.
   */
  deleteAssessmentEvent: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db.delete(assessmentEvents).where(eq(assessmentEvents.id, input.id));
      return { success: true };
    }),

  /**
   * Curriculum Compliance — aggregate LOMLOE competency coverage across all lesson plans,
   * grouped by yearGroup. Returns an array of { yearGroup, competency, count, total, pct }.
   */
  getCurriculumCompliance: protectedProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      const plans = await db
        .select({
          yearGroup: lessonPlans.yearGroup,
          competencies: lessonPlans.competencies,
        })
        .from(lessonPlans);

      const LOMLOE_CODES = ["CCL", "CP", "STEM", "CD", "CPSAA", "CC", "CE", "CCEC"];
      const YEAR_GROUPS = ["junior", "primary", "secondary"];

      const totalByYearGroup: Record<string, number> = {};
      const coverageMap: Record<string, Record<string, number>> = {};

      for (const plan of plans) {
        const yg = plan.yearGroup ?? "secondary";
        totalByYearGroup[yg] = (totalByYearGroup[yg] ?? 0) + 1;
        if (!coverageMap[yg]) coverageMap[yg] = {};
        let codes: string[] = [];
        try { codes = plan.competencies ? JSON.parse(plan.competencies) : []; } catch { codes = []; }
        for (const code of codes) {
          if (LOMLOE_CODES.includes(code)) {
            coverageMap[yg][code] = (coverageMap[yg][code] ?? 0) + 1;
          }
        }
      }

      const rows: { yearGroup: string; competency: string; count: number; total: number; pct: number }[] = [];
      for (const yg of YEAR_GROUPS) {
        const total = totalByYearGroup[yg] ?? 0;
        for (const code of LOMLOE_CODES) {
          const count = coverageMap[yg]?.[code] ?? 0;
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          rows.push({ yearGroup: yg, competency: code, count, total, pct });
        }
      }
      return rows;
    }),

  // ─── Teacher submission workflow ─────────────────────────────────────────────

  /**
   * Submit a new teacher for Director approval.
   * The Head of Study provides the proposed teacher's name and email.
   * A pending_teacher_submissions row is created; no user account is created yet.
   */
  submitTeacher: protectedProcedure
    .input(z.object({
      teacherName: z.string().min(1).max(255),
      teacherEmail: z.string().email().max(255),
      note: z.string().max(512).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== "head_of_study" && ctx.user.role !== "admin" && ctx.user.role !== "director") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only a Head of Study or Director can submit teacher requests." });
      }
      if (!ctx.user.tenantId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "You must be assigned to a school before submitting teachers." });
      }
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      const isDirector = ctx.user.role === "director" || ctx.user.role === "admin";

      // ── Director / Admin: skip the pending queue and create the account immediately ──
      if (isDirector) {
        // Check email not already taken
        const [existingUser] = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.email, input.teacherEmail.toLowerCase().trim()))
          .limit(1);
        if (existingUser) throw new TRPCError({ code: "BAD_REQUEST", message: "A user with this email already exists." });

        // Get school name for the welcome email
        const [tenant] = await db
          .select({ name: tenants.name })
          .from(tenants)
          .where(eq(tenants.id, ctx.user.tenantId))
          .limit(1);

        // Generate temp password
        const tempPassword = crypto.randomBytes(8).toString("base64url").slice(0, 12);
        const passwordHash = await bcrypt.hash(tempPassword, 10);

        // Create user account
        const [insertResult] = await db.insert(users).values({
          openId: `local_${crypto.randomUUID()}`,
          name: input.teacherName.trim(),
          email: input.teacherEmail.toLowerCase().trim(),
          loginMethod: "local",
          role: "teacher",
          position: "teacher",
          tenantId: ctx.user.tenantId,
          schoolName: tenant?.name ?? null,
          passwordHash,
          mustChangePassword: true,
          displayName: input.teacherName.trim(),
        });
        const newUserId = (insertResult as unknown as { insertId: number }).insertId;

        // Also create a record in pending_teacher_submissions (already approved) for audit history
        const [subResult] = await db.insert(pendingTeacherSubmissions).values({
          submittedByUserId: ctx.user.id,
          tenantId: ctx.user.tenantId,
          teacherName: input.teacherName.trim(),
          teacherEmail: input.teacherEmail.toLowerCase().trim(),
          note: input.note ?? null,
          pts_status: "approved",
          reviewedByUserId: ctx.user.id,
          reviewedAt: new Date(),
          createdUserId: newUserId,
        });
        const submissionId = (subResult as unknown as { insertId: number }).insertId;

        // Send welcome email with temp password — personalised with Director's name and email
        void sendTempPasswordEmail({
          to: input.teacherEmail.toLowerCase().trim(),
          name: input.teacherName.trim(),
          tempPassword,
          schoolName: tenant?.name ?? null,
          loginUrl: "https://aina.forum/login",
          role: "teacher",
          directorName: ctx.user.name ?? ctx.user.displayName ?? null,
          directorEmail: ctx.user.email ?? null,
        });

        // Audit log
        void db.insert(adminAuditLogs).values({
          userId: ctx.user.id,
          action: "director_create_teacher",
          resource: "pending_teacher_submissions",
          resourceId: String(submissionId),
          details: JSON.stringify({ teacherEmail: input.teacherEmail, newUserId }),
        });

        return { success: true, autoApproved: true, tempPassword, teacherEmail: input.teacherEmail.toLowerCase().trim(), newUserId };
      }

      // ── Head of Study: create pending submission for Director approval ──
      const existing = await db
        .select({ id: pendingTeacherSubmissions.id })
        .from(pendingTeacherSubmissions)
        .where(
          and(
            eq(pendingTeacherSubmissions.teacherEmail, input.teacherEmail.toLowerCase()),
            eq(pendingTeacherSubmissions.tenantId, ctx.user.tenantId),
            eq(pendingTeacherSubmissions.pts_status, "pending"),
          )
        )
        .limit(1);
      if (existing.length > 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "A pending submission already exists for this email address." });
      }
      await db.insert(pendingTeacherSubmissions).values({
        submittedByUserId: ctx.user.id,
        tenantId: ctx.user.tenantId,
        teacherName: input.teacherName.trim(),
        teacherEmail: input.teacherEmail.toLowerCase().trim(),
        note: input.note ?? null,
        pts_status: "pending",
      });
      return { success: true, autoApproved: false };
    }),

  /**
   * List all teacher submissions made by the current HoS (or all for admin).
   */
  listMyTeacherSubmissions: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "head_of_study" && ctx.user.role !== "admin") {
      return [];
    }
    const db = await getDb();
    if (!db) return [];
    const rows = await db
      .select()
      .from(pendingTeacherSubmissions)
      .where(
        ctx.user.role === "admin"
          ? undefined
          : eq(pendingTeacherSubmissions.submittedByUserId, ctx.user.id)
      )
      .orderBy(pendingTeacherSubmissions.createdAt);
    return rows;
  }),

  /**
   * Cancel (delete) a pending teacher submission — only allowed by the submitter, and only while still pending.
   */
  cancelPendingTeacher: protectedProcedure
    .input(z.object({ submissionId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== "head_of_study" && ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not authorised." });
      }
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const [submission] = await db
        .select()
        .from(pendingTeacherSubmissions)
        .where(eq(pendingTeacherSubmissions.id, input.submissionId))
        .limit(1);
      if (!submission) throw new TRPCError({ code: "NOT_FOUND", message: "Submission not found." });
      if (submission.pts_status !== "pending") throw new TRPCError({ code: "BAD_REQUEST", message: "Only pending submissions can be cancelled." });
      if (ctx.user.role !== "admin" && submission.submittedByUserId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You can only cancel your own submissions." });
      }
      await db
        .delete(pendingTeacherSubmissions)
        .where(eq(pendingTeacherSubmissions.id, input.submissionId));
      return { success: true };
    }),
});
