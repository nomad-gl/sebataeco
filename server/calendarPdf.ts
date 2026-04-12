/**
 * calendarPdf.ts
 * Generates a formatted school calendar timetable PDF using PDFKit.
 * Includes school logo, header metadata, and lesson rows with LOMLOE details.
 */
import PDFDocument from "pdfkit";

export interface CalendarEvent {
  id: number;
  eventDate: Date;
  eventType: string;
  title: string;
  description?: string | null;
  competency?: string | null;
  yearGroup?: string | null;
  subject?: string | null;
  aiGenerated: boolean;
}

export interface CalendarPdfOptions {
  calendarName: string;
  schoolName?: string | null;
  tutorName?: string | null;
  subject?: string | null;
  yearLevel?: string | null;
  academicYear: string;
  calendarType: string;
  startDate?: Date | null;
  endDate?: Date | null;
  topicDescription?: string | null;
  events: CalendarEvent[];
  locale: "en" | "es" | "ca";
  logoDataUrl?: string | null;
}

const LABELS = {
  en: {
    timetable: "School Calendar Timetable",
    school: "School",
    tutor: "Tutor",
    subject: "Subject",
    year: "Year / Level",
    academic: "Academic Year",
    period: "Period",
    date: "Date",
    type: "Type",
    lesson: "Lesson / Activity",
    competency: "Competency",
    details: "LOMLOE Details",
    noEvents: "No events scheduled.",
    topicBlock: "Topic Block",
    poweredBy: "Powered by SEBA",
  },
  es: {
    timetable: "Calendario Escolar",
    school: "Centro",
    tutor: "Tutor/a",
    subject: "Asignatura",
    year: "Curso / Nivel",
    academic: "Año académico",
    period: "Período",
    date: "Fecha",
    type: "Tipo",
    lesson: "Lección / Actividad",
    competency: "Competencia",
    details: "Detalles LOMLOE",
    noEvents: "No hay eventos programados.",
    topicBlock: "Bloque temático",
    poweredBy: "Con tecnología de SEBA",
  },
  ca: {
    timetable: "Calendari Escolar",
    school: "Centre",
    tutor: "Tutor/a",
    subject: "Assignatura",
    year: "Curs / Nivell",
    academic: "Any acadèmic",
    period: "Període",
    date: "Data",
    type: "Tipus",
    lesson: "Lliçó / Activitat",
    competency: "Competència",
    details: "Detalls LOMLOE",
    noEvents: "No hi ha esdeveniments programats.",
    topicBlock: "Bloc temàtic",
    poweredBy: "Impulsat per SEBA",
  },
};

const EVENT_TYPE_LABELS: Record<string, Record<string, string>> = {
  en: { holiday: "Holiday", special: "Special Day", exam: "Exam", excursion: "Excursion", event: "Event", lesson: "Lesson", ai_generated: "AI Lesson" },
  es: { holiday: "Festivo", special: "Día especial", exam: "Examen", excursion: "Excursión", event: "Evento", lesson: "Lección", ai_generated: "Lección IA" },
  ca: { holiday: "Festiu", special: "Dia especial", exam: "Examen", excursion: "Excursió", event: "Esdeveniment", lesson: "Lliçó", ai_generated: "Lliçó IA" },
};

/** Returns the academic week number (1-based) anchored to the Monday on/before 1 Sep of startYear */
function academicWeekNumber(date: Date, startYear: number): number {
  const sep1 = new Date(Date.UTC(startYear, 8, 1));
  const sep1Dow = sep1.getUTCDay();
  const daysBack = sep1Dow === 0 ? 6 : sep1Dow - 1;
  const anchor = new Date(sep1.getTime() - daysBack * 86400000);
  const dateUtc = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.floor((dateUtc - anchor.getTime()) / 86400000);
  if (diffDays < 0) return 1;
  return Math.floor(diffDays / 7) + 1;
}

