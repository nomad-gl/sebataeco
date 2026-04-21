/**
 * assignmentRequests router
 *
 * Implements the Head of Study → Director approval workflow for user-to-school
 * assignment requests.
 *
 * Procedures:
 *  hos.createRequest     — HoS (or admin) submits a pending request
 *  hos.listMyRequests    — HoS views their own requests with current status
 *  director.listPending  — Director views pending requests for their school
 *  director.approve      — Director approves → user is assigned to the school
 *  director.reject       — Director rejects with optional reason
 *  admin.listAll         — Admin views all requests cross-tenant (paginated)
 */
import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { assignmentRequests, users } from "../../drizzle/schema";
import { getDb } from "../db";
import { notifyOwner } from "../_core/notification";
import { adminProcedure, protectedProcedure, router } from "../_core/trpc";

// ── Shared guard: caller must be head_of_study or admin ──────────────────────
const hosOrAdminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (ctx.user.role !== "head_of_study" && ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Head of Study access required." });
  }
  return next({ ctx });
});

// ── Shared guard: caller must be director or admin ───────────────────────────
const directorOrAdminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (ctx.user.role !== "director" && ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Director access required." });
  }
  return next({ ctx });
});

export const assignmentRequestsRouter = router({
  // ── Head of Study procedures ───────────────────────────────────────────────

  /**
   * Submit a new assignment request for an unassigned user.
   * The target user must currently have no tenantId.
   */
  createRequest: hosOrAdminProcedure
    .input(z.object({
      targetUserId: z.number().int().positive(),
      tenantId: z.number().int().positive(),
      requestNote: z.string().max(512).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      // Verify target user exists and is unassigned
      const [target] = await db
        .select({ id: users.id, name: users.name, email: users.email, tenantId: users.tenantId })
        .from(users)
        .where(eq(users.id, input.targetUserId));
      if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "User not found." });
      if (target.tenantId !== null) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "User is already assigned to a school." });
      }

      // Check for an existing pending request for this user
      const [existing] = await db
        .select({ id: assignmentRequests.id })
        .from(assignmentRequests)
        .where(
          and(
            eq(assignmentRequests.targetUserId, input.targetUserId),
            eq(assignmentRequests.status, "pending"),
          ),
        );
      if (existing) {
        throw new TRPCError({ code: "CONFLICT", message: "A pending request already exists for this user." });
      }

      const [result] = await db.insert(assignmentRequests).values({
        requestedByUserId: ctx.user.id,
        targetUserId: input.targetUserId,
        tenantId: input.tenantId,
        status: "pending",
        requestNote: input.requestNote ?? null,
      });
      const newId = (result as unknown as { insertId: number }).insertId;

      // Notify owner (fire-and-forget)
      notifyOwner({
        title: "New Assignment Request",
        content: `${ctx.user.name ?? ctx.user.email ?? "A Head of Study"} has requested to assign user "${target.name ?? target.email ?? `#${target.id}`}" to school #${input.tenantId}. Review in the Director Approvals panel.`,
      }).catch(() => {});

      return { id: newId };
    }),

  /**
   * List all requests submitted by the calling HoS (or all requests for admin).
   */
  listMyRequests: hosOrAdminProcedure
    .query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return [];

      const requestedBy = users;
      const targetUser = { ...users } as typeof users;

      const rows = await db
        .select({
          id: assignmentRequests.id,
          status: assignmentRequests.status,
          requestNote: assignmentRequests.requestNote,
          rejectionReason: assignmentRequests.rejectionReason,
          tenantId: assignmentRequests.tenantId,
          targetUserId: assignmentRequests.targetUserId,
          createdAt: assignmentRequests.createdAt,
          reviewedAt: assignmentRequests.reviewedAt,
        })
        .from(assignmentRequests)
        .where(
          ctx.user.role === "admin"
            ? undefined
            : eq(assignmentRequests.requestedByUserId, ctx.user.id),
        )
        .orderBy(desc(assignmentRequests.createdAt));

      // Enrich with target user name/email
      if (rows.length === 0) return [];
      const targetIds = Array.from(new Set(rows.map(r => r.targetUserId)));
      const targetUsers = await db
        .select({ id: users.id, name: users.name, email: users.email })
        .from(users)
        .where(inArray(users.id, targetIds));
      const userMap = Object.fromEntries(targetUsers.map(u => [u.id, u]));

      return rows.map(r => ({
        ...r,
        targetUserName: userMap[r.targetUserId]?.name ?? null,
        targetUserEmail: userMap[r.targetUserId]?.email ?? null,
      }));
    }),

  // ── Director procedures ────────────────────────────────────────────────────

  /**
   * List pending requests for the director's own school.
   * Admins see all pending requests.
   */
  listPending: directorOrAdminProcedure
    .query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return [];

      const whereClause = ctx.user.role === "admin"
        ? eq(assignmentRequests.status, "pending")
        : and(
            eq(assignmentRequests.status, "pending"),
            eq(assignmentRequests.tenantId, ctx.user.tenantId!),
          );

      const rows = await db
        .select({
          id: assignmentRequests.id,
          requestedByUserId: assignmentRequests.requestedByUserId,
          targetUserId: assignmentRequests.targetUserId,
          tenantId: assignmentRequests.tenantId,
          requestNote: assignmentRequests.requestNote,
          createdAt: assignmentRequests.createdAt,
        })
        .from(assignmentRequests)
        .where(whereClause)
        .orderBy(desc(assignmentRequests.createdAt));

      if (rows.length === 0) return [];

      // Enrich with user names
      const allUserIds = Array.from(
        new Set([
          ...rows.map(r => r.requestedByUserId),
          ...rows.map(r => r.targetUserId),
        ]),
      );
      const enrichedUsers = await db
        .select({ id: users.id, name: users.name, email: users.email })
        .from(users)
        .where(inArray(users.id, allUserIds));
      const userMap = Object.fromEntries(enrichedUsers.map(u => [u.id, u]));

      return rows.map(r => ({
        ...r,
        requestedByName: userMap[r.requestedByUserId]?.name ?? null,
        requestedByEmail: userMap[r.requestedByUserId]?.email ?? null,
        targetUserName: userMap[r.targetUserId]?.name ?? null,
        targetUserEmail: userMap[r.targetUserId]?.email ?? null,
      }));
    }),

  /**
   * Count of pending requests for the director's school (used for badge).
   */
  pendingCount: directorOrAdminProcedure
    .query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return { count: 0 };
      const { count: countFn } = await import("drizzle-orm");
      const whereClause = ctx.user.role === "admin"
        ? eq(assignmentRequests.status, "pending")
        : and(
            eq(assignmentRequests.status, "pending"),
            eq(assignmentRequests.tenantId, ctx.user.tenantId!),
          );
      const [row] = await db
        .select({ count: countFn() })
        .from(assignmentRequests)
        .where(whereClause);
      return { count: Number(row?.count ?? 0) };
    }),

  /**
   * Approve a pending request: update status and assign the user to the school.
   */
  approve: directorOrAdminProcedure
    .input(z.object({ requestId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const [req] = await db
        .select()
        .from(assignmentRequests)
        .where(eq(assignmentRequests.id, input.requestId));
      if (!req) throw new TRPCError({ code: "NOT_FOUND", message: "Request not found." });
      if (req.status !== "pending") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Request is no longer pending." });
      }
      // Directors can only approve requests for their own school
      if (ctx.user.role === "director" && req.tenantId !== ctx.user.tenantId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "This request belongs to a different school." });
      }

      // Assign user to school
      await db
        .update(users)
        .set({ tenantId: req.tenantId, updatedAt: new Date() })
        .where(eq(users.id, req.targetUserId));

      // Mark request approved
      await db
        .update(assignmentRequests)
        .set({ status: "approved", reviewedByUserId: ctx.user.id, reviewedAt: new Date() })
        .where(eq(assignmentRequests.id, input.requestId));

      // Notify owner (fire-and-forget)
      notifyOwner({
        title: "Assignment Request Approved",
        content: `${ctx.user.name ?? "A Director"} approved the assignment of user #${req.targetUserId} to school #${req.tenantId}.`,
      }).catch(() => {});

      return { success: true };
    }),

  /**
   * Reject a pending request with an optional reason.
   */
  reject: directorOrAdminProcedure
    .input(z.object({
      requestId: z.number().int().positive(),
      reason: z.string().max(512).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const [req] = await db
        .select()
        .from(assignmentRequests)
        .where(eq(assignmentRequests.id, input.requestId));
      if (!req) throw new TRPCError({ code: "NOT_FOUND", message: "Request not found." });
      if (req.status !== "pending") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Request is no longer pending." });
      }
      if (ctx.user.role === "director" && req.tenantId !== ctx.user.tenantId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "This request belongs to a different school." });
      }

      await db
        .update(assignmentRequests)
        .set({
          status: "rejected",
          rejectionReason: input.reason ?? null,
          reviewedByUserId: ctx.user.id,
          reviewedAt: new Date(),
        })
        .where(eq(assignmentRequests.id, input.requestId));

      // Notify owner (fire-and-forget)
      notifyOwner({
        title: "Assignment Request Rejected",
        content: `${ctx.user.name ?? "A Director"} rejected the assignment request for user #${req.targetUserId}${input.reason ? `: "${input.reason}"` : "."}`,
      }).catch(() => {});

      return { success: true };
    }),

  /**
   * Admin: list ALL requests across all tenants with pagination.
   */
  listAll: adminProcedure
    .input(z.object({
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(100).default(25),
      status: z.enum(["pending", "approved", "rejected", "all"]).default("all"),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { rows: [], total: 0 };
      const { count: countFn } = await import("drizzle-orm");
      const offset = (input.page - 1) * input.pageSize;

      const whereClause = input.status === "all"
        ? undefined
        : eq(assignmentRequests.status, input.status as "pending" | "approved" | "rejected");

      const [{ total }] = await db
        .select({ total: countFn() })
        .from(assignmentRequests)
        .where(whereClause);

      const rows = await db
        .select()
        .from(assignmentRequests)
        .where(whereClause)
        .orderBy(desc(assignmentRequests.createdAt))
        .limit(input.pageSize)
        .offset(offset);

      return { rows, total: Number(total) };
    }),
});
