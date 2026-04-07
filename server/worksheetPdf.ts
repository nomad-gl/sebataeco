/**
 * worksheetPdf.ts
 * Generates LOMLOE question worksheets as PDF buffers using PDFKit.
 * Produces two versions: with answers and without answers.
 *
 * Design rules (per knowledge bank guidelines):
 * - Without-answers version: shows a single underline per question for the student to write on.
 * - With-answers version: correct option is highlighted; all options shown.
 */

import PDFDocument from "pdfkit";

export interface WorksheetQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  competency: string;
  yearGroup: string;
  explanation?: string;
}

interface WorksheetOptions {
  title: string;
  subtitle?: string;
  questions: WorksheetQuestion[];
  includeAnswers: boolean;
  locale: "en" | "es" | "ca";
  logoDataUrl?: string; // base64 data URL (PNG/JPG/SVG) from client localStorage
}

const LABELS = {
  en: {
    name: "Name:",
    date: "Date:",
    class: "Class:",
    score: "Score:",
    answerKey: "ANSWER KEY",
    explanation: "Explanation:",
    instructions: "Circle the correct answer for each question.",
    instructionsNoAnswer: "Write your answer on the line provided.",
  },
  es: {
    name: "Nombre:",
    date: "Fecha:",
    class: "Clase:",
    score: "Nota:",
    answerKey: "CLAVE DE RESPUESTAS",
    explanation: "Explicación:",
    instructions: "Rodea con un círculo la respuesta correcta para cada pregunta.",
    instructionsNoAnswer: "Escribe tu respuesta en la línea proporcionada.",
  },
  ca: {
    name: "Nom:",
    date: "Data:",
    class: "Classe:",
    score: "Nota:",
    answerKey: "CLAU DE RESPOSTES",
    explanation: "Explicació:",
    instructions: "Encercla la resposta correcta per a cada pregunta.",
    instructionsNoAnswer: "Escriu la teva resposta a la línia proporcionada.",
  },
};

