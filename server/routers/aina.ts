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
  generateImage: protectedProcedure
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
  uploadFile: protectedProcedure
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
  extractDocumentText: protectedProcedure
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

        // Word documents (.docx, .doc) — use mammoth
        const isDocx =
          input.mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
          input.mimeType === "application/msword" ||
          !!input.fileName.toLowerCase().match(/\.(docx|doc)$/);
        if (isDocx) {
          try {
            const mammoth = await import("mammoth");
            const result = await mammoth.extractRawText({ buffer });
            const raw = result.value ?? "";
            const text = raw.slice(0, MAX_CHARS);
            return { text, truncated: raw.length > MAX_CHARS, error: null };
          } catch (docxErr) {
            console.error("[aina.extractDocumentText] DOCX parse error:", docxErr);
            return { text: "", truncated: false, error: "Word document extraction failed" };
          }
        }
        // Excel spreadsheets (.xlsx, .xls) — use xlsx
        const isXlsx =
          input.mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
          input.mimeType === "application/vnd.ms-excel" ||
          !!input.fileName.toLowerCase().match(/\.(xlsx|xls)$/);
        if (isXlsx) {
          try {
            const XLSX = await import("xlsx");
            const workbook = XLSX.read(buffer, { type: "buffer" });
            const lines: string[] = [];
            for (const sheetName of workbook.SheetNames) {
              const sheet = workbook.Sheets[sheetName];
              const csv = XLSX.utils.sheet_to_csv(sheet);
              lines.push(`[Sheet: ${sheetName}]`, csv);
            }
            const raw = lines.join("\n");
            const text = raw.slice(0, MAX_CHARS);
            return { text, truncated: raw.length > MAX_CHARS, error: null };
          } catch (xlsxErr) {
            console.error("[aina.extractDocumentText] XLSX parse error:", xlsxErr);
            return { text: "", truncated: false, error: "Spreadsheet extraction failed" };
          }
        }
        // PowerPoint (.pptx) — extract slide text via JSZip
        const isPptx =
          input.mimeType === "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
          input.mimeType === "application/vnd.ms-powerpoint" ||
          !!input.fileName.toLowerCase().match(/\.(pptx|ppt)$/);
        if (isPptx) {
          try {
            const JSZipMod = await import("jszip");
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const JSZip = ((JSZipMod as unknown) as { default?: { loadAsync: (b: Buffer) => Promise<{ files: Record<string, { async: (t: string) => Promise<string> }> }> }, loadAsync: (b: Buffer) => Promise<{ files: Record<string, { async: (t: string) => Promise<string> }> }> });
            const zipLoader = JSZip.default ?? JSZip;
            const zip = await zipLoader.loadAsync(buffer);
            const slideFiles = Object.keys(zip.files).filter((f) => /ppt\/slides\/slide[0-9]+\.xml$/.test(f)).sort();
            const slideTexts: string[] = [];
            for (const sf of slideFiles) {
              const xml = await zip.files[sf].async("text");
              const textNodes = xml.match(/<a:t[^>]*>([^<]*)<\/a:t>/g) ?? [];
              const slideText = textNodes.map((t) => t.replace(/<[^>]+>/g, "")).join(" ");
              if (slideText.trim()) slideTexts.push(slideText.trim());
            }
            const raw = slideTexts.join("\n\n");
            const text = raw.slice(0, MAX_CHARS);
            return { text, truncated: raw.length > MAX_CHARS, error: null };
          } catch (pptxErr) {
            console.error("[aina.extractDocumentText] PPTX parse error:", pptxErr);
            return { text: "", truncated: false, error: "Presentation extraction failed" };
          }
        }
        // OpenDocument (.odt, .ods, .odp) — extract content.xml text
        const isOdf =
          input.mimeType.includes("opendocument") ||
          !!input.fileName.toLowerCase().match(/\.(odt|ods|odp|odf)$/);
        if (isOdf) {
          try {
            const JSZipMod = await import("jszip");
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const JSZip2 = ((JSZipMod as unknown) as { default?: { loadAsync: (b: Buffer) => Promise<{ files: Record<string, { async: (t: string) => Promise<string> }> }> }, loadAsync: (b: Buffer) => Promise<{ files: Record<string, { async: (t: string) => Promise<string> }> }> });
            const zipLoader2 = JSZip2.default ?? JSZip2;
            const zip = await zipLoader2.loadAsync(buffer);
            const contentXml = await zip.files["content.xml"]?.async("text") ?? "";
            const raw = contentXml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
            const text = raw.slice(0, MAX_CHARS);
            return { text, truncated: raw.length > MAX_CHARS, error: null };
          } catch (odfErr) {
            console.error("[aina.extractDocumentText] ODF parse error:", odfErr);
            return { text: "", truncated: false, error: "OpenDocument extraction failed" };
          }
        }
        // Unsupported format — return empty (no error, just no context)
        return { text: "", truncated: false, error: null };
      } catch (err) {
        console.error("[aina.extractDocumentText] Error:", err);
        // Non-fatal: return empty text rather than throwing
        return { text: "", truncated: false, error: "Extraction failed" };
      }
    }),
  /**
   * Generate a downloadable .docx file from the improved document text
   * extracted from AINA's response (between [IMPROVED DOCUMENT START] and [IMPROVED DOCUMENT END] tags).
   * Returns a base64-encoded .docx file.
   */
  generateImprovedDocument: protectedProcedure
    .input(
      z.object({
        /** The full improved document text (plain text or markdown) */
        content: z.string().max(50000),
        /** Original file name — used to derive the output name */
        originalFileName: z.string().max(200).optional(),
        /** Title for the document */
        title: z.string().max(200).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const {
        Document, Paragraph, TextRun, HeadingLevel, Packer,
        AlignmentType, BorderStyle, convertInchesToTwip, convertMillimetersToTwip,
        LevelFormat, NumberFormat,
      } = await import("docx");

      // ── Constants ──────────────────────────────────────────────────────────
      const FONT       = "Arial";
      const BODY_SIZE  = 22;   // half-points → 11pt
      const H1_SIZE    = 28;   // 14pt
      const H2_SIZE    = 26;   // 13pt
      const H3_SIZE    = 24;   // 12pt
      const TITLE_SIZE = 36;   // 18pt
      const DARK_BLUE  = "1F3864";
      const MID_BLUE   = "2E5FA3";
      const LIGHT_GREY = "F2F2F2";
      const LINE_SPACE = 276;  // ~1.15 line spacing in twips (240 = single)
      const PARA_AFTER = 120;  // 6pt spacing after each paragraph

      // ── Helper: parse inline markdown (bold, italic, bold-italic) ──────────
      function parseInlineRuns(text: string, baseSize = BODY_SIZE, baseFont = FONT): InstanceType<typeof TextRun>[] {
        // Split on **bold**, *italic*, ***bold-italic***
        const tokens = text.split(/(\*\*\*[^*]+\*\*\*|\*\*[^*]+\*\*|\*[^*]+\*)/g);
        return tokens.filter(t => t.length > 0).map(tok => {
          if (tok.startsWith("***") && tok.endsWith("***")) {
            return new TextRun({ text: tok.slice(3, -3), bold: true, italics: true, font: baseFont, size: baseSize });
          } else if (tok.startsWith("**") && tok.endsWith("**")) {
            return new TextRun({ text: tok.slice(2, -2), bold: true, font: baseFont, size: baseSize });
          } else if (tok.startsWith("*") && tok.endsWith("*")) {
            return new TextRun({ text: tok.slice(1, -1), italics: true, font: baseFont, size: baseSize });
          }
          return new TextRun({ text: tok, font: baseFont, size: baseSize });
        });
      }

      const title = input.title ?? (input.originalFileName
        ? `Improved_${input.originalFileName.replace(/\.[^.]+$/, "")}`
        : "AINA_Improved_Document");

      // ── Parse lines into Paragraph objects ────────────────────────────────
      const lines = input.content.split("\n");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const children: InstanceType<typeof Paragraph>[] = [];
      let inNumberedList = false;
      let listCounter = 1;

      for (const line of lines) {
        const trimmed = line.trim();

        if (!trimmed) {
          inNumberedList = false;
          listCounter = 1;
          children.push(new Paragraph({
            children: [new TextRun({ text: "", font: FONT, size: BODY_SIZE })],
            spacing: { after: 60 },
          }));
          continue;
        }

        // Headings
        if (trimmed.startsWith("### ")) {
          inNumberedList = false;
          children.push(new Paragraph({
            children: [new TextRun({ text: trimmed.slice(4), font: FONT, size: H3_SIZE, bold: true, color: MID_BLUE })],
            spacing: { before: 200, after: 80, line: LINE_SPACE },
          }));
          continue;
        }
        if (trimmed.startsWith("## ")) {
          inNumberedList = false;
          children.push(new Paragraph({
            children: [new TextRun({ text: trimmed.slice(3), font: FONT, size: H2_SIZE, bold: true, color: MID_BLUE })],
            spacing: { before: 240, after: 100, line: LINE_SPACE },
            border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC", space: 4 } },
          }));
          continue;
        }
        if (trimmed.startsWith("# ")) {
          inNumberedList = false;
          children.push(new Paragraph({
            children: [new TextRun({ text: trimmed.slice(2), font: FONT, size: H1_SIZE, bold: true, color: DARK_BLUE })],
            spacing: { before: 320, after: 120, line: LINE_SPACE },
            border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "2E5FA3", space: 4 } },
          }));
          continue;
        }

        // Horizontal rule
        if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
          children.push(new Paragraph({
            children: [],
            border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC", space: 2 } },
            spacing: { before: 120, after: 120 },
          }));
          continue;
        }

        // Numbered list  "1. item" or "1) item"
        const numMatch = trimmed.match(/^(\d+)[.)\s]\s+(.*)/);
        if (numMatch) {
          inNumberedList = true;
          children.push(new Paragraph({
            children: parseInlineRuns(numMatch[2]),
            numbering: { reference: "numbered-list", level: 0 },
            spacing: { after: 60, line: LINE_SPACE },
          }));
          continue;
        }

        // Bullet list
        if (trimmed.startsWith("- ") || trimmed.startsWith("* ") || trimmed.startsWith("• ")) {
          inNumberedList = false;
          const bulletText = trimmed.startsWith("• ") ? trimmed.slice(2) : trimmed.slice(2);
          children.push(new Paragraph({
            children: parseInlineRuns(bulletText),
            bullet: { level: 0 },
            spacing: { after: 60, line: LINE_SPACE },
          }));
          continue;
        }

        // Indented bullet (sub-item)
        if (trimmed.startsWith("  - ") || trimmed.startsWith("  * ")) {
          children.push(new Paragraph({
            children: parseInlineRuns(trimmed.slice(4)),
            bullet: { level: 1 },
            spacing: { after: 40, line: LINE_SPACE },
          }));
          continue;
        }

        // Blockquote / note
        if (trimmed.startsWith("> ")) {
          inNumberedList = false;
          children.push(new Paragraph({
            children: parseInlineRuns(trimmed.slice(2)),
            indent: { left: convertInchesToTwip(0.4) },
            spacing: { before: 80, after: 80, line: LINE_SPACE },
            shading: { type: "clear", fill: LIGHT_GREY },
            border: { left: { style: BorderStyle.SINGLE, size: 12, color: MID_BLUE, space: 8 } },
          }));
          continue;
        }

        // Normal paragraph
        inNumberedList = false;
        children.push(new Paragraph({
          children: parseInlineRuns(trimmed),
          spacing: { after: PARA_AFTER, line: LINE_SPACE },
          alignment: AlignmentType.JUSTIFIED,
        }));
      }

      // ── Assemble document ─────────────────────────────────────────────────
      const doc = new Document({
        numbering: {
          config: [{
            reference: "numbered-list",
            levels: [{
              level: 0,
              format: LevelFormat.DECIMAL,
              text: "%1.",
              alignment: AlignmentType.LEFT,
              style: {
                paragraph: { indent: { left: convertInchesToTwip(0.25), hanging: convertInchesToTwip(0.25) } },
                run: { font: FONT, size: BODY_SIZE },
              },
            }],
          }],
        },
        styles: {
          default: {
            document: {
              run: { font: FONT, size: BODY_SIZE },
              paragraph: { spacing: { after: PARA_AFTER, line: LINE_SPACE } },
            },
          },
        },
        sections: [{
          properties: {
            page: {
              margin: {
                top:    convertMillimetersToTwip(25),
                bottom: convertMillimetersToTwip(25),
                left:   convertMillimetersToTwip(25),
                right:  convertMillimetersToTwip(25),
              },
            },
          },
          children: [
            // Document title
            new Paragraph({
              children: [new TextRun({ text: title, font: FONT, size: TITLE_SIZE, bold: true, color: DARK_BLUE })],
              spacing: { before: 0, after: 200 },
              border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: DARK_BLUE, space: 6 } },
            }),
            // Subtitle / generated-by line
            new Paragraph({
              children: [new TextRun({ text: "Generated by AINA · LOMLOE-aligned improvement", font: FONT, size: 18, italics: true, color: "888888" })],
              spacing: { after: 320 },
            }),
            ...children,
          ],
        }],
      });

      const buffer = await Packer.toBuffer(doc);
      const base64 = buffer.toString("base64");
      const outputName = `${title.replace(/[^a-zA-Z0-9_-]/g, "_")}.docx`;
      return { base64, fileName: outputName };
    }),

});
