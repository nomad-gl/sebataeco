/**
 * Lesson Plan PDF generator.
 * Produces a clean, print-ready A4 PDF from a lesson plan record.
 */

import PDFDocument from "pdfkit";

type Procedure = { timing?: string; stage?: string; activities?: string; grouping?: string };

export interface LessonPlanPdfInput {
  title: string;
  lessonNumber?: string | null;
  lessonDate?: string | null;
  subject?: string | null;
  yearGroup?: string | null;
  academicYear?: string | null;
  duration?: number | null;
  unit?: string | null;
  skills?: string | null;          // JSON
  systems?: string | null;         // JSON
  specificCompetences?: string | null; // JSON array
  saberesBasicos?: string | null;  // JSON array
  learningOutcomes?: string | null; // JSON array
  evaluationCriteria?: string | null; // JSON array
  previousKnowledge?: string | null;
  materials?: string | null;
  spaces?: string | null;
  procedures?: string | null;      // JSON array
  competencies?: string | null;    // JSON array
}

function parseJson<T>(val: string | null | undefined, fallback: T): T {
  if (!val) return fallback;
  try { return JSON.parse(val) as T; } catch { return fallback; }
}

function boolKeys(obj: Record<string, boolean>): string[] {
  return Object.entries(obj).filter(([, v]) => v).map(([k]) => k.charAt(0).toUpperCase() + k.slice(1));
}

