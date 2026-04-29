import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/contexts/I18nContext";
import NavBar from "@/components/NavBar";
import BackButton from "@/components/BackButton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { CalendarDays, Plus, Trash2, Edit2, AlertTriangle, Users, Clock, BookOpen, Coffee, ChevronRight, GraduationCap, Library, Building2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const DAYS_ES = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"];
const DAYS_CA = ["Dilluns", "Dimarts", "Dimecres", "Dijous", "Divendres"];

function getDays(lang: string) {
  if (lang === "es") return DAYS_ES;
  if (lang === "ca") return DAYS_CA;
  return DAYS;
}

function formatBreakLength(start: string | Date, end: string | Date): string {
  const s = new Date(start);
  const e = new Date(end);
  const days = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  return `${days} day${days !== 1 ? "s" : ""}`;
}

function minutesToHoursLabel(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

// ── Calendar List View ──────────────────────────────────────────────────────

function CalendarList({ onSelect }: { onSelect: (id: number) => void }) {
  const { t, lang } = useI18n();
  const utils = trpc.useUtils();

  const { data: calendars = [], isLoading } = trpc.academicCalendar.listCalendars.useQuery();

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    academicYear: "2024-2025",
    semesterCount: "2",
    schoolStartTime: "08:30",
    schoolEndTime: "15:00",
    morningBreakStart: "10:30",
    morningBreakEnd: "10:50",
    lunchBreakStart: "12:30",
    lunchBreakEnd: "13:30",
  });
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const createMut = trpc.academicCalendar.createCalendar.useMutation({
    onSuccess: () => {
      utils.academicCalendar.listCalendars.invalidate();
      setShowCreate(false);
      toast.success(t("acal2_created"));
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMut = trpc.academicCalendar.deleteCalendar.useMutation({
    onSuccess: () => {
      utils.academicCalendar.listCalendars.invalidate();
      setDeleteId(null);
      toast.success(t("acal2_deleted"));
    },
    onError: (e) => toast.error(e.message),
  });

  const academicYears = Array.from({ length: 6 }, (_, i) => {
    const y = 2023 + i;
    return `${y}-${y + 1}`;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <CalendarDays className="w-6 h-6 text-blue-300" />
            {t("acal2_title")}
          </h1>
          <p className="text-blue-200 text-sm mt-1">{t("acal2_subtitle")}</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
          <Plus className="w-4 h-4" /> {t("acal2_new")}
        </Button>
      </div>

      {isLoading ? (
        <div className="text-blue-200 animate-pulse">{t("acal2_loading")}</div>
      ) : calendars.length === 0 ? (
        <Card className="bg-white/10 border-white/20 text-center py-16">
          <CardContent>
            <CalendarDays className="w-12 h-12 text-blue-300 mx-auto mb-4" />
            <p className="text-white font-medium text-lg">{t("acal2_empty_title")}</p>
            <p className="text-blue-200 text-sm mt-1">{t("acal2_empty_desc")}</p>
            <Button onClick={() => setShowCreate(true)} className="mt-4 bg-blue-600 hover:bg-blue-700 text-white gap-2">
              <Plus className="w-4 h-4" /> {t("acal2_new")}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {calendars.map((cal) => (
            <Card
              key={cal.id}
              className="bg-white/10 border-white/20 hover:bg-white/15 cursor-pointer transition-all group"
              onClick={() => onSelect(cal.id)}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-white flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <GraduationCap className="w-5 h-5 text-blue-300" />
                    {cal.academicYear}
                  </span>
                  <ChevronRight className="w-4 h-4 text-blue-300 group-hover:translate-x-1 transition-transform" />
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2 text-blue-200 text-sm">
                  <Clock className="w-3.5 h-3.5" />
                  {cal.schoolStartTime} – {cal.schoolEndTime}
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Badge variant="secondary" className="bg-blue-600/30 text-blue-100 border-0 text-xs">
                    {cal.semesterCount} {t("acal2_semesters")}
                  </Badge>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-300 hover:text-red-200 hover:bg-red-500/20 mt-1 h-7 px-2"
                  onClick={(e) => { e.stopPropagation(); setDeleteId(cal.id); }}
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1" /> {t("acal2_delete")}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Calendar Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("acal2_new_title")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t("acal2_year_label")}</Label>
              <Select value={form.academicYear} onValueChange={(v) => setForm(f => ({ ...f, academicYear: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {academicYears.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("acal2_semester_count")}</Label>
              <Select value={form.semesterCount} onValueChange={(v) => setForm(f => ({ ...f, semesterCount: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 {t("acal2_semester")}</SelectItem>
                  <SelectItem value="2">2 {t("acal2_semesters")}</SelectItem>
                  <SelectItem value="3">3 {t("acal2_semesters")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t("acal2_school_start")}</Label>
                <Input type="time" value={form.schoolStartTime} onChange={e => setForm(f => ({ ...f, schoolStartTime: e.target.value }))} />
              </div>
              <div>
                <Label>{t("acal2_school_end")}</Label>
                <Input type="time" value={form.schoolEndTime} onChange={e => setForm(f => ({ ...f, schoolEndTime: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t("acal2_morning_break_start")}</Label>
                <Input type="time" value={form.morningBreakStart} onChange={e => setForm(f => ({ ...f, morningBreakStart: e.target.value }))} />
              </div>
              <div>
                <Label>{t("acal2_morning_break_end")}</Label>
                <Input type="time" value={form.morningBreakEnd} onChange={e => setForm(f => ({ ...f, morningBreakEnd: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t("acal2_lunch_start")}</Label>
                <Input type="time" value={form.lunchBreakStart} onChange={e => setForm(f => ({ ...f, lunchBreakStart: e.target.value }))} />
              </div>
              <div>
                <Label>{t("acal2_lunch_end")}</Label>
                <Input type="time" value={form.lunchBreakEnd} onChange={e => setForm(f => ({ ...f, lunchBreakEnd: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>{t("acal2_cancel")}</Button>
            <Button
              onClick={() => createMut.mutate({
                academicYear: form.academicYear,
                semesterCount: parseInt(form.semesterCount),
                schoolStartTime: form.schoolStartTime,
                schoolEndTime: form.schoolEndTime,
                morningBreakStart: form.morningBreakStart || undefined,
                morningBreakEnd: form.morningBreakEnd || undefined,
                lunchBreakStart: form.lunchBreakStart || undefined,
                lunchBreakEnd: form.lunchBreakEnd || undefined,
              })}
              disabled={createMut.isPending}
            >
              {createMut.isPending ? t("acal2_creating") : t("acal2_create_btn")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("acal2_delete_confirm_title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("acal2_delete_confirm_desc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("acal2_cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => deleteId !== null && deleteMut.mutate({ id: deleteId })}
            >
              {t("acal2_delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Calendar Detail View ────────────────────────────────────────────────────

function CalendarDetail({ calendarId, onBack }: { calendarId: number; onBack: () => void }) {
  const { t, lang } = useI18n();
  const utils = trpc.useUtils();
  const days = getDays(lang);

  const { data, isLoading } = trpc.academicCalendar.getCalendar.useQuery({ id: calendarId });

  // Teacher form state
  const [showAddTeacher, setShowAddTeacher] = useState(false);
  const [editTeacher, setEditTeacher] = useState<{ id: number; name: string; email: string; weeklyHours: number } | null>(null);
  const [teacherForm, setTeacherForm] = useState({ name: "", email: "", weeklyHours: "20" });
  const [deleteTeacherId, setDeleteTeacherId] = useState<number | null>(null);

  // Session form state
  const [showAddSession, setShowAddSession] = useState<number | null>(null); // teacherId
  const [sessionForm, setSessionForm] = useState({ subject: "", dayOfWeek: "1", startTime: "08:30", endTime: "09:30" });
  const [deleteSessionId, setDeleteSessionId] = useState<number | null>(null);

  // Break form state
  const [showAddBreak, setShowAddBreak] = useState(false);
  const [breakForm, setBreakForm] = useState({ semester: "1", label: "", startDate: "", endDate: "" });
  const [deleteBreakId, setDeleteBreakId] = useState<number | null>(null);

  // Subject form state
  const [showAddSubject, setShowAddSubject] = useState(false);
  const [editSubject, setEditSubject] = useState<null | { id: number; semester: number; name: string; unit: string; classroom: string; maxStudents: string; totalAcademicHours: string; days: number[]; startTime: string; endTime: string }>(null);
  const [subjectForm, setSubjectForm] = useState({ semester: "1", name: "", unit: "", classroom: "", maxStudents: "", totalAcademicHours: "60", days: [] as number[], startTime: "09:00", endTime: "10:00" });
  const [deleteSubjectId, setDeleteSubjectId] = useState<number | null>(null);

  const invalidate = () => {
    utils.academicCalendar.getCalendar.invalidate({ id: calendarId });
    utils.academicCalendar.listSubjects.invalidate({ calendarId });
  };

  // Subjects query
  const { data: subjects = [] } = trpc.academicCalendar.listSubjects.useQuery({ calendarId });

  // Teacher mutations
  const addTeacherMut = trpc.academicCalendar.addTeacher.useMutation({
    onSuccess: () => { invalidate(); setShowAddTeacher(false); setTeacherForm({ name: "", email: "", weeklyHours: "20" }); toast.success(t("acal2_teacher_added")); },
    onError: (e) => toast.error(e.message),
  });
  const updateTeacherMut = trpc.academicCalendar.updateTeacher.useMutation({
    onSuccess: () => { invalidate(); setEditTeacher(null); toast.success(t("acal2_teacher_updated")); },
    onError: (e) => toast.error(e.message),
  });
  const deleteTeacherMut = trpc.academicCalendar.deleteTeacher.useMutation({
    onSuccess: () => { invalidate(); setDeleteTeacherId(null); toast.success(t("acal2_teacher_deleted")); },
    onError: (e) => toast.error(e.message),
  });

  // Session mutations
  const addSessionMut = trpc.academicCalendar.addSession.useMutation({
    onSuccess: () => { invalidate(); setShowAddSession(null); setSessionForm({ subject: "", dayOfWeek: "1", startTime: "08:30", endTime: "09:30" }); toast.success(t("acal2_session_added")); },
    onError: (e) => toast.error(e.message),
  });
  const deleteSessionMut = trpc.academicCalendar.deleteSession.useMutation({
    onSuccess: () => { invalidate(); setDeleteSessionId(null); toast.success(t("acal2_session_deleted")); },
    onError: (e) => toast.error(e.message),
  });

  // Break mutations
  const addBreakMut = trpc.academicCalendar.addBreak.useMutation({
    onSuccess: () => { invalidate(); setShowAddBreak(false); setBreakForm({ semester: "1", label: "", startDate: "", endDate: "" }); toast.success(t("acal2_break_added")); },
    onError: (e) => toast.error(e.message),
  });
  const deleteBreakMut = trpc.academicCalendar.deleteBreak.useMutation({
    onSuccess: () => { invalidate(); setDeleteBreakId(null); toast.success(t("acal2_break_deleted")); },
    onError: (e) => toast.error(e.message),
  });

  const clashCount = data?.clashes?.length ?? 0;

  // Subject mutations
  const addSubjectMut = trpc.academicCalendar.addSubject.useMutation({
    onSuccess: () => { invalidate(); setShowAddSubject(false); setSubjectForm({ semester: "1", name: "", unit: "", classroom: "", maxStudents: "", totalAcademicHours: "60", days: [], startTime: "09:00", endTime: "10:00" }); toast.success(t("acal2_subject_added")); },
    onError: (e) => toast.error(e.message),
  });
  const updateSubjectMut = trpc.academicCalendar.updateSubject.useMutation({
    onSuccess: () => { invalidate(); setEditSubject(null); toast.success(t("acal2_subject_updated")); },
    onError: (e) => toast.error(e.message),
  });
  const deleteSubjectMut = trpc.academicCalendar.deleteSubject.useMutation({
    onSuccess: () => { invalidate(); setDeleteSubjectId(null); toast.success(t("acal2_subject_deleted")); },
    onError: (e) => toast.error(e.message),
  });

  // Total academic hours across all subjects
  const totalAcademicHours = useMemo(() => subjects.reduce((sum, s) => sum + s.totalAcademicHours, 0), [subjects]);

  // Subjects grouped by semester
  const subjectsBySemester = useMemo(() => {
    const map: Record<number, typeof subjects> = {};
    for (let s = 1; s <= (data?.calendar.semesterCount ?? 2); s++) map[s] = [];
    for (const sub of subjects) {
      if (!map[sub.semester]) map[sub.semester] = [];
      map[sub.semester].push(sub);
    }
    return map;
  }, [subjects, data?.calendar.semesterCount]);

  // Group breaks by semester
  const breaksBySemester = useMemo(() => {
    if (!data) return {};
    const map: Record<number, typeof data.breaks> = {};
    for (let s = 1; s <= (data.calendar.semesterCount ?? 2); s++) {
      map[s] = data.breaks.filter(b => b.semester === s);
    }
    return map;
  }, [data]);

  if (isLoading) {
    return <div className="text-blue-200 animate-pulse p-8">{t("acal2_loading")}</div>;
  }
  if (!data) return null;

  const { calendar, teachers, sessions, teacherHours } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={onBack} className="text-blue-200 hover:text-white hover:bg-white/10">
          ← {t("acal2_back")}
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <CalendarDays className="w-6 h-6 text-blue-300" />
            {calendar.academicYear}
          </h1>
          <p className="text-blue-200 text-sm">
            {calendar.schoolStartTime} – {calendar.schoolEndTime} · {calendar.semesterCount} {t("acal2_semesters")}
            {calendar.morningBreakStart && ` · ${t("acal2_morning_break")}: ${calendar.morningBreakStart}–${calendar.morningBreakEnd}`}
            {calendar.lunchBreakStart && ` · ${t("acal2_lunch")}: ${calendar.lunchBreakStart}–${calendar.lunchBreakEnd}`}
          </p>
        </div>
      </div>

      {/* Clash Alert Banner */}
      {clashCount > 0 && (
        <div className="bg-red-500/20 border border-red-400/40 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-300 mt-0.5 shrink-0" />
          <div>
            <p className="text-red-200 font-semibold">{t("acal2_clash_title").replace("{n}", String(clashCount))}</p>
            <ul className="mt-2 space-y-1">
              {data.clashes.map((c, i) => (
                <li key={i} className="text-red-100 text-sm">
                  {days[c.day - 1]} {c.time} — {c.teacherA} &amp; {c.teacherB}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <Tabs defaultValue="teachers">
        <TabsList className="bg-white/10 border-white/20">
          <TabsTrigger value="teachers" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-blue-200">
            <Users className="w-4 h-4 mr-1.5" /> {t("acal2_tab_teachers")} ({teachers.length})
          </TabsTrigger>
          <TabsTrigger value="schedule" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-blue-200">
            <BookOpen className="w-4 h-4 mr-1.5" /> {t("acal2_tab_schedule")}
          </TabsTrigger>
          <TabsTrigger value="breaks" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-blue-200">
            <Coffee className="w-4 h-4 mr-1.5" /> {t("acal2_tab_breaks")}
          </TabsTrigger>
          <TabsTrigger value="subjects" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-blue-200">
            <Library className="w-4 h-4 mr-1.5" /> {t("acal2_tab_subjects")} ({subjects.length})
          </TabsTrigger>
        </TabsList>

        {/* ── Teachers Tab ── */}
        <TabsContent value="teachers" className="space-y-4 mt-4">
          <div className="flex justify-between items-center">
            <h2 className="text-white font-semibold text-lg">{t("acal2_teachers_heading")}</h2>
            <Button size="sm" onClick={() => setShowAddTeacher(true)} className="bg-blue-600 hover:bg-blue-700 text-white gap-1">
              <Plus className="w-4 h-4" /> {t("acal2_add_teacher")}
            </Button>
          </div>

          {teachers.length === 0 ? (
            <Card className="bg-white/10 border-white/20 text-center py-10">
              <CardContent>
                <Users className="w-8 h-8 text-blue-300 mx-auto mb-2" />
                <p className="text-blue-200">{t("acal2_no_teachers")}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {teachers.map(teacher => {
                const hrs = teacherHours.find(h => h.teacherId === teacher.id);
                const allocatedMins = hrs?.weeklyMinutes ?? 0;
                const contractedMins = teacher.weeklyHours * 60;
                const pct = contractedMins > 0 ? Math.min(100, Math.round((allocatedMins / contractedMins) * 100)) : 0;
                const overAllocated = allocatedMins > contractedMins;
                const teacherSessions = sessions.filter(s => s.teacherId === teacher.id);

                return (
                  <Card key={teacher.id} className="bg-white/10 border-white/20">
                    <CardContent className="pt-4 pb-3">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-white font-semibold">{teacher.name}</span>
                            <span className="text-blue-300 text-sm">{teacher.email}</span>
                          </div>
                          <div className="mt-2 space-y-1">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-blue-200">
                                {t("acal2_weekly_hours")}: {minutesToHoursLabel(allocatedMins)} / {teacher.weeklyHours}h
                              </span>
                              <span className={`font-semibold text-sm ${overAllocated ? "text-red-300" : "text-green-300"}`}>
                                {pct}%
                                {overAllocated && <span className="ml-1 text-red-300">⚠ {t("acal2_over_allocated")}</span>}
                              </span>
                            </div>
                            <Progress
                              value={pct}
                              className={`h-2 ${overAllocated ? "[&>div]:bg-red-400" : "[&>div]:bg-green-400"}`}
                            />
                          </div>
                          {/* Sessions summary */}
                          {teacherSessions.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {teacherSessions.map(s => (
                                <Badge key={s.id} variant="secondary" className="bg-blue-600/30 text-blue-100 border-0 text-xs">
                                  {days[s.dayOfWeek - 1]} {s.startTime}–{s.endTime} {s.subject}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-blue-300 hover:text-white hover:bg-blue-600/30 h-8 w-8 p-0"
                            onClick={() => {
                              setEditTeacher({ id: teacher.id, name: teacher.name, email: teacher.email, weeklyHours: teacher.weeklyHours });
                              setTeacherForm({ name: teacher.name, email: teacher.email, weeklyHours: String(teacher.weeklyHours) });
                            }}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-300 hover:text-red-200 hover:bg-red-500/20 h-8 w-8 p-0"
                            onClick={() => setDeleteTeacherId(teacher.id)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-green-300 hover:text-white hover:bg-green-600/30 h-8 px-2 text-xs"
                            onClick={() => setShowAddSession(teacher.id)}
                          >
                            <Plus className="w-3 h-3 mr-1" /> {t("acal2_add_session")}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ── Schedule Tab ── */}
        <TabsContent value="schedule" className="mt-4">
          <h2 className="text-white font-semibold text-lg mb-4">{t("acal2_schedule_heading")}</h2>
          {sessions.length === 0 ? (
            <Card className="bg-white/10 border-white/20 text-center py-10">
              <CardContent>
                <BookOpen className="w-8 h-8 text-blue-300 mx-auto mb-2" />
                <p className="text-blue-200">{t("acal2_no_sessions")}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/20">
                    <th className="text-left text-blue-200 font-medium py-2 pr-4">{t("acal2_col_teacher")}</th>
                    {days.map((d, i) => (
                      <th key={i} className="text-left text-blue-200 font-medium py-2 px-2">{d}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {teachers.map(teacher => {
                    const tSessions = sessions.filter(s => s.teacherId === teacher.id);
                    return (
                      <tr key={teacher.id} className="border-b border-white/10">
                        <td className="text-white py-3 pr-4 font-medium align-top">{teacher.name}</td>
                        {[1, 2, 3, 4, 5].map(day => {
                          const daySessions = tSessions.filter(s => s.dayOfWeek === day);
                          return (
                            <td key={day} className="py-3 px-2 align-top">
                              {daySessions.length === 0 ? (
                                <span className="text-blue-400/50">—</span>
                              ) : (
                                <div className="space-y-1">
                                  {daySessions.map(s => (
                                    <div key={s.id} className="bg-blue-600/30 rounded px-2 py-1 text-blue-100 text-xs group relative">
                                      <div className="font-medium">{s.subject}</div>
                                      <div className="text-blue-300">{s.startTime}–{s.endTime}</div>
                                      <button
                                        className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 text-red-300 hover:text-red-200"
                                        onClick={() => setDeleteSessionId(s.id)}
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* ── Breaks Tab ── */}
        <TabsContent value="breaks" className="space-y-4 mt-4">
          <div className="flex justify-between items-center">
            <h2 className="text-white font-semibold text-lg">{t("acal2_breaks_heading")}</h2>
            <Button size="sm" onClick={() => setShowAddBreak(true)} className="bg-blue-600 hover:bg-blue-700 text-white gap-1">
              <Plus className="w-4 h-4" /> {t("acal2_add_break")}
            </Button>
          </div>

          {Array.from({ length: calendar.semesterCount }, (_, i) => i + 1).map(sem => (
            <div key={sem}>
              <h3 className="text-blue-200 font-medium mb-2">{t("acal2_semester")} {sem}</h3>
              {(breaksBySemester[sem] ?? []).length === 0 ? (
                <p className="text-blue-400/60 text-sm italic">{t("acal2_no_breaks")}</p>
              ) : (
                <div className="space-y-2">
                  {(breaksBySemester[sem] ?? []).map(br => (
                    <Card key={br.id} className="bg-white/10 border-white/20">
                      <CardContent className="py-3 flex items-center justify-between">
                        <div>
                          <span className="text-white font-medium">{br.label}</span>
                          <span className="text-blue-200 text-sm ml-3">
                            {new Date(br.startDate).toLocaleDateString()} – {new Date(br.endDate).toLocaleDateString()}
                          </span>
                          <Badge variant="secondary" className="ml-2 bg-blue-600/30 text-blue-100 border-0 text-xs">
                            {formatBreakLength(br.startDate, br.endDate)}
                          </Badge>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-300 hover:text-red-200 hover:bg-red-500/20 h-7 w-7 p-0"
                          onClick={() => setDeleteBreakId(br.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          ))}
        </TabsContent>

        {/* ── Subjects Tab ── */}
        <TabsContent value="subjects" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-white font-semibold text-lg">{t("acal2_subjects_heading")}</h2>
              <p className="text-blue-200 text-sm">
                {t("acal2_total_academic_hours")}: <span className="text-white font-bold">{totalAcademicHours}h</span>
                {calendar.semesterCount > 1 && (
                  <span className="ml-2 text-blue-300">
                    ({t("acal2_per_semester")}: ~{Math.round(totalAcademicHours / calendar.semesterCount)}h)
                  </span>
                )}
              </p>
            </div>
            <Button size="sm" onClick={() => setShowAddSubject(true)} className="bg-blue-600 hover:bg-blue-700 text-white gap-1">
              <Plus className="w-4 h-4" /> {t("acal2_add_subject")}
            </Button>
          </div>
          {Array.from({ length: calendar.semesterCount }, (_, i) => i + 1).map(sem => {
            const semSubjects = subjectsBySemester[sem] ?? [];
            const semHours = semSubjects.reduce((sum, s) => sum + s.totalAcademicHours, 0);
            return (
              <div key={sem}>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-blue-200 font-medium">{t("acal2_semester")} {sem}</h3>
                  <span className="text-blue-300 text-sm">{semHours}h {t("acal2_total")}</span>
                </div>
                {semSubjects.length === 0 ? (
                  <p className="text-blue-400/60 text-sm italic mb-4">{t("acal2_no_subjects")}</p>
                ) : (
                  <div className="space-y-2 mb-4">
                    {semSubjects.map(sub => {
                      const hoursPerSem = calendar.semesterCount > 0 ? Math.round(sub.totalAcademicHours / calendar.semesterCount) : sub.totalAcademicHours;
                      return (
                        <Card key={sub.id} className="bg-white/10 border-white/20">
                          <CardContent className="py-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-white font-semibold">{sub.name}</span>
                                  {sub.unit && <Badge variant="secondary" className="bg-purple-600/30 text-purple-100 border-0 text-xs">{sub.unit}</Badge>}
                                </div>
                                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-blue-200">
                                  {sub.classroom && (
                                    <span className="flex items-center gap-1"><Building2 className="w-3.5 h-3.5" /> {sub.classroom}</span>
                                  )}
                                  {sub.maxStudents && (
                                    <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {t("acal2_max_students")}: {sub.maxStudents}</span>
                                  )}
                                  <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {sub.startTime}–{sub.endTime}</span>
                                  <span className="flex items-center gap-1"><GraduationCap className="w-3.5 h-3.5" /> {sub.totalAcademicHours}h {t("acal2_total")} · ~{hoursPerSem}h/{t("acal2_semester")}</span>
                                </div>
                                {sub.days.length > 0 && (
                                  <div className="mt-1 flex flex-wrap gap-1">
                                    {sub.days.map(d => (
                                      <Badge key={d} variant="secondary" className="bg-blue-600/30 text-blue-100 border-0 text-xs">
                                        {days[d - 1]}
                                      </Badge>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <div className="flex gap-1 shrink-0">
                                <Button
                                  variant="ghost" size="sm"
                                  className="text-blue-300 hover:text-white hover:bg-white/10 h-7 w-7 p-0"
                                  onClick={() => setEditSubject({ id: sub.id, semester: sub.semester, name: sub.name, unit: sub.unit ?? "", classroom: sub.classroom ?? "", maxStudents: sub.maxStudents ? String(sub.maxStudents) : "", totalAcademicHours: String(sub.totalAcademicHours), days: sub.days, startTime: sub.startTime, endTime: sub.endTime })}
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                  variant="ghost" size="sm"
                                  className="text-red-300 hover:text-red-200 hover:bg-red-500/20 h-7 w-7 p-0"
                                  onClick={() => setDeleteSubjectId(sub.id)}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </TabsContent>
       </Tabs>

      {/* ── Add / Edit Teacher Dialog ── */}
      <Dialog open={showAddTeacher || editTeacher !== null} onOpenChange={(o) => { if (!o) { setShowAddTeacher(false); setEditTeacher(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editTeacher ? t("acal2_edit_teacher") : t("acal2_add_teacher_title")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>{t("acal2_teacher_name")}</Label>
              <Input value={teacherForm.name} onChange={e => setTeacherForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Maria García" />
            </div>
            <div>
              <Label>{t("acal2_teacher_email")}</Label>
              <Input type="email" value={teacherForm.email} onChange={e => setTeacherForm(f => ({ ...f, email: e.target.value }))} placeholder="teacher@school.cat" />
            </div>
            <div>
              <Label>{t("acal2_contracted_hours")}</Label>
              <Input type="number" min={1} max={60} value={teacherForm.weeklyHours} onChange={e => setTeacherForm(f => ({ ...f, weeklyHours: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAddTeacher(false); setEditTeacher(null); }}>{t("acal2_cancel")}</Button>
            <Button
              onClick={() => {
                if (editTeacher) {
                  updateTeacherMut.mutate({ id: editTeacher.id, name: teacherForm.name, email: teacherForm.email, weeklyHours: parseInt(teacherForm.weeklyHours) });
                } else {
                  addTeacherMut.mutate({ calendarId, name: teacherForm.name, email: teacherForm.email, weeklyHours: parseInt(teacherForm.weeklyHours) });
                }
              }}
              disabled={addTeacherMut.isPending || updateTeacherMut.isPending}
            >
              {editTeacher ? t("acal2_save") : t("acal2_add_btn")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add Session Dialog ── */}
      <Dialog open={showAddSession !== null} onOpenChange={(o) => { if (!o) setShowAddSession(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t("acal2_add_session_title")} — {teachers.find(t => t.id === showAddSession)?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>{t("acal2_subject")}</Label>
              <Input value={sessionForm.subject} onChange={e => setSessionForm(f => ({ ...f, subject: e.target.value }))} placeholder="e.g. Mathematics" />
            </div>
            <div>
              <Label>{t("acal2_day_of_week")}</Label>
              <Select value={sessionForm.dayOfWeek} onValueChange={v => setSessionForm(f => ({ ...f, dayOfWeek: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {days.map((d, i) => <SelectItem key={i + 1} value={String(i + 1)}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t("acal2_start_time")}</Label>
                <Input type="time" value={sessionForm.startTime} onChange={e => setSessionForm(f => ({ ...f, startTime: e.target.value }))} />
              </div>
              <div>
                <Label>{t("acal2_end_time")}</Label>
                <Input type="time" value={sessionForm.endTime} onChange={e => setSessionForm(f => ({ ...f, endTime: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddSession(null)}>{t("acal2_cancel")}</Button>
            <Button
              onClick={() => showAddSession !== null && addSessionMut.mutate({
                calendarId,
                teacherId: showAddSession,
                subject: sessionForm.subject,
                dayOfWeek: parseInt(sessionForm.dayOfWeek),
                startTime: sessionForm.startTime,
                endTime: sessionForm.endTime,
              })}
              disabled={addSessionMut.isPending}
            >
              {t("acal2_add_btn")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add Break Dialog ── */}
      <Dialog open={showAddBreak} onOpenChange={setShowAddBreak}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("acal2_add_break_title")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>{t("acal2_semester")}</Label>
              <Select value={breakForm.semester} onValueChange={v => setBreakForm(f => ({ ...f, semester: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Array.from({ length: calendar.semesterCount }, (_, i) => i + 1).map(s => (
                    <SelectItem key={s} value={String(s)}>{t("acal2_semester")} {s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("acal2_break_label")}</Label>
              <Input value={breakForm.label} onChange={e => setBreakForm(f => ({ ...f, label: e.target.value }))} placeholder="e.g. Christmas Break" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t("acal2_break_start")}</Label>
                <Input type="date" value={breakForm.startDate} onChange={e => setBreakForm(f => ({ ...f, startDate: e.target.value }))} />
              </div>
              <div>
                <Label>{t("acal2_break_end")}</Label>
                <Input type="date" value={breakForm.endDate} onChange={e => setBreakForm(f => ({ ...f, endDate: e.target.value }))} />
              </div>
            </div>
            {breakForm.startDate && breakForm.endDate && (
              <p className="text-sm text-muted-foreground">
                {t("acal2_break_length")}: {formatBreakLength(breakForm.startDate, breakForm.endDate)}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddBreak(false)}>{t("acal2_cancel")}</Button>
            <Button
              onClick={() => addBreakMut.mutate({
                calendarId,
                semester: parseInt(breakForm.semester),
                label: breakForm.label,
                startDate: breakForm.startDate,
                endDate: breakForm.endDate,
              })}
              disabled={addBreakMut.isPending || !breakForm.label || !breakForm.startDate || !breakForm.endDate}
            >
              {t("acal2_add_btn")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirms ── */}
      <AlertDialog open={deleteTeacherId !== null} onOpenChange={() => setDeleteTeacherId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("acal2_delete_teacher_title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("acal2_delete_teacher_desc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("acal2_cancel")}</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => deleteTeacherId !== null && deleteTeacherMut.mutate({ id: deleteTeacherId })}>
              {t("acal2_delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteSessionId !== null} onOpenChange={() => setDeleteSessionId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("acal2_delete_session_title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("acal2_delete_session_desc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("acal2_cancel")}</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => deleteSessionId !== null && deleteSessionMut.mutate({ id: deleteSessionId })}>
              {t("acal2_delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteBreakId !== null} onOpenChange={() => setDeleteBreakId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("acal2_delete_break_title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("acal2_delete_break_desc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("acal2_cancel")}</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => deleteBreakId !== null && deleteBreakMut.mutate({ id: deleteBreakId })}>
              {t("acal2_delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Add / Edit Subject Dialog ── */}
      <Dialog
        open={showAddSubject || editSubject !== null}
        onOpenChange={(o) => { if (!o) { setShowAddSubject(false); setEditSubject(null); } }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editSubject ? t("acal2_edit_subject") : t("acal2_add_subject_title")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t("acal2_subject_semester")}</Label>
                <Select
                  value={editSubject ? String(editSubject.semester) : subjectForm.semester}
                  onValueChange={(v) => editSubject ? setEditSubject(s => s && ({ ...s, semester: parseInt(v) })) : setSubjectForm(f => ({ ...f, semester: v }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: calendar.semesterCount }, (_, i) => i + 1).map(s => (
                      <SelectItem key={s} value={String(s)}>{t("acal2_semester")} {s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t("acal2_total_academic_hours")}</Label>
                <Input
                  type="number" min="1"
                  value={editSubject ? editSubject.totalAcademicHours : subjectForm.totalAcademicHours}
                  onChange={e => editSubject ? setEditSubject(s => s && ({ ...s, totalAcademicHours: e.target.value })) : setSubjectForm(f => ({ ...f, totalAcademicHours: e.target.value }))}
                  placeholder="60"
                />
                {calendar.semesterCount > 1 && (() => {
                  const hrs = parseInt(editSubject ? editSubject.totalAcademicHours : subjectForm.totalAcademicHours) || 0;
                  return hrs > 0 ? (
                    <p className="text-xs text-muted-foreground mt-1">
                      ~{Math.round(hrs / calendar.semesterCount)}h {t("acal2_per_semester")} × {calendar.semesterCount} {t("acal2_semesters")}
                    </p>
                  ) : null;
                })()}
              </div>
            </div>
            <div>
              <Label>{t("acal2_subject_name")}</Label>
              <Input
                value={editSubject ? editSubject.name : subjectForm.name}
                onChange={e => editSubject ? setEditSubject(s => s && ({ ...s, name: e.target.value })) : setSubjectForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Mathematics"
              />
            </div>
            <div>
              <Label>{t("acal2_subject_unit")} <span className="text-muted-foreground text-xs">({t("acal2_optional")})</span></Label>
              <Input
                value={editSubject ? editSubject.unit : subjectForm.unit}
                onChange={e => editSubject ? setEditSubject(s => s && ({ ...s, unit: e.target.value })) : setSubjectForm(f => ({ ...f, unit: e.target.value }))}
                placeholder="e.g. Unit 3 – Algebra"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t("acal2_classroom")} <span className="text-muted-foreground text-xs">({t("acal2_optional")})</span></Label>
                <Input
                  value={editSubject ? editSubject.classroom : subjectForm.classroom}
                  onChange={e => editSubject ? setEditSubject(s => s && ({ ...s, classroom: e.target.value })) : setSubjectForm(f => ({ ...f, classroom: e.target.value }))}
                  placeholder="e.g. Room 12"
                />
              </div>
              <div>
                <Label>{t("acal2_max_students")} <span className="text-muted-foreground text-xs">({t("acal2_optional")})</span></Label>
                <Input
                  type="number" min="1"
                  value={editSubject ? editSubject.maxStudents : subjectForm.maxStudents}
                  onChange={e => editSubject ? setEditSubject(s => s && ({ ...s, maxStudents: e.target.value })) : setSubjectForm(f => ({ ...f, maxStudents: e.target.value }))}
                  placeholder="30"
                />
              </div>
            </div>
            <div>
              <Label>{t("acal2_subject_days")}</Label>
              <div className="flex gap-3 flex-wrap mt-1">
                {days.map((dayName, idx) => {
                  const dayNum = idx + 1;
                  const selectedDays = editSubject ? editSubject.days : subjectForm.days;
                  const checked = selectedDays.includes(dayNum);
                  return (
                    <label key={dayNum} className="flex items-center gap-1.5 cursor-pointer select-none">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(v) => {
                          const toggle = (prev: number[]) => v ? [...prev, dayNum].sort() : prev.filter(d => d !== dayNum);
                          if (editSubject) setEditSubject(s => s && ({ ...s, days: toggle(s.days) }));
                          else setSubjectForm(f => ({ ...f, days: toggle(f.days) }));
                        }}
                      />
                      <span className="text-sm">{dayName}</span>
                    </label>
                  );
                })}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t("acal2_start_time")}</Label>
                <Input
                  type="time"
                  value={editSubject ? editSubject.startTime : subjectForm.startTime}
                  onChange={e => editSubject ? setEditSubject(s => s && ({ ...s, startTime: e.target.value })) : setSubjectForm(f => ({ ...f, startTime: e.target.value }))}
                />
              </div>
              <div>
                <Label>{t("acal2_end_time")}</Label>
                <Input
                  type="time"
                  value={editSubject ? editSubject.endTime : subjectForm.endTime}
                  onChange={e => editSubject ? setEditSubject(s => s && ({ ...s, endTime: e.target.value })) : setSubjectForm(f => ({ ...f, endTime: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAddSubject(false); setEditSubject(null); }}>{t("acal2_cancel")}</Button>
            <Button
              disabled={addSubjectMut.isPending || updateSubjectMut.isPending}
              onClick={() => {
                if (editSubject) {
                  updateSubjectMut.mutate({
                    id: editSubject.id,
                    semester: editSubject.semester,
                    name: editSubject.name,
                    unit: editSubject.unit || undefined,
                    classroom: editSubject.classroom || undefined,
                    maxStudents: editSubject.maxStudents ? parseInt(editSubject.maxStudents) : undefined,
                    totalAcademicHours: parseInt(editSubject.totalAcademicHours) || 60,
                    days: editSubject.days,
                    startTime: editSubject.startTime,
                    endTime: editSubject.endTime,
                  });
                } else {
                  addSubjectMut.mutate({
                    calendarId,
                    semester: parseInt(subjectForm.semester),
                    name: subjectForm.name,
                    unit: subjectForm.unit || undefined,
                    classroom: subjectForm.classroom || undefined,
                    maxStudents: subjectForm.maxStudents ? parseInt(subjectForm.maxStudents) : undefined,
                    totalAcademicHours: parseInt(subjectForm.totalAcademicHours) || 60,
                    days: subjectForm.days,
                    startTime: subjectForm.startTime,
                    endTime: subjectForm.endTime,
                  });
                }
              }}
            >
              {editSubject ? t("acal2_save") : t("acal2_add_btn")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Subject Confirm ── */}
      <AlertDialog open={deleteSubjectId !== null} onOpenChange={() => setDeleteSubjectId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("acal2_delete_subject_title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("acal2_delete_subject_desc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("acal2_cancel")}</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => deleteSubjectId !== null && deleteSubjectMut.mutate({ id: deleteSubjectId })}>
              {t("acal2_delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────────

export default function AcademicCalendar() {
  const [selectedCalendarId, setSelectedCalendarId] = useState<number | null>(null);

  return (
    <div
      className="min-h-screen"
      style={{
        background: "linear-gradient(135deg, #0f172a 0%, #1e3a5f 40%, #0f2d4a 100%)",
      }}
    >
      <NavBar />
      <div className="max-w-6xl mx-auto px-4 py-8">
        <BackButton />
        <div className="mt-4">
          {selectedCalendarId === null ? (
            <CalendarList onSelect={setSelectedCalendarId} />
          ) : (
            <CalendarDetail calendarId={selectedCalendarId} onBack={() => setSelectedCalendarId(null)} />
          )}
        </div>
      </div>
    </div>
  );
}
