import React, { useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { useI18n } from "@/contexts/I18nContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import {
  ArrowLeft, GraduationCap, BookOpen, BarChart3, Calendar,
  CheckCircle2, XCircle, Clock, AlertCircle, Mail, Hash
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";

const COMPETENCY_COLORS: Record<string, string> = {
  CCL:   "bg-blue-500",
  CP:    "bg-violet-500",
  STEM:  "bg-teal-500",
  CD:    "bg-cyan-500",
  CPSAA: "bg-amber-500",
  CC:    "bg-orange-500",
  CE:    "bg-rose-500",
  CCEC:  "bg-pink-500",
};

const YEAR_GROUP_BADGE: Record<string, string> = {
  infantil:  "bg-pink-100 text-pink-700 border-pink-200",
  junior:    "bg-violet-100 text-violet-700 border-violet-200",
  primary:   "bg-blue-100 text-blue-700 border-blue-200",
  secondary: "bg-teal-100 text-teal-700 border-teal-200",
};

const STATUS_ICON: Record<string, React.ReactElement> = {
  present: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />,
  absent:  <XCircle className="w-3.5 h-3.5 text-red-500" />,
  late:    <Clock className="w-3.5 h-3.5 text-amber-500" />,
  excused: <AlertCircle className="w-3.5 h-3.5 text-blue-400" />,
};

const STATUS_LABEL_KEY: Record<string, string> = {
  present: "std_det_att_present",
  absent:  "std_det_att_absent",
  late:    "std_det_att_late",
  excused: "std_det_att_excused",
};

export default function StudentDetails() {
  const { t } = useI18n();
  const { user, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const params = useParams<{ id: string }>();
  const studentId = parseInt(params.id ?? "0", 10);

  // Role guard
  useEffect(() => {
    if (!authLoading && user && !["admin", "director", "head_of_study"].includes(user.role)) {
      navigate("/");
    }
  }, [user, authLoading, navigate]);

  const { data, isLoading, error } = trpc.director.getStudentDetails.useQuery(
    { studentId },
    { enabled: !isNaN(studentId) && studentId > 0 }
  );

  if (authLoading || isLoading) {
    return (
      <div className="p-6 space-y-4 max-w-4xl mx-auto">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-56 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 text-center text-muted-foreground max-w-4xl mx-auto">
        <AlertCircle className="w-10 h-10 mx-auto mb-3 opacity-40" />
        <p className="font-medium">{t("std_det_not_found")}</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate("/director/students")}>
          <ArrowLeft className="w-4 h-4 mr-1" />
          {t("std_det_back")}
        </Button>
      </div>
    );
  }

  const { student, group, competencyAverages, overallAverage, lastActive, attendanceSummary, attendanceRate, recentAttendance } = data;

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-4xl mx-auto">
      {/* Back button */}
      <Button variant="ghost" size="sm" onClick={() => navigate("/director/students")} className="-ml-1">
        <ArrowLeft className="w-4 h-4 mr-1" />
        {t("std_det_back")}
      </Button>

      {/* Student identity card */}
      <Card>
        <CardContent className="pt-5 pb-5">
          <div className="flex flex-col sm:flex-row sm:items-start gap-4">
            {/* Avatar initials */}
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <span className="text-xl font-bold text-primary">
                {student.name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase()}
              </span>
            </div>

            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold tracking-tight">{student.name}</h1>

              <div className="flex flex-wrap gap-2 mt-2">
                {/* Year group badge */}
                {group.yearGroup && (
                  <Badge variant="outline" className={`text-xs ${YEAR_GROUP_BADGE[group.yearGroup] ?? ""}`}>
                    {t(`std_dir_year_${group.yearGroup}` as Parameters<typeof t>[0])}
                  </Badge>
                )}
                {/* Class badge */}
                <Badge variant="outline" className="text-xs">
                  <BookOpen className="w-3 h-3 mr-1" />
                  {group.className}
                </Badge>
                {/* Academic year */}
                {group.academicYear && (
                  <Badge variant="secondary" className="text-xs">
                    {group.academicYear}
                  </Badge>
                )}
              </div>

              <div className="flex flex-wrap gap-4 mt-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5" />
                  {student.email}
                </span>
                <span className="flex items-center gap-1.5">
                  <Hash className="w-3.5 h-3.5" />
                  {t("std_det_student_no")} {student.studentNumber}
                </span>
                {lastActive && (
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    {t("std_det_last_active")} {new Date(lastActive).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>

            {/* Overall average pill */}
            {overallAverage !== null && (
              <div className="flex flex-col items-center bg-primary/5 border border-primary/20 rounded-xl px-5 py-3 shrink-0">
                <span className="text-3xl font-bold text-primary">{overallAverage}%</span>
                <span className="text-xs text-muted-foreground mt-0.5">{t("std_det_overall_avg")}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Attendance summary */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" />
            {t("std_det_attendance_title")}
          </CardTitle>
          {attendanceRate !== null && (
            <CardDescription>
              {t("std_det_attendance_rate_label")}: <strong>{attendanceRate}%</strong>
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Summary pills */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {(["present", "absent", "late", "excused"] as const).map(status => (
              <div
                key={status}
                className="flex flex-col items-center bg-muted/40 rounded-lg py-3 px-2"
              >
                {STATUS_ICON[status]}
                <span className="text-xl font-bold mt-1">
                  {attendanceSummary[status]}
                </span>
                <span className="text-xs text-muted-foreground mt-0.5">
                  {t(STATUS_LABEL_KEY[status] as Parameters<typeof t>[0])}
                </span>
              </div>
            ))}
          </div>

          {/* Attendance rate bar */}
          {attendanceSummary.total > 0 && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{t("std_det_attendance_rate_label")}</span>
                <span>{attendanceSummary.present} / {attendanceSummary.total}</span>
              </div>
              <Progress value={attendanceRate ?? 0} className="h-2" />
            </div>
          )}

          {/* Recent attendance log */}
          {recentAttendance.length > 0 && (
            <>
              <Separator />
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">{t("std_det_recent_attendance")}</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {recentAttendance.map(rec => (
                    <div
                      key={rec.id}
                      className="flex items-center gap-1.5 text-xs bg-muted/30 rounded px-2 py-1"
                    >
                      {STATUS_ICON[rec.status]}
                      <span className="text-muted-foreground">
                        {typeof rec.date === "string" ? rec.date : new Date(rec.date).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* LOMLOE Competency Progress */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" />
            {t("std_det_competency_title")}
          </CardTitle>
          <CardDescription>{t("std_det_competency_desc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {competencyAverages.every(c => c.average === null) ? (
            <p className="text-sm text-muted-foreground text-center py-6">{t("std_det_no_progress")}</p>
          ) : (
            competencyAverages.map(comp => (
              <div key={comp.code} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{comp.code}</span>
                  <span className="text-muted-foreground">
                    {comp.average !== null ? `${comp.average}%` : t("std_det_no_data")}
                    {comp.recordCount > 0 && (
                      <span className="ml-2 text-xs opacity-60">
                        ({comp.recordCount} {t("std_det_records")})
                      </span>
                    )}
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${COMPETENCY_COLORS[comp.code] ?? "bg-primary"}`}
                    style={{ width: comp.average !== null ? `${comp.average}%` : "0%" }}
                  />
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Class group info */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <GraduationCap className="w-4 h-4 text-primary" />
            {t("std_det_class_info_title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3 text-sm">
            <div>
              <dt className="text-muted-foreground text-xs">{t("std_det_class_name")}</dt>
              <dd className="font-medium mt-0.5">{group.className}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">{t("std_det_class_level")}</dt>
              <dd className="font-medium mt-0.5">{group.level}</dd>
            </div>
            {group.yearGroup && (
              <div>
                <dt className="text-muted-foreground text-xs">{t("std_det_year_group")}</dt>
                <dd className="font-medium mt-0.5">
                  <Badge variant="outline" className={`text-xs ${YEAR_GROUP_BADGE[group.yearGroup] ?? ""}`}>
                    {t(`std_dir_year_${group.yearGroup}` as Parameters<typeof t>[0])}
                  </Badge>
                </dd>
              </div>
            )}
            {group.academicYear && (
              <div>
                <dt className="text-muted-foreground text-xs">{t("std_det_academic_year")}</dt>
                <dd className="font-medium mt-0.5">{group.academicYear}</dd>
              </div>
            )}
            <div>
              <dt className="text-muted-foreground text-xs">{t("std_det_group_id")}</dt>
              <dd className="font-mono text-xs mt-0.5 text-muted-foreground">#{group.id}</dd>
            </div>
          </dl>

          <div className="mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/head-of-study/groups")}
            >
              <BookOpen className="w-3.5 h-3.5 mr-1.5" />
              {t("std_det_view_class_btn")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