function buildPdf(opts: WorksheetOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "A4" });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const labels = LABELS[opts.locale];
    const pageWidth = doc.page.width - 100; // margins

    // ── Logo (top-right corner) ──────────────────────────────────────────────
    const LOGO_MAX_W = 110;
    const LOGO_MAX_H = 50;
    const LOGO_X = doc.page.width - 50 - LOGO_MAX_W;
    const LOGO_Y = 40;
    if (opts.logoDataUrl) {
      try {
        // Extract mime type and raw base64 from data URL
        const match = opts.logoDataUrl.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
        if (match) {
          const mimeType = match[1];
          const base64Data = match[2];
          const imgBuffer = Buffer.from(base64Data, "base64");
          // PDFKit accepts Buffer for image; SVG is not natively supported, skip gracefully
          if (mimeType !== "image/svg+xml") {
            doc.image(imgBuffer, LOGO_X, LOGO_Y, {
              fit: [LOGO_MAX_W, LOGO_MAX_H],
            });
          }
        }
      } catch (_) {
        // Logo rendering failed — continue without it
      }
    }

    // ── Header ──────────────────────────────────────────────────────────────
    // Title area is narrower when logo is present to avoid overlap
    const titleWidth = opts.logoDataUrl ? pageWidth - LOGO_MAX_W - 10 : pageWidth;
    doc.fontSize(18).font("Helvetica-Bold").text(opts.title, 50, 50, { width: titleWidth });
    if (opts.subtitle) {
      doc.fontSize(11).font("Helvetica").fillColor("#555555").text(opts.subtitle, 50, doc.y, { width: titleWidth });
    }
    // Reset Y to below the logo if logo is taller than the title block
    if (opts.logoDataUrl) {
      const afterLogo = LOGO_Y + LOGO_MAX_H + 8;
      if (doc.y < afterLogo) doc.y = afterLogo;
    }

    if (opts.includeAnswers) {
      doc.moveDown(0.3);
      doc
        .fontSize(13)
        .font("Helvetica-Bold")
        .fillColor("#cc0000")
        .text(`— ${labels.answerKey} —`, { align: "center" });
    }

    doc.moveDown(0.5);
    doc.fillColor("#000000");

    // ── Student info row (only on student copy) ──────────────────────────────
    if (!opts.includeAnswers) {
      const infoY = doc.y;
      const colW = pageWidth / 2;
      doc.fontSize(10).font("Helvetica");
      doc.text(labels.name, 50, infoY);
      doc.moveTo(50 + 40, infoY + 12).lineTo(50 + colW - 10, infoY + 12).stroke();
      doc.text(labels.date, 50 + colW, infoY);
      doc.moveTo(50 + colW + 35, infoY + 12).lineTo(50 + pageWidth, infoY + 12).stroke();
      doc.moveDown(1.2);
      doc.text(labels.class, 50, doc.y);
      doc.moveTo(50 + 38, doc.y + 12).lineTo(50 + colW - 10, doc.y + 12).stroke();
      doc.text(labels.score, 50 + colW, doc.y);
      doc.moveTo(50 + colW + 35, doc.y + 12).lineTo(50 + pageWidth, doc.y + 12).stroke();
      doc.moveDown(1.5);
    } else {
      doc.moveDown(0.5);
    }

    // ── Instructions ─────────────────────────────────────────────────────────
    doc
      .fontSize(10)
      .font("Helvetica-Oblique")
      .fillColor("#444444")
      .text(opts.includeAnswers ? labels.instructions : labels.instructionsNoAnswer);
    doc.moveDown(0.8);
    doc.fillColor("#000000");

    // ── Separator line ────────────────────────────────────────────────────────
    doc.moveTo(50, doc.y).lineTo(50 + pageWidth, doc.y).lineWidth(0.5).stroke();
    doc.moveDown(0.5);

    // ── Questions ─────────────────────────────────────────────────────────────
    opts.questions.forEach((q, qi) => {
      const qNum = qi + 1;

      // Check if we need a new page (leave 120pt buffer)
      if (doc.y > doc.page.height - 170) {
        doc.addPage();
      }

      // Competency badge
      doc
        .fontSize(8)
        .font("Helvetica-Bold")
        .fillColor("#ffffff")
        .rect(50, doc.y, 32, 12)
        .fill("#3b82f6");
      doc.fillColor("#ffffff").text(q.competency, 50, doc.y - 11, { width: 32, align: "center" });
      doc.fillColor("#000000");

      // Question text
      doc.moveDown(0.1);
      doc
        .fontSize(11)
        .font("Helvetica-Bold")
        .fillColor("#000000")
        .text(`${qNum}. ${q.question}`, 50, doc.y, { width: pageWidth });
      doc.moveDown(0.4);

      if (opts.includeAnswers) {
        // Show all options; highlight correct one
        q.options.forEach((opt, oi) => {
          const letter = String.fromCharCode(65 + oi);
          const isCorrect = oi === q.correctIndex;
          const optX = 65;
          const optY = doc.y;

          if (isCorrect) {
            // Green highlight box
            doc
              .rect(optX - 4, optY - 2, pageWidth - 15 + 4, 16)
              .fillColor("#d1fae5")
              .fill();
            doc.fillColor("#065f46");
          } else {
            doc.fillColor("#555555");
          }

          doc
            .fontSize(10)
            .font(isCorrect ? "Helvetica-Bold" : "Helvetica")
            .text(`${letter}. ${opt}${isCorrect ? "  ✓" : ""}`, optX, optY, { width: pageWidth - 15 });

          doc.fillColor("#000000");
          doc.moveDown(0.15);
        });

        // Explanation (if present)
        if (q.explanation) {
          doc.moveDown(0.2);
          doc
            .fontSize(9)
            .font("Helvetica-Oblique")
            .fillColor("#1e40af")
            .text(`${labels.explanation} ${q.explanation}`, 65, doc.y, { width: pageWidth - 15 });
          doc.fillColor("#000000");
        }
      } else {
        // Student copy: show options as A/B/C/D choices
        q.options.forEach((opt, oi) => {
          const letter = String.fromCharCode(65 + oi);
          doc
            .fontSize(10)
            .font("Helvetica")
            .fillColor("#000000")
            .text(`${letter}. ${opt}`, 65, doc.y, { width: pageWidth - 15 });
          doc.moveDown(0.15);
        });
      }

      doc.moveDown(0.6);

      // Thin separator between questions
      doc
        .moveTo(50, doc.y)
        .lineTo(50 + pageWidth, doc.y)
        .lineWidth(0.3)
        .strokeColor("#cccccc")
        .stroke();
      doc.strokeColor("#000000");
      doc.moveDown(0.4);
    });

    doc.end();
  });
}

/**
 * Generate both worksheet versions (with and without answers).
 * Returns base64-encoded PDF strings.
 */
export async function generateWorksheets(opts: Omit<WorksheetOptions, "includeAnswers">): Promise<{
  withAnswers: string;
  withoutAnswers: string;
}> {
  const [withAnswersBuf, withoutAnswersBuf] = await Promise.all([
    buildPdf({ ...opts, includeAnswers: true }),
    buildPdf({ ...opts, includeAnswers: false }),
  ]);
  return {
    withAnswers: withAnswersBuf.toString("base64"),
    withoutAnswers: withoutAnswersBuf.toString("base64"),
  };
}
