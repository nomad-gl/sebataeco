/**
 * tenants.ts — SEBA super-admin procedures for cross-tenant management.
 *
 * All procedures require role === 'admin' (SEBA super-admins only).
 * Regular directors/teachers do not have access to these endpoints.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, desc, count, and } from "drizzle-orm";
import { getDb } from "../db";
import { adminProcedure, router } from "../_core/trpc";
import { tenants, users } from "../../drizzle/schema";

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
        createdAt: tenants.createdAt,
        updatedAt: tenants.updatedAt,
      })
      .from(tenants)
      .orderBy(desc(tenants.createdAt));

    // Fetch member counts and owner names in one pass
    const allUsers = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        tenantId: users.tenantId,
      })
      .from(users);

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

      // Verify the owner user exists
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

      // Assign the owner user to this tenant
      await db
        .update(users)
        .set({ tenantId: newTenantId })
        .where(eq(users.id, input.ownerUserId));

      return { id: newTenantId, name: input.name };
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

    const { isNull } = await import("drizzle-orm");

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

      // Unassign all users from this tenant first
      await db
        .update(users)
        .set({ tenantId: null })
        .where(eq(users.tenantId, input.id));

      await db.delete(tenants).where(eq(tenants.id, input.id));

      return { success: true };
    }),
});
