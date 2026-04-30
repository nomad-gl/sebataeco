/**
 * academicCalendarPdf.ts
 * Generates an Academic Calendar PDF using PDFKit.
 * Sections: Cover, Semester Dates, Weekly Timetable (per teacher), Teacher Hours Summary, Semester Breaks.
 */
import PDFDocument from "pdfkit";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const DAYS_ES = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"];
const DAYS_CA = ["Dilluns", "Dimarts", "Dimecres", "Dijous", "Divendres"];

function getDays(lang?: string) {
  if (lang === "es") return DAYS_ES;
  if (lang === "ca") return DAYS_CA;
  return DAYS;
}

export interface AcCalendarPdfOptions {
  calendar: {
    academicYear: string;
    semesterCount: number;
    schoolStartTime: string;
    schoolEndTime: string;
    morningBreakStart?: string | null;
    morningBreakEnd?: string | null;
    lunchBreakStart?: string | null;
    lunchBreakEnd?: string | null;
  };
  semesterDates: Array<{ semesterNumber: number; startDate: string | Date; endDate: string | Date }>;
  teachers: Array<{ id: number; name: string; email?: string | null; weeklyHours: number }>;
  sessions: Array<{ id: number; teacherId: number; subject: string; dayOfWeek: number; startTime: string; endTime: string; color?: string | null }>;
  breaks: Array<{ name: string; semesterNumber: number; startDate: string | Date; endDate: string | Date }>;
  subjects: Array<{ name: string; unit?: string | null; classroom?: string | null; maxStudents?: number | null; totalAcademicHours: number; semesterNumber: number; color?: string | null }>;
  schoolName?: string;
  teacherName?: string;
  lang?: string;
}

function fmtDate(d: string | Date): string {
  if (!d) return "";
  const s = typeof d === "string" ? d : d.toISOString().slice(0, 10);
  return s.slice(0, 10);
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return [r, g, b];
}

