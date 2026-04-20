/**
 * territorialDirector.ts
 *
 * Read-only cross-tenant oversight procedures for the
 * "Director of Territorial Services for Education and Vocational Training"
 * role, scoped strictly to the tenants within their assigned territories.
 *
 * Access: territorial_director + admin roles only.
 * All procedures are strictly read-only — no mutations are permitted here.
 *
 * Context injected by territorialDirectorProcedure middleware:
 *   ctx.allowedTenantIds — null (admin = all) | number[] (scoped to territory)
 *   ctx.allowedTerritoryIds — territory IDs assigned to this user
 *   ctx.isAdmin — true if SEBA admin
 *   ctx.isTerritorialDirector — true if territorial_director role
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, desc, count, inArray, and } from "drizzle-orm";
import { getDb } from "../db";
import { territorialDirectorProcedure, router } from "../_core/trpc";
import {
  tenants,
  users,
  lessonPlans,
  classGroups,
  aiBiasFlags,
  territories,
  territorialDirectorTerritories,
} from "../../drizzle/schema";

// Helper: build a WHERE clause that filters tenants by allowedTenantIds
// Returns undefined (no filter) when allowedTenantIds is null (admin = all)
function tenantScope(allowedTenantIds: number[] | null) {
  if (allowedTenantIds === null) return undefined; // admin — no restriction
  if (allowedTenantIds.length === 0) return false as unknown as undefined; // no tenants assigned
  return inArray(tenants.id, allowedTenantIds);
}

export const territorialDirectorRouter = router({
  /**
   * Overview statistics scoped to this territorial director's territory.
   */
  getOverviewStats: territorialDirectorProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

    const { allowedTenantIds } = ctx;

    // If no tenants in scope, return zeroes immediately
    if (Array.isArray(allowedTenantIds) && allowedTenantIds.length === 0) {
      return { totalTenants: 0, totalUsers: 0, totalDirectors: 0, totalLessonPlans: 0, openBiasFlags: 0 };
    }

    // Count tenants in scope
    const tenantWhere = tenantScope(allowedTenantIds);
    const tenantQuery = db.select({ count: count() }).from(tenants);
    const [[totalTenantsRow]] = await Promise.all([
      tenantWhere ? tenantQuery.where(tenantWhere) : tenantQuery,
    ]);

    // Count users, directors, lesson plans, bias flags scoped to those tenants
    const userWhere = allowedTenantIds === null
      ? undefined
      : inArray(users.tenantId, allowedTenantIds);

    const [
      [totalUsersRow],
      [totalDirectorsRow],
      [totalPlansRow],
      [openFlagsRow],
    ] = await Promise.all([
      userWhere
        ? db.select({ count: count() }).from(users).where(userWhere)
        : db.select({ count: count() }).from(users),
      userWhere
        ? db.select({ count: count() }).from(users).where(and(userWhere, eq(users.position, "director")))
        : db.select({ count: count() }).from(users).where(eq(users.position, "director")),

      (allowedTenantIds === null
        ? db.select({ count: count() }).from(lessonPlans)
        : allowedTenantIds.length > 0
          ? db.select({ count: count() }).from(lessonPlans).where(inArray(lessonPlans.tenantId, allowedTenantIds))
          : Promise.resolve([{ count: 0 }] as { count: number }[])),
      db.select({ count: count() }).from(aiBiasFlags).where(eq(aiBiasFlags.resolved, false)),
    ]);

    return {
      totalTenants: totalTenantsRow?.count ?? 0,
      totalUsers: totalUsersRow?.count ?? 0,
      totalDirectors: totalDirectorsRow?.count ?? 0,
      totalLessonPlans: totalPlansRow?.count ?? 0,
      openBiasFlags: openFlagsRow?.count ?? 0,
    };
  }),

  /**
   * List of territories assigned to the current user (or all territories for admin).
   */
  getMyTerritories: territorialDirectorProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

    if (ctx.isAdmin) {
      // Admins see all territories
      return db.select().from(territories).orderBy(territories.name);
    }

    // Territorial director sees only their assigned territories
    if (ctx.allowedTerritoryIds.length === 0) return [];

    return db
      .select()
      .from(territories)
      .where(inArray(territories.id, ctx.allowedTerritoryIds))
      .orderBy(territories.name);
  }),

  /**
   * Full list of tenants visible to this territorial director, with
   * director info and member counts.
   */
  getAllTenants: territorialDirectorProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

    const { allowedTenantIds } = ctx;

    if (Array.isArray(allowedTenantIds) && allowedTenantIds.length === 0) return [];

    // Fetch tenants in scope
    const tenantQuery = db
      .select({
        id: tenants.id,
        name: tenants.name,
        ownerUserId: tenants.ownerUserId,
        territoryId: tenants.territoryId,
        createdAt: tenants.createdAt,
      })
      .from(tenants)
      .orderBy(tenants.name);

    const allTenants = allowedTenantIds === null
      ? await tenantQuery
      : await tenantQuery.where(inArray(tenants.id, allowedTenantIds));

    if (allTenants.length === 0) return [];

    const tenantIds = allTenants.map(t => t.id);

    // Fetch all users belonging to those tenants
    const allUsers = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        position: users.position,
        tenantId: users.tenantId,
        lastSignedIn: users.lastSignedIn,
      })
      .from(users)
      .where(inArray(users.tenantId, tenantIds))
      .orderBy(desc(users.lastSignedIn));

    // Fetch territory names for display
    const allTerritories = await db.select({ id: territories.id, name: territories.name }).from(territories);
    const territoryMap = Object.fromEntries(allTerritories.map(t => [t.id, t.name]));

    return allTenants.map(tenant => {
      const members = allUsers.filter(u => u.tenantId === tenant.id);
      const owner = allUsers.find(u => u.id === tenant.ownerUserId);
      const directors = members.filter(u => u.position === "director");
      const teachers = members.filter(u => u.position === "teacher");
      const hosUsers = members.filter(u => u.position === "head_of_study");

      return {
        id: tenant.id,
        name: tenant.name,
        createdAt: tenant.createdAt,
        territoryId: tenant.territoryId,
        territoryName: tenant.territoryId ? (territoryMap[tenant.territoryId] ?? null) : null,
        ownerName: owner?.name ?? null,
        ownerEmail: owner?.email ?? null,
        memberCount: members.length,
        directorCount: directors.length,
        teacherCount: teachers.length,
        headOfStudyCount: hosUsers.length,
        lastActivity: members
          .map(u => u.lastSignedIn)
          .filter(Boolean)
          .sort((a, b) => (b?.getTime() ?? 0) - (a?.getTime() ?? 0))[0] ?? null,
        members: members.map(u => ({
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          position: u.position,
          lastSignedIn: u.lastSignedIn,
        })),
      };
    });
  }),

  /**
   * Detailed view of a single tenant — only accessible if it's within scope.
   */
  getTenantDetail: territorialDirectorProcedure
    .input(z.object({ tenantId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      // Enforce scope: territorial directors can only view their territory's tenants
      if (
        Array.isArray(ctx.allowedTenantIds) &&
        !ctx.allowedTenantIds.includes(input.tenantId)
      ) {
        throw new TRPCError({ code: "FORBIDDEN", message: "This tenant is outside your assigned territory." });
      }

      const [tenant] = await db
        .select()
        .from(tenants)
        .where(eq(tenants.id, input.tenantId))
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
        .where(eq(users.tenantId, input.tenantId))
        .orderBy(users.position, desc(users.lastSignedIn));

      const [[planCount], [groupCount]] = await Promise.all([
        db.select({ count: count() }).from(lessonPlans).where(eq(lessonPlans.tenantId, input.tenantId)),
        db.select({ count: count() }).from(classGroups).where(eq(classGroups.tenantId, input.tenantId)),
      ]);

      // Territory name
      let territoryName: string | null = null;
      if (tenant.territoryId) {
        const [terr] = await db.select({ name: territories.name }).from(territories).where(eq(territories.id, tenant.territoryId)).limit(1);
        territoryName = terr?.name ?? null;
      }

      return {
        ...tenant,
        territoryName,
        members,
        lessonPlanCount: planCount?.count ?? 0,
        classGroupCount: groupCount?.count ?? 0,
      };
    }),

  /**
   * All directors visible to this territorial director (scoped to their territory).
   */
  getAllDirectors: territorialDirectorProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

    const { allowedTenantIds } = ctx;

    if (Array.isArray(allowedTenantIds) && allowedTenantIds.length === 0) return [];

    const baseQuery = db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        tenantId: users.tenantId,
        lastSignedIn: users.lastSignedIn,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.position, "director"))
      .orderBy(users.name);

    const directors = allowedTenantIds === null
      ? await baseQuery
      : await db
          .select({
            id: users.id,
            name: users.name,
            email: users.email,
            role: users.role,
            tenantId: users.tenantId,
            lastSignedIn: users.lastSignedIn,
            createdAt: users.createdAt,
          })
          .from(users)
          .where(and(
            inArray(users.tenantId, allowedTenantIds),
            eq(users.position, "director")
          ))
          .orderBy(users.name);

    const allTenants = await db.select({ id: tenants.id, name: tenants.name }).from(tenants);
    const tenantMap = Object.fromEntries(allTenants.map(t => [t.id, t.name]));

    return directors.map((d: typeof directors[number]) => ({
      ...d,
      tenantName: d.tenantId ? (tenantMap[d.tenantId] ?? null) : null,
    }));
  }),
});
