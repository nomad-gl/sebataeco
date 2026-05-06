/**
 * Presentations router — server-side PDF generation for slide decks.
 * Uses PDFKit to produce clean, print-ready A4 PDFs from slide data.
 */

import { z } from "zod";
import PDFDocument from "pdfkit";
import { protectedProcedure, router } from "../_core/trpc";
import { storagePut } from "../storage";
import { generateImage } from "../_core/imageGeneration";
import { TRPCError } from "@trpc/server";

const slideSchema = z.object({
  title: z.string(),
  content: z.string(),
  speakerNotes: z.string().nullish(),
  keyVocabulary: z.array(z.string()).nullish(),
  competencyTag: z.string().nullish(),
});

export const presentationsRouter = router({
  /**
   * Generate an AI image for a slide using its imagePrompt.
   */
  generateSlideImage: protectedProcedure
    .input(z.object({ prompt: z.string().min(1).max(500) }))
    .mutation(async ({ input }) => {
      try {
        const result = await generateImage({ prompt: input.prompt });
        if (!result.url) {
          console.error("[generateSlideImage] Image generation returned no URL", result);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Image generation failed: no URL returned",
          });
        }
        return { url: result.url };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error("[generateSlideImage] Error generating image:", errorMsg);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Image generation failed: ${errorMsg}`,
        });
      }
    }),

  /**
   * Generate a PDF from slide data and return a temporary S3 URL.
   * The PDF is stored in S3 and the URL is returned to the client for download.
   */
  exportPdf: protectedProcedure
    .input(
      z.object({
        title: z.string(),
        subject: z.string().nullish(),
        yearGroup: z.string().nullish(),
        competency: z.string().nullish(),
        slides: z.array(slideSchema),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const pdfBuffer = await generatePresentationPdf({
        ...input,
        subject: input.subject ?? undefined,
        yearGroup: input.yearGroup ?? undefined,
        competency: input.competency ?? undefined,
        slides: input.slides.map(s => ({
          ...s,
          speakerNotes: s.speakerNotes ?? undefined,
          keyVocabulary: s.keyVocabulary ?? undefined,
          competencyTag: s.competencyTag ?? undefined,
        })),
      });
      const fileKey = `presentation-exports/${ctx.user.id}-${Date.now()}.pdf`;
      const { url } = await storagePut(fileKey, pdfBuffer, "application/pdf");
      return { url };
    }),
});

// ─── PDF generation ───────────────────────────────────────────────────────────

type PdfInput = {
  title: string;
  subject?: string;
  yearGroup?: string;
  competency?: string;
  slides: Array<{
    title: string;
    content: string;
    speakerNotes?: string;
    keyVocabulary?: string[];
    competencyTag?: string;
  }>;
};

async function generatePresentationPdf(data: PdfInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      layout: "landscape",
      margin: 40,
      info: {
        Title: data.title,
        Author: "SEBA | Teach",
        Subject: data.subject ?? "",
      },
    });

    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageW = doc.page.width;
    const pageH = doc.page.height;
    const margin = 40;
    const contentW = pageW - margin * 2;

    // Colours
    const DARK_BG = "#1e3a5f";
    const ACCENT = "#3b82f6";
    const LIGHT = "#ffffff";
    const MUTED = "#93c5fd";
    const BODY_BG = "#f0f4ff";

    // ── Cover slide ──────────────────────────────────────────────────────────
    doc.rect(0, 0, pageW, pageH).fill(DARK_BG);

    // Accent bar
    doc.rect(0, pageH - 8, pageW, 8).fill(ACCENT);

    // Title
    doc
      .font("Helvetica-Bold")
      .fontSize(32)
      .fillColor(LIGHT)
      .text(data.title, margin, pageH / 2 - 60, { width: contentW, align: "center" });

    // Meta row
    const meta = [data.subject, data.yearGroup, data.competency].filter(Boolean).join("  ·  ");
    if (meta) {
      doc
        .font("Helvetica")
        .fontSize(13)
        .fillColor(MUTED)
        .text(meta, margin, pageH / 2 + 10, { width: contentW, align: "center" });
    }

    // Slide count badge
    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor(MUTED)
      .text(`${data.slides.length} slides  ·  SEBA | Teach`, margin, pageH - 30, {
        width: contentW,
        align: "center",
      });

    // ── Content slides ───────────────────────────────────────────────────────
    data.slides.forEach((slide, idx) => {
      doc.addPage();

      // Background
      doc.rect(0, 0, pageW, pageH).fill(BODY_BG);

      // Header bar
      doc.rect(0, 0, pageW, 56).fill(DARK_BG);

      // Slide number pill
      doc
        .roundedRect(margin, 14, 28, 28, 6)
        .fill(ACCENT);
      doc
        .font("Helvetica-Bold")
        .fontSize(12)
        .fillColor(LIGHT)
        .text(String(idx + 1), margin, 20, { width: 28, align: "center" });

      // Slide title
      doc
        .font("Helvetica-Bold")
        .fontSize(18)
        .fillColor(LIGHT)
        .text(slide.title, margin + 38, 17, { width: contentW - 38 - 60, lineBreak: false });

      // Competency tag
      if (slide.competencyTag) {
        doc
          .font("Helvetica")
          .fontSize(9)
          .fillColor(MUTED)
          .text(slide.competencyTag, pageW - margin - 60, 22, { width: 60, align: "right" });
      }

      // Content body
      const bodyTop = 72;
      const bodyH = pageH - bodyTop - (slide.speakerNotes ? 90 : 20) - margin;

      doc
        .font("Helvetica")
        .fontSize(13)
        .fillColor("#1e293b")
        .text(slide.content, margin, bodyTop, {
          width: slide.keyVocabulary?.length ? contentW * 0.62 : contentW,
          height: bodyH,
          lineGap: 4,
        });

      // Key vocabulary panel
      if (slide.keyVocabulary && slide.keyVocabulary.length > 0) {
        const vocabX = margin + contentW * 0.66;
        const vocabW = contentW * 0.34;

        doc.rect(vocabX - 8, bodyTop - 6, vocabW + 8, bodyH + 6).fill("#dbeafe");
        doc
          .font("Helvetica-Bold")
          .fontSize(9)
          .fillColor(ACCENT)
          .text("KEY VOCABULARY", vocabX, bodyTop + 2, { width: vocabW });

        slide.keyVocabulary.slice(0, 8).forEach((term, vi) => {
          doc
            .font("Helvetica")
            .fontSize(10)
            .fillColor("#1e293b")
            .text(`• ${term}`, vocabX, bodyTop + 18 + vi * 16, { width: vocabW });
        });
      }

      // Speaker notes footer
      if (slide.speakerNotes?.trim()) {
        const notesTop = pageH - 80;
        doc.rect(0, notesTop, pageW, 80).fill("#e2e8f0");
        doc
          .font("Helvetica-Bold")
          .fontSize(8)
          .fillColor("#64748b")
          .text("SPEAKER NOTES", margin, notesTop + 8);
        doc
          .font("Helvetica")
          .fontSize(9)
          .fillColor("#334155")
          .text(slide.speakerNotes, margin, notesTop + 20, {
            width: contentW,
            height: 50,
            lineGap: 2,
          });
      }

      // Footer bar
      doc.rect(0, pageH - 8, pageW, 8).fill(ACCENT);
    });

    doc.end();
  });
}
