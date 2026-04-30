/**
 * MFA (Multi-Factor Authentication) router — HIGH-01 security fix
 *
 * Provides TOTP-based MFA setup, verification, and management for privileged roles.
 * Uses the pure Node.js TOTP implementation in server/_core/totp.ts.
 *
 * Procedures:
 *   mfa.getStatus        — Returns whether MFA is enabled for the current user
 *   mfa.setupMfa         — Generates a new TOTP secret and QR URI (not yet active)
 *   mfa.verifyMfaSetup   — Confirms the first TOTP code, activates MFA, returns backup codes
 *   mfa.verifyMfa        — Validates a TOTP code (used during login challenge)
 *   mfa.useBackupCode    — Validates and consumes a one-time backup code
 *   mfa.disableMfa       — Disables MFA (requires current TOTP code or backup code)
 *   mfa.regenerateBackupCodes — Regenerates backup codes (requires current TOTP code)
 */
import { z } from "zod";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { users } from "../../drizzle/schema";
import { logSecurityEvent, extractIp } from "../securityLogger";
import { eq } from "drizzle-orm";
import {
  generateTotpSecret,
  verifyTotp,
  buildOtpauthUri,
} from "../_core/totp";

const MFA_ISSUER = "SEBA AI Studio";
const BACKUP_CODE_COUNT = 10;
const BACKUP_CODE_LENGTH = 8; // 8 hex chars = 32 bits entropy each

/** Generate N random backup codes (plain text — shown once to user) */
function generateBackupCodes(): string[] {
  return Array.from({ length: BACKUP_CODE_COUNT }, () =>
    crypto.randomBytes(4).toString("hex").toUpperCase()
  );
}

/** Hash all backup codes with bcrypt for storage */
async function hashBackupCodes(codes: string[]): Promise<string[]> {
  return Promise.all(codes.map(c => bcrypt.hash(c, 10)));
}

/** Verify a plain-text backup code against stored hashes */
async function verifyBackupCode(
  plain: string,
  hashes: string[]
): Promise<number> {
  for (let i = 0; i < hashes.length; i++) {
    if (await bcrypt.compare(plain.toUpperCase(), hashes[i])) return i;
  }
  return -1;
}

