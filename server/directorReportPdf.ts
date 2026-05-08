/**
 * directorReportPdf.ts
 * Generates a school-wide director summary PDF using PDFKit.
 * Covers: lesson plan stats, LOMLOE competency coverage, staff activity, bias scan summary.
 */
import PDFDocument from "pdfkit";

export interface DirectorReportData {
  schoolName?: string | null;
  logoUrl?: string | null;
  directorName?: string | null;
  directorTitle?: string | null;
  directorLogoUrl?: string | null;
  generatedAt: Date;
  locale: "en" | "es" | "ca";
  stats: {
    totalTeachers: number;
    totalLessonPlans: number;
    aiGeneratedPlans: number;
    totalPracticeSessions: number;
    openBiasFlags: number;
    recentScanRuns: number;
  };
  competencyCoverage: {
    code: string;
    label: string;
    count: number;
    percentage: number;
  }[];
  staffActivity: {
    name: string | null;
    email: string | null;
    plansCreated: number;
    aiPlans: number;
    lastActive: Date | null;
  }[];
  subjectCoverage: {
    subject: string;
    competenciesCovered: number;
    competencyList: string[];
  }[];
  classGroups?: {
    className: string;
    yearGroup: "infantil" | "lower_primary" | "junior" | "primary" | "secondary";
    academicYear: string;
    studentCount: number;
  }[];
  /** School-wide LOMLOE student progress per class group */
  studentProgress?: {
    groups: {
      groupId: number;
      className: string;
      level: string;
      studentCount: number;
      totalActivities: number;
      overall: number | null;
      competencyAverages: { code: string; average: number | null }[];
    }[];
    schoolAverages: { code: string; average: number | null }[];
  };
  infantilProgress?: {
    totalInfantilPlans: number;
    teacherCount: number;
    eixSummary: { eix: string; cycle03: number; cycle36: number; total: number }[];
  };
}

const YEAR_GROUP_LABELS: Record<string, Record<string, string>> = {
  en: { infantil: "Infantil (0–6)", lower_primary: "Primary (Yr 1–2)", junior: "Primary (Yr 3–4)", primary: "Upper Primary (Yr 5–6)", secondary: "Secondary (Yr 7–10)" },
  es: { infantil: "Infantil (0–6)", lower_primary: "Primaria (1.º–2.º)", junior: "Primaria (3.º–4.º)", primary: "Primaria Superior (5.º–6.º)", secondary: "Secundaria (7.º–10.º)" },
  ca: { infantil: "Infantil (0–6)", lower_primary: "Primària (1r–2n)", junior: "Primària (3r–4t)", primary: "Primària Superior (5è–6è)", secondary: "Secundària (7è–10è)" },
};

