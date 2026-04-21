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
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { sdk } from "../_core/sdk";
import { getSessionCookieOptions } from "../_core/cookies";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getDb } from "../db";
import { users, passwordResetTokens, teacherInvites } from "../../drizzle/schema";
import { eq, and, gt, desc } from "drizzle-orm";
import { notifyOwner } from "../_core/notification";

const BCRYPT_ROUNDS = 12;

// ─── In-memory rate limiter for verifyInviteToken ─────────────────────────────
// Lightweight Map-based store: keyed by IP, value is { count, windowStart }.
// Resets automatically after RATE_WINDOW_MS. No external dependency needed.
const VERIFY_RATE_LIMIT = 10; // max requests
const RATE_WINDOW_MS = 60 * 1000; // per 1 minute

const verifyRateLimitStore = new Map<string, { count: number; windowStart: number }>();

function checkVerifyRateLimit(ip: string): void {
  const now = Date.now();
  const entry = verifyRateLimitStore.get(ip);
  if (!entry || now - entry.windowStart >= RATE_WINDOW_MS) {
    verifyRateLimitStore.set(ip, { count: 1, windowStart: now });
    return;
  }
  entry.count++;
  if (entry.count > VERIFY_RATE_LIMIT) {
    const retryAfterSec = Math.ceil((RATE_WINDOW_MS - (now - entry.windowStart)) / 1000);
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: `Too many verification attempts. Please wait ${retryAfterSec} seconds before trying again.`,
    });
  }
}

// ─── Brute-force lockout for login ────────────────────────────────────────────
// Keyed by normalised email (not IP) so distributed attacks from multiple IPs
// against a single account are still caught.
const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

const loginAttemptStore = new Map<string, { count: number; windowStart: number }>();

function checkLoginRateLimit(email: string): void {
  const now = Date.now();
  const key = email.toLowerCase().trim();
  const entry = loginAttemptStore.get(key);
  if (!entry || now - entry.windowStart >= LOGIN_WINDOW_MS) {
    loginAttemptStore.set(key, { count: 1, windowStart: now });
    return;
  }
  entry.count++;
  if (entry.count > LOGIN_MAX_ATTEMPTS) {
    const retryAfterMin = Math.ceil((LOGIN_WINDOW_MS - (now - entry.windowStart)) / 60000);
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: `Too many failed login attempts. Please wait ${retryAfterMin} minute${retryAfterMin !== 1 ? "s" : ""} before trying again.`,
    });
  }
}

