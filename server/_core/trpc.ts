import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

const isProd = process.env.NODE_ENV === "production";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    // In production, strip stack traces and sanitise generic DB error messages
    // so internal query text and file paths are never exposed to the client.
    return {
      ...shape,
      data: {
        ...shape.data,
        stack: isProd ? undefined : shape.data?.stack,
      },
      // Replace raw DB / unhandled errors with a safe generic message in prod
      message:
        isProd && error.code === "INTERNAL_SERVER_ERROR" && !shape.message.startsWith("An internal")
          ? "An internal error occurred. Please try again."
          : shape.message,
    };
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

/** Roles that are allowed to access director/admin-level procedures */
const ADMIN_ROLES = ['admin', 'director', 'head_of_study'] as const;
type AdminRole = typeof ADMIN_ROLES[number];

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || !(ADMIN_ROLES as readonly string[]).includes(ctx.user.role)) {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    // isSuperAdmin = true only for platform-level admins (role === 'admin')
    // Directors and HoS are scoped to their own tenant
    const isSuperAdmin = ctx.user.role === 'admin';
    const tenantId = isSuperAdmin ? null : (ctx.user.tenantId ?? null);

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
        isSuperAdmin,
        tenantId,
      },
    });
  }),
);

/**
 * territorialDirectorProcedure — read-only cross-tenant oversight.
 *
 * Accessible to:
 *  - SEBA admins (role === 'admin') — full access, allowedTenantIds = null (all tenants)
 *  - Territorial directors (role === 'territorial_director') — read-only overview
 *    scoped strictly to tenants within their assigned territories.
 *    allowedTenantIds = number[] of tenant IDs they may view.
 *
 * Territorial directors CANNOT mutate data — all write operations must use
 * adminProcedure or protectedProcedure instead.
 */
export const territorialDirectorProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
    }

    const isAdmin = ctx.user.role === 'admin';
    const isTerritorialDirector = ctx.user.role === 'territorial_director';

    if (!isAdmin && !isTerritorialDirector) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Territorial Director access required." });
    }

    // Admins see everything; territorial directors see only their territory's tenants
    let allowedTenantIds: number[] | null = null; // null = unrestricted (admin)
    let allowedTerritoryIds: number[] = [];

    if (isTerritorialDirector) {
      // Dynamically import to avoid circular deps at module load time
      const { getDb } = await import("../db");
      const { territorialDirectorTerritories, tenants } = await import("../../drizzle/schema");
      const { eq, inArray } = await import("drizzle-orm");

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      // 1. Get the territory IDs this user is assigned to
      const assignments = await db
        .select({ territoryId: territorialDirectorTerritories.territoryId })
        .from(territorialDirectorTerritories)
        .where(eq(territorialDirectorTerritories.userId, ctx.user.id));

      allowedTerritoryIds = assignments.map(a => a.territoryId);

      if (allowedTerritoryIds.length === 0) {
        // No territory assigned yet — return empty scope
        allowedTenantIds = [];
      } else {
        // 2. Get all tenants that belong to those territories
        const scopedTenants = await db
          .select({ id: tenants.id })
          .from(tenants)
          .where(inArray(tenants.territoryId, allowedTerritoryIds));

        allowedTenantIds = scopedTenants.map(t => t.id);
      }
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
        isTerritorialDirector,
        isAdmin,
        /** null = unrestricted (admin); number[] = tenant IDs visible to this territorial director */
        allowedTenantIds,
        allowedTerritoryIds,
      },
    });
  }),
);

/**
 * tenantProcedure — for any procedure that operates on tenant-scoped data.
 *
 * Behaviour:
 *  - SEBA admins (role === 'admin') get tenantId = null, meaning they bypass
 *    all tenant filters and can see all data across every tenant.
 *  - Regular users get their own tenantId (may be null if not yet assigned
 *    to a tenant, in which case they see only their own rows via userId).
 *
 * Usage in procedures:
 *   const { user, tenantId, isAdmin } = ctx;
 *   if (!isAdmin && tenantId !== null) {
 *     query.where(eq(table.tenantId, tenantId));
 *   }
 */
export const tenantProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
    }

    const isAdmin = ctx.user.role === 'admin';
    // Admins bypass tenant filter (tenantId = null means "see all")
    const tenantId = isAdmin ? null : (ctx.user.tenantId ?? null);

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
        tenantId,
        isAdmin,
      },
    });
  }),
);
