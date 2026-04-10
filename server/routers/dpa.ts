/**
 * dpa.ts — Data Processing Agreement acceptance router
 *
 * Tracks whether each user has accepted the current DPA version.
 * Required for GDPR Article 28 compliance.
 */

import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { dpaAcceptances } from "../../drizzle/schema";
import { eq, desc } from "drizzle-orm";

/** Current DPA version — bump this string to force re-acceptance after a DPA update */
const CURRENT_DPA_VERSION = "1.0";

export const dpaRouter = router({
  /**
   * Returns whether the current user has accepted the current DPA version,
   * and the acceptance timestamp if they have.
   */
  getStatus: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    const rows = await db
      .select()
      .from(dpaAcceptances)
      .where(eq(dpaAcceptances.userId, ctx.user.id))
      .orderBy(desc(dpaAcceptances.acceptedAt))
      .limit(1);

    const latest = rows[0] ?? null;
    const accepted = latest?.dpaVersion === CURRENT_DPA_VERSION;

    return {
      accepted,
      currentVersion: CURRENT_DPA_VERSION,
      acceptedAt: accepted && latest?.acceptedAt
        ? (latest.acceptedAt instanceof Date
            ? latest.acceptedAt.getTime()
            : Number(latest.acceptedAt))
        : null,
    };
  }),

  /**
   * Records the user's acceptance of the current DPA version.
   */
  accept: protectedProcedure
    .input(z.object({ ipAddress: z.string().nullish() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Anonymise IP to /24 prefix for privacy
      const anonIp = input.ipAddress
        ? input.ipAddress.split(".").slice(0, 3).join(".") + ".0"
        : null;

      await db.insert(dpaAcceptances).values({
        userId: ctx.user.id,
        dpaVersion: CURRENT_DPA_VERSION,
        ipAddress: anonIp ?? undefined,
      });

      return { accepted: true, version: CURRENT_DPA_VERSION };
    }),
});
