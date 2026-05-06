import { useState, useMemo, useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/contexts/I18nContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  BookOpen, Clock, Plus, Trash2, Edit2, ChevronDown, ChevronUp,
  User, Calendar, TrendingUp, TrendingDown, Minus, AlertTriangle,
  LayoutGrid, List, Mail, Copy, Sun, Coffee, Loader2,
} from "lucide-react";
import { HourAdjustmentsLog } from "@/components/HourAdjustmentsLog";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday"] as const;
const SEMESTERS = ["1", "2", "full_year"] as const;

const currentAcademicYear = (() => {
  const now = new Date();
  const y = now.getFullYear();
  return now.getMonth() >= 8 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
})();

// Group teachers by school name
function groupTeachersBySchool(teachers: any[]) {
  const grouped = new Map<string, any[]>();
  teachers.forEach(t => {
    const school = t.schoolName || "Unassigned";
    if (!grouped.has(school)) {
      grouped.set(school, []);
    }
    grouped.get(school)!.push(t);
  });
  return Array.from(grouped.entries())
    .map(([school, teacherList]) => ({
      school,
      teachers: teacherList.sort((a, b) => (a.displayName || a.name).localeCompare(b.displayName || b.name)),
    }))
    .sort((a, b) => a.school.localeCompare(b.school));
}

