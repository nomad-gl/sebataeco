/**
 * tenants.ts — SEBA super-admin procedures for cross-tenant management.
 *
 * All procedures require role === 'admin' (SEBA super-admins only).
 * Regular directors/teachers do not have access to these endpoints.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, desc, count, and, like, isNull } from "drizzle-orm";
import { getDb } from "../db";
import { adminProcedure, publicProcedure, router } from "../_core/trpc";
import {
  tenants,
  users,
  territories,
  territorialDirectorTerritories,
  roleChangeAudit,
  directorInvites,
  teacherInvites,
} from "../../drizzle/schema";
import bcrypt from "bcryptjs";
import crypto from "crypto";

// ─── Audit helper ────────────────────────────────────────────────────────────

async function writeAudit(params: {
  actingUserId: number;
  targetUserId: number;
  oldRole: string | null;
  newRole: string;
  action: string;
  reason?: string;
  territoryId?: number;
}) {
  const db = await getDb();
  if (!db) return; // best-effort — never block the main operation
  try {
    await db.insert(roleChangeAudit).values({
      actingUserId: params.actingUserId,
      targetUserId: params.targetUserId,
      oldRole: params.oldRole,
      newRole: params.newRole,
      action: params.action,
      reason: params.reason ?? null,
      territoryId: params.territoryId ?? null,
    });
  } catch {
    // Audit failure must never surface to the client
  }
}

// ─── Router ──────────────────────────────────────────────────────────────────

export const tenantsRouter = router({
  /**
   * List all tenants with their owner info and member count.
   * SEBA admin only.
   */
  list: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

    const allTenants = await db
      .select({
        id: tenants.id,
        name: tenants.name,
        ownerUserId: tenants.ownerUserId,
        territoryId: tenants.territoryId,
        createdAt: tenants.createdAt,
        updatedAt: tenants.updatedAt,
      })
      .from(tenants)
      .orderBy(desc(tenants.createdAt));

    const allUsers = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        tenantId: users.tenantId,
      })
      .from(users);

    // Fetch all territories for name lookup
    const allTerritories = await db
      .select({ id: territories.id, name: territories.name })
      .from(territories);
    const territoryNameMap = Object.fromEntries(allTerritories.map(t => [t.id, t.name]));

    const memberCountMap: Record<number, number> = {};
    const ownerMap: Record<number, { name: string | null; email: string | null }> = {};

    for (const u of allUsers) {
      if (u.tenantId !== null && u.tenantId !== undefined) {
        memberCountMap[u.tenantId] = (memberCountMap[u.tenantId] ?? 0) + 1;
      }
    }

    for (const t of allTenants) {
      const owner = allUsers.find(u => u.id === t.ownerUserId);
      ownerMap[t.id] = { name: owner?.name ?? null, email: owner?.email ?? null };
    }

    return allTenants.map(t => ({
      ...t,
      memberCount: memberCountMap[t.id] ?? 0,
      ownerName: ownerMap[t.id]?.name ?? null,
      ownerEmail: ownerMap[t.id]?.email ?? null,
      territoryName: t.territoryId ? (territoryNameMap[t.territoryId] ?? null) : null,
    }));
  }),

  /**
   * Get a single tenant with its full member list.
   * SEBA admin only.
   */
  getById: adminProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const [tenant] = await db
        .select()
        .from(tenants)
        .where(eq(tenants.id, input.id))
        .limit(1);

      if (!tenant) throw new TRPCError({ code: "NOT_FOUND", message: "Tenant not found" });

      const members = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          role: users.role,
          position: users.position,
          lastSignedIn: users.lastSignedIn,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(eq(users.tenantId, input.id))
        .orderBy(desc(users.lastSignedIn));

      return { ...tenant, members };
    }),

  /**
   * Create a new tenant.
   * SEBA admin only.
   */
  create: adminProcedure
    .input(z.object({
      name: z.string().min(1).max(255),
      ownerUserId: z.number().int().positive(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const [owner] = await db
        .select({ id: users.id, name: users.name })
        .from(users)
        .where(eq(users.id, input.ownerUserId))
        .limit(1);

      if (!owner) throw new TRPCError({ code: "NOT_FOUND", message: "Owner user not found" });

      const result = await db.insert(tenants).values({
        name: input.name,
        ownerUserId: input.ownerUserId,
      });

      const newTenantId = (result as unknown as [{ insertId: number }])[0].insertId;

      await db
        .update(users)
        .set({ tenantId: newTenantId })
        .where(eq(users.id, input.ownerUserId));

      return { id: newTenantId, name: input.name };
    }),

  /**
   * Create a new tenant AND a new owner user in one atomic step.
   * The new user is created with role='user', position='director', and is
   * immediately assigned as the tenant owner.
   * SEBA admin only.
   */
  createWithOwner: adminProcedure
    .input(
      z.object({
        tenantName: z.string().min(1).max(255),
        ownerName: z.string().min(2).max(255),
        ownerEmail: z.string().email(),
        ownerPassword: z.string().min(8).max(128),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      // Guard: email must be unique
      const [existing] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, input.ownerEmail))
        .limit(1);
      if (existing)
        throw new TRPCError({
          code: "CONFLICT",
          message: "An account with this email already exists.",
        });

      const passwordHash = await bcrypt.hash(input.ownerPassword, 12);
      const openId = `local_director_${crypto.randomBytes(16).toString("hex")}`;

      // 1. Create the owner user (no tenantId yet)
      const [userInsert] = await db.insert(users).values({
        name: input.ownerName,
        displayName: input.ownerName,
        email: input.ownerEmail,
        openId,
        passwordHash,
        loginMethod: "local",
        role: "user",
        position: "director",
        mustChangePassword: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      } as any);
      const newUserId = (userInsert as any).insertId as number;

      // 2. Create the tenant with the new user as owner
      const [tenantInsert] = await db.insert(tenants).values({
        name: input.tenantName,
        ownerUserId: newUserId,
      } as any);
      const newTenantId = (tenantInsert as any).insertId as number;

      // 3. Assign the user to the tenant
      await db
        .update(users)
        .set({ tenantId: newTenantId })
        .where(eq(users.id, newUserId));

      // 4. Write audit entry
      await writeAudit({
        actingUserId: ctx.user.id,
        targetUserId: newUserId,
        oldRole: null,
        newRole: "director",
        action: "grant",
        reason: `Created as owner of new tenant: ${input.tenantName}`,
      });

      return {
        tenantId: newTenantId,
        tenantName: input.tenantName,
        userId: newUserId,
        ownerName: input.ownerName,
        ownerEmail: input.ownerEmail,
      };
    }),

  /**
   * Update a tenant's name.
   * SEBA admin only.
   */
  updateName: adminProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).max(255),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      await db
        .update(tenants)
        .set({ name: input.name })
        .where(eq(tenants.id, input.id));

      return { success: true };
    }),

  /**
   * Assign a user to a tenant (or remove from tenant by passing null).
   * SEBA admin only.
   */
  assignUser: adminProcedure
    .input(z.object({
      userId: z.number().int().positive(),
      tenantId: z.number().int().positive().nullable(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      await db
        .update(users)
        .set({ tenantId: input.tenantId })
        .where(eq(users.id, input.userId));

      return { success: true };
    }),

  /**
   * List all users not yet assigned to any tenant.
   * SEBA admin only — useful for onboarding new directors.
   */
  listUnassignedUsers: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

    const rows = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        position: users.position,
        lastSignedIn: users.lastSignedIn,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(isNull(users.tenantId))
      .orderBy(desc(users.lastSignedIn));

    return rows;
  }),

  /**
   * Delete a tenant (does NOT delete its users — they become unassigned).
   * SEBA admin only.
   */
  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      await db
        .update(users)
        .set({ tenantId: null })
        .where(eq(users.tenantId, input.id));

      await db.delete(tenants).where(eq(tenants.id, input.id));

      return { success: true };
    }),

  // ─── Territorial Director Management ────────────────────────────────────────

  /**
   * List all territories.
   * SEBA admin only.
   */
  listTerritories: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    return db.select().from(territories).orderBy(territories.name);
  }),

  /**
   * List all users with role = 'territorial_director', with their assigned territories.
   * SEBA admin only.
   */
  listTerritorialDirectors: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

    const tds = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        lastSignedIn: users.lastSignedIn,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.role, "territorial_director"))
      .orderBy(users.name);

    const allAssignments = await db
      .select({
        userId: territorialDirectorTerritories.userId,
        territoryId: territorialDirectorTerritories.territoryId,
        id: territorialDirectorTerritories.id,
      })
      .from(territorialDirectorTerritories);

    const allTerritories = await db.select({ id: territories.id, name: territories.name }).from(territories);
    const territoryMap = Object.fromEntries(allTerritories.map(t => [t.id, t.name]));

    return tds.map(td => ({
      ...td,
      territories: allAssignments
        .filter(a => a.userId === td.id)
        .map(a => ({ assignmentId: a.id, territoryId: a.territoryId, territoryName: territoryMap[a.territoryId] ?? null })),
    }));
  }),

  /**
   * Grant territorial_director role to a user and optionally assign a territory.
   * Writes an audit record. SEBA admin only.
   */
  grantTerritorialDirector: adminProcedure
    .input(z.object({
      userId: z.number().int().positive(),
      territoryId: z.number().int().positive().optional(),
      reason: z.string().max(512).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      // Fetch current role for audit trail
      const [target] = await db
        .select({ role: users.role })
        .from(users)
        .where(eq(users.id, input.userId))
        .limit(1);

      if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });

      const oldRole = target.role ?? null;

      // Promote user to territorial_director
      await db
        .update(users)
        .set({ role: "territorial_director" })
        .where(eq(users.id, input.userId));

      // Write audit record
      await writeAudit({
        actingUserId: ctx.user.id,
        targetUserId: input.userId,
        oldRole,
        newRole: "territorial_director",
        action: "grant",
        reason: input.reason,
        territoryId: input.territoryId,
      });

      // Assign territory if provided
      if (input.territoryId) {
        const { sql } = await import("drizzle-orm");
        await db.execute(
          sql`INSERT IGNORE INTO territorial_director_territories (userId, territoryId, grantedByUserId)
              VALUES (${input.userId}, ${input.territoryId}, ${ctx.user.id})`
        );
        await writeAudit({
          actingUserId: ctx.user.id,
          targetUserId: input.userId,
          oldRole: "territorial_director",
          newRole: "territorial_director",
          action: "assign_territory",
          territoryId: input.territoryId,
        });
      }

      return { success: true };
    }),

  /**
   * Revoke territorial_director role from a user (demotes back to 'user').
   * Also removes all territory assignments. Writes an audit record.
   * SEBA admin only.
   */
  revokeTerritorialDirector: adminProcedure
    .input(z.object({
      userId: z.number().int().positive(),
      reason: z.string().max(512).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      await db
        .update(users)
        .set({ role: "user" })
        .where(eq(users.id, input.userId));

      await db
        .delete(territorialDirectorTerritories)
        .where(eq(territorialDirectorTerritories.userId, input.userId));

      await writeAudit({
        actingUserId: ctx.user.id,
        targetUserId: input.userId,
        oldRole: "territorial_director",
        newRole: "user",
        action: "revoke",
        reason: input.reason,
      });

      return { success: true };
    }),

  /**
   * Assign an additional territory to an existing territorial director.
   * Writes an audit record. SEBA admin only.
   */
  assignTerritory: adminProcedure
    .input(z.object({
      userId: z.number().int().positive(),
      territoryId: z.number().int().positive(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const { sql } = await import("drizzle-orm");
      await db.execute(
        sql`INSERT IGNORE INTO territorial_director_territories (userId, territoryId, grantedByUserId)
            VALUES (${input.userId}, ${input.territoryId}, ${ctx.user.id})`
      );

      await writeAudit({
        actingUserId: ctx.user.id,
        targetUserId: input.userId,
        oldRole: "territorial_director",
        newRole: "territorial_director",
        action: "assign_territory",
        territoryId: input.territoryId,
      });

      return { success: true };
    }),

  /**
   * Remove a territory assignment from a territorial director.
   * Writes an audit record. SEBA admin only.
   */
  removeTerritory: adminProcedure
    .input(z.object({ assignmentId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      // Fetch the assignment for audit
      const [assignment] = await db
        .select()
        .from(territorialDirectorTerritories)
        .where(eq(territorialDirectorTerritories.id, input.assignmentId))
        .limit(1);

      await db
        .delete(territorialDirectorTerritories)
        .where(eq(territorialDirectorTerritories.id, input.assignmentId));

      if (assignment) {
        await writeAudit({
          actingUserId: ctx.user.id,
          targetUserId: assignment.userId,
          oldRole: "territorial_director",
          newRole: "territorial_director",
          action: "remove_territory",
          territoryId: assignment.territoryId,
        });
      }

      return { success: true };
    }),

  /**
   * Assign a territory to a tenant (links the school to a geographic region).
   * SEBA admin only.
   */
  assignTenantToTerritory: adminProcedure
    .input(z.object({
      tenantId: z.number().int().positive(),
      territoryId: z.number().int().positive().nullable(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      await db
        .update(tenants)
        .set({ territoryId: input.territoryId })
        .where(eq(tenants.id, input.tenantId));

      return { success: true };
    }),

  // ─── Audit Log ───────────────────────────────────────────────────────────────

  /**
   * List role-change audit records (most recent first, paginated).
   * SEBA admin only.
   */
  listRoleAudit: adminProcedure
    .input(z.object({
      limit: z.number().int().min(1).max(100).default(50),
      offset: z.number().int().min(0).default(0),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const records = await db
        .select({
          id: roleChangeAudit.id,
          actingUserId: roleChangeAudit.actingUserId,
          targetUserId: roleChangeAudit.targetUserId,
          oldRole: roleChangeAudit.oldRole,
          newRole: roleChangeAudit.newRole,
          action: roleChangeAudit.action,
          reason: roleChangeAudit.reason,
          territoryId: roleChangeAudit.territoryId,
          createdAt: roleChangeAudit.createdAt,
        })
        .from(roleChangeAudit)
        .orderBy(desc(roleChangeAudit.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      // Enrich with user names
      const userIds = new Set([
        ...records.map(r => r.actingUserId),
        ...records.map(r => r.targetUserId),
      ]);
      const { inArray } = await import("drizzle-orm");
      const userIdArray = Array.from(userIds);
      const enrichedUsers = userIdArray.length > 0
        ? await db
          .select({ id: users.id, name: users.name, email: users.email })
          .from(users)
          .where(inArray(users.id, userIdArray))
        : [];

      const userMap = Object.fromEntries(enrichedUsers.map(u => [u.id, u]));

      const allTerritories = await db.select({ id: territories.id, name: territories.name }).from(territories);
      const territoryMap = Object.fromEntries(allTerritories.map(t => [t.id, t.name]));

      return records.map(r => ({
        ...r,
        actingUserName: userMap[r.actingUserId]?.name ?? `User #${r.actingUserId}`,
        actingUserEmail: userMap[r.actingUserId]?.email ?? null,
        targetUserName: userMap[r.targetUserId]?.name ?? `User #${r.targetUserId}`,
        targetUserEmail: userMap[r.targetUserId]?.email ?? null,
        territoryName: r.territoryId ? (territoryMap[r.territoryId] ?? null) : null,
      }));
    }),
  // ─── Onboarding Helpers ────────────────────────────────────────────────────────

  /**
   * Search for a user by email (partial match, case-insensitive).
   * Returns up to 10 results. SEBA admin only.
   * Used by the "Grant Role" dialog so admins don't need to know user IDs.
   */
  findUserByEmail: adminProcedure
    .input(z.object({ email: z.string().min(2).max(255) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const rows = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          role: users.role,
          tenantId: users.tenantId,
        })
        .from(users)
        .where(like(users.email, `%${input.email}%`))
        .limit(10);

      return rows;
    }),

  // ─── One-click Territorial Director Registration ─────────────────────────────

  /**
   * Create a local-auth account for a Territorial Director, grant the role,
   * assign their territory, and write an audit record — all in one mutation.
   * Returns the generated temporary credentials so the admin can share them.
   */
  registerAndGrantTerritorialDirector: adminProcedure
    .input(z.object({
      name: z.string().min(2).max(255),
      email: z.string().email(),
      territoryId: z.number().int().positive(),
      reason: z.string().max(500).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      // Guard: email must be unique
      const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, input.email)).limit(1);
      if (existing) throw new TRPCError({ code: "CONFLICT", message: "An account with this email already exists." });

      // Guard: territory must exist
      const [territory] = await db.select({ id: territories.id, name: territories.name })
        .from(territories).where(eq(territories.id, input.territoryId)).limit(1);
      if (!territory) throw new TRPCError({ code: "NOT_FOUND", message: "Territory not found." });

      // Generate a secure temporary password (12 chars, URL-safe base64)
      const tempPassword = crypto.randomBytes(9).toString("base64url");
      const passwordHash = await bcrypt.hash(tempPassword, 12);

      // Insert the user
      const [insertResult] = await db.insert(users).values({
        name: input.name,
        email: input.email,
        passwordHash,
        loginMethod: "local",
        role: "territorial_director",
        position: "director",
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);
      const userId = (insertResult as any).insertId as number;

      // Assign territory
      await db.insert(territorialDirectorTerritories).values({
        userId,
        territoryId: input.territoryId,
        grantedByUserId: ctx.user.id,
      } as any);

      // Write audit record
      await writeAudit({
        actingUserId: ctx.user.id,
        targetUserId: userId,
        oldRole: null,
        newRole: "territorial_director",
        action: "grant",
        reason: input.reason ?? `Registered and granted territorial_director for ${territory.name}`,
        territoryId: input.territoryId,
      });

      return {
        userId,
        name: input.name,
        email: input.email,
        tempPassword,
        territoryName: territory.name,
      };
    }),

  // ─── Director Invitation Flow ─────────────────────────────────────────────────

  /**
   * Create a director invite link with pre-set tenantId and role=director.
   * Returns the invite token (frontend constructs the full URL).
   * SEBA admin only.
   */
  createDirectorInvite: adminProcedure
    .input(z.object({
      tenantId: z.number().int().positive(),
      email: z.string().email().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      // Verify tenant exists
      const [tenant] = await db.select({ id: tenants.id, name: tenants.name })
        .from(tenants).where(eq(tenants.id, input.tenantId)).limit(1);
      if (!tenant) throw new TRPCError({ code: "NOT_FOUND", message: "Tenant not found." });

      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      await db.insert(directorInvites).values({
        token,
        tenantId: input.tenantId,
        email: input.email ?? null,
        createdByUserId: ctx.user.id,
        expiresAt,
      } as any);

      return { token, tenantName: tenant.name, expiresAt };
    }),

  /**
   * Validate an invite token — public procedure (used on the invite landing page).
   * Returns tenant name and pre-filled email if the invite is valid.
   */
  validateDirectorInvite: publicProcedure
    .input(z.object({ token: z.string().length(64) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const [invite] = await db
        .select({
          id: directorInvites.id,
          tenantId: directorInvites.tenantId,
          email: directorInvites.email,
          expiresAt: directorInvites.expiresAt,
          usedAt: directorInvites.usedAt,
        })
        .from(directorInvites)
        .where(eq(directorInvites.token, input.token))
        .limit(1);

      if (!invite) throw new TRPCError({ code: "NOT_FOUND", message: "Invite not found." });
      if (invite.usedAt) throw new TRPCError({ code: "FORBIDDEN", message: "This invite has already been used." });
      if (new Date() > invite.expiresAt) throw new TRPCError({ code: "FORBIDDEN", message: "This invite has expired." });

      const [tenant] = await db.select({ name: tenants.name })
        .from(tenants).where(eq(tenants.id, invite.tenantId)).limit(1);

      return {
        tenantId: invite.tenantId,
        tenantName: tenant?.name ?? "Unknown School",
        email: invite.email,
        expiresAt: invite.expiresAt,
      };
    }),

  /**
   * Accept a director invite — public procedure.
   * Creates the user account with role=director and tenantId pre-set.
   */
  acceptDirectorInvite: publicProcedure
    .input(z.object({
      token: z.string().length(64),
      name: z.string().min(2).max(255),
      email: z.string().email(),
      password: z.string().min(8).max(128),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      // Re-validate invite
      const [invite] = await db
        .select()
        .from(directorInvites)
        .where(eq(directorInvites.token, input.token))
        .limit(1);

      if (!invite) throw new TRPCError({ code: "NOT_FOUND", message: "Invite not found." });
      if (invite.usedAt) throw new TRPCError({ code: "FORBIDDEN", message: "This invite has already been used." });
      if (new Date() > invite.expiresAt) throw new TRPCError({ code: "FORBIDDEN", message: "This invite has expired." });

      // Guard: email must be unique
      const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, input.email)).limit(1);
      if (existing) throw new TRPCError({ code: "CONFLICT", message: "An account with this email already exists." });

      const passwordHash = await bcrypt.hash(input.password, 12);

      const [insertResult] = await db.insert(users).values({
        name: input.name,
        email: input.email,
        passwordHash,
        loginMethod: "local",
        role: "user",
        position: "director",
        tenantId: invite.tenantId,
        mustChangePassword: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);
      const userId = (insertResult as any).insertId as number;

      // Mark invite as used
      await db.update(directorInvites)
        .set({ usedByUserId: userId, usedAt: new Date() })
        .where(eq(directorInvites.token, input.token));

      return { success: true, userId };
    }),

  // ─── Teacher Invite Flow ─────────────────────────────────────────────────

  createTeacherInvite: adminProcedure
    .input(
      z.object({
        email: z.string().email().optional(),
        tenantId: z.number().int().positive().optional(),
        origin: z.string().url(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const token = crypto.randomBytes(48).toString("hex");
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      await db.insert(teacherInvites).values({
        token,
        email: input.email ?? null,
        tenantId: input.tenantId ?? null,
        createdByUserId: ctx.user.id,
        expiresAt,
      } as any);

      const inviteUrl = `${input.origin}/invite/teacher/${token}`;
      return { token, inviteUrl, expiresAt };
    }),

  validateTeacherInvite: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [invite] = await db
        .select()
        .from(teacherInvites)
        .where(eq(teacherInvites.token, input.token))
        .limit(1);

      if (!invite) throw new TRPCError({ code: "NOT_FOUND", message: "Invite not found." });
      if (invite.usedAt) throw new TRPCError({ code: "FORBIDDEN", message: "This invite has already been used." });
      if (new Date() > invite.expiresAt) throw new TRPCError({ code: "FORBIDDEN", message: "This invite has expired." });

      // Optionally fetch tenant name
      let tenantName: string | null = null;
      if (invite.tenantId) {
        const [tenant] = await db
          .select({ name: tenants.name })
          .from(tenants)
          .where(eq(tenants.id, invite.tenantId))
          .limit(1);
        tenantName = tenant?.name ?? null;
      }

      return {
        email: invite.email,
        tenantId: invite.tenantId,
        tenantName,
        expiresAt: invite.expiresAt,
      };
    }),

  acceptTeacherInvite: publicProcedure
    .input(
      z.object({
        token: z.string(),
        name: z.string().min(1),
        email: z.string().email(),
        password: z.string().min(8),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [invite] = await db
        .select()
        .from(teacherInvites)
        .where(eq(teacherInvites.token, input.token))
        .limit(1);

      if (!invite) throw new TRPCError({ code: "NOT_FOUND", message: "Invite not found." });
      if (invite.usedAt) throw new TRPCError({ code: "FORBIDDEN", message: "This invite has already been used." });
      if (new Date() > invite.expiresAt) throw new TRPCError({ code: "FORBIDDEN", message: "This invite has expired." });

      // Guard: email must be unique
      const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, input.email)).limit(1);
      if (existing) throw new TRPCError({ code: "CONFLICT", message: "An account with this email already exists." });

      const passwordHash = await bcrypt.hash(input.password, 12);
      const openId = `local_teacher_${crypto.randomBytes(16).toString("hex")}`;

      const [insertResult] = await db.insert(users).values({
        name: input.name,
        displayName: input.name,
        email: input.email,
        openId,
        passwordHash,
        loginMethod: "local",
        role: "user",
        position: "teacher",
        tenantId: invite.tenantId ?? null,
        mustChangePassword: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      } as any);
      const userId = (insertResult as any).insertId as number;

      // Mark invite as used
      await db.update(teacherInvites)
        .set({ usedByUserId: userId, usedAt: new Date() })
        .where(eq(teacherInvites.token, input.token));

      return { success: true, userId };
    }),
});
