import { useState, useMemo } from "react";
import { UserCheck, BarChart3, CheckCircle2, XCircle, Clock, FileCheck } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/contexts/I18nContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { getQueryKey } from "@trpc/react-query";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

type AttendanceStatus = "present" | "absent" | "late" | "excused";

const STATUS_COLORS: Record<AttendanceStatus, string> = {
  present: "bg-green-100 text-green-800 border-green-200",
  absent: "bg-red-100 text-red-800 border-red-200",
  late: "bg-amber-100 text-amber-800 border-amber-200",
  excused: "bg-blue-100 text-blue-800 border-blue-200",
};

const BAR_COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#8b5cf6", "#ec4899"];

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function thirtyDaysAgoStr() {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}

export default function HosAttendance() {
  const { t } = useI18n();
  const qc = useQueryClient();

  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [localStatuses, setLocalStatuses] = useState<Record<number, AttendanceStatus>>({});
  const [localNotes, setLocalNotes] = useState<Record<number, string>>({});
  const [activeTab, setActiveTab] = useState<"register" | "chart">("register");

  const { data: classGroupsList = [] } = trpc.hos.getAllClassGroups.useQuery();

  const { data: attendanceData, isLoading: loadingAttendance } = trpc.hos.getAttendance.useQuery(
    {
      classGroupId: selectedGroupId ?? 0,
      fromDate: selectedDate,
      toDate: selectedDate,
    },
    { enabled: selectedGroupId != null }
  );

  const { data: absenceSummary = [], isLoading: loadingChart } = trpc.hos.getAbsenceSummary.useQuery(
    { days: 30 }
  );

  const bulkSave = trpc.hos.bulkSaveAttendance.useMutation({
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: getQueryKey(trpc.hos.getAttendance) });
      qc.invalidateQueries({ queryKey: getQueryKey(trpc.hos.getAbsenceSummary) });
      toast.success(t("attendance_saved") ?? "Register saved");
    },
    onError: () => toast.error("Failed to save register"),
  });

  // Merge DB records with local overrides
  const students = attendanceData?.students ?? [];
  const dbRecords = attendanceData?.records ?? [];

  const dbStatusMap = useMemo(() => {
    const map: Record<number, AttendanceStatus> = {};
    dbRecords.forEach((r) => {
      map[r.studentId] = r.status as AttendanceStatus;
    });
    return map;
  }, [dbRecords]);

  const dbNotesMap = useMemo(() => {
    const map: Record<number, string> = {};
    dbRecords.forEach((r) => {
      if (r.notes) map[r.studentId] = r.notes;
    });
    return map;
  }, [dbRecords]);

  function getStatus(studentId: number): AttendanceStatus {
    return localStatuses[studentId] ?? dbStatusMap[studentId] ?? "present";
  }

  function getNotes(studentId: number): string {
    return localNotes[studentId] ?? dbNotesMap[studentId] ?? "";
  }

  function setStatus(studentId: number, status: AttendanceStatus) {
    setLocalStatuses((prev) => ({ ...prev, [studentId]: status }));
  }

  function markAllPresent() {
    const all: Record<number, AttendanceStatus> = {};
    students.forEach((s) => { all[s.id] = "present"; });
    setLocalStatuses(all);
  }

  function handleSave() {
    if (!selectedGroupId) return;
    const records = students.map((s) => ({
      studentId: s.id,
      status: getStatus(s.id),
      notes: getNotes(s.id) || undefined,
    }));
    bulkSave.mutate({ classGroupId: selectedGroupId, date: selectedDate, records });
  }

  const chartData = absenceSummary
    .filter((g) => g.totalRecords > 0)
    .map((g) => ({
      name: g.className,
      rate: g.absenceRate,
      count: g.absentRecords,
    }))
    .sort((a, b) => b.rate - a.rate);

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <UserCheck className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{t("attendance_title") ?? "Attendance Register"}</h1>
              <p className="text-sm text-muted-foreground">
                {t("hos_attendance_desc") ?? "Daily register and 30-day absence overview"}
              </p>
            </div>
          </div>

          {/* Tab switcher */}
          <div className="flex rounded-lg border border-border overflow-hidden">
            <button
              className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === "register" ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}
              onClick={() => setActiveTab("register")}
            >
              <UserCheck className="h-4 w-4 inline mr-1.5" />
              {t("attendance_title") ?? "Register"}
            </button>
            <button
              className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === "chart" ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}
              onClick={() => setActiveTab("chart")}
            >
              <BarChart3 className="h-4 w-4 inline mr-1.5" />
              {t("attendance_chart_title") ?? "Absence Chart"}
            </button>
          </div>
        </div>

        {activeTab === "register" && (
          <>
            {/* Controls */}
            <div className="flex flex-wrap gap-3 items-end">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">{t("timetable_class_group") ?? "Class group"}</label>
                <Select
                  value={selectedGroupId?.toString() ?? "none"}
                  onValueChange={(v) => {
                    setSelectedGroupId(v === "none" ? null : parseInt(v));
                    setLocalStatuses({});
                    setLocalNotes({});
                  }}
                >
                  <SelectTrigger className="w-56">
                    <SelectValue placeholder={t("attendance_select_group") ?? "Select class group…"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— {t("attendance_select_group") ?? "Select group"} —</SelectItem>
                    {classGroupsList.map((g) => (
                      <SelectItem key={g.id} value={g.id.toString()}>
                        {g.className} ({g.level})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">{t("attendance_date") ?? "Date"}</label>
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => {
                    setSelectedDate(e.target.value);
                    setLocalStatuses({});
                    setLocalNotes({});
                  }}
                  className="w-40"
                />
              </div>

              {selectedGroupId && students.length > 0 && (
                <Button variant="outline" size="sm" onClick={markAllPresent}>
                  <CheckCircle2 className="h-4 w-4 mr-1.5" />
                  {t("attendance_mark_all_present") ?? "Mark all present"}
                </Button>
              )}
            </div>

            {/* Register table */}
            {!selectedGroupId ? (
              <div className="flex items-center justify-center h-48 text-muted-foreground rounded-xl border border-dashed border-border">
                {t("attendance_select_group") ?? "Select a class group to view the register"}
              </div>
            ) : loadingAttendance ? (
              <div className="flex items-center justify-center h-48 text-muted-foreground">
                {t("attendance_loading")}
              </div>
            ) : students.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-muted-foreground rounded-xl border border-dashed border-border">
                {t("attendance_no_students") ?? "No students in this group"}
              </div>
            ) : (
              <div className="rounded-xl border border-border overflow-hidden shadow-sm">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="p-3 text-left font-semibold border-b border-border w-8">#</th>
                      <th className="p-3 text-left font-semibold border-b border-border">
                        {t("attendance_student") ?? "Student"}
                      </th>
                      <th className="p-3 text-center font-semibold border-b border-border">
                        {t("attendance_status") ?? "Status"}
                      </th>
                      <th className="p-3 text-left font-semibold border-b border-border hidden md:table-cell">
                        {t("attendance_notes") ?? "Notes"}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((student, idx) => {
                      const status = getStatus(student.id);
                      return (
                        <tr
                          key={student.id}
                          className={`border-b border-border last:border-b-0 transition-colors ${idx % 2 === 0 ? "bg-background" : "bg-muted/20"}`}
                        >
                          <td className="p-3 text-muted-foreground text-xs">{student.studentNumber}</td>
                          <td className="p-3 font-medium">{student.name}</td>
                          <td className="p-3">
                            <div className="flex gap-1.5 justify-center flex-wrap">
                              {(["present", "absent", "late", "excused"] as AttendanceStatus[]).map((s) => (
                                <button
                                  key={s}
                                  onClick={() => setStatus(student.id, s)}
                                  className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                                    status === s
                                      ? STATUS_COLORS[s] + " ring-2 ring-offset-1 ring-current"
                                      : "bg-background text-muted-foreground border-border hover:bg-muted"
                                  }`}
                                >
                                  {s === "present" && <CheckCircle2 className="h-3 w-3 inline mr-0.5" />}
                                  {s === "absent" && <XCircle className="h-3 w-3 inline mr-0.5" />}
                                  {s === "late" && <Clock className="h-3 w-3 inline mr-0.5" />}
                                  {s === "excused" && <FileCheck className="h-3 w-3 inline mr-0.5" />}
                                  {t(`attendance_${s}` as any) ?? s}
                                </button>
                              ))}
                            </div>
                          </td>
                          <td className="p-3 hidden md:table-cell">
                            <Input
                              className="h-7 text-xs"
                              placeholder={t("attendance_notes") ?? "Notes…"}
                              value={getNotes(student.id)}
                              onChange={(e) =>
                                setLocalNotes((prev) => ({ ...prev, [student.id]: e.target.value }))
                              }
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {selectedGroupId && students.length > 0 && (
              <div className="flex justify-end">
                <Button onClick={handleSave} disabled={bulkSave.isPending}>
                  <UserCheck className="h-4 w-4 mr-1.5" />
                  {t("attendance_save_all") ?? "Save Register"}
                </Button>
              </div>
            )}
          </>
        )}

        {activeTab === "chart" && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">{t("attendance_chart_title") ?? "30-Day Absence Rate by Class"}</h2>

            {loadingChart ? (
              <div className="flex items-center justify-center h-64 text-muted-foreground">{t("attendance_loading")}</div>
            ) : chartData.length === 0 ? (
              <div className="flex items-center justify-center h-64 text-muted-foreground rounded-xl border border-dashed border-border">
                {t("attendance_no_data")}
              </div>
            ) : (
              <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={chartData} margin={{ top: 8, right: 24, left: 0, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11 }}
                      angle={-35}
                      textAnchor="end"
                      interval={0}
                    />
                    <YAxis
                      tickFormatter={(v) => `${v}%`}
                      domain={[0, 100]}
                      tick={{ fontSize: 11 }}
                    />
                    <Tooltip
                      formatter={(value: number) => [`${value}%`, t("attendance_absence_rate") ?? "Absence rate"]}
                    />
                    <Bar dataKey="rate" radius={[4, 4, 0, 0]}>
                      {chartData.map((_, i) => (
                        <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Summary cards */}
            {absenceSummary.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {absenceSummary.map((g) => (
                  <div key={g.groupId} className="rounded-lg border border-border bg-card p-3 shadow-sm">
                    <div className="font-semibold text-sm truncate">{g.className}</div>
                    <div className="text-xs text-muted-foreground mb-2">{g.level}</div>
                    <div className="flex items-end justify-between">
                      <div>
                        <div className="text-2xl font-bold">{g.absenceRate}%</div>
                        <div className="text-xs text-muted-foreground">{t("attendance_absence_rate") ?? "absence rate"}</div>
                      </div>
                      <Badge
                        variant="outline"
                        className={
                          g.absenceRate >= 20
                            ? "border-red-300 text-red-700 bg-red-50"
                            : g.absenceRate >= 10
                            ? "border-amber-300 text-amber-700 bg-amber-50"
                            : "border-green-300 text-green-700 bg-green-50"
                        }
                      >
                        {g.absentRecords}/{g.totalRecords}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
