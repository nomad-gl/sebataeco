/**
 * Situació d'Aprenentatge PDF generator.
 * Produces a polished A4 PDF with:
 *  - Branded header (school logo + title) on every page
 *  - Key Activities on a new page
 *  - Assessment Criteria on a new page
 *  - Footer with page numbers and "Powered by SEBA" on every page
 */

import PDFDocument from "pdfkit";

export interface SituacioPdfInput {
  title: string;
  subject: string;
  yearGroup: string;
  schoolName?: string | null;
  teacherName?: string | null;
  classGroup?: string | null;
  date?: string | null;
  logoUrl?: string | null;
  lang?: "en" | "es" | "ca";
  result: {
    context: string;
    task: string;
    competencies: { code: string; description: string }[];
    criteria: string[];
    activities: { phase: string; description: string }[];
    lomloeRef: string;
  };
}

const LABELS = {
  en: {
    context: "Context & Justification",
    task: "Central Task",
    competencies: "Competencies Addressed",
    activities: "Key Activities",
    criteria: "Assessment Criteria",
    powered_by: "Powered by SEBA AI Studio",
  },
  es: {
    context: "Contexto y Justificación",
    task: "Tarea Central",
    competencies: "Competencias Trabajadas",
    activities: "Actividades Clave",
    criteria: "Criterios de Evaluación",
    powered_by: "Powered by SEBA AI Studio",
  },
  ca: {
    context: "Context i Justificació",
    task: "Tasca Central",
    competencies: "Competències Treballades",
    activities: "Activitats Clau",
    criteria: "Criteris d'Avaluació",
    powered_by: "Powered by SEBA AI Studio",
  },
};

const BRAND_BLUE = "#4f46e5";
const LIGHT_BLUE = "#e0e7ff";
const DARK = "#111827";
const MID_GREY = "#6b7280";
const ACCENT = "#6d28d9";

