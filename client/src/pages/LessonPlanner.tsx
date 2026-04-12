import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { toast } from "sonner";
import { Plus, Sparkles, Trash2, Printer, BookOpen, Save, List, X, Copy, LayoutTemplate, FolderOpen, FileDown, ArrowUpDown, ArrowUp01, CalendarDays } from "lucide-react";
import { useLocation } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";
import LogoUploader from "@/components/LogoUploader";
import { useI18n } from "@/contexts/I18nContext";
import { useIsMobile } from "@/hooks/useMobile";
import { exportToCsv, exportToXml } from "@/lib/exportUtils";
import ExportDropdown, { PrintIcon, CsvIcon, XmlIcon } from "@/components/ExportDropdown";

const COMPETENCIES = ["CCL", "CP", "STEM", "CD", "CPSAA", "CC", "CE", "CCEC"];
const YEAR_GROUPS = ["1st Primary", "2nd Primary", "3rd Primary", "4th Primary", "5th Primary", "6th Primary", "1st Secondary", "2nd Secondary", "3rd Secondary", "4th Secondary"];
const SUBJECTS = ["English", "Maths", "Science", "Social Studies", "Art", "PE", "Music", "Technology", "Spanish", "Catalan"];
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
    competencies: parseJsonField(plan.competencies, []),
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

