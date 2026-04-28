import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { toast } from "sonner";
import { Plus, Trash2, Printer, BookOpen, Save, SaveAll, List, X, Copy, LayoutTemplate, FolderOpen, FileDown, ArrowUpDown, ArrowUp01, CalendarDays, Loader2, RefreshCw, Hash, ArrowLeft, Pencil, Search, SlidersHorizontal, GraduationCap, Clock } from "lucide-react";
import { SebaSymbol } from "@/components/SebaSymbol";
import { useLocation } from "wouter";
import NavBar from "@/components/NavBar";
import LogoUploader from "@/components/LogoUploader";
import { useI18n } from "@/contexts/I18nContext";
import { useIsMobile } from "@/hooks/useMobile";
import { exportToCsv, exportToXml } from "@/lib/exportUtils";
import ExportDropdown, { PrintIcon, CsvIcon, XmlIcon } from "@/components/ExportDropdown";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";


const COMPETENCIES = ["CCL", "CP", "STEM", "CD", "CPSAA", "CC", "CE", "CCEC"];
const YEAR_GROUPS = ["Infantil (0-3)", "Infantil (3-6)", "1st Primary", "2nd Primary", "3rd Primary", "4th Primary", "5th Primary", "6th Primary", "1st Secondary", "2nd Secondary", "3rd Secondary", "4th Secondary"];
const SUBJECTS = ["English", "Maths", "Science", "Social Studies", "Art", "PE", "Music", "Technology", "Spanish", "Catalan"];
const INFANTIL_EIXOS = [
  { code: "EIX1", label: "EIX1 – Descoberta d'un mateix i dels altres" },
  { code: "EIX2", label: "EIX2 – Descoberta de l'entorn" },
  { code: "EIX3", label: "EIX3 – Comunicació i llenguatges" },
  { code: "EIX4", label: "EIX4 – Benestar i salut" },
];
const INFANTIL_CYCLES = [
  { value: "0-3", label: "Primer cicle (0–3 anys)" },
  { value: "3-6", label: "Segon cicle (3–6 anys)" },
];
const CURRENT_YEAR = new Date().getFullYear();
const ACADEMIC_YEARS = [`${CURRENT_YEAR - 1}-${CURRENT_YEAR}`, `${CURRENT_YEAR}-${CURRENT_YEAR + 1}`];

const SKILL_KEYS = ["listening", "speaking", "reading", "writing"] as const;
const SYSTEM_KEYS = ["grammar", "phonology", "lexis", "function", "discourse"] as const;

type Procedure = { timing: string; stage: string; activities: string; grouping: string };

type LessonFormState = {
  title: string;
  unit: string;
  lessonNumber: string;
  academicYear: string;
  duration: number;
  yearGroup: string;
  subject: string;
  sessionTime: string;
  skills: Record<string, boolean>;
  systems: Record<string, boolean>;
  specificCompetences: string[];
  saberesBasicos: string[];
  learningOutcomes: string[];
  evaluationCriteria: string[];
  previousKnowledge: string;
  materials: string;
  spaces: string;
  procedures: Procedure[];
  competencies: string[];
  differentiation: {
    advanced: { objectives: string; activities: string; assessment: string };
    standard: { objectives: string; activities: string; assessment: string };
    slower: { objectives: string; activities: string; assessment: string };
  } | null;
  /** Educació Infantil eix (EIX1–EIX4) — null for non-Infantil plans */
  infantilEix: string | null;
  /** Educació Infantil cycle ('0-3' or '3-6') — null for non-Infantil plans */
  infantilCycle: string | null;
};

const emptyForm = (): LessonFormState => {
  let profile = { defaultSubject: "", defaultYear: "" };
  try {
    const raw = localStorage.getItem("seba_school_profile");
    if (raw) profile = JSON.parse(raw);
  } catch { /* ignore */ }
  return {
    title: "",
    unit: "",
    lessonNumber: "",
    academicYear: ACADEMIC_YEARS[1],
    duration: 60,
    yearGroup: profile.defaultYear || YEAR_GROUPS[3],
    subject: profile.defaultSubject || "English",
    sessionTime: "",
    skills: { listening: false, speaking: false, reading: false, writing: false },
    systems: { grammar: false, phonology: false, lexis: false, function: false, discourse: false },
    specificCompetences: [],
    saberesBasicos: [""],
    learningOutcomes: [""],
    evaluationCriteria: [""],
    previousKnowledge: "",
    materials: "",
    spaces: "Classroom",
    procedures: [{ timing: "10 min", stage: "Warm-up", activities: "", grouping: "Whole class" }],
    competencies: [],
    differentiation: null,
    infantilEix: null,
    infantilCycle: null,
  };
};

function parseJsonField<T>(val: string | null | undefined | T, fallback: T): T {
  if (val === null || val === undefined || val === "") return fallback;
  // Already parsed (e.g. from AI mutation response)
  if (typeof val !== "string") return val as T;
  try { return JSON.parse(val) as T; } catch { return fallback; }
}

function planToForm(plan: any): LessonFormState {
  return {
    title: plan.title ?? "",
    unit: plan.unit ?? "",
    lessonNumber: plan.lessonNumber ?? "",
    academicYear: plan.academicYear ?? ACADEMIC_YEARS[1],
    duration: plan.duration ?? 60,
    yearGroup: plan.yearGroup ?? YEAR_GROUPS[3],
    subject: plan.subject ?? "English",
    sessionTime: plan.sessionTime ?? "",
    skills: parseJsonField(plan.skills, { listening: false, speaking: false, reading: false, writing: false }),
    systems: parseJsonField(plan.systems, { grammar: false, phonology: false, lexis: false, function: false, discourse: false }),
    specificCompetences: parseJsonField(plan.specificCompetences, []),
    saberesBasicos: parseJsonField(plan.saberesBasicos, [""]),
    learningOutcomes: parseJsonField(plan.learningOutcomes, [""]),
    evaluationCriteria: parseJsonField(plan.evaluationCriteria, [""]),
    previousKnowledge: plan.previousKnowledge ?? "",
    materials: plan.materials ?? "",
    spaces: plan.spaces ?? "Classroom",
    procedures: parseJsonField(plan.procedures, [{ timing: "10 min", stage: "Warm-up", activities: "", grouping: "Whole class" }]),
    infantilEix: (plan as any).infantilEix ?? null,
    infantilCycle: (plan as any).infantilCycle ?? null,
    competencies: parseJsonField(plan.competencies, []),
    differentiation: parseJsonField(plan.differentiation, null),
  };
}

function formToSave(form: LessonFormState) {
  return {
    ...form,
    skills: JSON.stringify(form.skills),
    systems: JSON.stringify(form.systems),
    specificCompetences: JSON.stringify(form.specificCompetences),
    saberesBasicos: JSON.stringify(form.saberesBasicos),
    learningOutcomes: JSON.stringify(form.learningOutcomes),
    evaluationCriteria: JSON.stringify(form.evaluationCriteria),
    procedures: JSON.stringify(form.procedures),
    competencies: JSON.stringify(form.competencies),
    differentiation: form.differentiation ? JSON.stringify(form.differentiation) : null,
  };
}

