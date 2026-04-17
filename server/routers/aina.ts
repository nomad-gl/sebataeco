/**
 * Aina router — image generation, file upload, image library save, and document text extraction.
 *
 * Procedures:
 *   aina.generateImage      — prompt → generates an image via the Forge service, returns { url }
 *   aina.uploadFile         — base64 file → stores in S3, returns { url, fileName, mimeType }
 *   aina.saveGeneratedImage — saves a generated image to the user's My Materials library (protected)
 *   aina.extractDocumentText — extracts plain text from an uploaded PDF or text file for chat context
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { generateImage } from "../_core/imageGeneration";
import { storagePut } from "../storage";
import { saveMaterial } from "../db";

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

  /**
   * Save a generated image to the user's My Materials library.
   * Creates a new teaching_material of type 'image' with the image URL embedded.
   * Requires authentication.
   */
  saveGeneratedImage: protectedProcedure
    .input(
      z.object({
        imageUrl: z.string().url(),
        prompt: z.string().max(500),
        title: z.string().max(200).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const title = input.title ?? `Generated image: ${input.prompt.slice(0, 60)}`;
      const content = JSON.stringify({
        imageUrl: input.imageUrl,
        prompt: input.prompt,
        savedAt: new Date().toISOString(),
      });
      const id = await saveMaterial({
        userId: ctx.user.id,
        type: "image" as const,
        title,
        topic: input.prompt,
        competency: null,
        yearGroup: null,
        content,
      });
      return { id, title };
    }),

  /**
   * Extract plain text from an uploaded file for use as Aina chat context.
   *
   * Supported formats:
   *   - PDF  → text extracted via pdf-parse
   *   - text/* (txt, csv, md, etc.) → decoded directly from base64
   *   - Other formats → returns empty string (graceful degradation)
   *
   * The extracted text is truncated to 8 000 characters to stay within
   * the LLM context window budget.
   */
  extractDocumentText: publicProcedure
    .input(
      z.object({
        fileBase64: z.string(),
        mimeType: z.string(),
        fileName: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const MAX_CHARS = 8000;

      try {
        const buffer = Buffer.from(input.fileBase64, "base64");

        // PDF extraction
        if (input.mimeType === "application/pdf" || input.fileName.toLowerCase().endsWith(".pdf")) {
          try {
            // pdf-parse v2 uses a class-based API: new PDFParse({ data: Uint8Array }).getText()
            const { PDFParse } = await import("pdf-parse");
            const parser = new PDFParse({ data: new Uint8Array(buffer) });
            const result = await parser.getText();
            const raw = (result as { document?: string; text?: string }).document ?? (result as { document?: string; text?: string }).text ?? "";
            const text = raw.slice(0, MAX_CHARS);
            return { text, truncated: raw.length > MAX_CHARS, error: null };
          } catch (pdfErr) {
            console.error("[aina.extractDocumentText] PDF parse error:", pdfErr);
            return { text: "", truncated: false, error: "PDF extraction failed" };
          }
        }

        // Plain text / CSV / Markdown
        if (
          input.mimeType.startsWith("text/") ||
          input.fileName.toLowerCase().match(/\.(txt|csv|md|markdown|log)$/)
        ) {
          const raw = buffer.toString("utf-8");
          const text = raw.slice(0, MAX_CHARS);
          return { text, truncated: raw.length > MAX_CHARS, error: null };
        }

        // Unsupported format — return empty (no error, just no context)
        return { text: "", truncated: false, error: null };
      } catch (err) {
        console.error("[aina.extractDocumentText] Error:", err);
        // Non-fatal: return empty text rather than throwing
        return { text: "", truncated: false, error: "Extraction failed" };
      }
    }),
});
