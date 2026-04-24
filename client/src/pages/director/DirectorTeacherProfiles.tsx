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
} from "lucide-react";

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday"] as const;
const SEMESTERS = ["1", "2", "full_year"] as const;

const currentAcademicYear = (() => {
  const now = new Date();
  const y = now.getFullYear();
  return now.getMonth() >= 8 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
})();

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
  function submitSlot() {
    if (!slotForm.lessonSlot || !slotForm.subject) return;
    if (editSlot) {
      updateSlotMutation.mutate({ id: editSlot.id, ...slotForm });
    } else {
      addSlotMutation.mutate({ userId: selectedTeacherId!, academicYear, ...slotForm });
    }
  }

  // Group schedule by day
  const scheduleByDay = useMemo(() => {
    if (!schedule) return {};
    const map: Record<string, typeof schedule> = {};
    for (const slot of schedule) {
      if (!map[slot.dayOfWeek]) map[slot.dayOfWeek] = [];
      map[slot.dayOfWeek].push(slot);
    }
    return map;
  }, [schedule]);

  const selectedTeacher = roster?.find((t) => t.id === selectedTeacherId);

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
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">{t("tp_roster")}</h2>
          {rosterLoading ? (
            <div className="text-muted-foreground text-sm">{t("loading")}</div>
          ) : !roster?.length ? (
            <div className="text-muted-foreground text-sm">{t("tp_no_teachers")}</div>
          ) : (
            roster.map((teacher) => (
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
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-lg">{selectedTeacher?.displayName || selectedTeacher?.name}</h2>
              </div>

              <Tabs defaultValue="subjects">
                <TabsList>
                  <TabsTrigger value="subjects"><BookOpen className="h-4 w-4 mr-1" />{t("tp_tab_subjects")}</TabsTrigger>
                  <TabsTrigger value="schedule"><Calendar className="h-4 w-4 mr-1" />{t("tp_tab_schedule")}</TabsTrigger>
                  <TabsTrigger value="hours"><Clock className="h-4 w-4 mr-1" />{t("tp_tab_hours")}</TabsTrigger>
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
                  <div className="flex justify-end">
                    <Button size="sm" onClick={() => openAddSlot(selectedTeacherId)}>
                      <Plus className="h-4 w-4 mr-1" />{t("tp_add_slot")}
                    </Button>
                  </div>
                  {!schedule?.length ? (
                    <div className="text-muted-foreground text-sm text-center py-8">{t("tp_no_schedule")}</div>
                  ) : (
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
                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive shrink-0" onClick={() => deleteSlotMutation.mutate({ id: slot.id })}>
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                ))}
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </TabsContent>

                {/* Hours Tab */}
                <TabsContent value="hours" className="space-y-4 mt-4">
                  {!hoursSummary ? (
                    <div className="text-muted-foreground text-sm text-center py-8">{t("loading")}</div>
                  ) : (
                    <>
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
              </Tabs>
            </div>
          )}
        </div>
      </div>

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
    </div>
  );
}