// ─── Print Preview ─────────────────────────────────────────────────────────────
function buildPrintHtml(form: LessonFormState, logoDataUrl?: string, labels?: Record<string,string>): string {
  const L = labels ?? {};
  const schoolLogo = logoDataUrl ? `<img src="${logoDataUrl}" style="float:right;max-height:56px;max-width:120px;object-fit:contain;" alt="${L.school_logo ?? 'School logo'}"/>` : "";
  const competencyBadges = form.competencies.map(c => `<span style="display:inline-block;padding:2px 8px;border-radius:4px;background:#0f766e;color:#fff;font-size:11px;margin:2px;">${c}</span>`).join("");
  const skillsList = SKILL_KEYS.filter(k => form.skills[k]).map(k => k.charAt(0).toUpperCase() + k.slice(1)).join(", ");
  const systemsList = SYSTEM_KEYS.filter(k => form.systems[k]).map(k => k.charAt(0).toUpperCase() + k.slice(1)).join(", ");
  const procedureRows = form.procedures.map(p => `
    <tr>
      <td style="padding:6px;border:1px solid #e5e7eb;width:80px;">${p.timing}</td>
      <td style="padding:6px;border:1px solid #e5e7eb;width:100px;">${p.stage}</td>
      <td style="padding:6px;border:1px solid #e5e7eb;">${p.activities}</td>
      <td style="padding:6px;border:1px solid #e5e7eb;width:100px;">${p.grouping}</td>
    </tr>`).join("");

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<title>${L.lp_print_title ?? 'Lesson Plan'} — ${form.title}</title>
<style>
  @page { size: A4; margin: 20mm; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; color: #111; line-height: 1.5; }
  h1 { font-size: 18px; margin: 0 0 4px; color: #0f172a; }
  h2 { font-size: 13px; margin: 14px 0 4px; color: #0f766e; border-bottom: 1px solid #e5e7eb; padding-bottom: 2px; }
  .meta { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px; margin: 10px 0; }
  .meta-item { background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 4px; padding: 4px 8px; }
  .meta-label { font-size: 9px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
  .meta-value { font-weight: 600; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th { background: #0f766e; color: #fff; padding: 6px; text-align: left; font-size: 10px; }
  ul { margin: 4px 0; padding-left: 18px; }
  li { margin-bottom: 2px; }
  .header { overflow: hidden; margin-bottom: 12px; padding-bottom: 10px; border-bottom: 2px solid #0f766e; }
  .footer { margin-top: 20px; font-size: 9px; color: #94a3b8; text-align: center; }
</style></head><body>
<div class="header">
  ${schoolLogo}
  <h1>${form.title || (L.lp_print_title ?? 'Lesson Plan')}</h1>
  <div style="color:#64748b;font-size:11px;">${L.lp_unit ?? 'Unit'} ${form.unit || "—"} · ${L.lp_lesson ?? 'Lesson'} ${form.lessonNumber || "—"} · ${form.academicYear}</div>
  <div style="margin-top:6px;">${competencyBadges}</div>
</div>

<div class="meta">
  <div class="meta-item"><div class="meta-label">${L.lp_year_group ?? 'Year Group'}</div><div class="meta-value">${form.yearGroup}</div></div>
  <div class="meta-item"><div class="meta-label">${L.lp_subject ?? 'Subject'}</div><div class="meta-value">${form.subject}</div></div>
  <div class="meta-item"><div class="meta-label">${L.lp_duration ?? 'Duration'}</div><div class="meta-value">${form.duration} min</div></div>
  <div class="meta-item"><div class="meta-label">${L.lp_skills ?? 'Skills'}</div><div class="meta-value">${skillsList || "—"}</div></div>
  <div class="meta-item"><div class="meta-label">${L.lp_language_systems ?? 'Language Systems'}</div><div class="meta-value">${systemsList || "—"}</div></div>
  <div class="meta-item"><div class="meta-label">${L.lp_spaces ?? 'Spaces'}</div><div class="meta-value">${form.spaces}</div></div>
</div>

<h2>${L.lp_specific_competences ?? 'Specific Competences'}</h2>
<p>${form.specificCompetences.filter(Boolean).join(", ") || "—"}</p>

<h2>${L.lp_saberes_basicos ?? 'Saberes Básicos'}</h2>
<ul>${form.saberesBasicos.filter(Boolean).map(s => `<li>${s}</li>`).join("") || "<li>—</li>"}</ul>

<h2>${L.lp_learning_outcomes ?? 'Learning Outcomes'}</h2>
<ul>${form.learningOutcomes.filter(Boolean).map(s => `<li>${s}</li>`).join("") || "<li>—</li>"}</ul>

<h2>${L.lp_evaluation_criteria ?? 'Evaluation Criteria'}</h2>
<ul>${form.evaluationCriteria.filter(Boolean).map(s => `<li>${s}</li>`).join("") || "<li>—</li>"}</ul>

<h2>${L.lp_previous_knowledge ?? 'Previous Knowledge'}</h2>
<p>${form.previousKnowledge || "—"}</p>

<h2>${L.lp_materials ?? 'Materials'}</h2>
<p>${form.materials || "—"}</p>

<h2>${L.lp_lesson_procedure ?? 'Lesson Procedure'}</h2>
<table>
  <thead><tr><th>${L.lp_timing ?? 'Timing'}</th><th>${L.lp_stage ?? 'Stage'}</th><th>${L.lp_activities ?? 'Activities'}</th><th>${L.lp_grouping ?? 'Grouping'}</th></tr></thead>
  <tbody>${procedureRows}</tbody>
</table>

${form.differentiation ? `
<h2>${L.lp_differentiation ?? 'Differentiated Instruction'}</h2>
<table style="width:100%;border-collapse:collapse;">
  <thead>
    <tr>
      <th style="background:#1e40af;color:#fff;padding:6px;text-align:left;font-size:10px;width:33%;">🔵 ${L.lp_diff_advanced ?? 'Advanced Learners'}</th>
      <th style="background:#15803d;color:#fff;padding:6px;text-align:left;font-size:10px;width:33%;">🟢 ${L.lp_diff_standard ?? 'Standard Learners'}</th>
      <th style="background:#b45309;color:#fff;padding:6px;text-align:left;font-size:10px;width:33%;">🟡 ${L.lp_diff_slower ?? 'Assisted Learners'}</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="padding:6px;border:1px solid #e5e7eb;vertical-align:top;"><strong>${L.lp_diff_objectives ?? 'Objectives'}:</strong><br/>${form.differentiation.advanced.objectives || '—'}<br/><br/><strong>${L.lp_diff_activities ?? 'Activities'}:</strong><br/>${form.differentiation.advanced.activities || '—'}<br/><br/><strong>${L.lp_diff_assessment ?? 'Assessment'}:</strong><br/>${form.differentiation.advanced.assessment || '—'}</td>
      <td style="padding:6px;border:1px solid #e5e7eb;vertical-align:top;"><strong>${L.lp_diff_objectives ?? 'Objectives'}:</strong><br/>${form.differentiation.standard.objectives || '—'}<br/><br/><strong>${L.lp_diff_activities ?? 'Activities'}:</strong><br/>${form.differentiation.standard.activities || '—'}<br/><br/><strong>${L.lp_diff_assessment ?? 'Assessment'}:</strong><br/>${form.differentiation.standard.assessment || '—'}</td>
      <td style="padding:6px;border:1px solid #e5e7eb;vertical-align:top;"><strong>${L.lp_diff_objectives ?? 'Objectives'}:</strong><br/>${form.differentiation.slower.objectives || '—'}<br/><br/><strong>${L.lp_diff_activities ?? 'Activities'}:</strong><br/>${form.differentiation.slower.activities || '—'}<br/><br/><strong>${L.lp_diff_assessment ?? 'Assessment'}:</strong><br/>${form.differentiation.slower.assessment || '—'}</td>
    </tr>
  </tbody>
</table>` : ''}

<div class="footer">${L.lp_generated_by ?? 'Generated by AINA | TA'} · ${new Date().toLocaleDateString()}</div>
</body></html>`;
}

// ─── Saved Plans List (shared between sidebar and sheet) ───────────────────────
function PlansList({ plans, calendars, selectedId, onLoad, onNew, onAi, onDuplicate, onDelete, onJumpToCalendar, batchSelectMode, setBatchSelectMode, selectedPlanIds, setSelectedPlanIds, onBatchDelete, onBatchCopy, onBatchExportPdf, batchExportPdfLoading, onBatchFillAll, batchFillAllLoading, batchFillAllProgress, t }: {
  plans: any[];
  calendars: any[];
  selectedId: number | null;
  onLoad: (p: any) => void;
  onNew: () => void;
  onAi: () => void;
  onDuplicate: (p: any) => void;
  onDelete: (id: number) => void;
  onJumpToCalendar: (calendarEventId: number, calendarId: number) => void;
  batchSelectMode: boolean;
  setBatchSelectMode: (v: boolean) => void;
  selectedPlanIds: Set<number>;
  setSelectedPlanIds: (s: Set<number>) => void;
  onBatchDelete: () => void;
  onBatchCopy: () => void;
  onBatchExportPdf: () => void;
  batchExportPdfLoading?: boolean;
  onBatchFillAll: () => void;
  batchFillAllLoading?: boolean;
  batchFillAllProgress?: { current: number; total: number; planTitle?: string } | null;
  t: (k: any) => string;
}) {
  const [sortByLesson, setSortByLesson] = useState(() => {
    try { return localStorage.getItem("seba_planner_sort_by_lesson") === "1"; } catch { return false; }
  });
  const [calendarFilter, setCalendarFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const toggleSelect = (id: number) => {
    const next = new Set(selectedPlanIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedPlanIds(next);
  };
  const allSelected = plans.length > 0 && plans.every(p => selectedPlanIds.has(p.id));
  const toggleAll = () => {
    if (allSelected) setSelectedPlanIds(new Set());
    else setSelectedPlanIds(new Set(plans.map(p => p.id)));
  };

  const calendarFiltered = calendarFilter === "all"
    ? plans
    : calendarFilter === "unlinked"
      ? plans.filter((p: any) => !p.calendarId)
      : plans.filter((p: any) => String(p.calendarId) === calendarFilter);

  const searchFiltered = searchQuery.trim()
    ? calendarFiltered.filter((p: any) => {
        const q = searchQuery.toLowerCase();
        return (
          (p.title || "").toLowerCase().includes(q) ||
          (p.subject || "").toLowerCase().includes(q) ||
          (p.yearGroup || "").toLowerCase().includes(q) ||
          (p.unit || "").toLowerCase().includes(q)
        );
      })
    : calendarFiltered;

  const sortedPlans = sortByLesson
    ? [...searchFiltered].sort((a, b) => {
        const na = a.lessonNumber ? Number(a.lessonNumber) : Infinity;
        const nb = b.lessonNumber ? Number(b.lessonNumber) : Infinity;
        return na - nb;
      })
    : searchFiltered;

  // Group plans by subject for organised display
  const groupedBySubject = sortByLesson
    ? null // when sorted by lesson number, show flat list
    : sortedPlans.reduce((acc: Record<string, any[]>, p: any) => {
        const key = p.subject || "—";
        if (!acc[key]) acc[key] = [];
        acc[key].push(p);
        return acc;
      }, {});

  const renderPlanCard = (p: any) => (
    <div key={p.id} className="group relative">
      {batchSelectMode && (
        <Checkbox
          checked={selectedPlanIds.has(p.id)}
          onCheckedChange={() => toggleSelect(p.id)}
          className="absolute left-2.5 top-1/2 -translate-y-1/2 z-10"
        />
      )}
      <button
        onClick={() => batchSelectMode ? toggleSelect(p.id) : onLoad(p)}
        className={[
          "w-full text-left rounded-xl border transition-all duration-150",
          "hover:border-primary/40 hover:shadow-sm hover:bg-accent/60",
          batchSelectMode ? "pl-9 pr-3 py-2.5" : "px-3 py-2.5",
          selectedId === p.id && !batchSelectMode
            ? "bg-primary/8 border-primary/30 shadow-sm ring-1 ring-primary/20"
            : "bg-card border-border",
          batchSelectMode && selectedPlanIds.has(p.id) ? "bg-accent/50 border-primary/30" : "",
        ].join(" ")}
      >
        {/* Title row */}
        <div className="flex items-start gap-2 min-w-0">
          {p.lessonNumber && (
            <span className="shrink-0 mt-0.5 inline-flex items-center justify-center rounded-md bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300 text-[10px] font-bold px-1.5 py-0.5 leading-none min-w-[22px]">
              L{p.lessonNumber}
            </span>
          )}
          <span className={`flex-1 text-sm font-medium leading-snug ${selectedId === p.id && !batchSelectMode ? "text-primary" : "text-foreground"} line-clamp-2`}>
            {p.title || t("lp_untitled")}
          </span>
        </div>
        {/* Meta row */}
        <div className="mt-1 flex items-center gap-1.5 flex-wrap">
          {p.yearGroup && (
            <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground bg-muted/70 rounded px-1.5 py-0.5">
              <GraduationCap className="w-2.5 h-2.5" />{p.yearGroup}
            </span>
          )}
          {p.sessionTime && (
            <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground bg-muted/70 rounded px-1.5 py-0.5">
              <Clock className="w-2.5 h-2.5" />{p.sessionTime}
            </span>
          )}
          {p.duration && p.duration !== 60 && (
            <span className="inline-flex items-center text-[10px] font-mono text-muted-foreground bg-muted/70 rounded px-1.5 py-0.5">
              {p.duration}m
            </span>
          )}
          {p.calendarEventId && p.calendarId && (
            <span className="inline-flex items-center gap-0.5 text-[10px] text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/30 rounded px-1.5 py-0.5">
              <CalendarDays className="w-2.5 h-2.5" />
            </span>
          )}
        </div>
      </button>
      {/* Action buttons — always visible */}
      {!batchSelectMode && (
        <div className="absolute right-2 top-2 flex items-center gap-0.5 bg-background/90 backdrop-blur-sm rounded-md shadow-sm border border-border/50 p-0.5">
          {p.calendarEventId && p.calendarId && (
            <button
              onClick={(e) => { e.stopPropagation(); onJumpToCalendar(p.calendarEventId, p.calendarId); }}
              title={t("lp_jump_to_event")}
              className="p-1 rounded hover:bg-teal-50 hover:text-teal-700 dark:hover:bg-teal-900/30"
            >
              <CalendarDays className="w-3 h-3 text-teal-600" />
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onDuplicate(p); }}
            title={t("planner_duplicate")}
            className="p-1 rounded hover:bg-muted"
          >
            <Copy className="w-3 h-3 text-muted-foreground" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(p.id); }}
            title={t("lp_delete_plan")}
            className="p-1 rounded hover:bg-destructive/10"
          >
            <Trash2 className="w-3 h-3 text-destructive" />
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-background">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="px-3 pt-3 pb-2 border-b shrink-0 space-y-2">
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <BookOpen className="w-4 h-4 text-primary shrink-0" />
            <span className="font-semibold text-sm truncate">{t("lp_lesson_plans")}</span>
            {plans.length > 0 && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">{plans.length}</Badge>
            )}
          </div>
          <div className="flex items-center gap-0.5 shrink-0">
            {/* Sort toggle */}
            <button
              onClick={() => setSortByLesson(v => { const next = !v; try { localStorage.setItem("seba_planner_sort_by_lesson", next ? "1" : "0"); } catch {} return next; })}
              title={sortByLesson ? t("lp_sorted_by_lesson") : t("lp_sort_by_lesson")}
              className={`p-1.5 rounded-md hover:bg-accent transition-colors ${sortByLesson ? "text-teal-600 bg-teal-50 dark:bg-teal-900/30" : "text-muted-foreground"}`}
            >
              {sortByLesson ? <ArrowUp01 className="w-3.5 h-3.5" /> : <ArrowUpDown className="w-3.5 h-3.5" />}
            </button>
            {batchSelectMode ? (
              <>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => { setBatchSelectMode(false); setSelectedPlanIds(new Set()); }}>
                  <X className="w-3.5 h-3.5" />
                </Button>
                {selectedPlanIds.size > 0 && (
                  <>
                    <Button size="sm" variant="outline" className="h-7 px-2 text-[10px] gap-1 bg-orange-50 border-orange-300 text-orange-700 hover:bg-orange-100 dark:bg-orange-900/20 dark:border-orange-700 dark:text-orange-300" onClick={onBatchCopy} title={t("lp_bulk_copy")}>
                      <Copy className="w-3 h-3" />{selectedPlanIds.size}
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 px-2 text-[10px] gap-1 bg-blue-50 border-blue-300 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/20 dark:border-blue-700 dark:text-blue-300" onClick={onBatchExportPdf} disabled={batchExportPdfLoading} title={t("lp_bulk_export_pdf")}>
                      {batchExportPdfLoading ? <span className="w-3 h-3 border border-blue-500 border-t-transparent rounded-full animate-spin" /> : <FileDown className="w-3 h-3" />}{selectedPlanIds.size}
                    </Button>
                    <Button size="sm" variant="destructive" className="h-7 px-2 text-[10px] gap-1" onClick={onBatchDelete}>
                      <Trash2 className="w-3 h-3" />{selectedPlanIds.size}
                    </Button>
                  </>
                )}
              </>
            ) : (
              <>
                <button
                  title={t("lp_select_multiple")}
                  onClick={() => setBatchSelectMode(true)}
                  className="p-1.5 rounded-md hover:bg-accent text-muted-foreground transition-colors"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                </button>
                <Button size="sm" variant="default" className="h-7 px-2 gap-1 text-xs" onClick={onNew}>
                  <Plus className="w-3.5 h-3.5" />
                  {t("lp_new_plan")}
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Search bar */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={t("lp_plans_search_placeholder")}
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-input bg-muted/40 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring focus:bg-background transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Calendar filter */}
        {calendars.length > 0 && (
          <select
            value={calendarFilter}
            onChange={e => setCalendarFilter(e.target.value)}
            className="w-full text-xs rounded-lg border border-input bg-muted/40 px-2.5 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
            title={t("lp_filter_by_calendar")}
          >
            <option value="all">{t("lp_all_calendars")}</option>
            {calendars.map((c: any) => (
              <option key={c.id} value={String(c.id)}>{c.name}</option>
            ))}
            <option value="unlinked">{t("lp_unlinked_plans")}</option>
          </select>
        )}

        {/* Batch select-all bar */}
        {batchSelectMode && plans.length > 0 && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Checkbox checked={allSelected} onCheckedChange={toggleAll} id="select-all-plans" />
            <label htmlFor="select-all-plans" className="cursor-pointer">{t("lp_select_all")}</label>
            <span className="ml-auto text-[10px]">{selectedPlanIds.size} / {plans.length}</span>
          </div>
        )}
      </div>

      {/* ── Plan list ──────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {sortedPlans.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
            <BookOpen className="w-8 h-8 text-muted-foreground/40" />
            <p className="text-xs text-muted-foreground">{searchQuery ? "No plans match your search." : t("lp_no_plans")}</p>
          </div>
        )}

        {sortByLesson || searchQuery ? (
          // Flat list when sorted by lesson number or searching
          <div className="space-y-1.5">
            {sortedPlans.map(renderPlanCard)}
          </div>
        ) : (
          // Grouped by subject
          <div className="space-y-3">
            {Object.entries(groupedBySubject || {}).map(([subject, subjectPlans]) => (
              <div key={subject}>
                <div className="flex items-center gap-1.5 px-1 mb-1">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider truncate">{subject}</span>
                  <span className="text-[10px] text-muted-foreground/60 shrink-0">({(subjectPlans as any[]).length})</span>
                  <div className="flex-1 h-px bg-border/60" />
                </div>
                <div className="space-y-1.5">
                  {(subjectPlans as any[]).map(renderPlanCard)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Footer actions ─────────────────────────────────────────────── */}
      <div className="p-2.5 border-t shrink-0 space-y-1.5 bg-muted/20">
        <Button
          size="sm"
          variant="outline"
          className="w-full gap-1.5 text-teal-700 border-teal-300 hover:bg-teal-50 dark:text-teal-400 dark:border-teal-700 dark:hover:bg-teal-900/30 text-xs"
          onClick={onBatchFillAll}
          disabled={batchFillAllLoading || plans.length === 0}
          title={t("lp_batch_fill_all")}
        >
          {batchFillAllLoading ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span className="truncate">
                {batchFillAllProgress
                  ? t("lp_batch_fill_progress")
                      .replace("{{current}}", String(batchFillAllProgress.current))
                      .replace("{{total}}", String(batchFillAllProgress.total))
                  : t("lp_batch_fill_all")}
              </span>
            </>
          ) : (
            <><SebaSymbol className="w-3.5 h-3.5" /> {t("lp_batch_fill_all")}</>
          )}
        </Button>
        <Button size="sm" className="w-full gap-1.5 text-xs" onClick={onAi}>
          <SebaSymbol className="w-3.5 h-3.5" /> {t("lp_generate_ai")}
        </Button>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function LessonPlanner() {
  const { t } = useI18n();
  useDocumentTitle("Planificador de Lliçons LOMLOE");

  const isMobile = useIsMobile();
  const [, navigate] = useLocation();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [form, setForm] = useState<LessonFormState>(() => {
    // Pre-fill from calendar deep-link query params
    const params = new URLSearchParams(window.location.search);
    const title = params.get("title");
    if (!title) return emptyForm();
    const base = emptyForm();
    return {
      ...base,
      title,
      yearGroup: params.get("yearGroup") ?? base.yearGroup,
      subject: params.get("subject") ?? base.subject,
      competencies: params.get("competency") ? [params.get("competency")!] : base.competencies,
    };
  });
  const [showAiDialog, setShowAiDialog] = useState(false);
  const [showPrintDialog, setShowPrintDialog] = useState(false);
  const [showSaveTemplateDialog, setShowSaveTemplateDialog] = useState(false);
  const [showLoadTemplateDialog, setShowLoadTemplateDialog] = useState(false);
  const [templateNameInput, setTemplateNameInput] = useState("");
  const [printFormat, setPrintFormat] = useState<"a4" | "a5" | "letter">("a4");
  const [isDirty, setIsDirty] = useState(false);
  const [selectedPlanIds, setSelectedPlanIds] = useState<Set<number>>(new Set());
  const [batchSelectMode, setBatchSelectMode] = useState(false);
  const [showBatchDeleteConfirm, setShowBatchDeleteConfirm] = useState(false);
  const [showIndividualDeleteConfirm, setShowIndividualDeleteConfirm] = useState<number | null>(null);
  const [batchFillAllRunning, setBatchFillAllRunning] = useState(false);
  const [batchFillAllProgress, setBatchFillAllProgress] = useState<{ current: number; total: number; planTitle?: string } | null>(null);
  // Link to Calendar dialog state
  const [showLinkCalDialog, setShowLinkCalDialog] = useState(false);
  const [linkCalendarId, setLinkCalendarId] = useState<string>("");
  const [linkLessonDate, setLinkLessonDate] = useState<string>("");
  const [linkCalendarTime, setLinkCalendarTime] = useState<{ start: string; end: string } | null>(null);
  const [showClashDialog, setShowClashDialog] = useState(false);
  const [clashDetails, setClashDetails] = useState<{ clashWith: string[]; start: string; end: string } | null>(null);
  // Bulk AI generate dialog state
  const [showBulkAiDialog, setShowBulkAiDialog] = useState(false);
  const [bulkAiScope, setBulkAiScope] = useState<"year" | "semester1" | "semester2" | "semester3">("year");
  const [bulkAiCalendarId, setBulkAiCalendarId] = useState<string>("");
  const [bulkAiMethodology, setBulkAiMethodology] = useState<string>("");
  const [bulkAiRunning, setBulkAiRunning] = useState(false);
  const [bulkAiProgress, setBulkAiProgress] = useState<{ current: number; total: number } | null>(null);
  const utils = trpc.useUtils();

  // Show a toast when arriving from the calendar
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("title")) {
      toast.success(t("lp_prefilled_toast"));
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const { data: plans = [] } = trpc.planner.listLessonPlans.useQuery();
  const { data: calendars = [] } = trpc.planner.listCalendars.useQuery();

  // Deep-link: open a specific plan when ?planId=N is in the URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const planIdParam = params.get("planId");
    if (!planIdParam) return;
    const targetId = parseInt(planIdParam, 10);
    if (isNaN(targetId)) return;
    const target = (plans as any[]).find((p: any) => p.id === targetId);
    if (target) {
      loadPlan(target);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [plans]);

  // Calendar event + linked plan creation (used after AI generation when a date is selected)
  const createEventMutation = trpc.planner.createCalendarEvent.useMutation();
  const createLinkedPlanMutation = trpc.planner.createLinkedLessonPlan.useMutation();

  const saveMutation = trpc.planner.saveLessonPlan.useMutation({
    onSuccess: (data) => {
      utils.planner.listLessonPlans.invalidate();
      setSelectedId(data.id);
      setIsDirty(false);
      toast.success(t("lp_saved_toast"));
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.planner.deleteLessonPlan.useMutation({
    onSuccess: () => {
      utils.planner.listLessonPlans.invalidate();
      setSelectedId(null);
      setForm(emptyForm());
      setShowIndividualDeleteConfirm(null);
      toast.success(t("lp_deleted_toast"));
    },
    onError: (e) => toast.error(e.message),
  });

  const batchDeleteMutation = trpc.planner.batchDeleteLessonPlans.useMutation({
    onSuccess: (data) => {
      utils.planner.listLessonPlans.invalidate();
      if (selectedPlanIds.has(selectedId ?? -1)) {
        setSelectedId(null);
        setForm(emptyForm());
      }
      setSelectedPlanIds(new Set());
      setBatchSelectMode(false);
      setShowBatchDeleteConfirm(false);
      toast.success(`${data.deleted} ${t("lp_deleted_toast")}`);
    },
    onError: (e) => toast.error(e.message),
  });

  // ── Renumber plans ─────────────────────────────────────────────────────
  const renumberPlansMutation = trpc.planner.renumberPlans.useMutation({
    onSuccess: (data) => {
      utils.planner.listLessonPlans.invalidate();
      toast.success(`${t("lp_renumber_success")} (${data.updated})`);
    },
    onError: (e) => toast.error(e.message),
  });

  const handleRenumberPlans = () => {
    // Find the calendarId for the currently selected plan
    const currentPlan = (plans as any[]).find((p: any) => p.id === selectedId);
    const calId = currentPlan?.calendarId;
    if (!calId) { toast.error(t("lp_renumber_no_calendar")); return; }
    renumberPlansMutation.mutate({ calendarId: calId });
  };

  // ── Bulk copy plans ─────────────────────────────────────────────────────
  const [showBulkCopyDialog, setShowBulkCopyDialog] = useState(false);
  const [bulkCopyTargetCalendarId, setBulkCopyTargetCalendarId] = useState<string>("");
  const [bulkCopyAutoRenumber, setBulkCopyAutoRenumber] = useState(true);

  const bulkCopyMutation = trpc.planner.bulkCopyLessonPlans.useMutation({
    onSuccess: (data) => {
      utils.planner.listLessonPlans.invalidate();
      setShowBulkCopyDialog(false);
      setBatchSelectMode(false);
      setSelectedPlanIds(new Set());
      if (data.failed > 0) {
        toast.warning(`${data.copied} ${t("lp_bulk_copy_success")}, ${data.failed} ${t("lp_failed_count")}`);
      } else {
        toast.success(`${data.copied} ${t("lp_bulk_copy_success")}`);
      }
    },
    onError: (e) => toast.error(e.message),
  });

  const handleBulkCopy = () => {
    const ids = Array.from(selectedPlanIds);
    if (ids.length === 0) return;
    bulkCopyMutation.mutate({
      planIds: ids,
      targetCalendarId: bulkCopyTargetCalendarId && bulkCopyTargetCalendarId !== "same" ? Number(bulkCopyTargetCalendarId) : undefined,
      autoRenumber: bulkCopyAutoRenumber,
    });
  };

  // ── Bulk export plans as PDF ────────────────────────────────────────────
  const bulkExportPdfMutation = trpc.planner.bulkExportLessonPlansPdf.useMutation({
    onSuccess: (data) => {
      // Trigger browser download via a temporary anchor
      const a = document.createElement("a");
      a.href = data.url;
      a.download = `lesson-plans-export-${Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success(`${t("lp_bulk_export_pdf_success")} (${data.count})`);
    },
    onError: (e) => toast.error(e.message),
  });

  const handleBulkExportPdf = () => {
    const ids = Array.from(selectedPlanIds);
    if (ids.length === 0) return;
    bulkExportPdfMutation.mutate({ planIds: ids });
  };

  // ── Batch fill all empty sections across all visible plans ─────────────────────
  const handleBatchFillAll = async () => {
    if (batchFillAllRunning) return;
    const allPlans = plans as any[];
    if (allPlans.length === 0) return;
    setBatchFillAllRunning(true);
    const isBlankArray = (v: string[]) => !v || v.every((s: string) => !s.trim());
    const isBlankStr = (v: string) => !v || !v.trim();
    const isBlankProcs = (v: any[]) => !v || v.every((p: any) => !p.activities?.trim());
    const isAllFalse = (v: Record<string, boolean>) => !v || !Object.values(v).some(Boolean);
    let filledCount = 0;
    for (let pi = 0; pi < allPlans.length; pi++) {
      const plan = allPlans[pi];
      const pf = planToForm(plan);
      const sectionsToFill: string[] = [];
      if (isAllFalse(pf.skills)) sectionsToFill.push("skills");
      if (isAllFalse(pf.systems)) sectionsToFill.push("systems");
      if (isBlankArray(pf.specificCompetences)) sectionsToFill.push("specificCompetences");
      if (isBlankArray(pf.saberesBasicos)) sectionsToFill.push("saberesBasicos");
      if (isBlankArray(pf.learningOutcomes)) sectionsToFill.push("learningOutcomes");
      if (isBlankArray(pf.evaluationCriteria)) sectionsToFill.push("evaluationCriteria");
      if (isBlankStr(pf.previousKnowledge)) sectionsToFill.push("previousKnowledge");
      if (isBlankStr(pf.materials)) sectionsToFill.push("materials");
      if (isBlankProcs(pf.procedures)) sectionsToFill.push("procedures");
      if (sectionsToFill.length === 0) continue;
      setBatchFillAllProgress({ current: pi + 1, total: allPlans.length, planTitle: plan.title });
      let currentForm = { ...pf };
      for (const section of sectionsToFill) {
        try {
          const data = await utils.client.planner.aiRegenerateSection.mutate({
            planId: plan.id,
            section: section as any,
            title: currentForm.title,
            subject: currentForm.subject,
            yearGroup: currentForm.yearGroup,
            duration: currentForm.duration,
            unit: currentForm.unit || undefined,
            competencies: currentForm.competencies,
          });
          const parsed = (() => { try { return JSON.parse(data.value); } catch { return data.value; } })();
          currentForm = { ...currentForm, [data.section]: parsed };
        } catch (e: any) {
          toast.error(`${plan.title ?? t("lp_untitled")}: ${e.message}`);
        }
      }
      try {
        await utils.client.planner.saveLessonPlan.mutate({ id: plan.id, ...formToSave(currentForm) });
        filledCount++;
        // If this is the currently open plan, refresh the form
        if (plan.id === selectedId) {
          setForm({ ...currentForm });
          setIsDirty(false);
        }
      } catch (e: any) {
        toast.error(`${t("lp_autosave_failed")}: ${e.message}`);
      }
    }
    await utils.planner.listLessonPlans.invalidate();
    setBatchFillAllRunning(false);
    setBatchFillAllProgress(null);
    toast.success(t("lp_batch_fill_done").replace("{{count}}", String(filledCount)));
  };

  // ── Copy plan to another calendar ──────────────────────────────────────────────
  const [showCopyPlanDialog, setShowCopyPlanDialog] = useState(false);
  const [copySourcePlan, setCopySourcePlan] = useState<any>(null);
  const [copyTargetCalendarId, setCopyTargetCalendarId] = useState<string>("");
  const [copyTargetEventId, setCopyTargetEventId] = useState<string>("");
  const [copyAutoRenumber, setCopyAutoRenumber] = useState(true);
  const [copyReplaceExisting, setCopyReplaceExisting] = useState(false);
  // Fetch events for the selected target calendar (for the event picker)
  const lpCalIdForPicker = copyTargetCalendarId && copyTargetCalendarId !== "same" ? Number(copyTargetCalendarId) : null;
  const { data: lpCopyTargetEvents = [] } = trpc.planner.listCalendarEvents.useQuery(
    { calendarId: lpCalIdForPicker! },
    { enabled: lpCalIdForPicker !== null && showCopyPlanDialog },
  );
  const lpLessonEventsForPicker = (lpCopyTargetEvents as any[]).filter(
    (e: any) => e.eventType === "lesson" || e.eventType === "ai_generated"
  );

  const restorePlanMutation = trpc.planner.restoreDeletedPlan.useMutation({
    onSuccess: () => {
      utils.planner.listLessonPlans.invalidate();
      toast.success(t("lp_copy_undo_success"));
    },
    onError: (e) => toast.error(e.message),
  });

  const copyPlanMutation = trpc.planner.copyLessonPlan.useMutation({
    onSuccess: (data) => {
      utils.planner.listLessonPlans.invalidate();
      setSelectedId(data.id);
      setShowCopyPlanDialog(false);
      if (data.replacedPlan) {
        // Show Undo toast when a plan was replaced
        const snapshot = data.replacedPlan;
        toast.success(t("lp_copy_success"), {
          description: t("lp_copy_undo_desc") ?? "The previous plan was deleted.",
          duration: 10000,
          action: {
            label: t("lp_copy_undo") ?? "Undo",
            onClick: () => restorePlanMutation.mutate({ snapshot }),
          },
        });
      } else {
        toast.success(t("lp_copy_success"), {
          description: data.lessonNumber ? `${t("lp_lesson_number_label")} ${data.lessonNumber}` : undefined,
          duration: 6000,
        });
      }
    },
    onError: (e) => toast.error(e.message),
  });

  const handleDuplicate = (plan: any) => {
    // Open the copy dialog pre-filled with the source plan
    const calId = plan.calendarId ? String(plan.calendarId) : "";
    setCopySourcePlan(plan);
    setCopyTargetCalendarId(calId);
    setCopyTargetEventId("");
    setCopyAutoRenumber(true);
    setCopyReplaceExisting(false);
    setShowCopyPlanDialog(true);
  };

  const handleCopyPlan = () => {
    if (!copySourcePlan) return;
    const targetCalId = copyTargetCalendarId && copyTargetCalendarId !== "same" ? Number(copyTargetCalendarId) : undefined;
    const targetEvId = copyTargetEventId && copyTargetEventId !== "none" ? Number(copyTargetEventId) : undefined;
    copyPlanMutation.mutate({
      planId: copySourcePlan.id,
      targetCalendarId: targetCalId,
      targetEventId: targetEvId,
      autoRenumber: copyAutoRenumber,
      replaceExisting: copyReplaceExisting,
    });
  };

  // ── Templates ────────────────────────────────────────────────────────────
  const { data: templates = [] } = trpc.planner.listTemplates.useQuery();

  const saveTemplateMutation = trpc.planner.saveAsTemplate.useMutation({
    onSuccess: () => {
      utils.planner.listTemplates.invalidate();
      setShowSaveTemplateDialog(false);
      setTemplateNameInput("");
      toast.success(t("lp_template_saved"));
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteTemplateMutation = trpc.planner.deleteTemplate.useMutation({
    onSuccess: () => { utils.planner.listTemplates.invalidate(); toast.success(t("lp_template_deleted")); },
    onError: (e) => toast.error(e.message),
  });

  const loadTemplate = (tmpl: any) => {
    setSelectedId(null);
    setForm(planToForm(tmpl));
    setIsDirty(true);
    setShowLoadTemplateDialog(false);
    toast.success(t("lp_template_loaded"));
  };

  const aiMutation = trpc.planner.aiGenerateLessonPlan.useMutation({
    onSuccess: async (data) => {
      utils.planner.listLessonPlans.invalidate();
      setSelectedId(data.id);
      // Immediately populate the form from the mutation response (avoids stale cache)
      // The raw AI data has the same shape as a plan row for these fields
      setForm(planToForm(data));
      setIsDirty(false);
      // Only re-fetch from DB for existing plans (where input.id was provided).
      // For new plans the mutation response already contains all generated fields;
      // re-fetching races with the DB insert and can reset the form to defaults.
      await utils.planner.getLessonPlan.invalidate({ id: data.id });
      setShowAiDialog(false);

      // If the user selected a date + calendar, create a calendar event and link this plan to it
      if (aiDate && aiCalendarId) {
        try {
          const calId = parseInt(aiCalendarId, 10);
          const cal = (calendars as any[]).find(c => c.id === calId);
          const eventResult = await createEventMutation.mutateAsync({
            calendarId: calId,
            academicYear: cal?.academicYear ?? ACADEMIC_YEARS[1],
            eventDate: aiDate,
            eventType: "lesson",
            title: aiTitle,
            subject: aiSubject,
            yearGroup: aiYearGroup,
          });
          // Link the newly generated plan to the calendar event
          await createLinkedPlanMutation.mutateAsync({
            calendarEventId: eventResult.id,
            title: aiTitle,
            subject: aiSubject,
            yearGroup: aiYearGroup,
            academicYear: cal?.academicYear ?? ACADEMIC_YEARS[1],
          });
          // Update the plan row to point to this calendar event
          await saveMutation.mutateAsync({
            id: data.id,
            title: aiTitle,
            subject: aiSubject,
            yearGroup: aiYearGroup,
            duration: aiDuration,
            unit: aiUnit || undefined,
            sessionTime: aiSessionTime || undefined,
            calendarEventId: eventResult.id,
            academicYear: cal?.academicYear ?? ACADEMIC_YEARS[1],
          });
          utils.planner.listLessonPlans.invalidate();
          toast.success(t("lp_generated_toast") + " " + t("lp_add_to_calendar"));
        } catch (err: any) {
          // Non-fatal: plan was generated, calendar link failed
              toast.warning(t("lp_generated_toast") + " (" + t("lp_calendar_link_failed") + ")");
        }
      } else {
        const snap = preAiSnapshotRef.current;
        if (snap) {
          toast.success(t("lp_generated_toast"), {
            action: { label: t("cal_undo"), onClick: () => { setForm(snap); setIsDirty(true); preAiSnapshotRef.current = null; } },
            duration: 8000,
          });
        } else {
          toast.success(t("lp_generated_toast"));
        }
      }
      // Show the "AI generated — all fields are editable" banner
      setAiGeneratedBanner(true);
      setTimeout(() => setAiGeneratedBanner(false), 6000);
    },
    onError: (e) => toast.error(e.message),
  });

  const preAiSnapshotRef = useRef<LessonFormState | null>(null);

  const [regeneratingSection, setRegeneratingSection] = useState<string | null>(null);
  const [fillAllProgress, setFillAllProgress] = useState<{ current: number; total: number } | null>(null);
  const aiRegenSectionMutation = trpc.planner.aiRegenerateSection.useMutation({
    onSuccess: (data) => {
      const field = data.section as keyof LessonFormState;
      const parsed = (() => { try { return JSON.parse(data.value); } catch { return data.value; } })();
      setForm(f => {
        const snapshot = { ...f };
        preAiSnapshotRef.current = snapshot;
        return { ...f, [field]: parsed };
      });
      setIsDirty(true);
      setRegeneratingSection(null);
      toast.success(t("lp_section_regenerated"), {
        action: {
          label: t("cal_undo"),
            onClick: () => {
              if (preAiSnapshotRef.current) {
                setForm(preAiSnapshotRef.current);
                setIsDirty(true);
                preAiSnapshotRef.current = null;
              }
            },
        },
        duration: 8000,
      });
    },
    onError: (e) => { setRegeneratingSection(null); toast.error(e.message); },
  });

  const handleRegenSection = (section: string) => {
    if (!selectedId) return;
    setRegeneratingSection(section);
    aiRegenSectionMutation.mutate({
      planId: selectedId,
      section: section as any,
      title: form.title,
      subject: form.subject,
      yearGroup: form.yearGroup,
      duration: form.duration,
      unit: form.unit || undefined,
      competencies: form.competencies,
    });
  };

  const handleFillAllEmpty = async () => {
    if (!selectedId) return;
    // Determine which sections are blank
    const isBlankArray = (v: string[]) => !v || v.every(s => !s.trim());
    const isBlankStr = (v: string) => !v || !v.trim();
    const isBlankProcs = (v: any[]) => !v || v.every(p => !p.activities?.trim());
    const isAllFalse = (v: Record<string, boolean>) => !v || !Object.values(v).some(Boolean);
    const sectionsToFill: string[] = [];
    if (isAllFalse(form.skills)) sectionsToFill.push("skills");
    if (isAllFalse(form.systems)) sectionsToFill.push("systems");
    if (isBlankArray(form.specificCompetences)) sectionsToFill.push("specificCompetences");
    if (isBlankArray(form.saberesBasicos)) sectionsToFill.push("saberesBasicos");
    if (isBlankArray(form.learningOutcomes)) sectionsToFill.push("learningOutcomes");
    if (isBlankArray(form.evaluationCriteria)) sectionsToFill.push("evaluationCriteria");
    if (isBlankStr(form.previousKnowledge)) sectionsToFill.push("previousKnowledge");
    if (isBlankStr(form.materials)) sectionsToFill.push("materials");
    if (isBlankProcs(form.procedures)) sectionsToFill.push("procedures");
    if (sectionsToFill.length === 0) { toast.info(t("lp_all_sections_filled")); return; }
    // Snapshot for undo
    preAiSnapshotRef.current = { ...form };
    const total = sectionsToFill.length;
    let currentForm = { ...form };
    for (let i = 0; i < sectionsToFill.length; i++) {
      const section = sectionsToFill[i];
      setFillAllProgress({ current: i + 1, total });
      setRegeneratingSection(section);
      try {
        const data = await utils.client.planner.aiRegenerateSection.mutate({
          planId: selectedId,
          section: section as any,
          title: currentForm.title,
          subject: currentForm.subject,
          yearGroup: currentForm.yearGroup,
          duration: currentForm.duration,
          unit: currentForm.unit || undefined,
          competencies: currentForm.competencies,
        });
        const parsed = (() => { try { return JSON.parse(data.value); } catch { return data.value; } })();
        currentForm = { ...currentForm, [data.section]: parsed };
        setForm({ ...currentForm });
        setIsDirty(true);
      } catch (e: any) {
        toast.error(`${t("lp_fill_failed").replace("{{section}}", section)}: ${e.message}`);
      }
    }
    setRegeneratingSection(null);
    setFillAllProgress(null);
    // Auto-save the plan with the filled content
    if (selectedId) {
      try {
        await utils.client.planner.saveLessonPlan.mutate({ id: selectedId, ...formToSave(currentForm) });
        utils.planner.listLessonPlans.invalidate();
        setIsDirty(false);
      } catch (e: any) {
        toast.error(`${t("lp_autosave_failed")}: ${e.message}`);
      }
    }
    toast.success(t("lp_all_sections_filled"), {
      action: {
          label: t("cal_undo"),
        onClick: () => {
          if (preAiSnapshotRef.current) {
            setForm(preAiSnapshotRef.current);
            setIsDirty(true);
            preAiSnapshotRef.current = null;
          }
        },
      },
      duration: 10000,
    });
  };

  const setField = <K extends keyof LessonFormState>(key: K, value: LessonFormState[K]) => {
    setForm(f => {
      const next = { ...f, [key]: value };
      // Auto-compute duration when sessionTime changes (format: HH:MM–HH:MM or HH:MM-HH:MM)
      if (key === "sessionTime" && typeof value === "string") {
        const match = value.match(/(\d{1,2}:\d{2})\s*[–\-]\s*(\d{1,2}:\d{2})/);
        if (match) {
          const toMins = (s: string) => { const [h, m] = s.split(":").map(Number); return h * 60 + m; };
          const diff = toMins(match[2]) - toMins(match[1]);
          if (diff > 0) next.duration = diff;
        }
      }
      return next;
    });
    setIsDirty(true);
  };

  const loadPlan = (plan: any) => {
    setSelectedId(plan.id);
    setForm(planToForm(plan));
    setIsDirty(false);
    setSheetOpen(false); // close sheet on mobile after selecting
  };

  const newPlan = () => {
    setSelectedId(null);
    // Auto-fill lesson number as max existing + 1
    const maxLesson = (plans as any[]).reduce((max: number, p: any) => {
      const n = p.lessonNumber ? Number(p.lessonNumber) : 0;
      return isNaN(n) ? max : Math.max(max, n);
    }, 0);
    const nextLesson = maxLesson + 1;
    setForm({ ...emptyForm(), lessonNumber: String(nextLesson) });
    setIsDirty(false);
    setSheetOpen(false);
  };

   const handleSave = () => {
    if (!form.title.trim()) { toast.error(t("lp_title_required")); return; }
    saveMutation.mutate({ id: selectedId ?? undefined, ...formToSave(form) });
  };

  // ── Bulk Save ────────────────────────────────────────────────────────────────
  const [bulkSaveRunning, setBulkSaveRunning] = useState(false);
  const handleBulkSave = async () => {
    if (bulkSaveRunning) return;
    const allPlans = plans as any[];
    if (allPlans.length === 0) { toast.info(t("lp_bulk_save_none")); return; }
    setBulkSaveRunning(true);
    let savedCount = 0;
    for (const plan of allPlans) {
      if (!plan.title?.trim()) continue;
      try {
        await utils.client.planner.saveLessonPlan.mutate({
          id: plan.id,
          title: plan.title,
          unit: plan.unit ?? undefined,
          lessonNumber: plan.lessonNumber ?? undefined,
          academicYear: plan.academicYear ?? undefined,
          duration: plan.duration ?? undefined,
          yearGroup: plan.yearGroup ?? undefined,
          subject: plan.subject ?? undefined,
          skills: plan.skills ?? undefined,
          systems: plan.systems ?? undefined,
          specificCompetences: plan.specificCompetences ?? undefined,
          saberesBasicos: plan.saberesBasicos ?? undefined,
          learningOutcomes: plan.learningOutcomes ?? undefined,
          evaluationCriteria: plan.evaluationCriteria ?? undefined,
          previousKnowledge: plan.previousKnowledge ?? undefined,
          materials: plan.materials ?? undefined,
          spaces: plan.spaces ?? undefined,
          procedures: plan.procedures ?? undefined,
          competencies: plan.competencies ?? undefined,
          differentiation: plan.differentiation ?? undefined,
          sessionTime: plan.sessionTime ?? undefined,
          infantilEix: plan.infantilEix ?? undefined,
          infantilCycle: plan.infantilCycle ?? undefined,
        });
        savedCount++;
      } catch (e: any) {
        toast.error(`${plan.title ?? t("lp_untitled")}: ${e.message}`);
      }
    }
    // Also save the currently open (possibly dirty) plan
    if (selectedId && form.title.trim()) {
      try {
        await utils.client.planner.saveLessonPlan.mutate({ id: selectedId, ...formToSave(form) });
        setIsDirty(false);
      } catch (e: any) {
        toast.error(`${form.title}: ${e.message}`);
      }
    }
    await utils.planner.listLessonPlans.invalidate();
    setBulkSaveRunning(false);
    if (savedCount === 0 && !isDirty) {
      toast.info(t("lp_bulk_save_none"));
    } else {
      toast.success(t("lp_bulk_saved_toast").replace("{{count}}", String(savedCount)));
    }
  };

  const handlePrint = () => {
    const logo = localStorage.getItem("seba_school_logo") ?? undefined;
    const printLabels: Record<string,string> = {
      lp_print_title: t("lp_print_title"),
      lp_unit: t("lp_unit"),
      lp_lesson: t("lp_lesson"),
      lp_year_group: t("lp_year_group"),
      lp_subject: t("lp_subject"),
      lp_duration: t("lp_duration"),
      lp_skills: t("lp_skills"),
      lp_language_systems: t("lp_language_systems"),
      lp_spaces: t("lp_spaces"),
      lp_specific_competences: t("lp_specific_competences"),
      lp_saberes_basicos: t("lp_saberes_basicos"),
      lp_learning_outcomes: t("lp_learning_outcomes"),
      lp_evaluation_criteria: t("lp_evaluation_criteria"),
      lp_previous_knowledge: t("lp_previous_knowledge"),
      lp_materials: t("lp_materials"),
      lp_lesson_procedure: t("lp_lesson_procedure"),
      lp_timing: t("lp_print_timing"),
      lp_stage: t("lp_print_stage"),
      lp_activities: t("lp_print_activities"),
      lp_grouping: t("lp_print_grouping"),
      lp_generated_by: t("lp_generated_by"),
      school_logo: t("lp_school_logo"),
    };
    const html = buildPrintHtml(form, logo, printLabels);
    const win = window.open("", "_blank");
    if (!win) { toast.error(t("lp_popup_blocked")); return; }
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 600);
    setShowPrintDialog(false);
  };

  // AI dialog state
  const [aiTitle, setAiTitle] = useState("");
  const [aiSubject, setAiSubject] = useState(SUBJECTS[0]);
  const [aiYearGroup, setAiYearGroup] = useState(YEAR_GROUPS[3]);
  const [aiDuration, setAiDuration] = useState(60);
  const [aiComps, setAiComps] = useState<string[]>([]);
  const [aiDate, setAiDate] = useState(""); // YYYY-MM-DD
  const [aiSessionTime, setAiSessionTime] = useState(""); // e.g. 09:00-10:00
  const [aiUnit, setAiUnit] = useState("");
  const [aiCalendarId, setAiCalendarId] = useState<string>("");
  const [aiInfantilEix, setAiInfantilEix] = useState("");
  const [aiInfantilCycle, setAiInfantilCycle] = useState("");
  const [aiCurriculumYear, setAiCurriculumYear] = useState("");
  const [showExportAllDialog, setShowExportAllDialog] = useState(false);
  const [aiGeneratedBanner, setAiGeneratedBanner] = useState(false);
  const [lastGeneratedCalendarId, setLastGeneratedCalendarId] = useState<number | null>(null);
  const [aiPlanningScope, setAiPlanningScope] = useState<"single" | "semester1" | "semester2" | "semester3" | "year">("single");
  const [aiDialogCalendarId, setAiDialogCalendarId] = useState<string>("");
  const [aiScopeGenerating, setAiScopeGenerating] = useState(false);
  const [exportAllCalendarId, setExportAllCalendarId] = useState<string>("");
  const [isExportingAll, setIsExportingAll] = useState(false);

  const exportAllPlansMutation = trpc.planner.exportAllPlansPdf.useMutation({
    onSuccess: (data) => {
      setIsExportingAll(false);
      setShowExportAllDialog(false);
      window.open(data.url, "_blank");
      toast.success(`${t("lp_export_all_success")} (${data.count})`);
    },
    onError: (e) => { setIsExportingAll(false); toast.error(e.message); },
  });

  const generateBulkMutation = trpc.planner.generateBulkLessonPlans.useMutation();

  const toggleComp = (c: string) => setAiComps(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);

  const updateListItem = (key: "saberesBasicos" | "learningOutcomes" | "evaluationCriteria" | "specificCompetences", idx: number, val: string) => {
    const arr = [...(form[key] as string[])];
    arr[idx] = val;
    setField(key, arr);
  };
  const addListItem = (key: "saberesBasicos" | "learningOutcomes" | "evaluationCriteria" | "specificCompetences") => {
    setField(key, [...(form[key] as string[]), ""]);
  };
  const removeListItem = (key: "saberesBasicos" | "learningOutcomes" | "evaluationCriteria" | "specificCompetences", idx: number) => {
    setField(key, (form[key] as string[]).filter((_, i) => i !== idx));
  };

  const updateProcedure = (idx: number, field: keyof Procedure, val: string) => {
    const procs = [...form.procedures];
    procs[idx] = { ...procs[idx], [field]: val };
    setField("procedures", procs);
  };
  const addProcedure = () => setField("procedures", [...form.procedures, { timing: "", stage: "", activities: "", grouping: "Pairs" }]);
  const removeProcedure = (idx: number) => setField("procedures", form.procedures.filter((_, i) => i !== idx));

  const plansList = (
    <PlansList
      plans={plans as any[]}
      calendars={calendars as any[]}
      selectedId={selectedId}
      onLoad={loadPlan}
      onNew={newPlan}
      onAi={() => {
        setSheetOpen(false);
        // Pre-fill dialog from current form if a plan is loaded
        if (selectedId && form.title) {
          setAiTitle(form.title);
          setAiSubject(form.subject);
          setAiYearGroup(form.yearGroup);
          setAiDuration(form.duration || 60);
          setAiUnit(form.unit || "");
          setAiComps(form.competencies || []);
          setAiSessionTime(form.sessionTime || "");
        }
        setShowAiDialog(true);
      }}
      onDuplicate={handleDuplicate}
      onDelete={(id) => setShowIndividualDeleteConfirm(id)}
      onJumpToCalendar={(calendarEventId, calendarId) => navigate(`/calendar?eventId=${calendarEventId}&calendarId=${calendarId}`)}
      batchSelectMode={batchSelectMode}
      setBatchSelectMode={setBatchSelectMode}
      selectedPlanIds={selectedPlanIds}
      setSelectedPlanIds={setSelectedPlanIds}
      onBatchDelete={() => setShowBatchDeleteConfirm(true)}
      onBatchCopy={() => setShowBulkCopyDialog(true)}
      onBatchExportPdf={handleBulkExportPdf}
      batchExportPdfLoading={bulkExportPdfMutation.isPending}
      onBatchFillAll={handleBatchFillAll}
      batchFillAllLoading={batchFillAllRunning}
      batchFillAllProgress={batchFillAllProgress}
      t={t}
    />
  );

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <NavBar />
      {/* Main editor */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 sm:p-6 space-y-4 max-w-4xl mx-auto">

            {/* ── Row 1: Page header ─────────────────────────────────────────── */}
            <div className="flex items-center gap-3 flex-wrap">
              <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground shrink-0" onClick={() => navigate("/create")}>
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">{t("lp_back_to_menu")}</span>
              </Button>
              <div className="flex items-center gap-2 min-w-0">
                <BookOpen className="w-5 h-5 text-primary shrink-0" />
                <h1 className="text-base sm:text-lg font-bold truncate">{t("lp_title")}</h1>
                {form.infantilEix && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-pink-100 text-pink-700 border border-pink-200 dark:bg-pink-900/40 dark:text-pink-300 dark:border-pink-700 shrink-0">
                    🧒 {form.infantilEix}{form.infantilCycle ? ` · ${form.infantilCycle}` : ""}
                  </span>
                )}
              </div>
              {isDirty && <Badge variant="outline" className="text-xs text-amber-600 border-amber-300 shrink-0">{t("lp_unsaved")}</Badge>}
              {/* Plans sheet trigger */}
              <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                <SheetTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5 ml-auto shrink-0">
                    <List className="w-4 h-4" />
                    {t("lp_lesson_plans")}
                    {plans.length > 0 && (
                      <Badge variant="secondary" className="text-xs ml-0.5">{plans.length}</Badge>
                    )}
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-80 p-0 flex flex-col">
                  <SheetHeader className="sr-only">
                    <SheetTitle>{t("lp_lesson_plans")}</SheetTitle>
                  </SheetHeader>
                  <div className="flex-1 overflow-hidden">
                    {plansList}
                  </div>
                </SheetContent>
              </Sheet>
            </div>

            {/* ── Row 2: Action toolbar ──────────────────────────────────────── */}
            <div className="flex items-center gap-1.5 flex-wrap border border-border rounded-lg bg-muted/30 px-3 py-2">
              {/* Destructive */}
              {selectedId && (
                <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate({ id: selectedId })} className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 h-8 px-2" title={t("lp_delete_plan")}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
              {selectedId && <Separator orientation="vertical" className="h-5" />}

              {/* Renumber */}
              {selectedId && (
                <Button variant="ghost" size="sm" onClick={handleRenumberPlans} disabled={renumberPlansMutation.isPending} className="gap-1 text-violet-700 hover:bg-violet-50 dark:hover:bg-violet-950/30 h-8 px-2" title={t("lp_renumber_plans")}>
                  <Hash className="w-4 h-4" />
                  <span className="hidden md:inline text-xs">{t("lp_renumber_plans")}</span>
                </Button>
              )}

              {/* Fill empty */}
              {selectedId && (
                <Button variant="ghost" size="sm" onClick={handleFillAllEmpty} disabled={!!regeneratingSection} className="gap-1 text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-950/30 h-8 px-2" title={t("lp_fill_all_empty")}>
                  {fillAllProgress ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /><span className="hidden md:inline text-xs">{t("lp_filling_sections").replace("{{current}}", String(fillAllProgress.current)).replace("{{total}}", String(fillAllProgress.total))}</span></>
                  ) : (
                    <><SebaSymbol className="w-4 h-4" /><span className="hidden md:inline text-xs">{t("lp_fill_all_empty")}</span></>
                  )}
                </Button>
              )}

              <Separator orientation="vertical" className="h-5" />

              {/* Templates */}
              <Button variant="ghost" size="sm" onClick={() => setShowLoadTemplateDialog(true)} className="gap-1 h-8 px-2" title={t("lp_load_template")}>
                <FolderOpen className="w-4 h-4" />
                <span className="hidden md:inline text-xs">{t("lp_load_template")}</span>
              </Button>
              {selectedId && (
                <Button variant="ghost" size="sm" onClick={() => { setTemplateNameInput(form.title || ""); setShowSaveTemplateDialog(true); }} className="gap-1 h-8 px-2" title={t("lp_save_as_template")}>
                  <LayoutTemplate className="w-4 h-4" />
                  <span className="hidden md:inline text-xs">{t("lp_save_as_template")}</span>
                </Button>
              )}

              <Separator orientation="vertical" className="h-5" />

              {/* Print / Export */}
              <Button variant="ghost" size="sm" onClick={() => setShowPrintDialog(true)} className="gap-1 h-8 px-2" title={t("lp_print_pdf")}>
                <Printer className="w-4 h-4" />
                <span className="hidden md:inline text-xs">{t("lp_print_pdf")}</span>
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { setExportAllCalendarId(""); setShowExportAllDialog(true); }} className="gap-1 h-8 px-2" title={t("lp_export_all_plans")}>
                <FileDown className="w-4 h-4" />
                <span className="hidden md:inline text-xs">{t("lp_export_all_plans")}</span>
              </Button>

              {/* Link to Calendar */}
              {selectedId && (
                <>
                  <Separator orientation="vertical" className="h-5" />
                  <Button variant="ghost" size="sm" onClick={() => {
                    setLinkCalendarId("");
                    setLinkLessonDate("");
                    setLinkCalendarTime(null);
                    setShowLinkCalDialog(true);
                  }} className="gap-1 text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-950/30 h-8 px-2" title={t("lp_link_to_calendar")}>
                    <CalendarDays className="w-4 h-4" />
                    <span className="hidden md:inline text-xs">{t("lp_link_to_calendar")}</span>
                  </Button>
                </>
              )}

              {/* AI Generate Plans — opens the same single-plan AI dialog as Generate with AI */}
              {selectedId && (
                <Button variant="ghost" size="sm" onClick={() => {
                  // Pre-fill dialog from current form
                  if (form.title) {
                    setAiTitle(form.title);
                    setAiSubject(form.subject);
                    setAiYearGroup(form.yearGroup);
                    setAiDuration(form.duration || 60);
                    setAiUnit(form.unit || "");
                    setAiComps(form.competencies || []);
                    setAiSessionTime(form.sessionTime || "");
                  }
                  setShowAiDialog(true);
                }} className="gap-1 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/30 h-8 px-2" title={t("lp_ai_generate_bulk")}>
                  <SebaSymbol className="w-4 h-4" />
                  <span className="hidden md:inline text-xs">{t("lp_ai_generate_bulk")}</span>
                </Button>
              )}

              {/* Bulk Save + Save — pushed to the right */}
              <Button
                size="sm"
                variant="outline"
                onClick={handleBulkSave}
                disabled={bulkSaveRunning || saveMutation.isPending}
                className="gap-1 ml-auto h-8"
                title={t("lp_bulk_save_tooltip")}
              >
                {bulkSaveRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <SaveAll className="w-4 h-4" />}
                <span className="hidden sm:inline">{bulkSaveRunning ? t("lp_bulk_saving") : t("lp_bulk_save")}</span>
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saveMutation.isPending || bulkSaveRunning} className="gap-1 h-8">
                <Save className="w-4 h-4" />
                <span className="hidden sm:inline">{saveMutation.isPending ? t("lp_saving") : t("lp_save")}</span>
                <span className="sm:hidden">{saveMutation.isPending ? "…" : t("lp_save")}</span>
              </Button>
            </div>

            {/* Section 1: Header info */}
            {/* AI Generated Banner */}
            {aiGeneratedBanner && (
              <div className="flex items-center gap-2 rounded-lg border border-green-300 bg-green-50 dark:bg-green-950/30 dark:border-green-700 px-4 py-2.5 text-sm text-green-800 dark:text-green-300 animate-in fade-in slide-in-from-top-2 duration-300">
                <Pencil className="w-4 h-4 shrink-0" />
                <span className="font-medium">{t("lp_ai_generated_label")}</span>
                <span className="text-green-700 dark:text-green-400 flex-1">{t("lp_ai_generated_desc")}</span>
                {lastGeneratedCalendarId && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0 h-7 px-2.5 gap-1 text-xs border-green-400 text-green-800 hover:bg-green-100 dark:border-green-600 dark:text-green-300 dark:hover:bg-green-900/40"
                    onClick={() => navigate(`/calendar?calendarId=${lastGeneratedCalendarId}`)}
                  >
                    <CalendarDays className="w-3.5 h-3.5" />
                    {t("lp_view_calendar")}
                  </Button>
                )}
                <button onClick={() => setAiGeneratedBanner(false)} className="shrink-0 text-green-600 hover:text-green-800 dark:text-green-400">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground uppercase tracking-wide">{t("lp_section_info")}</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <Label>{t("lp_lesson_title")}</Label>
                    {selectedId && (
                      <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-teal-500" title={t("lp_regen_section")} disabled={!!regeneratingSection} onClick={() => handleRegenSection("title")}>
                        {regeneratingSection === "title" ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                      </Button>
                    )}
                  </div>
                  <Input value={form.title} onChange={e => setField("title", e.target.value)} placeholder={t('lp_ph_title')} />
                </div>
                {/* Row 1: unit / lesson no / academic year / duration / session time — 2 cols on mobile, 5 on lg */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                  <div>
                    <Label>{t("lp_unit")}</Label>
                    <Input value={form.unit} onChange={e => setField("unit", e.target.value)} placeholder={t('lp_ph_unit')} />
                  </div>
                  <div>
                    <Label>{t("lp_lesson_no")}</Label>
                    <Input value={form.lessonNumber} onChange={e => setField("lessonNumber", e.target.value)} placeholder={t('lp_ph_lesson_number')} />
                  </div>
                  <div>
                    <Label>{t("lp_academic_year")}</Label>
                    <Select value={form.academicYear} onValueChange={v => setField("academicYear", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{ACADEMIC_YEARS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{t("lp_duration_min")}</Label>
                    <Input type="number" value={form.duration} onChange={e => setField("duration", Number(e.target.value))} min={15} max={180} step={5} />
                  </div>
                  <div>
                    <Label>{t("lp_session_time")}</Label>
                    <Input value={form.sessionTime} onChange={e => setField("sessionTime", e.target.value)} placeholder={t("lp_ph_session_time")} />
                  </div>
                </div>
                {/* Row 2: year group / subject / spaces — 1 col on mobile, 3 on md+ */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <Label>{t("lp_year_group")}</Label>
                    <Select value={form.yearGroup} onValueChange={v => setField("yearGroup", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{YEAR_GROUPS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{t("lp_subject")}</Label>
                    <Select value={form.subject} onValueChange={v => setField("subject", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{SUBJECTS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{t("lp_spaces")}</Label>
                    <Input value={form.spaces} onChange={e => setField("spaces", e.target.value)} placeholder={t('lp_ph_spaces')} />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Infantil Eix Section — shown when yearGroup starts with 'Infantil' */}
            {(form.yearGroup === "Infantil (0-3)" || form.yearGroup === "Infantil (3-6)") && (
              <Card className="border-amber-200 bg-amber-50/30 dark:bg-amber-950/20 dark:border-amber-800">
                <CardHeader className="pb-2"><CardTitle className="text-sm text-amber-700 dark:text-amber-400 uppercase tracking-wide">🧒 Educació Infantil · Decret 21/2023</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label>{t("infantil_lesson_plan_eix")}</Label>
                      <Select value={form.infantilEix ?? ""} onValueChange={v => setField("infantilEix", v || null)}>
                        <SelectTrigger><SelectValue placeholder={t("infantil_lesson_plan_eix")} /></SelectTrigger>
                        <SelectContent>{INFANTIL_EIXOS.map(e => <SelectItem key={e.code} value={e.code}>{e.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>{t("infantil_lesson_plan_cycle")}</Label>
                      <Select value={form.infantilCycle ?? form.yearGroup === "Infantil (0-3)" ? "0-3" : "3-6"} onValueChange={v => setField("infantilCycle", v || null)}>
                        <SelectTrigger><SelectValue placeholder={t("infantil_lesson_plan_cycle")} /></SelectTrigger>
                        <SelectContent>{INFANTIL_CYCLES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  {form.infantilEix && (
                    <div className="mt-2 flex gap-2">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">{form.infantilEix}</span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">{form.yearGroup === "Infantil (0-3)" ? "Primer cicle (0–3)" : "Segon cicle (3–6)"}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Section 2: Skills & Systems */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground uppercase tracking-wide">{t("lp_section_skills")}</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Label>{t("lp_skills")}</Label>
                    {selectedId && (
                      <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-teal-500" title={t("lp_regen_section")} disabled={!!regeneratingSection} onClick={() => handleRegenSection("skills")}>
                        {regeneratingSection === "skills" ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                      </Button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-4">
                    {SKILL_KEYS.map(k => (
                      <div key={k} className="flex items-center gap-2">
                        <Checkbox id={`skill-${k}`} checked={!!form.skills[k]} onCheckedChange={v => setField("skills", { ...form.skills, [k]: !!v })} />
                        <label htmlFor={`skill-${k}`} className="text-sm capitalize">{k}</label>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Label>{t("lp_language_systems")}</Label>
                    {selectedId && (
                      <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-teal-500" title={t("lp_regen_section")} disabled={!!regeneratingSection} onClick={() => handleRegenSection("systems")}>
                        {regeneratingSection === "systems" ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                      </Button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-4">
                    {SYSTEM_KEYS.map(k => (
                      <div key={k} className="flex items-center gap-2">
                        <Checkbox id={`sys-${k}`} checked={!!form.systems[k]} onCheckedChange={v => setField("systems", { ...form.systems, [k]: !!v })} />
                        <label htmlFor={`sys-${k}`} className="text-sm capitalize">{k}</label>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Section 3: LOMLOE Competencies */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground uppercase tracking-wide">{t("lp_section_competencies")}</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="mb-2 block">{t("lp_key_competencies")}</Label>
                  <div className="flex flex-wrap gap-2">
                    {COMPETENCIES.map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setField("competencies", form.competencies.includes(c) ? form.competencies.filter(x => x !== c) : [...form.competencies, c])}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors min-h-[36px] ${form.competencies.includes(c) ? "bg-teal-600 text-white border-teal-600" : "bg-background border-border hover:bg-accent"}`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Label>{t("lp_specific_competences")}</Label>
                    {selectedId && (
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-teal-500" title={t("lp_regen_section")} disabled={!!regeneratingSection} onClick={() => handleRegenSection("specificCompetences")}>
                        {regeneratingSection === "specificCompetences" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                      </Button>
                    )}
                  </div>
                  {form.specificCompetences.map((v, i) => (
                    <div key={i} className="flex gap-2 mb-2">
                      <Input value={v} onChange={e => updateListItem("specificCompetences", i, e.target.value)} placeholder={t('lp_ph_competence')} className="flex-1" />
                      <Button variant="ghost" size="icon" className="shrink-0" onClick={() => removeListItem("specificCompetences", i)}><Trash2 className="w-4 h-4 text-red-400" /></Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={() => addListItem("specificCompetences")}><Plus className="w-3 h-3 mr-1" /> {t("lp_add")}</Button>
                </div>
              </CardContent>
            </Card>

            {/* Section 4: Curriculum */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground uppercase tracking-wide">{t("lp_section_curriculum")}</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Label>{t("lp_saberes_basicos")}</Label>
                    {selectedId && (
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-teal-500" title={t("lp_regen_section")} disabled={!!regeneratingSection} onClick={() => handleRegenSection("saberesBasicos")}>
                        {regeneratingSection === "saberesBasicos" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                      </Button>
                    )}
                  </div>
                  {form.saberesBasicos.map((v, i) => (
                    <div key={i} className="flex gap-2 mb-2">
                      <Input value={v} onChange={e => updateListItem("saberesBasicos", i, e.target.value)} placeholder={t('lp_ph_saberes')} className="flex-1" />
                      <Button variant="ghost" size="icon" className="shrink-0" onClick={() => removeListItem("saberesBasicos", i)}><Trash2 className="w-4 h-4 text-red-400" /></Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={() => addListItem("saberesBasicos")}><Plus className="w-3 h-3 mr-1" /> {t("lp_add")}</Button>
                </div>
                <Separator />
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Label>{t("lp_learning_outcomes")}</Label>
                    {selectedId && (
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-teal-500" title={t("lp_regen_section")} disabled={!!regeneratingSection} onClick={() => handleRegenSection("learningOutcomes")}>
                        {regeneratingSection === "learningOutcomes" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                      </Button>
                    )}
                  </div>
                  {form.learningOutcomes.map((v, i) => (
                    <div key={i} className="flex gap-2 mb-2">
                      <Input value={v} onChange={e => updateListItem("learningOutcomes", i, e.target.value)} placeholder={t('lp_ph_outcomes')} className="flex-1" />
                      <Button variant="ghost" size="icon" className="shrink-0" onClick={() => removeListItem("learningOutcomes", i)}><Trash2 className="w-4 h-4 text-red-400" /></Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={() => addListItem("learningOutcomes")}><Plus className="w-3 h-3 mr-1" /> {t("lp_add")}</Button>
                </div>
                <Separator />
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Label>{t("lp_evaluation_criteria")}</Label>
                    {selectedId && (
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-teal-500" title={t("lp_regen_section")} disabled={!!regeneratingSection} onClick={() => handleRegenSection("evaluationCriteria")}>
                        {regeneratingSection === "evaluationCriteria" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                      </Button>
                    )}
                  </div>
                  {form.evaluationCriteria.map((v, i) => (
                    <div key={i} className="flex gap-2 mb-2">
                      <Input value={v} onChange={e => updateListItem("evaluationCriteria", i, e.target.value)} placeholder={t('lp_ph_criteria')} className="flex-1" />
                      <Button variant="ghost" size="icon" className="shrink-0" onClick={() => removeListItem("evaluationCriteria", i)}><Trash2 className="w-4 h-4 text-red-400" /></Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={() => addListItem("evaluationCriteria")}><Plus className="w-3 h-3 mr-1" /> {t("lp_add")}</Button>
                </div>
              </CardContent>
            </Card>

            {/* Section 5: Context */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground uppercase tracking-wide">{t("lp_section_context")}</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Label>{t("lp_previous_knowledge")}</Label>
                    {selectedId && (
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-teal-500" title={t("lp_regen_section")} disabled={!!regeneratingSection} onClick={() => handleRegenSection("previousKnowledge")}>
                        {regeneratingSection === "previousKnowledge" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                      </Button>
                    )}
                  </div>
                  <Textarea value={form.previousKnowledge} onChange={e => setField("previousKnowledge", e.target.value)} rows={2} placeholder={t('lp_ph_prev_knowledge')} />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Label>{t("lp_materials_resources")}</Label>
                    {selectedId && (
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-teal-500" title={t("lp_regen_section")} disabled={!!regeneratingSection} onClick={() => handleRegenSection("materials")}>
                        {regeneratingSection === "materials" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                      </Button>
                    )}
                  </div>
                  <Textarea value={form.materials} onChange={e => setField("materials", e.target.value)} rows={2} placeholder={t('lp_ph_materials')} />
                </div>
              </CardContent>
            </Card>

            {/* Section 6: Procedure */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-sm text-muted-foreground uppercase tracking-wide">{t("lp_section_procedure")}</CardTitle>
                  {selectedId && (
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-teal-500" title={t("lp_regen_section")} disabled={!!regeneratingSection} onClick={() => handleRegenSection("procedures")}>
                      {regeneratingSection === "procedures" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Desktop: grid header */}
                <div className="hidden sm:grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground px-1">
                  <span className="col-span-2">{t("lp_timing")}</span>
                  <span className="col-span-2">{t("lp_stage")}</span>
                  <span className="col-span-6">{t("lp_activities")}</span>
                  <span className="col-span-2">{t("lp_grouping")}</span>
                </div>

                {form.procedures.map((p, i) => (
                  <div key={i}>
                    {/* Desktop row */}
                    <div className="hidden sm:grid grid-cols-12 gap-2 items-start">
                      <Input className="col-span-2" value={p.timing} onChange={e => updateProcedure(i, "timing", e.target.value)} placeholder={t('lp_ph_timing')} />
                      <Input className="col-span-2" value={p.stage} onChange={e => updateProcedure(i, "stage", e.target.value)} placeholder={t('lp_ph_stage')} />
                      <Textarea className="col-span-6 min-h-[60px]" value={p.activities} onChange={e => updateProcedure(i, "activities", e.target.value)} placeholder={t('lp_ph_activities')} />
                      <Input className="col-span-1" value={p.grouping} onChange={e => updateProcedure(i, "grouping", e.target.value)} placeholder={t('lp_ph_grouping')} />
                      <Button variant="ghost" size="icon" className="col-span-1" onClick={() => removeProcedure(i)}><Trash2 className="w-4 h-4 text-red-400" /></Button>
                    </div>

                    {/* Mobile card */}
                    <div className="sm:hidden rounded-lg border p-3 space-y-2 bg-muted/30">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-muted-foreground uppercase">{t("lp_stage")} {i + 1}</span>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeProcedure(i)}><X className="w-3.5 h-3.5 text-red-400" /></Button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs">{t("lp_timing")}</Label>
                          <Input value={p.timing} onChange={e => updateProcedure(i, "timing", e.target.value)} placeholder={t('lp_ph_timing')} className="h-8 text-sm" />
                        </div>
                        <div>
                          <Label className="text-xs">{t("lp_stage")}</Label>
                          <Input value={p.stage} onChange={e => updateProcedure(i, "stage", e.target.value)} placeholder={t('lp_ph_stage')} className="h-8 text-sm" />
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs">{t("lp_activities")}</Label>
                        <Textarea value={p.activities} onChange={e => updateProcedure(i, "activities", e.target.value)} placeholder={t('lp_ph_activities')} rows={3} className="text-sm" />
                      </div>
                      <div>
                        <Label className="text-xs">{t("lp_grouping")}</Label>
                        <Input value={p.grouping} onChange={e => updateProcedure(i, "grouping", e.target.value)} placeholder={t('lp_ph_grouping')} className="h-8 text-sm" />
                      </div>
                    </div>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={addProcedure}><Plus className="w-3 h-3 mr-1" /> {t("lp_add_stage")}</Button>
              </CardContent>
            </Card>

            {/* Section 7: Differentiated Instruction */}
            {form.differentiation && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground uppercase tracking-wide">{t("lp_differentiation")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Advanced */}
                    <div className="rounded-lg border border-blue-200 bg-blue-50/40 dark:bg-blue-950/20 dark:border-blue-800 p-3 space-y-2">
                      <div className="flex items-center gap-1.5 font-semibold text-blue-700 dark:text-blue-400 text-sm">
                        <span className="text-base">🔵</span> {t("lp_diff_advanced")}
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">{t("lp_diff_objectives")}</Label>
                        <Textarea
                          value={form.differentiation.advanced.objectives}
                          onChange={e => setField("differentiation", { ...form.differentiation!, advanced: { ...form.differentiation!.advanced, objectives: e.target.value } })}
                          rows={3} className="text-sm resize-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">{t("lp_diff_activities")}</Label>
                        <Textarea
                          value={form.differentiation.advanced.activities}
                          onChange={e => setField("differentiation", { ...form.differentiation!, advanced: { ...form.differentiation!.advanced, activities: e.target.value } })}
                          rows={4} className="text-sm resize-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">{t("lp_diff_assessment")}</Label>
                        <Textarea
                          value={form.differentiation.advanced.assessment}
                          onChange={e => setField("differentiation", { ...form.differentiation!, advanced: { ...form.differentiation!.advanced, assessment: e.target.value } })}
                          rows={3} className="text-sm resize-none"
                        />
                      </div>
                    </div>

                    {/* Standard */}
                    <div className="rounded-lg border border-green-200 bg-green-50/40 dark:bg-green-950/20 dark:border-green-800 p-3 space-y-2">
                      <div className="flex items-center gap-1.5 font-semibold text-green-700 dark:text-green-400 text-sm">
                        <span className="text-base">🟢</span> {t("lp_diff_standard")}
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">{t("lp_diff_objectives")}</Label>
                        <Textarea
                          value={form.differentiation.standard.objectives}
                          onChange={e => setField("differentiation", { ...form.differentiation!, standard: { ...form.differentiation!.standard, objectives: e.target.value } })}
                          rows={3} className="text-sm resize-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">{t("lp_diff_activities")}</Label>
                        <Textarea
                          value={form.differentiation.standard.activities}
                          onChange={e => setField("differentiation", { ...form.differentiation!, standard: { ...form.differentiation!.standard, activities: e.target.value } })}
                          rows={4} className="text-sm resize-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">{t("lp_diff_assessment")}</Label>
                        <Textarea
                          value={form.differentiation.standard.assessment}
                          onChange={e => setField("differentiation", { ...form.differentiation!, standard: { ...form.differentiation!.standard, assessment: e.target.value } })}
                          rows={3} className="text-sm resize-none"
                        />
                      </div>
                    </div>

                    {/* Slower */}
                    <div className="rounded-lg border border-amber-200 bg-amber-50/40 dark:bg-amber-950/20 dark:border-amber-800 p-3 space-y-2">
                      <div className="flex items-center gap-1.5 font-semibold text-amber-700 dark:text-amber-400 text-sm">
                        <span className="text-base">🟡</span> {t("lp_diff_slower")
                        }
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">{t("lp_diff_objectives")}</Label>
                        <Textarea
                          value={form.differentiation.slower.objectives}
                          onChange={e => setField("differentiation", { ...form.differentiation!, slower: { ...form.differentiation!.slower, objectives: e.target.value } })}
                          rows={3} className="text-sm resize-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">{t("lp_diff_activities")}</Label>
                        <Textarea
                          value={form.differentiation.slower.activities}
                          onChange={e => setField("differentiation", { ...form.differentiation!, slower: { ...form.differentiation!.slower, activities: e.target.value } })}
                          rows={4} className="text-sm resize-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">{t("lp_diff_assessment")}</Label>
                        <Textarea
                          value={form.differentiation.slower.assessment}
                          onChange={e => setField("differentiation", { ...form.differentiation!, slower: { ...form.differentiation!.slower, assessment: e.target.value } })}
                          rows={3} className="text-sm resize-none"
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Bottom save button for mobile convenience */}
            {isMobile && (
              <div className="pb-4">
                <Button className="w-full gap-2" onClick={handleSave} disabled={saveMutation.isPending}>
                  <Save className="w-4 h-4" />
                  {saveMutation.isPending ? t("lp_saving") : t("lp_save")}
                </Button>
              </div>
            )}
        </div>
      </div>

      {/* Export All Plans Dialog */}
      <Dialog open={showExportAllDialog} onOpenChange={setShowExportAllDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileDown className="w-5 h-5 text-teal-500" /> {t("lp_export_all_dialog_title")}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{t("lp_export_all_dialog_desc")}</p>
          <div className="space-y-2">
            <Label>{t("lp_select_calendar")}</Label>
            <Select value={exportAllCalendarId} onValueChange={setExportAllCalendarId}>
              <SelectTrigger><SelectValue placeholder={t("lp_select_calendar")} /></SelectTrigger>
              <SelectContent>
                {(calendars as any[]).map((c: any) => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setShowExportAllDialog(false)}>{t("cal_cancel")}</Button>
            <Button
              disabled={!exportAllCalendarId || isExportingAll || exportAllPlansMutation.isPending}
              onClick={() => {
                if (!exportAllCalendarId) return;
                setIsExportingAll(true);
                exportAllPlansMutation.mutate({ calendarId: Number(exportAllCalendarId) });
              }}
            >
              <FileDown className="w-4 h-4 mr-1" />
              {isExportingAll ? t("lp_export_all_exporting") : t("lp_export_all_btn")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI Generate Dialog */}
      <Dialog open={showAiDialog} onOpenChange={(open) => { setShowAiDialog(open); if (!open) { setAiDate(""); setAiSessionTime(""); setAiUnit(""); setAiCalendarId(""); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><SebaSymbol className="w-5 h-5 text-teal-500" /> {t("lp_ai_dialog_title")}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {/* Core lesson info */}
            <div>
              <Label>{t("lp_lesson_title")}</Label>
              <Input value={aiTitle} onChange={e => setAiTitle(e.target.value)} placeholder={t('lp_ph_title')} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>{t("lp_topic")}</Label>
                <Input value={aiUnit} onChange={e => setAiUnit(e.target.value)} placeholder={t("lp_ph_unit")} />
              </div>
              <div>
                <Label>{t("lp_duration_field")}</Label>
                <Input type="number" value={aiDuration} onChange={e => setAiDuration(Number(e.target.value))} min={15} max={180} step={5} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>{t("lp_subject")}</Label>
                <Select value={aiSubject} onValueChange={setAiSubject}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{SUBJECTS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t("lp_year_group")}</Label>
                <Select value={aiYearGroup} onValueChange={setAiYearGroup}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{YEAR_GROUPS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            {/* Date & Session Time */}
            <div className="rounded-lg border border-dashed border-border p-3 space-y-3 bg-muted/30">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("lp_add_to_calendar")} <span className="normal-case font-normal">(optional)</span></p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label>{t("lp_date")}</Label>
                  <Input type="date" value={aiDate} onChange={e => setAiDate(e.target.value)} className="h-9" />
                </div>
                <div>
                  <Label>{t("lp_session_time")}</Label>
                  <Input value={aiSessionTime} onChange={e => setAiSessionTime(e.target.value)} placeholder={t("lp_ph_session_time")} className="h-9" />
                </div>
              </div>
              {aiDate && (
                <div>
                  <Label>{t("lp_calendar")}</Label>
                  <Select value={aiCalendarId} onValueChange={setAiCalendarId}>
                    <SelectTrigger>
                      <SelectValue placeholder={t("lp_select_calendar")} />
                    </SelectTrigger>
                    <SelectContent>
                      {(calendars as any[]).map((cal: any) => (
                        <SelectItem key={cal.id} value={String(cal.id)}>
                          {cal.name} {cal.yearLevel ? `· ${cal.yearLevel}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {(calendars as any[]).length === 0 && (
                    <p className="text-xs text-muted-foreground mt-1">{t("lp_no_calendars")}</p>
                  )}
                </div>
              )}
            </div>

            {/* Curriculum Year */}
            <div>
              <Label>Curriculum Year <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
              <Input value={aiCurriculumYear} onChange={e => setAiCurriculumYear(e.target.value)} placeholder="e.g. 2025-2026" />
              <p className="text-xs text-muted-foreground mt-1">Anchors the AI to the correct academic year context for lesson sequencing.</p>
            </div>

            {/* Educació Infantil mode */}
            <div className="rounded-md border border-pink-200 bg-pink-50 dark:bg-pink-950/20 dark:border-pink-800 p-3 space-y-3">
              <p className="text-xs font-semibold text-pink-800 dark:text-pink-300">Educació Infantil (Decret 21/2023) <span className="font-normal">— optional</span></p>
              <p className="text-xs text-pink-700 dark:text-pink-400">Select an Eix to generate play-based Infantil activities aligned to Decret 21/2023 instead of standard LOMLOE lessons.</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Eix de Desenvolupament</Label>
                  <Select value={aiInfantilEix} onValueChange={v => setAiInfantilEix(v === "none" ? "" : v)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="None (LOMLOE mode)" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None (LOMLOE mode)</SelectItem>
                      <SelectItem value="EIX1">EIX1 — Descoberta d'un mateix</SelectItem>
                      <SelectItem value="EIX2">EIX2 — Descoberta de l'entorn</SelectItem>
                      <SelectItem value="EIX3">EIX3 — Comunicació i llenguatges</SelectItem>
                      <SelectItem value="EIX4">EIX4 — Benestar i salut</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Cycle</Label>
                  <Select value={aiInfantilCycle} onValueChange={v => setAiInfantilCycle(v === "none" ? "" : v)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select cycle" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Not specified</SelectItem>
                      <SelectItem value="0-3">Primer cicle (0–3 anys)</SelectItem>
                      <SelectItem value="3-6">Segon cicle (3–6 anys)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Planning Scope */}
            <div className="rounded-lg border border-teal-200 bg-teal-50/40 dark:bg-teal-950/20 dark:border-teal-800 p-3 space-y-2">
              <p className="text-xs font-semibold text-teal-800 dark:text-teal-300 uppercase tracking-wide">{t("lp_scope_label")}</p>
              <div className="grid grid-cols-5 gap-1.5">
                {(["single", "semester1", "semester2", "semester3", "year"] as const).map(scope => (
                  <button key={scope} type="button"
                    onClick={() => setAiPlanningScope(scope)}
                    className={`rounded-lg border p-2 text-xs font-medium text-center transition-colors ${
                      aiPlanningScope === scope
                        ? "bg-teal-600 text-white border-teal-600"
                        : "bg-background border-border hover:bg-accent"
                    }`}>
                    {scope === "single" ? t("lp_scope_single") : scope === "semester1" ? t("lp_scope_semester1") : scope === "semester2" ? t("lp_scope_semester2") : scope === "semester3" ? t("lp_scope_semester3") : t("lp_scope_year")}
                    <div className="text-[10px] font-normal opacity-70 mt-0.5">
                      {scope === "single" ? t("lp_scope_single_desc") : scope === "year" ? t("lp_scope_year_desc") : t("lp_scope_semester_desc")}
                    </div>
                  </button>
                ))}
              </div>
              {aiPlanningScope !== "single" && (
                <p className="text-xs text-teal-700 dark:text-teal-400">
                  {aiPlanningScope === "year" ? t("lp_scope_year_info") : t("lp_scope_semester_info")}
                </p>
              )}
              {/* Calendar selector for bulk generation */}
              {aiPlanningScope !== "single" && (
                <div>
                  <Label className="text-xs">{t("lp_calendar")}</Label>
                  <Select value={aiDialogCalendarId} onValueChange={setAiDialogCalendarId}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder={t("lp_select_calendar")} />
                    </SelectTrigger>
                    <SelectContent>
                      {(calendars as any[]).map((cal: any) => (
                        <SelectItem key={cal.id} value={String(cal.id)}>
                          {cal.name} {cal.yearLevel ? `· ${cal.yearLevel}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {(calendars as any[]).length === 0 && (
                    <p className="text-xs text-muted-foreground mt-1">{t("lp_no_calendars")}</p>
                  )}
                </div>
              )}
            </div>

            {/* Competencies */}
            <div>
              <Label className="mb-2 block">{t("lp_focus_competencies")}</Label>
              <div className="flex flex-wrap gap-2">
                {COMPETENCIES.map(c => (
                  <button key={c} type="button" onClick={() => toggleComp(c)}
                    className={`px-2 py-1.5 rounded-full text-xs font-medium border transition-colors min-h-[34px] ${aiComps.includes(c) ? "bg-teal-600 text-white border-teal-600" : "bg-background border-border hover:bg-accent"}`}>
                    {c}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setShowAiDialog(false)}>{t("cal_cancel")}</Button>
<Button onClick={async () => {
              if (!aiTitle.trim()) { toast.error(t("lp_title_required")); return; }
              if (aiDate && !aiCalendarId && (calendars as any[]).length > 0) { toast.error(t("lp_select_calendar")); return; }

              if (aiPlanningScope === "single") {
                // Single lesson — existing behaviour
                const existingSnapshot = selectedId && form.title ? {
                  skills: JSON.stringify(form.skills),
                  systems: JSON.stringify(form.systems),
                  specificCompetences: JSON.stringify(form.specificCompetences),
                  saberesBasicos: JSON.stringify(form.saberesBasicos),
                  learningOutcomes: JSON.stringify(form.learningOutcomes),
                  evaluationCriteria: JSON.stringify(form.evaluationCriteria),
                  previousKnowledge: form.previousKnowledge,
                  materials: form.materials,
                  spaces: form.spaces,
                  procedures: JSON.stringify(form.procedures),
                } : undefined;
                if (selectedId && form.title) preAiSnapshotRef.current = { ...form };
                aiMutation.mutate({
                  id: selectedId ?? undefined,
                  title: aiTitle,
                  subject: aiSubject,
                  yearGroup: aiYearGroup,
                  duration: aiDuration,
                  competencies: aiComps,
                  unit: aiUnit || undefined,
                  sessionTime: aiSessionTime || undefined,
                  existing: existingSnapshot,
                  infantilEix: aiInfantilEix || undefined,
                  infantilCycle: aiInfantilCycle || undefined,
                  academicYear: aiCurriculumYear || undefined,
                });
              } else {
                // Semester 1/2/3 or Whole Year — use the two-phase bulk generation procedure
                if (!aiDialogCalendarId) {
                  toast.error(t("lp_select_calendar"));
                  return;
                }
                setAiScopeGenerating(true);
                setShowAiDialog(false);
                try {
                  const bulkScope = aiPlanningScope as "semester1" | "semester2" | "semester3" | "year";
                  const BATCH_SIZE = 8;
                  let offset = 0;
                  let totalCreated = 0;
                  let topicOutlineJson: string | null | undefined = undefined;
                  let totalSlots = 0;

                  while (true) {
                    const result = await utils.client.planner.generateBulkLessonPlans.mutate({
                      calendarId: Number(aiDialogCalendarId),
                      scope: bulkScope,
                      methodology: undefined,
                      batchOffset: offset,
                      batchSize: BATCH_SIZE,
                      topicOutlineJson: topicOutlineJson ?? undefined,
                    });

                    totalCreated += result.created;
                    totalSlots = result.total;
                    offset = result.nextOffset ?? offset + BATCH_SIZE;

                    if (topicOutlineJson === undefined && result.topicOutlineJson) {
                      topicOutlineJson = result.topicOutlineJson;
                    }

                    utils.planner.listLessonPlans.invalidate();

                    if ((result.totalRemaining ?? 0) <= 0) break;
                  }

                  if (totalCreated === 0) {
                    toast.info(t("lp_bulk_ai_none"));
                  } else {
                    toast.success(t("lp_bulk_ai_done").replace("{{count}}", String(totalCreated)));
                  }
                  setLastGeneratedCalendarId(Number(aiDialogCalendarId));
                  setAiGeneratedBanner(true);
                  setTimeout(() => setAiGeneratedBanner(false), 15000);
                } catch (e: any) {
                  const isAbort = e?.name === "AbortError" || (typeof e?.message === "string" && e.message.toLowerCase().includes("abort"));
                  if (!isAbort) {
                    toast.error(e?.message ?? t("lp_bulk_ai_error"));
                  } else {
                    toast.info(t("lp_bulk_ai_creating"));
                  }
                } finally {
                  setAiScopeGenerating(false);
                }
              }
            }} disabled={aiMutation.isPending || aiScopeGenerating || (aiPlanningScope !== "single" && !aiDialogCalendarId)} className="gap-1">
              <SebaSymbol className="w-4 h-4" />
              {aiMutation.isPending || aiScopeGenerating ? t("lp_generating") : t("lp_generate")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Print Dialog */}
      <Dialog open={showPrintDialog} onOpenChange={setShowPrintDialog}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Printer className="w-5 h-5" /> {t("lp_print_dialog_title")}</DialogTitle></DialogHeader>
          <div className="space-y-5">
            {/* Logo upload */}
            <LogoUploader />
            <Separator />
            {/* Paper format */}
            <div>
              <Label>{t("lp_paper_format")}</Label>
              <Select value={printFormat} onValueChange={v => setPrintFormat(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="a4">A4 (210 × 297 mm)</SelectItem>
                  <SelectItem value="a5">A5 (148 × 210 mm)</SelectItem>
                  <SelectItem value="letter">{t("lp_us_letter")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-sm text-muted-foreground">{t("lp_print_desc")}</p>
          </div>
          <DialogFooter className="flex-col-reverse sm:flex-row flex-wrap gap-2">
            <Button variant="outline" onClick={() => setShowPrintDialog(false)}>{t("cal_cancel")}</Button>
            <ExportDropdown
              options={[
                {
                  key: "print",
                  icon: <PrintIcon />,
                  label: t("lp_open_preview"),
                  onClick: handlePrint,
                },
                {
                  key: "csv",
                  icon: <CsvIcon />,
                  label: t("export_csv"),
                  separator: true,
                  onClick: () => {
                    const rows = [
                      { field: "title", value: form.title },
                      { field: "unit", value: form.unit },
                      { field: "lesson_number", value: form.lessonNumber },
                      { field: "year_group", value: form.yearGroup },
                      { field: "subject", value: form.subject },
                      { field: "duration_min", value: form.duration },
                      { field: "competencies", value: form.competencies.join("; ") },
                      { field: "learning_outcomes", value: form.learningOutcomes.join("; ") },
                      { field: "evaluation_criteria", value: form.evaluationCriteria.join("; ") },
                      { field: "previous_knowledge", value: form.previousKnowledge },
                      { field: "materials", value: form.materials },
                      ...form.procedures.map((p, i) => ({ field: `procedure_${i + 1}`, value: `${p.stage} | ${p.timing}min | ${p.activities} | ${p.grouping}` })),
                    ];
                    exportToCsv(form.title || "lesson-plan", rows);
                  },
                },
                {
                  key: "xml",
                  icon: <XmlIcon />,
                  label: t("export_xml"),
                  onClick: () => {
                    const rows = [
                      { field: "title", value: form.title },
                      { field: "unit", value: form.unit },
                      { field: "lesson_number", value: form.lessonNumber },
                      { field: "year_group", value: form.yearGroup },
                      { field: "subject", value: form.subject },
                      { field: "duration_min", value: form.duration },
                      { field: "competencies", value: form.competencies.join("; ") },
                      { field: "learning_outcomes", value: form.learningOutcomes.join("; ") },
                      { field: "evaluation_criteria", value: form.evaluationCriteria.join("; ") },
                      { field: "previous_knowledge", value: form.previousKnowledge },
                      { field: "materials", value: form.materials },
                      ...form.procedures.map((p, i) => ({ field: `procedure_${i + 1}`, value: `${p.stage} | ${p.timing}min | ${p.activities} | ${p.grouping}` })),
                    ];
                    exportToXml(form.title || "lesson-plan", "lesson_plan", rows, "field");
                  },
                },
              ]}
            />
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Save as Template Dialog */}
      <Dialog open={showSaveTemplateDialog} onOpenChange={setShowSaveTemplateDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><LayoutTemplate className="w-4 h-4" /> {t("lp_save_as_template")}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>{t("lp_template_name")}</Label>
              <Input value={templateNameInput} onChange={e => setTemplateNameInput(e.target.value)} placeholder={t("lp_template_name_ph")} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveTemplateDialog(false)}>{t("cal_cancel")}</Button>
            <Button
              disabled={!templateNameInput.trim() || saveTemplateMutation.isPending || !selectedId}
              onClick={() => selectedId && saveTemplateMutation.mutate({ planId: selectedId, templateName: templateNameInput.trim() })}
              className="gap-1"
            >
              <LayoutTemplate className="w-4 h-4" /> {t("lp_save_as_template")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Load Template Dialog */}
      <Dialog open={showLoadTemplateDialog} onOpenChange={setShowLoadTemplateDialog}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><FolderOpen className="w-4 h-4" /> {t("lp_templates")}</DialogTitle></DialogHeader>
          {(templates as any[]).length === 0 ? (
            <p className="text-sm text-muted-foreground italic">{t("lp_no_templates")}</p>
          ) : (
            <div className="space-y-2">
              {(templates as any[]).map((tmpl: any) => (
                <div key={tmpl.id} className="flex items-center justify-between gap-2 p-3 rounded-lg border hover:bg-accent/50 transition-colors">
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate">{tmpl.templateName || tmpl.title}</div>
                    <div className="text-xs text-muted-foreground truncate">{tmpl.subject} · {tmpl.yearGroup}</div>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <Button size="sm" variant="outline" onClick={() => loadTemplate(tmpl)} className="gap-1">
                      <FolderOpen className="w-3.5 h-3.5" /> {t("lp_load_template")}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => deleteTemplateMutation.mutate({ id: tmpl.id })} className="text-red-500 hover:text-red-600 px-2">
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLoadTemplateDialog(false)}>{t("cal_cancel")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Individual Delete Confirmation */}
      <AlertDialog open={showIndividualDeleteConfirm !== null} onOpenChange={(o) => { if (!o) setShowIndividualDeleteConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("lp_delete_plan_confirm_title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("lp_delete_plan_confirm_desc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cal_cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => showIndividualDeleteConfirm !== null && deleteMutation.mutate({ id: showIndividualDeleteConfirm })}
            >
              <Trash2 className="w-4 h-4 mr-1" />{t("lp_delete_plan")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Batch Delete Confirmation */}
      <AlertDialog open={showBatchDeleteConfirm} onOpenChange={setShowBatchDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("lp_batch_delete_confirm_title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("lp_batch_delete_confirm_desc").replace("{{count}}", String(selectedPlanIds.size))}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cal_cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => batchDeleteMutation.mutate({ ids: Array.from(selectedPlanIds) })}
            >
              <Trash2 className="w-4 h-4 mr-1" />{t("lp_batch_delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Copy Dialog */}
      <Dialog open={showBulkCopyDialog} onOpenChange={(open) => { setShowBulkCopyDialog(open); if (!open) setBulkCopyTargetCalendarId(""); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Copy className="w-4 h-4 text-orange-600" />
              {t("lp_bulk_copy_dialog_title")} ({selectedPlanIds.size})
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">{t("lp_bulk_copy_desc")}</p>
            <div className="space-y-1.5">
              <Label>{t("lp_copy_target_calendar")}</Label>
              <Select value={bulkCopyTargetCalendarId} onValueChange={setBulkCopyTargetCalendarId}>
                <SelectTrigger>
                  <SelectValue placeholder={t("lp_copy_same_calendar")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="same">{t("lp_copy_same_calendar")}</SelectItem>
                  {(calendars as any[]).map((cal: any) => (
                    <SelectItem key={cal.id} value={String(cal.id)}>{cal.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-start gap-2">
              <Checkbox
                id="bulk-copy-renumber"
                checked={bulkCopyAutoRenumber}
                onCheckedChange={(v) => setBulkCopyAutoRenumber(!!v)}
                className="mt-0.5"
              />
              <Label htmlFor="bulk-copy-renumber" className="text-sm font-normal leading-snug cursor-pointer">
                {t("lp_copy_renumber")}
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkCopyDialog(false)}>{t("cal_cancel")}</Button>
            <Button
              onClick={handleBulkCopy}
              disabled={bulkCopyMutation.isPending}
              className="gap-1 bg-orange-600 hover:bg-orange-700 text-white"
            >
              {bulkCopyMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Copy className="w-3.5 h-3.5" />}
              {t("lp_bulk_copy")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Copy plan to calendar dialog */}
      <Dialog open={showCopyPlanDialog} onOpenChange={(open) => { setShowCopyPlanDialog(open); if (!open) { setCopySourcePlan(null); setCopyTargetEventId(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Copy className="w-4 h-4 text-orange-600" />
              {t("lp_copy_plan_dialog_title")}
            </DialogTitle>
          </DialogHeader>
          {copySourcePlan && (
            <div className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground">{t("lp_copy_plan_dialog_desc")}</p>
              <div className="space-y-1.5">
                <Label>{t("lp_copy_target_calendar")}</Label>
                <Select value={copyTargetCalendarId} onValueChange={(v) => { setCopyTargetCalendarId(v); setCopyTargetEventId(""); }}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("lp_copy_same_calendar")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="same">{t("lp_copy_same_calendar")}</SelectItem>
                    {(calendars as any[]).map((cal: any) => (
                      <SelectItem key={cal.id} value={String(cal.id)}>{cal.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {/* Event picker — only shown when a specific calendar is selected */}
              {lpCalIdForPicker !== null && (
                <div className="space-y-1.5">
                  <Label>{t("lp_copy_target_event")}</Label>
                  <Select value={copyTargetEventId} onValueChange={setCopyTargetEventId}>
                    <SelectTrigger>
                      <SelectValue placeholder={t("lp_copy_no_event")} />
                    </SelectTrigger>
                    <SelectContent className="max-h-56">
                      <SelectItem value="none">{t("lp_copy_no_event")}</SelectItem>
                      {lpLessonEventsForPicker.map((ev: any) => {
                        const d = ev.eventDate ? new Date(ev.eventDate) : null;
                        const dateStr = d ? d.toLocaleDateString(undefined, { day: "2-digit", month: "short" }) : "";
                        const timeStr = ev.startTime ? ` · ${ev.startTime}` : "";
                        return (
                          <SelectItem key={ev.id} value={String(ev.id)}>
                            <span className="font-medium">{dateStr}{timeStr}</span>
                            {ev.title ? <span className="text-muted-foreground ml-1.5 truncate max-w-[180px]">— {ev.title}</span> : null}
                            {ev.hasLinkedPlan && (
                              <span className="ml-1.5 text-xs text-amber-600 font-medium" title={t("lp_copy_event_conflict_hint")}>⚠️ {t("lp_copy_event_conflict")}</span>
                            )}
                          </SelectItem>
                        );
                      })}
                      {lpLessonEventsForPicker.length === 0 && (
                        <div className="px-3 py-2 text-sm text-muted-foreground">{t("lp_copy_event_placeholder")}</div>
                      )}
                    </SelectContent>
                  </Select>
                  {copyTargetEventId && copyTargetEventId !== "none" && lpLessonEventsForPicker.find((e: any) => String(e.id) === copyTargetEventId)?.hasLinkedPlan && (
                    <div className="rounded-md border border-amber-200 bg-amber-50 p-3 space-y-2">
                      <p className="text-xs font-medium text-amber-700">{t("lp_copy_event_conflict")}</p>
                      <p className="text-xs text-amber-600">{t("lp_copy_replace_warning")}</p>
                      <div className="flex flex-col gap-1.5 pt-0.5">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="lp-copy-mode"
                            checked={!copyReplaceExisting}
                            onChange={() => setCopyReplaceExisting(false)}
                            className="accent-orange-600"
                          />
                          <span className="text-xs text-amber-800">{t("lp_copy_create_duplicate")}</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="lp-copy-mode"
                            checked={copyReplaceExisting}
                            onChange={() => setCopyReplaceExisting(true)}
                            className="accent-orange-600"
                          />
                          <span className="text-xs font-medium text-amber-800">{t("lp_copy_replace_existing")}</span>
                        </label>
                      </div>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">{t("lp_copy_event_hint")}</p>
                </div>
              )}
              <div className="flex items-start gap-2">
                <Checkbox
                  id="lp-copy-renumber"
                  checked={copyAutoRenumber}
                  onCheckedChange={(v) => setCopyAutoRenumber(!!v)}
                  className="mt-0.5"
                />
                <Label htmlFor="lp-copy-renumber" className="text-sm font-normal leading-snug cursor-pointer">
                  {t("lp_copy_renumber")}
                </Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCopyPlanDialog(false)}>{t("cal_cancel")}</Button>
            <Button
              onClick={handleCopyPlan}
              disabled={copyPlanMutation.isPending}
              className="gap-1 bg-orange-600 hover:bg-orange-700 text-white"
            >
              {copyPlanMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Copy className="w-3.5 h-3.5" />}
              {t("lp_copy_btn")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Link to Calendar Dialog ─────────────────────────────────────────────── */}
      <Dialog open={showLinkCalDialog} onOpenChange={setShowLinkCalDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-teal-500" /> {t("lp_link_to_calendar")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("lp_select_calendar")}</Label>
              <Select value={linkCalendarId} onValueChange={async (val) => {
                setLinkCalendarId(val);
                try {
                  const result = await utils.client.planner.getCalendarLessonTime.query({ calendarId: Number(val) });
                  if (result?.defaultStartTime && result?.defaultEndTime) {
                    setLinkCalendarTime({ start: result.defaultStartTime, end: result.defaultEndTime });
                  } else {
                    setLinkCalendarTime(null);
                  }
                } catch { setLinkCalendarTime(null); }
              }}>
                <SelectTrigger><SelectValue placeholder={t("lp_select_calendar")} /></SelectTrigger>
                <SelectContent>
                  {(calendars as any[]).map((c: any) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {linkCalendarTime && (
              <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700 px-3 py-2 text-sm">
                <CalendarDays className="w-4 h-4 text-amber-600 shrink-0" />
                <div>
                  <p className="font-medium text-amber-800 dark:text-amber-300">{t("lp_director_lesson_time")}</p>
                  <p className="text-amber-700 dark:text-amber-400">{linkCalendarTime.start} – {linkCalendarTime.end}</p>
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label>{t("lp_lesson_date")}</Label>
              <input
                type="date"
                value={linkLessonDate}
                onChange={e => setLinkLessonDate(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setShowLinkCalDialog(false)}>{t("cal_cancel")}</Button>
            <Button
              disabled={!linkCalendarId || !linkLessonDate}
              className="gap-1 bg-teal-600 hover:bg-teal-700 text-white"
              onClick={async () => {
                if (!selectedId || !linkCalendarId || !linkLessonDate) return;
                try {
                  const result = await utils.client.planner.linkPlanToCalendar.mutate({
                    planId: selectedId,
                    calendarId: Number(linkCalendarId),
                    lessonDate: linkLessonDate,
                  });
                  if (result.clash) {
                    setClashDetails({ clashWith: result.clashWith, start: result.directorStartTime, end: result.directorEndTime });
                    setShowLinkCalDialog(false);
                    setShowClashDialog(true);
                  } else {
                    setShowLinkCalDialog(false);
                    setForm(prev => ({
                      ...prev,
                      lessonDate: linkLessonDate,
                      sessionTime: result.directorStartTime + "-" + result.directorEndTime,
                    }));
                    utils.planner.listLessonPlans.invalidate();
                    toast.success(t("lp_linked_to_calendar_toast"));
                  }
                } catch (e: any) {
                  toast.error(e.message ?? t("lp_link_error"));
                }
              }}
            >
              <CalendarDays className="w-4 h-4" />
              {t("lp_link_confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Clash Notification Dialog ───────────────────────────────────────────── */}
      <Dialog open={showClashDialog} onOpenChange={setShowClashDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <span className="text-xl">⚠️</span> {t("lp_clash_title")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{t("lp_clash_desc")}</p>
            {clashDetails && (
              <>
                <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-800 px-3 py-2 text-sm">
                  <p className="font-medium text-red-700 dark:text-red-400 mb-1">{t("lp_clash_time")}: {clashDetails.start} – {clashDetails.end}</p>
                  <ul className="list-disc list-inside text-red-600 dark:text-red-400 space-y-0.5">
                    {clashDetails.clashWith.map((title, i) => (
                      <li key={i}>{title}</li>
                    ))}
                  </ul>
                </div>
                <p className="text-sm font-medium text-foreground">{t("lp_clash_contact")}</p>
              </>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setShowClashDialog(false)}>{t("lp_clash_ok")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Bulk AI Generate Dialog ──────────────────────────────────────────────── */}
      <Dialog open={showBulkAiDialog} onOpenChange={v => { if (!bulkAiRunning) setShowBulkAiDialog(v); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <SebaSymbol className="w-5 h-5 text-purple-600" />
              {t("lp_bulk_ai_title")}
            </DialogTitle>
            <DialogDescription>{t("lp_bulk_ai_desc")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Calendar selector */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">{t("lp_bulk_ai_calendar")}</Label>
              <Select value={bulkAiCalendarId} onValueChange={setBulkAiCalendarId} disabled={bulkAiRunning}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("lp_bulk_ai_select_calendar")} />
                </SelectTrigger>
                <SelectContent>
                  {(calendars as any[]).map((cal: any) => (
                    <SelectItem key={cal.id} value={String(cal.id)}>{cal.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* Scope selector */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">{t("lp_bulk_ai_scope")}</Label>
              <div className="grid grid-cols-2 gap-2">
                {(["year", "semester1", "semester2", "semester3"] as const).map(scope => (
                  <button
                    key={scope}
                    type="button"
                    disabled={bulkAiRunning}
                    onClick={() => setBulkAiScope(scope)}
                    className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                      bulkAiScope === scope
                        ? "border-purple-500 bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-600"
                        : "border-border bg-background text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {t(scope === "year" ? "lp_bulk_ai_scope_year" : scope === "semester1" ? "lp_bulk_ai_scope_s1" : scope === "semester2" ? "lp_bulk_ai_scope_s2" : "lp_bulk_ai_scope_s3")}
                    <div className="text-[10px] font-normal opacity-70 mt-0.5">
                      {scope === "year" ? t("lp_scope_year_desc") : t("lp_scope_semester_desc")}
                    </div>
                  </button>
                ))}
              </div>
            </div>
            {/* Teaching Methodology selector */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">{t("lp_bulk_ai_methodology")}</Label>
              <Select value={bulkAiMethodology} onValueChange={setBulkAiMethodology} disabled={bulkAiRunning}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("lp_bulk_ai_methodology_placeholder")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("lp_bulk_ai_methodology_none")}</SelectItem>
                  <SelectItem value="pbl">{t("lp_bulk_ai_methodology_pbl")}</SelectItem>
                  <SelectItem value="ibl">{t("lp_bulk_ai_methodology_ibl")}</SelectItem>
                  <SelectItem value="cbl">{t("lp_bulk_ai_methodology_cbl")}</SelectItem>
                  <SelectItem value="flipped">{t("lp_bulk_ai_methodology_flipped")}</SelectItem>
                  <SelectItem value="cooperative">{t("lp_bulk_ai_methodology_cooperative")}</SelectItem>
                  <SelectItem value="clil">{t("lp_bulk_ai_methodology_clil")}</SelectItem>
                  <SelectItem value="steam">{t("lp_bulk_ai_methodology_steam")}</SelectItem>
                  <SelectItem value="montessori">{t("lp_bulk_ai_methodology_montessori")}</SelectItem>
                  <SelectItem value="socratic">{t("lp_bulk_ai_methodology_socratic")}</SelectItem>
                  <SelectItem value="gamification">{t("lp_bulk_ai_methodology_gamification")}</SelectItem>
                  <SelectItem value="ubi">{t("lp_bulk_ai_methodology_ubi")}</SelectItem>
                  <SelectItem value="direct">{t("lp_bulk_ai_methodology_direct")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {/* Progress */}
            {bulkAiRunning && (
              <div className="flex items-center gap-2 rounded-lg bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 px-3 py-2">
                <Loader2 className="w-4 h-4 animate-spin text-purple-600 shrink-0" />
                <p className="text-sm text-purple-700 dark:text-purple-300">
                  {bulkAiProgress
                    ? t("lp_bulk_ai_progress").replace("{{current}}", String(bulkAiProgress.current)).replace("{{total}}", String(bulkAiProgress.total))
                    : t("lp_bulk_ai_starting")}
                </p>
              </div>
            )}
            {/* Info note */}
            {!bulkAiRunning && (
              <p className="text-xs text-muted-foreground">{t("lp_bulk_ai_note")}</p>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowBulkAiDialog(false)} disabled={bulkAiRunning}>
              {t("lp_cancel")}
            </Button>
            <Button
              disabled={!bulkAiCalendarId || bulkAiRunning}
              onClick={async () => {
                if (!bulkAiCalendarId) return;
                setBulkAiRunning(true);
                setBulkAiProgress(null);
                try {
                  // Client-side batching: call the procedure repeatedly until all plans are created
                  const BATCH_SIZE = 8;
                  let offset = 0;
                  let totalCreated = 0;
                  let topicOutlineJson: string | null | undefined = undefined;
                  let totalSlots = 0;

                  while (true) {
                    const result = await utils.client.planner.generateBulkLessonPlans.mutate({
                      calendarId: Number(bulkAiCalendarId),
                      scope: bulkAiScope,
                      methodology: bulkAiMethodology || undefined,
                      batchOffset: offset,
                      batchSize: BATCH_SIZE,
                      topicOutlineJson: topicOutlineJson ?? undefined,
                    });

                    totalCreated += result.created;
                    totalSlots = result.total;
                    offset = result.nextOffset ?? offset + BATCH_SIZE;

                    // Save the outline JSON from the first batch for subsequent batches
                    if (topicOutlineJson === undefined && result.topicOutlineJson) {
                      topicOutlineJson = result.topicOutlineJson;
                    }

                    // Update progress indicator
                    setBulkAiProgress({ current: offset, total: totalSlots });

                    // Refresh the plan list after each batch so the user sees plans appearing
                    utils.planner.listLessonPlans.invalidate();

                    if ((result.totalRemaining ?? 0) <= 0) break;
                  }

                  setShowBulkAiDialog(false);
                  setBulkAiRunning(false);
                  setBulkAiProgress(null);
                  utils.planner.listLessonPlans.invalidate();
                  setLastGeneratedCalendarId(Number(bulkAiCalendarId));
                  setAiGeneratedBanner(true);
                  setTimeout(() => setAiGeneratedBanner(false), 15000);
                  if (totalCreated === 0) {
                    toast.info(t("lp_bulk_ai_none"));
                  } else {
                    toast.success(t("lp_bulk_ai_done").replace("{{count}}", String(totalCreated)));
                  }
                } catch (e: any) {
                  setBulkAiRunning(false);
                  setBulkAiProgress(null);
                  const isAbort = e?.name === "AbortError" || (typeof e?.message === "string" && e.message.toLowerCase().includes("abort"));
                  if (!isAbort) {
                    toast.error(e?.message ?? t("lp_bulk_ai_error"));
                  } else {
                    toast.info(t("lp_bulk_ai_creating"));
                  }
                }
              }}
              className="gap-1.5 bg-purple-600 hover:bg-purple-700 text-white"
            >
              <SebaSymbol className="w-4 h-4" />
              {bulkAiRunning ? t("lp_bulk_ai_generating") : t("lp_bulk_ai_start")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
