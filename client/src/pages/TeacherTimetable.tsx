import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/contexts/I18nContext";
import NavBar from "@/components/NavBar";
import BackButton from "@/components/BackButton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Clock, BookOpen, Users, ChevronRight } from "lucide-react";

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const DAY_NAMES_ES = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"];
const DAY_NAMES_CA = ["Dilluns", "Dimarts", "Dimecres", "Dijous", "Divendres"];

function getDayNames(lang: string) {
  if (lang === "es") return DAY_NAMES_ES;
  if (lang === "ca") return DAY_NAMES_CA;
  return DAY_NAMES;
}

function CalendarPicker({ onSelect }: { onSelect: (id: number) => void }) {
  const { t, lang } = useI18n();
  const { data: calendars, isLoading } = trpc.academicCalendar.listPublishedCalendars.useQuery();

  if (isLoading) return <p className="text-blue-200 text-center py-12">{t("loading")}</p>;
  if (!calendars?.length) return (
    <div className="text-center py-16">
      <CalendarDays className="w-12 h-12 text-blue-300/50 mx-auto mb-4" />
      <p className="text-blue-200">{t("tt_no_published")}</p>
    </div>
  );

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-white">{t("tt_pick_calendar")}</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {calendars.map(cal => (
          <button
            key={cal.id}
            onClick={() => onSelect(cal.id)}
            className="text-left bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl p-4 transition-colors group"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white font-semibold text-lg">{cal.academicYear}</p>
                <p className="text-blue-200 text-sm mt-0.5">
                  {cal.semesterCount} {t("acal2_semesters")} · {cal.schoolStartTime}–{cal.schoolEndTime}
                </p>
              </div>
              <ChevronRight className="w-5 h-5 text-blue-300 group-hover:translate-x-1 transition-transform" />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function TimetableView({ calendarId, onBack }: { calendarId: number; onBack: () => void }) {
  const { t, lang } = useI18n();
  const [selectedTeacherId, setSelectedTeacherId] = useState<number | null>(null);
  const days = getDayNames(lang);

  const { data, isLoading } = trpc.academicCalendar.getPublishedCalendar.useQuery({ id: calendarId });

  if (isLoading) return <p className="text-blue-200 text-center py-12">{t("loading")}</p>;
  if (!data) return <p className="text-red-300 text-center py-12">{t("tt_not_found")}</p>;

  const { calendar, teachers, sessions } = data;

  const selectedTeacher = teachers.find(t => t.id === selectedTeacherId);
  const teacherSessions = selectedTeacherId
    ? sessions.filter(s => s.teacherId === selectedTeacherId)
    : [];

  // Deduplicate: pre-fill creates one row per weekly occurrence; collapse to unique slots
  const seenTT = new Set<string>();
  const uniqueTeacherSessions = teacherSessions.filter(s => {
    const k = `${s.subject}|${s.dayOfWeek}|${s.startTime}|${s.endTime}`;
    if (seenTT.has(k)) return false;
    seenTT.add(k);
    return true;
  });

  // Group sessions by day for the timetable grid (sorted by startTime)
  const sessionsByDay: Record<number, typeof sessions> = {};
  for (let d = 1; d <= 5; d++) sessionsByDay[d] = [];
  for (const s of uniqueTeacherSessions) {
    if (!sessionsByDay[s.dayOfWeek]) sessionsByDay[s.dayOfWeek] = [];
    sessionsByDay[s.dayOfWeek].push(s);
  }
  for (const d of Object.keys(sessionsByDay)) {
    sessionsByDay[Number(d)].sort((a, b) => a.startTime.localeCompare(b.startTime));
  }

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
          </p>
        </div>
      </div>

      {/* Teacher Selector */}
      <div className="bg-white/10 border border-white/20 rounded-xl p-4">
        <h3 className="text-white font-medium mb-3 flex items-center gap-2">
          <Users className="w-4 h-4 text-blue-300" />
          {t("tt_select_teacher")}
        </h3>
        <div className="flex flex-wrap gap-2">
          {teachers.map(teacher => (
            <button
              key={teacher.id}
              onClick={() => setSelectedTeacherId(teacher.id === selectedTeacherId ? null : teacher.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
                teacher.id === selectedTeacherId
                  ? "bg-blue-600 text-white border-blue-500"
                  : "bg-white/10 text-blue-200 border-white/20 hover:bg-white/20"
              }`}
            >
              {teacher.name}
            </button>
          ))}
        </div>
      </div>

      {/* Timetable Grid */}
      {selectedTeacher ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <h3 className="text-white font-semibold text-lg">{selectedTeacher.name}</h3>
            {selectedTeacher.email && (
              <Badge variant="outline" className="border-blue-400/40 text-blue-200 text-xs">
                {selectedTeacher.email}
              </Badge>
            )}
            <Badge className="bg-blue-600/40 text-blue-100 text-xs">
              {teacherSessions.length} {t("tt_sessions")}
            </Badge>
          </div>

          {/* Weekly grid */}
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
            {[1, 2, 3, 4, 5].map(day => (
              <div key={day} className="bg-white/10 border border-white/20 rounded-xl overflow-hidden">
                <div className="bg-blue-600/40 px-3 py-2 text-center">
                  <p className="text-white font-semibold text-sm">{days[day - 1]}</p>
                </div>
                <div className="p-2 space-y-2 min-h-[80px]">
                  {sessionsByDay[day]?.length ? (
                    sessionsByDay[day]
                      .sort((a, b) => a.startTime.localeCompare(b.startTime))
                      .map(s => (
                        <div
                          key={s.id}
                          className="rounded-lg p-2 text-xs"
                          style={{ backgroundColor: (s as any).color ? `${(s as any).color}33` : "rgba(59,130,246,0.2)", borderLeft: `3px solid ${(s as any).color ?? "#3b82f6"}` }}
                        >
                          <p className="text-white font-medium">{s.subject}</p>
                          <p className="text-blue-200 flex items-center gap-1 mt-0.5">
                            <Clock className="w-3 h-3" />
                            {s.startTime}–{s.endTime}
                          </p>
                        </div>
                      ))
                  ) : (
                    <p className="text-blue-300/50 text-xs text-center pt-4">{t("tt_free")}</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Sessions list */}
          <Card className="bg-white/10 border-white/20 text-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-blue-300" />
                {t("tt_all_sessions")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {teacherSessions.length === 0 ? (
                <p className="text-blue-200 text-sm">{t("tt_no_sessions")}</p>
              ) : (
                <div className="space-y-2">
                  {teacherSessions
                    .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime))
                    .map(s => (
                      <div key={s.id} className="flex items-center gap-3 text-sm">
                        <span className="text-blue-300 w-20 shrink-0">{days[s.dayOfWeek - 1]}</span>
                        <span className="text-blue-200 w-24 shrink-0">{s.startTime}–{s.endTime}</span>
                        <span className="text-white font-medium">{s.subject}</span>
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="text-center py-12">
          <Users className="w-10 h-10 text-blue-300/50 mx-auto mb-3" />
          <p className="text-blue-200">{t("tt_pick_teacher_hint")}</p>
        </div>
      )}
    </div>
  );
}

export default function TeacherTimetable() {
  const [selectedCalendarId, setSelectedCalendarId] = useState<number | null>(null);

  return (
    <div
      className="min-h-screen"
      style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e3a5f 40%, #0f2d4a 100%)" }}
    >
      <NavBar />
      <div className="max-w-5xl mx-auto px-4 py-8">
        <BackButton />
        <div className="mt-4">
          {selectedCalendarId === null ? (
            <CalendarPicker onSelect={setSelectedCalendarId} />
          ) : (
            <TimetableView calendarId={selectedCalendarId} onBack={() => setSelectedCalendarId(null)} />
          )}
        </div>
      </div>
    </div>
  );
}
