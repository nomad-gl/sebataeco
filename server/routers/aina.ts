/**
 * Aina router — image generation and file upload for the Aina AI chat.
 *
 * Procedures:
 *   aina.generateImage  — prompt → generates an image via the Forge service, returns { url }
 *   aina.uploadFile     — base64 file → stores in S3, returns { url, fileName, mimeType }
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { publicProcedure, router } from "../_core/trpc";
import { generateImage } from "../_core/imageGeneration";
import { storagePut } from "../storage";

// ─── Router ───────────────────────────────────────────────────────────────────

export const ainaRouter = router({
  /**
   * Generate an image from a text prompt.
   * Called when the user asks Aina to create/draw/generate an image.
   * Returns a public S3 URL for the generated image.
   */
  generateImage: publicProcedure
    .input(
      z.object({
        prompt: z.string().min(1).max(1000),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const { url } = await generateImage({ prompt: input.prompt });
        return { url };
      } catch (err) {
        console.error("[aina.generateImage] Error:", err);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Image generation failed. Please try again.",
        });
      }
    }),

  /**
   * Upload a file (image, PDF, document, etc.) from the Aina chat.
   * Accepts a base64-encoded file blob, stores it in S3, and returns
   * the public URL along with metadata so the chat can render/link it.
   */
  uploadFile: publicProcedure
    .input(
      z.object({
        fileBase64: z.string(),
        fileName: z.string(),
        mimeType: z.string(),
        /** File size in bytes — used for validation only */
        fileSize: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      // 16 MB limit
      const MAX_SIZE = 16 * 1024 * 1024;
      if (input.fileSize && input.fileSize > MAX_SIZE) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "File exceeds the 16 MB size limit.",
        });
      }

      const buffer = Buffer.from(input.fileBase64, "base64");
      if (buffer.byteLength > MAX_SIZE) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "File exceeds the 16 MB size limit.",
        });
      }

      // Sanitise the file name and derive extension
      const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100);
      const ext = safeName.split(".").pop() ?? "bin";
      const key = `aina-uploads/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      const { url } = await storagePut(key, buffer, input.mimeType);
      return { url, fileName: input.fileName, mimeType: input.mimeType };
    }),
});
