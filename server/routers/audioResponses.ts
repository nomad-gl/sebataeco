import { z } from "zod";
import { router, adminProcedure, publicProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { audioResponses, type AudioResponse } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { storagePut } from "../storage";
import { assertFileSafe } from "../security/fileScanner";
import { randomBytes } from "crypto";
import { generateSpellingVariations, mergeVariations } from "../../shared/spellingVariations";

function randomSuffix() {
  return randomBytes(6).toString("hex");
}

function parseRow(r: AudioResponse) {
  return {
    ...r,
    triggerPhrases: (() => {
      try { return JSON.parse(r.triggerPhrases) as string[]; } catch { return [] as string[]; }
    })(),
  };
}

export const audioResponsesRouter = router({
  /** Public: list all active audio responses (for playback in AIChatBox) */
  listActive: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const rows = await db
      .select()
      .from(audioResponses)
      .where(eq(audioResponses.isActive, true));
    return rows.map(parseRow);
  }),

  /** Admin: list all audio responses */
  list: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const rows = await db.select().from(audioResponses);
    return rows.map(parseRow);
  }),

  /** Admin: upload a new audio file (base64 encoded) */
  upload: adminProcedure
    .input(
      z.object({
        label: z.string().min(1).max(256),
        triggerPhrases: z.array(z.string()).default([]),
        fileName: z.string(),
        mimeType: z.string(),
        base64Data: z.string(), // base64-encoded file content
        durationSecs: z.number().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const buffer = Buffer.from(input.base64Data, "base64");
      await assertFileSafe({ buffer, mimeType: input.mimeType, fileName: input.fileName, context: "audio-response" });
      const ext = input.fileName.split(".").pop() ?? "mp3";
      const fileKey = `audio-responses/${randomSuffix()}-${Date.now()}.${ext}`;
      const { url } = await storagePut(fileKey, buffer, input.mimeType);

      // Auto-generate spelling variations for each trigger phrase
      const autoVariants: string[] = [];
      for (const trigger of input.triggerPhrases) {
        const vars = generateSpellingVariations(trigger, 10);
        autoVariants.push(...vars);
      }
      const enrichedTriggers = mergeVariations(input.triggerPhrases, autoVariants);

      await db.insert(audioResponses).values({
        label: input.label,
        triggerPhrases: JSON.stringify(enrichedTriggers),
        fileUrl: url,
        fileKey,
        mimeType: input.mimeType,
        durationSecs: input.durationSecs ?? null,
        isActive: true,
        createdBy: ctx.user.openId,
      });

      return { success: true };
    }),

  /** Admin: delete an audio response and its S3 file */
  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.delete(audioResponses).where(eq(audioResponses.id, input.id));
      return { success: true };
    }),

  /** Admin: toggle isActive */
  toggleActive: adminProcedure
    .input(z.object({ id: z.number(), isActive: z.boolean() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db
        .update(audioResponses)
        .set({ isActive: input.isActive })
        .where(eq(audioResponses.id, input.id));
      return { success: true };
    }),

  /** Admin: update label and trigger phrases */
  update: adminProcedure
    .input(
      z.object({
        id: z.number(),
        label: z.string().min(1).max(256).optional(),
        triggerPhrases: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const patch: Record<string, unknown> = {};
      if (input.label !== undefined) patch.label = input.label;
      if (input.triggerPhrases !== undefined) {
        // Auto-generate spelling variations for each trigger phrase on update
        const autoVariants: string[] = [];
        for (const trigger of input.triggerPhrases) {
          const vars = generateSpellingVariations(trigger, 10);
          autoVariants.push(...vars);
        }
        const enrichedTriggers = mergeVariations(input.triggerPhrases, autoVariants);
        patch.triggerPhrases = JSON.stringify(enrichedTriggers);
      }
      if (Object.keys(patch).length > 0) {
        await db
          .update(audioResponses)
          .set(patch)
          .where(eq(audioResponses.id, input.id));
      }
      return { success: true };
    }),
});
