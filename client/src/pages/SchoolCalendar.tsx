import { useState, useMemo, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Plus, Sparkles, Trash2, CalendarDays,
  ExternalLink, LayoutList, Pencil, School, BookOpen, User, GraduationCap,
  FolderOpen, X, Check, Download, Link, Unlink, Users, Save, ClipboardList,
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { useLocation } from "wouter";
import { useI18n } from "@/contexts/I18nContext";
import { loadSchoolProfile } from "@/pages/Settings";

const CURRENT_YEAR = new Date().getFullYear();
const ACADEMIC_YEARS = [`${CURRENT_YEAR - 1}-${CURRENT_YEAR}`, `${CURRENT_YEAR}-${CURRENT_YEAR + 1}`, `${CURRENT_YEAR + 1}-${CURRENT_YEAR + 2}`];

const EVENT_COLORS: Record<string, string> = {
  holiday: "bg-red-100 text-red-800 border-red-200",
  special: "bg-purple-100 text-purple-800 border-purple-200",
  exam: "bg-orange-100 text-orange-800 border-orange-200",
  excursion: "bg-yellow-100 text-yellow-800 border-yellow-200",
  event: "bg-blue-100 text-blue-800 border-blue-200",
  lesson: "bg-green-100 text-green-800 border-green-200",
  ai_generated: "bg-teal-100 text-teal-800 border-teal-200",
};

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const COMPETENCIES = ["CCL", "CP", "STEM", "CD", "CPSAA", "CC", "CE", "CCEC"];
const YEAR_GROUPS = ["1st Primary", "2nd Primary", "3rd Primary", "4th Primary", "5th Primary", "6th Primary", "1st Secondary", "2nd Secondary", "3rd Secondary", "4th Secondary"];
const SUBJECTS = ["English", "Maths", "Science", "Social Studies", "Art", "PE", "Music", "Technology", "Spanish", "Catalan"];

type CalEvent = {
  id: number;
  eventDate: Date | string;
  eventType: string;
  title: string;
  description?: string | null;
  competency?: string | null;
  yearGroup?: string | null;
  subject?: string | null;
  aiGenerated: boolean;
};

type SchoolCalendar = {
  id: number;
  name: string;
  schoolName?: string | null;
  tutorName?: string | null;
  subject?: string | null;
  yearLevel?: string | null;
  academicYear: string;
  calendarType?: "full_year" | "topic_block";
  startDate?: Date | string | null;
  endDate?: Date | string | null;
  topicDescription?: string | null;
  linkedGroupId?: number | null;
};

/**
 * Derive sensible Spanish school term defaults from an academicYear string like "2025-2026".
 * Term 1: Sep–Dec of start year, Term 2: Jan–Mar of end year, Term 3: Apr–Jun of end year.
 */
const getDefaultTermsForYear = (academicYear: string) => {
  const parts = academicYear.split("-");
  const y1 = parseInt(parts[0], 10) || CURRENT_YEAR;
  const y2 = parseInt(parts[1], 10) || (y1 + 1);
  return [
    { label: "Term 1", start: `${y1}-09-09`, end: `${y1}-12-20` },
    { label: "Term 2", start: `${y2}-01-08`, end: `${y2}-03-28` },
    { label: "Term 3", start: `${y2}-04-07`, end: `${y2}-06-20` },
  ];
};

const DEFAULT_TERMS = getDefaultTermsForYear(ACADEMIC_YEARS[1]);

// ─── Lesson Plan Form Types (mirrored from LessonPlanner) ────────────────────
const LP_SKILL_KEYS = ["listening", "speaking", "reading", "writing"] as const;
const LP_SYSTEM_KEYS = ["grammar", "phonology", "lexis", "function", "discourse"] as const;
type LPProcedure = { timing: string; stage: string; activities: string; grouping: string };
type LessonFormState = {
  title: string; unit: string; lessonNumber: string; academicYear: string;
  duration: number; yearGroup: string; subject: string;
  skills: Record<string, boolean>; systems: Record<string, boolean>;
  specificCompetences: string[]; saberesBasicos: string[];
  learningOutcomes: string[]; evaluationCriteria: string[];
  previousKnowledge: string; materials: string; spaces: string;
  procedures: LPProcedure[]; competencies: string[];
};
function parseJsonField<T>(val: string | null | undefined, fallback: T): T {
  if (!val) return fallback;
  try { return JSON.parse(val) as T; } catch { return fallback; }
}
function planToLessonForm(plan: any): LessonFormState {
  return {
    title: plan.title ?? "", unit: plan.unit ?? "", lessonNumber: plan.lessonNumber ?? "",
    academicYear: plan.academicYear ?? ACADEMIC_YEARS[1], duration: plan.duration ?? 60,
    yearGroup: plan.yearGroup ?? YEAR_GROUPS[3], subject: plan.subject ?? "English",
    skills: parseJsonField(plan.skills, { listening: false, speaking: false, reading: false, writing: false }),
    systems: parseJsonField(plan.systems, { grammar: false, phonology: false, lexis: false, function: false, discourse: false }),
    specificCompetences: parseJsonField(plan.specificCompetences, []),
    saberesBasicos: parseJsonField(plan.saberesBasicos, [""]),
    learningOutcomes: parseJsonField(plan.learningOutcomes, [""]),
    evaluationCriteria: parseJsonField(plan.evaluationCriteria, [""]),
    previousKnowledge: plan.previousKnowledge ?? "", materials: plan.materials ?? "",
    spaces: plan.spaces ?? "Classroom",
    procedures: parseJsonField(plan.procedures, [{ timing: "10 min", stage: "Warm-up", activities: "", grouping: "Whole class" }]),
    competencies: parseJsonField(plan.competencies, []),
  };
}
function lessonFormToSave(form: LessonFormState) {
  return {
    ...form,
    skills: JSON.stringify(form.skills), systems: JSON.stringify(form.systems),
    specificCompetences: JSON.stringify(form.specificCompetences),
    saberesBasicos: JSON.stringify(form.saberesBasicos),
    learningOutcomes: JSON.stringify(form.learningOutcomes),
    evaluationCriteria: JSON.stringify(form.evaluationCriteria),
    procedures: JSON.stringify(form.procedures),
    competencies: JSON.stringify(form.competencies),
  };
}
function emptyLessonForm(overrides?: Partial<LessonFormState>): LessonFormState {
  return {
    title: "", unit: "", lessonNumber: "", academicYear: ACADEMIC_YEARS[1],
    duration: 60, yearGroup: YEAR_GROUPS[3], subject: "English",
    skills: { listening: false, speaking: false, reading: false, writing: false },
    systems: { grammar: false, phonology: false, lexis: false, function: false, discourse: false },
    specificCompetences: [], saberesBasicos: [""], learningOutcomes: [""],
    evaluationCriteria: [""], previousKnowledge: "", materials: "",
    spaces: "Classroom",
    procedures: [{ timing: "10 min", stage: "Warm-up", activities: "", grouping: "Whole class" }],
    competencies: [], ...overrides,
  };
}

const emptyCalForm = (academicYear = ACADEMIC_YEARS[1]) => {
  const profile = loadSchoolProfile();
  return {
    name: "",
    schoolName: profile.schoolName || "",
    tutorName: profile.defaultTutor || "",
    subject: profile.defaultSubject || "English",
    yearLevel: profile.defaultYear || YEAR_GROUPS[3],
    academicYear,
    calendarType: "full_year" as "full_year" | "topic_block",
    startDate: "",
    endDate: "",
    topicDescription: "",
  };
};

export default function SchoolCalendar() {
  const [, navigate] = useLocation();
  const { t } = useI18n();
  const [selectedCalendarId, setSelectedCalendarId] = useState<number | null>(null);
  const [viewMonth, setViewMonth] = useState(8);
  const [viewYear, setViewYear] = useState(CURRENT_YEAR);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showAiDialog, setShowAiDialog] = useState(false);
  const [showCreateCalDialog, setShowCreateCalDialog] = useState(false);
  const [showEditCalDialog, setShowEditCalDialog] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [editingEvent, setEditingEvent] = useState<CalEvent | null>(null);
  const [showTermView, setShowTermView] = useState(false);
  const [isPdfExporting, setIsPdfExporting] = useState(false);
  const [showLinkGroupDialog, setShowLinkGroupDialog] = useState(false);
  const [linkGroupId, setLinkGroupId] = useState<string>("");
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [agendaView, setAgendaView] = useState(false);

  // Calendar form
  const [calForm, setCalForm] = useState(emptyCalForm());

  // Event form
  const [form, setForm] = useState({ eventType: "lesson", title: "", description: "", competency: "", yearGroup: "", subject: "" });

  // AI infill form
  const [aiForm, setAiForm] = useState({ sessionsPerWeek: 3, terms: DEFAULT_TERMS });

  // ── Day Panel (click a calendar day to see/edit its events) ───────────────
  const [dayPanelDate, setDayPanelDate] = useState<string | null>(null);
  const [showDayPanel, setShowDayPanel] = useState(false);

  // ── Inline Lesson Plan Sheet ───────────────────────────────────────────────
  const [showPlanSheet, setShowPlanSheet] = useState(false);
  const [planSheetEventId, setPlanSheetEventId] = useState<number | null>(null);
  const [planSheetPlanId, setPlanSheetPlanId] = useState<number | null>(null);
  const [planForm, setPlanForm] = useState<LessonFormState>(emptyLessonForm());
  const [planFormDirty, setPlanFormDirty] = useState(false);

  const utils = trpc.useUtils();

  // ── Calendars ──────────────────────────────────────────────────────────────
  const { data: calendars = [] } = trpc.planner.listCalendars.useQuery();

  const selectedCalendar = useMemo(
    () => (calendars as SchoolCalendar[]).find(c => c.id === selectedCalendarId) ?? null,
    [calendars, selectedCalendarId],
  );

  // Auto-select first calendar when loaded
  useEffect(() => {
    if (selectedCalendarId === null && (calendars as SchoolCalendar[]).length > 0) {
      setSelectedCalendarId((calendars as SchoolCalendar[])[0].id);
    }
  }, [calendars, selectedCalendarId]);

  const createCalMutation = trpc.planner.createCalendar.useMutation({
    onSuccess: (data) => {
      utils.planner.listCalendars.invalidate();
      setSelectedCalendarId(data.id);
      setShowCreateCalDialog(false);
      toast.success(t("cal_add_event"));
    },
    onError: (e) => toast.error(e.message),
  });

  const updateCalMutation = trpc.planner.updateCalendar.useMutation({
    onSuccess: () => { utils.planner.listCalendars.invalidate(); setShowEditCalDialog(false); toast.success(t("cal_save")); },
    onError: (e) => toast.error(e.message),
  });

  const deleteCalMutation = trpc.planner.deleteCalendar.useMutation({
    onSuccess: () => {
      utils.planner.listCalendars.invalidate();
      setSelectedCalendarId(null);
      toast.success(t("cal_delete"));
    },
    onError: (e) => toast.error(e.message),
  });

  // ── Events ─────────────────────────────────────────────────────────────────
  const { data: events = [] } = trpc.planner.listCalendarEvents.useQuery(
    { calendarId: selectedCalendarId! },
    { enabled: selectedCalendarId !== null },
  );

  const createMutation = trpc.planner.createCalendarEvent.useMutation({
    onSuccess: () => { utils.planner.listCalendarEvents.invalidate(); setShowAddDialog(false); },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = trpc.planner.updateCalendarEvent.useMutation({
    onSuccess: () => { utils.planner.listCalendarEvents.invalidate(); setShowEditDialog(false); },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.planner.deleteCalendarEvent.useMutation({
    onSuccess: () => { utils.planner.listCalendarEvents.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const aiInfillMutation = trpc.planner.aiInfillCalendar.useMutation({
    onSuccess: (data) => {
      utils.planner.listCalendarEvents.invalidate();
      setShowAiDialog(false);
      if (data.generated === 0) {
        toast.info(t("cal_no_school_days"));
      } else {
        toast.success(`${t("cal_ai_infill")}: ${data.generated} ${data.generated === 1 ? t("cal_lesson_one") : t("cal_lessons_many")} ${t("cal_added_to_calendar")}`);
      }
    },
    onError: (e) => {
      const msg = e.message || t("cal_ai_infill_failed");
      toast.error(`${t("cal_could_not_generate")}: ${msg}`);
    },
  });

  // ── Group linking ──────────────────────────────────────────────────────────
  const { data: classGroupsList = [] } = trpc.groups.list.useQuery();

  // ── Inline Lesson Plan mutations/queries ───────────────────────────────────
  const { data: eventPlanMap = {} } = trpc.planner.getEventPlanMap.useQuery(
    { calendarId: selectedCalendarId! },
    { enabled: selectedCalendarId !== null },
  );

  const { data: planSheetData } = trpc.planner.getLessonPlan.useQuery(
    { id: planSheetPlanId! },
    { enabled: planSheetPlanId !== null },
  );

  // Sync plan data into form when it loads
  useEffect(() => {
    if (planSheetData) {
      setPlanForm(planToLessonForm(planSheetData));
      setPlanFormDirty(false);
    }
  }, [planSheetData]);

  const savePlanMutation = trpc.planner.saveLessonPlan.useMutation({
    onSuccess: (data) => {
      utils.planner.getEventPlanMap.invalidate();
      utils.planner.getLessonPlan.invalidate({ id: data.id });
      setPlanSheetPlanId(data.id);
      setPlanFormDirty(false);
      toast.success(t("lp_saved_toast"));
    },
    onError: (e) => toast.error(e.message),
  });

  const createLinkedPlanMutation = trpc.planner.createLinkedLessonPlan.useMutation({
    onSuccess: (data) => {
      utils.planner.getEventPlanMap.invalidate();
      setPlanSheetPlanId(data.id);
    },
    onError: (e) => toast.error(e.message),
  });

  const openPlanSheet = (ev: CalEvent) => {
    const existingPlanId = (eventPlanMap as Record<number, number>)[ev.id];
    setPlanSheetEventId(ev.id);
    if (existingPlanId) {
      setPlanSheetPlanId(existingPlanId);
      // planSheetData will load via the query above
    } else {
      // No plan yet — seed form from event data
      setPlanSheetPlanId(null);
      setPlanForm(emptyLessonForm({
        title: ev.title,
        subject: ev.subject ?? selectedCalendar?.subject ?? "English",
        yearGroup: ev.yearGroup ?? selectedCalendar?.yearLevel ?? YEAR_GROUPS[3],
        academicYear: selectedCalendar?.academicYear ?? ACADEMIC_YEARS[1],
        competencies: ev.competency ? [ev.competency] : [],
      }));
      setPlanFormDirty(false);
      // Auto-create a linked plan record so we have an ID to save to
      createLinkedPlanMutation.mutate({
        calendarEventId: ev.id,
        title: ev.title,
        subject: ev.subject ?? selectedCalendar?.subject,
        yearGroup: ev.yearGroup ?? selectedCalendar?.yearLevel,
        academicYear: selectedCalendar?.academicYear,
      });
    }
    setShowPlanSheet(true);
  };

  const handleSavePlan = () => {
    if (!planForm.title.trim()) { toast.error(t("lp_title_required")); return; }
    savePlanMutation.mutate({
      id: planSheetPlanId ?? undefined,
      ...lessonFormToSave(planForm),
      calendarEventId: planSheetEventId ?? undefined,
    });
  };

  const setPlanField = <K extends keyof LessonFormState>(key: K, value: LessonFormState[K]) => {
    setPlanForm(f => ({ ...f, [key]: value }));
    setPlanFormDirty(true);
  };

  const linkGroupMutation = trpc.planner.linkCalendarToGroup.useMutation({
    onSuccess: (data) => {
      utils.planner.listCalendars.invalidate();
      setShowLinkGroupDialog(false);
      toast.success(`${t("cal_linked_to_group")}: ${data.groupName}`);
    },
    onError: (e) => toast.error(e.message),
  });

  const unlinkGroupMutation = trpc.planner.unlinkCalendarFromGroup.useMutation({
    onSuccess: () => {
      utils.planner.listCalendars.invalidate();
      toast.success(t("cal_unlinked_from_group"));
    },
    onError: (e) => toast.error(e.message),
  });

  // ── Calendar grid ──────────────────────────────────────────────────────────
  const calendarDays = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1);
    const lastDay = new Date(viewYear, viewMonth + 1, 0);
    const startDow = (firstDay.getDay() + 6) % 7;
    const days: (Date | null)[] = [];
    for (let i = 0; i < startDow; i++) days.push(null);
    for (let d = 1; d <= lastDay.getDate(); d++) days.push(new Date(viewYear, viewMonth, d));
    return days;
  }, [viewMonth, viewYear]);

  const eventsByDate = useMemo(() => {
    const map: Record<string, CalEvent[]> = {};
    for (const e of events) {
      const d = new Date(e.eventDate);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      if (!map[key]) map[key] = [];
      map[key].push(e as CalEvent);
    }
    return map;
  }, [events]);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const openAdd = (date: Date, type?: string) => {
    if (!selectedCalendarId) { toast.error(t("cal_select_first")); return; }
    setSelectedDate(date.toISOString().split("T")[0]);
    setForm({ eventType: type ?? "lesson", title: "", description: "", competency: "", yearGroup: selectedCalendar?.yearLevel ?? "", subject: selectedCalendar?.subject ?? "" });
    setShowAddDialog(true);
  };

  const openAddWithType = (type: string) => openAdd(new Date(), type);

  const openEdit = (ev: CalEvent) => {
    setEditingEvent(ev);
    setForm({
      eventType: ev.eventType,
      title: ev.title,
      description: ev.description ?? "",
      competency: ev.competency ?? "",
      yearGroup: ev.yearGroup ?? "",
      subject: ev.subject ?? "",
    });
    setShowEditDialog(true);
  };

  const handleCreate = () => {
    if (!form.title.trim() || !selectedCalendarId || !selectedCalendar) return;
    createMutation.mutate({
      calendarId: selectedCalendarId,
      academicYear: selectedCalendar.academicYear,
      eventDate: selectedDate + "T09:00:00Z",
      eventType: form.eventType as any,
      title: form.title.trim(),
      description: form.description || undefined,
      competency: form.competency || undefined,
      yearGroup: form.yearGroup || undefined,
      subject: form.subject || undefined,
    });
  };

  const handleUpdate = () => {
    if (!editingEvent) return;
    updateMutation.mutate({
      id: editingEvent.id,
      eventType: form.eventType as any,
      title: form.title.trim(),
      description: form.description || undefined,
      competency: form.competency || undefined,
      yearGroup: form.yearGroup || undefined,
      subject: form.subject || undefined,
    });
  };

  const handleAiInfill = () => {
    if (!selectedCalendarId || !selectedCalendar) return;
    const cal = selectedCalendar as SchoolCalendar;
    const isTopicBlock = cal.calendarType === "topic_block";

    if (isTopicBlock) {
      // For topic blocks, use the calendar's own start/end dates directly
      const startDate = cal.startDate ? new Date(cal.startDate as string).toISOString().split("T")[0] : "";
      const endDate = cal.endDate ? new Date(cal.endDate as string).toISOString().split("T")[0] : "";
      if (!startDate || !endDate) { toast.error("Topic block calendar must have start and end dates set"); return; }
      aiInfillMutation.mutate({
        calendarId: selectedCalendarId,
        academicYear: cal.academicYear,
        yearGroup: cal.yearLevel ?? YEAR_GROUPS[3],
        subject: cal.subject ?? "English",
        sessionsPerWeek: aiForm.sessionsPerWeek,
        termDates: [], // not used for topic blocks
        topicDescription: cal.topicDescription ?? undefined,
        startDate,
        endDate,
      });
    } else {
      const validTerms = aiForm.terms.filter(t => t.start && t.end);
      if (validTerms.length === 0) { toast.error(t("cal_term_dates")); return; }
      aiInfillMutation.mutate({
        calendarId: selectedCalendarId,
        academicYear: cal.academicYear,
        yearGroup: cal.yearLevel ?? YEAR_GROUPS[3],
        subject: cal.subject ?? "English",
        sessionsPerWeek: aiForm.sessionsPerWeek,
        termDates: validTerms,
      });
    }
  };

  // Open inline lesson plan sheet (replaces navigate-away)
  const openLessonPlanner = (ev: CalEvent) => openPlanSheet(ev);

  // Open the day panel for a specific date
  const openDayPanel = (day: Date) => {
    if (!selectedCalendarId) { toast.error(t("cal_select_first")); return; }
    const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
    setDayPanelDate(key);
    setShowDayPanel(true);
  };

  // Term overview
  const termWeeks = useMemo(() => {
    const weeks: Record<string, { weekLabel: string; events: CalEvent[] }> = {};
    for (const ev of events) {
      const d = new Date(ev.eventDate);
      const jan4 = new Date(d.getFullYear(), 0, 4);
      const weekNum = Math.ceil(((d.getTime() - jan4.getTime()) / 86400000 + jan4.getDay() + 1) / 7);
      const key = `${d.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;
      if (!weeks[key]) weeks[key] = { weekLabel: key, events: [] };
      weeks[key].events.push(ev);
    }
    return Object.values(weeks).sort((a, b) => a.weekLabel.localeCompare(b.weekLabel));
  }, [events]);

  const totalEvents = events.length;
  const aiEvents = events.filter(e => e.aiGenerated).length;
  const holidays = events.filter(e => e.eventType === "holiday").length;

  // Topic block progress: count school days (Mon-Fri) in the date range
  const topicProgress = useMemo(() => {
    const cal = selectedCalendar as SchoolCalendar | null;
    if (!cal || cal.calendarType !== "topic_block" || !cal.startDate || !cal.endDate) return null;
    const start = new Date(cal.startDate as string);
    const end = new Date(cal.endDate as string);
    let totalDays = 0;
    const cur = new Date(start);
    while (cur <= end) {
      const dow = cur.getDay();
      if (dow !== 0 && dow !== 6) totalDays++;
      cur.setDate(cur.getDate() + 1);
    }
    const planned = events.filter(e => e.eventType === "lesson" || e.eventType === "ai_generated").length;
    return { planned, total: totalDays };
  }, [selectedCalendar, events]);

  const exportPdfMutation = trpc.planner.exportCalendarPdf.useMutation({
    onSuccess: (data) => {
      const binary = atob(data.pdf);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${selectedCalendar?.name ?? "calendar"}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      setIsPdfExporting(false);
    },
    onError: (e) => { toast.error(e.message); setIsPdfExporting(false); },
  });

  const handleExportPdf = () => {
    if (!selectedCalendarId) return;
    setIsPdfExporting(true);
    const logo = localStorage.getItem("seba_school_logo") || undefined;
    const storedLang = (localStorage.getItem("seba_lang") || "en") as "en" | "es" | "ca";
    exportPdfMutation.mutate({
      calendarId: selectedCalendarId,
      locale: storedLang,
      logoDataUrl: logo,
    });
  };

  const eventLabels: Record<string, string> = {
    holiday: t("cal_event_holiday"),
    special: t("cal_event_special"),
    exam: t("cal_event_exam"),
    excursion: t("cal_event_excursion"),
    event: t("cal_event_event"),
    lesson: t("cal_event_lesson"),
    ai_generated: t("cal_event_ai_generated"),
  };

  return (
    <DashboardLayout>
      <div className="flex h-[calc(100vh-64px)] overflow-hidden relative">
        {/* ── Mobile overlay backdrop ─────────────────────────────────────── */}
        {showMobileSidebar && (
          <div className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={() => setShowMobileSidebar(false)} />
        )}

        {/* ── Calendar Picker Sidebar ─────────────────────────────────────── */}
        <aside className={`${
          showMobileSidebar
            ? "fixed inset-y-0 left-0 z-40 w-72 shadow-2xl"
            : "hidden md:flex"
        } w-60 border-r flex-col shrink-0 bg-background md:bg-muted/20 flex`}>
          <div className="p-3 border-b flex items-center justify-between gap-2 min-h-[48px]">
            <span className="font-semibold text-sm flex items-center gap-1.5 truncate">
              <FolderOpen className="w-4 h-4 text-primary shrink-0" /> {t("cal_title").split(" ")[0]}
            </span>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="outline"
                className="shrink-0 h-7 px-2 gap-1 text-xs"
                onClick={() => { setCalForm(emptyCalForm()); setShowCreateCalDialog(true); }}
                title={t("cal_create_new_title")}
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">New</span>
              </Button>
              <button
                className="md:hidden p-1 rounded hover:bg-accent text-muted-foreground"
                onClick={() => setShowMobileSidebar(false)}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {(calendars as SchoolCalendar[]).length === 0 && (
              <p className="text-xs text-muted-foreground p-2">{t("cal_no_calendars")}</p>
            )}
            {(calendars as SchoolCalendar[]).map(cal => (
              <button
                key={cal.id}
                onClick={() => setSelectedCalendarId(cal.id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-accent transition-colors group flex items-start justify-between gap-1 ${selectedCalendarId === cal.id ? "bg-accent font-medium" : ""}`}
              >
                <div className="min-w-0">
                  <div className="truncate">{cal.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{cal.subject} · {cal.yearLevel}</div>
                </div>
                {selectedCalendarId === cal.id && (
                  <button
                    onClick={e => { e.stopPropagation(); setCalForm({ name: cal.name, schoolName: cal.schoolName ?? "", tutorName: cal.tutorName ?? "", subject: cal.subject ?? "English", yearLevel: cal.yearLevel ?? YEAR_GROUPS[3], academicYear: cal.academicYear, calendarType: (cal as SchoolCalendar).calendarType ?? "full_year", startDate: (cal as SchoolCalendar).startDate ? new Date((cal as SchoolCalendar).startDate as string).toISOString().split("T")[0] : "", endDate: (cal as SchoolCalendar).endDate ? new Date((cal as SchoolCalendar).endDate as string).toISOString().split("T")[0] : "", topicDescription: (cal as SchoolCalendar).topicDescription ?? "" }); setShowEditCalDialog(true); }}
                    className="opacity-0 group-hover:opacity-100 shrink-0 mt-0.5"
                  >
                    <Pencil className="w-3 h-3 text-muted-foreground" />
                  </button>
                )}
              </button>
            ))}
          </div>
        </aside>

        {/* ── Main Content ────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto flex flex-col">
          {/* Mobile top bar */}
          <div className="md:hidden flex items-center gap-2 px-3 py-2 border-b bg-background shrink-0">
            <button
              onClick={() => setShowMobileSidebar(true)}
              className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground"
              title={t("cal_mobile_calendars")}
            >
              <FolderOpen className="w-4 h-4" />
            </button>
            <span className="flex-1 text-sm font-semibold truncate">
              {selectedCalendar ? selectedCalendar.name : t("cal_title")}
            </span>
            <button
              onClick={() => setAgendaView(v => !v)}
              className={`p-1.5 rounded-lg transition-colors ${
                agendaView ? "bg-primary text-primary-foreground" : "hover:bg-accent text-muted-foreground"
              }`}
              title={agendaView ? t("cal_month_view_title") : t("cal_agenda_view_title")}
            >
              <LayoutList className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 md:p-5 space-y-4 md:space-y-5">
          {selectedCalendar === null ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
              <CalendarDays className="w-12 h-12 text-muted-foreground/40" />
              <div>
                <p className="font-medium">{t("cal_title")}</p>
                <p className="text-sm text-muted-foreground mt-1">{t("cal_create_hint")}</p>
              </div>
                <Button onClick={() => { setCalForm(emptyCalForm()); setShowCreateCalDialog(true); }} className="gap-2">
                <Plus className="w-4 h-4" /> {t("cal_create_calendar")}
              </Button>
            </div>
          ) : (
            <>
              {/* ── Header Panel ─────────────────────────────────────────── */}
              <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-teal-500/5">
                <CardContent className="pt-4 pb-3">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="space-y-1.5">
                      <h1 className="text-xl font-bold flex items-center gap-2">
                        <CalendarDays className="w-5 h-5 text-primary" />
                        {selectedCalendar.name}
                      </h1>
                      <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                        {selectedCalendar.schoolName && (
                          <span className="flex items-center gap-1"><School className="w-3.5 h-3.5" /> {selectedCalendar.schoolName}</span>
                        )}
                        {selectedCalendar.tutorName && (
                          <span className="flex items-center gap-1"><User className="w-3.5 h-3.5" /> {selectedCalendar.tutorName}</span>
                        )}
                        {selectedCalendar.subject && (
                          <span className="flex items-center gap-1"><BookOpen className="w-3.5 h-3.5" /> {selectedCalendar.subject}</span>
                        )}
                        {selectedCalendar.yearLevel && (
                          <span className="flex items-center gap-1"><GraduationCap className="w-3.5 h-3.5" /> {selectedCalendar.yearLevel}</span>
                        )}
                        <Badge variant="outline" className="text-xs">{selectedCalendar.academicYear}</Badge>
                        {(selectedCalendar as SchoolCalendar).calendarType === "topic_block" && (
                          <Badge className="text-xs bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100"><BookOpen className="w-3 h-3 mr-1" /> Topic Block</Badge>
                        )}
                        {(selectedCalendar as SchoolCalendar).calendarType === "topic_block" && (selectedCalendar as SchoolCalendar).startDate && (selectedCalendar as SchoolCalendar).endDate && (
                          <span className="flex items-center gap-1 text-xs">
                            {new Date((selectedCalendar as SchoolCalendar).startDate as string).toLocaleDateString()} – {new Date((selectedCalendar as SchoolCalendar).endDate as string).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      {(selectedCalendar as SchoolCalendar).calendarType === "topic_block" && (selectedCalendar as SchoolCalendar).topicDescription && (
                        <p className="text-xs text-muted-foreground mt-1.5 italic line-clamp-2">
                          "{(selectedCalendar as SchoolCalendar).topicDescription}"
                        </p>
                      )}
                      {topicProgress && (
                        <div className="mt-2 space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-medium text-foreground">{t("cal_progress_label")}</span>
                            <span className="text-muted-foreground">{topicProgress.planned} / {topicProgress.total} {t("cal_progress_days")}</span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                            <div
                              className="h-full bg-teal-500 rounded-full transition-all duration-500"
                              style={{ width: topicProgress.total > 0 ? `${Math.min(100, Math.round((topicProgress.planned / topicProgress.total) * 100))}%` : "0%" }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Button variant="outline" size="sm" onClick={() => setShowTermView(v => !v)} className="gap-1.5" title={showTermView ? t("cal_month_view") : t("cal_term_overview")}>
                        <LayoutList className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">{showTermView ? t("cal_month_view") : t("cal_term_overview")}</span>
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleExportPdf} disabled={isPdfExporting} className="gap-1.5" title={t("cal_export_pdf")}>
                        <Download className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">{isPdfExporting ? "…" : t("cal_export_pdf")}</span>
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => {
                        const cal = selectedCalendar as SchoolCalendar;
                        setAiForm(f => ({ ...f, terms: getDefaultTermsForYear(cal.academicYear) }));
                        setShowAiDialog(true);
                      }} className="gap-1.5" title={t("cal_ai_infill")}>
                        <Sparkles className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">{t("cal_ai_infill")}</span>
                      </Button>
                      {(selectedCalendar as SchoolCalendar).linkedGroupId ? (
                        <Button variant="outline" size="sm" onClick={() => unlinkGroupMutation.mutate({ calendarId: selectedCalendarId! })} disabled={unlinkGroupMutation.isPending} className="gap-1.5 text-amber-700 border-amber-300 hover:bg-amber-50" title={(classGroupsList as any[]).find(g => g.id === (selectedCalendar as SchoolCalendar).linkedGroupId)?.className ?? t("cal_link_group")}>
                          <Unlink className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">{(classGroupsList as any[]).find(g => g.id === (selectedCalendar as SchoolCalendar).linkedGroupId)?.className ?? t("cal_link_group")}</span>
                        </Button>
                      ) : (
                        <Button variant="outline" size="sm" onClick={() => { setLinkGroupId(""); setShowLinkGroupDialog(true); }} className="gap-1.5" title={t("cal_link_group")}>
                          <Link className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">{t("cal_link_group")}</span>
                        </Button>
                      )}
                      <Button size="sm" onClick={() => openAdd(new Date())} className="gap-1.5">
                        <Plus className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">{t("cal_add_event")}</span>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* ── Stats ────────────────────────────────────────────────── */}
              <div className="grid grid-cols-3 gap-3">
                <Card><CardContent className="pt-3 pb-3 text-center"><div className="text-xl font-bold">{totalEvents}</div><div className="text-xs text-muted-foreground">{t("cal_total_events")}</div></CardContent></Card>
                <Card><CardContent className="pt-3 pb-3 text-center"><div className="text-xl font-bold text-teal-600">{aiEvents}</div><div className="text-xs text-muted-foreground">{t("cal_ai_generated")}</div></CardContent></Card>
                <Card><CardContent className="pt-3 pb-3 text-center"><div className="text-xl font-bold text-red-600">{holidays}</div><div className="text-xs text-muted-foreground">{t("cal_holidays")}</div></CardContent></Card>
              </div>

              {/* ── Month Calendar (or Agenda on mobile) ────────────────── */}
              {agendaView ? (
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <Button variant="ghost" size="icon" onClick={prevMonth}><ChevronLeft className="w-4 h-4" /></Button>
                      <CardTitle className="text-base">{MONTHS[viewMonth]} {viewYear}</CardTitle>
                      <Button variant="ghost" size="icon" onClick={nextMonth}><ChevronRight className="w-4 h-4" /></Button>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {calendarDays.filter(Boolean).map((day) => {
                      const d = day!;
                      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
                      const dayEvents = eventsByDate[key] ?? [];
                      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                      const isToday = key === new Date().toISOString().split("T")[0];
                      if (isWeekend && dayEvents.length === 0) return null;
                      return (
                        <div key={key} className={`flex gap-3 items-start py-2 border-b last:border-0 ${isToday ? "bg-primary/5 rounded-lg px-2" : ""}`}>
                          <div className={`shrink-0 w-10 text-center pt-0.5 ${isToday ? "text-primary font-bold" : "text-muted-foreground"}` }>
                            <span className="text-xs uppercase">{[t("cal_day_sun"),t("cal_day_mon"),t("cal_day_tue"),t("cal_day_wed"),t("cal_day_thu"),t("cal_day_fri"),t("cal_day_sat")][d.getDay()]}</span>                           <div className="text-lg font-black leading-none">{d.getDate()}</div>
                          </div>
                          <div className="flex-1 min-w-0">
                            {dayEvents.length === 0 ? (
                              <p className="text-xs text-muted-foreground/50 italic py-1">{t("cal_no_events_day")}</p>
                            ) : (
                              <div className="space-y-1 py-0.5">
                                {dayEvents.map(ev => (
                                  <div
                                    key={ev.id}
                                    className={`text-xs px-2 py-1 rounded-lg border cursor-pointer flex items-center gap-1.5 ${EVENT_COLORS[ev.eventType] ?? "bg-gray-100 text-gray-800"}`}
                                    onClick={() => (ev.eventType === "lesson" || ev.eventType === "ai_generated") ? openLessonPlanner(ev) : openEdit(ev)}
                                  >
                                    <span className="flex-1 font-medium truncate">{ev.title}</span>
                                    {(ev.eventType === "lesson" || ev.eventType === "ai_generated") && <ExternalLink className="w-3 h-3 opacity-60 shrink-0" />}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          <button
                            className="shrink-0 p-1 rounded hover:bg-accent text-muted-foreground opacity-60 hover:opacity-100"
                            onClick={() => openAdd(d)}
                            title="Add event"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              ) : (
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <Button variant="ghost" size="icon" onClick={prevMonth}><ChevronLeft className="w-4 h-4" /></Button>
                    <CardTitle className="text-base">{MONTHS[viewMonth]} {viewYear}</CardTitle>
                    <Button variant="ghost" size="icon" onClick={nextMonth}><ChevronRight className="w-4 h-4" /></Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-7 gap-1 mb-1">
                    {[t("cal_day_mon"), t("cal_day_tue"), t("cal_day_wed"), t("cal_day_thu"), t("cal_day_fri"), t("cal_day_sat"), t("cal_day_sun")].map(d => (
                      <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">{d}</div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {calendarDays.map((day, i) => {
                      if (!day) return <div key={`empty-${i}`} />;
                      const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
                      const dayEvents = eventsByDate[key] ?? [];
                      const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                      const isToday = key === new Date().toISOString().split("T")[0];
                      return (
                        <div
                          key={key}
                          className={`min-h-[76px] rounded-lg border p-1 cursor-pointer hover:bg-accent/50 transition-colors relative group ${isWeekend ? "bg-muted/30" : ""} ${isToday ? "ring-2 ring-primary" : ""} ${dayPanelDate === key && showDayPanel ? "ring-2 ring-teal-400" : ""}`}
                          onClick={() => openDayPanel(day)}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className={`text-xs font-medium ${isToday ? "text-primary" : "text-muted-foreground"}`}>{day.getDate()}</span>
                            {!isWeekend && (
                              <span
                                className="opacity-0 group-hover:opacity-80 transition-opacity cursor-pointer hover:text-primary"
                                onClick={e => { e.stopPropagation(); openAdd(day); }}
                                title="Add event"
                              >
                                <Plus className="w-3 h-3" />
                              </span>
                            )}
                          </div>
                          <div className="space-y-0.5">
                            {dayEvents.slice(0, 3).map(ev => {
                              const hasPlan = !!(eventPlanMap as Record<number, number>)[ev.id];
                              return (
                                <div
                                  key={ev.id}
                                  className={`text-[10px] px-1 py-0.5 rounded border truncate cursor-pointer flex items-center gap-0.5 ${EVENT_COLORS[ev.eventType] ?? "bg-gray-100 text-gray-800"}`}
                                  onClick={e => {
                                    e.stopPropagation();
                                    if (ev.eventType === "lesson" || ev.eventType === "ai_generated") openLessonPlanner(ev);
                                    else openEdit(ev);
                                  }}
                                  title={(ev.eventType === "lesson" || ev.eventType === "ai_generated") ? `${t("cal_open_planner")}: ${ev.title}` : ev.title}
                                >
                                  <span className="truncate flex-1">{ev.title}</span>
                                  {hasPlan && <ClipboardList className="w-2.5 h-2.5 shrink-0 opacity-70" />}
                                </div>
                              );
                            })}
                            {dayEvents.length > 3 && (
                              <div className="text-[10px] text-muted-foreground px-1">+{dayEvents.length - 3} {t("cal_more")}</div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
              )}{/* end agendaView ternary */}

              {/* ── Term Overview ────────────────────────────────────────── */}
              {showTermView && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">{t("cal_term_overview_title")} — {selectedCalendar.academicYear}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {termWeeks.length === 0 ? (
                      <p className="text-sm text-muted-foreground">{t("cal_no_events")}</p>
                    ) : (
                      <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
                        {termWeeks.map(({ weekLabel, events: wEvents }) => (
                          <div key={weekLabel} className="flex gap-3 items-start">
                            <div className="w-20 shrink-0 text-xs font-mono text-muted-foreground pt-1">{weekLabel}</div>
                            <div className="flex flex-wrap gap-1 flex-1">
                              {wEvents.map(ev => (
                                <div
                                  key={ev.id}
                                  className={`text-xs px-2 py-0.5 rounded border cursor-pointer flex items-center gap-1 ${EVENT_COLORS[ev.eventType] ?? "bg-gray-100 text-gray-800"}`}
                                  onClick={() => (ev.eventType === "lesson" || ev.eventType === "ai_generated") ? openLessonPlanner(ev) : openEdit(ev)}
                                  title={(ev.eventType === "lesson" || ev.eventType === "ai_generated") ? `${t("cal_open_planner")}: ${ev.title}` : ev.title}
                                >
                                  {ev.title}
                                  {(ev.eventType === "lesson" || ev.eventType === "ai_generated") && <ExternalLink className="w-3 h-3 opacity-60" />}
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* ── Quick-Add Event Buttons ──────────────────────────────── */}
              <Card>
                <CardContent className="pt-3 pb-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Plus className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("cal_add_event")}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {([
                      { type: "holiday",     icon: "🏖️",  label: eventLabels.holiday },
                      { type: "special",     icon: "⭐",  label: eventLabels.special },
                      { type: "exam",        icon: "📝",  label: eventLabels.exam },
                      { type: "excursion",   icon: "🚌",  label: eventLabels.excursion },
                      { type: "event",       icon: "🎉",  label: eventLabels.event },
                      { type: "lesson",      icon: "📖",  label: eventLabels.lesson },
                      { type: "ai_generated",icon: "✨",  label: eventLabels.ai_generated },
                    ] as { type: string; icon: string; label: string }[]).map(({ type, icon, label }) => (
                      <button
                        key={type}
                        onClick={() => {
                          if (type === "ai_generated") {
                            const cal = selectedCalendar as SchoolCalendar | null;
                            if (cal) setAiForm(f => ({ ...f, terms: getDefaultTermsForYear(cal.academicYear) }));
                            setShowAiDialog(true);
                          } else {
                            openAddWithType(type);
                          }
                        }}
                        disabled={!selectedCalendarId}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all hover:opacity-80 hover:shadow-sm active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed ${EVENT_COLORS[type]}`}
                        title={type === "ai_generated" ? "AI-generate lesson schedule" : `Add ${label}`}
                      >
                        <span>{icon}</span>
                        <span>{label}</span>
                        {type === "ai_generated" ? <Sparkles className="w-3 h-3 opacity-60" /> : <Plus className="w-3 h-3 opacity-60" />}
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
          </div>{/* end inner scroll div */}
        </div>{/* end main content flex-col */}
      </div>

      {/* ── Create Calendar Dialog ──────────────────────────────────────────── */}
      <Dialog open={showCreateCalDialog} onOpenChange={setShowCreateCalDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><CalendarDays className="w-5 h-5 text-primary" /> {t("cal_create_new_title")}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {/* Calendar type toggle */}
            <div>
              <Label className="text-sm font-semibold mb-2 block">{t("cal_type_label")}</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setCalForm(f => ({ ...f, calendarType: "full_year", startDate: "", endDate: "" }))}
                  className={`rounded-lg border-2 p-3 text-left transition-all ${
                    calForm.calendarType === "full_year"
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border hover:border-primary/40"
                  }`}
                >
                  <div className="font-semibold text-sm flex items-center gap-1.5"><CalendarDays className="w-4 h-4" /> {t("cal_type_full_year")}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{t("cal_type_full_year_desc")}</div>
                </button>
                <button
                  type="button"
                  onClick={() => setCalForm(f => ({ ...f, calendarType: "topic_block" }))}
                  className={`rounded-lg border-2 p-3 text-left transition-all ${
                    calForm.calendarType === "topic_block"
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border hover:border-primary/40"
                  }`}
                >
                  <div className="font-semibold text-sm flex items-center gap-1.5"><BookOpen className="w-4 h-4" /> {t("cal_type_topic_block")}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{t("cal_type_topic_block_desc")}</div>
                </button>
              </div>
            </div>

            <div>
              <Label>{t("cal_label_cal_name")}</Label>
              <Input value={calForm.name} onChange={e => setCalForm(f => ({ ...f, name: e.target.value }))} placeholder={t('cal_ph_cal_name')} />
            </div>

            {/* Topic block: start/end dates + topic description */}
            {calForm.calendarType === "topic_block" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>{t("cal_label_start_date")}</Label>
                    <Input type="date" value={calForm.startDate} onChange={e => setCalForm(f => ({ ...f, startDate: e.target.value }))} />
                  </div>
                  <div>
                    <Label>{t("cal_label_end_date")}</Label>
                    <Input type="date" value={calForm.endDate} onChange={e => setCalForm(f => ({ ...f, endDate: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <Label>{t("cal_label_topic_desc")}</Label>
                  <Textarea
                    value={calForm.topicDescription}
                    onChange={e => setCalForm(f => ({ ...f, topicDescription: e.target.value }))}
                    placeholder={t('cal_ph_topic_desc')}
                    rows={4}
                    className="resize-none"
                  />
                  <p className="text-xs text-muted-foreground mt-1">{t("cal_topic_ai_hint")}</p>
                </div>
              </>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label><School className="w-3.5 h-3.5 inline mr-1" /> {t("cal_label_school_name")}</Label>
                <Input value={calForm.schoolName} onChange={e => setCalForm(f => ({ ...f, schoolName: e.target.value }))} placeholder={t('cal_ph_school_name')} />
              </div>
              <div>
                <Label><User className="w-3.5 h-3.5 inline mr-1" /> {t("cal_label_tutor_name")}</Label>
                <Input value={calForm.tutorName} onChange={e => setCalForm(f => ({ ...f, tutorName: e.target.value }))} placeholder={t('cal_ph_tutor_name')} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label><BookOpen className="w-3.5 h-3.5 inline mr-1" /> {t("cal_subject")}</Label>
                <Select value={calForm.subject} onValueChange={v => setCalForm(f => ({ ...f, subject: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{SUBJECTS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label><GraduationCap className="w-3.5 h-3.5 inline mr-1" /> {t("cal_year_group")}</Label>
                <Select value={calForm.yearLevel} onValueChange={v => setCalForm(f => ({ ...f, yearLevel: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{YEAR_GROUPS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>{t("cal_academic_year")}</Label>
              <Select value={calForm.academicYear} onValueChange={v => setCalForm(f => ({ ...f, academicYear: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ACADEMIC_YEARS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateCalDialog(false)}>{t("cal_cancel")}</Button>
            <Button
              onClick={() => createCalMutation.mutate({
                ...calForm,
                startDate: calForm.startDate || undefined,
                endDate: calForm.endDate || undefined,
                topicDescription: calForm.topicDescription || undefined,
              })}
              disabled={createCalMutation.isPending || !calForm.name.trim() || (calForm.calendarType === "topic_block" && (!calForm.startDate || !calForm.endDate))}
              className="gap-1"
            >
              <Check className="w-4 h-4" /> {t("cal_create_btn")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Calendar Dialog ────────────────────────────────────────────── */}
      <Dialog open={showEditCalDialog} onOpenChange={setShowEditCalDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Pencil className="w-5 h-5" /> {t("cal_edit_calendar")}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {/* Calendar type toggle */}
            <div>
              <Label className="text-sm font-semibold mb-2 block">{t("cal_type_label")}</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setCalForm(f => ({ ...f, calendarType: "full_year", startDate: "", endDate: "" }))}
                  className={`rounded-lg border-2 p-3 text-left transition-all ${
                    calForm.calendarType === "full_year"
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border hover:border-primary/40"
                  }`}
                >
                  <div className="font-semibold text-sm flex items-center gap-1.5"><CalendarDays className="w-4 h-4" /> {t("cal_type_full_year")}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{t("cal_type_full_year_desc")}</div>
                </button>
                <button
                  type="button"
                  onClick={() => setCalForm(f => ({ ...f, calendarType: "topic_block" }))}
                  className={`rounded-lg border-2 p-3 text-left transition-all ${
                    calForm.calendarType === "topic_block"
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border hover:border-primary/40"
                  }`}
                >
                  <div className="font-semibold text-sm flex items-center gap-1.5"><BookOpen className="w-4 h-4" /> {t("cal_type_topic_block")}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{t("cal_type_topic_block_desc")}</div>
                </button>
              </div>
            </div>

            <div>
              <Label>{t("cal_label_cal_name")}</Label>
              <Input value={calForm.name} onChange={e => setCalForm(f => ({ ...f, name: e.target.value }))} />
            </div>

            {calForm.calendarType === "topic_block" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>{t("cal_label_start_date")}</Label>
                    <Input type="date" value={calForm.startDate} onChange={e => setCalForm(f => ({ ...f, startDate: e.target.value }))} />
                  </div>
                  <div>
                    <Label>{t("cal_label_end_date")}</Label>
                    <Input type="date" value={calForm.endDate} onChange={e => setCalForm(f => ({ ...f, endDate: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <Label>{t("cal_label_topic_desc")}</Label>
                  <Textarea
                    value={calForm.topicDescription}
                    onChange={e => setCalForm(f => ({ ...f, topicDescription: e.target.value }))}
                    placeholder={t('cal_ph_topic_desc_short')}
                    rows={4}
                    className="resize-none"
                  />
                </div>
              </>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t("cal_label_school_name")}</Label>
                <Input value={calForm.schoolName} onChange={e => setCalForm(f => ({ ...f, schoolName: e.target.value }))} />
              </div>
              <div>
                <Label>{t("cal_label_tutor_name")}</Label>
                <Input value={calForm.tutorName} onChange={e => setCalForm(f => ({ ...f, tutorName: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t("cal_subject")}</Label>
                <Select value={calForm.subject} onValueChange={v => setCalForm(f => ({ ...f, subject: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{SUBJECTS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t("cal_year_group")}</Label>
                <Select value={calForm.yearLevel} onValueChange={v => setCalForm(f => ({ ...f, yearLevel: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{YEAR_GROUPS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>{t("cal_academic_year")}</Label>
              <Select value={calForm.academicYear} onValueChange={v => setCalForm(f => ({ ...f, academicYear: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ACADEMIC_YEARS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="flex justify-between">
            <Button variant="destructive" size="sm" onClick={() => { if (selectedCalendarId) deleteCalMutation.mutate({ id: selectedCalendarId }); setShowEditCalDialog(false); }}>
              <Trash2 className="w-4 h-4 mr-1" /> {t("cal_delete_calendar")}
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowEditCalDialog(false)}>{t("cal_cancel")}</Button>
              <Button
                onClick={() => {
                  if (selectedCalendarId) updateCalMutation.mutate({
                    id: selectedCalendarId,
                    ...calForm,
                    startDate: calForm.startDate || undefined,
                    endDate: calForm.endDate || undefined,
                    topicDescription: calForm.topicDescription || undefined,
                  });
                }}
                disabled={updateCalMutation.isPending}
              >
                {t("cal_save")}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add Event Dialog ────────────────────────────────────────── */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{t("cal_add_event")}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>{t("cal_label_date")}</Label>
              <Input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="w-full"
              />
            </div>
            <div>
              <Label>{t("cal_event_type")}</Label>
              <Select value={form.eventType} onValueChange={v => setForm(f => ({ ...f, eventType: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(eventLabels).filter(([type]) => type !== "ai_generated").map(([type, label]) => <SelectItem key={type} value={type}>{label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("cal_event_title")} *</Label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder={t('cal_ph_event_title')} />
            </div>
            <div>
              <Label>{t("cal_description")}</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} />
            </div>
            {(form.eventType === "lesson" || form.eventType === "event") && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>{t("cal_year_group")}</Label>
                    <Select value={form.yearGroup} onValueChange={v => setForm(f => ({ ...f, yearGroup: v }))}>
                      <SelectTrigger><SelectValue placeholder={t('cal_ph_select')} /></SelectTrigger>
                      <SelectContent>{YEAR_GROUPS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{t("cal_subject")}</Label>
                    <Select value={form.subject} onValueChange={v => setForm(f => ({ ...f, subject: v }))}>
                      <SelectTrigger><SelectValue placeholder={t('cal_ph_select')} /></SelectTrigger>
                      <SelectContent>{SUBJECTS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>{t("cal_competency")}</Label>
                  <Select value={form.competency} onValueChange={v => setForm(f => ({ ...f, competency: v }))}>
                    <SelectTrigger><SelectValue placeholder={t('cal_ph_select')} /></SelectTrigger>
                    <SelectContent>{COMPETENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>{t("cal_cancel")}</Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending || !form.title.trim()}>{t("cal_add_btn")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Event Dialog ───────────────────────────────────────────────── */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{t("cal_edit_event")}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>{t("cal_event_type")}</Label>
              <Select value={form.eventType} onValueChange={v => setForm(f => ({ ...f, eventType: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(eventLabels).map(([type, label]) => <SelectItem key={type} value={type}>{label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("cal_event_title")} *</Label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div>
              <Label>{t("cal_description")}</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>{t("cal_year_group")}</Label>
                <Select value={form.yearGroup} onValueChange={v => setForm(f => ({ ...f, yearGroup: v }))}>
                  <SelectTrigger><SelectValue placeholder={t('cal_ph_select')} /></SelectTrigger>
                  <SelectContent>{YEAR_GROUPS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t("cal_subject")}</Label>
                <Select value={form.subject} onValueChange={v => setForm(f => ({ ...f, subject: v }))}>
                  <SelectTrigger><SelectValue placeholder={t('cal_ph_select')} /></SelectTrigger>
                  <SelectContent>{SUBJECTS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>{t("cal_competency")}</Label>
              <Select value={form.competency} onValueChange={v => setForm(f => ({ ...f, competency: v }))}>
                <SelectTrigger><SelectValue placeholder={t('cal_ph_select')} /></SelectTrigger>
                <SelectContent>{COMPETENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="flex justify-between">
            <Button variant="destructive" size="sm" onClick={() => { if (editingEvent) deleteMutation.mutate({ id: editingEvent.id }); setShowEditDialog(false); }}>
              <Trash2 className="w-4 h-4 mr-1" /> {t("cal_delete")}
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowEditDialog(false)}>{t("cal_cancel")}</Button>
              <Button onClick={handleUpdate} disabled={updateMutation.isPending || !form.title.trim()}>{t("cal_save")}</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── AI Infill Dialog ────────────────────────────────────────────────── */}
      <Dialog open={showAiDialog} onOpenChange={setShowAiDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Sparkles className="w-5 h-5 text-teal-500" /> {t("cal_ai_dialog_title")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{t("cal_ai_dialog_desc")}</p>
          {selectedCalendar && (
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant="secondary"><BookOpen className="w-3 h-3 mr-1" />{selectedCalendar.subject}</Badge>
              <Badge variant="secondary"><GraduationCap className="w-3 h-3 mr-1" />{selectedCalendar.yearLevel}</Badge>
              <Badge variant="secondary">{selectedCalendar.academicYear}</Badge>
              {(selectedCalendar as SchoolCalendar).calendarType === "topic_block" && (
                <Badge className="bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100"><BookOpen className="w-3 h-3 mr-1" /> {t("cal_type_topic_block")}</Badge>
              )}
            </div>
          )}
          {selectedCalendar && (selectedCalendar as SchoolCalendar).calendarType === "topic_block" && (selectedCalendar as SchoolCalendar).topicDescription && (
            <div className="rounded-md bg-amber-50 border border-amber-200 p-3">
              <p className="text-xs font-semibold text-amber-800 mb-1">{t("cal_label_topic_desc")}</p>
              <p className="text-xs text-amber-700 italic">"{(selectedCalendar as SchoolCalendar).topicDescription}"</p>
              <p className="text-xs text-amber-600 mt-1">{t("cal_topic_ai_hint_short")}</p>
            </div>
          )}
          <div className="space-y-4">
            <div>
              <Label>{t("cal_sessions_per_week")}</Label>
              <Select value={String(aiForm.sessionsPerWeek)} onValueChange={v => setAiForm(f => ({ ...f, sessionsPerWeek: Number(v) }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{[1, 2, 3, 4, 5].map(n => <SelectItem key={n} value={String(n)}>{n} {n === 1 ? t("cal_sessions_suffix_one") : t("cal_sessions_suffix_many")}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {/* Only show term date inputs for full-year calendars */}
            {(selectedCalendar as SchoolCalendar)?.calendarType !== "topic_block" && (
              <div className="space-y-2">
                <Label>{t("cal_term_dates")}</Label>
                {aiForm.terms.map((term, i) => (
                  <div key={i} className="grid grid-cols-3 gap-2 items-center">
                    <span className="text-sm text-muted-foreground">{term.label}</span>
                    <Input type="date" value={term.start} onChange={e => setAiForm(f => ({ ...f, terms: f.terms.map((tt, j) => j === i ? { ...tt, start: e.target.value } : tt) }))} />
                    <Input type="date" value={term.end} onChange={e => setAiForm(f => ({ ...f, terms: f.terms.map((tt, j) => j === i ? { ...tt, end: e.target.value } : tt) }))} />
                  </div>
                ))}
              </div>
            )}
            {/* For topic blocks: show the date range from the calendar */}
            {(selectedCalendar as SchoolCalendar)?.calendarType === "topic_block" && (
              <div className="rounded-md bg-muted/50 p-3 text-sm">
                <p className="font-medium mb-1">Date Range</p>
                <p className="text-muted-foreground">
                  {(selectedCalendar as SchoolCalendar).startDate
                    ? `${new Date((selectedCalendar as SchoolCalendar).startDate as string).toLocaleDateString()} – ${new Date((selectedCalendar as SchoolCalendar).endDate as string).toLocaleDateString()}`
                    : "No dates set — please edit the calendar to add start and end dates first."}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Lessons will be generated for every school day in this range at the selected frequency.</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAiDialog(false)}>{t("cal_cancel")}</Button>
            <Button onClick={handleAiInfill} disabled={aiInfillMutation.isPending} className="gap-2">
              <Sparkles className="w-4 h-4" />
              {aiInfillMutation.isPending ? t("cal_generating") : t("cal_generate_lessons")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Link to Class Group Dialog ───────────────────────────────── */}
      <Dialog open={showLinkGroupDialog} onOpenChange={setShowLinkGroupDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Users className="w-4 h-4" /> {t("cal_link_group_title")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{t("cal_link_group_desc")}</p>
          {(classGroupsList as any[]).length === 0 ? (
            <p className="text-sm text-muted-foreground italic">{t("cal_no_groups")}</p>
          ) : (
            <Select value={linkGroupId} onValueChange={setLinkGroupId}>
              <SelectTrigger>
                <SelectValue placeholder={t("cal_ph_select")} />
              </SelectTrigger>
              <SelectContent>
                {(classGroupsList as any[]).map(g => (
                  <SelectItem key={g.id} value={String(g.id)}>{g.className} – {g.level}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLinkGroupDialog(false)}>{t("cal_cancel")}</Button>
            <Button
              disabled={!linkGroupId || linkGroupMutation.isPending}
              onClick={() => selectedCalendarId && linkGroupMutation.mutate({ calendarId: selectedCalendarId, groupId: Number(linkGroupId) })}
              className="gap-2"
            >
              <Link className="w-4 h-4" /> {t("cal_link_group")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Day Panel Sheet ──────────────────────────────────────────────────────────────────────────── */}
      <Sheet open={showDayPanel} onOpenChange={setShowDayPanel}>
        <SheetContent side="right" className="w-[380px] sm:w-[440px] p-0 flex flex-col">
          <SheetHeader className="px-5 pt-5 pb-3 border-b shrink-0">
            <SheetTitle className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-primary" />
              {dayPanelDate ? new Date(dayPanelDate + "T12:00:00").toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" }) : ""}
            </SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {/* Events for this day */}
            {(dayPanelDate ? (eventsByDate[dayPanelDate] ?? []) : []).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No events for this day.</p>
            ) : (
              (dayPanelDate ? (eventsByDate[dayPanelDate] ?? []) : []).map(ev => {
                const hasPlan = !!(eventPlanMap as Record<number, number>)[ev.id];
                const isLesson = ev.eventType === "lesson" || ev.eventType === "ai_generated";
                return (
                  <div key={ev.id} className={`rounded-lg border p-3 space-y-2 ${EVENT_COLORS[ev.eventType] ?? "bg-gray-50"}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium text-sm truncate">{ev.title}</div>
                        {ev.yearGroup && <div className="text-xs opacity-70">{ev.yearGroup}{ev.subject ? ` · ${ev.subject}` : ""}</div>}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        {isLesson && (
                          <Button size="sm" variant="outline" className="h-7 px-2 gap-1 text-xs bg-white/60 hover:bg-white" onClick={() => openLessonPlanner(ev)}>
                            <ClipboardList className="w-3 h-3" />
                            {hasPlan ? "Edit Plan" : "Add Plan"}
                          </Button>
                        )}
                        <Button size="sm" variant="outline" className="h-7 px-2 bg-white/60 hover:bg-white" onClick={() => { openEdit(ev); setShowDayPanel(false); }}>
                          <Pencil className="w-3 h-3" />
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 px-2 bg-white/60 hover:bg-red-50 text-red-600 border-red-200" onClick={() => deleteMutation.mutate({ id: ev.id })}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                    {ev.description && (() => {
                      try {
                        const parsed = JSON.parse(ev.description as string);
                        if (parsed.learningOutcomes?.length) {
                          return (
                            <div className="text-xs opacity-80">
                              <span className="font-medium">Outcomes: </span>
                              {parsed.learningOutcomes.slice(0, 2).join(" • ")}
                            </div>
                          );
                        }
                      } catch { /* not JSON */ }
                      return <div className="text-xs opacity-80 line-clamp-2">{ev.description}</div>;
                    })()}
                  </div>
                );
              })
            )}
          </div>
          {/* Add event button at the bottom */}
          <div className="p-4 border-t shrink-0">
            <Button className="w-full gap-2" onClick={() => {
              if (dayPanelDate) {
                const [y, m, d] = dayPanelDate.split("-").map(Number);
                openAdd(new Date(y, m - 1, d));
                setShowDayPanel(false);
              }
            }}>
              <Plus className="w-4 h-4" /> Add Event
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Inline Lesson Plan Sheet ─────────────────────────────────────────────────────────────────── */}
      <Sheet open={showPlanSheet} onOpenChange={(open) => {
        if (!open && planFormDirty) {
          // Auto-save on close if dirty
          if (planForm.title.trim()) handleSavePlan();
        }
        setShowPlanSheet(open);
      }}>
        <SheetContent side="right" className="w-full sm:w-[600px] sm:max-w-[600px] p-0 flex flex-col">
          <SheetHeader className="px-5 pt-5 pb-3 border-b shrink-0">
            <div className="flex items-center justify-between gap-2">
              <SheetTitle className="flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-primary" />
                {planForm.title || "Lesson Plan"}
              </SheetTitle>
              <div className="flex gap-2">
                {planFormDirty && <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">{t("lp_unsaved")}</Badge>}
                <Button size="sm" onClick={handleSavePlan} disabled={savePlanMutation.isPending} className="gap-1">
                  <Save className="w-3.5 h-3.5" />
                  {savePlanMutation.isPending ? t("lp_saving") : t("lp_save")}
                </Button>
              </div>
            </div>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* ─ Header Info ─ */}
            <div className="space-y-3">
              <div>
                <Label className="text-xs">{t("lp_lesson_title")}</Label>
                <Input value={planForm.title} onChange={e => setPlanField("title", e.target.value)} placeholder={t("lp_ph_title")} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">{t("lp_unit")}</Label>
                  <Input value={planForm.unit} onChange={e => setPlanField("unit", e.target.value)} placeholder={t("lp_ph_unit")} />
                </div>
                <div>
                  <Label className="text-xs">{t("lp_lesson_no")}</Label>
                  <Input value={planForm.lessonNumber} onChange={e => setPlanField("lessonNumber", e.target.value)} placeholder={t("lp_ph_lesson_number")} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">{t("lp_year_group")}</Label>
                  <Select value={planForm.yearGroup} onValueChange={v => setPlanField("yearGroup", v)}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>{YEAR_GROUPS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">{t("lp_subject")}</Label>
                  <Select value={planForm.subject} onValueChange={v => setPlanField("subject", v)}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>{SUBJECTS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">{t("lp_duration_min")}</Label>
                  <Input type="number" value={planForm.duration} onChange={e => setPlanField("duration", Number(e.target.value))} min={15} max={180} step={5} className="h-8 text-sm" />
                </div>
                <div>
                  <Label className="text-xs">{t("lp_spaces")}</Label>
                  <Input value={planForm.spaces} onChange={e => setPlanField("spaces", e.target.value)} placeholder={t("lp_ph_spaces")} className="h-8 text-sm" />
                </div>
              </div>
            </div>

            <Separator />

            {/* ─ Skills & Systems ─ */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("lp_section_skills")}</p>
              <div>
                <Label className="text-xs mb-1 block">{t("lp_skills")}</Label>
                <div className="flex flex-wrap gap-3">
                  {LP_SKILL_KEYS.map(k => (
                    <div key={k} className="flex items-center gap-1.5">
                      <Checkbox id={`ps-skill-${k}`} checked={!!planForm.skills[k]} onCheckedChange={v => setPlanField("skills", { ...planForm.skills, [k]: !!v })} />
                      <label htmlFor={`ps-skill-${k}`} className="text-xs capitalize cursor-pointer">{k}</label>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-xs mb-1 block">{t("lp_language_systems")}</Label>
                <div className="flex flex-wrap gap-3">
                  {LP_SYSTEM_KEYS.map(k => (
                    <div key={k} className="flex items-center gap-1.5">
                      <Checkbox id={`ps-sys-${k}`} checked={!!planForm.systems[k]} onCheckedChange={v => setPlanField("systems", { ...planForm.systems, [k]: !!v })} />
                      <label htmlFor={`ps-sys-${k}`} className="text-xs capitalize cursor-pointer">{k}</label>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <Separator />

            {/* ─ Competencies ─ */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("lp_section_competencies")}</p>
              <div className="flex flex-wrap gap-1.5">
                {COMPETENCIES.map(c => (
                  <button key={c} type="button"
                    onClick={() => setPlanField("competencies", planForm.competencies.includes(c) ? planForm.competencies.filter(x => x !== c) : [...planForm.competencies, c])}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${planForm.competencies.includes(c) ? "bg-teal-600 text-white border-teal-600" : "bg-background border-border hover:bg-accent"}`}>
                    {c}
                  </button>
                ))}
              </div>
              <div>
                <Label className="text-xs mb-1 block">{t("lp_specific_competences")}</Label>
                {planForm.specificCompetences.map((v, i) => (
                  <div key={i} className="flex gap-1.5 mb-1.5">
                    <Input value={v} onChange={e => { const a = [...planForm.specificCompetences]; a[i] = e.target.value; setPlanField("specificCompetences", a); }} placeholder={t("lp_ph_competence")} className="flex-1 h-8 text-sm" />
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setPlanField("specificCompetences", planForm.specificCompetences.filter((_, j) => j !== i))}><X className="w-3.5 h-3.5 text-red-400" /></Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setPlanField("specificCompetences", [...planForm.specificCompetences, ""])}><Plus className="w-3 h-3 mr-1" /> {t("lp_add")}</Button>
              </div>
            </div>

            <Separator />

            {/* ─ Curriculum ─ */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("lp_section_curriculum")}</p>
              {(["saberesBasicos", "learningOutcomes", "evaluationCriteria"] as const).map(field => (
                <div key={field}>
                  <Label className="text-xs mb-1 block">{t(field === "saberesBasicos" ? "lp_saberes_basicos" : field === "learningOutcomes" ? "lp_learning_outcomes" : "lp_evaluation_criteria")}</Label>
                  {planForm[field].map((v, i) => (
                    <div key={i} className="flex gap-1.5 mb-1.5">
                      <Input value={v} onChange={e => { const a = [...planForm[field]]; a[i] = e.target.value; setPlanField(field, a); }} className="flex-1 h-8 text-sm" />
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setPlanField(field, planForm[field].filter((_, j) => j !== i))}><X className="w-3.5 h-3.5 text-red-400" /></Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setPlanField(field, [...planForm[field], ""])}><Plus className="w-3 h-3 mr-1" /> {t("lp_add")}</Button>
                </div>
              ))}
            </div>

            <Separator />

            {/* ─ Context ─ */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("lp_section_context")}</p>
              <div>
                <Label className="text-xs">{t("lp_previous_knowledge")}</Label>
                <Textarea value={planForm.previousKnowledge} onChange={e => setPlanField("previousKnowledge", e.target.value)} rows={2} className="text-sm" />
              </div>
              <div>
                <Label className="text-xs">{t("lp_materials_resources")}</Label>
                <Textarea value={planForm.materials} onChange={e => setPlanField("materials", e.target.value)} rows={2} className="text-sm" />
              </div>
            </div>

            <Separator />

            {/* ─ Procedure ─ */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("lp_section_procedure")}</p>
              {planForm.procedures.map((p, i) => (
                <div key={i} className="rounded-lg border p-3 space-y-2 bg-muted/20">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-muted-foreground">Stage {i + 1}</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setPlanField("procedures", planForm.procedures.filter((_, j) => j !== i))}><X className="w-3 h-3 text-red-400" /></Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">{t("lp_timing")}</Label>
                      <Input value={p.timing} onChange={e => { const ps = [...planForm.procedures]; ps[i] = { ...ps[i], timing: e.target.value }; setPlanField("procedures", ps); }} className="h-7 text-xs" />
                    </div>
                    <div>
                      <Label className="text-xs">{t("lp_stage")}</Label>
                      <Input value={p.stage} onChange={e => { const ps = [...planForm.procedures]; ps[i] = { ...ps[i], stage: e.target.value }; setPlanField("procedures", ps); }} className="h-7 text-xs" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">{t("lp_activities")}</Label>
                    <Textarea value={p.activities} onChange={e => { const ps = [...planForm.procedures]; ps[i] = { ...ps[i], activities: e.target.value }; setPlanField("procedures", ps); }} rows={2} className="text-xs" />
                  </div>
                  <div>
                    <Label className="text-xs">{t("lp_grouping")}</Label>
                    <Input value={p.grouping} onChange={e => { const ps = [...planForm.procedures]; ps[i] = { ...ps[i], grouping: e.target.value }; setPlanField("procedures", ps); }} className="h-7 text-xs" />
                  </div>
                </div>
              ))}
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setPlanField("procedures", [...planForm.procedures, { timing: "", stage: "", activities: "", grouping: "Pairs" }])}>
                <Plus className="w-3 h-3 mr-1" /> {t("lp_add_stage")}
              </Button>
            </div>

            {/* Bottom save button */}
            <div className="pb-2">
              <Button className="w-full gap-2" onClick={handleSavePlan} disabled={savePlanMutation.isPending}>
                <Save className="w-4 h-4" />
                {savePlanMutation.isPending ? t("lp_saving") : t("lp_save")}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </DashboardLayout>
  );
}