const LABELS = {
  en: {
    title: "School Director Report",
    subtitle: "LOMLOE Compliance & Platform Usage Summary",
    generatedOn: "Generated on",
    school: "School",
    section_stats: "School-wide Statistics",
    section_competency: "LOMLOE Competency Coverage",
    section_staff: "Staff Activity",
    section_subjects: "Coverage by Subject",
    section_groups: "Groups & Enrolment",
    group_name: "Class Group",
    group_year: "Year Group",
    group_year_label: "Year",
    group_students: "Students",
    group_total: "Total Enrolment",
    total_teachers: "Active Teachers",
    total_plans: "Lesson Plans",
    ai_plans: "AI-Generated Plans",
    practice_sessions: "Practice Sessions",
    open_bias: "Open Bias Flags",
    scan_runs: "Scans (last 30 days)",
    competency: "Competency",
    code: "Code",
    plans: "Plans",
    pct: "Coverage",
    teacher: "Teacher",
    email: "Email",
    plans_col: "Plans",
    ai_col: "AI Plans",
    last_active: "Last Active",
    subject: "Subject",
    comp_count: "Competencies Covered",
    comp_list: "Competency Codes",
    never: "Never",
    section_progress: "School-wide Student Progress (LOMLOE)",
    section_infantil: "Educació Infantil Progress (Decree 21/2023)",
    progress_class: "Class Group",
    progress_students: "Students",
    progress_activities: "Activities",
    progress_overall: "Overall",
    progress_no_data: "No data",
    progress_school_avg: "School Average",
    progress_legend: "Score legend",
    infantil_eix: "Eix",
    infantil_desc: "Description",
    infantil_cycle03: "Cycle 0–3",
    infantil_cycle36: "Cycle 3–6",
    infantil_total: "Total",
    powered_by: "Powered by SEBA",
    lomloe_note: "This report was generated in compliance with LOMLOE (Ley Orgánica 3/2020) requirements for educational transparency and accountability.",
    gap_warning: "Competencies with 0 lesson plans represent curriculum gaps that require attention.",
  },
  es: {
    title: "Informe del Director Escolar",
    subtitle: "Resumen de Cumplimiento LOMLOE y Uso de la Plataforma",
    generatedOn: "Generado el",
    school: "Centro",
    section_stats: "Estadísticas Generales",
    section_competency: "Cobertura de Competencias LOMLOE",
    section_staff: "Actividad del Profesorado",
    section_subjects: "Cobertura por Asignatura",
    section_groups: "Grupos y Matrícula",
    group_name: "Grupo",
    group_year: "Etapa",
    group_year_label: "Etapa",
    group_students: "Alumnos",
    group_total: "Matrícula Total",
    total_teachers: "Docentes activos",
    total_plans: "Planes de lección",
    ai_plans: "Planes generados por IA",
    practice_sessions: "Sesiones de práctica",
    open_bias: "Alertas de sesgo abiertas",
    scan_runs: "Análisis (últimos 30 días)",
    competency: "Competencia",
    code: "Código",
    plans: "Planes",
    pct: "Cobertura",
    teacher: "Docente",
    email: "Correo",
    plans_col: "Planes",
    ai_col: "Planes IA",
    last_active: "Última actividad",
    subject: "Asignatura",
    comp_count: "Competencias cubiertas",
    comp_list: "Códigos de competencia",
    never: "Nunca",
    section_progress: "Progreso del Alumnado (LOMLOE)",
    section_infantil: "Progreso Educación Infantil (Decreto 21/2023)",
    progress_class: "Grupo",
    progress_students: "Alumnos",
    progress_activities: "Actividades",
    progress_overall: "Global",
    progress_no_data: "Sin datos",
    progress_school_avg: "Media del Centro",
    progress_legend: "Leyenda de puntuación",
    infantil_eix: "Eix",
    infantil_desc: "Descripción",
    infantil_cycle03: "Ciclo 0–3",
    infantil_cycle36: "Ciclo 3–6",
    infantil_total: "Total",
    powered_by: "Con tecnología de SEBA",
    lomloe_note: "Este informe ha sido generado en cumplimiento de los requisitos de transparencia y responsabilidad de la LOMLOE (Ley Orgánica 3/2020).",
    gap_warning: "Las competencias con 0 planes de lección representan lagunas curriculares que requieren atención.",
  },
  ca: {
    title: "Informe del Director Escolar",
    subtitle: "Resum de Compliment LOMLOE i Ús de la Plataforma",
    generatedOn: "Generat el",
    school: "Centre",
    section_stats: "Estadístiques Generals",
    section_competency: "Cobertura de Competències LOMLOE",
    section_staff: "Activitat del Professorat",
    section_subjects: "Cobertura per Assignatura",
    section_groups: "Grups i Matrícula",
    group_name: "Grup",
    group_year: "Etapa",
    group_year_label: "Etapa",
    group_students: "Alumnes",
    group_total: "Matrícula Total",
    total_teachers: "Docents actius",
    total_plans: "Plans de lliçó",
    ai_plans: "Plans generats per IA",
    practice_sessions: "Sessions de pràctica",
    open_bias: "Alertes de biaix obertes",
    scan_runs: "Anàlisis (darrers 30 dies)",
    competency: "Competència",
    code: "Codi",
    plans: "Plans",
    pct: "Cobertura",
    teacher: "Docent",
    email: "Correu",
    plans_col: "Plans",
    ai_col: "Plans IA",
    last_active: "Darrera activitat",
    subject: "Assignatura",
    comp_count: "Competències cobertes",
    comp_list: "Codis de competència",
    never: "Mai",
    section_progress: "Progrés de l'Alumnat (LOMLOE)",
    section_infantil: "Progrés Educació Infantil (Decret 21/2023)",
    progress_class: "Grup",
    progress_students: "Alumnes",
    progress_activities: "Activitats",
    progress_overall: "Global",
    progress_no_data: "Sense dades",
    progress_school_avg: "Mitjana del Centre",
    progress_legend: "Llegenda de puntuació",
    infantil_eix: "Eix",
    infantil_desc: "Descripció",
    infantil_cycle03: "Cicle 0–3",
    infantil_cycle36: "Cicle 3–6",
    infantil_total: "Total",
    powered_by: "Impulsat per SEBA",
    lomloe_note: "Aquest informe ha estat generat en compliment dels requisits de transparència i responsabilitat de la LOMLOE (Llei Orgànica 3/2020).",
    gap_warning: "Les competències amb 0 plans de lliçó representen llacunes curriculars que requereixen atenció.",
  },
};

