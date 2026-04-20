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

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== 'admin') {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
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
