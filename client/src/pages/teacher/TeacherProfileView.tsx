import { useState } from "react";
import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/contexts/I18nContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { BookOpen, Clock, Calendar, TrendingUp, TrendingDown, Minus, MapPin, GraduationCap, Edit2 } from "lucide-react";
import TeacherProfileEditForm from "@/components/TeacherProfileEditForm";

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday"] as const;
const DAY_LABELS: Record<string, Record<number, string>> = {
  en: { 1: "Mon", 2: "Tue", 3: "Wed", 4: "Thu", 5: "Fri" },
  es: { 1: "Lun", 2: "Mar", 3: "Mié", 4: "Jue", 5: "Vie" },
  ca: { 1: "Dl", 2: "Dt", 3: "Dc", 4: "Dj", 5: "Dv" },
};

const currentAcademicYear = (() => {
  const now = new Date();
  const y = now.getFullYear();
  return now.getMonth() >= 8 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
})();

export default function TeacherProfileView() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const params = useParams<{ userId?: string }>();
  const [academicYear, setAcademicYear] = useState(currentAcademicYear);
  const [isEditing, setIsEditing] = useState(false);

  // Use userId from URL params if available, otherwise use current user's ID
  const parsedUserId = params?.userId && params.userId !== 'null' ? parseInt(params.userId, 10) : null;
  const targetUserId = parsedUserId ?? user?.id ?? 0;
  const isViewingOther = parsedUserId && parsedUserId !== user?.id;

  const { data: subjects, isLoading: subjectsLoading } = trpc.teacherProfile.getSubjects.useQuery(
    { userId: targetUserId },
    { enabled: !!targetUserId }
  );

  const { data: calendarSubjects, isLoading: calSubjectsLoading } = trpc.teacherProfile.getCalendarSubjects.useQuery(
    { userId: targetUserId },
    { enabled: !!targetUserId }
  );

  const { data: schedule, isLoading: scheduleLoading } = trpc.teacherProfile.getSchedule.useQuery(
    { userId: targetUserId, academicYear },
    { enabled: !!targetUserId }
  );

  const { data: hoursSummary } = trpc.teacherProfile.getTeachingHoursSummary.useQuery(
    { userId: targetUserId, academicYear },
    { enabled: !!targetUserId }
  );

  // Group schedule by day
  const scheduleByDay: Record<string, typeof schedule> = {};
  if (schedule) {
    for (const slot of schedule) {
      if (!scheduleByDay[slot.dayOfWeek]) scheduleByDay[slot.dayOfWeek] = [];
      scheduleByDay[slot.dayOfWeek]!.push(slot);
    }
  }

  const dayLabels = DAY_LABELS[lang] || DAY_LABELS.en;

  if (isEditing && !isViewingOther) {
    return (
      <div className="container py-6">
        <TeacherProfileEditForm
          initialData={{
            name: user?.name,
            email: user?.email,
            phone: user?.phone,
            bio: user?.bio,
            preferredLanguage: user?.preferredLanguage,
            officeLocation: user?.officeLocation,
          }}
          onSave={() => {
            setIsEditing(false);
          }}
          onCancel={() => setIsEditing(false)}
        />
      </div>
    );
  }

  return (
    <div className="container py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t("tp_my_profile")}</h1>
          <p className="text-muted-foreground text-sm mt-1">{user?.displayName || user?.name}</p>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-sm whitespace-nowrap">{t("tp_academic_year")}</Label>
          <Input
            className="w-28"
            value={academicYear}
            onChange={(e) => setAcademicYear(e.target.value)}
            placeholder="2025-2026"
          />
          {!isViewingOther && (
            <Button
              onClick={() => setIsEditing(true)}
              variant="outline"
              size="sm"
              className="ml-2"
            >
              <Edit2 className="h-4 w-4 mr-1" />
              {t("edit")}
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="subjects">
        <TabsList>
          <TabsTrigger value="subjects"><BookOpen className="h-4 w-4 mr-1" />{t("tp_tab_subjects")}</TabsTrigger>
          <TabsTrigger value="schedule"><Calendar className="h-4 w-4 mr-1" />{t("tp_tab_schedule")}</TabsTrigger>
          <TabsTrigger value="hours"><Clock className="h-4 w-4 mr-1" />{t("tp_tab_hours")}</TabsTrigger>
        </TabsList>

        {/* Subjects Tab */}
        <TabsContent value="subjects" className="mt-4 space-y-6">
          {/* Calendar Subjects (from Academic Calendar) */}
          {calSubjectsLoading ? (
            <div className="text-muted-foreground text-sm">{t("loading")}</div>
          ) : calendarSubjects && calendarSubjects.length > 0 ? (
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                <GraduationCap className="h-4 w-4" />
                {t("tp_calendar_subjects_title")}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {calendarSubjects.map((sub) => (
                  <Card key={sub.name} className="overflow-hidden" style={{ borderLeft: `4px solid ${sub.color ?? "#3b82f6"}` }}>
                    <CardContent className="p-4">
                      <p className="font-semibold">{sub.name}</p>
                      {sub.unit && <p className="text-xs text-muted-foreground mt-0.5">{sub.unit}</p>}
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {sub.classroom && (
                          <Badge variant="outline" className="text-xs flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {sub.classroom}
                          </Badge>
                        )}
                        {sub.semesters ? (
                          <Badge variant="secondary" className="text-xs">
                            {(() => {
                              try {
                                const sems = JSON.parse(sub.semesters);
                                return sems.length > 1 ? `${t("tt_semesters")}: ${sems.join(", ")}` : `${t("tt_semester")} ${sems[0]}`;
                              } catch { return `${t("tt_semester")} ${sub.semester}`; }
                            })()}
                          </Badge>
                        ) : sub.semester ? (
                          <Badge variant="secondary" className="text-xs">{t("tt_semester")} {sub.semester}</Badge>
                        ) : null}
                        {sub.sessionsPerWeek > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            {sub.sessionsPerWeek} {t("tp_sessions_per_week")}
                          </Badge>
                        )}
                      </div>
                      {sub.days && sub.days.length > 0 && (
                        <div className="flex gap-1 mt-2">
                          {sub.days.map(d => (
                            <span key={d} className="text-xs bg-muted px-1.5 py-0.5 rounded">
                              {dayLabels[d] ?? `D${d}`}
                            </span>
                          ))}
                        </div>
                      )}
                      {sub.totalAcademicHours && (
                        <p className="text-xs text-muted-foreground mt-2">
                          {sub.totalAcademicHours}h {t("tp_total_hours_label")}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ) : null}

          {/* Manually assigned subjects */}
          {subjectsLoading ? (
            <div className="text-muted-foreground text-sm">{t("loading")}</div>
          ) : !subjects?.length && (!calendarSubjects || calendarSubjects.length === 0) ? (
            <div className="text-muted-foreground text-sm text-center py-12">{t("tp_no_subjects_assigned")}</div>
          ) : subjects && subjects.length > 0 ? (
            <div>
              {calendarSubjects && calendarSubjects.length > 0 && (
                <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                  <BookOpen className="h-4 w-4" />
                  {t("tp_manual_subjects_title")}
                </h3>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {subjects.map((s) => (
                  <Card key={s.id}>
                    <CardContent className="p-4">
                      <p className="font-semibold">{s.subject}</p>
                      <Badge variant="secondary" className="mt-1 text-xs">{s.level}</Badge>
                      {s.notes && <p className="text-xs text-muted-foreground mt-2">{s.notes}</p>}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ) : null}
        </TabsContent>

        {/* Schedule Tab */}
        <TabsContent value="schedule" className="mt-4 space-y-3">
          {scheduleLoading ? (
            <div className="text-muted-foreground text-sm">{t("loading")}</div>
          ) : !schedule?.length ? (
            <div className="text-muted-foreground text-sm text-center py-12">{t("tp_no_schedule_assigned")}</div>
          ) : (
            DAYS.map((day) => {
              const daySlots = scheduleByDay[day];
              if (!daySlots?.length) return null;
              return (
                <Card key={day}>
                  <CardHeader className="py-3 px-4">
                    <CardTitle className="text-sm capitalize font-semibold">{t(`tp_day_${day}`)}</CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 space-y-2">
                    {daySlots
                      .sort((a, b) => a.startTime.localeCompare(b.startTime))
                      .map((slot) => (
                        <div key={slot.id} className="flex items-center gap-3 text-sm">
                          <span className="text-muted-foreground text-xs w-24 shrink-0">{slot.startTime}–{slot.endTime}</span>
                          <span className="font-medium">{slot.subject}</span>
                          {slot.groupName && <Badge variant="outline" className="text-xs">{slot.groupName}</Badge>}
                          <Badge variant="secondary" className="text-xs ml-auto">{t(`tp_sem_${slot.semester}`)}</Badge>
                        </div>
                      ))}
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        {/* Hours Tab */}
        <TabsContent value="hours" className="mt-4 space-y-4">
          {!hoursSummary ? (
            <div className="text-muted-foreground text-sm text-center py-12">{t("loading")}</div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-3xl font-bold">{hoursSummary.weeklyHours}</p>
                    <p className="text-xs text-muted-foreground mt-1">{t("tp_weekly_hours")}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-3xl font-bold">{hoursSummary.scheduledTotalHours}</p>
                    <p className="text-xs text-muted-foreground mt-1">{t("tp_year_total")}</p>
                  </CardContent>
                </Card>
                <Card className={`${hoursSummary.status === "over" ? "border-orange-400" : hoursSummary.status === "under" ? "border-blue-400" : "border-green-400"}`}>
                  <CardContent className="p-4 text-center">
                    <div className="flex items-center justify-center gap-1">
                      {hoursSummary.status === "over"
                        ? <TrendingUp className="h-5 w-5 text-orange-500" />
                        : hoursSummary.status === "under"
                          ? <TrendingDown className="h-5 w-5 text-blue-500" />
                          : <Minus className="h-5 w-5 text-green-500" />}
                      <p className="text-3xl font-bold">{hoursSummary.overUnderHours}</p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {hoursSummary.status === "over" ? t("tp_over_hours") : hoursSummary.status === "under" ? t("tp_under_hours") : t("tp_balanced")}
                    </p>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