export async function generateAcademicCalendarPdf(opts: AcCalendarPdfOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({ size: "A4", margin: 40, info: { Title: `Academic Calendar ${opts.calendar.academicYear}` } });

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const W = doc.page.width - 80; // usable width
    const days = getDays(opts.lang);

    // ─── Helpers ────────────────────────────────────────────────────────────────
    function sectionTitle(title: string) {
      doc.moveDown(0.5);
      doc.rect(40, doc.y, W, 22).fill("#1e3a5f");
      doc.fillColor("white").fontSize(11).font("Helvetica-Bold")
        .text(title, 48, doc.y - 18, { width: W - 16 });
      doc.fillColor("black").moveDown(0.8);
    }

    function tableHeader(cols: string[], widths: number[]) {
      let x = 40;
      doc.rect(40, doc.y, W, 16).fill("#e2e8f0");
      doc.fillColor("#1e3a5f").fontSize(8).font("Helvetica-Bold");
      cols.forEach((col, i) => {
        doc.text(col, x + 3, doc.y - 12, { width: widths[i] - 6, align: "left" });
        x += widths[i];
      });
      doc.fillColor("black").font("Helvetica").moveDown(0.3);
    }

    function tableRow(cells: string[], widths: number[], shade: boolean, color?: string | null) {
      const rowH = 14;
      const y = doc.y;
      if (shade) doc.rect(40, y, W, rowH).fill("#f8fafc");
      if (color) {
        try {
          const [r, g, b] = hexToRgb(color);
          doc.rect(40, y, 4, rowH).fill(`rgb(${r},${g},${b})`);
        } catch { /* ignore invalid color */ }
      }
      let x = 40;
      doc.fillColor("#1e293b").fontSize(8).font("Helvetica");
      cells.forEach((cell, i) => {
        doc.text(cell, x + (color ? 6 : 3), y + 3, { width: widths[i] - 6, lineBreak: false });
        x += widths[i];
      });
      doc.moveDown(0);
      doc.y = y + rowH;
    }

    function checkNewPage(needed = 60) {
      if (doc.y > doc.page.height - needed - 40) doc.addPage();
    }

    // ─── Cover Page ─────────────────────────────────────────────────────────────
    doc.rect(0, 0, doc.page.width, 180).fill("#0f172a");
    doc.fillColor("white").fontSize(24).font("Helvetica-Bold")
      .text("Academic Calendar", 40, 50, { width: doc.page.width - 80, align: "center" });
    doc.fontSize(18).font("Helvetica")
      .text(opts.calendar.academicYear, 40, 90, { width: doc.page.width - 80, align: "center" });
    if (opts.schoolName) {
      doc.fontSize(12).text(opts.schoolName, 40, 125, { width: doc.page.width - 80, align: "center" });
    }
    doc.fillColor("#94a3b8").fontSize(9)
      .text(`${opts.calendar.semesterCount} semester(s) · ${opts.calendar.schoolStartTime}–${opts.calendar.schoolEndTime}`, 40, 150, { width: doc.page.width - 80, align: "center" });

    doc.fillColor("black");
    doc.y = 200;

    // ─── Semester Dates ──────────────────────────────────────────────────────────
    if (opts.semesterDates.length > 0) {
      sectionTitle("Semester Dates");
      tableHeader(["Semester", "Start Date", "End Date", "Duration"], [80, 160, 160, W - 400]);
      opts.semesterDates.forEach((sd, idx) => {
        const start = new Date(fmtDate(sd.startDate));
        const end = new Date(fmtDate(sd.endDate));
        const days_count = isNaN(start.getTime()) || isNaN(end.getTime()) ? "—" :
          `${Math.round((end.getTime() - start.getTime()) / 86400000)} days`;
        tableRow([`Semester ${sd.semesterNumber}`, fmtDate(sd.startDate), fmtDate(sd.endDate), days_count], [80, 160, 160, W - 400], idx % 2 === 1);
        checkNewPage();
      });
      doc.moveDown(0.5);
    }

    // ─── Subjects per Semester ───────────────────────────────────────────────────
    if (opts.subjects.length > 0) {
      sectionTitle("Subjects");
      for (let sem = 1; sem <= opts.calendar.semesterCount; sem++) {
        const semSubjects = opts.subjects.filter(s => s.semesterNumber === sem);
        if (!semSubjects.length) continue;
        checkNewPage(80);
        doc.fontSize(9).font("Helvetica-Bold").fillColor("#1e3a5f").text(`Semester ${sem}`, 40, doc.y).moveDown(0.3);
        doc.fillColor("black");
        tableHeader(["Subject", "Unit", "Classroom", "Max Students", "Hours"], [130, 100, 90, 90, W - 410]);
        semSubjects.forEach((s, idx) => {
          tableRow([s.name, s.unit ?? "—", s.classroom ?? "—", s.maxStudents ? String(s.maxStudents) : "—", String(s.totalAcademicHours)], [130, 100, 90, 90, W - 410], idx % 2 === 1, s.color);
          checkNewPage();
        });
        doc.moveDown(0.3);
      }
      doc.moveDown(0.5);
    }

    // ─── Teacher Hours Summary ───────────────────────────────────────────────────
    if (opts.teachers.length > 0) {
      sectionTitle("Teacher Hours Summary");
      tableHeader(["Teacher", "Email", "Contracted Hrs/Week", "Scheduled Sessions"], [160, 160, 120, W - 440]);
      opts.teachers.forEach((t, idx) => {
        const scheduled = opts.sessions.filter(s => s.teacherId === t.id).length;
        tableRow([t.name, t.email ?? "—", String(t.weeklyHours), String(scheduled)], [160, 160, 120, W - 440], idx % 2 === 1);
        checkNewPage();
      });
      doc.moveDown(0.5);
    }

    // ─── Weekly Timetable (per teacher) ─────────────────────────────────────────
    if (opts.sessions.length > 0) {
      sectionTitle("Weekly Timetable");
      opts.teachers.forEach(teacher => {
        const tSessions = opts.sessions.filter(s => s.teacherId === teacher.id);
        if (!tSessions.length) return;
        checkNewPage(100);
        doc.fontSize(9).font("Helvetica-Bold").fillColor("#1e3a5f").text(teacher.name, 40, doc.y).moveDown(0.3);
        doc.fillColor("black");
        tableHeader(["Day", "Subject", "Start", "End"], [120, 200, 80, W - 400]);
        tSessions
          .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime))
          .forEach((s, idx) => {
            tableRow([days[s.dayOfWeek - 1] ?? `Day ${s.dayOfWeek}`, s.subject, s.startTime, s.endTime], [120, 200, 80, W - 400], idx % 2 === 1, s.color);
            checkNewPage();
          });
        doc.moveDown(0.5);
      });
    }

    // ─── Semester Breaks ─────────────────────────────────────────────────────────
    if (opts.breaks.length > 0) {
      sectionTitle("Semester Breaks");
      tableHeader(["Semester", "Break Name", "Start Date", "End Date", "Days"], [70, 160, 110, 110, W - 450]);
      opts.breaks.forEach((b, idx) => {
        const start = new Date(fmtDate(b.startDate));
        const end = new Date(fmtDate(b.endDate));
        const days_count = isNaN(start.getTime()) || isNaN(end.getTime()) ? "—" :
          String(Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
        tableRow([`Sem ${b.semesterNumber}`, b.name, fmtDate(b.startDate), fmtDate(b.endDate), days_count], [70, 160, 110, 110, W - 450], idx % 2 === 1);
        checkNewPage();
      });
    }

    // ─── Footer on each page ─────────────────────────────────────────────────────
    const pageCount = (doc as any).bufferedPageRange?.()?.count ?? 1;
    for (let i = 0; i < pageCount; i++) {
      doc.switchToPage(i);
      doc.fillColor("#94a3b8").fontSize(8).font("Helvetica")
        .text(`SEBA AI Studio · Academic Calendar ${opts.calendar.academicYear} · Page ${i + 1}`, 40, doc.page.height - 30, { width: W, align: "center" });
    }

    doc.end();
  });
}