export async function generateLessonPlanPdf(plan: LessonPlanPdfInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 48, info: { Title: plan.title } });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const W = doc.page.width - 96; // usable width
    const BLUE = "#1a56db";
    const LIGHT = "#f0f4ff";
    const GREY = "#6b7280";
    const DARK = "#111827";

    // ── Header band ──────────────────────────────────────────────────────────
    doc.rect(48, 48, W, 72).fill(BLUE);
    doc.fillColor("white").fontSize(18).font("Helvetica-Bold")
      .text(plan.title, 60, 58, { width: W - 20 });

    const meta: string[] = [];
    if (plan.lessonNumber) meta.push(`Lesson ${plan.lessonNumber}`);
    if (plan.lessonDate) {
      const d = new Date(plan.lessonDate + "T12:00:00");
      meta.push(d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" }));
    }
    if (plan.subject) meta.push(plan.subject);
    if (plan.yearGroup) meta.push(plan.yearGroup);
    if (plan.academicYear) meta.push(plan.academicYear);
    if (plan.duration) meta.push(`${plan.duration} min`);
    if (meta.length) {
      doc.fontSize(9).font("Helvetica").fillColor("rgba(255,255,255,0.85)")
        .text(meta.join("  ·  "), 60, 82, { width: W - 20 });
    }

    doc.fillColor(DARK);
    let y = 132;

    // ── Helper: section heading ───────────────────────────────────────────────
    const sectionHeading = (label: string) => {
      doc.rect(48, y, W, 18).fill(LIGHT);
      doc.fillColor(BLUE).fontSize(9).font("Helvetica-Bold")
        .text(label.toUpperCase(), 54, y + 4, { width: W - 12 });
      doc.fillColor(DARK);
      y += 22;
    };

    // ── Helper: key-value row ─────────────────────────────────────────────────
    const kvRow = (label: string, value: string) => {
      if (!value.trim()) return;
      doc.fontSize(9).font("Helvetica-Bold").fillColor(GREY).text(label + ":", 54, y, { continued: true, width: 120 });
      doc.font("Helvetica").fillColor(DARK).text("  " + value, { width: W - 130 });
      y = doc.y + 4;
    };

    // ── Helper: bullet list ───────────────────────────────────────────────────
    const bulletList = (items: string[]) => {
      items.filter(Boolean).forEach(item => {
        doc.fontSize(9).font("Helvetica").fillColor(DARK)
          .text(`• ${item}`, 60, y, { width: W - 20 });
        y = doc.y + 2;
      });
      y += 4;
    };

    // ── Helper: check new page ────────────────────────────────────────────────
    const checkPage = (needed = 40) => {
      if (y + needed > doc.page.height - 60) {
        doc.addPage();
        y = 48;
      }
    };

    // ── Lesson Info ───────────────────────────────────────────────────────────
    sectionHeading("Lesson Information");
    if (plan.unit) kvRow("Unit", plan.unit);

    const skills = parseJson<Record<string, boolean>>(plan.skills, {});
    const skillsStr = boolKeys(skills).join(", ");
    if (skillsStr) kvRow("Skills", skillsStr);

    const systems = parseJson<Record<string, boolean>>(plan.systems, {});
    const systemsStr = boolKeys(systems).join(", ");
    if (systemsStr) kvRow("Language Systems", systemsStr);

    const competencies = parseJson<string[]>(plan.competencies, []);
    if (competencies.length) kvRow("Competencies", competencies.join(", "));

    const specificCompetences = parseJson<string[]>(plan.specificCompetences, []);
    if (specificCompetences.length) kvRow("Specific Competences", specificCompetences.join(", "));

    y += 6;

    // ── Saberes Básicos ───────────────────────────────────────────────────────
    const saberesBasicos = parseJson<string[]>(plan.saberesBasicos, []).filter(Boolean);
    if (saberesBasicos.length) {
      checkPage(30 + saberesBasicos.length * 14);
      sectionHeading("Saberes Básicos");
      bulletList(saberesBasicos);
    }

    // ── Learning Outcomes ─────────────────────────────────────────────────────
    const learningOutcomes = parseJson<string[]>(plan.learningOutcomes, []).filter(Boolean);
    if (learningOutcomes.length) {
      checkPage(30 + learningOutcomes.length * 14);
      sectionHeading("Learning Outcomes");
      bulletList(learningOutcomes);
    }

    // ── Evaluation Criteria ───────────────────────────────────────────────────
    const evaluationCriteria = parseJson<string[]>(plan.evaluationCriteria, []).filter(Boolean);
    if (evaluationCriteria.length) {
      checkPage(30 + evaluationCriteria.length * 14);
      sectionHeading("Evaluation Criteria");
      bulletList(evaluationCriteria);
    }

    // ── Prior Knowledge / Materials / Spaces ─────────────────────────────────
    checkPage(60);
    sectionHeading("Context & Resources");
    if (plan.previousKnowledge) kvRow("Prior Knowledge", plan.previousKnowledge);
    if (plan.materials) kvRow("Materials", plan.materials);
    if (plan.spaces) kvRow("Spaces", plan.spaces);
    y += 4;

    // ── Procedures ────────────────────────────────────────────────────────────
    const procedures = parseJson<Procedure[]>(plan.procedures, []);
    if (procedures.length) {
      checkPage(50);
      sectionHeading("Lesson Procedures");

      // Table header
      const cols = [60, 120, 240, 380];
      const colW = [54, 114, 134, W - 332];
      doc.rect(48, y, W, 16).fill("#e5e7eb");
      ["Timing", "Stage", "Activities", "Grouping"].forEach((h, i) => {
        doc.fillColor(DARK).fontSize(8).font("Helvetica-Bold")
          .text(h, cols[i], y + 3, { width: colW[i] });
      });
      y += 18;

      procedures.forEach((p, idx) => {
        doc.fontSize(8);
        const rowH = Math.max(
          doc.heightOfString(p.activities ?? "", { width: colW[2] - 4 }),
          16,
        ) + 6;
        checkPage(rowH + 4);
        if (idx % 2 === 0) doc.rect(48, y, W, rowH).fill("#f9fafb");
        doc.fillColor(DARK).fontSize(8).font("Helvetica");
        doc.text(p.timing ?? "", cols[0], y + 3, { width: colW[0] - 4 });
        doc.text(p.stage ?? "", cols[1], y + 3, { width: colW[1] - 4 });
        doc.text(p.activities ?? "", cols[2], y + 3, { width: colW[2] - 4 });
        doc.text(p.grouping ?? "", cols[3], y + 3, { width: colW[3] - 4 });
        y += rowH;
      });
    }

    // ── Footer ────────────────────────────────────────────────────────────────
    const pageCount = (doc as any)._pageBuffer?.length ?? 1;
    for (let i = 0; i < pageCount; i++) {
      doc.switchToPage(i);
      doc.fontSize(7).fillColor(GREY).font("Helvetica")
        .text("Powered by SEBA AI Studio", 48, doc.page.height - 36, { width: W / 2 })
        .text(`Page ${i + 1}`, 48, doc.page.height - 36, { width: W, align: "right" });
    }

    doc.end();
  });
}
