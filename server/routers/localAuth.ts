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
import crypto from "crypto";
import { publicProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { sdk } from "../_core/sdk";
import { getSessionCookieOptions } from "../_core/cookies";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getDb } from "../db";
import { users, passwordResetTokens } from "../../drizzle/schema";
import { eq, and, gt, desc } from "drizzle-orm";
import { notifyOwner } from "../_core/notification";

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
   * Request a password reset token.
   * Always returns success to prevent user enumeration.
   * Sends the reset link to the owner via notifyOwner (no SMTP required).
   */
  requestReset: publicProcedure
    .input(z.object({ email: z.string().email(), origin: z.string().url() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { success: true, expiresAt: new Date(Date.now() + 60 * 60 * 1000) }; // silent fail

      const normalised = input.email.toLowerCase().trim();
      const openId = localOpenId(normalised);

      const [user] = await db
        .select({ id: users.id, name: users.displayName, passwordHash: users.passwordHash })
        .from(users)
        .where(eq(users.openId, openId))
        .limit(1);

      // Only issue token for local accounts that have a password.
      // Return success silently even for unknown emails to prevent user enumeration.
      if (!user || !user.passwordHash) {
        return { success: true, expiresAt: new Date(Date.now() + 60 * 60 * 1000) };
      }

      // ── Rate-limit: one reset request per email per 5 minutes ─────────────
      const RATE_LIMIT_MS = 5 * 60 * 1000;
      const [latest] = await db
        .select({ createdAt: passwordResetTokens.createdAt })
        .from(passwordResetTokens)
        .where(eq(passwordResetTokens.userId, user.id))
        .orderBy(desc(passwordResetTokens.createdAt))
        .limit(1);

      if (latest && Date.now() - latest.createdAt.getTime() < RATE_LIMIT_MS) {
        const retryAfterMs = RATE_LIMIT_MS - (Date.now() - latest.createdAt.getTime());
        const retryAfterSec = Math.ceil(retryAfterMs / 1000);
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: `Please wait ${retryAfterSec} seconds before requesting another reset link.`,
        });
      }

      // Invalidate old tokens for this user
      await db
        .update(passwordResetTokens)
        .set({ usedAt: new Date() })
        .where(eq(passwordResetTokens.userId, user.id));

      const token = crypto.randomBytes(48).toString("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await db.insert(passwordResetTokens).values({
        userId: user.id,
        token,
        expiresAt,
      });

      const resetUrl = `${input.origin}/reset-password?token=${token}`;

      // Notify the platform owner so the link can be forwarded to the user.
      // The owner receives this in their Manus notification inbox and can
      // forward the link to the teacher — no SMTP setup required.
      await notifyOwner({
        title: `Password reset requested for ${normalised}`,
        content: `User ${user.name ?? normalised} requested a password reset.\n\nReset link (expires in 1 hour):\n${resetUrl}`,
      });

      return { success: true, expiresAt };
    }),

  /**
   * Complete the password reset using a valid token.
   */
  resetPassword: publicProcedure
    .input(
      z.object({
        token: z.string().min(1),
        password: z.string().min(8, "Password must be at least 8 characters"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const now = new Date();

      const [resetToken] = await db
        .select()
        .from(passwordResetTokens)
        .where(
          and(
            eq(passwordResetTokens.token, input.token),
            gt(passwordResetTokens.expiresAt, now)
          )
        )
        .limit(1);

      if (!resetToken || resetToken.usedAt) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This reset link is invalid or has expired.",
        });
      }

      const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

      await db
        .update(users)
        .set({ passwordHash })
        .where(eq(users.id, resetToken.userId));

      // Mark token as used
      await db
        .update(passwordResetTokens)
        .set({ usedAt: now })
        .where(eq(passwordResetTokens.id, resetToken.id));

      // Fetch user for session
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, resetToken.userId))
        .limit(1);

      if (!user) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "User not found" });

      // Issue a new session
      const sessionToken = await sdk.createSessionToken(user.openId, {
        name: user.displayName ?? user.name ?? user.email ?? user.openId,
        expiresInMs: ONE_YEAR_MS,
      });
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

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
