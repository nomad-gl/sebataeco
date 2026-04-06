import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Plus, Sparkles, Trash2, Pencil, CalendarDays, ExternalLink, LayoutList } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { useLocation } from "wouter";

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

const EVENT_LABELS: Record<string, string> = {
  holiday: "Holiday",
  special: "Special Day",
  exam: "Exam",
  excursion: "Excursion",
  event: "Event",
  lesson: "Lesson",
  ai_generated: "AI Lesson",
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

// Default Spanish school term dates
const DEFAULT_TERMS = [
  { label: "Term 1", start: "", end: "" },
  { label: "Term 2", start: "", end: "" },
  { label: "Term 3", start: "", end: "" },
];

export default function SchoolCalendar() {
  const [, navigate] = useLocation();
  const [academicYear, setAcademicYear] = useState(ACADEMIC_YEARS[1]);
  const [viewMonth, setViewMonth] = useState(8); // September = 8
  const [viewYear, setViewYear] = useState(CURRENT_YEAR);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showAiDialog, setShowAiDialog] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [editingEvent, setEditingEvent] = useState<CalEvent | null>(null);
  const [showTermView, setShowTermView] = useState(false);

  // Form state
  const [form, setForm] = useState({ eventType: "lesson", title: "", description: "", competency: "", yearGroup: "", subject: "" });
  const [aiForm, setAiForm] = useState({ yearGroup: YEAR_GROUPS[3], subject: "English", sessionsPerWeek: 3, terms: DEFAULT_TERMS });

  const utils = trpc.useUtils();
  const { data: events = [] } = trpc.planner.listCalendarEvents.useQuery({ academicYear });

  const createMutation = trpc.planner.createCalendarEvent.useMutation({
    onSuccess: () => { utils.planner.listCalendarEvents.invalidate(); setShowAddDialog(false); toast.success("Event added"); },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = trpc.planner.updateCalendarEvent.useMutation({
    onSuccess: () => { utils.planner.listCalendarEvents.invalidate(); setShowEditDialog(false); toast.success("Event updated"); },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.planner.deleteCalendarEvent.useMutation({
    onSuccess: () => { utils.planner.listCalendarEvents.invalidate(); toast.success("Event deleted"); },
    onError: (e) => toast.error(e.message),
  });

  const aiInfillMutation = trpc.planner.aiInfillCalendar.useMutation({
    onSuccess: (data) => { utils.planner.listCalendarEvents.invalidate(); setShowAiDialog(false); toast.success(`AI generated ${data.generated} lessons`); },
    onError: (e) => toast.error(e.message),
  });

  // Build calendar grid for the current view month
  const calendarDays = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1);
    const lastDay = new Date(viewYear, viewMonth + 1, 0);
    const startDow = (firstDay.getDay() + 6) % 7; // Mon=0
    const days: (Date | null)[] = [];
    for (let i = 0; i < startDow; i++) days.push(null);
    for (let d = 1; d <= lastDay.getDate(); d++) days.push(new Date(viewYear, viewMonth, d));
    return days;
  }, [viewMonth, viewYear]);

  // Map events to date strings
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
    setSelectedDate(date.toISOString().split("T")[0]);
    setForm({ eventType: "lesson", title: "", description: "", competency: "", yearGroup: "", subject: "" });
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
    if (!form.title.trim()) return;
    createMutation.mutate({
      academicYear,
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
    const validTerms = aiForm.terms.filter(t => t.start && t.end);
    if (validTerms.length === 0) {
      toast.error("Please enter at least one term date range");
      return;
    }
    aiInfillMutation.mutate({
      academicYear,
      yearGroup: aiForm.yearGroup,
      subject: aiForm.subject,
      sessionsPerWeek: aiForm.sessionsPerWeek,
      termDates: validTerms,
    });
  };

  // Open Lesson Planner pre-filled from a lesson event
  const openLessonPlanner = (ev: CalEvent) => {
    const date = new Date(ev.eventDate);
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const params = new URLSearchParams({
      title: ev.title,
      date: dateStr,
      ...(ev.yearGroup ? { yearGroup: ev.yearGroup } : {}),
      ...(ev.subject ? { subject: ev.subject } : {}),
      ...(ev.competency ? { competency: ev.competency } : {}),
    });
    navigate(`/lesson-planner?${params.toString()}`);
  };

  // Term overview: group events by ISO week for the current academic year
  const termWeeks = useMemo(() => {
    const weeks: Record<string, { weekLabel: string; events: CalEvent[] }> = {};
    for (const ev of events) {
      const d = new Date(ev.eventDate);
      // ISO week number
      const jan4 = new Date(d.getFullYear(), 0, 4);
      const weekNum = Math.ceil(((d.getTime() - jan4.getTime()) / 86400000 + jan4.getDay() + 1) / 7);
      const key = `${d.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;
      if (!weeks[key]) weeks[key] = { weekLabel: key, events: [] };
      weeks[key].events.push(ev);
    }
    return Object.values(weeks).sort((a, b) => a.weekLabel.localeCompare(b.weekLabel));
  }, [events]);

  // Summary stats
  const totalEvents = events.length;
  const aiEvents = events.filter(e => e.aiGenerated).length;
  const holidays = events.filter(e => e.eventType === "holiday").length;

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <CalendarDays className="w-6 h-6 text-primary" />
              School Calendar Planner
            </h1>
            <p className="text-muted-foreground text-sm mt-1">Map your full academic year with holidays, events, and AI-generated lessons</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={academicYear} onValueChange={setAcademicYear}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>{ACADEMIC_YEARS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
            </Select>
            <Button variant="outline" onClick={() => setShowTermView(v => !v)} className="gap-2">
              <LayoutList className="w-4 h-4" /> {showTermView ? "Month View" : "Term Overview"}
            </Button>
            <Button variant="outline" onClick={() => setShowAiDialog(true)} className="gap-2">
              <Sparkles className="w-4 h-4" /> AI Infill
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card><CardContent className="pt-4 text-center"><div className="text-2xl font-bold">{totalEvents}</div><div className="text-xs text-muted-foreground">Total Events</div></CardContent></Card>
          <Card><CardContent className="pt-4 text-center"><div className="text-2xl font-bold text-teal-600">{aiEvents}</div><div className="text-xs text-muted-foreground">AI Generated</div></CardContent></Card>
          <Card><CardContent className="pt-4 text-center"><div className="text-2xl font-bold text-red-600">{holidays}</div><div className="text-xs text-muted-foreground">Holidays</div></CardContent></Card>
        </div>

        {/* Calendar */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="icon" onClick={prevMonth}><ChevronLeft className="w-4 h-4" /></Button>
              <CardTitle className="text-lg">{MONTHS[viewMonth]} {viewYear}</CardTitle>
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
                    className={`min-h-[80px] rounded-lg border p-1 cursor-pointer hover:bg-accent/50 transition-colors ${isWeekend ? "bg-muted/30" : ""} ${isToday ? "ring-2 ring-primary" : ""}`}
                    onClick={() => !isWeekend && openAdd(day)}
                  >
                    <div className={`text-xs font-medium mb-1 ${isToday ? "text-primary" : "text-muted-foreground"}`}>{day.getDate()}</div>
                    <div className="space-y-0.5">
                      {dayEvents.slice(0, 3).map(ev => (
                        <div
                          key={ev.id}
                          className={`text-[10px] px-1 py-0.5 rounded border truncate cursor-pointer ${EVENT_COLORS[ev.eventType] ?? "bg-gray-100 text-gray-800"} flex items-center gap-0.5`}
                          onClick={e => {
                            e.stopPropagation();
                            if (ev.eventType === "lesson" || ev.eventType === "ai_generated") openLessonPlanner(ev);
                            else openEdit(ev);
                          }}
                          title={(ev.eventType === "lesson" || ev.eventType === "ai_generated") ? `Open in Lesson Planner: ${ev.title}` : ev.title}
                        >
                          {ev.title}
                        </div>
                      ))}
                      {dayEvents.length > 3 && (
                        <div className="text-[10px] text-muted-foreground px-1">+{dayEvents.length - 3} more</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Term Overview (weekly strip) */}
        {showTermView && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Term Overview — {academicYear}</CardTitle>
            </CardHeader>
            <CardContent>
              {termWeeks.length === 0 ? (
                <p className="text-sm text-muted-foreground">No events yet. Use AI Infill or add events to see the term overview.</p>
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
                            title={(ev.eventType === "lesson" || ev.eventType === "ai_generated") ? `Open in Lesson Planner: ${ev.title}` : ev.title}
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

        {/* Legend */}
        <div className="flex flex-wrap gap-2">
          {Object.entries(EVENT_LABELS).map(([type, label]) => (
            <Badge key={type} variant="outline" className={`text-xs ${EVENT_COLORS[type]}`}>{label}</Badge>
          ))}
        </div>

        {/* Add Event Dialog */}
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Add Event — {selectedDate}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Type</Label>
                <Select value={form.eventType} onValueChange={v => setForm(f => ({ ...f, eventType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(EVENT_LABELS).filter(([t]) => t !== "ai_generated").map(([t, l]) => <SelectItem key={t} value={t}>{l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Title *</Label>
                <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Event title" />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} />
              </div>
              {(form.eventType === "lesson" || form.eventType === "event") && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Year Group</Label>
                      <Select value={form.yearGroup} onValueChange={v => setForm(f => ({ ...f, yearGroup: v }))}>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>{YEAR_GROUPS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Subject</Label>
                      <Select value={form.subject} onValueChange={v => setForm(f => ({ ...f, subject: v }))}>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>{SUBJECTS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label>Competency</Label>
                    <Select value={form.competency} onValueChange={v => setForm(f => ({ ...f, competency: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>{COMPETENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={createMutation.isPending || !form.title.trim()}>
                {createMutation.isPending ? "Adding…" : "Add Event"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Event Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Edit Event</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Type</Label>
                <Select value={form.eventType} onValueChange={v => setForm(f => ({ ...f, eventType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(EVENT_LABELS).map(([t, l]) => <SelectItem key={t} value={t}>{l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Title *</Label>
                <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Year Group</Label>
                  <Select value={form.yearGroup} onValueChange={v => setForm(f => ({ ...f, yearGroup: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>{YEAR_GROUPS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Subject</Label>
                  <Select value={form.subject} onValueChange={v => setForm(f => ({ ...f, subject: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>{SUBJECTS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Competency</Label>
                <Select value={form.competency} onValueChange={v => setForm(f => ({ ...f, competency: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{COMPETENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter className="flex justify-between">
              <Button variant="destructive" size="sm" onClick={() => { if (editingEvent) deleteMutation.mutate({ id: editingEvent.id }); setShowEditDialog(false); }}>
                <Trash2 className="w-4 h-4 mr-1" /> Delete
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowEditDialog(false)}>Cancel</Button>
                <Button onClick={handleUpdate} disabled={updateMutation.isPending || !form.title.trim()}>
                  {updateMutation.isPending ? "Saving…" : "Save"}
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* AI Infill Dialog */}
        <Dialog open={showAiDialog} onOpenChange={setShowAiDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Sparkles className="w-5 h-5 text-teal-500" /> AI Calendar Infill</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">Enter your term dates and the AI will generate a full sequence of LOMLOE-aligned lessons for empty teaching days.</p>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Year Group</Label>
                  <Select value={aiForm.yearGroup} onValueChange={v => setAiForm(f => ({ ...f, yearGroup: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{YEAR_GROUPS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Subject</Label>
                  <Select value={aiForm.subject} onValueChange={v => setAiForm(f => ({ ...f, subject: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{SUBJECTS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Sessions per week</Label>
                <Select value={String(aiForm.sessionsPerWeek)} onValueChange={v => setAiForm(f => ({ ...f, sessionsPerWeek: Number(v) }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{[1, 2, 3, 4, 5].map(n => <SelectItem key={n} value={String(n)}>{n} session{n > 1 ? "s" : ""}/week</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Term Dates</Label>
                {aiForm.terms.map((term, i) => (
                  <div key={i} className="grid grid-cols-3 gap-2 items-center">
                    <span className="text-sm text-muted-foreground">{term.label}</span>
                    <Input type="date" value={term.start} onChange={e => setAiForm(f => ({ ...f, terms: f.terms.map((t, j) => j === i ? { ...t, start: e.target.value } : t) }))} />
                    <Input type="date" value={term.end} onChange={e => setAiForm(f => ({ ...f, terms: f.terms.map((t, j) => j === i ? { ...t, end: e.target.value } : t) }))} />
                  </div>
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAiDialog(false)}>Cancel</Button>
              <Button onClick={handleAiInfill} disabled={aiInfillMutation.isPending} className="gap-2">
                <Sparkles className="w-4 h-4" />
                {aiInfillMutation.isPending ? "Generating…" : "Generate Lessons"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