export async function generateSituacioPdf(input: SituacioPdfInput): Promise<Buffer> {
  const L = LABELS[input.lang ?? "en"] ?? LABELS.en;

  // Pre-fetch school logo outside the Promise constructor
  let logoBuf: Buffer | null = null;
  if (input.logoUrl) {
    try {
      if (input.logoUrl.startsWith("data:")) {
        const base64 = input.logoUrl.split(",")[1];
        if (base64) logoBuf = Buffer.from(base64, "base64");
      } else {
        const res = await fetch(input.logoUrl);
        logoBuf = Buffer.from(await res.arrayBuffer());
      }
    } catch { /* skip logo if fetch fails */ }
  }

  return new Promise((resolve, reject) => {
    const MARGIN = 48;
    const doc = new PDFDocument({ margin: MARGIN, size: "A4", bufferPages: true, info: { Title: input.title } });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const W = doc.page.width - MARGIN * 2;
    const FOOTER_H = 40;
    const HEADER_BAND_H = 72;
    const dateStr = new Date().toLocaleDateString("ca-ES", { day: "2-digit", month: "2-digit", year: "numeric" });

    // ── Helper: draw branded header band ─────────────────────────────────────
    function drawHeader() {
      const x = MARGIN;
      const y = MARGIN;
      doc.rect(x, y, W, HEADER_BAND_H).fillColor(BRAND_BLUE).fill();

      // Logo (if available)
      let textX = x + 12;
      if (logoBuf) {
        try {
          doc.image(logoBuf, x + 10, y + 8, { height: 56, fit: [56, 56] });
          textX = x + 76;
        } catch { /* skip if image fails */ }
      }

      // Title
      doc.fontSize(13).fillColor("#ffffff").font("Helvetica-Bold")
        .text(input.title, textX, y + 10, { width: W - (textX - x) - 12, lineBreak: false });

      // Sub-line: subject · year group
      const subLine = [input.subject, input.yearGroup].filter(Boolean).join(" · ");
      doc.fontSize(8).fillColor("rgba(255,255,255,0.75)").font("Helvetica")
        .text(subLine, textX, y + 30, { width: W - (textX - x) - 12 });

      // School name + meta
      const metaLine = [input.schoolName, input.teacherName, input.classGroup, input.date].filter(Boolean).join(" · ");
      if (metaLine) {
        doc.fontSize(7).fillColor("rgba(255,255,255,0.6)").font("Helvetica")
          .text(metaLine, textX, y + 46, { width: W - (textX - x) - 12 });
      }

      // Reset cursor below the header band
      doc.y = y + HEADER_BAND_H + 16;
    }

    // ── Helper: draw footer on a specific page ────────────────────────────────
    function drawFooter(pageNum: number, totalPages: number) {
      const footerY = doc.page.height - FOOTER_H;
      doc.moveTo(MARGIN, footerY).lineTo(MARGIN + W, footerY)
        .strokeColor(BRAND_BLUE).lineWidth(0.5).stroke();
      doc.fontSize(7).fillColor(MID_GREY).font("Helvetica")
        .text(dateStr, MARGIN, footerY + 8, { width: W / 3, align: "left" })
        .text(`${pageNum} / ${totalPages}`, MARGIN, footerY + 8, { width: W, align: "center" })
        .text(L.powered_by, MARGIN, footerY + 8, { width: W, align: "right" });
    }

    // ── Helper: section heading ───────────────────────────────────────────────
    function sectionHeading(label: string) {
      doc.moveDown(0.4);
      const y = doc.y;
      doc.rect(MARGIN, y, W, 20).fillColor(LIGHT_BLUE).fill();
      doc.fontSize(9).fillColor(BRAND_BLUE).font("Helvetica-Bold")
        .text(label.toUpperCase(), MARGIN + 8, y + 6, { width: W - 16 });
      doc.y = y + 24;
    }

    // ── Helper: check if we need a new page (leaving room for footer) ─────────
    function checkPage(neededHeight = 60) {
      if (doc.y + neededHeight > doc.page.height - FOOTER_H - 20) {
        doc.addPage();
        drawHeader();
      }
    }

    // ── Page 1: Header + Context + Task + Competencies ───────────────────────
    drawHeader();

    // Context
    sectionHeading(L.context);
    doc.fontSize(10).fillColor(DARK).font("Helvetica")
      .text(input.result.context, MARGIN, doc.y, { width: W, lineGap: 2 });

    checkPage(80);

    // Task
    sectionHeading(L.task);
    doc.fontSize(10).fillColor(DARK).font("Helvetica")
      .text(input.result.task, MARGIN, doc.y, { width: W, lineGap: 2 });

    checkPage(80);

    // Competencies
    sectionHeading(L.competencies);
    for (const comp of input.result.competencies) {
      checkPage(40);
      const badgeW = 44;
      const badgeY = doc.y;
      doc.rect(MARGIN, badgeY, badgeW, 16).fillColor(LIGHT_BLUE).fill();
      doc.fontSize(8).fillColor(BRAND_BLUE).font("Helvetica-Bold")
        .text(comp.code, MARGIN + 2, badgeY + 4, { width: badgeW - 4, align: "center" });
      doc.fontSize(9.5).fillColor(DARK).font("Helvetica")
        .text(comp.description, MARGIN + badgeW + 8, badgeY + 3, { width: W - badgeW - 8, lineGap: 1 });
      doc.y = Math.max(doc.y, badgeY + 20);
      doc.moveDown(0.3);
    }

    // ── Page 2: Key Activities ────────────────────────────────────────────────
    doc.addPage();
    drawHeader();
    sectionHeading(L.activities);

    for (let i = 0; i < input.result.activities.length; i++) {
      const act = input.result.activities[i];
      checkPage(60);
      const numY = doc.y;
      // Circle number
      doc.circle(MARGIN + 10, numY + 8, 10).fillColor(ACCENT).fill();
      doc.fontSize(8).fillColor("#ffffff").font("Helvetica-Bold")
        .text(String(i + 1), MARGIN + 6, numY + 4, { width: 10, align: "center" });
      // Phase label
      doc.fontSize(8).fillColor(ACCENT).font("Helvetica-Bold")
        .text(act.phase.toUpperCase(), MARGIN + 26, numY + 2, { width: W - 26 });
      // Description
      doc.fontSize(9.5).fillColor(DARK).font("Helvetica")
        .text(act.description, MARGIN + 26, doc.y + 2, { width: W - 26, lineGap: 1 });
      doc.moveDown(0.5);
    }

    // ── Page 3: Assessment Criteria ───────────────────────────────────────────
    doc.addPage();
    drawHeader();
    sectionHeading(L.criteria);

    for (let i = 0; i < input.result.criteria.length; i++) {
      checkPage(36);
      const itemY = doc.y;
      doc.rect(MARGIN, itemY, 20, 16).fillColor(BRAND_BLUE).fill();
      doc.fontSize(8).fillColor("#ffffff").font("Helvetica-Bold")
        .text(String(i + 1), MARGIN + 2, itemY + 4, { width: 16, align: "center" });
      doc.fontSize(9.5).fillColor(DARK).font("Helvetica")
        .text(input.result.criteria[i], MARGIN + 26, itemY + 3, { width: W - 26, lineGap: 1 });
      doc.y = Math.max(doc.y, itemY + 20);
      doc.moveDown(0.3);
    }

    // LOMLOE reference
    doc.moveDown(1);
    checkPage(30);
    doc.fontSize(8).fillColor(MID_GREY).font("Helvetica-Oblique")
      .text(input.result.lomloeRef, MARGIN, doc.y, { width: W });

    // ── Stamp footers on all buffered pages ───────────────────────────────────
    const range = doc.bufferedPageRange();
    const totalPages = range.count;
    for (let i = 0; i < totalPages; i++) {
      doc.switchToPage(range.start + i);
      drawFooter(i + 1, totalPages);
    }

    doc.flushPages();
    doc.end();
  });
}
