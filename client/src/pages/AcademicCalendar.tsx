import { useState, useMemo, useCallback } from "react";
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
import { CalendarDays, Plus, Trash2, Edit2, AlertTriangle, Users, Clock, BookOpen, Coffee, ChevronLeft, ChevronRight, GraduationCap, Library, Building2, Copy, Eye, EyeOff, Palette, Download } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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
  // Semester dates: array indexed by semester number (1-based)
  const [semDates, setSemDates] = useState<Array<{ startDate: string; endDate: string }>>(
    [{ startDate: "", endDate: "" }, { startDate: "", endDate: "" }]
  );
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [duplicateSource, setDuplicateSource] = useState<{ id: number; year: string } | null>(null);
  const [dupYear, setDupYear] = useState("");
  const setSemesterDatesMut = trpc.academicCalendar.setSemesterDates.useMutation();
  const duplicateMut = trpc.academicCalendar.duplicateCalendar.useMutation({
    onSuccess: () => {
      utils.academicCalendar.listCalendars.invalidate();
      setDuplicateSource(null);
      toast.success(t("acal2_duplicated"));
    },
    onError: (e) => toast.error(e.message),
  });
  const createMut = trpc.academicCalendar.createCalendar.useMutation({
    onSuccess: async (data) => {
      // Save semester dates after calendar is created
      const validSems = semDates
        .map((s, i) => ({ semesterNumber: i + 1, startDate: s.startDate, endDate: s.endDate }))
        .filter(s => s.startDate && s.endDate);
      if (validSems.length > 0) {
        await setSemesterDatesMut.mutateAsync({ calendarId: data.id, semesters: validSems });
      }
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
                <div className="flex gap-2 mt-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-blue-300 hover:text-blue-200 hover:bg-blue-500/20 h-7 px-2"
                    onClick={(e) => { e.stopPropagation(); setDuplicateSource({ id: cal.id, year: cal.academicYear }); const parts = cal.academicYear.split("-"); setDupYear(parts.length === 2 ? `${parseInt(parts[0])+1}-${parseInt(parts[1])+1}` : ""); }}
                  >
                    <Copy className="w-3.5 h-3.5 mr-1" /> {t("acal2_duplicate")}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-300 hover:text-red-200 hover:bg-red-500/20 h-7 px-2"
                    onClick={(e) => { e.stopPropagation(); setDeleteId(cal.id); }}
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1" /> {t("acal2_delete")}
                  </Button>
                </div>
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
              <Select
                value={form.semesterCount}
                onValueChange={(v) => {
                  setForm(f => ({ ...f, semesterCount: v }));
                  const n = parseInt(v);
                  setSemDates(prev => {
                    const arr = [...prev];
                    while (arr.length < n) arr.push({ startDate: "", endDate: "" });
                    return arr.slice(0, n);
                  });
                }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 {t("acal2_semester")}</SelectItem>
                  <SelectItem value="2">2 {t("acal2_semesters")}</SelectItem>
                  <SelectItem value="3">3 {t("acal2_semesters")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {/* Semester date inputs */}
            {Array.from({ length: parseInt(form.semesterCount) }, (_, i) => (
              <div key={i} className="border border-input rounded-md p-3 space-y-2">
                <p className="text-sm font-medium">{t("acal2_semester")} {i + 1} — {t("acal2_sem_dates")}</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">{t("acal2_sem_start")}</Label>
                    <Input
                      type="date"
                      value={semDates[i]?.startDate ?? ""}
                      onChange={e => setSemDates(prev => {
                        const arr = [...prev];
                        arr[i] = { ...arr[i], startDate: e.target.value };
                        return arr;
                      })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">{t("acal2_sem_end")}</Label>
                    <Input
                      type="date"
                      value={semDates[i]?.endDate ?? ""}
                      onChange={e => setSemDates(prev => {
                        const arr = [...prev];
                        arr[i] = { ...arr[i], endDate: e.target.value };
                        return arr;
                      })}
                    />
                  </div>
                </div>
              </div>
            ))}
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

      {/* Duplicate Calendar Dialog */}
      <Dialog open={duplicateSource !== null} onOpenChange={(o) => !o && setDuplicateSource(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("acal2_duplicate_title")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{t("acal2_duplicate_desc")} <strong>{duplicateSource?.year}</strong></p>
          <div className="space-y-2">
            <Label>{t("acal2_year_label")}</Label>
            <Select value={dupYear} onValueChange={setDupYear}>
              <SelectTrigger><SelectValue placeholder={t("acal2_year_label")} /></SelectTrigger>
              <SelectContent>
                {Array.from({ length: 8 }, (_, i) => { const y = 2023 + i; return `${y}-${y+1}`; }).map(y => (
                  <SelectItem key={y} value={y}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDuplicateSource(null)}>{t("acal2_cancel")}</Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700 text-white"
              disabled={!dupYear || duplicateMut.isPending}
              onClick={() => duplicateSource && duplicateMut.mutate({ sourceId: duplicateSource.id, newAcademicYear: dupYear })}
            >
              {duplicateMut.isPending ? t("acal2_loading") : t("acal2_duplicate_confirm")}
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
  const [sessionForm, setSessionForm] = useState({ subject: "", dayOfWeek: "1", startTime: "08:30", endTime: "09:30", classGroup: "" });
  const [prefillSemester, setPrefillSemester] = useState(false);
  const [deleteSessionId, setDeleteSessionId] = useState<number | null>(null);
  const [editSession, setEditSession] = useState<null | { id: number; subject: string; dayOfWeek: number; startTime: string; endTime: string; classGroup: string }>(null);
  const [editSessionForm, setEditSessionForm] = useState({ subject: "", dayOfWeek: "1", startTime: "08:30", endTime: "09:30", classGroup: "" });

  // Break form state
  const [showAddBreak, setShowAddBreak] = useState(false);
  const [breakForm, setBreakForm] = useState({ semester: "1", label: "", startDate: "", endDate: "" });
  const [deleteBreakId, setDeleteBreakId] = useState<number | null>(null);
  const [editBreak, setEditBreak] = useState<null | { id: number; semester: number; label: string; startDate: string; endDate: string }>(null);
  const [editBreakForm, setEditBreakForm] = useState({ semester: "1", label: "", startDate: "", endDate: "" });

  // Subject form state
  const [showAddSubject, setShowAddSubject] = useState(false);
  const [editSubject, setEditSubject] = useState<null | { id: number; semester: number; name: string; unit: string; classroom: string; maxStudents: string; totalAcademicHours: string; days: number[]; startTime: string; endTime: string; color: string }>(null);
  const [subjectForm, setSubjectForm] = useState({ semester: "1", name: "", unit: "", classroom: "", maxStudents: "", totalAcademicHours: "60", days: [] as number[], startTime: "09:00", endTime: "10:00", color: "#3b82f6" });
  // Optimistic local teacher weekly hours (contracted) — updated immediately when director edits the field
  const [localTeacherHours, setLocalTeacherHours] = useState<Record<number, number>>({});
  const [deleteSubjectId, setDeleteSubjectId] = useState<number | null>(null);

  // Calendar view state
  type CalViewMode = "monthly" | `semester-${number}` | "year";
  const [calView, setCalView] = useState<CalViewMode>("monthly");
  const [calMonth, setCalMonth] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const invalidate = () => {
    utils.academicCalendar.getCalendar.invalidate({ id: calendarId });
    utils.academicCalendar.listSubjects.invalidate({ calendarId });
  };

  // Subjects query
  const { data: subjects = [] } = trpc.academicCalendar.listSubjects.useQuery({ calendarId });

  // Semester dates
  const { data: semesterDates = [], refetch: refetchSemDates } = trpc.academicCalendar.getSemesterDates.useQuery({ calendarId });
  const [editingSemDates, setEditingSemDates] = useState(false);
  const [semDateForm, setSemDateForm] = useState<Array<{ startDate: string; endDate: string }>>([]);
  const setSemDatesMut = trpc.academicCalendar.setSemesterDates.useMutation({
    onSuccess: () => { refetchSemDates(); setEditingSemDates(false); toast.success(t("acal2_sem_dates_saved")); },
    onError: (e) => toast.error(e.message),
  });

  // Teacher mutations
  const addTeacherMut = trpc.academicCalendar.addTeacher.useMutation({
    onSuccess: () => { invalidate(); setShowAddTeacher(false); setTeacherForm({ name: "", email: "", weeklyHours: "20" }); toast.success(t("acal2_teacher_added")); },
    onError: (e) => toast.error(e.message),
  });
  const updateTeacherMut = trpc.academicCalendar.updateTeacher.useMutation({
    onSuccess: (_, vars) => { invalidate(); setEditTeacher(null); setLocalTeacherHours(prev => { const n = { ...prev }; delete n[vars.id]; return n; }); toast.success(t("acal2_teacher_updated")); },
    onError: (e) => toast.error(e.message),
  });
  const deleteTeacherMut = trpc.academicCalendar.deleteTeacher.useMutation({
    onSuccess: () => { invalidate(); setDeleteTeacherId(null); toast.success(t("acal2_teacher_deleted")); },
    onError: (e) => toast.error(e.message),
  });

  // Session mutations
  const addSessionMut = trpc.academicCalendar.addSession.useMutation({
    onSuccess: () => { invalidate(); setShowAddSession(null); setPrefillSemester(false); setSessionForm({ subject: "", dayOfWeek: "1", startTime: "08:30", endTime: "09:30", classGroup: "" }); toast.success(t("acal2_session_added")); },
    onError: (e) => toast.error(e.message),
  });
  const bulkAddSessionsMut = trpc.academicCalendar.bulkAddSessions.useMutation({
    onSuccess: (result) => { invalidate(); setShowAddSession(null); setPrefillSemester(false); setSessionForm({ subject: "", dayOfWeek: "1", startTime: "08:30", endTime: "09:30", classGroup: "" }); toast.success(t("acal2_sessions_created").replace("{n}", String(result.count))); },
    onError: (e) => toast.error(e.message),
  });
  const updateSessionMut = trpc.academicCalendar.updateSession.useMutation({
    onSuccess: () => { invalidate(); setEditSession(null); toast.success(t("acal2_session_updated")); },
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
  const updateBreakMut = trpc.academicCalendar.updateBreak.useMutation({
    onSuccess: () => { invalidate(); setEditBreak(null); toast.success(t("acal2_break_updated")); },
    onError: (e) => toast.error(e.message),
  });

  const clashCount = data?.clashes?.length ?? 0;

  // Subject mutations
  const addSubjectMut = trpc.academicCalendar.addSubject.useMutation({
    onSuccess: () => { invalidate(); setShowAddSubject(false); setSubjectForm({ semester: "1", name: "", unit: "", classroom: "", maxStudents: "", totalAcademicHours: "60", days: [], startTime: "09:00", endTime: "10:00", color: "#3b82f6" }); toast.success(t("acal2_subject_added")); },
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

  const suggestFixMut = trpc.academicCalendar.suggestFix.useMutation({
    onSuccess: () => { invalidate(); toast.success(t("acal2_clash_fixed")); },
    onError: (e) => toast.error(e.message === "No free slot found for this teacher." ? t("acal2_no_free_slot") : e.message),
  });
  const publishMut = trpc.academicCalendar.publishCalendar.useMutation({
    onSuccess: (_, vars) => { invalidate(); toast.success(vars.published ? t("acal2_published") : t("acal2_unpublished")); },
    onError: (e) => toast.error(e.message),
  });
  const exportPdfMut = trpc.academicCalendar.exportCalendarPdf.useMutation({
    onSuccess: (result) => {
      const link = document.createElement("a");
      link.href = `data:application/pdf;base64,${result.pdf}`;
      link.download = result.filename;
      link.click();
      toast.success(t("acal2_pdf_exported"));
    },
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
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
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
            <Button
              size="sm"
              variant="outline"
              className={`border-white/30 text-sm ${calendar.isPublished ? "bg-green-600/30 text-green-200 hover:bg-green-600/50" : "bg-white/10 text-blue-200 hover:bg-white/20"}`}
              disabled={publishMut.isPending}
              onClick={() => publishMut.mutate({ id: calendarId, published: !calendar.isPublished })}
            >
              {calendar.isPublished ? t("acal2_unpublish") : t("acal2_publish")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-white/30 bg-white/10 text-blue-200 hover:bg-white/20 text-sm"
              disabled={exportPdfMut.isPending}
              onClick={() => exportPdfMut.mutate({ id: calendarId, lang: lang })}
            >
              <Download className="w-4 h-4 mr-1" />
              {exportPdfMut.isPending ? t("acal2_exporting") : t("acal2_export_pdf")}
            </Button>
          </div>
        </div>
      </div>

      {/* Semester Dates Panel */}
      <div className="bg-white/10 border border-white/20 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white font-medium flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-blue-300" />
            {t("acal2_sem_dates_heading")}
          </h3>
          {!editingSemDates ? (
            <Button
              size="sm" variant="ghost"
              className="text-blue-200 hover:text-white hover:bg-white/10"
              onClick={() => {
                const n = calendar.semesterCount ?? 2;
                const arr = Array.from({ length: n }, (_, i) => {
                  const existing = semesterDates.find(s => s.semesterNumber === i + 1);
                  return { startDate: existing?.startDate ? String(existing.startDate).slice(0, 10) : "", endDate: existing?.endDate ? String(existing.endDate).slice(0, 10) : "" };
                });
                setSemDateForm(arr);
                setEditingSemDates(true);
              }}
            >
              {t("acal2_edit")}
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" className="text-blue-200 hover:text-white hover:bg-white/10" onClick={() => setEditingSemDates(false)}>{t("acal2_cancel")}</Button>
              <Button
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white"
                disabled={setSemDatesMut.isPending}
                onClick={() => {
                  const semesters = semDateForm
                    .map((s, i) => ({ semesterNumber: i + 1, startDate: s.startDate, endDate: s.endDate }))
                    .filter(s => s.startDate && s.endDate);
                  setSemDatesMut.mutate({ calendarId, semesters });
                }}
              >
                {t("acal2_save")}
              </Button>
            </div>
          )}
        </div>
        {editingSemDates ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {semDateForm.map((s, i) => (
              <div key={i} className="border border-white/20 rounded-md p-3 space-y-2">
                <p className="text-blue-200 text-sm font-medium">{t("acal2_semester")} {i + 1}</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs text-blue-300">{t("acal2_sem_start")}</Label>
                    <Input
                      type="date"
                      className="bg-white/10 border-white/20 text-white"
                      value={s.startDate}
                      onChange={e => setSemDateForm(prev => { const arr = [...prev]; arr[i] = { ...arr[i], startDate: e.target.value }; return arr; })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-blue-300">{t("acal2_sem_end")}</Label>
                    <Input
                      type="date"
                      className="bg-white/10 border-white/20 text-white"
                      value={s.endDate}
                      onChange={e => setSemDateForm(prev => { const arr = [...prev]; arr[i] = { ...arr[i], endDate: e.target.value }; return arr; })}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : semesterDates.length === 0 ? (
          <p className="text-blue-300 text-sm">{t("acal2_sem_dates_empty")}</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {semesterDates.map(s => (
              <div key={s.id} className="flex items-center gap-3">
                <span className="bg-blue-600/40 text-blue-100 text-xs font-bold px-2 py-0.5 rounded">{t("acal2_semester")} {s.semesterNumber}</span>
                <span className="text-white text-sm">{String(s.startDate).slice(0, 10)} → {String(s.endDate).slice(0, 10)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Clash Alert Banner */}
      {clashCount > 0 && (
        <div className="bg-red-500/20 border border-red-400/40 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-300 mt-0.5 shrink-0" />
          <div>
            <p className="text-red-200 font-semibold">{t("acal2_clash_title").replace("{n}", String(clashCount))}</p>
            <ul className="mt-2 space-y-1">
              {data.clashes.map((c, i) => (
                <li key={i} className="text-red-100 text-sm flex items-center gap-3 flex-wrap">
                  <span>{days[c.day - 1]} {c.time} — {c.teacherA} &amp; {c.teacherB}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 text-xs border-red-400/50 text-red-200 hover:bg-red-500/20 bg-transparent"
                    disabled={suggestFixMut.isPending}
                    onClick={() => suggestFixMut.mutate({ sessionId: c.sessionA, calendarId })}
                  >
                    {t("acal2_clash_suggest")}
                  </Button>
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
          <TabsTrigger value="calendar" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-blue-200">
            <CalendarDays className="w-4 h-4 mr-1.5" /> {t("acal2_tab_calendar")}
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
                // Use optimistic local value if director is actively editing this teacher's hours
                const contractedHours = localTeacherHours[teacher.id] ?? teacher.weeklyHours;
                const contractedMins = contractedHours * 60;
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
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-purple-300 hover:text-white hover:bg-purple-600/30 h-8 px-2 text-xs"
                            onClick={() => exportPdfMut.mutate({ id: calendarId, lang: "en", teacherId: teacher.id })}
                            disabled={exportPdfMut.isPending}
                          >
                            <Download className="w-3 h-3 mr-1" /> {t("acal2_print_schedule")}
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
                                    <div key={s.id} className="bg-blue-600/30 rounded px-2 py-1 text-blue-100 text-xs group relative" style={(() => { const sc = subjects.find(sub => sub.name === s.subject)?.color; return sc ? { borderLeft: `3px solid ${sc}` } : {}; })()}>
                                      <div className="font-medium">{s.subject}</div>
                                      <div className="text-blue-300">{s.startTime}–{s.endTime}</div>
                                      {(s as any).classGroup && <div className="text-blue-400/80 text-xs">{(s as any).classGroup}</div>}
                                      <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 flex gap-0.5">
                                        <button
                                          className="text-blue-300 hover:text-white"
                                          onClick={() => { setEditSession({ id: s.id, subject: s.subject, dayOfWeek: s.dayOfWeek, startTime: s.startTime, endTime: s.endTime, classGroup: (s as any).classGroup ?? "" }); setEditSessionForm({ subject: s.subject, dayOfWeek: String(s.dayOfWeek), startTime: s.startTime, endTime: s.endTime, classGroup: (s as any).classGroup ?? "" }); }}
                                        >
                                          <Edit2 className="w-3 h-3" />
                                        </button>
                                        <button
                                          className="text-red-300 hover:text-red-200"
                                          onClick={() => setDeleteSessionId(s.id)}
                                        >
                                          <Trash2 className="w-3 h-3" />
                                        </button>
                                      </div>
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
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-blue-300 hover:text-white hover:bg-blue-600/30 h-7 w-7 p-0"
                            onClick={() => {
                              setEditBreak({ id: br.id, semester: br.semester, label: br.label, startDate: String(br.startDate).slice(0, 10), endDate: String(br.endDate).slice(0, 10) });
                              setEditBreakForm({ semester: String(br.semester), label: br.label, startDate: String(br.startDate).slice(0, 10), endDate: String(br.endDate).slice(0, 10) });
                            }}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-300 hover:text-red-200 hover:bg-red-500/20 h-7 w-7 p-0"
                            onClick={() => setDeleteBreakId(br.id)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
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
                                  {sub.color && <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: sub.color }} />}
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
                                  onClick={() => setEditSubject({ id: sub.id, semester: sub.semester, name: sub.name, unit: sub.unit ?? "", classroom: sub.classroom ?? "", maxStudents: sub.maxStudents ? String(sub.maxStudents) : "", totalAcademicHours: String(sub.totalAcademicHours), days: sub.days, startTime: sub.startTime, endTime: sub.endTime, color: sub.color ?? "#3b82f6" })}
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

        {/* ── Calendar Tab ── */}
        <TabsContent value="calendar" className="mt-4">
          {/* View switcher */}
          <div className="flex flex-wrap gap-2 mb-4">
            <Button
              size="sm"
              variant={calView === "monthly" ? "default" : "outline"}
              className={calView === "monthly" ? "bg-blue-600 hover:bg-blue-700 text-white" : "border-white/30 text-blue-200 hover:bg-white/10 bg-transparent"}
              onClick={() => setCalView("monthly")}
            >
              {t("acal2_view_monthly")}
            </Button>
            {Array.from({ length: calendar.semesterCount }, (_, i) => i + 1).map(sem => (
              <Button
                key={sem}
                size="sm"
                variant={calView === `semester-${sem}` ? "default" : "outline"}
                className={calView === `semester-${sem}` ? "bg-blue-600 hover:bg-blue-700 text-white" : "border-white/30 text-blue-200 hover:bg-white/10 bg-transparent"}
                onClick={() => setCalView(`semester-${sem}` as CalViewMode)}
              >
                {t("acal2_view_semester")} {sem}
              </Button>
            ))}
            <Button
              size="sm"
              variant={calView === "year" ? "default" : "outline"}
              className={calView === "year" ? "bg-blue-600 hover:bg-blue-700 text-white" : "border-white/30 text-blue-200 hover:bg-white/10 bg-transparent"}
              onClick={() => setCalView("year")}
            >
              {t("acal2_view_year")}
            </Button>
          </div>

          {/* Monthly View */}
          {calView === "monthly" && (() => {
            const year = calMonth.getFullYear();
            const month = calMonth.getMonth();
            const firstDayJS = new Date(year, month, 1).getDay();
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            const startOffset = (firstDayJS + 6) % 7; // Monday-first
            const cells: (string | null)[] = Array(startOffset).fill(null);
            for (let d = 1; d <= daysInMonth; d++) {
              cells.push(`${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
            }
            while (cells.length % 7 !== 0) cells.push(null);
            const today = new Date().toISOString().slice(0, 10);
            const DAY_LABELS_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
            // Build session map by date
            const sessionsByDate: Record<string, typeof sessions> = {};
            for (const s of sessions) {
              if ((s as any).sessionDate) {
                const key = String((s as any).sessionDate).slice(0, 10);
                if (!sessionsByDate[key]) sessionsByDate[key] = [];
                sessionsByDate[key].push(s);
              } else {
                // Recurring: add to every matching weekday in this month
                for (let d = 1; d <= daysInMonth; d++) {
                  const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
                  const jsDow = new Date(dateStr + "T00:00:00").getDay();
                  const dow = jsDow === 0 ? 7 : jsDow;
                  if (dow === s.dayOfWeek) {
                    if (!sessionsByDate[dateStr]) sessionsByDate[dateStr] = [];
                    sessionsByDate[dateStr].push(s);
                  }
                }
              }
            }
            // Build break overlay
            const breakDates = new Set<string>();
            for (const br of (data?.breaks ?? [])) {
              const s = new Date(String(br.startDate).slice(0, 10) + "T00:00:00");
              const e = new Date(String(br.endDate).slice(0, 10) + "T00:00:00");
              for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
                breakDates.add(d.toISOString().slice(0, 10));
              }
            }
            const monthLabel = calMonth.toLocaleDateString(lang === "ca" ? "ca-ES" : lang === "es" ? "es-ES" : "en-GB", { month: "long", year: "numeric" });
            return (
              <div className="bg-white/5 border border-white/20 rounded-xl p-4">
                <div className="flex items-center justify-between mb-4">
                  <Button variant="ghost" size="sm" className="text-blue-200 hover:text-white hover:bg-white/10" onClick={() => setCalMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}>
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <h3 className="text-white font-semibold capitalize">{monthLabel}</h3>
                  <Button variant="ghost" size="sm" className="text-blue-200 hover:text-white hover:bg-white/10" onClick={() => setCalMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {DAY_LABELS_SHORT.map(d => (
                    <div key={d} className="text-center text-xs font-semibold text-blue-300/70 py-1">{d}</div>
                  ))}
                  {cells.map((dateStr, i) => {
                    if (!dateStr) return <div key={`e-${i}`} />;
                    const daySessions = sessionsByDate[dateStr] ?? [];
                    const isToday = dateStr === today;
                    const isBreak = breakDates.has(dateStr);
                    return (
                      <div
                        key={dateStr}
                        className={cn(
                          "min-h-[60px] rounded-lg p-1 border text-left",
                          isBreak ? "bg-orange-500/15 border-orange-400/30" : "bg-white/5 border-white/10",
                          isToday && "ring-2 ring-blue-400/60"
                        )}
                      >
                        <span className={cn("text-xs font-medium block mb-0.5", isToday ? "text-white font-bold" : "text-white/70")}>
                          {parseInt(dateStr.slice(8))}
                        </span>
                        {isBreak && daySessions.length === 0 && (
                          <span className="text-orange-300/70 text-[9px] leading-tight block">break</span>
                        )}
                        <div className="space-y-0.5">
                          {daySessions.slice(0, 2).map(s => {
                            const subColor = subjects.find(sub => sub.name === s.subject)?.color;
                            return (
                              <div
                                key={s.id}
                                className="text-[9px] leading-tight rounded px-1 py-0.5 truncate text-white"
                                style={{ backgroundColor: subColor ? subColor + "99" : "rgba(59,130,246,0.5)" }}
                                title={`${s.subject} ${s.startTime}–${s.endTime}`}
                              >
                                {s.subject}
                              </div>
                            );
                          })}
                          {daySessions.length > 2 && (
                            <div className="text-blue-300/60 text-[9px]">+{daySessions.length - 2}</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* Semester View */}
          {calView.startsWith("semester-") && (() => {
            const semNum = parseInt(calView.replace("semester-", ""));
            const semDate = semesterDates.find(sd => sd.semesterNumber === semNum);
            if (!semDate) return (
              <div className="bg-white/5 border border-white/20 rounded-xl p-8 text-center">
                <CalendarDays className="w-8 h-8 text-blue-300 mx-auto mb-2" />
                <p className="text-blue-200">{t("acal2_cal_no_semdate")}</p>
              </div>
            );
            const semStart = String(semDate.startDate).slice(0, 10);
            const semEnd = String(semDate.endDate).slice(0, 10);
            // Build weeks: each week starts on Monday
            const startD = new Date(semStart + "T00:00:00");
            const endD = new Date(semEnd + "T00:00:00");
            // Align to Monday
            const dow0 = startD.getDay();
            const offset = (dow0 + 6) % 7;
            const weekStart = new Date(startD);
            weekStart.setDate(weekStart.getDate() - offset);
            const weeks: string[][] = [];
            const cur = new Date(weekStart);
            while (cur <= endD) {
              const week: string[] = [];
              for (let d = 0; d < 5; d++) { // Mon–Fri only
                week.push(cur.toISOString().slice(0, 10));
                cur.setDate(cur.getDate() + 1);
              }
              cur.setDate(cur.getDate() + 2); // skip Sat+Sun
              weeks.push(week);
            }
            // Session map by date
            const sessionsByDate: Record<string, typeof sessions> = {};
            for (const s of sessions) {
              if ((s as any).sessionDate) {
                const key = String((s as any).sessionDate).slice(0, 10);
                if (!sessionsByDate[key]) sessionsByDate[key] = [];
                sessionsByDate[key].push(s);
              } else {
                for (const week of weeks) {
                  for (const dateStr of week) {
                    const jsDow = new Date(dateStr + "T00:00:00").getDay();
                    const dow = jsDow === 0 ? 7 : jsDow;
                    if (dow === s.dayOfWeek) {
                      if (!sessionsByDate[dateStr]) sessionsByDate[dateStr] = [];
                      sessionsByDate[dateStr].push(s);
                    }
                  }
                }
              }
            }
            const breakDates = new Set<string>();
            for (const br of (data?.breaks ?? []).filter(b => b.semester === semNum)) {
              const s = new Date(String(br.startDate).slice(0, 10) + "T00:00:00");
              const e = new Date(String(br.endDate).slice(0, 10) + "T00:00:00");
              for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
                breakDates.add(d.toISOString().slice(0, 10));
              }
            }
            const today = new Date().toISOString().slice(0, 10);
            const DAY_LABELS_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri"];
            return (
              <div className="bg-white/5 border border-white/20 rounded-xl p-4 overflow-x-auto">
                <div className="mb-3">
                  <h3 className="text-white font-semibold">{t("acal2_view_semester")} {semNum}</h3>
                  <p className="text-blue-200 text-sm">{semStart} → {semEnd}</p>
                </div>
                <div className="min-w-[560px]">
                  <div className="grid grid-cols-5 gap-1 mb-1">
                    {DAY_LABELS_SHORT.map(d => (
                      <div key={d} className="text-center text-xs font-semibold text-blue-300/70 py-1">{d}</div>
                    ))}
                  </div>
                  {weeks.map((week, wi) => {
                    const weekLabel = week[0].slice(5).replace("-", "/");
                    return (
                      <div key={wi} className="flex items-start gap-1 mb-1">
                        <div className="w-10 shrink-0 text-right text-[10px] text-blue-400/60 pt-1.5 pr-1">{weekLabel}</div>
                        <div className="flex-1 grid grid-cols-5 gap-1">
                          {week.map(dateStr => {
                            const inSem = dateStr >= semStart && dateStr <= semEnd;
                            const isBreak = breakDates.has(dateStr);
                            const daySessions = inSem ? (sessionsByDate[dateStr] ?? []) : [];
                            const isToday = dateStr === today;
                            return (
                              <div
                                key={dateStr}
                                className={cn(
                                  "min-h-[44px] rounded p-1 border text-left",
                                  !inSem ? "bg-white/2 border-white/5 opacity-30" :
                                  isBreak ? "bg-orange-500/15 border-orange-400/30" :
                                  "bg-white/5 border-white/10",
                                  isToday && "ring-2 ring-blue-400/60"
                                )}
                              >
                                <span className={cn("text-[10px] font-medium block", isToday ? "text-white font-bold" : "text-white/60")}>
                                  {parseInt(dateStr.slice(8))}
                                </span>
                                {isBreak && daySessions.length === 0 && (
                                  <span className="text-orange-300/60 text-[8px] leading-tight block">break</span>
                                )}
                                <div className="space-y-0.5">
                                  {daySessions.slice(0, 2).map(s => {
                                    const subColor = subjects.find(sub => sub.name === s.subject)?.color;
                                    return (
                                      <div
                                        key={s.id}
                                        className="text-[8px] leading-tight rounded px-0.5 py-0.5 truncate text-white"
                                        style={{ backgroundColor: subColor ? subColor + "99" : "rgba(59,130,246,0.5)" }}
                                        title={`${s.subject} ${s.startTime}–${s.endTime}`}
                                      >
                                        {s.subject}
                                      </div>
                                    );
                                  })}
                                  {daySessions.length > 2 && (
                                    <div className="text-blue-300/60 text-[8px]">+{daySessions.length - 2}</div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* Academic Year View */}
          {calView === "year" && (() => {
            if (semesterDates.length === 0) return (
              <div className="bg-white/5 border border-white/20 rounded-xl p-8 text-center">
                <CalendarDays className="w-8 h-8 text-blue-300 mx-auto mb-2" />
                <p className="text-blue-200">{t("acal2_cal_no_semdate")}</p>
              </div>
            );
            // Determine full year range
            const allStarts = semesterDates.map(sd => String(sd.startDate).slice(0, 10)).sort();
            const allEnds = semesterDates.map(sd => String(sd.endDate).slice(0, 10)).sort();
            const yearStart = allStarts[0];
            const yearEnd = allEnds[allEnds.length - 1];
            // Build month list
            const startYear = parseInt(yearStart.slice(0, 4));
            const startMon = parseInt(yearStart.slice(5, 7)) - 1;
            const endYear = parseInt(yearEnd.slice(0, 4));
            const endMon = parseInt(yearEnd.slice(5, 7)) - 1;
            const months: { year: number; month: number }[] = [];
            let y = startYear, m = startMon;
            while (y < endYear || (y === endYear && m <= endMon)) {
              months.push({ year: y, month: m });
              m++; if (m > 11) { m = 0; y++; }
            }
            // Build break set
            const breakDates = new Set<string>();
            for (const br of (data?.breaks ?? [])) {
              const s = new Date(String(br.startDate).slice(0, 10) + "T00:00:00");
              const e = new Date(String(br.endDate).slice(0, 10) + "T00:00:00");
              for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
                breakDates.add(d.toISOString().slice(0, 10));
              }
            }
            // Build semester membership
            const semForDate = (dateStr: string): number | null => {
              for (const sd of semesterDates) {
                if (dateStr >= String(sd.startDate).slice(0, 10) && dateStr <= String(sd.endDate).slice(0, 10)) return sd.semesterNumber;
              }
              return null;
            };
            const SEM_COLORS = ["#3b82f6", "#8b5cf6", "#10b981", "#f59e0b"];
            const today = new Date().toISOString().slice(0, 10);
            const DAY_LABELS_SHORT = ["M", "T", "W", "T", "F", "S", "S"];
            const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            return (
              <div className="bg-white/5 border border-white/20 rounded-xl p-4">
                <h3 className="text-white font-semibold mb-1">{t("acal2_view_year")}</h3>
                <p className="text-blue-200 text-sm mb-4">{yearStart} → {yearEnd}</p>
                {/* Legend */}
                <div className="flex flex-wrap gap-3 mb-4">
                  {semesterDates.map((sd, i) => (
                    <div key={sd.id} className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: SEM_COLORS[i] + "99" }} />
                      <span className="text-blue-200 text-xs">{t("acal2_view_semester")} {sd.semesterNumber}</span>
                    </div>
                  ))}
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm bg-orange-500/40" />
                    <span className="text-blue-200 text-xs">Break</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {months.map(({ year: y, month: mo }) => {
                    const firstDayJS = new Date(y, mo, 1).getDay();
                    const daysInMonth = new Date(y, mo + 1, 0).getDate();
                    const startOffset = (firstDayJS + 6) % 7;
                    const cells: (string | null)[] = Array(startOffset).fill(null);
                    for (let d = 1; d <= daysInMonth; d++) {
                      cells.push(`${y}-${String(mo + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
                    }
                    while (cells.length % 7 !== 0) cells.push(null);
                    return (
                      <div key={`${y}-${mo}`} className="bg-white/5 rounded-lg p-2">
                        <p className="text-blue-200 text-xs font-semibold mb-1">{MONTH_NAMES[mo]} {y}</p>
                        <div className="grid grid-cols-7 gap-px">
                          {DAY_LABELS_SHORT.map((d, i) => (
                            <div key={i} className="text-center text-[8px] text-blue-400/50">{d}</div>
                          ))}
                          {cells.map((dateStr, ci) => {
                            if (!dateStr) return <div key={`e-${ci}`} />;
                            const sem = semForDate(dateStr);
                            const isBreak = breakDates.has(dateStr);
                            const isToday = dateStr === today;
                            const semColor = sem !== null ? SEM_COLORS[sem - 1] : null;
                            return (
                              <div
                                key={dateStr}
                                title={dateStr}
                                className={cn(
                                  "aspect-square rounded-[2px] flex items-center justify-center text-[7px]",
                                  isToday ? "ring-1 ring-white" : ""
                                )}
                                style={{
                                  backgroundColor: isBreak ? "rgba(249,115,22,0.35)" : semColor ? semColor + "55" : "transparent",
                                  color: sem !== null ? "#fff" : "rgba(255,255,255,0.3)",
                                }}
                              >
                                {parseInt(dateStr.slice(8))}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
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
              <Input
                type="number" min={1} max={60}
                value={teacherForm.weeklyHours}
                onChange={e => {
                  setTeacherForm(f => ({ ...f, weeklyHours: e.target.value }));
                  // Optimistically update the progress bar for the teacher being edited
                  if (editTeacher) {
                    const v = parseInt(e.target.value);
                    if (!isNaN(v) && v > 0) setLocalTeacherHours(prev => ({ ...prev, [editTeacher.id]: v }));
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAddTeacher(false); if (editTeacher) setLocalTeacherHours(prev => { const n = { ...prev }; delete n[editTeacher.id]; return n; }); setEditTeacher(null); }}>{t("acal2_cancel")}</Button>
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
      <Dialog open={showAddSession !== null} onOpenChange={(o) => { if (!o) { setShowAddSession(null); setPrefillSemester(false); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t("acal2_add_session_title")} — {teachers.find(t => t.id === showAddSession)?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>{t("acal2_subject")}</Label>
              {subjects.length > 0 ? (
                <Select value={sessionForm.subject} onValueChange={v => {
                  setSessionForm(f => ({ ...f, subject: v }));
                  // Auto-fill times from subject
                  const sub = subjects.find(s => s.name === v);
                  if (sub) {
                    setSessionForm(f => ({
                      ...f,
                      subject: v,
                      startTime: sub.startTime,
                      endTime: sub.endTime,
                      dayOfWeek: sub.days.length > 0 ? String(sub.days[0]) : f.dayOfWeek,
                    }));
                  }
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("acal2_select_subject_placeholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from(new Set(subjects.map(s => s.semester))).sort().map(sem => (
                      <>
                        <div key={`sem-${sem}`} className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          {t("acal2_semester")} {sem}
                        </div>
                        {subjects.filter(s => s.semester === sem).map(sub => (
                          <SelectItem key={sub.id} value={sub.name}>
                            <span className="flex items-center gap-2">
                              {sub.color && (
                                <span className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: sub.color }} />
                              )}
                              {sub.name}
                              {sub.classroom && <span className="text-muted-foreground text-xs ml-1">· {sub.classroom}</span>}
                            </span>
                          </SelectItem>
                        ))}
                      </>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="text-sm text-muted-foreground bg-muted/40 rounded p-2">
                  {t("acal2_no_subjects_yet")} <span className="text-blue-400">{t("acal2_add_subjects_first")}</span>
                </div>
              )}
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
            <div>
              <Label>{t("acal2_class_group")}</Label>
              <Input
                placeholder={t("acal2_class_group_placeholder")}
                value={sessionForm.classGroup}
                onChange={e => setSessionForm(f => ({ ...f, classGroup: e.target.value }))}
              />
            </div>
            {/* Pre-fill semester toggle — only shown when semester dates are configured */}
            {semesterDates.length > 0 && (() => {
              const selectedSubject = subjects.find(s => s.name === sessionForm.subject);
              const subjectSemester = selectedSubject?.semester;
              const semDate = semesterDates.find(sd => sd.semesterNumber === subjectSemester);
              if (!semDate) return null;
              const semStart = String(semDate.startDate).slice(0, 10);
              const semEnd = String(semDate.endDate).slice(0, 10);
              // Count how many occurrences of the selected day fall in the semester (excluding breaks)
              const dayNum = parseInt(sessionForm.dayOfWeek); // 1=Mon … 5=Fri
              const breakPeriods = (data?.breaks ?? []).filter(b => b.semester === subjectSemester);
              let count = 0;
              const cur = new Date(semStart + "T00:00:00");
              const end = new Date(semEnd + "T00:00:00");
              while (cur <= end) {
                // JS getDay(): 0=Sun, 1=Mon … 5=Fri
                const jsDow = cur.getDay();
                const dow = jsDow === 0 ? 7 : jsDow; // convert to 1=Mon … 7=Sun
                if (dow === dayNum) {
                  const dateStr = cur.toISOString().slice(0, 10);
                  const inBreak = breakPeriods.some(b => dateStr >= String(b.startDate).slice(0, 10) && dateStr <= String(b.endDate).slice(0, 10));
                  if (!inBreak) count++;
                }
                cur.setDate(cur.getDate() + 1);
              }
              return (
                <div className="flex items-start gap-3 bg-blue-600/10 border border-blue-500/30 rounded-md p-3">
                  <Checkbox
                    id="prefill-semester"
                    checked={prefillSemester}
                    onCheckedChange={v => setPrefillSemester(!!v)}
                    className="mt-0.5"
                  />
                  <div>
                    <label htmlFor="prefill-semester" className="text-sm font-medium cursor-pointer">
                      {t("acal2_prefill_semester")}
                    </label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {semStart} → {semEnd} · {count} {days[dayNum - 1]} sessions
                    </p>
                  </div>
                </div>
              );
            })()}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAddSession(null); setPrefillSemester(false); }}>{t("acal2_cancel")}</Button>
            <Button
              onClick={() => {
                if (showAddSession === null) return;
                const teacherId = showAddSession;
                if (prefillSemester) {
                  // Generate one dated session per weekly occurrence across the semester
                  const selectedSubject = subjects.find(s => s.name === sessionForm.subject);
                  const subjectSemester = selectedSubject?.semester;
                  const semDate = semesterDates.find(sd => sd.semesterNumber === subjectSemester);
                  if (!semDate) return;
                  const semStart = String(semDate.startDate).slice(0, 10);
                  const semEnd = String(semDate.endDate).slice(0, 10);
                  const dayNum = parseInt(sessionForm.dayOfWeek);
                  const breakPeriods = (data?.breaks ?? []).filter(b => b.semester === subjectSemester);
                  const rows: { calendarId: number; teacherId: number; subject: string; dayOfWeek: number; startTime: string; endTime: string; classGroup?: string; sessionDate: string }[] = [];
                  const cur = new Date(semStart + "T00:00:00");
                  const end = new Date(semEnd + "T00:00:00");
                  while (cur <= end) {
                    const jsDow = cur.getDay();
                    const dow = jsDow === 0 ? 7 : jsDow;
                    if (dow === dayNum) {
                      const dateStr = cur.toISOString().slice(0, 10);
                      const inBreak = breakPeriods.some(b => dateStr >= String(b.startDate).slice(0, 10) && dateStr <= String(b.endDate).slice(0, 10));
                      if (!inBreak) {
                        rows.push({
                          calendarId,
                          teacherId,
                          subject: sessionForm.subject,
                          dayOfWeek: dayNum,
                          startTime: sessionForm.startTime,
                          endTime: sessionForm.endTime,
                          classGroup: sessionForm.classGroup || undefined,
                          sessionDate: dateStr,
                        });
                      }
                    }
                    cur.setDate(cur.getDate() + 1);
                  }
                  if (rows.length > 0) bulkAddSessionsMut.mutate({ sessions: rows });
                } else {
                  addSessionMut.mutate({
                    calendarId,
                    teacherId,
                    subject: sessionForm.subject,
                    dayOfWeek: parseInt(sessionForm.dayOfWeek),
                    startTime: sessionForm.startTime,
                    endTime: sessionForm.endTime,
                    classGroup: sessionForm.classGroup || undefined,
                  });
                }
              }}
              disabled={addSessionMut.isPending || bulkAddSessionsMut.isPending}
            >
              {(addSessionMut.isPending || bulkAddSessionsMut.isPending) ? t("acal2_loading") : (prefillSemester ? t("acal2_prefill_semester") : t("acal2_add_btn"))}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Session Dialog ── */}
      <Dialog open={editSession !== null} onOpenChange={(o) => { if (!o) setEditSession(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("acal2_edit_session_title")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>{t("acal2_subject")}</Label>
              {subjects.length > 0 ? (
                <Select value={editSessionForm.subject} onValueChange={v => {
                  const sub = subjects.find(s => s.name === v);
                  setEditSessionForm(f => ({
                    ...f,
                    subject: v,
                    ...(sub ? { startTime: sub.startTime, endTime: sub.endTime, dayOfWeek: sub.days.length > 0 ? String(sub.days[0]) : f.dayOfWeek } : {}),
                  }));
                }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from(new Set(subjects.map(s => s.semester))).sort().map(sem => (
                      <>
                        <div key={`sem-${sem}`} className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          {t("acal2_semester")} {sem}
                        </div>
                        {subjects.filter(s => s.semester === sem).map(sub => (
                          <SelectItem key={sub.id} value={sub.name}>
                            <span className="flex items-center gap-2">
                              {sub.color && <span className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: sub.color }} />}
                              {sub.name}
                              {sub.classroom && <span className="text-muted-foreground text-xs ml-1">· {sub.classroom}</span>}
                            </span>
                          </SelectItem>
                        ))}
                      </>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input value={editSessionForm.subject} onChange={e => setEditSessionForm(f => ({ ...f, subject: e.target.value }))} />
              )}
            </div>
            <div>
              <Label>{t("acal2_day_of_week")}</Label>
              <Select value={editSessionForm.dayOfWeek} onValueChange={v => setEditSessionForm(f => ({ ...f, dayOfWeek: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {days.map((d, i) => <SelectItem key={i + 1} value={String(i + 1)}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t("acal2_start_time")}</Label>
                <Input type="time" value={editSessionForm.startTime} onChange={e => setEditSessionForm(f => ({ ...f, startTime: e.target.value }))} />
              </div>
              <div>
                <Label>{t("acal2_end_time")}</Label>
                <Input type="time" value={editSessionForm.endTime} onChange={e => setEditSessionForm(f => ({ ...f, endTime: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>{t("acal2_class_group")}</Label>
              <Input
                placeholder={t("acal2_class_group_placeholder")}
                value={editSessionForm.classGroup}
                onChange={e => setEditSessionForm(f => ({ ...f, classGroup: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditSession(null)}>{t("acal2_cancel")}</Button>
            <Button
              onClick={() => editSession && updateSessionMut.mutate({
                id: editSession.id,
                subject: editSessionForm.subject,
                dayOfWeek: parseInt(editSessionForm.dayOfWeek),
                startTime: editSessionForm.startTime,
                endTime: editSessionForm.endTime,
                classGroup: editSessionForm.classGroup || null,
              })}
              disabled={updateSessionMut.isPending}
            >
              {t("acal2_save")}
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

      {/* ── Edit Break Dialog ── */}
      <Dialog open={editBreak !== null} onOpenChange={(o) => { if (!o) setEditBreak(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("acal2_edit_break_title")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>{t("acal2_semester")}</Label>
              <Select value={editBreakForm.semester} onValueChange={v => setEditBreakForm(f => ({ ...f, semester: v }))}>
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
              <Input value={editBreakForm.label} onChange={e => setEditBreakForm(f => ({ ...f, label: e.target.value }))} placeholder="e.g. Christmas Break" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t("acal2_break_start")}</Label>
                <Input type="date" value={editBreakForm.startDate} onChange={e => setEditBreakForm(f => ({ ...f, startDate: e.target.value }))} />
              </div>
              <div>
                <Label>{t("acal2_break_end")}</Label>
                <Input type="date" value={editBreakForm.endDate} onChange={e => setEditBreakForm(f => ({ ...f, endDate: e.target.value }))} />
              </div>
            </div>
            {editBreakForm.startDate && editBreakForm.endDate && (
              <p className="text-sm text-muted-foreground">
                {t("acal2_break_length")}: {formatBreakLength(editBreakForm.startDate, editBreakForm.endDate)}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditBreak(null)}>{t("acal2_cancel")}</Button>
            <Button
              onClick={() => editBreak !== null && updateBreakMut.mutate({
                id: editBreak.id,
                semester: parseInt(editBreakForm.semester),
                label: editBreakForm.label,
                startDate: editBreakForm.startDate,
                endDate: editBreakForm.endDate,
              })}
              disabled={updateBreakMut.isPending || !editBreakForm.label || !editBreakForm.startDate || !editBreakForm.endDate}
            >
              {t("acal2_save")}
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
                  onValueChange={(v) => {
                    if (editSubject) {
                      setEditSubject(s => s && ({ ...s, semester: parseInt(v) }));
                    } else {
                      const semNum = parseInt(v);
                      if (semNum > 1) {
                        // Auto-populate from Semester 1 subjects (first one found)
                        const sem1Subject = subjects.find(s => s.semester === 1);
                        if (sem1Subject) {
                          setSubjectForm({
                            semester: v,
                            name: sem1Subject.name,
                            unit: sem1Subject.unit ?? "",
                            classroom: sem1Subject.classroom ?? "",
                            maxStudents: sem1Subject.maxStudents ? String(sem1Subject.maxStudents) : "",
                            totalAcademicHours: String(sem1Subject.totalAcademicHours),
                            days: Array.isArray(sem1Subject.days) ? sem1Subject.days : (sem1Subject.days ? JSON.parse(sem1Subject.days as unknown as string) : []),
                            startTime: sem1Subject.startTime ?? "09:00",
                            endTime: sem1Subject.endTime ?? "10:00",
                            color: sem1Subject.color ?? "#3b82f6",
                          });
                          return;
                        }
                      }
                      setSubjectForm(f => ({ ...f, semester: v }));
                    }
                  }}
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
          {/* Colour picker */}
          <div>
            <Label className="flex items-center gap-1.5"><Palette className="w-3.5 h-3.5" /> {t("acal2_subject_color")}</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {["#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6","#ec4899","#06b6d4","#84cc16","#f97316","#6366f1"].map(c => {
                const current = editSubject ? editSubject.color : subjectForm.color;
                return (
                  <button
                    key={c}
                    type="button"
                    className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 ${current === c ? "border-white scale-110" : "border-transparent"}`}
                    style={{ backgroundColor: c }}
                    onClick={() => editSubject ? setEditSubject(s => s && ({ ...s, color: c })) : setSubjectForm(f => ({ ...f, color: c }))}
                  />
                );
              })}
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
                    color: editSubject.color || undefined,
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
                    color: subjectForm.color || undefined,
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
