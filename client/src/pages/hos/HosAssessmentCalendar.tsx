import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/contexts/I18nContext";
import NavBar from "@/components/NavBar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2, Plus, Pencil, Trash2, CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type EventType = "exam" | "evaluation" | "deadline" | "meeting" | "other";

const EVENT_COLORS: Record<EventType, string> = {
  exam:       "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300",
  evaluation: "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300",
  deadline:   "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300",
  meeting:    "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300",
  other:      "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800/30 dark:text-gray-300",
};

const EVENT_DOT: Record<EventType, string> = {
  exam:       "bg-red-500",
  evaluation: "bg-orange-500",
  deadline:   "bg-yellow-500",
  meeting:    "bg-blue-500",
  other:      "bg-gray-400",
};

type AssessmentEvent = {
  id: number;
  title: string;
  eventType: EventType;
  yearGroup?: string | null;
  subject?: string | null;
  startDate: string;
  endDate: string;
  notes?: string | null;
  academicYear: string;
};

const EMPTY_FORM = {
  title: "",
  eventType: "exam" as EventType,
  yearGroup: "",
  subject: "",
  startDate: "",
  endDate: "",
  notes: "",
  academicYear: "2025-26",
};

export default function HosAssessmentCalendar() {
  const { t } = useI18n();
  const utils = trpc.useUtils();

  const [academicYear] = useState("2025-26");
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<AssessmentEvent | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const { data: events = [], isLoading } = trpc.hos.getAssessmentEvents.useQuery({ academicYear });
  // Using acal_ prefixed i18n keys to avoid conflict with School Calendar Planner keys

  const upsertMutation = trpc.hos.upsertAssessmentEvent.useMutation({
    onSuccess: () => {
      utils.hos.getAssessmentEvents.invalidate();
      setDialogOpen(false);
      setEditingEvent(null);
      setForm(EMPTY_FORM);
      toast.success(t("acal_event_saved"));
    },
    onError: () => toast.error(t("acal_event_error")),
  });

  const deleteMutation = trpc.hos.deleteAssessmentEvent.useMutation({
    onSuccess: () => {
      utils.hos.getAssessmentEvents.invalidate();
      toast.success(t("acal_event_deleted"));
    },
    onError: () => toast.error(t("acal_event_error")),
  });

  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const startOffset = (firstDay + 6) % 7;
    const days: (string | null)[] = Array(startOffset).fill(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const mm = String(month + 1).padStart(2, "0");
      const dd = String(d).padStart(2, "0");
      days.push(`${year}-${mm}-${dd}`);
    }
    while (days.length % 7 !== 0) days.push(null);
    return days;
  }, [currentMonth]);

  const eventsByDate = useMemo(() => {
    const map: Record<string, AssessmentEvent[]> = {};
    for (const ev of events as AssessmentEvent[]) {
      const start = new Date(ev.startDate + "T00:00:00");
      const end = new Date(ev.endDate + "T00:00:00");
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const key = d.toISOString().slice(0, 10);
        if (!map[key]) map[key] = [];
        map[key].push(ev);
      }
    }
    return map;
  }, [events]);

  const selectedDayEvents = selectedDay ? (eventsByDate[selectedDay] ?? []) : [];

  function openAdd(date?: string) {
    setEditingEvent(null);
    setForm({ ...EMPTY_FORM, startDate: date ?? "", endDate: date ?? "" });
    setDialogOpen(true);
  }

  function openEdit(ev: AssessmentEvent) {
    setEditingEvent(ev);
    setForm({
      title: ev.title,
      eventType: ev.eventType,
      yearGroup: ev.yearGroup ?? "",
      subject: ev.subject ?? "",
      startDate: ev.startDate,
      endDate: ev.endDate,
      notes: ev.notes ?? "",
      academicYear: ev.academicYear,
    });
    setDialogOpen(true);
  }

  function handleSave() {
    if (!form.title.trim()) { toast.error(t("acal_title_required")); return; }
    if (!form.startDate) { toast.error(t("acal_date_required")); return; }
    upsertMutation.mutate({
      ...(editingEvent ? { id: editingEvent.id } : {}),
      title: form.title,
      eventType: form.eventType,
      yearGroup: form.yearGroup || undefined,
      subject: form.subject || undefined,
      startDate: form.startDate,
      endDate: form.endDate || form.startDate,
      notes: form.notes || undefined,
      academicYear: form.academicYear,
    });
  }

  const monthLabel = currentMonth.toLocaleDateString("ca-ES", { month: "long", year: "numeric" });
  const today = new Date().toISOString().slice(0, 10);
  const DAY_LABELS = ["Dl", "Dm", "Dc", "Dj", "Dv", "Ds", "Dg"];

  return (
    <div className="chat-bg min-h-screen flex flex-col">
      <NavBar />
      <div className="container py-6 max-w-6xl mx-auto w-full flex-1 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-white/15">
              <CalendarDays className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">{t("acal_title")}</h1>
              <p className="text-sm text-white/70">{t("acal_desc")}</p>
            </div>
          </div>
          <Button onClick={() => openAdd()} className="gap-2 bg-white text-primary hover:bg-white/90">
            <Plus className="w-4 h-4" />
            {t("acal_add_event")}
          </Button>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-2">
          {(Object.keys(EVENT_COLORS) as EventType[]).map((type) => (
            <span key={type} className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border", EVENT_COLORS[type])}>
              <span className={cn("w-1.5 h-1.5 rounded-full", EVENT_DOT[type])} />
              {t(`acal_type_${type}` as any)}
            </span>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Calendar grid */}
          <Card className="lg:col-span-2 bg-white/10 backdrop-blur-md border-white/20">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))} className="text-white hover:bg-white/10">
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <CardTitle className="text-white text-base capitalize">{monthLabel}</CardTitle>
                <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))} className="text-white hover:bg-white/10">
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-white/60" />
                </div>
              ) : (
                <div className="grid grid-cols-7 gap-1">
                  {DAY_LABELS.map(d => (
                    <div key={d} className="text-center text-xs font-semibold text-white/50 py-1">{d}</div>
                  ))}
                  {calendarDays.map((dateStr, i) => {
                    if (!dateStr) return <div key={`empty-${i}`} />;
                    const dayEvents = eventsByDate[dateStr] ?? [];
                    const isToday = dateStr === today;
                    const isSelected = dateStr === selectedDay;
                    return (
                      <button
                        key={dateStr}
                        onClick={() => setSelectedDay(isSelected ? null : dateStr)}
                        className={cn(
                          "relative min-h-[52px] rounded-lg p-1 text-left transition-all border",
                          isSelected ? "bg-white/25 border-white/60" : "bg-white/5 border-white/10 hover:bg-white/15",
                          isToday && "ring-2 ring-white/40"
                        )}
                      >
                        <span className={cn("text-xs font-medium", isToday ? "text-white font-bold" : "text-white/80")}>
                          {parseInt(dateStr.slice(8))}
                        </span>
                        <div className="flex flex-wrap gap-0.5 mt-0.5">
                          {dayEvents.slice(0, 3).map((ev) => (
                            <span key={ev.id} className={cn("w-2 h-2 rounded-full", EVENT_DOT[ev.eventType])} />
                          ))}
                          {dayEvents.length > 3 && (
                            <span className="text-white/50 text-[9px] leading-none">+{dayEvents.length - 3}</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Day detail panel */}
          <Card className="bg-white/10 backdrop-blur-md border-white/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-sm">
                {selectedDay
                  ? new Date(selectedDay + "T00:00:00").toLocaleDateString("ca-ES", { weekday: "long", day: "numeric", month: "long" })
                  : t("acal_select_day")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {!selectedDay && (
                <p className="text-white/50 text-sm">{t("acal_click_day")}</p>
              )}
              {selectedDay && selectedDayEvents.length === 0 && (
                <div className="text-center py-6 space-y-2">
                  <p className="text-white/50 text-sm">{t("acal_no_events")}</p>
                  <Button size="sm" variant="outline" onClick={() => openAdd(selectedDay)} className="bg-white/10 border-white/20 text-white hover:bg-white/20 gap-1.5">
                    <Plus className="w-3.5 h-3.5" />
                    {t("acal_add_event")}
                  </Button>
                </div>
              )}
              {selectedDayEvents.map((ev) => (
                <div key={ev.id} className={cn("rounded-lg p-3 border text-xs space-y-1", EVENT_COLORS[ev.eventType])}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-sm leading-tight">{ev.title}</p>
                    <div className="flex gap-1 flex-shrink-0">
                      <button onClick={() => openEdit(ev)} className="opacity-60 hover:opacity-100 transition-opacity">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => deleteMutation.mutate({ id: ev.id })} className="opacity-60 hover:opacity-100 transition-opacity">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  {ev.subject && <p className="opacity-75">{ev.subject}</p>}
                  {ev.yearGroup && <p className="opacity-75">{ev.yearGroup}</p>}
                  {ev.notes && <p className="opacity-60 italic">{ev.notes}</p>}
                </div>
              ))}
              {selectedDay && selectedDayEvents.length > 0 && (
                <Button size="sm" variant="outline" onClick={() => openAdd(selectedDay)} className="w-full bg-white/10 border-white/20 text-white hover:bg-white/20 gap-1.5 mt-2">
                  <Plus className="w-3.5 h-3.5" />
                  {t("acal_add_event")}
                </Button>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Upcoming events list */}
        <Card className="bg-white/10 backdrop-blur-md border-white/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-sm">{t("acal_upcoming")}</CardTitle>
          </CardHeader>
          <CardContent>
            {(events as AssessmentEvent[]).filter(ev => ev.startDate >= today).length === 0 ? (
              <p className="text-white/50 text-sm">{t("acal_no_upcoming")}</p>
            ) : (
              <div className="space-y-2">
                {(events as AssessmentEvent[])
                  .filter(ev => ev.startDate >= today)
                  .slice(0, 8)
                  .map(ev => (
                    <div key={ev.id} className="flex items-center gap-3 py-2 border-b border-white/10 last:border-0">
                      <span className={cn("w-2 h-2 rounded-full flex-shrink-0", EVENT_DOT[ev.eventType])} />
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium truncate">{ev.title}</p>
                        <p className="text-white/50 text-xs">
                          {ev.startDate}{ev.endDate !== ev.startDate ? ` → ${ev.endDate}` : ""}
                          {ev.subject ? ` · ${ev.subject}` : ""}
                          {ev.yearGroup ? ` · ${ev.yearGroup}` : ""}
                        </p>
                      </div>
                      <div className="flex gap-1.5 flex-shrink-0">
                        <button onClick={() => openEdit(ev)} className="text-white/50 hover:text-white transition-colors">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => deleteMutation.mutate({ id: ev.id })} className="text-white/50 hover:text-white transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) { setEditingEvent(null); setForm(EMPTY_FORM); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingEvent ? t("acal_edit_event") : t("acal_add_event")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>{t("acal_event_title")} *</Label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder={t("acal_event_title_placeholder")} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t("acal_event_type")}</Label>
                <Select value={form.eventType} onValueChange={v => setForm(f => ({ ...f, eventType: v as EventType }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="exam">{t("acal_type_exam")}</SelectItem>
                    <SelectItem value="evaluation">{t("acal_type_evaluation")}</SelectItem>
                    <SelectItem value="deadline">{t("acal_type_deadline")}</SelectItem>
                    <SelectItem value="meeting">{t("acal_type_meeting")}</SelectItem>
                    <SelectItem value="other">{t("acal_type_other")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t("acal_year_group")}</Label>
                <Input value={form.yearGroup} onChange={e => setForm(f => ({ ...f, yearGroup: e.target.value }))} placeholder="e.g. 1r ESO" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t("acal_start_date")} *</Label>
                <Input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value, endDate: f.endDate || e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("acal_end_date")}</Label>
                <Input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{t("acal_subject")}</Label>
              <Input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} placeholder="e.g. Matemàtiques" />
            </div>
            <div className="space-y-1.5">
              <Label>{t("acal_notes")}</Label>
              <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder={t("acal_notes_placeholder")} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t("btn_cancel")}</Button>
            <Button onClick={handleSave} disabled={upsertMutation.isPending}>
              {upsertMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {t("btn_save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
