/**
 * register router
 * Handles class register marking, attendance auto-presence, and in-absence-of logging.
 *
 * Flow:
 *  1. Teacher marks register for a class group + date.
 *  2. The marking teacher is automatically recorded as present (teacherAttendance upsert).
 *  3. If markedBy ≠ assignedTeacher → isAbsence = true, director notified via teacher_notification.
 *  4. Director can view the absence log and trigger cover assignment from the cover router.
 */
import { z } from "zod";
import { and, desc, eq, gte, lte } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import {
  classRegister,
  teacherAttendance,
  teacherNotification,
  classGroups,
  users,
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

/** Format a Date as YYYY-MM-DD string (UTC) */
function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// ─── router ───────────────────────────────────────────────────────────────────
export const registerRouter = router({
  /**
   * markRegister — called by any teacher to mark the register for a class.
   *
   * - Auto-marks the marking teacher as "present" for the day.
   * - If the marking teacher is not the assigned teacher for the group,
   *   sets isAbsence=true and notifies all directors in the tenant.
   * - Idempotent: if a register already exists for this group+date, returns it.
   */
  markRegister: protectedProcedure
    .input(
      z.object({
        classGroupId: z.number(),
        lessonDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        absenceReason: z.enum(["absent", "sick", "holiday", "other"]).optional(),
        notes: z.string().max(1024).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const tenantId = ctx.user.tenantId;
      if (!tenantId) throw new TRPCError({ code: "BAD_REQUEST", message: "No tenant" });

      const markerId = ctx.user.id;

      // ── 1. Fetch the class group to find the assigned teacher ──────────────
      const [group] = await db
        .select()
        .from(classGroups)
        .where(eq(classGroups.id, input.classGroupId))
        .limit(1);

      if (!group) throw new TRPCError({ code: "NOT_FOUND", message: "Class group not found" });

      // The assigned teacher is the group owner (userId) or formTutor if set
      const assignedTeacherId = group.formTutorId ?? group.userId;

      // ── 2. Check for existing register entry ──────────────────────────────
      const [existing] = await db
        .select()
        .from(classRegister)
        .where(
          and(
            eq(classRegister.classGroupId, input.classGroupId),
            eq(classRegister.lessonDate, input.lessonDate as unknown as Date),
            eq(classRegister.tenantId, tenantId)
          )
        )
        .limit(1);

      if (existing) {
        return { register: existing, alreadyMarked: true };
      }

      // ── 3. Determine if this is an in-absence-of situation ────────────────
      const isAbsence = markerId !== assignedTeacherId;

      // ── 4. Insert the register row ────────────────────────────────────────
      const [insertResult] = await db.insert(classRegister).values({
        classGroupId: input.classGroupId,
        lessonDate: input.lessonDate as unknown as Date,
        assignedTeacherId,
        markedByTeacherId: markerId,
        markedAt: new Date(),
        isAbsence,
        absenceReason: isAbsence ? (input.absenceReason ?? "absent") : undefined,
        notes: input.notes,
        tenantId,
      });

      const registerId = (insertResult as { insertId: number }).insertId;

      // ── 5. Auto-mark the marking teacher as present ───────────────────────
      await db
        .insert(teacherAttendance)
        .values({
          userId: markerId,
          attendanceDate: input.lessonDate as unknown as Date,
          status: "present",
          checkInAt: new Date(),
          tenantId,
        })
        .onDuplicateKeyUpdate({ set: { status: "present", checkInAt: new Date() } })
        .catch(() => {
          // Ignore duplicate key — teacher already checked in today
        });

      // ── 6. If absence: notify all directors in the tenant ─────────────────
      if (isAbsence) {
        // Fetch the names for the notification body
        const [markerUser] = await db
          .select({ name: users.name, displayName: users.displayName })
          .from(users)
          .where(eq(users.id, markerId))
          .limit(1);

        const [assignedUser] = await db
          .select({ name: users.name, displayName: users.displayName })
          .from(users)
          .where(eq(users.id, assignedTeacherId))
          .limit(1);

        const markerName = markerUser?.displayName ?? markerUser?.name ?? "Unknown teacher";
        const assignedName = assignedUser?.displayName ?? assignedUser?.name ?? "Unknown teacher";
        const dateStr = input.lessonDate;
        const timeStr = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

        // Find all directors in the tenant
        const directors = await db
          .select({ id: users.id })
          .from(users)
          .where(
            and(
              eq(users.tenantId, tenantId),
              eq(users.role, "director")
            )
          );

        if (directors.length > 0) {
          await db.insert(teacherNotification).values(
            directors.map((d) => ({
              userId: d.id,
              type: "register_absence" as const,
              title: `Register marked in absence of ${assignedName}`,
              body: `${markerName} marked the register for "${group.className}" on ${dateStr} at ${timeStr} in the absence of ${assignedName}. Please review and assign cover if required.`,
              relatedRegisterId: registerId,
              isRead: false,
              requiresResponse: false,
              tenantId,
            }))
          );
        }
      }

      // Return the newly created register
      const [newRegister] = await db
        .select()
        .from(classRegister)
        .where(eq(classRegister.id, registerId))
        .limit(1);

      return { register: newRegister, alreadyMarked: false };
    }),

  /**
   * getRegisterStatus — returns the register entry for a specific class + date.
   * Returns null if no register has been marked yet.
   */
  getRegisterStatus: protectedProcedure
    .input(
      z.object({
        classGroupId: z.number(),
        lessonDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const tenantId = ctx.user.tenantId;
      if (!tenantId) throw new TRPCError({ code: "BAD_REQUEST", message: "No tenant" });

      const [entry] = await db
        .select()
        .from(classRegister)
        .where(
          and(
            eq(classRegister.classGroupId, input.classGroupId),
            eq(classRegister.lessonDate, input.lessonDate as unknown as Date),
            eq(classRegister.tenantId, tenantId)
          )
        )
        .limit(1);

      if (!entry) return null;

      // Enrich with teacher names
      const [markerUser] = await db
        .select({ id: users.id, name: users.name, displayName: users.displayName })
        .from(users)
        .where(eq(users.id, entry.markedByTeacherId))
        .limit(1);

      const [assignedUser] = await db
        .select({ id: users.id, name: users.name, displayName: users.displayName })
        .from(users)
        .where(eq(users.id, entry.assignedTeacherId))
        .limit(1);

      return {
        ...entry,
        markerName: markerUser?.displayName ?? markerUser?.name ?? "Unknown",
        assignedName: assignedUser?.displayName ?? assignedUser?.name ?? "Unknown",
      };
    }),

  /**
   * listRegisters — director/HoS view of all register entries, optionally
   * filtered to show only absence events.
   */
  listRegisters: protectedProcedure
    .input(
      z.object({
        absenceOnly: z.boolean().optional(),
        fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        limit: z.number().min(1).max(200).default(50),
        offset: z.number().min(0).default(0),
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

      const conditions = [eq(classRegister.tenantId, tenantId)];
      if (input.absenceOnly) conditions.push(eq(classRegister.isAbsence, true));
      if (input.fromDate) conditions.push(gte(classRegister.lessonDate, input.fromDate as unknown as Date));
      if (input.toDate) conditions.push(lte(classRegister.lessonDate, input.toDate as unknown as Date));

      const rows = await db
        .select()
        .from(classRegister)
        .where(and(...conditions))
        .orderBy(desc(classRegister.markedAt))
        .limit(input.limit)
        .offset(input.offset);

      // Enrich with names and group names
      const enriched = await Promise.all(
        rows.map(async (row) => {
          const [marker] = await db
            .select({ name: users.name, displayName: users.displayName })
            .from(users)
            .where(eq(users.id, row.markedByTeacherId))
            .limit(1);

          const [assigned] = await db
            .select({ name: users.name, displayName: users.displayName })
            .from(users)
            .where(eq(users.id, row.assignedTeacherId))
            .limit(1);

          const [group] = await db
            .select({ className: classGroups.className })
            .from(classGroups)
            .where(eq(classGroups.id, row.classGroupId))
            .limit(1);

          return {
            ...row,
            markerName: marker?.displayName ?? marker?.name ?? "Unknown",
            assignedName: assigned?.displayName ?? assigned?.name ?? "Unknown",
            className: group?.className ?? "Unknown class",
          };
        })
      );

      return enriched;
    }),

  /**
   * getAbsenceLog — returns all absence register entries for the director's
   * overview panel, with date/time stamps.
   */
  getAbsenceLog: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(30),
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

      const rows = await db
        .select()
        .from(classRegister)
        .where(
          and(
            eq(classRegister.tenantId, tenantId),
            eq(classRegister.isAbsence, true)
          )
        )
        .orderBy(desc(classRegister.markedAt))
        .limit(input.limit);

      const enriched = await Promise.all(
        rows.map(async (row) => {
          const [marker] = await db
            .select({ name: users.name, displayName: users.displayName })
            .from(users)
            .where(eq(users.id, row.markedByTeacherId))
            .limit(1);

          const [assigned] = await db
            .select({ name: users.name, displayName: users.displayName })
            .from(users)
            .where(eq(users.id, row.assignedTeacherId))
            .limit(1);

          const [group] = await db
            .select({ className: classGroups.className })
            .from(classGroups)
            .where(eq(classGroups.id, row.classGroupId))
            .limit(1);

          return {
            ...row,
            markerName: marker?.displayName ?? marker?.name ?? "Unknown",
            assignedName: assigned?.displayName ?? assigned?.name ?? "Unknown",
            className: group?.className ?? "Unknown class",
          };
        })
      );

      return enriched;
    }),
});