export default function DirectorTeacherProfiles() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [selectedTeacherId, setSelectedTeacherId] = useState<number | null>(null);
  const [academicYear, setAcademicYear] = useState(currentAcademicYear);
  const [expandedTeacher, setExpandedTeacher] = useState<number | null>(null);
  // Track if we arrived from the approval shortcut
  const [fromApprovals, setFromApprovals] = useState(false);
  const [newlyApprovedId, setNewlyApprovedId] = useState<number | null>(null);
  // Inline slot error for conflict feedback
  const [slotError, setSlotError] = useState<string | null>(null);
  // Schedule view toggle: "list" (default) or "grid"
  const [scheduleView, setScheduleView] = useState<"list" | "grid">("list");
  // Semester filter: "all" | "1" | "2" | "full_year"
  const [semesterFilter, setSemesterFilter] = useState<"all" | "1" | "2" | "full_year">("all");
  const [contractedHoursInput, setContractedHoursInput] = useState<string>("");
  const [showTempOnly, setShowTempOnly] = useState(false);
  const [showDetailView, setShowDetailView] = useState(false);
  const [detailTeacherId, setDetailTeacherId] = useState<number | null>(null);
  const [copyScheduleDialog, setCopyScheduleDialog] = useState(false);
  const [copyFromTeacherId, setCopyFromTeacherId] = useState<number | null>(null);
  const [copyOverwrite, setCopyOverwrite] = useState(false);

  // Pre-select teacher from ?teacher= query param (set by approval shortcut)
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const teacherParam = params.get("teacher");
      if (teacherParam) {
        const id = parseInt(teacherParam, 10);
        if (!isNaN(id)) {
          setSelectedTeacherId(id);
          setFromApprovals(true);
          setNewlyApprovedId(id);
        }
      }
    } catch { /* ignore */ }
  }, []);

  // Subject dialog
  const [subjectDialog, setSubjectDialog] = useState(false);
  const [editSubject, setEditSubject] = useState<{ id: number; subject: string; level: string; notes: string } | null>(null);
  const [subjectForm, setSubjectForm] = useState({ subject: "", level: "", notes: "" });

  // Schedule dialog
  const [scheduleDialog, setScheduleDialog] = useState(false);
  const [editSlot, setEditSlot] = useState<{ id: number } | null>(null);
  const [slotForm, setSlotForm] = useState({
    semester: "1" as typeof SEMESTERS[number],
    dayOfWeek: "monday" as typeof DAYS[number],
    lessonSlot: "",
    startTime: "09:00",
    endTime: "10:00",
    subject: "",
    groupName: "",
  });

  const utils = trpc.useUtils();

  const { data: roster, isLoading: rosterLoading } = trpc.teacherProfile.getTeacherRoster.useQuery(
    { academicYear },
    { refetchInterval: 30000 }
  );

  const { data: subjects, refetch: refetchSubjects } = trpc.teacherProfile.getSubjects.useQuery(
    { userId: selectedTeacherId! },
    { enabled: !!selectedTeacherId }
  );

  const { data: schedule, refetch: refetchSchedule } = trpc.teacherProfile.getSchedule.useQuery(
    { userId: selectedTeacherId!, academicYear },
    { enabled: !!selectedTeacherId }
  );

  const { data: hoursSummary } = trpc.teacherProfile.getTeachingHoursSummary.useQuery(
    { userId: selectedTeacherId!, academicYear },
    { enabled: !!selectedTeacherId }
  );

  const addSubjectMutation = trpc.teacherProfile.addSubject.useMutation({
    onSuccess: () => { toast.success(t("tp_subject_added")); setSubjectDialog(false); refetchSubjects(); utils.teacherProfile.getTeacherRoster.invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const updateSubjectMutation = trpc.teacherProfile.updateSubject.useMutation({
    onSuccess: () => { toast.success(t("tp_subject_updated")); setSubjectDialog(false); refetchSubjects(); },
    onError: (e) => toast.error(e.message),
  });
  const deleteSubjectMutation = trpc.teacherProfile.deleteSubject.useMutation({
    onSuccess: () => { toast.success(t("tp_subject_deleted")); refetchSubjects(); utils.teacherProfile.getTeacherRoster.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const addSlotMutation = trpc.teacherProfile.addScheduleSlot.useMutation({
    onSuccess: () => { toast.success(t("tp_slot_added")); setScheduleDialog(false); setSlotError(null); refetchSchedule(); },
    onError: (e) => {
      // Parse structured conflict messages for inline display
      const msg = e.message;
      if (msg.startsWith("tp_conflict_end_before_start")) {
        setSlotError(t("tp_conflict_end_before_start"));
      } else if (msg.startsWith("tp_conflict_overlap|")) {
        const parts = msg.split("|");
        const subject = parts[1] ?? "";
        const time = parts[2] ?? "";
        setSlotError(t("tp_conflict_overlap").replace("{subject}", subject).replace("{time}", time));
      } else {
        setSlotError(msg);
      }
    },
  });
  const updateSlotMutation = trpc.teacherProfile.updateScheduleSlot.useMutation({
    onSuccess: () => { toast.success(t("tp_slot_updated")); setScheduleDialog(false); refetchSchedule(); },
    onError: (e) => toast.error(e.message),
  });
  const deleteSlotMutation = trpc.teacherProfile.deleteScheduleSlot.useMutation({
    onSuccess: () => { toast.success(t("tp_slot_deleted")); refetchSchedule(); },
    onError: (e) => toast.error(e.message),
  });

  const setPermanentMutation = trpc.teacherProfile.setTeacherPermanent.useMutation({
    onSuccess: (_, vars) => {
      toast.success(vars.isPermanent ? t("tp_set_permanent_success") : t("tp_set_non_permanent_success"));
      utils.teacherProfile.getTeacherRoster.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const setContractedHoursMutation = trpc.teacherProfile.setContractedHours.useMutation({
    onSuccess: () => {
      toast.success(t("tp_contracted_hours_saved"));
      utils.teacherProfile.getTeacherRoster.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  // ── Cover Availability tab state ──────────────────────────────────────────
  const [coverCalendarId, setCoverCalendarId] = useState<number | undefined>(undefined);
  const { data: coverData, isLoading: coverLoading } = trpc.teacherProfile.getCoverAvailability.useQuery(
    { calendarId: coverCalendarId },
    { enabled: true }
  );

  // ── Holiday & Prep tab state ──────────────────────────────────────────────
  const [holidayProfileId, setHolidayProfileId] = useState<number | null>(null);
  const [showProfileForm, setShowProfileForm] = useState(false);
  const [profileForm, setProfileForm] = useState({ contractedHoursPerWeek: 20, prepHoursPerWeek: 5, annualHolidayDays: 25, notes: "" });
  const [showAddHoliday, setShowAddHoliday] = useState(false);
  const [holidayForm, setHolidayForm] = useState({ date: "", type: "taken" as "taken" | "owed", hours: "7.5", notes: "" });
  const [deleteHolidayId, setDeleteHolidayId] = useState<number | null>(null);

  const { data: profiles = [] } = trpc.teacherProfile.listProfiles.useQuery();

  // Find profile matching selected teacher name
  const matchedProfile = profiles.find(p => {
    const teacherName = selectedTeacher?.displayName || selectedTeacher?.name || "";
    return p.name.toLowerCase() === teacherName.toLowerCase();
  });
  const activeProfileId = holidayProfileId ?? matchedProfile?.id ?? null;

  const { data: profileStats, isLoading: statsLoading } = trpc.teacherProfile.getProfileStats.useQuery(
    { teacherProfileId: activeProfileId! },
    { enabled: activeProfileId !== null }
  );

  const upsertProfileMutation = trpc.teacherProfile.upsertProfile.useMutation({
    onSuccess: (data) => {
      utils.teacherProfile.listProfiles.invalidate();
      setHolidayProfileId(data.id);
      setShowProfileForm(false);
      toast.success("Profile saved");
    },
    onError: (e) => toast.error(e.message),
  });

  const addHolidayMutation = trpc.teacherProfile.addHolidayRecord.useMutation({
    onSuccess: () => {
      utils.teacherProfile.getProfileStats.invalidate({ teacherProfileId: activeProfileId! });
      setShowAddHoliday(false);
      setHolidayForm({ date: "", type: "taken", hours: "7.5", notes: "" });
      toast.success("Holiday record added");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteHolidayMutation = trpc.teacherProfile.deleteHolidayRecord.useMutation({
    onSuccess: () => {
      utils.teacherProfile.getProfileStats.invalidate({ teacherProfileId: activeProfileId! });
      setDeleteHolidayId(null);
      toast.success("Record deleted");
    },
  });

  const copyScheduleMutation = trpc.teacherProfile.copySchedule.useMutation({
    onSuccess: (data) => {
      if (data.copied === 0) {
        toast.info(t("tp_copy_schedule_empty"));
      } else {
        toast.success(t("tp_copy_schedule_success"));
        refetchSchedule();
      }
      setCopyScheduleDialog(false);
      setCopyFromTeacherId(null);
      setCopyOverwrite(false);
    },
    onError: (e) => toast.error(e.message),
  });

  function openAddSubject(teacherId: number) {
    setSelectedTeacherId(teacherId);
    setEditSubject(null);
    setSubjectForm({ subject: "", level: "", notes: "" });
    setSubjectDialog(true);
  }
  function openEditSubject(s: { id: number; subject: string; level: string; notes: string | null }) {
    setEditSubject({ id: s.id, subject: s.subject, level: s.level, notes: s.notes ?? "" });
    setSubjectForm({ subject: s.subject, level: s.level, notes: s.notes ?? "" });
    setSubjectDialog(true);
  }
  function submitSubject() {
    if (!subjectForm.subject || !subjectForm.level) return;
    if (editSubject) {
      updateSubjectMutation.mutate({ id: editSubject.id, ...subjectForm });
    } else {
      addSubjectMutation.mutate({ userId: selectedTeacherId!, ...subjectForm });
    }
  }

  function openAddSlot(teacherId: number) {
    setSelectedTeacherId(teacherId);
    setEditSlot(null);
    setSlotError(null);
    setSlotForm({ semester: "1", dayOfWeek: "monday", lessonSlot: "", startTime: "09:00", endTime: "10:00", subject: "", groupName: "" });
    setScheduleDialog(true);
  }
  function openEditSlot(slot: { id: number; semester: string; dayOfWeek: string; lessonSlot: string; startTime: string; endTime: string; subject: string; groupName: string | null }) {
    setEditSlot({ id: slot.id });
    setSlotError(null);
    setSlotForm({
      semester: slot.semester as typeof SEMESTERS[number],
      dayOfWeek: slot.dayOfWeek as typeof DAYS[number],
      lessonSlot: slot.lessonSlot,
      startTime: slot.startTime,
      endTime: slot.endTime,
      subject: slot.subject,
      groupName: slot.groupName ?? "",
    });
    setScheduleDialog(true);
  }
  function submitSlot() {
    if (!slotForm.lessonSlot || !slotForm.subject) return;
    if (editSlot) {
      updateSlotMutation.mutate({ id: editSlot.id, ...slotForm });
    } else {
      addSlotMutation.mutate({ userId: selectedTeacherId!, academicYear, ...slotForm });
    }
  }

  // Filtered schedule (by semester)
  const filteredSchedule = useMemo(() => {
    if (!schedule) return [];
    if (semesterFilter === "all") return schedule;
    return schedule.filter((s) => s.semester === semesterFilter);
  }, [schedule, semesterFilter]);

  // Group filtered schedule by day
  const scheduleByDay = useMemo(() => {
    const map: Record<string, typeof filteredSchedule> = {};
    for (const slot of filteredSchedule) {
      if (!map[slot.dayOfWeek]) map[slot.dayOfWeek] = [];
      map[slot.dayOfWeek].push(slot);
    }
    return map;
  }, [filteredSchedule]);

  const selectedTeacher = roster?.find((t) => t.id === selectedTeacherId);

  // Sync contracted hours input when selected teacher changes
  useEffect(() => {
    if (selectedTeacher?.contractedWeeklyMinutes != null) {
      setContractedHoursInput(String(Math.round(selectedTeacher.contractedWeeklyMinutes / 60 * 10) / 10));
    } else {
      setContractedHoursInput("");
    }
  }, [selectedTeacherId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Show detail view if a teacher is selected for viewing details
  if (showDetailView && detailTeacherId) {
    const TeacherDetailView = require("@/pages/TeacherDetailView").default;
    return (
      <TeacherDetailView
        teacherId={detailTeacherId}
        onBack={() => {
          setShowDetailView(false);
          setDetailTeacherId(null);
        }}
      />
    );
  }

  return (
    <div className="container py-6 space-y-6">
      {/* Back to Approvals contextual link — shown when navigated from approval shortcut */}
      {fromApprovals && (
        <button
          onClick={() => navigate("/director/approvals")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronUp className="w-4 h-4 rotate-[-90deg]" />
          {t("add_teacher_back_approvals")}
        </button>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t("tp_title")}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t("tp_subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-sm whitespace-nowrap">{t("tp_academic_year")}</Label>
          <Input
            className="w-28"
            value={academicYear}
            onChange={(e) => setAcademicYear(e.target.value)}
            placeholder="2025-2026"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Teacher Roster */}
        <div className="lg:col-span-1 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">{t("tp_roster")}</h2>
            {roster && roster.some((t) => t.isPermanent === false) && (
              <button
                onClick={() => setShowTempOnly((v) => !v)}
                className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                  showTempOnly
                    ? "bg-amber-100 border-amber-400 text-amber-700 dark:bg-amber-900/30 dark:border-amber-500 dark:text-amber-300"
                    : "border-border text-muted-foreground hover:border-amber-400 hover:text-amber-600"
                }`}
              >
                {showTempOnly ? t("tp_filter_temp_active") : t("tp_filter_temp_only")}
              </button>
            )}
          </div>
          {rosterLoading ? (
            <div className="text-muted-foreground text-sm">{t("loading")}</div>
          ) : !roster?.length ? (
            <div className="text-muted-foreground text-sm">{t("tp_no_teachers")}</div>
          ) : (
            roster.filter((t) => !showTempOnly || t.isPermanent === false).map((teacher) => (
              <Card
                key={teacher.id}
                className={`cursor-pointer transition-colors ${selectedTeacherId === teacher.id ? "ring-2 ring-primary" : "hover:bg-accent/50"} ${newlyApprovedId === teacher.id ? "ring-2 ring-green-500" : ""}`}
                onClick={() => setSelectedTeacherId(teacher.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <User className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="font-medium text-sm truncate">{teacher.displayName || teacher.name}</p>
                          {newlyApprovedId === teacher.id && (
                            <Badge className="text-[10px] px-1.5 py-0 bg-green-500 text-white shrink-0">New</Badge>
                          )}
                          {teacher.isPermanent === false && (
                            <Badge className="text-[10px] px-1.5 py-0 bg-amber-500/20 text-amber-400 border border-amber-500/40 shrink-0">{t("tp_non_permanent")}</Badge>
                          )}
                          {(teacher as any).cutcgMemberNumber && (
                            <Badge className="text-[10px] px-1.5 py-0 bg-blue-500/20 text-blue-400 border border-blue-500/40 shrink-0">CUTCG #{(teacher as any).cutcgMemberNumber}</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{teacher.email}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <Badge variant="secondary" className="text-xs">{teacher.subjectCount} {t("tp_subjects")}</Badge>
                      <span className="text-xs text-muted-foreground">{teacher.weeklyHours}/wk</span>
                    </div>
                  </div>
                  {teacher.subjects.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {teacher.subjects.slice(0, 3).map((s, i) => (
                        <Badge key={i} variant="outline" className="text-xs">{s}</Badge>
                      ))}
                      {teacher.subjects.length > 3 && (
                        <Badge variant="outline" className="text-xs">+{teacher.subjects.length - 3}</Badge>
                      )}
                    </div>
                  )}
                  {/* Weekly hours progress bar */}
                  {teacher.contractedWeeklyMinutes != null && teacher.contractedWeeklyMinutes > 0 && (
                    <div className="mt-2.5 space-y-1">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{t("tp_hours_progress_label")}</span>
                        <span>{teacher.weeklyHours} / {Math.round(teacher.contractedWeeklyMinutes / 60 * 10) / 10}h</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            teacher.weeklyMinutes >= teacher.contractedWeeklyMinutes
                              ? "bg-green-500"
                              : teacher.weeklyMinutes >= teacher.contractedWeeklyMinutes * 0.75
                              ? "bg-primary"
                              : "bg-amber-500"
                          }`}
                          style={{ width: `${Math.min(100, Math.round((teacher.weeklyMinutes / teacher.contractedWeeklyMinutes) * 100))}%` }}
                        />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Teacher Detail Panel */}
        <div className="lg:col-span-2">
          {!selectedTeacherId ? (
            <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
              {t("tp_select_teacher")}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Detail View Button */}
              <Button
                onClick={() => {
                  setDetailTeacherId(selectedTeacherId);
                  setShowDetailView(true);
                }}
                className="w-full"
              >
                {t("view_teacher_details")}
              </Button>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 min-w-0">
                  <h2 className="font-semibold text-lg truncate">{selectedTeacher?.displayName || selectedTeacher?.name}</h2>
                  {selectedTeacher?.isPermanent === false && (
                    <Badge className="text-[10px] px-1.5 py-0 bg-amber-500/20 text-amber-400 border border-amber-500/40 shrink-0">{t("tp_non_permanent")}</Badge>
                  )}
                  {(selectedTeacher as any)?.cutcgMemberNumber && (
                    <Badge className="text-[10px] px-1.5 py-0 bg-blue-500/20 text-blue-400 border border-blue-500/40 shrink-0">CUTCG #{(selectedTeacher as any).cutcgMemberNumber}</Badge>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs shrink-0"
                  disabled={setPermanentMutation.isPending}
                  onClick={() => setPermanentMutation.mutate({
                    userId: selectedTeacherId!,
                    isPermanent: !(selectedTeacher?.isPermanent ?? true),
                  })}
                >
                  {selectedTeacher?.isPermanent === false ? t("tp_set_permanent") : t("tp_set_non_permanent")}
                </Button>
              </div>

              {/* School Assignment Section */}
              <div className="bg-accent/50 rounded-lg p-3 space-y-2">
                <Label className="text-sm font-semibold">{t("tp_school_assignment") || "School Assignment"}</Label>
                <p className="text-xs text-muted-foreground">{selectedTeacher?.schoolName || "Unassigned"}</p>
              </div>

              <Tabs defaultValue="subjects">
                <TabsList>
                  <TabsTrigger value="subjects"><BookOpen className="h-4 w-4 mr-1" />{t("tp_tab_subjects")}</TabsTrigger>
                  <TabsTrigger value="schedule"><Calendar className="h-4 w-4 mr-1" />{t("tp_tab_schedule")}</TabsTrigger>
                  <TabsTrigger value="hours"><Clock className="h-4 w-4 mr-1" />{t("tp_tab_hours")}</TabsTrigger>
                  <TabsTrigger value="holiday"><Sun className="h-4 w-4 mr-1" />Holiday &amp; Prep</TabsTrigger>
                </TabsList>

                {/* Subjects Tab */}
                <TabsContent value="subjects" className="space-y-3 mt-4">
                  <div className="flex justify-end">
                    <Button size="sm" onClick={() => openAddSubject(selectedTeacherId)}>
                      <Plus className="h-4 w-4 mr-1" />{t("tp_add_subject")}
                    </Button>
                  </div>
                  {!subjects?.length ? (
                    <div className="text-muted-foreground text-sm text-center py-8">{t("tp_no_subjects")}</div>
                  ) : (
                    <div className="space-y-2">
                      {subjects.map((s) => (
                        <Card key={s.id}>
                          <CardContent className="p-3 flex items-center justify-between gap-2">
                            <div>
                              <p className="font-medium text-sm">{s.subject}</p>
                              <p className="text-xs text-muted-foreground">{t("tp_level")}: {s.level}</p>
                              {s.notes && <p className="text-xs text-muted-foreground mt-1">{s.notes}</p>}
                            </div>
                            <div className="flex gap-1 shrink-0">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditSubject(s)}>
                                <Edit2 className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteSubjectMutation.mutate({ id: s.id })}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </TabsContent>

                {/* Schedule Tab */}
                <TabsContent value="schedule" className="space-y-3 mt-4">
                  <div className="flex items-center justify-between gap-2">
                    {/* View toggle */}
                    <div className="flex items-center gap-1 border rounded-md p-0.5">
                      <Button
                        variant={scheduleView === "list" ? "secondary" : "ghost"}
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setScheduleView("list")}
                        title={t("tp_view_list")}
                      >
                        <List className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant={scheduleView === "grid" ? "secondary" : "ghost"}
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setScheduleView("grid")}
                        title={t("tp_view_grid")}
                      >
                        <LayoutGrid className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" onClick={() => setCopyScheduleDialog(true)}>
                        <Copy className="h-4 w-4 mr-1" />{t("tp_copy_schedule_btn")}
                      </Button>
                      <Button size="sm" onClick={() => openAddSlot(selectedTeacherId)}>
                        <Plus className="h-4 w-4 mr-1" />{t("tp_add_slot")}
                      </Button>
                    </div>
                  </div>

                  {/* Semester filter */}
                  <div className="flex items-center gap-1 flex-wrap">
                    {(["all", "1", "2", "full_year"] as const).map((val) => (
                      <button
                        key={val}
                        onClick={() => setSemesterFilter(val)}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors border ${
                          semesterFilter === val
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-transparent text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
                        }`}
                      >
                        {val === "all" ? t("tp_filter_all_semesters") : val === "full_year" ? t("tp_filter_full_year") : val === "1" ? t("tp_filter_sem1") : t("tp_filter_sem2")}
                      </button>
                    ))}
                  </div>

                  {!schedule?.length ? (
                    <div className="text-muted-foreground text-sm text-center py-8">{t("tp_no_schedule")}</div>
                  ) : scheduleView === "list" ? (
                    /* ── List view ── */
                    <div className="space-y-3">
                      {DAYS.map((day) => {
                        const daySlots = scheduleByDay[day];
                        if (!daySlots?.length) return null;
                        return (
                          <Card key={day}>
                            <CardHeader className="py-2 px-4">
                              <CardTitle className="text-sm capitalize">{t(`tp_day_${day}`)}</CardTitle>
                            </CardHeader>
                            <CardContent className="px-4 pb-3 space-y-2">
                              {daySlots
                                .sort((a, b) => a.startTime.localeCompare(b.startTime))
                                .map((slot) => (
                                  <div key={slot.id} className="flex items-center justify-between gap-2 text-sm">
                                    <div className="flex items-center gap-2 min-w-0">
                                      <span className="text-muted-foreground text-xs whitespace-nowrap">{slot.startTime}–{slot.endTime}</span>
                                      <span className="font-medium truncate">{slot.subject}</span>
                                      {slot.groupName && <Badge variant="outline" className="text-xs">{slot.groupName}</Badge>}
                                      <Badge variant="secondary" className="text-xs">{t(`tp_sem_${slot.semester}`)}</Badge>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditSlot(slot)}>
                                        <Edit2 className="h-3.5 w-3.5" />
                                      </Button>
                                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteSlotMutation.mutate({ id: slot.id })}>
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  ) : (
                    /* ── Grid view ── */
                    <div className="overflow-x-auto">
                      <div className="grid min-w-[480px]" style={{ gridTemplateColumns: "auto repeat(5, 1fr)", gap: "2px" }}>
                        {/* Header row */}
                        <div className="" />
                        {DAYS.map((d) => (
                          <div key={d} className="text-center text-xs font-semibold py-1.5 bg-muted rounded-sm capitalize">{t(`tp_day_${d}`)}</div>
                        ))}
                        {/* Collect all unique time slots sorted */}
                        {Array.from(new Set(filteredSchedule.map((s) => `${s.startTime}–${s.endTime}`))).sort().map((timeRange) => (
                          <>
                            {/* Time label */}
                            <div key={`label-${timeRange}`} className="text-xs text-muted-foreground pr-2 py-1.5 flex items-center whitespace-nowrap">{timeRange}</div>
                            {/* Day cells */}
                            {DAYS.map((day) => {
                              const [start, end] = timeRange.split("–");
                              const slot = filteredSchedule.find((s) => s.dayOfWeek === day && s.startTime === start && s.endTime === end);
                              return slot ? (
                                <div
                                  key={`${day}-${timeRange}`}
                                  className="bg-primary/10 border border-primary/20 rounded-sm px-1.5 py-1 text-xs cursor-pointer hover:bg-primary/20 transition-colors"
                                  onClick={() => openEditSlot(slot)}
                                >
                                  <p className="font-medium truncate">{slot.subject}</p>
                                  {slot.groupName && <p className="text-muted-foreground truncate">{slot.groupName}</p>}
                                </div>
                              ) : (
                                <div key={`${day}-${timeRange}`} className="bg-muted/30 rounded-sm" />
                              );
                            })}
                          </>
                        ))}
                      </div>
                    </div>
                  )}
                </TabsContent>

                {/* Hours Tab */}
                <TabsContent value="hours" className="space-y-4 mt-4">
                  {!hoursSummary ? (
                    <div className="text-muted-foreground text-sm text-center py-8">{t("loading")}</div>
                  ) : (
                    <>
                      {/* Contracted Hours Setting */}
                      <Card>
                        <CardContent className="p-4">
                          <p className="text-sm font-medium mb-3">{t("tp_contracted_hours_label")}</p>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min="0"
                              max="60"
                              step="0.5"
                              className="flex h-9 w-28 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                              placeholder={t("tp_contracted_hours_placeholder")}
                              value={contractedHoursInput}
                              onChange={(e) => setContractedHoursInput(e.target.value)}
                            />
                            <span className="text-sm text-muted-foreground">h/week</span>
                            <Button
                              size="sm"
                              disabled={setContractedHoursMutation.isPending}
                              onClick={() => {
                                const hours = parseFloat(contractedHoursInput);
                                const minutes = isNaN(hours) || contractedHoursInput === "" ? null : Math.round(hours * 60);
                                setContractedHoursMutation.mutate({ userId: selectedTeacherId!, contractedWeeklyMinutes: minutes });
                              }}
                            >
                              {t("save")}
                            </Button>
                            {selectedTeacher?.contractedWeeklyMinutes != null && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-muted-foreground text-xs"
                                disabled={setContractedHoursMutation.isPending}
                                onClick={() => {
                                  setContractedHoursInput("");
                                  setContractedHoursMutation.mutate({ userId: selectedTeacherId!, contractedWeeklyMinutes: null });
                                }}
                              >
                                {t("cancel")}
                              </Button>
                            )}
                          </div>
                          {selectedTeacher?.contractedWeeklyMinutes != null && (
                            <p className="text-xs text-muted-foreground mt-2">
                              {t("tp_contracted_hours_current")}: {Math.round(selectedTeacher.contractedWeeklyMinutes / 60 * 10) / 10}h/week
                            </p>
                          )}
                        </CardContent>
                      </Card>

                      {/* Summary Cards */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        <Card>
                          <CardContent className="p-4 text-center">
                            <p className="text-2xl font-bold">{hoursSummary.weeklyHours}</p>
                            <p className="text-xs text-muted-foreground mt-1">{t("tp_weekly_hours")}</p>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="p-4 text-center">
                            <p className="text-2xl font-bold">{hoursSummary.scheduledTotalHours}</p>
                            <p className="text-xs text-muted-foreground mt-1">{t("tp_year_total")}</p>
                          </CardContent>
                        </Card>
                        <Card className={`${hoursSummary.status === "over" ? "border-orange-400" : hoursSummary.status === "under" ? "border-blue-400" : "border-green-400"}`}>
                          <CardContent className="p-4 text-center">
                            <div className="flex items-center justify-center gap-1">
                              {hoursSummary.status === "over" ? <TrendingUp className="h-4 w-4 text-orange-500" /> : hoursSummary.status === "under" ? <TrendingDown className="h-4 w-4 text-blue-500" /> : <Minus className="h-4 w-4 text-green-500" />}
                              <p className="text-2xl font-bold">{hoursSummary.overUnderHours}</p>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              {hoursSummary.status === "over" ? t("tp_over_hours") : hoursSummary.status === "under" ? t("tp_under_hours") : t("tp_balanced")}
                            </p>
                          </CardContent>
                        </Card>
                      </div>

                      {/* Calendar info */}
                      <Card>
                        <CardContent className="p-4 space-y-2">
                          <p className="text-sm font-medium">{t("tp_calendar_info")}</p>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">{t("tp_teaching_days")}</span>
                            <span className="font-medium">{hoursSummary.calendarTeachingDays}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">{t("tp_calendar_hours")}</span>
                            <span className="font-medium">{hoursSummary.calendarTeachingHours}</span>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Cover/Payback Hour Adjustments */}
                      {selectedTeacherId && (
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm">{t("hour_adj_log_title")}</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <HourAdjustmentsLog userId={selectedTeacherId} />
                          </CardContent>
                        </Card>
                      )}

                      {/* Per-semester breakdown */}
                      {hoursSummary.semesterSummary.length > 0 && (
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm">{t("tp_semester_breakdown")}</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-2">
                            {hoursSummary.semesterSummary.map((sem) => (
                              <div key={sem.semester} className="flex justify-between text-sm">
                                <span className="text-muted-foreground">{({ "1": t("tp_sem_1"), "2": t("tp_sem_2"), full_year: t("tp_sem_full_year") } as Record<string, string>)[sem.semester] ?? sem.semester}</span>
                                <span className="font-medium">{sem.weeklyHours}/wk · {sem.slots} {t("tp_slots")}</span>
                              </div>
                            ))}
                          </CardContent>
                        </Card>
                      )}
                    </>
                  )}
                </TabsContent>
                {/* ── Holiday & Prep Tab ── */}
                <TabsContent value="holiday" className="space-y-4 mt-4">
                  {activeProfileId === null ? (
                    <Card>
                      <CardContent className="p-6 text-center space-y-3">
                        <Sun className="h-10 w-10 mx-auto text-muted-foreground opacity-40" />
                        <p className="text-sm text-muted-foreground">No holiday &amp; prep profile linked to <strong>{selectedTeacher?.displayName || selectedTeacher?.name}</strong>.</p>
                        <p className="text-xs text-muted-foreground">Create a profile to track contracted hours, prep time, holiday entitlement, and free periods.</p>
                        <Button size="sm" onClick={() => {
                          const name = selectedTeacher?.displayName || selectedTeacher?.name || "";
                          setProfileForm({ contractedHoursPerWeek: 20, prepHoursPerWeek: 5, annualHolidayDays: 25, notes: "" });
                          setShowProfileForm(true);
                        }}>
                          <Plus className="h-4 w-4 mr-1" /> Create Profile
                        </Button>
                      </CardContent>
                    </Card>
                  ) : statsLoading ? (
                    <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                  ) : profileStats ? (
                    <>
                      {/* Edit profile button */}
                      <div className="flex justify-end">
                        <Button size="sm" variant="outline" onClick={() => {
                          setProfileForm({
                            contractedHoursPerWeek: profileStats.profile.contractedHoursPerWeek,
                            prepHoursPerWeek: profileStats.profile.prepHoursPerWeek,
                            annualHolidayDays: profileStats.profile.annualHolidayDays,
                            notes: "",
                          });
                          setShowProfileForm(true);
                        }}>
                          <Edit2 className="h-3.5 w-3.5 mr-1" /> Edit Profile Settings
                        </Button>
                      </div>

                      {/* Hours grid: Weekly / Monthly / Annual */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {(["weekly", "monthly", "annual"] as const).map(period => {
                          const d = profileStats[period];
                          return (
                            <Card key={period}>
                              <CardHeader className="pb-1 pt-3 px-4">
                                <CardTitle className="text-xs text-muted-foreground capitalize">{period}</CardTitle>
                              </CardHeader>
                              <CardContent className="px-4 pb-3">
                                <div className="grid grid-cols-3 gap-1.5 text-center">
                                  <div>
                                    <div className="text-lg font-bold text-blue-600 dark:text-blue-400">{d.teachingHours}h</div>
                                    <div className="text-[10px] text-muted-foreground">Teaching</div>
                                  </div>
                                  <div>
                                    <div className="text-lg font-bold text-purple-600 dark:text-purple-400">{d.contractedHours}h</div>
                                    <div className="text-[10px] text-muted-foreground">Contracted</div>
                                  </div>
                                  <div>
                                    <div className="text-lg font-bold text-teal-600 dark:text-teal-400">{d.prepHours}h</div>
                                    <div className="text-[10px] text-muted-foreground">Prep</div>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>

                      {/* Semester breakdown */}
                      {profileStats.semesterStats.length > 0 && (
                        <Card>
                          <CardHeader className="pb-1 pt-3 px-4">
                            <CardTitle className="text-xs text-muted-foreground">Semester Breakdown</CardTitle>
                          </CardHeader>
                          <CardContent className="px-4 pb-3">
                            <div className="grid grid-cols-3 gap-2">
                              {profileStats.semesterStats.map(s => (
                                <div key={s.semesterNumber} className="border rounded-lg p-2.5 text-center">
                                  <div className="text-xs font-medium mb-1.5">Semester {s.semesterNumber} <span className="text-muted-foreground">({s.weeks}wk)</span></div>
                                  <div className="grid grid-cols-3 gap-1 text-xs">
                                    <div><div className="font-semibold text-blue-600 dark:text-blue-400">{s.teachingHours}h</div><div className="text-muted-foreground">Teaching</div></div>
                                    <div><div className="font-semibold text-purple-600 dark:text-purple-400">{s.contractedHours}h</div><div className="text-muted-foreground">Contracted</div></div>
                                    <div><div className="font-semibold text-teal-600 dark:text-teal-400">{s.prepHours}h</div><div className="text-muted-foreground">Prep</div></div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      {/* Holiday balance */}
                      <Card>
                        <CardHeader className="pb-1 pt-3 px-4 flex flex-row items-center justify-between">
                          <CardTitle className="text-xs text-muted-foreground">Holiday Balance</CardTitle>
                          <Button size="sm" className="h-7 text-xs" onClick={() => setShowAddHoliday(true)}>
                            <Plus className="h-3.5 w-3.5 mr-1" /> Add Record
                          </Button>
                        </CardHeader>
                        <CardContent className="px-4 pb-3 space-y-3">
                          <div className="grid grid-cols-3 gap-2 text-center">
                            <div className="border rounded-lg p-2">
                              <div className="text-lg font-bold">{profileStats.holiday.entitlementDays.toFixed(1)}</div>
                              <div className="text-xs text-muted-foreground">Days Entitled</div>
                            </div>
                            <div className="border rounded-lg p-2 border-red-200 dark:border-red-800">
                              <div className="text-lg font-bold text-red-600 dark:text-red-400">{(profileStats.holiday.takenHours / 7.5).toFixed(1)}</div>
                              <div className="text-xs text-muted-foreground">Days Taken</div>
                            </div>
                            <div className={`border rounded-lg p-2 ${profileStats.holiday.balanceDays >= 0 ? "border-green-200 dark:border-green-800" : "border-orange-200 dark:border-orange-800"}`}>
                              <div className={`text-lg font-bold ${profileStats.holiday.balanceDays >= 0 ? "text-green-600 dark:text-green-400" : "text-orange-600 dark:text-orange-400"}`}>{profileStats.holiday.balanceDays.toFixed(1)}</div>
                              <div className="text-xs text-muted-foreground">Balance</div>
                            </div>
                          </div>
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>{profileStats.holiday.takenHours.toFixed(1)}h taken</span>
                              <span>{profileStats.holiday.balanceHours.toFixed(1)}h remaining</span>
                            </div>
                            <Progress value={Math.min(100, (profileStats.holiday.takenHours / (profileStats.holiday.entitlementHours + profileStats.holiday.owedHours || 1)) * 100)} className="h-1.5" />
                          </div>
                          {profileStats.holiday.records.length > 0 && (
                            <div className="space-y-1.5 mt-2">
                              {profileStats.holiday.records.map(r => (
                                <div key={r.id} className="flex items-center justify-between text-xs border rounded px-2.5 py-1.5">
                                  <div className="flex items-center gap-2">
                                    <Badge variant={r.type === "taken" ? "destructive" : "secondary"} className="text-[10px] px-1.5 py-0">{r.type === "taken" ? "Taken" : "Owed"}</Badge>
                                    <span>{new Date(r.date as unknown as string).toLocaleDateString()}</span>
                                    <span className="text-muted-foreground">{parseFloat(String(r.hours)).toFixed(1)}h</span>
                                    {r.notes && <span className="text-muted-foreground italic">{r.notes}</span>}
                                  </div>
                                  <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => setDeleteHolidayId(r.id)}>
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>

                      {/* Free periods */}
                      <Card>
                        <CardHeader className="pb-1 pt-3 px-4">
                          <CardTitle className="text-xs text-muted-foreground flex items-center gap-1.5">
                            <Coffee className="h-3.5 w-3.5" /> Free Period Sessions (Cover Available)
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="px-4 pb-3">
                          {profileStats.freePeriodSessions.length === 0 ? (
                            <p className="text-xs text-muted-foreground text-center py-4">No free/prep periods detected. Sessions labelled "Free", "Prep", or "Planning" will appear here.</p>
                          ) : (
                            <div className="space-y-1.5">
                              {profileStats.freePeriodSessions.map((s, i) => (
                                <div key={i} className="flex items-center justify-between text-xs border rounded px-2.5 py-1.5 bg-amber-50 dark:bg-amber-950/30">
                                  <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">{["Mon","Tue","Wed","Thu","Fri"][s.dayOfWeek - 1]}</Badge>
                                    <span className="font-medium">{s.subject}</span>
                                    {s.classGroup && <span className="text-muted-foreground">{s.classGroup}</span>}
                                  </div>
                                  <span className="text-muted-foreground">{s.startTime}–{s.endTime}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </>
                  ) : null}
                </TabsContent>

              </Tabs>
            </div>
          )}
         </div>
      </div>

      {/* ── Cover Availability panel (full-width, below grid) ─────────────── */}
      <div className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Coffee className="h-5 w-5 text-amber-500" />
                Cover Availability — Weekly Free Periods
              </h2>
              <p className="text-sm text-muted-foreground mt-0.5">Sessions labelled Free, Prep, or Planning across all teachers</p>
            </div>
          </div>
          {coverLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground py-8"><Loader2 className="h-4 w-4 animate-spin" /> Loading cover data…</div>
          ) : !coverData || coverData.teachers.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">No teachers with free periods found. Add sessions labelled "Free", "Prep", or "Planning" in the Academic Calendar to see availability here.</CardContent></Card>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="text-left px-3 py-2 font-semibold border border-border min-w-[140px]">Teacher</th>
                    {(coverData.days ?? ["Monday","Tuesday","Wednesday","Thursday","Friday"]).map(day => (
                      <th key={day} className="text-center px-3 py-2 font-semibold border border-border min-w-[120px]">{day}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {coverData.teachers.map((teacher) => (
                    <tr key={teacher.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-3 py-2 border border-border">
                        <div className="font-medium">{teacher.name}</div>
                        <div className="text-xs text-muted-foreground">{teacher.weeklyHours}h/wk teaching</div>
                      </td>
                      {[1,2,3,4,5].map(day => {
                        const slots = teacher.freePeriods.filter(fp => fp.day === day);
                        return (
                          <td key={day} className="px-2 py-2 border border-border align-top">
                            {slots.length === 0 ? (
                              <span className="text-xs text-muted-foreground/40">—</span>
                            ) : (
                              <div className="space-y-1">
                                {slots.map((slot, i) => (
                                  <div key={i} className="bg-green-50 border border-green-200 rounded px-2 py-1 text-xs">
                                    <div className="font-medium text-green-800">{slot.startTime}–{slot.endTime}</div>
                                    <div className="text-green-600 capitalize">{slot.label}</div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </div>

      {/* Profile Settings Dialog */}
      <Dialog open={showProfileForm} onOpenChange={setShowProfileForm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Holiday &amp; Prep Profile — {selectedTeacher?.displayName || selectedTeacher?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Contracted h/wk</Label>
                <Input type="number" min="0" max="80" step="0.5" value={profileForm.contractedHoursPerWeek}
                  onChange={e => setProfileForm(f => ({ ...f, contractedHoursPerWeek: parseFloat(e.target.value) || 0 }))} />
              </div>
              <div>
                <Label className="text-xs">Prep h/wk</Label>
                <Input type="number" min="0" max="40" step="0.5" value={profileForm.prepHoursPerWeek}
                  onChange={e => setProfileForm(f => ({ ...f, prepHoursPerWeek: parseFloat(e.target.value) || 0 }))} />
              </div>
              <div>
                <Label className="text-xs">Holiday days/yr</Label>
                <Input type="number" min="0" max="60" step="0.5" value={profileForm.annualHolidayDays}
                  onChange={e => setProfileForm(f => ({ ...f, annualHolidayDays: parseFloat(e.target.value) || 0 }))} />
              </div>
            </div>
            <div>
              <Label className="text-xs">Notes (optional)</Label>
              <Textarea value={profileForm.notes} onChange={e => setProfileForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Any notes..." className="resize-none" rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowProfileForm(false)}>Cancel</Button>
            <Button
              disabled={upsertProfileMutation.isPending}
              onClick={() => upsertProfileMutation.mutate({
                id: matchedProfile?.id,
                name: selectedTeacher?.displayName || selectedTeacher?.name || "",
                email: selectedTeacher?.email || undefined,
                contractedHoursPerWeek: profileForm.contractedHoursPerWeek,
                prepHoursPerWeek: profileForm.prepHoursPerWeek,
                annualHolidayDays: profileForm.annualHolidayDays,
                notes: profileForm.notes || undefined,
              })}
            >
              {upsertProfileMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Holiday Record Dialog */}
      <Dialog open={showAddHoliday} onOpenChange={setShowAddHoliday}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Add Holiday Record</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Date</Label><Input type="date" value={holidayForm.date} onChange={e => setHolidayForm(f => ({ ...f, date: e.target.value }))} /></div>
            <div>
              <Label>Type</Label>
              <Select value={holidayForm.type} onValueChange={v => setHolidayForm(f => ({ ...f, type: v as "taken" | "owed" }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="taken">Holiday Taken</SelectItem>
                  <SelectItem value="owed">Holiday Owed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Hours</Label><Input type="number" min="0.5" max="24" step="0.5" value={holidayForm.hours} onChange={e => setHolidayForm(f => ({ ...f, hours: e.target.value }))} /></div>
            <div><Label>Notes (optional)</Label><Input value={holidayForm.notes} onChange={e => setHolidayForm(f => ({ ...f, notes: e.target.value }))} placeholder="e.g. Annual leave" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddHoliday(false)}>Cancel</Button>
            <Button
              disabled={!holidayForm.date || addHolidayMutation.isPending}
              onClick={() => activeProfileId && addHolidayMutation.mutate({
                teacherProfileId: activeProfileId,
                date: holidayForm.date,
                type: holidayForm.type,
                hours: parseFloat(holidayForm.hours) || 7.5,
                notes: holidayForm.notes || undefined,
              })}
            >
              {addHolidayMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Subject Dialog */}
      <Dialog open={subjectDialog} onOpenChange={setSubjectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editSubject ? t("tp_edit_subject") : t("tp_add_subject")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t("tp_subject_name")}</Label>
              <Input value={subjectForm.subject} onChange={(e) => setSubjectForm((f) => ({ ...f, subject: e.target.value }))} placeholder={t("tp_subject_placeholder")} />
            </div>
            <div>
              <Label>{t("tp_level")}</Label>
              <Input value={subjectForm.level} onChange={(e) => setSubjectForm((f) => ({ ...f, level: e.target.value }))} placeholder={t("tp_level_placeholder")} />
            </div>
            <div>
              <Label>{t("tp_notes")}</Label>
              <Input value={subjectForm.notes} onChange={(e) => setSubjectForm((f) => ({ ...f, notes: e.target.value }))} placeholder={t("tp_notes_placeholder")} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubjectDialog(false)}>{t("cancel")}</Button>
            <Button onClick={submitSubject} disabled={!subjectForm.subject || !subjectForm.level}>{t("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Schedule Slot Dialog */}
      <Dialog open={scheduleDialog} onOpenChange={setScheduleDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editSlot ? t("tp_edit_slot") : t("tp_add_slot")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t("tp_semester")}</Label>
                <Select value={slotForm.semester} onValueChange={(v) => setSlotForm((f) => ({ ...f, semester: v as typeof SEMESTERS[number] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SEMESTERS.map((s) => <SelectItem key={s} value={s}>{t(`tp_sem_${s}`)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t("tp_day")}</Label>
                <Select value={slotForm.dayOfWeek} onValueChange={(v) => setSlotForm((f) => ({ ...f, dayOfWeek: v as typeof DAYS[number] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DAYS.map((d) => <SelectItem key={d} value={d}>{t(`tp_day_${d}`)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>{t("tp_lesson_slot")}</Label>
              <Input value={slotForm.lessonSlot} onChange={(e) => setSlotForm((f) => ({ ...f, lessonSlot: e.target.value }))} placeholder={t("tp_lesson_slot_placeholder")} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t("tp_start_time")}</Label>
                <Input type="time" value={slotForm.startTime} onChange={(e) => setSlotForm((f) => ({ ...f, startTime: e.target.value }))} />
              </div>
              <div>
                <Label>{t("tp_end_time")}</Label>
                <Input type="time" value={slotForm.endTime} onChange={(e) => setSlotForm((f) => ({ ...f, endTime: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>{t("tp_subject_name")}</Label>
              <Input value={slotForm.subject} onChange={(e) => setSlotForm((f) => ({ ...f, subject: e.target.value }))} placeholder={t("tp_subject_placeholder")} />
            </div>
            <div>
              <Label>{t("tp_group")}</Label>
              <Input value={slotForm.groupName} onChange={(e) => setSlotForm((f) => ({ ...f, groupName: e.target.value }))} placeholder={t("tp_group_placeholder")} />
            </div>
          </div>
          {slotError && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{slotError}</span>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setScheduleDialog(false); setSlotError(null); }}>{t("cancel")}</Button>
            <Button onClick={submitSlot} disabled={!slotForm.lessonSlot || !slotForm.subject || addSlotMutation.isPending}>{t("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Copy Schedule Dialog */}
      <Dialog open={copyScheduleDialog} onOpenChange={(o) => { setCopyScheduleDialog(o); if (!o) { setCopyFromTeacherId(null); setCopyOverwrite(false); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("tp_copy_schedule_title")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t("tp_copy_schedule_from")}</label>
              <Select
                value={copyFromTeacherId ? String(copyFromTeacherId) : ""}
                onValueChange={(v) => setCopyFromTeacherId(Number(v))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  {roster?.filter((teacher) => teacher.id !== selectedTeacherId).map((teacher) => (
                    <SelectItem key={teacher.id} value={String(teacher.id)}>
                      {teacher.displayName || teacher.email}
                      {teacher.isPermanent === false && (
                        <span className="ml-1.5 text-xs text-amber-500">{t("tp_non_permanent")}</span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={copyOverwrite}
                onChange={(e) => setCopyOverwrite(e.target.checked)}
                className="rounded border-border"
              />
              {t("tp_copy_schedule_overwrite")}
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCopyScheduleDialog(false)}>{t("cancel")}</Button>
            <Button
              disabled={!copyFromTeacherId || copyScheduleMutation.isPending}
              onClick={() => {
                if (!copyFromTeacherId || !selectedTeacherId || !academicYear) return;
                copyScheduleMutation.mutate({
                  fromUserId: copyFromTeacherId,
                  toUserId: selectedTeacherId,
                  academicYear,
                  overwrite: copyOverwrite,
                });
              }}
            >
              {t("tp_copy_schedule_confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