<div class="footer">${L.lp_generated_by ?? 'Generated by AINA | TA'} · ${new Date().toLocaleDateString()}</div>
</body></html>`;
}

// ─── Saved Plans List (shared between sidebar and sheet) ───────────────────────
function PlansList({ plans, calendars, selectedId, onLoad, onNew, onAi, onDuplicate, onDelete, onJumpToCalendar, batchSelectMode, setBatchSelectMode, selectedPlanIds, setSelectedPlanIds, onBatchDelete, t }: {
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
  t: (k: any) => string;
}) {
  const [sortByLesson, setSortByLesson] = useState(() => {
    try { return localStorage.getItem("seba_planner_sort_by_lesson") === "1"; } catch { return false; }
  });
  const [calendarFilter, setCalendarFilter] = useState<string>("all");
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
  const filteredPlans = calendarFilter === "all"
    ? plans
    : calendarFilter === "unlinked"
      ? plans.filter((p: any) => !p.calendarId)
      : plans.filter((p: any) => String(p.calendarId) === calendarFilter);
  const sortedPlans = sortByLesson
    ? [...filteredPlans].sort((a, b) => {
        const na = a.lessonNumber ? Number(a.lessonNumber) : Infinity;
        const nb = b.lessonNumber ? Number(b.lessonNumber) : Infinity;
        return na - nb;
      })
    : filteredPlans;
  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b flex items-center justify-between shrink-0 gap-1">
        <span className="font-semibold text-sm">{t("lp_lesson_plans")}</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setSortByLesson(v => { const next = !v; try { localStorage.setItem("seba_planner_sort_by_lesson", next ? "1" : "0"); } catch {} return next; })}
            title={sortByLesson ? "Sorted by lesson number" : "Sort by lesson number"}
            className={`p-1 rounded hover:bg-accent transition-colors ${sortByLesson ? "text-teal-600 bg-teal-50" : "text-muted-foreground"}`}
          >
            {sortByLesson ? <ArrowUp01 className="w-3.5 h-3.5" /> : <ArrowUpDown className="w-3.5 h-3.5" />}
          </button>
          {batchSelectMode ? (
            <>
              <Button size="sm" variant="ghost" className="text-xs px-2" onClick={() => { setBatchSelectMode(false); setSelectedPlanIds(new Set()); }}
              ><X className="w-3 h-3" /></Button>
              {selectedPlanIds.size > 0 && (
                <Button size="sm" variant="destructive" className="text-xs px-2 gap-1" onClick={onBatchDelete}>
                  <Trash2 className="w-3 h-3" />{selectedPlanIds.size}
                </Button>
              )}
            </>
          ) : (
            <>
              <Button size="sm" variant="ghost" title="Select multiple" onClick={() => setBatchSelectMode(true)}><Checkbox className="w-3.5 h-3.5 pointer-events-none" /></Button>
              <Button size="sm" variant="ghost" onClick={onNew}><Plus className="w-4 h-4" /></Button>
            </>
          )}
        </div>
      </div>
      {batchSelectMode && plans.length > 0 && (
        <div className="px-3 py-1.5 border-b flex items-center gap-2 text-xs text-muted-foreground">
          <Checkbox checked={allSelected} onCheckedChange={toggleAll} id="select-all-plans" />
          <label htmlFor="select-all-plans" className="cursor-pointer">Select all</label>
        </div>
      )}
      {calendars.length > 0 && (
        <div className="px-2 py-1.5 border-b shrink-0">
          <select
            value={calendarFilter}
            onChange={e => setCalendarFilter(e.target.value)}
            className="w-full text-xs rounded border border-input bg-background px-2 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            title="Filter by calendar"
          >
            <option value="all">All calendars</option>
            {calendars.map((c: any) => (
              <option key={c.id} value={String(c.id)}>{c.name}</option>
            ))}
            <option value="unlinked">Unlinked plans</option>
          </select>
        </div>
      )}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {sortedPlans.length === 0 && <p className="text-xs text-muted-foreground p-2">{t("lp_no_plans")}</p>}
        {sortedPlans.map((p: any) => (
          <div key={p.id} className="group relative">
            {batchSelectMode && (
              <Checkbox
                checked={selectedPlanIds.has(p.id)}
                onCheckedChange={() => toggleSelect(p.id)}
                className="absolute left-2 top-1/2 -translate-y-1/2 z-10"
              />
            )}
            <button
              onClick={() => batchSelectMode ? toggleSelect(p.id) : onLoad(p)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-accent transition-colors ${batchSelectMode ? "pl-8" : ""} ${!batchSelectMode ? "pr-16" : "pr-8"} ${selectedId === p.id && !batchSelectMode ? "bg-accent font-medium" : ""} ${batchSelectMode && selectedPlanIds.has(p.id) ? "bg-accent/50" : ""}`}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                {p.lessonNumber && (
                  <span className="shrink-0 inline-flex items-center justify-center rounded-full bg-teal-100 text-teal-700 text-[10px] font-bold px-1.5 py-0.5 leading-none">
                    L{p.lessonNumber}
                  </span>
                )}
                <span className="truncate flex-1">{p.title || t("lp_untitled")}</span>
                {p.duration && p.duration !== 60 && (
                  <span className="shrink-0 text-[10px] font-mono text-muted-foreground bg-muted px-1 py-0.5 rounded">{p.duration}m</span>
                )}
              </div>
              <div className="text-xs text-muted-foreground truncate">{p.subject} · {p.yearGroup}{p.sessionTime ? ` · ${p.sessionTime}` : ""}</div>
            </button>
            {!batchSelectMode && (
              <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                {p.calendarEventId && p.calendarId && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onJumpToCalendar(p.calendarEventId, p.calendarId); }}
                    title="Jump to calendar event"
                    className="p-1 rounded hover:bg-teal-50 hover:text-teal-700"
                  >
                    <CalendarDays className="w-3.5 h-3.5 text-teal-600" />
                  </button>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); onDuplicate(p); }}
                  title={t("planner_duplicate")}
                  className="p-1 rounded hover:bg-muted"
                >
                  <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(p.id); }}
                  title={t("lp_delete_plan")}
                  className="p-1 rounded hover:bg-destructive/10"
                >
                  <Trash2 className="w-3.5 h-3.5 text-destructive" />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="p-2 border-t shrink-0">
        <Button size="sm" className="w-full gap-1" onClick={onAi}>
          <Sparkles className="w-3 h-3" /> {t("lp_generate_ai")}
        </Button>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function LessonPlanner() {
  const { t } = useI18n();
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

  const duplicateMutation = trpc.planner.saveLessonPlan.useMutation({
    onSuccess: (data) => {
      utils.planner.listLessonPlans.invalidate();
      setSelectedId(data.id);
      toast.success(t("planner_duplicated"));
    },
    onError: (e) => toast.error(e.message),
  });

  const handleDuplicate = (plan: any) => {
    const f = planToForm(plan);
    duplicateMutation.mutate({
      ...f,
      title: f.title ? `${f.title} (${t("lp_copy_suffix")})` : t("lp_copy_suffix"),
      skills: JSON.stringify(f.skills),
      systems: JSON.stringify(f.systems),
      specificCompetences: JSON.stringify(f.specificCompetences),
      saberesBasicos: JSON.stringify(f.saberesBasicos),
      learningOutcomes: JSON.stringify(f.learningOutcomes),
      evaluationCriteria: JSON.stringify(f.evaluationCriteria),
      procedures: JSON.stringify(f.procedures),
      competencies: JSON.stringify(f.competencies),
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
      // Also invalidate the cache and re-fetch to get the fully-saved DB row
      await utils.planner.getLessonPlan.invalidate({ id: data.id });
      utils.planner.getLessonPlan.fetch({ id: data.id }).then(plan => {
        if (plan) setForm(planToForm(plan));
      });
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
          toast.warning(t("lp_generated_toast") + " (calendar link failed)");
        }
      } else {
        toast.success(t("lp_generated_toast"));
      }
    },
    onError: (e) => toast.error(e.message),
  });

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
    setForm(emptyForm());
    setIsDirty(false);
    setSheetOpen(false);
  };

  const handleSave = () => {
    if (!form.title.trim()) { toast.error(t("lp_title_required")); return; }
    saveMutation.mutate({ id: selectedId ?? undefined, ...formToSave(form) });
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
  const [showExportAllDialog, setShowExportAllDialog] = useState(false);
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
      t={t}
    />
  );

  return (
    <DashboardLayout>
      {/* ── Layout shell: sidebar on desktop, sheet on mobile ── */}
      <div className="flex h-[calc(100vh-64px)] overflow-hidden">

        {/* Desktop sidebar */}
        {!isMobile && (
          <aside className="w-64 border-r flex flex-col shrink-0 overflow-hidden">
            {plansList}
          </aside>
        )}

        {/* Main editor */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 sm:p-6 space-y-5 max-w-3xl mx-auto">

            {/* Toolbar */}
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                {/* Mobile: plans sheet trigger */}
                {isMobile && (
                  <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                    <SheetTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-1.5">
                        <List className="w-4 h-4" />
                        {t("lp_lesson_plans")}
                        {plans.length > 0 && (
                          <Badge variant="secondary" className="text-xs ml-0.5">{plans.length}</Badge>
                        )}
                      </Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="w-72 p-0 flex flex-col">
                      <SheetHeader className="sr-only">
                        <SheetTitle>{t("lp_lesson_plans")}</SheetTitle>
                      </SheetHeader>
                      <div className="flex-1 overflow-hidden">
                        {plansList}
                      </div>
                    </SheetContent>
                  </Sheet>
                )}
                <div className="flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-primary" />
                  <h1 className="text-lg sm:text-xl font-bold">{t("lp_title")}</h1>
                </div>
                {isDirty && <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">{t("lp_unsaved")}</Badge>}
              </div>
              <div className="flex gap-2 flex-wrap">
                {selectedId && (
                  <Button variant="outline" size="sm" onClick={() => deleteMutation.mutate({ id: selectedId })} className="text-red-600 hover:text-red-700">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => setShowLoadTemplateDialog(true)} className="gap-1" title={t("lp_load_template")}>
                  <FolderOpen className="w-4 h-4" />
                  <span className="hidden sm:inline">{t("lp_load_template")}</span>
                </Button>
                {selectedId && (
                  <Button variant="outline" size="sm" onClick={() => { setTemplateNameInput(form.title || ""); setShowSaveTemplateDialog(true); }} className="gap-1" title={t("lp_save_as_template")}>
                    <LayoutTemplate className="w-4 h-4" />
                    <span className="hidden sm:inline">{t("lp_save_as_template")}</span>
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => setShowPrintDialog(true)} className="gap-1">
                  <Printer className="w-4 h-4" />
                  <span className="hidden sm:inline">{t("lp_print_pdf")}</span>
                </Button>
                <Button variant="outline" size="sm" onClick={() => { setExportAllCalendarId(""); setShowExportAllDialog(true); }} className="gap-1" title={t("lp_export_all_plans")}>
                  <FileDown className="w-4 h-4" />
                  <span className="hidden sm:inline">{t("lp_export_all_plans")}</span>
                </Button>
                <Button size="sm" onClick={handleSave} disabled={saveMutation.isPending} className="gap-1">
                  <Save className="w-4 h-4" />
                  <span className="hidden sm:inline">{saveMutation.isPending ? t("lp_saving") : t("lp_save")}</span>
                  <span className="sm:hidden">{saveMutation.isPending ? "…" : t("lp_save")}</span>
                </Button>
              </div>
            </div>

            {/* Section 1: Header info */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground uppercase tracking-wide">{t("lp_section_info")}</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>{t("lp_lesson_title")}</Label>
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

            {/* Section 2: Skills & Systems */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground uppercase tracking-wide">{t("lp_section_skills")}</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="mb-2 block">{t("lp_skills")}</Label>
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
                  <Label className="mb-2 block">{t("lp_language_systems")}</Label>
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
                  <Label className="mb-2 block">{t("lp_specific_competences")}</Label>
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
                  <Label className="mb-2 block">{t("lp_saberes_basicos")}</Label>
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
                  <Label className="mb-2 block">{t("lp_learning_outcomes")}</Label>
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
                  <Label className="mb-2 block">{t("lp_evaluation_criteria")}</Label>
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
                  <Label>{t("lp_previous_knowledge")}</Label>
                  <Textarea value={form.previousKnowledge} onChange={e => setField("previousKnowledge", e.target.value)} rows={2} placeholder={t('lp_ph_prev_knowledge')} />
                </div>
                <div>
                  <Label>{t("lp_materials_resources")}</Label>
                  <Textarea value={form.materials} onChange={e => setField("materials", e.target.value)} rows={2} placeholder={t('lp_ph_materials')} />
                </div>
              </CardContent>
            </Card>

            {/* Section 6: Procedure */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground uppercase tracking-wide">{t("lp_section_procedure")}</CardTitle></CardHeader>
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
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Sparkles className="w-5 h-5 text-teal-500" /> {t("lp_ai_dialog_title")}</DialogTitle></DialogHeader>
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
                  <Label>{t("lp_calendar") ?? "Calendar"}</Label>
                  <Select value={aiCalendarId} onValueChange={setAiCalendarId}>
                    <SelectTrigger>
                      <SelectValue placeholder={t("lp_select_calendar") ?? "Select a calendar…"} />
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
                    <p className="text-xs text-muted-foreground mt-1">{t("lp_no_calendars") ?? "No calendars yet — create one in School Calendar first."}</p>
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
            <Button onClick={() => {
              if (!aiTitle.trim()) { toast.error(t("lp_title_required")); return; }
              if (aiDate && !aiCalendarId && (calendars as any[]).length > 0) { toast.error(t("lp_select_calendar") ?? "Please select a calendar to add to."); return; }
              // Build the existing-fields snapshot from the current form (if a plan is loaded)
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
              });
            }} disabled={aiMutation.isPending} className="gap-1">
              <Sparkles className="w-4 h-4" />
              {aiMutation.isPending ? t("lp_generating") : t("lp_generate")}
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
                  <SelectItem value="letter">US Letter (8.5 × 11 in)</SelectItem>
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
    </DashboardLayout>
  );
}