const BRAND_BLUE = "#1e3a5f";
const BRAND_TEAL = "#0d9488";
const LIGHT_GREY = "#f3f4f6";
const MID_GREY = "#9ca3af";

function sectionHeader(doc: InstanceType<typeof PDFDocument>, text: string, pageWidth: number) {
  doc.moveDown(0.8);
  const y = doc.y;
  doc.rect(40, y, pageWidth, 18).fillColor(BRAND_BLUE).fill();
  doc.fontSize(9).fillColor("#fff").font("Helvetica-Bold")
    .text(text, 46, y + 5, { width: pageWidth - 12 });
  doc.moveDown(0.5);
}

function addFooter(
  doc: InstanceType<typeof PDFDocument>,
  pageWidth: number,
  poweredBy: string,
  pageNum?: number,
  totalPages?: number,
  dateStr?: string,
) {
  const footerY = doc.page.height - 40;
  doc.moveTo(40, footerY).lineTo(40 + pageWidth, footerY).strokeColor(BRAND_BLUE).lineWidth(0.5).stroke();

  // Left: generation date
  if (dateStr) {
    doc.fontSize(7).fillColor(MID_GREY).font("Helvetica")
      .text(dateStr, 40, footerY + 6, { width: pageWidth / 2, align: "left" });
  }

  // Centre: page number
  if (pageNum != null && totalPages != null) {
    doc.fontSize(7).fillColor(MID_GREY).font("Helvetica")
      .text(`${pageNum} / ${totalPages}`, 40, footerY + 6, { width: pageWidth, align: "center" });
  }

  // Right: powered-by
  doc.fontSize(7).fillColor(MID_GREY).font("Helvetica")
    .text(poweredBy, 40, footerY + 6, { width: pageWidth, align: "right" });
}