export const mfaRouter = router({
  /** Returns the current MFA status for the authenticated user */
  getStatus: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const [user] = await db
      .select({ mfaEnabled: users.mfaEnabled, mfaSecret: users.mfaSecret })
      .from(users)
      .where(eq(users.id, ctx.user.id))
      .limit(1);
    return {
      mfaEnabled: user?.mfaEnabled ?? false,
      mfaConfigured: !!(user?.mfaSecret),
    };
  }),

  /**
   * Step 1 of MFA setup: generate a new secret and return the QR URI.
   * The secret is stored in the DB but mfaEnabled remains false until verifyMfaSetup succeeds.
   */
  setupMfa: protectedProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

    const secret = generateTotpSecret();
    await db
      .update(users)
      .set({ mfaSecret: secret, mfaEnabled: false, mfaBackupCodes: null })
      .where(eq(users.id, ctx.user.id));

    const label = ctx.user.email ?? ctx.user.name ?? ctx.user.openId;
    const otpauthUri = buildOtpauthUri({ secret, label, issuer: MFA_ISSUER });

    return { secret, otpauthUri };
  }),

  /**
   * Step 2 of MFA setup: verify the first TOTP code to confirm the authenticator
   * app is correctly configured. Activates MFA and returns one-time backup codes.
   */
  verifyMfaSetup: protectedProcedure
    .input(z.object({ token: z.string().length(6) }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const [user] = await db
        .select({ mfaSecret: users.mfaSecret, mfaEnabled: users.mfaEnabled })
        .from(users)
        .where(eq(users.id, ctx.user.id))
        .limit(1);

      if (!user?.mfaSecret) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "MFA setup not initiated. Call setupMfa first." });
      }
      if (user.mfaEnabled) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "MFA is already enabled." });
      }

      if (!verifyTotp(user.mfaSecret, input.token)) {
        logSecurityEvent({
          eventType: "mfa_verify_fail",
          userId: ctx.user.id,
          userEmail: ctx.user.email ?? null,
          userRole: ctx.user.role ?? null,
          ipAddress: extractIp(ctx.req as any),
          userAgent: (ctx.req as any).headers?.["user-agent"] ?? null,
          metadata: { procedure: "verifyMfaSetup" },
        });
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid TOTP code. Check your authenticator app." });
      }

      // Generate and hash backup codes
      const plainCodes = generateBackupCodes();
      const hashedCodes = await hashBackupCodes(plainCodes);

      await db
        .update(users)
        .set({ mfaEnabled: true, mfaBackupCodes: JSON.stringify(hashedCodes) })
        .where(eq(users.id, ctx.user.id));

      logSecurityEvent({
        eventType: "mfa_enabled",
        userId: ctx.user.id,
        userEmail: ctx.user.email ?? null,
        userRole: ctx.user.role ?? null,
        ipAddress: extractIp(ctx.req as any),
        userAgent: (ctx.req as any).headers?.["user-agent"] ?? null,
      });
      return { success: true, backupCodes: plainCodes };
    }),

  /**
   * Verify a TOTP code (used during login challenge for MFA-enabled accounts).
   * Returns success/failure without revealing the secret.
   */
  verifyMfa: protectedProcedure
    .input(z.object({ token: z.string().length(6) }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const [user] = await db
        .select({ mfaSecret: users.mfaSecret, mfaEnabled: users.mfaEnabled })
        .from(users)
        .where(eq(users.id, ctx.user.id))
        .limit(1);

      if (!user?.mfaEnabled || !user.mfaSecret) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "MFA is not enabled for this account." });
      }

      const valid = verifyTotp(user.mfaSecret, input.token);
      if (!valid) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid TOTP code." });
      }

      return { success: true };
    }),

  /**
   * Use a one-time backup code (consumed on success — cannot be reused).
   */
  useBackupCode: protectedProcedure
    .input(z.object({ code: z.string().min(6).max(16) }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const [user] = await db
        .select({ mfaBackupCodes: users.mfaBackupCodes, mfaEnabled: users.mfaEnabled })
        .from(users)
        .where(eq(users.id, ctx.user.id))
        .limit(1);

      if (!user?.mfaEnabled || !user.mfaBackupCodes) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "MFA is not enabled for this account." });
      }

      let hashes: string[] = [];
      try { hashes = JSON.parse(user.mfaBackupCodes); } catch { /* empty */ }

      const idx = await verifyBackupCode(input.code, hashes);
      if (idx === -1) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid or already-used backup code." });
      }

      // Remove the used code
      hashes.splice(idx, 1);
      await db
        .update(users)
        .set({ mfaBackupCodes: JSON.stringify(hashes) })
        .where(eq(users.id, ctx.user.id));

      return { success: true, remainingCodes: hashes.length };
    }),

  /**
   * Disable MFA (requires current TOTP code for confirmation).
   */
  disableMfa: protectedProcedure
    .input(z.object({ token: z.string().length(6) }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const [user] = await db
        .select({ mfaSecret: users.mfaSecret, mfaEnabled: users.mfaEnabled })
        .from(users)
        .where(eq(users.id, ctx.user.id))
        .limit(1);

      if (!user?.mfaEnabled || !user.mfaSecret) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "MFA is not enabled for this account." });
      }

      if (!verifyTotp(user.mfaSecret, input.token)) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid TOTP code." });
      }

      await db
        .update(users)
        .set({ mfaSecret: null, mfaEnabled: false, mfaBackupCodes: null })
        .where(eq(users.id, ctx.user.id));

      logSecurityEvent({
        eventType: "mfa_disabled",
        userId: ctx.user.id,
        userEmail: ctx.user.email ?? null,
        userRole: ctx.user.role ?? null,
        ipAddress: extractIp(ctx.req as any),
        userAgent: (ctx.req as any).headers?.["user-agent"] ?? null,
      });
      return { success: true };
    }),

  /**
   * Regenerate backup codes (requires current TOTP code).
   * Old codes are immediately invalidated.
   */
  regenerateBackupCodes: protectedProcedure
    .input(z.object({ token: z.string().length(6) }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const [user] = await db
        .select({ mfaSecret: users.mfaSecret, mfaEnabled: users.mfaEnabled })
        .from(users)
        .where(eq(users.id, ctx.user.id))
        .limit(1);

      if (!user?.mfaEnabled || !user.mfaSecret) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "MFA is not enabled for this account." });
      }

      if (!verifyTotp(user.mfaSecret, input.token)) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid TOTP code." });
      }

      const plainCodes = generateBackupCodes();
      const hashedCodes = await hashBackupCodes(plainCodes);

      await db
        .update(users)
        .set({ mfaBackupCodes: JSON.stringify(hashedCodes) })
        .where(eq(users.id, ctx.user.id));

      return { success: true, backupCodes: plainCodes };
    }),
});
