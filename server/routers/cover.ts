/**
 * cover router
 * AI-assisted cover teacher assignment system.
 *
 * Priority order for cover candidates:
 *   1. Teachers with the same subject assignment who are free at that time slot
 *   2. Teachers with a topic-specific match (not listed for the generalised subject)
 *   3. Any teacher who is free at that time slot (by timetable)
 *
 * After director confirms cover:
 *   - hour_adjustment record created (extra_cover)
 *   - Payback opportunity scanned via AI
 *   - Both teachers notified
 */
import { z } from "zod";
import { and, desc, eq, ne, gte, isNotNull, isNull, lt } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { invokeLLM } from "../_core/llm";
import { notifyOwner } from "../_core/notification";
import {
  classRegister,
  coverAssignment,
  hourAdjustment,
  teacherNotification,
  teacherSubjects,
  teacherSchedule,
  classGroups,
  users,
  tenants,
} from "../../drizzle/schema";

// ─── helpers ──────────────────────────────────────────────────────────────────
function isDirectorOrHos(role: string, position: string) {
  return (
    role === "director" ||
    role === "head_of_study" ||
    position === "director" ||
    position === "head_of_study"
  );
}

/** Parse HH:MM → minutes since midnight */
function toMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

/** Check if two time ranges overlap */
function timesOverlap(
  s1: string, e1: string,
  s2: string, e2: string
): boolean {
  return toMinutes(s1) < toMinutes(e2) && toMinutes(s2) < toMinutes(e1);
}

/** Day-of-week string from a YYYY-MM-DD date */
function dayOfWeek(dateStr: string): string {
  const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  return days[new Date(dateStr).getDay()];
}