export async function generateDirectorReportPdf(data: DirectorReportData): Promise<Buffer> {
  const L = LABELS[data.locale] ?? LABELS.en;

  // Pre-fetch school logo and director logo outside the Promise constructor
  let logoBuf: Buffer | null = null;
  if (data.logoUrl) {
    try {
      const logoRes = await fetch(data.logoUrl);
      logoBuf = Buffer.from(await logoRes.arrayBuffer());
    } catch { /* skip logo if fetch fails */ }
  }
  let directorLogoBuf: Buffer | null = null;
  if (data.directorLogoUrl) {
    try {
      if (data.directorLogoUrl.startsWith("data:")) {
        // base64 data URL — decode directly
        const base64 = data.directorLogoUrl.split(",")[1];
        if (base64) directorLogoBuf = Buffer.from(base64, "base64");
      } else {
        const dLogoRes = await fetch(data.directorLogoUrl);
        directorLogoBuf = Buffer.from(await dLogoRes.arrayBuffer());
      }
    } catch { /* skip if fetch fails */ }
  }

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    // bufferPages: true lets us iterate all pages at the end to stamp footers
    const doc = new PDFDocument({ margin: 40, size: "A4", bufferPages: true });
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageWidth = doc.page.width - 80;

    // Pre-compute the date string once for use in every footer
    const footerDateStr = data.generatedAt.toLocaleDateString(
      data.locale === "ca" ? "ca-ES" : data.locale === "es" ? "es-ES" : "en-GB",
      { day: "2-digit", month: "long", year: "numeric" },
    );

    // ── Cover header ─────────────────────────────────────────────────────────
    doc.rect(40, 30, pageWidth, 70).fillColor(BRAND_BLUE).fill();

    // Right column: director logo + name + title (right-aligned in header band)
    const rightColWidth = 160;
    const rightColX = 40 + pageWidth - rightColWidth;
    let rightContentY = 36;
    if (directorLogoBuf) {
      try {
        doc.image(directorLogoBuf, rightColX + rightColWidth - 52, rightContentY, { width: 48, height: 48, fit: [48, 48] });
        rightContentY += 4; // align text with image
      } catch { /* skip */ }
    }
    const dirNameX = rightColX;
    const dirTextWidth = directorLogoBuf ? rightColWidth - 56 : rightColWidth - 4;
    if (data.directorName) {
      doc.fontSize(9).fillColor("#fff").font("Helvetica-Bold")
        .text(data.directorName, dirNameX, rightContentY, { width: dirTextWidth, align: "right" });
      rightContentY += 13;
    }
    if (data.directorTitle) {
      doc.fontSize(8).fillColor("#c7d2fe").font("Helvetica")
        .text(data.directorTitle, dirNameX, rightContentY, { width: dirTextWidth, align: "right" });
    }

    // Left column: school logo + report title + subtitle
    const leftColWidth = pageWidth - rightColWidth - 12;
    if (logoBuf) {
      try {
        doc.image(logoBuf, 52, 34, { width: 48, height: 48, fit: [48, 48] });
      } catch { /* skip */ }
    }
    const titleX = logoBuf ? 108 : 52;
    const titleWidth = leftColWidth - (logoBuf ? 60 : 4);
    doc.fontSize(16).fillColor("#fff").font("Helvetica-Bold")
      .text(L.title, titleX, 38, { width: titleWidth });
    doc.fontSize(9).fillColor("#c7d2fe").font("Helvetica")
      .text(L.subtitle, titleX, 58, { width: titleWidth });
    doc.moveDown(0.3);

    // Meta row
    const dateStr = data.generatedAt.toLocaleDateString(
      data.locale === "ca" ? "ca-ES" : data.locale === "es" ? "es-ES" : "en-GB",
      { day: "2-digit", month: "long", year: "numeric" }
    );
    const metaParts: string[] = [`${L.generatedOn}: ${dateStr}`];
    if (data.schoolName) metaParts.push(`${L.school}: ${data.schoolName}`);
    doc.fontSize(8).fillColor("#444").font("Helvetica")
      .text(metaParts.join("   |   "), 40, doc.y + 8, { width: pageWidth });

    // ── Stats grid ────────────────────────────────────────────────────────────
    sectionHeader(doc, L.section_stats, pageWidth);

    const statsItems = [
      { label: L.total_teachers, value: String(data.stats.totalTeachers) },
      { label: L.total_plans, value: String(data.stats.totalLessonPlans) },
      { label: L.ai_plans, value: String(data.stats.aiGeneratedPlans) },
      { label: L.practice_sessions, value: String(data.stats.totalPracticeSessions) },
      { label: L.open_bias, value: String(data.stats.openBiasFlags) },
      { label: L.scan_runs, value: String(data.stats.recentScanRuns) },
    ];

    const colW = pageWidth / 3;
    let sx = 40;
    let sy = doc.y;
    statsItems.forEach((item, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = sx + col * colW;
      const y = sy + row * 36;
      doc.rect(x + 2, y, colW - 4, 32).fillColor(LIGHT_GREY).fill();
      doc.fontSize(14).fillColor(BRAND_TEAL).font("Helvetica-Bold")
        .text(item.value, x + 6, y + 4, { width: colW - 12 });
      doc.fontSize(7).fillColor("#555").font("Helvetica")
        .text(item.label, x + 6, y + 20, { width: colW - 12 });
    });
    doc.y = sy + Math.ceil(statsItems.length / 3) * 36 + 4;

    // ── Competency coverage table ─────────────────────────────────────────────
    sectionHeader(doc, L.section_competency, pageWidth);

    // Table header
    const cColCode = 40;
    const cColLabel = 80;
    const cColPlans = 340;
    const cColPct = 400;
    const cColBar = 450;

    const drawCompHeader = () => {
      const y = doc.y;
      doc.fontSize(7).fillColor(MID_GREY).font("Helvetica-Bold");
      doc.text(L.code, cColCode, y, { width: 36 });
      doc.text(L.competency, cColLabel, y, { width: 255 });
      doc.text(L.plans, cColPlans, y, { width: 55 });
      doc.text(L.pct, cColPct, y, { width: 45 });
      doc.moveDown(0.3);
      doc.moveTo(40, doc.y).lineTo(40 + pageWidth, doc.y).strokeColor("#e5e7eb").lineWidth(0.5).stroke();
      doc.moveDown(0.2);
    };
    drawCompHeader();

    for (const comp of data.competencyCoverage) {
      if (doc.y > doc.page.height - 80) {
        doc.addPage();
        drawCompHeader();
      }
      const y = doc.y;
      const isGap = comp.count === 0;
      if (isGap) {
        doc.rect(40, y - 1, pageWidth, 14).fillColor("#fef2f2").fill();
      }
      doc.fontSize(7.5).fillColor(isGap ? "#dc2626" : "#1f2937").font(isGap ? "Helvetica-Bold" : "Helvetica");
      doc.text(comp.code, cColCode, y, { width: 36 });
      doc.text(comp.label, cColLabel, y, { width: 255 });
      doc.text(String(comp.count), cColPlans, y, { width: 55 });
      doc.text(`${comp.percentage}%`, cColPct, y, { width: 45 });
      // Mini bar
      const barMaxW = 80;
      const barW = Math.round((comp.percentage / 100) * barMaxW);
      doc.rect(cColBar, y + 2, barMaxW, 6).fillColor("#e5e7eb").fill();
      if (barW > 0) {
        doc.rect(cColBar, y + 2, barW, 6).fillColor(isGap ? "#dc2626" : BRAND_TEAL).fill();
      }
      doc.moveDown(0.45);
    }

    // Gap warning
    const gapCount = data.competencyCoverage.filter(c => c.count === 0).length;
    if (gapCount > 0) {
      doc.moveDown(0.3);
      doc.fontSize(7.5).fillColor("#dc2626").font("Helvetica-Oblique")
        .text(`⚠  ${L.gap_warning}`, 40, doc.y, { width: pageWidth });
    }

    // ── Staff activity table ──────────────────────────────────────────────────
    if (data.staffActivity.length > 0) {
      if (doc.y > doc.page.height - 120) doc.addPage();
      sectionHeader(doc, L.section_staff, pageWidth);

      const sColName = 40;
      const sColEmail = 180;
      const sColPlans = 350;
      const sColAi = 400;
      const sColLast = 450;

      const drawStaffHeader = () => {
        const y = doc.y;
        doc.fontSize(7).fillColor(MID_GREY).font("Helvetica-Bold");
        doc.text(L.teacher, sColName, y, { width: 135 });
        doc.text(L.email, sColEmail, y, { width: 165 });
        doc.text(L.plans_col, sColPlans, y, { width: 45 });
        doc.text(L.ai_col, sColAi, y, { width: 45 });
        doc.text(L.last_active, sColLast, y, { width: 90 });
        doc.moveDown(0.3);
        doc.moveTo(40, doc.y).lineTo(40 + pageWidth, doc.y).strokeColor("#e5e7eb").lineWidth(0.5).stroke();
        doc.moveDown(0.2);
      };
      drawStaffHeader();

      for (let i = 0; i < data.staffActivity.length; i++) {
        const t = data.staffActivity[i];
        if (doc.y > doc.page.height - 80) {
          doc.addPage();
          drawStaffHeader();
        }
        const y = doc.y;
        if (i % 2 === 0) {
          doc.rect(40, y - 1, pageWidth, 13).fillColor(LIGHT_GREY).fill();
        }
        const lastStr = t.lastActive
          ? new Date(t.lastActive).toLocaleDateString(
              data.locale === "ca" ? "ca-ES" : data.locale === "es" ? "es-ES" : "en-GB",
              { day: "2-digit", month: "short", year: "numeric" }
            )
          : L.never;
        doc.fontSize(7.5).fillColor("#1f2937").font("Helvetica");
        doc.text(t.name ?? "—", sColName, y, { width: 135 });
        doc.text(t.email ?? "—", sColEmail, y, { width: 165 });
        doc.text(String(t.plansCreated), sColPlans, y, { width: 45 });
        doc.text(String(t.aiPlans), sColAi, y, { width: 45 });
        doc.text(lastStr, sColLast, y, { width: 90 });
        doc.moveDown(0.45);
      }
    }

    // ── Subject coverage table ────────────────────────────────────────────────
    if (data.subjectCoverage.length > 0) {
      if (doc.y > doc.page.height - 120) doc.addPage();
      sectionHeader(doc, L.section_subjects, pageWidth);

      const subColSubject = 40;
      const subColCount = 280;
      const subColList = 340;

      const drawSubjectHeader = () => {
        const y = doc.y;
        doc.fontSize(7).fillColor(MID_GREY).font("Helvetica-Bold");
        doc.text(L.subject, subColSubject, y, { width: 235 });
        doc.text(L.comp_count, subColCount, y, { width: 55 });
        doc.text(L.comp_list, subColList, y, { width: pageWidth - (subColList - 40) });
        doc.moveDown(0.3);
        doc.moveTo(40, doc.y).lineTo(40 + pageWidth, doc.y).strokeColor("#e5e7eb").lineWidth(0.5).stroke();
        doc.moveDown(0.2);
      };
      drawSubjectHeader();

      for (let i = 0; i < data.subjectCoverage.length; i++) {
        const s = data.subjectCoverage[i];
        if (doc.y > doc.page.height - 80) {
          doc.addPage();
          drawSubjectHeader();
        }
        const y = doc.y;
        if (i % 2 === 0) {
          doc.rect(40, y - 1, pageWidth, 13).fillColor(LIGHT_GREY).fill();
        }
        doc.fontSize(7.5).fillColor("#1f2937").font("Helvetica");
        doc.text(s.subject, subColSubject, y, { width: 235 });
        doc.text(String(s.competenciesCovered), subColCount, y, { width: 55 });
        doc.text(s.competencyList.join(", "), subColList, y, { width: pageWidth - (subColList - 40) });
        doc.moveDown(0.45);
      }
    }

    // ── Groups & Enrolment ────────────────────────────────────────────────────
    if (data.classGroups && data.classGroups.length > 0) {
      sectionHeader(doc, L.section_groups, pageWidth);
      doc.moveDown(0.2);

      const ygLabels = YEAR_GROUP_LABELS[data.locale] ?? YEAR_GROUP_LABELS.en;
      const grpColName = 40;
      const grpColYear = 200;
      const grpColStudents = 340;

      const drawGroupHeader = () => {
        const y = doc.y;
        doc.fontSize(7).fillColor(MID_GREY).font("Helvetica-Bold");
        doc.text(L.group_name, grpColName, y, { width: 155 });
        doc.text(L.group_year_label, grpColYear, y, { width: 135 });
        doc.text(L.group_students, grpColStudents, y, { width: 80 });
        doc.moveDown(0.3);
        doc.moveTo(40, doc.y).lineTo(40 + pageWidth, doc.y).strokeColor("#e5e7eb").lineWidth(0.5).stroke();
        doc.moveDown(0.2);
      };
      drawGroupHeader();

      let totalEnrolment = 0;
      for (let i = 0; i < data.classGroups.length; i++) {
        const g = data.classGroups[i];
        if (doc.y > doc.page.height - 80) {
          doc.addPage();
          drawGroupHeader();
        }
        const y = doc.y;
        if (i % 2 === 0) {
          doc.rect(40, y - 1, pageWidth, 13).fillColor(LIGHT_GREY).fill();
        }
        doc.fontSize(7.5).fillColor("#1f2937").font("Helvetica");
        doc.text(g.className, grpColName, y, { width: 155 });
        doc.text(ygLabels[g.yearGroup] ?? g.yearGroup, grpColYear, y, { width: 135 });
        doc.text(String(g.studentCount), grpColStudents, y, { width: 80 });
        doc.moveDown(0.45);
        totalEnrolment += g.studentCount;
      }

      // Total row
      doc.moveDown(0.3);
      doc.moveTo(40, doc.y).lineTo(40 + pageWidth, doc.y).strokeColor(BRAND_BLUE).lineWidth(0.5).stroke();
      doc.moveDown(0.2);
      const totY = doc.y;
      doc.fontSize(8).fillColor(BRAND_BLUE).font("Helvetica-Bold");
      doc.text(L.group_total, grpColName, totY, { width: 290 });
      doc.text(String(totalEnrolment), grpColStudents, totY, { width: 80 });
      doc.moveDown(0.6);
    }

    // ── Student Progress (LOMLOE Competency Heatmap) ─────────────────────────
    if (data.studentProgress && data.studentProgress.groups.length > 0) {
      if (doc.y > doc.page.height - 120) doc.addPage();
      sectionHeader(doc, L.section_progress, pageWidth);

      const LOMLOE_CODES = ["CCL", "CP", "STEM", "CD", "CPSAA", "CC", "CE", "CCEC"];
      const codeW = 28;
      const classColW = 110;
      const studColW = 38;
      const overallColW = 40;
      const heatStartX = 40 + classColW + studColW;

      // Helper: fill colour for score
      const heatFill = (score: number | null): string => {
        if (score === null) return "#f3f4f6";
        if (score >= 80) return "#10b981";
        if (score >= 65) return "#2dd4bf";
        if (score >= 50) return "#fbbf24";
        if (score >= 35) return "#f97316";
        return "#ef4444";
      };
      const heatText = (score: number | null): string => {
        if (score === null) return "—";
        return String(score);
      };

      const drawProgressHeader = () => {
        const y = doc.y;
        doc.fontSize(6.5).fillColor(MID_GREY).font("Helvetica-Bold");
        doc.text(L.progress_class, 40, y, { width: classColW });
        doc.text(L.progress_students, 40 + classColW, y, { width: studColW });
        LOMLOE_CODES.forEach((code, i) => {
          doc.text(code, heatStartX + i * codeW, y, { width: codeW - 2 });
        });
        doc.text(L.progress_overall, heatStartX + LOMLOE_CODES.length * codeW + 4, y, { width: overallColW });
        doc.moveDown(0.3);
        doc.moveTo(40, doc.y).lineTo(40 + pageWidth, doc.y).strokeColor("#e5e7eb").lineWidth(0.5).stroke();
        doc.moveDown(0.2);
      };
      drawProgressHeader();

      for (let i = 0; i < data.studentProgress.groups.length; i++) {
        const g = data.studentProgress.groups[i];
        if (doc.y > doc.page.height - 80) {
          doc.addPage();
          drawProgressHeader();
        }
        const y = doc.y;
        if (i % 2 === 0) {
          doc.rect(40, y - 1, pageWidth, 14).fillColor(LIGHT_GREY).fill();
        }
        doc.fontSize(7).fillColor("#1f2937").font("Helvetica");
        doc.text(g.className, 40, y, { width: classColW });
        doc.text(String(g.studentCount), 40 + classColW, y, { width: studColW });
        LOMLOE_CODES.forEach((code, ci) => {
          const entry = g.competencyAverages.find(c => c.code === code);
          const score = entry?.average ?? null;
          const cellX = heatStartX + ci * codeW;
          doc.rect(cellX + 1, y, codeW - 3, 12).fillColor(heatFill(score)).fill();
          doc.fontSize(6).fillColor(score !== null && score >= 50 ? "#fff" : "#374151").font("Helvetica-Bold")
            .text(heatText(score), cellX + 1, y + 2, { width: codeW - 3, align: "center" });
        });
        const overallX = heatStartX + LOMLOE_CODES.length * codeW + 4;
        const ov = g.overall;
        doc.rect(overallX, y, overallColW - 4, 12).fillColor(heatFill(ov)).fill();
        doc.fontSize(6.5).fillColor(ov !== null && ov >= 50 ? "#fff" : "#374151").font("Helvetica-Bold")
          .text(ov !== null ? `${ov}%` : "—", overallX, y + 2, { width: overallColW - 4, align: "center" });
        doc.moveDown(0.55);
      }

      // School-wide average row
      doc.moveDown(0.2);
      doc.moveTo(40, doc.y).lineTo(40 + pageWidth, doc.y).strokeColor(BRAND_BLUE).lineWidth(0.5).stroke();
      doc.moveDown(0.2);
      const avgY = doc.y;
      doc.fontSize(7).fillColor(BRAND_BLUE).font("Helvetica-Bold");
      doc.text(L.progress_school_avg, 40, avgY, { width: classColW + studColW });
      LOMLOE_CODES.forEach((code, ci) => {
        const entry = data.studentProgress!.schoolAverages.find(c => c.code === code);
        const score = entry?.average ?? null;
        const cellX = heatStartX + ci * codeW;
        doc.rect(cellX + 1, avgY, codeW - 3, 12).fillColor(heatFill(score)).fill();
        doc.fontSize(6).fillColor(score !== null && score >= 50 ? "#fff" : "#374151").font("Helvetica-Bold")
          .text(heatText(score), cellX + 1, avgY + 2, { width: codeW - 3, align: "center" });
      });
      doc.moveDown(0.8);

      // Colour legend
      const legendItems = [
        { label: "≥80", fill: "#10b981" },
        { label: "65–79", fill: "#2dd4bf" },
        { label: "50–64", fill: "#fbbf24" },
        { label: "35–49", fill: "#f97316" },
        { label: "<35", fill: "#ef4444" },
        { label: L.progress_no_data, fill: "#f3f4f6" },
      ];
      doc.fontSize(6.5).fillColor(MID_GREY).font("Helvetica");
      doc.text(`${L.progress_legend}: `, 40, doc.y, { continued: true });
      let lx = 40 + 70;
      const ly = doc.y - 1;
      legendItems.forEach(item => {
        doc.rect(lx, ly, 10, 8).fillColor(item.fill).fill();
        doc.fillColor(MID_GREY).text(` ${item.label}  `, lx + 12, ly + 1, { continued: true });
        lx += 12 + doc.widthOfString(` ${item.label}  `) + 4;
      });
      doc.text("", { continued: false });
      doc.moveDown(0.5);
    }

    // ── Educació Infantil Progress ────────────────────────────────────────────
    if (data.infantilProgress && data.infantilProgress.totalInfantilPlans > 0) {
      if (doc.y > doc.page.height - 120) doc.addPage();
      sectionHeader(doc, L.section_infantil, pageWidth);

      const EIXOS = [
        { code: "EIX1", label: { en: "Identity & Autonomy", es: "Identidad y Autonomía", ca: "Identitat i Autonomia" } },
        { code: "EIX2", label: { en: "Discovery of the Environment", es: "Descubrimiento del Entorno", ca: "Descoberta de l'Entorn" } },
        { code: "EIX3", label: { en: "Communication & Languages", es: "Comunicación y Lenguajes", ca: "Comunicació i Llenguatges" } },
        { code: "EIX4", label: { en: "Coexistence", es: "Convivencia", ca: "Convivència" } },
      ];

      // Summary stats
      const infStatY = doc.y;
      const infColW = pageWidth / 3;
      const infStats = [
        { label: "Lesson Plans", value: String(data.infantilProgress.totalInfantilPlans) },
        { label: "Teachers", value: String(data.infantilProgress.teacherCount) },
        { label: "Eixos Covered", value: `${data.infantilProgress.eixSummary.filter(e => e.total > 0).length}/4` },
      ];
      infStats.forEach((s, i) => {
        const x = 40 + i * infColW;
        doc.rect(x + 2, infStatY, infColW - 4, 28).fillColor("#fffbeb").fill();
        doc.fontSize(13).fillColor("#d97706").font("Helvetica-Bold")
          .text(s.value, x + 6, infStatY + 3, { width: infColW - 12 });
        doc.fontSize(6.5).fillColor("#555").font("Helvetica")
          .text(s.label, x + 6, infStatY + 17, { width: infColW - 12 });
      });
      doc.y = infStatY + 32;

      // Eix table
      const eixColCode = 40;
      const eixColLabel = 80;
      const eixColC03 = 340;
      const eixColC36 = 390;
      const eixColTotal = 440;

      const drawEixHeader = () => {
        const y = doc.y;
        doc.fontSize(7).fillColor(MID_GREY).font("Helvetica-Bold");
        doc.text(L.infantil_eix, eixColCode, y, { width: 36 });
        doc.text(L.infantil_desc, eixColLabel, y, { width: 255 });
        doc.text(L.infantil_cycle03, eixColC03, y, { width: 45 });
        doc.text(L.infantil_cycle36, eixColC36, y, { width: 45 });
        doc.text(L.infantil_total, eixColTotal, y, { width: 45 });
        doc.moveDown(0.3);
        doc.moveTo(40, doc.y).lineTo(40 + pageWidth, doc.y).strokeColor("#e5e7eb").lineWidth(0.5).stroke();
        doc.moveDown(0.2);
      };
      drawEixHeader();

      for (let i = 0; i < EIXOS.length; i++) {
        const eix = EIXOS[i];
        const entry = data.infantilProgress.eixSummary.find(e => e.eix === eix.code);
        if (doc.y > doc.page.height - 80) {
          doc.addPage();
          drawEixHeader();
        }
        const y = doc.y;
        if (i % 2 === 0) {
          doc.rect(40, y - 1, pageWidth, 13).fillColor("#fffbeb").fill();
        }
        doc.fontSize(7.5).fillColor("#1f2937").font("Helvetica");
        doc.text(eix.code, eixColCode, y, { width: 36 });
        doc.text(eix.label[data.locale] ?? eix.label.en, eixColLabel, y, { width: 255 });
        doc.text(String(entry?.cycle03 ?? 0), eixColC03, y, { width: 45 });
        doc.text(String(entry?.cycle36 ?? 0), eixColC36, y, { width: 45 });
        doc.text(String(entry?.total ?? 0), eixColTotal, y, { width: 45 });
        doc.moveDown(0.45);
      }
      doc.moveDown(0.5);
    }

    // ── LOMLOE compliance note ────────────────────────────────────────────────
    doc.moveDown(1);
    doc.rect(40, doc.y, pageWidth, 28).fillColor("#f0fdf4").fill();
    doc.fontSize(7).fillColor("#166534").font("Helvetica-Oblique")
      .text(L.lomloe_note, 46, doc.y - 22, { width: pageWidth - 12 });

    // ── Stamp footers on every buffered page ─────────────────────────────────
    const range = doc.bufferedPageRange();
    const totalPages = range.count;
    for (let i = 0; i < totalPages; i++) {
      doc.switchToPage(range.start + i);
      addFooter(doc, pageWidth, L.powered_by, i + 1, totalPages, footerDateStr);
    }

    doc.end();
  });
}
