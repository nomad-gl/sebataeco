/**
 * callBackground router
 *
 * Handles uploading custom video call background images to S3.
 * Returns a CDN URL that the client stores in localStorage as a persistent custom background.
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";

const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

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
});
