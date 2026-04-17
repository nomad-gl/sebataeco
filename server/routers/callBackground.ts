/**
 * callBackground router
 *
 * Handles uploading custom video call background images to S3 and
 * persisting the user's selected background/filter preferences in their profile.
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { users } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

/** Shape stored in the callPrefs TEXT column (JSON-serialised). */
interface CallPrefs {
  backgroundId: string;   // e.g. "bg-01" | "blur" | "none" | "custom"
  filterId: string;       // e.g. "none" | "grayscale" | "warm" …
  blurIntensity: number;  // 1–5
  customBgUrl?: string;   // Only set when backgroundId === "custom"
}

export const callBackgroundRouter = router({
  /** Upload a custom background image (base64-encoded) and return its CDN URL. */
  upload: protectedProcedure
    .input(
      z.object({
        fileBase64: z.string(),
        mimeType: z.enum(["image/jpeg", "image/png", "image/webp", "image/gif"]),
        fileName: z.string().max(256),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { storagePut } = await import("../storage");

      const fileBuffer = Buffer.from(input.fileBase64, "base64");
      if (fileBuffer.length > MAX_SIZE_BYTES) {
        throw new Error("Image too large (max 5 MB)");
      }

      const ext = input.mimeType.split("/")[1] ?? "jpg";
      const fileKey = `call-backgrounds/${ctx.user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { url } = await storagePut(fileKey, fileBuffer, input.mimeType);

      return { url, fileKey };
    }),

  /**
   * Returns the user's persisted call preferences.
   * Falls back to sensible defaults if no prefs have been saved yet.
   */
  getCallPrefs: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return { backgroundId: "none", filterId: "none", blurIntensity: 4, customBgUrl: undefined };
    const [row] = await db
      .select({ callPrefs: users.callPrefs })
      .from(users)
      .where(eq(users.id, ctx.user.id))
      .limit(1);
    if (!row?.callPrefs) {
      return { backgroundId: "none", filterId: "none", blurIntensity: 4, customBgUrl: undefined } as CallPrefs;
    }
    try {
      return JSON.parse(row.callPrefs) as CallPrefs;
    } catch {
      return { backgroundId: "none", filterId: "none", blurIntensity: 4, customBgUrl: undefined } as CallPrefs;
    }
  }),

  /** Persists the user's call preferences to their profile row. */
  saveCallPrefs: protectedProcedure
    .input(
      z.object({
        backgroundId: z.string(),
        filterId: z.string(),
        blurIntensity: z.number().int().min(1).max(5),
        customBgUrl: z.string().url().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return { ok: false };
      await db
        .update(users)
        .set({ callPrefs: JSON.stringify(input) })
        .where(eq(users.id, ctx.user.id));
      return { ok: true };
    }),
});