function resetLoginRateLimit(email: string): void {
  loginAttemptStore.delete(email.toLowerCase().trim());
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Derive a stable openId from a local email so it never collides with Manus openIds */
function localOpenId(email: string): string {
  return `local:${email.toLowerCase().trim()}`;
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const localAuthRouter = router({
  /**
   * Verify a teacher invite token without consuming it.
   * Returns { valid: true, email } on success, or throws with a descriptive message.
   */
  verifyInviteToken: publicProcedure
    .input(z.object({ token: z.string().min(1) }))
    .query(async ({ input, ctx }) => {
      // Rate-limit: max 10 checks per IP per minute
      const ip =
        (ctx.req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ??
        ctx.req.socket?.remoteAddress ??
        "unknown";
      checkVerifyRateLimit(ip);

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const now = new Date();
      const [invite] = await db
        .select()
        .from(teacherInvites)
        .where(eq(teacherInvites.token, input.token))
        .limit(1);

      if (!invite) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "This invite link is invalid. Please ask your Director for a new one.",
        });
      }
      if (invite.usedAt) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This invite link has already been used. Please ask your Director for a new one.",
        });
      }
      if (invite.expiresAt < now) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This invite link has expired. Please ask your Director to resend the invitation.",
        });
      }

      return { valid: true as const, email: invite.email ?? null };
    }),

  /**
   * Register a new local account.
   * Requires a valid, unused, non-expired invite token.
   * Creates the user row, marks the invite as used, and immediately issues a session cookie.
   */
  register: publicProcedure
    .input(
      z.object({
        email: z.string().email("Invalid email address"),
        password: z.string().min(8, "Password must be at least 8 characters"),
        displayName: z.string().min(1, "Display name is required").max(128),
        inviteToken: z.string().min(1, "An invite token is required to register."),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      // ── Validate invite token ─────────────────────────────────────────────
      const now = new Date();
      const [invite] = await db
        .select()
        .from(teacherInvites)
        .where(eq(teacherInvites.token, input.inviteToken))
        .limit(1);

      if (!invite) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "This invite link is invalid. Please ask your Director for a new one.",
        });
      }
      if (invite.usedAt) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "This invite link has already been used.",
        });
      }
      if (invite.expiresAt < now) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "This invite link has expired. Please ask your Director to resend the invitation.",
        });
      }

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
        // Inherit the tenant from the invite so the new teacher is automatically
        // placed in the same school group as the Director who sent the invite.
        tenantId: invite.tenantId ?? null,
      });

      // Mark invite as used
      await db
        .update(teacherInvites)
        .set({ usedAt: now })
        .where(eq(teacherInvites.id, invite.id));

      // Notify the Director that a new teacher has completed registration
      // Fire-and-forget: don't block the response if the notification fails
      notifyOwner({
        title: `New teacher registered: ${input.displayName}`,
        content: `A new teacher account has been created via invite.\n\nName: ${input.displayName}\nEmail: ${normalised}\nRegistered at: ${now.toISOString()}`,
      }).catch(() => { /* silent — notification failure should not block registration */ });

      // Issue session cookie — embed sessionVersion (defaults to 1 for new accounts)
      const [newUser] = await db.select({ sessionVersion: users.sessionVersion }).from(users).where(eq(users.openId, openId)).limit(1);
      const sessionToken = await sdk.createSessionToken(openId, {
        name: input.displayName,
        sv: newUser?.sessionVersion ?? 1,
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
      // Check brute-force lockout before any DB work
      checkLoginRateLimit(normalised);
      const openId = localOpenId(normalised);

      // Primary lookup: local:<email> openId (standard local accounts)
      let [user] = await db
        .select()
        .from(users)
        .where(eq(users.openId, openId))
        .limit(1);

      // Fallback: look up by email field for OAuth accounts that have set a password
      if (!user) {
        const [byEmail] = await db
          .select()
          .from(users)
          .where(eq(users.email, normalised))
          .limit(1);
        if (byEmail) user = byEmail;
      }

      if (!user || !user.passwordHash) {
        // Generic message to avoid user enumeration
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid email or password.",
        });
      }

      const valid = await bcrypt.compare(input.password, user.passwordHash);
      if (!valid) {
        // Count this as a failed attempt
        checkLoginRateLimit(normalised);
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid email or password.",
        });
      }

      // Successful login — clear the lockout counter
      resetLoginRateLimit(normalised);

      // Block deactivated accounts
      if (user.deactivatedAt) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "This account has been deactivated. Please contact your school administrator.",
        });
      }

      // Update last sign-in
      await db
        .update(users)
        .set({ lastSignedIn: new Date() })
        .where(eq(users.id, user.id));

      // Use the user's actual openId (may differ from local:email for OAuth accounts)
      const sessionToken = await sdk.createSessionToken(user.openId, {
        name: user.displayName ?? user.name ?? normalised,
        sv: user.sessionVersion ?? 1,
        expiresInMs: ONE_YEAR_MS,
      });
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, sessionToken, {
        ...cookieOptions,
        maxAge: ONE_YEAR_MS,
      });

      return { success: true, mustChangePassword: user.mustChangePassword ?? false };
    }),

  /**
   * Set or change the local password for the currently authenticated user.
   * Works for both local accounts and OAuth accounts (e.g. owner via Manus OAuth).
   * Once set, the user can log in with email + password on any device.
   */
  setPassword: protectedProcedure
    .input(
      z.object({
        newPassword: z.string().min(8, "Password must be at least 8 characters"),
        currentPassword: z.string().optional(), // required only if account already has a password
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, ctx.user.id))
        .limit(1);

      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "User not found." });

      // If the account already has a password, require the current password for verification
      if (user.passwordHash) {
        if (!input.currentPassword) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Current password is required to change your password.",
          });
        }
        const valid = await bcrypt.compare(input.currentPassword, user.passwordHash);
        if (!valid) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Current password is incorrect.",
          });
        }
      }

      const passwordHash = await bcrypt.hash(input.newPassword, BCRYPT_ROUNDS);

      await db
        .update(users)
        .set({ passwordHash })
        .where(eq(users.id, user.id));

      return { success: true };
    }),

  /**
   * Sign out from all devices by incrementing the sessionVersion.
   * Any existing session tokens with an older version will be rejected
   * on the next request, effectively invalidating all other sessions.
   */
  logoutAllDevices: protectedProcedure
    .mutation(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      // Increment the session version — all tokens with sv < new value are now stale
      await db
        .update(users)
        .set({ sessionVersion: (ctx.user.sessionVersion ?? 1) + 1 })
        .where(eq(users.id, ctx.user.id));

      // Clear the current session cookie too
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });

      return { success: true };
    }),
});
