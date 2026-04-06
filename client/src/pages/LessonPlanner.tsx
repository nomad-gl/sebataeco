import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Plus, Sparkles, Trash2, Printer, BookOpen, ChevronDown, ChevronUp, Save, FileText } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { useEffect } from "react";

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

const emptyForm = (): LessonFormState => ({
  title: "",
  unit: "",
  lessonNumber: "",
  academicYear: ACADEMIC_YEARS[1],
  duration: 60,
  yearGroup: YEAR_GROUPS[3],
  subject: "English",
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
});

function parseJsonField<T>(val: string | null | undefined, fallback: T): T {
  if (!val) return fallback;
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
function buildPrintHtml(form: LessonFormState, logoDataUrl?: string): string {
  const schoolLogo = logoDataUrl ? `<img src="${logoDataUrl}" style="float:right;max-height:56px;max-width:120px;object-fit:contain;" alt="School logo"/>` : "";
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
<title>Lesson Plan — ${form.title}</title>
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
  <h1>${form.title || "Lesson Plan"}</h1>
  <div style="color:#64748b;font-size:11px;">Unit ${form.unit || "—"} · Lesson ${form.lessonNumber || "—"} · ${form.academicYear}</div>
  <div style="margin-top:6px;">${competencyBadges}</div>
</div>

<div class="meta">
  <div class="meta-item"><div class="meta-label">Year Group</div><div class="meta-value">${form.yearGroup}</div></div>
  <div class="meta-item"><div class="meta-label">Subject</div><div class="meta-value">${form.subject}</div></div>
  <div class="meta-item"><div class="meta-label">Duration</div><div class="meta-value">${form.duration} min</div></div>
  <div class="meta-item"><div class="meta-label">Skills</div><div class="meta-value">${skillsList || "—"}</div></div>
  <div class="meta-item"><div class="meta-label">Language Systems</div><div class="meta-value">${systemsList || "—"}</div></div>
  <div class="meta-item"><div class="meta-label">Spaces</div><div class="meta-value">${form.spaces}</div></div>
</div>

<h2>Specific Competences</h2>
<p>${form.specificCompetences.filter(Boolean).join(", ") || "—"}</p>

<h2>Saberes Básicos</h2>
<ul>${form.saberesBasicos.filter(Boolean).map(s => `<li>${s}</li>`).join("") || "<li>—</li>"}</ul>

<h2>Learning Outcomes</h2>
<ul>${form.learningOutcomes.filter(Boolean).map(s => `<li>${s}</li>`).join("") || "<li>—</li>"}</ul>

<h2>Evaluation Criteria</h2>
<ul>${form.evaluationCriteria.filter(Boolean).map(s => `<li>${s}</li>`).join("") || "<li>—</li>"}</ul>

<h2>Previous Knowledge</h2>
<p>${form.previousKnowledge || "—"}</p>

<h2>Materials</h2>
<p>${form.materials || "—"}</p>

<h2>Lesson Procedure</h2>
<table>
  <thead><tr><th>Timing</th><th>Stage</th><th>Activities</th><th>Grouping</th></tr></thead>
  <tbody>${procedureRows}</tbody>
</table>

<div class="footer">Generated by SEBA AI Studio · ${new Date().toLocaleDateString()}</div>
</body></html>`;
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function LessonPlanner() {
  const [selectedId, setSelectedId] = useState<number | null>(null);
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
  const [printFormat, setPrintFormat] = useState<"a4" | "a5" | "letter">("a4");
  const [isDirty, setIsDirty] = useState(false);
  const utils = trpc.useUtils();

  // Show a toast when arriving from the calendar
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("title")) {
      toast.success("Pre-filled from calendar event");
      // Clean URL without reloading
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const { data: plans = [] } = trpc.planner.listLessonPlans.useQuery();

  const saveMutation = trpc.planner.saveLessonPlan.useMutation({
    onSuccess: (data) => {
      utils.planner.listLessonPlans.invalidate();
      setSelectedId(data.id);
      setIsDirty(false);
      toast.success("Lesson plan saved");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.planner.deleteLessonPlan.useMutation({
    onSuccess: () => {
      utils.planner.listLessonPlans.invalidate();
      setSelectedId(null);
      setForm(emptyForm());
      toast.success("Lesson plan deleted");
    },
    onError: (e) => toast.error(e.message),
  });

  const aiMutation = trpc.planner.aiGenerateLessonPlan.useMutation({
    onSuccess: (data) => {
      utils.planner.listLessonPlans.invalidate();
      setSelectedId(data.id);
      // Reload the plan from server
      utils.planner.getLessonPlan.fetch({ id: data.id }).then(plan => {
        if (plan) setForm(planToForm(plan));
      });
      setShowAiDialog(false);
      setIsDirty(false);
      toast.success("Lesson plan generated!");
    },
    onError: (e) => toast.error(e.message),
  });

  const setField = <K extends keyof LessonFormState>(key: K, value: LessonFormState[K]) => {
    setForm(f => ({ ...f, [key]: value }));
    setIsDirty(true);
  };

  const loadPlan = (plan: any) => {
    setSelectedId(plan.id);
    setForm(planToForm(plan));
    setIsDirty(false);
  };

  const newPlan = () => {
    setSelectedId(null);
    setForm(emptyForm());
    setIsDirty(false);
  };

  const handleSave = () => {
    if (!form.title.trim()) { toast.error("Title is required"); return; }
    saveMutation.mutate({ id: selectedId ?? undefined, ...formToSave(form) });
  };

  const handlePrint = () => {
    const logo = localStorage.getItem("seba_school_logo") ?? undefined;
    const html = buildPrintHtml(form, logo);
    const win = window.open("", "_blank");
    if (!win) { toast.error("Please allow popups to print"); return; }
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 600);
    setShowPrintDialog(false);
  };

  // AI dialog state
  const [aiTitle, setAiTitle] = useState("");
  const [aiSubject, setAiSubject] = useState("English");
  const [aiYearGroup, setAiYearGroup] = useState(YEAR_GROUPS[3]);
  const [aiDuration, setAiDuration] = useState(60);
  const [aiComps, setAiComps] = useState<string[]>([]);

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

  return (
    <DashboardLayout>
      <div className="flex h-[calc(100vh-64px)] overflow-hidden">
        {/* Sidebar — saved plans */}
        <aside className="w-64 border-r flex flex-col shrink-0 overflow-hidden">
          <div className="p-3 border-b flex items-center justify-between">
            <span className="font-semibold text-sm">Lesson Plans</span>
            <Button size="sm" variant="ghost" onClick={newPlan}><Plus className="w-4 h-4" /></Button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {plans.length === 0 && <p className="text-xs text-muted-foreground p-2">No plans yet. Create one!</p>}
            {plans.map((p: any) => (
              <button
                key={p.id}
                onClick={() => loadPlan(p)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-accent transition-colors ${selectedId === p.id ? "bg-accent font-medium" : ""}`}
              >
                <div className="truncate">{p.title || "Untitled"}</div>
                <div className="text-xs text-muted-foreground truncate">{p.subject} · {p.yearGroup}</div>
              </button>
            ))}
          </div>
          <div className="p-2 border-t">
            <Button size="sm" className="w-full gap-1" onClick={() => setShowAiDialog(true)}>
              <Sparkles className="w-3 h-3" /> Generate with AI
            </Button>
          </div>
        </aside>

        {/* Main editor */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Toolbar */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-primary" />
              <h1 className="text-xl font-bold">Lesson Plan Editor</h1>
              {isDirty && <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">Unsaved</Badge>}
            </div>
            <div className="flex gap-2">
              {selectedId && (
                <Button variant="outline" size="sm" onClick={() => deleteMutation.mutate({ id: selectedId })} className="text-red-600 hover:text-red-700">
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => setShowPrintDialog(true)} className="gap-1">
                <Printer className="w-4 h-4" /> Print / PDF
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saveMutation.isPending} className="gap-1">
                <Save className="w-4 h-4" />
                {saveMutation.isPending ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>

          {/* Section 1: Header info */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground uppercase tracking-wide">Lesson Information</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Lesson Title *</Label>
                <Input value={form.title} onChange={e => setField("title", e.target.value)} placeholder="e.g. Present Perfect for Experiences" />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <Label>Unit</Label>
                  <Input value={form.unit} onChange={e => setField("unit", e.target.value)} placeholder="e.g. 3" />
                </div>
                <div>
                  <Label>Lesson No.</Label>
                  <Input value={form.lessonNumber} onChange={e => setField("lessonNumber", e.target.value)} placeholder="e.g. 2" />
                </div>
                <div>
                  <Label>Academic Year</Label>
                  <Select value={form.academicYear} onValueChange={v => setField("academicYear", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{ACADEMIC_YEARS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Duration (min)</Label>
                  <Input type="number" value={form.duration} onChange={e => setField("duration", Number(e.target.value))} min={15} max={180} step={5} />
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div>
                  <Label>Year Group</Label>
                  <Select value={form.yearGroup} onValueChange={v => setField("yearGroup", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{YEAR_GROUPS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Subject</Label>
                  <Select value={form.subject} onValueChange={v => setField("subject", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{SUBJECTS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Spaces</Label>
                  <Input value={form.spaces} onChange={e => setField("spaces", e.target.value)} placeholder="Classroom, Lab…" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section 2: Skills & Systems */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground uppercase tracking-wide">Skills & Language Systems</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="mb-2 block">Skills</Label>
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
                <Label className="mb-2 block">Language Systems</Label>
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
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground uppercase tracking-wide">LOMLOE Competencies</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="mb-2 block">Key Competencies</Label>
                <div className="flex flex-wrap gap-2">
                  {COMPETENCIES.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setField("competencies", form.competencies.includes(c) ? form.competencies.filter(x => x !== c) : [...form.competencies, c])}
                      className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${form.competencies.includes(c) ? "bg-teal-600 text-white border-teal-600" : "bg-background border-border hover:bg-accent"}`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label className="mb-2 block">Specific Competences (e.g. CCL-1, CCL-2)</Label>
                {form.specificCompetences.map((v, i) => (
                  <div key={i} className="flex gap-2 mb-2">
                    <Input value={v} onChange={e => updateListItem("specificCompetences", i, e.target.value)} placeholder="e.g. CCL-1" />
                    <Button variant="ghost" size="icon" onClick={() => removeListItem("specificCompetences", i)}><Trash2 className="w-4 h-4 text-red-400" /></Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => addListItem("specificCompetences")}><Plus className="w-3 h-3 mr-1" /> Add</Button>
              </div>
            </CardContent>
          </Card>

          {/* Section 4: Curriculum */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground uppercase tracking-wide">Curriculum Content</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="mb-2 block">Saberes Básicos</Label>
                {form.saberesBasicos.map((v, i) => (
                  <div key={i} className="flex gap-2 mb-2">
                    <Input value={v} onChange={e => updateListItem("saberesBasicos", i, e.target.value)} placeholder="Basic knowledge item" />
                    <Button variant="ghost" size="icon" onClick={() => removeListItem("saberesBasicos", i)}><Trash2 className="w-4 h-4 text-red-400" /></Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => addListItem("saberesBasicos")}><Plus className="w-3 h-3 mr-1" /> Add</Button>
              </div>
              <Separator />
              <div>
                <Label className="mb-2 block">Learning Outcomes</Label>
                {form.learningOutcomes.map((v, i) => (
                  <div key={i} className="flex gap-2 mb-2">
                    <Input value={v} onChange={e => updateListItem("learningOutcomes", i, e.target.value)} placeholder="Students will be able to…" />
                    <Button variant="ghost" size="icon" onClick={() => removeListItem("learningOutcomes", i)}><Trash2 className="w-4 h-4 text-red-400" /></Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => addListItem("learningOutcomes")}><Plus className="w-3 h-3 mr-1" /> Add</Button>
              </div>
              <Separator />
              <div>
                <Label className="mb-2 block">Evaluation Criteria</Label>
                {form.evaluationCriteria.map((v, i) => (
                  <div key={i} className="flex gap-2 mb-2">
                    <Input value={v} onChange={e => updateListItem("evaluationCriteria", i, e.target.value)} placeholder="Students demonstrate…" />
                    <Button variant="ghost" size="icon" onClick={() => removeListItem("evaluationCriteria", i)}><Trash2 className="w-4 h-4 text-red-400" /></Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => addListItem("evaluationCriteria")}><Plus className="w-3 h-3 mr-1" /> Add</Button>
              </div>
            </CardContent>
          </Card>

          {/* Section 5: Context */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground uppercase tracking-wide">Context & Resources</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Previous Knowledge</Label>
                <Textarea value={form.previousKnowledge} onChange={e => setField("previousKnowledge", e.target.value)} rows={2} placeholder="What students already know…" />
              </div>
              <div>
                <Label>Materials & Resources</Label>
                <Textarea value={form.materials} onChange={e => setField("materials", e.target.value)} rows={2} placeholder="Textbook, worksheets, projector…" />
              </div>
            </CardContent>
          </Card>

          {/* Section 6: Procedure */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground uppercase tracking-wide">Lesson Procedure</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground px-1">
                <span className="col-span-2">Timing</span>
                <span className="col-span-2">Stage</span>
                <span className="col-span-6">Activities</span>
                <span className="col-span-2">Grouping</span>
              </div>
              {form.procedures.map((p, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-start">
                  <Input className="col-span-2" value={p.timing} onChange={e => updateProcedure(i, "timing", e.target.value)} placeholder="10 min" />
                  <Input className="col-span-2" value={p.stage} onChange={e => updateProcedure(i, "stage", e.target.value)} placeholder="Warm-up" />
                  <Textarea className="col-span-6 min-h-[60px]" value={p.activities} onChange={e => updateProcedure(i, "activities", e.target.value)} placeholder="Describe activities…" />
                  <Input className="col-span-1" value={p.grouping} onChange={e => updateProcedure(i, "grouping", e.target.value)} placeholder="Pairs" />
                  <Button variant="ghost" size="icon" className="col-span-1" onClick={() => removeProcedure(i)}><Trash2 className="w-4 h-4 text-red-400" /></Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addProcedure}><Plus className="w-3 h-3 mr-1" /> Add Stage</Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* AI Generate Dialog */}
      <Dialog open={showAiDialog} onOpenChange={setShowAiDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Sparkles className="w-5 h-5 text-teal-500" /> Generate Lesson Plan with AI</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Lesson Title *</Label>
              <Input value={aiTitle} onChange={e => setAiTitle(e.target.value)} placeholder="e.g. Present Perfect for Experiences" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Subject</Label>
                <Select value={aiSubject} onValueChange={setAiSubject}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{SUBJECTS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Year Group</Label>
                <Select value={aiYearGroup} onValueChange={setAiYearGroup}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{YEAR_GROUPS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Duration (min)</Label>
              <Input type="number" value={aiDuration} onChange={e => setAiDuration(Number(e.target.value))} min={15} max={180} step={5} />
            </div>
            <div>
              <Label className="mb-2 block">Focus Competencies (optional)</Label>
              <div className="flex flex-wrap gap-2">
                {COMPETENCIES.map(c => (
                  <button key={c} type="button" onClick={() => toggleComp(c)}
                    className={`px-2 py-0.5 rounded-full text-xs font-medium border transition-colors ${aiComps.includes(c) ? "bg-teal-600 text-white border-teal-600" : "bg-background border-border hover:bg-accent"}`}>
                    {c}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAiDialog(false)}>Cancel</Button>
            <Button onClick={() => { if (!aiTitle.trim()) { toast.error("Title is required"); return; } aiMutation.mutate({ title: aiTitle, subject: aiSubject, yearGroup: aiYearGroup, duration: aiDuration, competencies: aiComps }); }} disabled={aiMutation.isPending} className="gap-1">
              <Sparkles className="w-4 h-4" />
              {aiMutation.isPending ? "Generating…" : "Generate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Print Dialog */}
      <Dialog open={showPrintDialog} onOpenChange={setShowPrintDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Printer className="w-5 h-5" /> Print / Save as PDF</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Paper Format</Label>
              <Select value={printFormat} onValueChange={v => setPrintFormat(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="a4">A4 (210 × 297 mm)</SelectItem>
                  <SelectItem value="a5">A5 (148 × 210 mm)</SelectItem>
                  <SelectItem value="letter">US Letter (8.5 × 11 in)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-sm text-muted-foreground">A print preview will open in a new tab. Select your printer or choose <strong>Save as PDF</strong> in the destination dropdown.</p>
            <p className="text-xs text-muted-foreground">Your school logo (if uploaded on the Reports page) will appear in the top-right corner.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPrintDialog(false)}>Cancel</Button>
            <Button onClick={handlePrint} className="gap-1"><Printer className="w-4 h-4" /> Open Print Preview</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
