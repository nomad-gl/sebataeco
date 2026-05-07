import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/contexts/I18nContext";
import NavBar from "@/components/NavBar";
import BackButton from "@/components/BackButton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Clock, BookOpen, Users, ChevronRight, MapPin, Printer } from "lucide-react";

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

  const { calendar, teachers, sessions, subjects } = data;

  // Build a map of subject name → subject details for enrichment
  const subjectMap = new Map<string, { classroom?: string | null; color?: string | null; semester?: number; semesters?: string | null; unit?: string | null }>();
  if (subjects) {
    for (const sub of subjects) {
      subjectMap.set(sub.name, {
        classroom: sub.classroom,
        color: sub.color,
        semester: sub.semester,
        semesters: sub.semesters,
        unit: sub.unit,
      });
    }
  }

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

  // Get unique subjects for this teacher (for the subject details panel)
  const teacherSubjectNames = [...new Set(uniqueTeacherSessions.map(s => s.subject))];
  const teacherSubjectDetails = teacherSubjectNames
    .map(name => ({ name, ...(subjectMap.get(name) || {}) }))
    .filter(s => !/free|prep|planning|break|recess/i.test(s.name));

  const handlePrint = () => {
    if (!selectedTeacher) return;
    const logo = localStorage.getItem("seba_school_logo");
    const logoHtml = logo
      ? `<img src="${logo}" alt="School Logo" style="height:56px;object-fit:contain;margin-bottom:6px;" />`
      : ``;

    // Build timetable grid HTML
    const gridHtml = [1, 2, 3, 4, 5].map(day => {
      const daySessions = sessionsByDay[day] || [];
      const rows = daySessions.map(s => {
        const subDetails = subjectMap.get(s.subject);
        const color = subDetails?.color ?? "#3b82f6";
        return `<div style="padding:4px 6px;margin-bottom:4px;border-left:3px solid ${color};background:${color}15;border-radius:4px;">
          <strong style="font-size:0.8rem;">${s.subject}</strong><br/>
          <span style="font-size:0.72rem;color:#555;">${s.startTime}–${s.endTime}${subDetails?.classroom ? ' · ' + subDetails.classroom : ''}</span>
        </div>`;
      }).join('');
      return `<td style="vertical-align:top;padding:6px;border:1px solid #ddd;min-width:120px;">
        <div style="font-weight:600;text-align:center;background:#e0e7ff;padding:4px;margin:-6px -6px 6px -6px;font-size:0.8rem;color:#1e3a5f;">${days[day - 1]}</div>
        ${rows || '<p style="color:#999;font-size:0.75rem;text-align:center;padding:8px 0;">—</p>'}
      </td>`;
    }).join('');

    // Build subject details HTML
    const subjectsHtml = teacherSubjectDetails.length > 0
      ? `<h2 style="font-size:0.9rem;text-transform:uppercase;letter-spacing:.05em;color:#555;margin:18px 0 6px;">${t("tt_subject_details")}</h2>
        <div style="display:flex;flex-wrap:wrap;gap:8px;">
          ${teacherSubjectDetails.map(sub => `<div style="border-left:3px solid ${sub.color ?? '#3b82f6'};background:${(sub.color ?? '#3b82f6')}10;padding:6px 10px;border-radius:4px;font-size:0.8rem;">
            <strong>${sub.name}</strong>
            ${sub.classroom ? `<span style="color:#555;"> · ${sub.classroom}</span>` : ''}
            ${sub.unit ? `<br/><span style="color:#666;font-size:0.72rem;">${sub.unit}</span>` : ''}
          </div>`).join('')}
        </div>`
      : '';

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${calendar.academicYear} — ${selectedTeacher.name}</title>
<style>
  body { font-family: sans-serif; margin: 32px; color: #111; }
  h1 { font-size: 1.3rem; margin-bottom: 4px; }
  h2 { font-size: 0.9rem; text-transform: uppercase; letter-spacing: .05em; color: #555; margin: 18px 0 6px; }
  p, li { font-size: 0.88rem; line-height: 1.55; }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; }
  .header { display: flex; align-items: center; gap: 16px; margin-bottom: 16px; border-bottom: 2px solid #1e3a5f; padding-bottom: 12px; }
  .footer { margin-top: 32px; font-size: 0.7rem; color: #999; border-top: 1px solid #eee; padding-top: 8px; }
  @media print { body { margin: 16px; } }
</style></head><body>
<div class="header">
  ${logoHtml}
  <div>
    <h1 style="margin:0">${calendar.academicYear} — ${selectedTeacher.name}</h1>
    <p style="margin:2px 0;color:#555;font-size:0.8rem;">${selectedTeacher.email ? selectedTeacher.email + ' · ' : ''}${calendar.schoolStartTime} – ${calendar.schoolEndTime} · ${uniqueTeacherSessions.length} ${t("tt_sessions")}</p>
  </div>
</div>
<table><tr>${gridHtml}</tr></table>
${subjectsHtml}
<div class="footer">Powered by SEBA · ${new Date().toLocaleDateString()}</div>
</body></html>`;

    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(html);
    w.document.close();
    setTimeout(() => { w.print(); }, 400);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 print:hidden">
        <Button variant="ghost" onClick={onBack} className="text-blue-200 hover:text-white hover:bg-white/10">
          ← {t("acal2_back")}
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <CalendarDays className="w-6 h-6 text-blue-300" />
            {calendar.academicYear}
          </h1>
          <p className="text-blue-200 text-sm">
            {calendar.schoolStartTime} – {calendar.schoolEndTime} · {calendar.semesterCount} {t("acal2_semesters")}
          </p>
        </div>
        {selectedTeacher && (
          <Button onClick={handlePrint} variant="outline" className="border-blue-400/40 text-blue-200 hover:text-white hover:bg-white/10">
            <Printer className="w-4 h-4 mr-2" />
            {t("tt_print")}
          </Button>
        )}
      </div>

      {/* Teacher Selector */}
      <div className="bg-white/10 border border-white/20 rounded-xl p-4 print:hidden">
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


          <div className="flex items-center gap-3 print:hidden">
            <h3 className="text-white font-semibold text-lg">{selectedTeacher.name}</h3>
            {selectedTeacher.email && (
              <Badge variant="outline" className="border-blue-400/40 text-blue-200 text-xs">
                {selectedTeacher.email}
              </Badge>
            )}
            <Badge className="bg-blue-600/40 text-blue-100 text-xs">
              {uniqueTeacherSessions.length} {t("tt_sessions")}
            </Badge>
          </div>

          {/* Subject Details Panel */}
          {teacherSubjectDetails.length > 0 && (
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 print:bg-white print:border-gray-200">
              <h4 className="text-white font-medium text-sm mb-3 flex items-center gap-2 print:text-black">
                <BookOpen className="w-4 h-4 text-blue-300 print:text-blue-600" />
                {t("tt_subject_details")}
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {teacherSubjectDetails.map(sub => (
                  <div
                    key={sub.name}
                    className="rounded-lg p-3 border border-white/10 print:border-gray-200"
                    style={{ backgroundColor: sub.color ? `${sub.color}15` : "rgba(59,130,246,0.05)", borderLeft: `3px solid ${sub.color ?? "#3b82f6"}` }}
                  >
                    <p className="text-white font-medium text-sm print:text-black">{sub.name}</p>
                    {sub.unit && <p className="text-blue-200 text-xs mt-0.5 print:text-gray-600">{sub.unit}</p>}
                    <div className="flex flex-wrap gap-2 mt-1.5">
                      {sub.classroom && (
                        <span className="text-blue-300 text-xs flex items-center gap-1 print:text-gray-500">
                          <MapPin className="w-3 h-3" />
                          {sub.classroom}
                        </span>
                      )}
                      {sub.semesters && (
                        <span className="text-blue-300 text-xs print:text-gray-500">
                          {(() => {
                            try {
                              const sems = JSON.parse(sub.semesters);
                              return sems.length > 1 ? `${t("tt_semesters")}: ${sems.join(", ")}` : `${t("tt_semester")} ${sems[0]}`;
                            } catch { return `${t("tt_semester")} ${sub.semester}`; }
                          })()}
                        </span>
                      )}
                      {!sub.semesters && sub.semester && (
                        <span className="text-blue-300 text-xs print:text-gray-500">{t("tt_semester")} {sub.semester}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Weekly grid */}
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 print:grid-cols-5 print:gap-1">
            {[1, 2, 3, 4, 5].map(day => (
              <div key={day} className="bg-white/10 border border-white/20 rounded-xl overflow-hidden print:bg-white print:border-gray-300 print:rounded-md">
                <div className="bg-blue-600/40 px-3 py-2 text-center print:bg-blue-100">
                  <p className="text-white font-semibold text-sm print:text-blue-900">{days[day - 1]}</p>
                </div>
                <div className="p-2 space-y-2 min-h-[80px] print:min-h-[60px]">
                  {sessionsByDay[day]?.length ? (
                    sessionsByDay[day]
                      .sort((a, b) => a.startTime.localeCompare(b.startTime))
                      .map(s => {
                        const subDetails = subjectMap.get(s.subject);
                        const color = subDetails?.color ?? (s as any).color ?? "#3b82f6";
                        return (
                          <div
                            key={s.id}
                            className="rounded-lg p-2 text-xs print:p-1 print:rounded-sm"
                            style={{ backgroundColor: `${color}33`, borderLeft: `3px solid ${color}` }}
                          >
                            <p className="text-white font-medium print:text-black">{s.subject}</p>
                            <p className="text-blue-200 flex items-center gap-1 mt-0.5 print:text-gray-600">
                              <Clock className="w-3 h-3" />
                              {s.startTime}–{s.endTime}
                            </p>
                            {subDetails?.classroom && (
                              <p className="text-blue-300 flex items-center gap-1 mt-0.5 print:text-gray-500">
                                <MapPin className="w-3 h-3" />
                                {subDetails.classroom}
                              </p>
                            )}
                          </div>
                        );
                      })
                  ) : (
                    <p className="text-blue-300/50 text-xs text-center pt-4 print:text-gray-400">{t("tt_free")}</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Sessions list */}
          <Card className="bg-white/10 border-white/20 text-white print:bg-white print:border-gray-200 print:text-black">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-blue-300 print:text-blue-600" />
                {t("tt_all_sessions")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {uniqueTeacherSessions.length === 0 ? (
                <p className="text-blue-200 text-sm print:text-gray-500">{t("tt_no_sessions")}</p>
              ) : (
                <div className="space-y-2">
                  {uniqueTeacherSessions
                    .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime))
                    .map(s => {
                      const subDetails = subjectMap.get(s.subject);
                      return (
                        <div key={s.id} className="flex items-center gap-3 text-sm">
                          <span className="text-blue-300 w-20 shrink-0 print:text-gray-600">{days[s.dayOfWeek - 1]}</span>
                          <span className="text-blue-200 w-24 shrink-0 print:text-gray-500">{s.startTime}–{s.endTime}</span>
                          <span className="text-white font-medium print:text-black">{s.subject}</span>
                          {subDetails?.classroom && (
                            <Badge variant="outline" className="border-blue-400/30 text-blue-300 text-xs print:border-gray-300 print:text-gray-600">
                              <MapPin className="w-3 h-3 mr-1" />
                              {subDetails.classroom}
                            </Badge>
                          )}
                        </div>
                      );
                    })}
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