// ─── router ───────────────────────────────────────────────────────────────────
export const coverRouter = router({
  /**
   * findCoverCandidates — returns an AI-ranked list of available teachers
   * who could cover the absent teacher's class.
   *
   * Ranking tiers:
   *   tier 1 — subject match + free at that time
   *   tier 2 — topic-specific match + free
   *   tier 3 — any free teacher
   */
  findCoverCandidates: protectedProcedure
    .input(
      z.object({
        registerId: z.number(),
      })
    )
    .query(async ({ ctx, input }) => {
      if (!isDirectorOrHos(ctx.user.role, ctx.user.position ?? "")) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const tenantId = ctx.user.tenantId;
      if (!tenantId) throw new TRPCError({ code: "BAD_REQUEST", message: "No tenant" });

      // ── 1. Load the register entry ─────────────────────────────────────────
      const [reg] = await db
        .select()
        .from(classRegister)
        .where(and(eq(classRegister.id, input.registerId), eq(classRegister.tenantId, tenantId)))
        .limit(1);

      if (!reg) throw new TRPCError({ code: "NOT_FOUND", message: "Register entry not found" });

      // ── 2. Load the class group to get subject context ─────────────────────
      const [group] = await db
        .select()
        .from(classGroups)
        .where(eq(classGroups.id, reg.classGroupId))
        .limit(1);

      // ── 3. Load absent teacher's schedule for that day to find the time slot
      const lessonDow = dayOfWeek(String(reg.lessonDate));
      const absentSchedule = await db
        .select()
        .from(teacherSchedule)
        .where(
          and(
            eq(teacherSchedule.userId, reg.assignedTeacherId),
            eq(teacherSchedule.dayOfWeek, lessonDow as "monday" | "tuesday" | "wednesday" | "thursday" | "friday"),
            eq(teacherSchedule.tenantId, tenantId)
          )
        );

      // Use the first matching slot (or a default window)
      const slot = absentSchedule[0];
      const slotStart = slot?.startTime ?? "09:00";
      const slotEnd = slot?.endTime ?? "10:00";
      const subject = slot?.subject ?? group?.className ?? "Unknown subject";

      // ── 4. Load all teachers in the tenant (excluding the absent one) ──────
      const allTeachers = await db
        .select()
        .from(users)
        .where(
          and(
            eq(users.tenantId, tenantId),
            ne(users.id, reg.assignedTeacherId),
            eq(users.role, "teacher")
          )
        );

      // ── 5. For each teacher, check their schedule for conflicts ────────────
      const teacherAvailability = await Promise.all(
        allTeachers.map(async (teacher) => {
          const schedule = await db
            .select()
            .from(teacherSchedule)
            .where(
              and(
                eq(teacherSchedule.userId, teacher.id),
                eq(teacherSchedule.dayOfWeek, lessonDow as "monday" | "tuesday" | "wednesday" | "thursday" | "friday"),
                eq(teacherSchedule.tenantId, tenantId)
              )
            );

          const hasConflict = schedule.some((s) =>
            timesOverlap(slotStart, slotEnd, s.startTime, s.endTime)
          );

          const subjectAssignments = await db
            .select()
            .from(teacherSubjects)
            .where(
              and(
                eq(teacherSubjects.userId, teacher.id),
                eq(teacherSubjects.tenantId, tenantId)
              )
            );

          return {
            teacher,
            isFree: !hasConflict,
            subjects: subjectAssignments.map((s) => `${s.subject} (${s.level})`),
            contractedWeeklyMinutes: teacher.contractedWeeklyMinutes,
          };
        })
      );

      // ── 6. Filter to only free teachers ────────────────────────────────────
      const freeTeachers = teacherAvailability.filter((t) => t.isFree);

      if (freeTeachers.length === 0) {
        return { candidates: [], registerId: input.registerId, subject, slotStart, slotEnd };
      }

      // ── 7. Ask AI to rank and categorise the free teachers ─────────────────
      const teacherList = freeTeachers.map((t) => ({
        id: t.teacher.id,
        name: t.teacher.displayName ?? t.teacher.name ?? "Unknown",
        subjects: t.subjects,
        isUnderHours: t.contractedWeeklyMinutes
          ? false // simplified — full calculation would sum schedule minutes
          : false,
      }));

      const aiPrompt = `You are a school timetable coordinator. A teacher is absent and you need to rank available cover teachers.

Absent teacher's class: "${subject}" on ${String(reg.lessonDate)} (${lessonDow}) from ${slotStart} to ${slotEnd}.

Available teachers (free at this time):
${JSON.stringify(teacherList, null, 2)}

Rank these teachers into three tiers:
- Tier 1: Direct subject match (teaches the same or very similar subject)
- Tier 2: Topic-specific match (teaches a related topic not listed under the generalised subject)
- Tier 3: General availability (any free teacher)

For each teacher, provide a brief reason (1 sentence) why they are suitable or not ideal.
Return JSON only.`;

      let rankedCandidates: Array<{
        teacherId: number;
        tier: 1 | 2 | 3;
        reason: string;
        teacherName: string;
      }> = [];

      try {
        const aiResp = await invokeLLM({
          messages: [
            { role: "system", content: "You are a school timetable coordinator. Return valid JSON only." },
            { role: "user", content: aiPrompt },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "cover_ranking",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  candidates: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        teacherId: { type: "integer" },
                        tier: { type: "integer" },
                        reason: { type: "string" },
                        teacherName: { type: "string" },
                      },
                      required: ["teacherId", "tier", "reason", "teacherName"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["candidates"],
                additionalProperties: false,
              },
            },
          },
        });

        const parsed = JSON.parse(aiResp.choices[0].message.content as string) as {
          candidates: Array<{ teacherId: number; tier: number; reason: string; teacherName: string }>;
        };
        rankedCandidates = parsed.candidates.map((c) => ({
          teacherId: c.teacherId,
          tier: Math.min(3, Math.max(1, c.tier)) as 1 | 2 | 3,
          reason: c.reason,
          teacherName: c.teacherName,
        }));
      } catch {
        // Fallback: return all free teachers as tier 3
        rankedCandidates = freeTeachers.map((t) => ({
          teacherId: t.teacher.id,
          tier: 3 as const,
          reason: "Available at this time slot",
          teacherName: t.teacher.displayName ?? t.teacher.name ?? "Unknown",
        }));
      }

      // Sort by tier ascending
      rankedCandidates.sort((a, b) => a.tier - b.tier);

      return {
        candidates: rankedCandidates,
        registerId: input.registerId,
        subject,
        slotStart,
        slotEnd,
        lessonDate: String(reg.lessonDate),
        className: group?.className ?? "Unknown class",
      };
    }),

  /**
   * assignCover — director confirms which teacher will cover the absent class.
   *
   * Creates:
   *   - cover_assignment record (confirmed)
   *   - hour_adjustment record for the cover teacher (+extra_cover minutes)
   *   - teacher_notification for both the cover teacher and the absent teacher
   *
   * Then triggers a payback opportunity scan.
   */
  assignCover: protectedProcedure
    .input(
      z.object({
        registerId: z.number(),
        coverTeacherId: z.number(),
        aiReasoning: z.string().optional(),
        directorComment: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!isDirectorOrHos(ctx.user.role, ctx.user.position ?? "")) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const tenantId = ctx.user.tenantId;
      if (!tenantId) throw new TRPCError({ code: "BAD_REQUEST", message: "No tenant" });

      // ── Load register entry ────────────────────────────────────────────────
      const [reg] = await db
        .select()
        .from(classRegister)
        .where(and(eq(classRegister.id, input.registerId), eq(classRegister.tenantId, tenantId)))
        .limit(1);

      if (!reg) throw new TRPCError({ code: "NOT_FOUND", message: "Register entry not found" });

      // ── Check for existing confirmed cover ────────────────────────────────
      const [existingCover] = await db
        .select()
        .from(coverAssignment)
        .where(
          and(
            eq(coverAssignment.registerId, input.registerId),
            eq(coverAssignment.status, "confirmed"),
            eq(coverAssignment.tenantId, tenantId)
          )
        )
        .limit(1);

      if (existingCover) {
        throw new TRPCError({ code: "CONFLICT", message: "Cover already confirmed for this register entry" });
      }

      // ── Load teacher names ────────────────────────────────────────────────
      const [coverTeacher] = await db
        .select()
        .from(users)
        .where(eq(users.id, input.coverTeacherId))
        .limit(1);

      const [absentTeacher] = await db
        .select()
        .from(users)
        .where(eq(users.id, reg.assignedTeacherId))
        .limit(1);

      const [group] = await db
        .select()
        .from(classGroups)
        .where(eq(classGroups.id, reg.classGroupId))
        .limit(1);

      const coverName = coverTeacher?.displayName ?? coverTeacher?.name ?? "Unknown";
      const absentName = absentTeacher?.displayName ?? absentTeacher?.name ?? "Unknown";
      const className = group?.className ?? "Unknown class";
      const dateStr = String(reg.lessonDate);

      // ── Calculate cover duration from absent teacher's schedule ───────────
      const lessonDow = dayOfWeek(dateStr);
      const [slot] = await db
        .select()
        .from(teacherSchedule)
        .where(
          and(
            eq(teacherSchedule.userId, reg.assignedTeacherId),
            eq(teacherSchedule.dayOfWeek, lessonDow as "monday" | "tuesday" | "wednesday" | "thursday" | "friday"),
            eq(teacherSchedule.tenantId, tenantId)
          )
        )
        .limit(1);

      const durationMinutes = slot
        ? toMinutes(slot.endTime) - toMinutes(slot.startTime)
        : 60; // default 1 hour

      // ── Load tenant deadline setting ────────────────────────────────────────
      const [tenantRow] = await db
        .select({ coverResponseDeadlineMinutes: tenants.coverResponseDeadlineMinutes })
        .from(tenants)
        .where(eq(tenants.id, tenantId))
        .limit(1);
      const deadlineMinutes = tenantRow?.coverResponseDeadlineMinutes ?? 30;
      const deadlineAt = new Date(Date.now() + deadlineMinutes * 60 * 1000);

      // ── Insert cover_assignment ────────────────────────────────────────────
      const [coverInsert] = await db.insert(coverAssignment).values({
        registerId: input.registerId,
        coverTeacherId: input.coverTeacherId,
        confirmedByDirectorId: ctx.user.id,
        confirmedAt: new Date(),
        status: "confirmed",
        paybackScheduled: false,
        aiReasoning: input.aiReasoning,
        deadlineAt,
        tenantId,
      });

      const coverAssignmentId = (coverInsert as { insertId: number }).insertId;

      // ── Insert hour_adjustment for cover teacher ───────────────────────────
      const adjustmentReason =
        input.directorComment ??
        `Cover for ${absentName}'s class "${className}" on ${dateStr}. Extra teaching contact hours added.`;

      await db.insert(hourAdjustment).values({
        userId: input.coverTeacherId,
        adjustmentMinutes: durationMinutes,
        reason: adjustmentReason,
        adjustmentType: "extra_cover",
        relatedRegisterId: input.registerId,
        relatedCoverAssignmentId: coverAssignmentId,
        createdByUserId: ctx.user.id,
        tenantId,
      });

      // ── Notify cover teacher (requiresResponse = true) ────────────────────
      await db.insert(teacherNotification).values({
        userId: input.coverTeacherId,
        type: "cover_assigned",
        title: `Cover assignment: ${className} on ${dateStr}`,
        body: `You have been assigned to cover "${className}" on ${dateStr} (${durationMinutes} minutes) in the absence of ${absentName}. Please accept or decline this assignment.`,
        relatedRegisterId: input.registerId,
        relatedCoverAssignmentId: coverAssignmentId,
        isRead: false,
        requiresResponse: true,
        tenantId,
      });

      // ── Notify absent teacher (informational) ─────────────────────────────
      await db.insert(teacherNotification).values({
        userId: reg.assignedTeacherId,
        type: "cover_assigned",
        title: `Your class "${className}" has been covered`,
        body: `${coverName} has been assigned to cover your class "${className}" on ${dateStr}. Your teaching contact hours have been noted. A payback opportunity will be identified when your calendar allows.`,
        relatedRegisterId: input.registerId,
        relatedCoverAssignmentId: coverAssignmentId,
        isRead: false,
        requiresResponse: false,
        tenantId,
      });

      // Owner/director notification fallback (ensures director is alerted even when not logged in)
      try {
        await notifyOwner({
          title: `Cover Assigned: ${className} - ${dateStr}`,
          content:
            `Cover teacher: ${coverName}\n` +
            `Absent teacher: ${absentName}\n` +
            `Class: ${className}\n` +
            `Date: ${dateStr}\n` +
            `Duration: ${durationMinutes} min\n` +
            (input.directorComment ? `Director note: ${input.directorComment}\n` : "") +
            `Both teachers have been notified in-app. A payback opportunity scan will run automatically.`,
        });
      } catch {
        // Non-critical: owner notification failure should not block the cover assignment
      }

      return {
        coverAssignmentId,
        durationMinutes,
        coverName,
        absentName,
        className,
        dateStr,
      };
    }),

  /**
   * findPaybackOpportunity — AI scans the future timetable to find a session
   * where the originally absent teacher can cover for the cover teacher,
   * effectively "paying back" the extra hours.
   *
   * Skipped if the cover teacher is under their contracted hours.
   */
  findPaybackOpportunity: protectedProcedure
    .input(
      z.object({
        coverAssignmentId: z.number(),
      })
    )
    .query(async ({ ctx, input }) => {
      if (!isDirectorOrHos(ctx.user.role, ctx.user.position ?? "")) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const tenantId = ctx.user.tenantId;
      if (!tenantId) throw new TRPCError({ code: "BAD_REQUEST", message: "No tenant" });

      // ── Load cover assignment ──────────────────────────────────────────────
      const [cover] = await db
        .select()
        .from(coverAssignment)
        .where(and(eq(coverAssignment.id, input.coverAssignmentId), eq(coverAssignment.tenantId, tenantId)))
        .limit(1);

      if (!cover) throw new TRPCError({ code: "NOT_FOUND", message: "Cover assignment not found" });

      // ── Load register entry ────────────────────────────────────────────────
      const [reg] = await db
        .select()
        .from(classRegister)
        .where(eq(classRegister.id, cover.registerId))
        .limit(1);

      if (!reg) throw new TRPCError({ code: "NOT_FOUND", message: "Register entry not found" });

      // ── Check if cover teacher is under contracted hours ──────────────────
      const [coverTeacher] = await db
        .select()
        .from(users)
        .where(eq(users.id, cover.coverTeacherId))
        .limit(1);

      // Sum all hour adjustments for the cover teacher
      const adjustments = await db
        .select()
        .from(hourAdjustment)
        .where(and(eq(hourAdjustment.userId, cover.coverTeacherId), eq(hourAdjustment.tenantId, tenantId)));

      const netAdjustmentMinutes = adjustments.reduce((sum, a) => sum + a.adjustmentMinutes, 0);

      // Get scheduled minutes from timetable
      const schedule = await db
        .select()
        .from(teacherSchedule)
        .where(and(eq(teacherSchedule.userId, cover.coverTeacherId), eq(teacherSchedule.tenantId, tenantId)));

      const scheduledMinutes = schedule.reduce(
        (sum, s) => sum + (toMinutes(s.endTime) - toMinutes(s.startTime)),
        0
      );

      const totalContactMinutes = scheduledMinutes + netAdjustmentMinutes;
      const contractedMinutes = coverTeacher?.contractedWeeklyMinutes ?? null;

      // If under contracted hours, no payback needed
      if (contractedMinutes !== null && totalContactMinutes < contractedMinutes) {
        return {
          paybackAvailable: false,
          reason: "under_hours",
          message: `${coverTeacher?.displayName ?? coverTeacher?.name ?? "The cover teacher"} is currently under their contracted hours. No payback session is required.`,
        };
      }

      // ── Load both teachers' schedules to find a payback opportunity ────────
      const absentTeacherSchedule = await db
        .select()
        .from(teacherSchedule)
        .where(and(eq(teacherSchedule.userId, reg.assignedTeacherId), eq(teacherSchedule.tenantId, tenantId)));

      const coverTeacherSchedule = await db
        .select()
        .from(teacherSchedule)
        .where(and(eq(teacherSchedule.userId, cover.coverTeacherId), eq(teacherSchedule.tenantId, tenantId)));

      const [absentUser] = await db
        .select({ name: users.name, displayName: users.displayName })
        .from(users)
        .where(eq(users.id, reg.assignedTeacherId))
        .limit(1);

      const [coverUser] = await db
        .select({ name: users.name, displayName: users.displayName })
        .from(users)
        .where(eq(users.id, cover.coverTeacherId))
        .limit(1);

      // ── Ask AI to identify payback opportunity ─────────────────────────────
      const aiPrompt = `You are a school timetable coordinator. Find a payback opportunity.

Context:
- Cover teacher: ${coverUser?.displayName ?? coverUser?.name ?? "Unknown"} (covered a class and needs payback)
- Absent teacher: ${absentUser?.displayName ?? absentUser?.name ?? "Unknown"} (was absent, should cover a session for the cover teacher)

Cover teacher's schedule (sessions they teach):
${JSON.stringify(coverTeacherSchedule.map((s) => ({ day: s.dayOfWeek, slot: s.lessonSlot, start: s.startTime, end: s.endTime, subject: s.subject })), null, 2)}

Absent teacher's schedule (sessions they teach, showing when they are free):
${JSON.stringify(absentTeacherSchedule.map((s) => ({ day: s.dayOfWeek, slot: s.lessonSlot, start: s.startTime, end: s.endTime, subject: s.subject })), null, 2)}

Find a future session in the cover teacher's schedule where:
1. The absent teacher is free at that time (not teaching)
2. The absent teacher could reasonably cover the cover teacher's class (consider subject compatibility)

Return the best opportunity or null if none found.`;

      try {
        const aiResp = await invokeLLM({
          messages: [
            { role: "system", content: "You are a school timetable coordinator. Return valid JSON only." },
            { role: "user", content: aiPrompt },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "payback_opportunity",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  found: { type: "boolean" },
                  dayOfWeek: { type: "string" },
                  lessonSlot: { type: "string" },
                  startTime: { type: "string" },
                  endTime: { type: "string" },
                  subject: { type: "string" },
                  reasoning: { type: "string" },
                },
                required: ["found", "dayOfWeek", "lessonSlot", "startTime", "endTime", "subject", "reasoning"],
                additionalProperties: false,
              },
            },
          },
        });

        const result = JSON.parse(aiResp.choices[0].message.content as string) as {
          found: boolean;
          dayOfWeek: string;
          lessonSlot: string;
          startTime: string;
          endTime: string;
          subject: string;
          reasoning: string;
        };

        if (!result.found) {
          return {
            paybackAvailable: false,
            reason: "no_opportunity",
            message: result.reasoning,
          };
        }

        return {
          paybackAvailable: true,
          coverAssignmentId: input.coverAssignmentId,
          coverTeacherId: cover.coverTeacherId,
          absentTeacherId: reg.assignedTeacherId,
          coverTeacherName: coverUser?.displayName ?? coverUser?.name ?? "Unknown",
          absentTeacherName: absentUser?.displayName ?? absentUser?.name ?? "Unknown",
          dayOfWeek: result.dayOfWeek,
          lessonSlot: result.lessonSlot,
          startTime: result.startTime,
          endTime: result.endTime,
          subject: result.subject,
          reasoning: result.reasoning,
        };
      } catch {
        return {
          paybackAvailable: false,
          reason: "ai_error",
          message: "Unable to identify a payback opportunity at this time.",
        };
      }
    }),

  /**
   * schedulePayback — director confirms a payback session.
   * Creates a new cover_assignment (payback type) and hour_adjustment records
   * for both teachers, then notifies them.
   */
  schedulePayback: protectedProcedure
    .input(
      z.object({
        originalCoverAssignmentId: z.number(),
        dayOfWeek: z.string(),
        lessonSlot: z.string(),
        startTime: z.string(),
        endTime: z.string(),
        subject: z.string(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!isDirectorOrHos(ctx.user.role, ctx.user.position ?? "")) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const tenantId = ctx.user.tenantId;
      if (!tenantId) throw new TRPCError({ code: "BAD_REQUEST", message: "No tenant" });

      // ── Load original cover assignment ─────────────────────────────────────
      const [originalCover] = await db
        .select()
        .from(coverAssignment)
        .where(and(eq(coverAssignment.id, input.originalCoverAssignmentId), eq(coverAssignment.tenantId, tenantId)))
        .limit(1);

      if (!originalCover) throw new TRPCError({ code: "NOT_FOUND", message: "Cover assignment not found" });

      const [reg] = await db
        .select()
        .from(classRegister)
        .where(eq(classRegister.id, originalCover.registerId))
        .limit(1);

      if (!reg) throw new TRPCError({ code: "NOT_FOUND", message: "Register entry not found" });

      const durationMinutes = toMinutes(input.endTime) - toMinutes(input.startTime);

      // ── Load teacher names ────────────────────────────────────────────────
      const [coverTeacher] = await db
        .select()
        .from(users)
        .where(eq(users.id, originalCover.coverTeacherId))
        .limit(1);

      const [absentTeacher] = await db
        .select()
        .from(users)
        .where(eq(users.id, reg.assignedTeacherId))
        .limit(1);

      const coverName = coverTeacher?.displayName ?? coverTeacher?.name ?? "Unknown";
      const absentName = absentTeacher?.displayName ?? absentTeacher?.name ?? "Unknown";

      // ── Insert payback cover_assignment ────────────────────────────────────
      const [paybackInsert] = await db.insert(coverAssignment).values({
        registerId: originalCover.registerId,
        coverTeacherId: reg.assignedTeacherId, // absent teacher now covers
        confirmedByDirectorId: ctx.user.id,
        confirmedAt: new Date(),
        status: "confirmed",
        paybackScheduled: false,
        aiReasoning: `Payback session: ${absentName} covers ${input.subject} (${input.dayOfWeek} ${input.startTime}–${input.endTime}) for ${coverName}.`,
        tenantId,
      });

      const paybackId = (paybackInsert as { insertId: number }).insertId;

      // ── Mark original cover as having payback scheduled ───────────────────
      await db
        .update(coverAssignment)
        .set({ paybackScheduled: true, paybackSessionId: paybackId })
        .where(eq(coverAssignment.id, input.originalCoverAssignmentId));

      // ── Hour adjustment: deduct from cover teacher (payback) ───────────────
      await db.insert(hourAdjustment).values({
        userId: originalCover.coverTeacherId,
        adjustmentMinutes: -durationMinutes, // deduction
        reason: `Payback: ${absentName} will cover your ${input.subject} session (${input.dayOfWeek} ${input.startTime}–${input.endTime}). Teaching contact hours adjusted.`,
        adjustmentType: "payback",
        relatedCoverAssignmentId: paybackId,
        createdByUserId: ctx.user.id,
        tenantId,
      });

      // ── Hour adjustment: add to absent teacher (extra cover for payback) ───
      await db.insert(hourAdjustment).values({
        userId: reg.assignedTeacherId,
        adjustmentMinutes: durationMinutes,
        reason: `Payback cover: covering ${coverName}'s ${input.subject} session (${input.dayOfWeek} ${input.startTime}–${input.endTime}).`,
        adjustmentType: "extra_cover",
        relatedCoverAssignmentId: paybackId,
        createdByUserId: ctx.user.id,
        tenantId,
      });

      // ── Notify cover teacher ───────────────────────────────────────────────
      await db.insert(teacherNotification).values({
        userId: originalCover.coverTeacherId,
        type: "payback_scheduled",
        title: `Payback session scheduled: ${input.subject} on ${input.dayOfWeek}`,
        body: `A payback session has been arranged. ${absentName} will cover your "${input.subject}" class on ${input.dayOfWeek} (${input.startTime}–${input.endTime}). Your teaching contact hours have been adjusted accordingly. Please accept or decline.`,
        relatedCoverAssignmentId: paybackId,
        isRead: false,
        requiresResponse: true,
        tenantId,
      });

      // ── Notify absent teacher ──────────────────────────────────────────────
      await db.insert(teacherNotification).values({
        userId: reg.assignedTeacherId,
        type: "payback_scheduled",
        title: `Payback cover assigned: ${input.subject} on ${input.dayOfWeek}`,
        body: `You have been assigned to cover ${coverName}'s "${input.subject}" class on ${input.dayOfWeek} (${input.startTime}–${input.endTime}) as a payback for the cover they provided. Please accept or decline.`,
        relatedCoverAssignmentId: paybackId,
        isRead: false,
        requiresResponse: true,
        tenantId,
      });

      return { paybackId, durationMinutes, coverName, absentName };
    }),

  /**
   * respondToNotification — teacher accepts or declines a cover/payback notification.
   * Updates the notification record and notifies the director of the response.
   */
  respondToNotification: protectedProcedure
    .input(
      z.object({
        notificationId: z.number(),
        response: z.enum(["accepted", "declined"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const tenantId = ctx.user.tenantId;
      if (!tenantId) throw new TRPCError({ code: "BAD_REQUEST", message: "No tenant" });

      // ── Load notification ──────────────────────────────────────────────────
      const [notif] = await db
        .select()
        .from(teacherNotification)
        .where(
          and(
            eq(teacherNotification.id, input.notificationId),
            eq(teacherNotification.userId, ctx.user.id),
            eq(teacherNotification.tenantId, tenantId)
          )
        )
        .limit(1);

      if (!notif) throw new TRPCError({ code: "NOT_FOUND", message: "Notification not found" });
      if (!notif.requiresResponse) throw new TRPCError({ code: "BAD_REQUEST", message: "This notification does not require a response" });
      if (notif.response) throw new TRPCError({ code: "CONFLICT", message: "Already responded" });

      // ── Update notification ────────────────────────────────────────────────
      await db
        .update(teacherNotification)
        .set({
          response: input.response,
          respondedAt: new Date(),
          isRead: true,
        })
        .where(eq(teacherNotification.id, input.notificationId));

      // ── Notify directors of the response ──────────────────────────────────
      const teacherName = ctx.user.displayName ?? ctx.user.name ?? "Unknown teacher";
      const responseText = input.response === "accepted" ? "accepted" : "declined";

      const directors = await db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.tenantId, tenantId), eq(users.role, "director")));

      if (directors.length > 0) {
        await db.insert(teacherNotification).values(
          directors.map((d) => ({
            userId: d.id,
            type: "cover_response" as const,
            title: `${teacherName} has ${responseText} a cover assignment`,
            body: `${teacherName} has ${responseText} the cover/payback assignment: "${notif.title}".`,
            relatedRegisterId: notif.relatedRegisterId ?? undefined,
            relatedCoverAssignmentId: notif.relatedCoverAssignmentId ?? undefined,
            isRead: false,
            requiresResponse: false,
            tenantId,
          }))
        );
      }

      // Owner/director notification fallback for teacher response
      try {
        await notifyOwner({
          title: `Cover Response: ${teacherName} has ${responseText}`,
          content:
            `Teacher: ${teacherName}\n` +
            `Response: ${responseText.toUpperCase()}\n` +
            `Assignment: "${notif.title}"\n` +
            `The in-app notification has been updated for all directors.`,
        });
      } catch {
        // Non-critical: owner notification failure should not block the response
      }

      return { success: true, response: input.response };
    }),

  /**
   * listPendingCovers — director view of all pending cover assignments.
   */
  listPendingCovers: protectedProcedure
    .query(async ({ ctx }) => {
      if (!isDirectorOrHos(ctx.user.role, ctx.user.position ?? "")) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const tenantId = ctx.user.tenantId;
      if (!tenantId) throw new TRPCError({ code: "BAD_REQUEST", message: "No tenant" });

      // Get all absence registers without a confirmed cover
      const absences = await db
        .select()
        .from(classRegister)
        .where(
          and(
            eq(classRegister.tenantId, tenantId),
            eq(classRegister.isAbsence, true)
          )
        )
        .orderBy(desc(classRegister.markedAt));

      const enriched = await Promise.all(
        absences.map(async (reg) => {
          const [confirmedCover] = await db
            .select()
            .from(coverAssignment)
            .where(
              and(
                eq(coverAssignment.registerId, reg.id),
                eq(coverAssignment.status, "confirmed"),
                eq(coverAssignment.tenantId, tenantId)
              )
            )
            .limit(1);

          const [group] = await db
            .select({ className: classGroups.className })
            .from(classGroups)
            .where(eq(classGroups.id, reg.classGroupId))
            .limit(1);

          const [assigned] = await db
            .select({ name: users.name, displayName: users.displayName })
            .from(users)
            .where(eq(users.id, reg.assignedTeacherId))
            .limit(1);

          const [marker] = await db
            .select({ name: users.name, displayName: users.displayName })
            .from(users)
            .where(eq(users.id, reg.markedByTeacherId))
            .limit(1);

          return {
            ...reg,
            className: group?.className ?? "Unknown class",
            assignedName: assigned?.displayName ?? assigned?.name ?? "Unknown",
            markerName: marker?.displayName ?? marker?.name ?? "Unknown",
            hasCover: !!confirmedCover,
            coverAssignment: confirmedCover ?? null,
          };
        })
      );

      return enriched;
    }),

  /**
   * getHourAdjustments — returns the hour adjustment ledger for a teacher.
   * Used in the Director's Teacher Profiles → Hours tab.
   */
  getHourAdjustments: protectedProcedure
    .input(z.object({ userId: z.number() }))
    .query(async ({ ctx, input }) => {
      const isSelf = ctx.user.id === input.userId;
      const isAdmin = isDirectorOrHos(ctx.user.role, ctx.user.position ?? "");
      if (!isSelf && !isAdmin) throw new TRPCError({ code: "FORBIDDEN" });

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const tenantId = ctx.user.tenantId;
      if (!tenantId) throw new TRPCError({ code: "BAD_REQUEST", message: "No tenant" });

      const rows = await db
        .select()
        .from(hourAdjustment)
        .where(
          and(
            eq(hourAdjustment.userId, input.userId),
            eq(hourAdjustment.tenantId, tenantId)
          )
        )
        .orderBy(desc(hourAdjustment.createdAt));

      const netMinutes = rows.reduce((sum, r) => sum + r.adjustmentMinutes, 0);

      return { adjustments: rows, netMinutes };
    }),

  /**
   * getMyNotifications — returns all notifications for the current user.
   */
  getMyNotifications: protectedProcedure
    .input(z.object({ unreadOnly: z.boolean().optional() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const tenantId = ctx.user.tenantId;
      if (!tenantId) throw new TRPCError({ code: "BAD_REQUEST", message: "No tenant" });

      const conditions = [
        eq(teacherNotification.userId, ctx.user.id),
        eq(teacherNotification.tenantId, tenantId),
      ];
      if (input.unreadOnly) conditions.push(eq(teacherNotification.isRead, false));

      const rows = await db
        .select()
        .from(teacherNotification)
        .where(and(...conditions))
        .orderBy(desc(teacherNotification.createdAt))
        .limit(50);

      return rows;
    }),

  /**
   * markNotificationRead — marks a notification as read.
   */
  markNotificationRead: protectedProcedure
    .input(z.object({ notificationId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const tenantId = ctx.user.tenantId;
      if (!tenantId) throw new TRPCError({ code: "BAD_REQUEST", message: "No tenant" });

      await db
        .update(teacherNotification)
        .set({ isRead: true })
        .where(
          and(
            eq(teacherNotification.id, input.notificationId),
            eq(teacherNotification.userId, ctx.user.id),
            eq(teacherNotification.tenantId, tenantId)
          )
        );

      return { success: true };
    }),

  /**
   * markAllNotificationsRead — marks all notifications for the current user as read.
   */
  markAllNotificationsRead: protectedProcedure
    .mutation(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const tenantId = ctx.user.tenantId;
      if (!tenantId) throw new TRPCError({ code: "BAD_REQUEST", message: "No tenant" });

      await db
        .update(teacherNotification)
        .set({ isRead: true })
        .where(
          and(
            eq(teacherNotification.userId, ctx.user.id),
            eq(teacherNotification.tenantId, tenantId)
          )
        );

      return { success: true };
    }),

  // ─── Deadline / Escalation (Follow-up 3) ──────────────────────────────────────

  /**
   * checkExpiredDeadlines — scans all pending cover assignments whose deadlineAt
   * has passed without a teacher response and escalates them:
   *   1. Marks escalationSentAt on the cover_assignment row.
   *   2. Sends a director notification listing the next AI candidates.
   *   3. Creates a new teacher_notification for the director to re-confirm.
   *
   * Called by the Director Cover Requests page on mount (polling every 5 min).
   */
  checkExpiredDeadlines: protectedProcedure.mutation(async ({ ctx }) => {
    if (!isDirectorOrHos(ctx.user.role, ctx.user.position ?? "")) {
      throw new TRPCError({ code: "FORBIDDEN" });
    }

    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

    const tenantId = ctx.user.tenantId;
    if (!tenantId) throw new TRPCError({ code: "BAD_REQUEST", message: "No tenant" });

    const now = new Date();

    // Find confirmed cover assignments where:
    //   - deadlineAt is set and has passed
    //   - escalationSentAt is NULL (not yet escalated)
    //   - The cover teacher has NOT yet responded (no accepted/declined notification)
    const expiredAssignments = await db
      .select()
      .from(coverAssignment)
      .where(
        and(
          eq(coverAssignment.tenantId, tenantId),
          eq(coverAssignment.status, "confirmed"),
          isNotNull(coverAssignment.deadlineAt),
          isNull(coverAssignment.escalationSentAt),
          lt(coverAssignment.deadlineAt, now)
        )
      );

    if (expiredAssignments.length === 0) return { escalated: 0 };

    let escalated = 0;
    for (const ca of expiredAssignments) {
      // Check if teacher has already responded via notification
      const [response] = await db
        .select()
        .from(teacherNotification)
        .where(
          and(
            eq(teacherNotification.relatedCoverAssignmentId, ca.id),
            eq(teacherNotification.userId, ca.coverTeacherId),
            isNotNull(teacherNotification.response)
          )
        )
        .limit(1);

      if (response) {
        // Teacher already responded — mark escalation as not needed
        await db
          .update(coverAssignment)
          .set({ escalationSentAt: now })
          .where(eq(coverAssignment.id, ca.id));
        continue;
      }

      // Load register + teacher info for the escalation message
      const [reg] = await db.select().from(classRegister).where(eq(classRegister.id, ca.registerId)).limit(1);
      const [coverTeacher] = await db.select().from(users).where(eq(users.id, ca.coverTeacherId)).limit(1);
      const [group] = reg ? await db.select().from(classGroups).where(eq(classGroups.id, reg.classGroupId)).limit(1) : [null];

      const coverName = coverTeacher?.displayName ?? coverTeacher?.name ?? "Unknown";
      const className = group?.className ?? "Unknown class";
      const dateStr = reg ? String(reg.lessonDate) : "Unknown date";

      // Mark escalation sent
      await db
        .update(coverAssignment)
        .set({ escalationSentAt: now })
        .where(eq(coverAssignment.id, ca.id));

      // Notify director via in-app notification
      await db.insert(teacherNotification).values({
        userId: ctx.user.id,
        type: "general",
        title: `⚠️ Cover response overdue: ${className} (${dateStr})`,
        body: `${coverName} has not responded to the cover assignment for "${className}" on ${dateStr}. The deadline has passed. Please re-confirm or select a different cover teacher.`,
        relatedRegisterId: ca.registerId,
        relatedCoverAssignmentId: ca.id,
        isRead: false,
        requiresResponse: false,
        tenantId,
      });

      // Owner notification fallback
      try {
        await notifyOwner({
          title: `⚠️ Cover Deadline Expired: ${className} (${dateStr})`,
          content:
            `Cover teacher ${coverName} has not responded within the deadline.\n` +
            `Class: ${className} on ${dateStr}.\n` +
            `Please log in to SEBA Platform and re-confirm or select a different cover teacher.`,
        });
      } catch { /* non-critical */ }

      escalated++;
    }

    return { escalated };
  }),

  /**
   * getCoverDeadlineSetting — returns the tenant's coverResponseDeadlineMinutes.
   */
  getCoverDeadlineSetting: protectedProcedure.query(async ({ ctx }) => {
    if (!isDirectorOrHos(ctx.user.role, ctx.user.position ?? "")) {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const tenantId = ctx.user.tenantId;
    if (!tenantId) throw new TRPCError({ code: "BAD_REQUEST", message: "No tenant" });
    const [tenantRow] = await db
      .select({ coverResponseDeadlineMinutes: tenants.coverResponseDeadlineMinutes })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);
    return { deadlineMinutes: tenantRow?.coverResponseDeadlineMinutes ?? 30 };
  }),

  /**
   * setCoverDeadlineSetting — director updates the response deadline (5–120 min).
   */
  setCoverDeadlineSetting: protectedProcedure
    .input(z.object({ deadlineMinutes: z.number().int().min(5).max(120) }))
    .mutation(async ({ ctx, input }) => {
      if (!isDirectorOrHos(ctx.user.role, ctx.user.position ?? "")) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const tenantId = ctx.user.tenantId;
      if (!tenantId) throw new TRPCError({ code: "BAD_REQUEST", message: "No tenant" });
      await db
        .update(tenants)
        .set({ coverResponseDeadlineMinutes: input.deadlineMinutes })
        .where(eq(tenants.id, tenantId));
      return { success: true, deadlineMinutes: input.deadlineMinutes };
    }),
});