function formatDate(d: Date, locale: string): string {
  return d.toLocaleDateString(locale === "ca" ? "ca-ES" : locale === "es" ? "es-ES" : "en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export async function generateCalendarPdf(opts: CalendarPdfOptions): Promise<Buffer> {
  const L = LABELS[opts.locale] ?? LABELS.en;
  const ET = EVENT_TYPE_LABELS[opts.locale] ?? EVENT_TYPE_LABELS.en;

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({ margin: 40, size: "A4" });
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageWidth = doc.page.width - 80; // margins

    // ── Header ────────────────────────────────────────────────────────────────
    let logoWidth = 0;
    if (opts.logoDataUrl) {
      try {
        const base64 = opts.logoDataUrl.replace(/^data:image\/\w+;base64,/, "");
        const imgBuf = Buffer.from(base64, "base64");
        logoWidth = 80;
        doc.image(imgBuf, 40, 30, { width: logoWidth, height: 60, fit: [logoWidth, 60] });
      } catch {
        logoWidth = 0;
      }
    }

    const textX = 40 + (logoWidth > 0 ? logoWidth + 12 : 0);
    const textWidth = pageWidth - (logoWidth > 0 ? logoWidth + 12 : 0);

    doc.fontSize(16).fillColor("#1e3a5f").font("Helvetica-Bold")
      .text(L.timetable, textX, 30, { width: textWidth });
    doc.fontSize(13).fillColor("#1e3a5f").font("Helvetica-Bold")
      .text(opts.calendarName, textX, 50, { width: textWidth });

    // Meta row
    doc.moveDown(0.3);
    let metaY = doc.y;
    const metaItems: string[] = [];
    if (opts.schoolName) metaItems.push(`${L.school}: ${opts.schoolName}`);
    if (opts.tutorName) metaItems.push(`${L.tutor}: ${opts.tutorName}`);
    if (opts.subject) metaItems.push(`${L.subject}: ${opts.subject}`);
    if (opts.yearLevel) metaItems.push(`${L.year}: ${opts.yearLevel}`);
    metaItems.push(`${L.academic}: ${opts.academicYear}`);
    if (opts.calendarType === "topic_block" && opts.startDate && opts.endDate) {
      metaItems.push(`${L.period}: ${formatDate(opts.startDate, opts.locale)} – ${formatDate(opts.endDate, opts.locale)}`);
    }

    doc.fontSize(9).fillColor("#444").font("Helvetica")
      .text(metaItems.join("   |   "), textX, metaY, { width: textWidth });

    if (opts.topicDescription && opts.calendarType === "topic_block") {
      doc.moveDown(0.4);
      doc.fontSize(9).fillColor("#555").font("Helvetica-Oblique")
        .text(`${L.topicBlock}: ${opts.topicDescription}`, 40, doc.y, { width: pageWidth });
    }

    // Divider
    doc.moveDown(0.6);
    doc.moveTo(40, doc.y).lineTo(40 + pageWidth, doc.y).strokeColor("#1e3a5f").lineWidth(1.5).stroke();
    doc.moveDown(0.4);

    // ── Sort events by date ───────────────────────────────────────────────────
    const sorted = [...opts.events].sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime());

    // Derive academic year start year from opts.academicYear e.g. "2025-2026" -> 2025
    const ayStartYear = parseInt((opts.academicYear ?? "").split("-")[0], 10) || new Date().getFullYear();

    if (sorted.length === 0) {
      doc.fontSize(11).fillColor("#666").font("Helvetica").text(L.noEvents, 40, doc.y);
    } else {
      // Table header — Wk | Date | Type | Lesson | Competency
      const colWk    = 40;
      const colDate  = 68;
      const colType  = 163;
      const colTitle = 233;
      const colComp  = 443;
      const colWidthWk    = 24;
      const colWidthDate  = 90;
      const colWidthType  = 65;
      const colWidthTitle = 205;
      const colWidthComp  = 75;

      const drawTableHeader = () => {
        const y = doc.y;
        doc.rect(40, y, pageWidth, 16).fillColor("#1e3a5f").fill();
        doc.fontSize(8).fillColor("#fff").font("Helvetica-Bold");
        doc.text("Wk", colWk + 2, y + 4, { width: colWidthWk });
        doc.text(L.date, colDate + 2, y + 4, { width: colWidthDate });
        doc.text(L.type, colType + 2, y + 4, { width: colWidthType });
        doc.text(L.lesson, colTitle + 2, y + 4, { width: colWidthTitle });
        doc.text(L.competency, colComp + 2, y + 4, { width: colWidthComp });
        doc.moveDown(0.1);
        doc.y = y + 18;
      };

      drawTableHeader();

      sorted.forEach((ev, idx) => {
        const rowH = 22;
        if (doc.y + rowH > doc.page.height - 60) {
          doc.addPage();
          drawTableHeader();
        }

        const y = doc.y;
        const bg = idx % 2 === 0 ? "#f4f7fb" : "#ffffff";
        doc.rect(40, y, pageWidth, rowH).fillColor(bg).fill();

        // Highlight holidays in a muted red
        const isHoliday = ev.eventType === "holiday";
        const textColor = isHoliday ? "#b91c1c" : "#1a1a1a";
        const wkNum = academicWeekNumber(new Date(ev.eventDate), ayStartYear);

        doc.fontSize(7.5).fillColor(textColor).font(isHoliday ? "Helvetica-Bold" : "Helvetica");
        doc.text(String(wkNum), colWk + 2, y + 6, { width: colWidthWk - 2, lineBreak: false });
        doc.text(formatDate(new Date(ev.eventDate), opts.locale), colDate + 2, y + 6, { width: colWidthDate - 4, lineBreak: false });
        doc.text(ET[ev.eventType] ?? ev.eventType, colType + 2, y + 6, { width: colWidthType - 4, lineBreak: false });
        doc.text(ev.title, colTitle + 2, y + 6, { width: colWidthTitle - 4, lineBreak: false });
        doc.text(ev.competency ?? "", colComp + 2, y + 6, { width: colWidthComp - 4, lineBreak: false });

        // Row border
        doc.moveTo(40, y + rowH).lineTo(40 + pageWidth, y + rowH).strokeColor("#dde3ec").lineWidth(0.4).stroke();
        doc.y = y + rowH;
      });

      // LOMLOE details section for AI-generated lessons
      const aiLessons = sorted.filter(e => (e.eventType === "ai_generated" || e.eventType === "lesson") && e.description);
      if (aiLessons.length > 0) {
        doc.addPage();
        doc.fontSize(13).fillColor("#1e3a5f").font("Helvetica-Bold").text(L.details, 40, 40);
        doc.moveDown(0.5);
        doc.moveTo(40, doc.y).lineTo(40 + pageWidth, doc.y).strokeColor("#1e3a5f").lineWidth(1).stroke();
        doc.moveDown(0.4);

        aiLessons.forEach(ev => {
          if (doc.y > doc.page.height - 120) doc.addPage();
          doc.fontSize(10).fillColor("#1e3a5f").font("Helvetica-Bold")
            .text(`${formatDate(new Date(ev.eventDate), opts.locale)} — ${ev.title}`, 40, doc.y, { width: pageWidth });
          if (ev.competency) {
            doc.fontSize(8.5).fillColor("#555").font("Helvetica")
              .text(`${L.competency}: ${ev.competency}`, 40, doc.y, { width: pageWidth });
          }
          if (ev.description) {
            doc.fontSize(8.5).fillColor("#333").font("Helvetica")
              .text(ev.description, 40, doc.y, { width: pageWidth });
          }
          doc.moveDown(0.6);
          doc.moveTo(40, doc.y).lineTo(40 + pageWidth, doc.y).strokeColor("#e2e8f0").lineWidth(0.5).stroke();
          doc.moveDown(0.4);
        });
      }
    }

    // ── Footer on every page ──────────────────────────────────────────────────
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      const footerY = doc.page.height - 30;
      doc.moveTo(40, footerY - 4).lineTo(40 + pageWidth, footerY - 4).strokeColor("#cbd5e1").lineWidth(0.5).stroke();
      doc.fontSize(7).fillColor("#94a3b8").font("Helvetica")
        .text(`${L.poweredBy}   |   ${opts.calendarName}   |   ${opts.academicYear}`, 40, footerY, { width: pageWidth, align: "center" });
    }

    doc.end();
  });
}
