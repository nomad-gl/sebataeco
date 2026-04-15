import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/contexts/I18nContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ClipboardList, ChevronLeft, ChevronRight, History, CheckCircle2, XCircle, Clock, FileCheck } from "lucide-react";
import { toast } from "sonner";

type AttendanceStatus = "present" | "absent" | "late" | "excused";

const STATUS_COLORS: Record<AttendanceStatus, string> = {
  present: "bg-emerald-500 hover:bg-emerald-600 text-white",
  absent: "bg-red-500 hover:bg-red-600 text-white",
  late: "bg-amber-500 hover:bg-amber-600 text-white",
  excused: "bg-blue-500 hover:bg-blue-600 text-white",
};

function formatDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export default function AttendanceRegister() {
  const { t } = useI18n();

  const STATUS_CONFIG: Record<AttendanceStatus, { label: string; color: string; icon: React.ReactNode }> = {
    present: { label: t("attendance_present"), color: STATUS_COLORS.present, icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
    absent: { label: t("attendance_absent"), color: STATUS_COLORS.absent, icon: <XCircle className="w-3.5 h-3.5" /> },
    late: { label: t("attendance_late"), color: STATUS_COLORS.late, icon: <Clock className="w-3.5 h-3.5" /> },
    excused: { label: t("attendance_excused"), color: STATUS_COLORS.excused, icon: <FileCheck className="w-3.5 h-3.5" /> },
  };
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [showHistory, setShowHistory] = useState(false);

  const dateStr = formatDate(currentDate);

  const { data: groups = [] } = trpc.attendance.getGroups.useQuery();

  const { data: attendanceData = [], refetch: refetchAttendance } = trpc.attendance.getByGroupAndDate.useQuery(
    { groupId: selectedGroupId!, date: dateStr },
    { enabled: !!selectedGroupId }
  );

  const { data: recentChanges = [], refetch: refetchChanges } = trpc.attendance.getRecentChanges.useQuery(
    { groupId: selectedGroupId!, limit: 10 },
    { enabled: !!selectedGroupId && showHistory }
  );

  const markMutation = trpc.attendance.markAttendance.useMutation({
    onSuccess: () => {
      refetchAttendance();
      if (showHistory) refetchChanges();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleMark = (studentId: number, status: AttendanceStatus) => {
    if (!selectedGroupId) return;
    markMutation.mutate({
      groupId: selectedGroupId,
      studentId,
      date: dateStr,
      status,
      notes: notes[studentId] || undefined,
    });
  };

  const selectedGroup = groups.find(g => g.id === selectedGroupId);

  // Summary counts
  const summary = useMemo(() => {
    const counts = { present: 0, absent: 0, late: 0, excused: 0, unmarked: 0 };
    for (const entry of attendanceData) {
      if (entry.record) counts[entry.record.status]++;
      else counts.unmarked++;
    }
    return counts;
  }, [attendanceData]);

  return (
    <div className="container max-w-4xl py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/30">
          <ClipboardList className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">{t("attendance_title")}</h1>
          <p className="text-sm text-muted-foreground">{t("attendance_subtitle")}</p>
        </div>
      </div>

      {/* Controls */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap gap-4 items-center">
            {/* Group selector */}
            <div className="flex-1 min-w-[200px]">
              <Select
                value={selectedGroupId?.toString() ?? ""}
                onValueChange={(v) => setSelectedGroupId(Number(v))}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("attendance_select_group")} />
                </SelectTrigger>
                <SelectContent>
                  {groups.map(g => (
                    <SelectItem key={g.id} value={g.id.toString()}>
                      {g.className} — {g.yearGroup ?? ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date navigator */}
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => setCurrentDate(d => addDays(d, -1))}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm font-medium w-32 text-center">
                {currentDate.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
              </span>
              <Button variant="outline" size="icon" onClick={() => setCurrentDate(d => addDays(d, 1))}>
                <ChevronRight className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>
                {t("attendance_today")}
              </Button>
            </div>

            {/* History toggle */}
            <Button
              variant={showHistory ? "default" : "outline"}
              size="sm"
              onClick={() => setShowHistory(h => !h)}
              className="gap-1.5"
            >
              <History className="w-4 h-4" />
              {t("attendance_history")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {selectedGroupId ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main register */}
          <div className="lg:col-span-2 space-y-3">
            {/* Summary bar */}
            <div className="flex flex-wrap gap-2">
              {(Object.entries(summary) as [string, number][]).map(([key, count]) => (
                <Badge key={key} variant="outline" className="gap-1 text-xs">
                  {key === "unmarked" ? "—" : STATUS_CONFIG[key as AttendanceStatus]?.icon}
                  {count} {t(`attendance_status_${key}` as any) ?? key}
                </Badge>
              ))}
            </div>

            {/* Student list */}
            {attendanceData.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  {t("attendance_no_students")}
                </CardContent>
              </Card>
            ) : (
              attendanceData.map(({ student, record }) => (
                <Card key={student.id} className={`transition-all ${record ? "border-l-4 " + (record.status === "present" ? "border-l-emerald-500" : record.status === "absent" ? "border-l-red-500" : record.status === "late" ? "border-l-amber-500" : "border-l-blue-500") : "border-l-4 border-l-muted"}`}>
                  <CardContent className="py-3 px-4">
                    <div className="flex flex-wrap items-center gap-3">
                      {/* Student info */}
                      <div className="flex items-center gap-2 flex-1 min-w-[140px]">
                        <span className="text-xs text-muted-foreground w-6 text-right">{student.studentNumber}.</span>
                        <span className="font-medium text-sm">{student.name}</span>
                      </div>

                      {/* Status buttons */}
                      <div className="flex gap-1.5 flex-wrap">
                        {(["present", "absent", "late", "excused"] as AttendanceStatus[]).map(status => (
                          <Button
                            key={status}
                            size="sm"
                            className={`h-7 px-2.5 text-xs gap-1 transition-all ${record?.status === status ? STATUS_CONFIG[status].color : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                            onClick={() => handleMark(student.id, status)}
                            disabled={markMutation.isPending}
                          >
                            {STATUS_CONFIG[status].icon}
                            {STATUS_CONFIG[status].label}
                          </Button>
                        ))}
                      </div>
                    </div>

                    {/* Notes field (expandable) */}
                    <div className="mt-2">
                      <Textarea
                        placeholder={t("attendance_notes_placeholder")}
                        value={notes[student.id] ?? record?.notes ?? ""}
                        onChange={e => setNotes(n => ({ ...n, [student.id]: e.target.value }))}
                        className="text-xs h-8 min-h-0 resize-none py-1.5"
                        rows={1}
                      />
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          {/* Change history panel */}
          <div className="space-y-3">
            <Card>
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm flex items-center gap-2">
                  <History className="w-4 h-4 text-muted-foreground" />
                  {t("attendance_recent_changes")}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                {!showHistory ? (
                  <p className="text-xs text-muted-foreground">{t("attendance_history_hint")}</p>
                ) : recentChanges.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{t("attendance_no_changes")}</p>
                ) : (
                  <div className="space-y-3">
                    {recentChanges.map(change => (
                      <div key={change.id} className="text-xs space-y-0.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-medium">{change.changedByName}</span>
                          {change.previousStatus && (
                            <>
                              <Badge variant="outline" className="text-[10px] px-1 py-0">{t(`attendance_${change.previousStatus}` as any) ?? change.previousStatus}</Badge>
                              <span className="text-muted-foreground">→</span>
                            </>
                          )}
                          <Badge className={`text-[10px] px-1 py-0 ${STATUS_COLORS[change.newStatus as AttendanceStatus] ?? ""}`}>
                            {t(`attendance_${change.newStatus}` as any) ?? change.newStatus}
                          </Badge>
                        </div>
                        <p className="text-muted-foreground">
                          {new Date(change.changedAt).toLocaleString()}
                        </p>
                        {change.note && <p className="italic text-muted-foreground">{change.note}</p>}
                        <Separator className="mt-2" />
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Group info card */}
            {selectedGroup && (
              <Card>
                <CardContent className="py-3 px-4 text-xs space-y-1">
                  <p className="font-medium">{selectedGroup.className}</p>
                  <p className="text-muted-foreground">{selectedGroup.yearGroup} · {selectedGroup.academicYear}</p>
                  <p className="text-muted-foreground">{selectedGroup.studentCount} {t("attendance_students")}</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      ) : (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <ClipboardList className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>{t("attendance_select_group_prompt")}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
