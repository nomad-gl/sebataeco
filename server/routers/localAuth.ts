/**
 * Sovereign local authentication router.
 * Provides email + password register/login that is fully self-hosted —
 * no Google, Meta, or Manus OAuth involved.
 *
 * Session tokens are signed with the same JWT_SECRET used by the Manus OAuth
 * path, so existing sessions continue to work unchanged.
 */

import { z } from "zod";
import bcrypt from "bcryptjs";
import { publicProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { sdk } from "../_core/sdk";
import { getSessionCookieOptions } from "../_core/cookies";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getDb } from "../db";
import { users } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

const BCRYPT_ROUNDS = 12;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Derive a stable openId from a local email so it never collides with Manus openIds */
function localOpenId(email: string): string {
  return `local:${email.toLowerCase().trim()}`;
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const localAuthRouter = router({
  /**
   * Register a new local account.
   * Creates the user row and immediately issues a session cookie.
   */
  register: publicProcedure
    .input(
      z.object({
        email: z.string().email("Invalid email address"),
        password: z.string().min(8, "Password must be at least 8 characters"),
        displayName: z.string().min(1, "Display name is required").max(128),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const normalised = input.email.toLowerCase().trim();
      const openId = localOpenId(normalised);

      // Check for existing account
      const existing = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.openId, openId))
        .limit(1);

      if (existing.length > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "An account with this email already exists.",
        });
      }

      const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

      await db.insert(users).values({
        openId,
        email: normalised,
        name: input.displayName,
        displayName: input.displayName,
        passwordHash,
        loginMethod: "local",
        lastSignedIn: new Date(),
      });

      // Issue session cookie
      const sessionToken = await sdk.createSessionToken(openId, {
        name: input.displayName,
        expiresInMs: ONE_YEAR_MS,
      });
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, sessionToken, {
        ...cookieOptions,
        maxAge: ONE_YEAR_MS,
      });

      return { success: true };
    }),

  /**
   * Log in with an existing local account.
   * Issues a session cookie on success.
   */
  login: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        password: z.string().min(1),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const normalised = input.email.toLowerCase().trim();
      const openId = localOpenId(normalised);

      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.openId, openId))
        .limit(1);

      if (!user || !user.passwordHash) {
        // Generic message to avoid user enumeration
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid email or password.",
        });
      }

      const valid = await bcrypt.compare(input.password, user.passwordHash);
      if (!valid) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid email or password.",
        });
      }

      // Update last sign-in
      await db
        .update(users)
        .set({ lastSignedIn: new Date() })
        .where(eq(users.id, user.id));

      const sessionToken = await sdk.createSessionToken(openId, {
        name: user.displayName ?? user.name ?? normalised,
        expiresInMs: ONE_YEAR_MS,
      });
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, sessionToken, {
        ...cookieOptions,
        maxAge: ONE_YEAR_MS,
      });

      return { success: true };
    }),
});
