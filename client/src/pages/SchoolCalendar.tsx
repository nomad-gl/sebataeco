import { useState, useMemo, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  ChevronLeft, ChevronRight, Plus, Sparkles, Trash2, CalendarDays,
  ExternalLink, LayoutList, Pencil, School, BookOpen, User, GraduationCap,
  FolderOpen, X, Check,
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { useLocation } from "wouter";
import { useI18n } from "@/contexts/I18nContext";

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
};

const DEFAULT_TERMS = [
  { label: "Term 1", start: "", end: "" },
  { label: "Term 2", start: "", end: "" },
  { label: "Term 3", start: "", end: "" },
];

const emptyCalForm = (academicYear = ACADEMIC_YEARS[1]) => ({
  name: "",
  schoolName: "",
  tutorName: "",
  subject: "English",
  yearLevel: YEAR_GROUPS[3],
  academicYear,
  calendarType: "full_year" as "full_year" | "topic_block",
  startDate: "",
  endDate: "",
  topicDescription: "",
});

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

  // Calendar form
  const [calForm, setCalForm] = useState(emptyCalForm());

  // Event form
  const [form, setForm] = useState({ eventType: "lesson", title: "", description: "", competency: "", yearGroup: "", subject: "" });

  // AI infill form
  const [aiForm, setAiForm] = useState({ sessionsPerWeek: 3, terms: DEFAULT_TERMS });

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
      toast.success(`${t("cal_ai_infill")}: ${data.generated} lessons`);
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

  const openAdd = (date: Date) => {
    if (!selectedCalendarId) { toast.error("Please select or create a calendar first"); return; }
    setSelectedDate(date.toISOString().split("T")[0]);
    setForm({ eventType: "lesson", title: "", description: "", competency: selectedCalendar?.subject ? "" : "", yearGroup: selectedCalendar?.yearLevel ?? "", subject: selectedCalendar?.subject ?? "" });
    setShowAddDialog(true);
  };

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

  const openLessonPlanner = (ev: CalEvent) => {
    const date = new Date(ev.eventDate);
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    // Try to parse LOMLOE details from description JSON
    let extra: Record<string, string> = {};
    if (ev.description) {
      try {
        const parsed = JSON.parse(ev.description);
        if (parsed.learningOutcomes) extra.learningOutcomes = JSON.stringify(parsed.learningOutcomes);
        if (parsed.saberesBasicos) extra.saberesBasicos = JSON.stringify(parsed.saberesBasicos);
        if (parsed.evaluationCriteria) extra.evaluationCriteria = JSON.stringify(parsed.evaluationCriteria);
        if (parsed.specificCompetences) extra.specificCompetences = JSON.stringify(parsed.specificCompetences);
      } catch (_) {}
    }
    const params = new URLSearchParams({
      title: ev.title,
      date: dateStr,
      ...(ev.yearGroup ? { yearGroup: ev.yearGroup } : {}),
      ...(ev.subject ? { subject: ev.subject } : {}),
      ...(ev.competency ? { competency: ev.competency } : {}),
      ...extra,
    });
    navigate(`/lesson-planner?${params.toString()}`);
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
      <div className="flex h-[calc(100vh-64px)] overflow-hidden">
        {/* ── Calendar Picker Sidebar ─────────────────────────────────────── */}
        <aside className="w-60 border-r flex flex-col shrink-0 bg-muted/20">
          <div className="p-3 border-b flex items-center justify-between gap-2 min-h-[48px]">
            <span className="font-semibold text-sm flex items-center gap-1.5 truncate">
              <FolderOpen className="w-4 h-4 text-primary shrink-0" /> {t("cal_title").split(" ")[0]}
            </span>
            <Button
              size="sm"
              variant="outline"
              className="shrink-0 h-7 px-2 gap-1 text-xs"
              onClick={() => { setCalForm(emptyCalForm()); setShowCreateCalDialog(true); }}
              title="Create new calendar"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">New</span>
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {(calendars as SchoolCalendar[]).length === 0 && (
              <p className="text-xs text-muted-foreground p-2">No calendars yet. Create one!</p>
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
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {selectedCalendar === null ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
              <CalendarDays className="w-12 h-12 text-muted-foreground/40" />
              <div>
                <p className="font-medium">{t("cal_title")}</p>
                <p className="text-sm text-muted-foreground mt-1">Create a calendar in the sidebar to get started.</p>
              </div>
              <Button onClick={() => { setCalForm(emptyCalForm()); setShowCreateCalDialog(true); }} className="gap-2">
                <Plus className="w-4 h-4" /> Create Calendar
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
                          “{(selectedCalendar as SchoolCalendar).topicDescription}”
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Button variant="outline" size="sm" onClick={() => setShowTermView(v => !v)} className="gap-1.5">
                        <LayoutList className="w-3.5 h-3.5" /> {showTermView ? t("cal_month_view") : t("cal_term_overview")}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setShowAiDialog(true)} className="gap-1.5">
                        <Sparkles className="w-3.5 h-3.5" /> {t("cal_ai_infill")}
                      </Button>
                      <Button size="sm" onClick={() => openAdd(new Date())} className="gap-1.5">
                        <Plus className="w-3.5 h-3.5" /> {t("cal_add_event")}
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

              {/* ── Month Calendar ───────────────────────────────────────── */}
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
                    {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(d => (
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
                          className={`min-h-[76px] rounded-lg border p-1 cursor-pointer hover:bg-accent/50 transition-colors ${isWeekend ? "bg-muted/30" : ""} ${isToday ? "ring-2 ring-primary" : ""}`}
                          onClick={() => !isWeekend && openAdd(day)}
                        >
                          <div className={`text-xs font-medium mb-1 ${isToday ? "text-primary" : "text-muted-foreground"}`}>{day.getDate()}</div>
                          <div className="space-y-0.5">
                            {dayEvents.slice(0, 3).map(ev => (
                              <div
                                key={ev.id}
                                className={`text-[10px] px-1 py-0.5 rounded border truncate cursor-pointer ${EVENT_COLORS[ev.eventType] ?? "bg-gray-100 text-gray-800"}`}
                                onClick={e => {
                                  e.stopPropagation();
                                  if (ev.eventType === "lesson" || ev.eventType === "ai_generated") openLessonPlanner(ev);
                                  else openEdit(ev);
                                }}
                                title={(ev.eventType === "lesson" || ev.eventType === "ai_generated") ? `${t("cal_open_planner")}: ${ev.title}` : ev.title}
                              >
                                {ev.title}
                              </div>
                            ))}
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

              {/* ── Legend ───────────────────────────────────────────────── */}
              <div className="flex flex-wrap gap-2">
                {Object.entries(eventLabels).map(([type, label]) => (
                  <Badge key={type} variant="outline" className={`text-xs ${EVENT_COLORS[type]}`}>{label}</Badge>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Create Calendar Dialog ──────────────────────────────────────────── */}
      <Dialog open={showCreateCalDialog} onOpenChange={setShowCreateCalDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><CalendarDays className="w-5 h-5 text-primary" /> Create New Calendar</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {/* Calendar type toggle */}
            <div>
              <Label className="text-sm font-semibold mb-2 block">Calendar Type</Label>
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
                  <div className="font-semibold text-sm flex items-center gap-1.5"><CalendarDays className="w-4 h-4" /> Full Academic Year</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Standard school year with term dates</div>
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
                  <div className="font-semibold text-sm flex items-center gap-1.5"><BookOpen className="w-4 h-4" /> Topic Block</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Short-term unit with specific dates</div>
                </button>
              </div>
            </div>

            <div>
              <Label>Calendar Name *</Label>
              <Input value={calForm.name} onChange={e => setCalForm(f => ({ ...f, name: e.target.value }))} placeholder={calForm.calendarType === "topic_block" ? "e.g. Fractions Unit – 4th Primary" : "e.g. 4th Primary English 2025-26"} />
            </div>

            {/* Topic block: start/end dates + topic description */}
            {calForm.calendarType === "topic_block" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Start Date *</Label>
                    <Input type="date" value={calForm.startDate} onChange={e => setCalForm(f => ({ ...f, startDate: e.target.value }))} />
                  </div>
                  <div>
                    <Label>End Date *</Label>
                    <Input type="date" value={calForm.endDate} onChange={e => setCalForm(f => ({ ...f, endDate: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <Label>Topic / Unit Description</Label>
                  <Textarea
                    value={calForm.topicDescription}
                    onChange={e => setCalForm(f => ({ ...f, topicDescription: e.target.value }))}
                    placeholder="Describe the topic or unit (e.g. 'Introduction to fractions: halves, quarters, and eighths. Students will compare, order, and add simple fractions using visual models.'). The AI will use this to generate LOMLOE-aligned lessons scoped to this topic."
                    rows={4}
                    className="resize-none"
                  />
                  <p className="text-xs text-muted-foreground mt-1">The AI will use this description to generate lessons specifically aligned to this topic/unit.</p>
                </div>
              </>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label><School className="w-3.5 h-3.5 inline mr-1" /> School Name</Label>
                <Input value={calForm.schoolName} onChange={e => setCalForm(f => ({ ...f, schoolName: e.target.value }))} placeholder="e.g. IES Montserrat" />
              </div>
              <div>
                <Label><User className="w-3.5 h-3.5 inline mr-1" /> Tutor Name</Label>
                <Input value={calForm.tutorName} onChange={e => setCalForm(f => ({ ...f, tutorName: e.target.value }))} placeholder="e.g. Ms García" />
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
              <Label>Academic Year</Label>
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
              <Check className="w-4 h-4" /> Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Calendar Dialog ────────────────────────────────────────────── */}
      <Dialog open={showEditCalDialog} onOpenChange={setShowEditCalDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Pencil className="w-5 h-5" /> Edit Calendar</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {/* Calendar type toggle */}
            <div>
              <Label className="text-sm font-semibold mb-2 block">Calendar Type</Label>
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
                  <div className="font-semibold text-sm flex items-center gap-1.5"><CalendarDays className="w-4 h-4" /> Full Academic Year</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Standard school year with term dates</div>
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
                  <div className="font-semibold text-sm flex items-center gap-1.5"><BookOpen className="w-4 h-4" /> Topic Block</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Short-term unit with specific dates</div>
                </button>
              </div>
            </div>

            <div>
              <Label>Calendar Name *</Label>
              <Input value={calForm.name} onChange={e => setCalForm(f => ({ ...f, name: e.target.value }))} />
            </div>

            {calForm.calendarType === "topic_block" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Start Date</Label>
                    <Input type="date" value={calForm.startDate} onChange={e => setCalForm(f => ({ ...f, startDate: e.target.value }))} />
                  </div>
                  <div>
                    <Label>End Date</Label>
                    <Input type="date" value={calForm.endDate} onChange={e => setCalForm(f => ({ ...f, endDate: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <Label>Topic / Unit Description</Label>
                  <Textarea
                    value={calForm.topicDescription}
                    onChange={e => setCalForm(f => ({ ...f, topicDescription: e.target.value }))}
                    placeholder="Describe the topic or unit. The AI will use this to generate LOMLOE-aligned lessons scoped to this topic."
                    rows={4}
                    className="resize-none"
                  />
                </div>
              </>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>School Name</Label>
                <Input value={calForm.schoolName} onChange={e => setCalForm(f => ({ ...f, schoolName: e.target.value }))} />
              </div>
              <div>
                <Label>Tutor Name</Label>
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
              <Label>Academic Year</Label>
              <Select value={calForm.academicYear} onValueChange={v => setCalForm(f => ({ ...f, academicYear: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ACADEMIC_YEARS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="flex justify-between">
            <Button variant="destructive" size="sm" onClick={() => { if (selectedCalendarId) deleteCalMutation.mutate({ id: selectedCalendarId }); setShowEditCalDialog(false); }}>
              <Trash2 className="w-4 h-4 mr-1" /> Delete Calendar
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

      {/* ── Add Event Dialog ────────────────────────────────────────────────── */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{t("cal_add_event")} — {selectedDate}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>{t("cal_event_type")}</Label>
              <Select value={form.eventType} onValueChange={v => setForm(f => ({ ...f, eventType: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(eventLabels).filter(([type]) => type !== "ai_generated").map(([type, label]) => <SelectItem key={type} value={type}>{label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("cal_event_title")} *</Label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Event title" />
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
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>{YEAR_GROUPS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{t("cal_subject")}</Label>
                    <Select value={form.subject} onValueChange={v => setForm(f => ({ ...f, subject: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>{SUBJECTS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>{t("cal_competency")}</Label>
                  <Select value={form.competency} onValueChange={v => setForm(f => ({ ...f, competency: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
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
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{YEAR_GROUPS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t("cal_subject")}</Label>
                <Select value={form.subject} onValueChange={v => setForm(f => ({ ...f, subject: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{SUBJECTS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>{t("cal_competency")}</Label>
              <Select value={form.competency} onValueChange={v => setForm(f => ({ ...f, competency: v }))}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
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
                <Badge className="bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100"><BookOpen className="w-3 h-3 mr-1" /> Topic Block</Badge>
              )}
            </div>
          )}
          {selectedCalendar && (selectedCalendar as SchoolCalendar).calendarType === "topic_block" && (selectedCalendar as SchoolCalendar).topicDescription && (
            <div className="rounded-md bg-amber-50 border border-amber-200 p-3">
              <p className="text-xs font-semibold text-amber-800 mb-1">Topic / Unit</p>
              <p className="text-xs text-amber-700 italic">"{(selectedCalendar as SchoolCalendar).topicDescription}"</p>
              <p className="text-xs text-amber-600 mt-1">The AI will generate lessons specifically aligned to this topic.</p>
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
    </DashboardLayout>
  );
}
