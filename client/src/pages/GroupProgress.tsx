import { useState } from "react";
import { useParams, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/contexts/I18nContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  LineChart, Line, Legend,
} from "recharts";
import { useState as _useState } from "react";
import {
  ArrowLeft, Users, TrendingUp, Loader2, Trophy, Medal, Download, ImagePlus, X as XIcon,
  FileText, CheckCircle2, XCircle, Clock, History, ChevronDown, ChevronRight,
} from "lucide-react";
import NavBar from "@/components/NavBar";
import { SebaSymbol } from "@/components/SebaSymbol";
import { Streamdown } from "streamdown";

const GRADE_COLORS: Record<string, string> = {
  Sobresaliente: "bg-emerald-500",
  Notable: "bg-blue-500",
  Bien: "bg-yellow-500",
  Suficiente: "bg-orange-500",
  Insuficiente: "bg-red-500",
};

const COMP_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f59e0b",
  "#10b981", "#3b82f6", "#ef4444", "#14b8a6",
];

function heatColor(score: number | null): string {
  if (score === null) return "bg-white/5 text-white/20";
  if (score >= 90) return "bg-emerald-500/80 text-white";
  if (score >= 70) return "bg-blue-500/80 text-white";
  if (score >= 60) return "bg-yellow-500/80 text-black";
  if (score >= 50) return "bg-orange-500/80 text-white";
  return "bg-red-500/80 text-white";
}

export default function GroupProgress() {
  const { groupId } = useParams<{ groupId: string }>();
  const gId = parseInt(groupId ?? "0");
  const { t, lang } = useI18n();
  const { user } = useAuth();

  const [generating, setGenerating] = useState(false);
  const [reportText, setReportText] = useState<string | null>(null);
  const [reportGrade, setReportGrade] = useState<string | null>(null);
  const [schoolLogo, setSchoolLogo] = useState<string | null>(
    () => localStorage.getItem("seba_school_logo")
  );

  // Generate-all-reports state
  type ReportStatus = "pending" | "done" | "failed" | "no_data";
  const [allReportsRunning, setAllReportsRunning] = useState(false);
  const [allReportsResults, setAllReportsResults] = useState<
    { studentId: number; studentName: string; ok: boolean; grade: string | null } [] | null
  >(null);

  const utils = trpc.useUtils();

  const [activeComps, setActiveComps] = useState<string[]>(
    ["CCL","CP","STEM","CD","CPSAA","CC","CE","CCEC"]
  );

  const timelineQ = trpc.progress.getGroupProgressTimeline.useQuery(
    { groupId: gId },
    { enabled: !!user && gId > 0 }
  );

  const summaryQ = trpc.progress.getGroupSummary.useQuery(
    { groupId: gId },
    { enabled: !!user && gId > 0 }
  );

  const generateAllReports = trpc.progress.generateAllStudentReports.useMutation({
    onSuccess: (data) => {
      setAllReportsResults(data.results);
      setAllReportsRunning(false);
      const done = data.results.filter((r) => r.ok).length;
      const failed = data.results.filter((r) => !r.ok).length;
      if (failed === 0) {
        toast.success(t("gp_all_reports_done").replace("{n}", String(done)));
      } else {
        toast.warning(t("gp_all_reports_partial").replace("{done}", String(done)).replace("{failed}", String(failed)));
      }
    },
    onError: () => {
      toast.error(t("gp_all_reports_failed"));
      setAllReportsRunning(false);
    },
  });

  const generateReport = trpc.progress.generateGroupReport.useMutation({
    onSuccess: (data) => {
      setReportText(typeof data.report === "string" ? data.report : "");
      setReportGrade(data.grade);
      setGenerating(false);
    },
    onError: () => {
      toast.error(t("gp_report_failed"));
      setGenerating(false);
    },
  });

  if (!user) {
    return (
      <div className="challenge-bg">
        <NavBar />
        <div className="flex items-center justify-center min-h-[80vh] relative z-10">
          <Card className="bg-white/10 border-white/20 text-white max-w-sm w-full mx-4">
            <CardContent className="pt-8 pb-8 text-center space-y-4">
              <Users className="w-12 h-12 mx-auto text-teal-400" />
              <h2 className="text-xl font-bold">{t("groups_sign_in_required")}</h2>
              <Button asChild className="bg-teal-600 hover:bg-teal-500 text-white w-full">
                <a href={getLoginUrl(window.location.pathname + window.location.search)}>{t("nav_sign_in")}</a>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const data = summaryQ.data;
  const group = data?.group;
  const students = data?.students ?? [];
  const classComps = data?.competencyAverages ?? [];

  // Sort students by overall score desc for rankings
  const ranked = [...students].sort((a, b) => (b.overall ?? -1) - (a.overall ?? -1));

  const classOverall =
    students.filter((s) => s.overall !== null).length > 0
      ? Math.round(
          students
            .filter((s) => s.overall !== null)
            .reduce((sum, s) => sum + (s.overall ?? 0), 0) /
            students.filter((s) => s.overall !== null).length
        )
      : null;

  const barData = classComps.map((c, i) => ({
    code: c.code,
    score: c.average ?? 0,
    fill: COMP_COLORS[i % COMP_COLORS.length],
  }));

  const totalActivities = students.reduce((sum, s) => sum + s.totalActivities, 0);

  return (
    <div className="challenge-bg">
      <NavBar />
      <div className="max-w-6xl mx-auto px-4 py-8 relative z-10">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link href="/groups">
            <Button variant="ghost" size="sm" className="text-white/70 hover:text-white hover:bg-white/10">
              <ArrowLeft className="w-4 h-4 mr-1" />
              {t("gp_back")}
            </Button>
          </Link>
        </div>

        <div className="flex flex-col md:flex-row md:items-center gap-4 mb-8">
          <div className="w-16 h-16 rounded-full bg-teal-600/30 border-2 border-teal-400/50 flex items-center justify-center flex-shrink-0">
            <Users className="w-8 h-8 text-teal-300" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">
              {group?.className ?? t("sp_loading")}
            </h1>
            <p className="text-white/60 text-sm mt-1">
              {group?.level} · {group?.assessmentTitle}
            </p>
          </div>
          {classOverall !== null && (
            <div className="md:ml-auto flex items-center gap-3">
              <div className="text-center">
                <div className="text-4xl font-black text-white">{classOverall}</div>
                <div className="text-white/50 text-xs">{t("gp_class_avg")}</div>
              </div>
              {reportGrade && (
                <Badge className={`${GRADE_COLORS[reportGrade] ?? "bg-slate-500"} text-white text-sm px-3 py-1`}>
                  {reportGrade}
                </Badge>
              )}
            </div>
          )}
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: t("gp_students"), value: students.length, icon: Users, color: "text-blue-400" },
            { label: t("gp_activities"), value: totalActivities, icon: TrendingUp, color: "text-emerald-400" },
            { label: t("gp_class_avg"), value: classOverall !== null ? `${classOverall}/100` : "—", icon: Trophy, color: "text-yellow-400" },
          ].map((stat) => (
            <Card key={stat.label} className="bg-white/10 border-white/20 text-white">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <stat.icon className={`w-4 h-4 ${stat.color}`} />
                  <span className="text-white/60 text-xs">{stat.label}</span>
                </div>
                <div className="text-2xl font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="bg-white/10 border border-white/20">
            <TabsTrigger value="overview" className="data-[state=active]:bg-teal-600 data-[state=active]:text-white text-white/70">
              {t("gp_tab_overview")}
            </TabsTrigger>
            <TabsTrigger value="students" className="data-[state=active]:bg-teal-600 data-[state=active]:text-white text-white/70">
              {t("gp_tab_students")}
            </TabsTrigger>
            <TabsTrigger value="report" className="data-[state=active]:bg-teal-600 data-[state=active]:text-white text-white/70">
              {t("gp_tab_report")}
            </TabsTrigger>
            <TabsTrigger value="history" className="data-[state=active]:bg-teal-600 data-[state=active]:text-white text-white/70">
              <History className="w-3.5 h-3.5 mr-1" />{t("gp_tab_history")}
            </TabsTrigger>
          </TabsList>

          {/* ── Class Overview ── */}
          <TabsContent value="overview" className="space-y-6">
            {/* Class bar chart */}
            <Card className="bg-white/10 border-white/20 text-white">
              <CardHeader>
                <CardTitle className="text-white text-base">{t("gp_competency_heatmap")}</CardTitle>
              </CardHeader>
              <CardContent>
                {barData.some((d) => d.score > 0) ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={barData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                      <XAxis dataKey="code" tick={{ fill: "rgba(255,255,255,0.7)", fontSize: 11 }} />
                      <YAxis domain={[0, 100]} tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 10 }} />
                      <Tooltip
                        contentStyle={{ background: "#1e293b", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 8 }}
                        labelStyle={{ color: "#fff" }}
                        itemStyle={{ color: "#94a3b8" }}
                      />
                      <Bar dataKey="score" radius={[4, 4, 0, 0]}>
                        {barData.map((entry, index) => (
                          <Cell key={index} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[260px] flex items-center justify-center text-white/40 text-sm">
                    {t("gp_no_data")}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ── Progress Timeline Line Chart ── */}
            <Card className="bg-white/10 border-white/20 text-white">
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1">
                    <CardTitle className="text-white text-base flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-teal-400" />
                      {t("gp_progress_timeline")}
                      {timelineQ.data?.academicYear && (
                        <span className="text-white/40 text-xs font-normal ml-1">{timelineQ.data.academicYear}</span>
                      )}
                    </CardTitle>
                    <p className="text-white/40 text-xs mt-0.5">{t("gp_progress_timeline_sub")}</p>
                  </div>
                  {/* Competency toggle chips */}
                  <div className="flex flex-wrap gap-1.5">
                    {(["CCL","CP","STEM","CD","CPSAA","CC","CE","CCEC"] as const).map((code, i) => (
                      <button
                        key={code}
                        onClick={() => setActiveComps((prev) =>
                          prev.includes(code) ? (prev.length > 1 ? prev.filter((c) => c !== code) : prev) : [...prev, code]
                        )}
                        className={`px-2 py-0.5 rounded-full text-xs font-semibold border transition-all ${
                          activeComps.includes(code)
                            ? "border-transparent text-white"
                            : "border-white/20 text-white/30 bg-transparent"
                        }`}
                        style={activeComps.includes(code) ? { background: COMP_COLORS[i % COMP_COLORS.length] } : {}}
                      >
                        {code}
                      </button>
                    ))}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {timelineQ.isLoading ? (
                  <div className="h-[280px] flex items-center justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-teal-400" />
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart
                      data={timelineQ.data?.timeline ?? []}
                      margin={{ top: 8, right: 16, left: -20, bottom: 4 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                      <XAxis
                        dataKey="month"
                        tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 11 }}
                        interval={0}
                      />
                      <YAxis
                        domain={[0, 100]}
                        tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }}
                        tickCount={6}
                      />
                      <Tooltip
                        contentStyle={{ background: "#1e293b", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 8, fontSize: 12 }}
                        labelStyle={{ color: "#fff", fontWeight: 600 }}
                        itemStyle={{ color: "#94a3b8" }}
                        formatter={(value: unknown) => value === null ? ["—", ""] : [String(value) + "%", ""]}
                      />
                      {(["CCL","CP","STEM","CD","CPSAA","CC","CE","CCEC"] as const).map((code, i) =>
                        activeComps.includes(code) ? (
                          <Line
                            key={code}
                            type="monotone"
                            dataKey={code}
                            name={code}
                            stroke={COMP_COLORS[i % COMP_COLORS.length]}
                            strokeWidth={2}
                            dot={{ r: 3, fill: COMP_COLORS[i % COMP_COLORS.length] }}
                            activeDot={{ r: 5 }}
                            connectNulls={false}
                          />
                        ) : null
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Student × Competency heatmap grid */}
            {students.length > 0 && classComps.some((c) => c.average !== null) && (
              <Card className="bg-white/10 border-white/20 text-white overflow-x-auto">
                <CardHeader>
                  <CardTitle className="text-white text-base">{t("gp_student_rankings")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <table className="w-full text-xs min-w-[600px]">
                    <thead>
                      <tr>
                        <th className="text-left text-white/60 pb-2 pr-3 font-medium">{t("gp_table_student")}</th>
                        {classComps.map((c) => (
                          <th key={c.code} className="text-center text-white/60 pb-2 px-1 font-medium w-12">{c.code}</th>
                        ))}
                        <th className="text-center text-white/60 pb-2 pl-3 font-medium">{t("gp_table_avg")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ranked.map((s) => (
                        <tr key={s.student.id} className="border-t border-white/5">
                          <td className="py-1.5 pr-3">
                            <Link href={`/groups/${gId}/student/${s.student.id}`}>
                              <span className="text-teal-300 hover:text-teal-200 cursor-pointer font-medium">
                                {s.student.studentNumber}. {s.student.name}
                              </span>
                            </Link>
                          </td>
                          {classComps.map((c) => {
                            const sc = s.competencyScores.find((x) => x.code === c.code);
                            return (
                              <td key={c.code} className="py-1.5 px-1 text-center">
                                <span className={`inline-block w-9 py-0.5 rounded text-xs font-bold ${heatColor(sc?.average ?? null)}`}>
                                  {sc?.average !== null && sc?.average !== undefined ? sc.average : "—"}
                                </span>
                              </td>
                            );
                          })}
                          <td className="py-1.5 pl-3 text-center">
                            <span className={`inline-block w-10 py-0.5 rounded text-xs font-bold ${heatColor(s.overall)}`}>
                              {s.overall !== null ? s.overall : "—"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ── Students list ── */}
          <TabsContent value="students">
            {/* Generate All Reports panel */}
            <Card className="bg-white/10 border-white/20 text-white mb-4">
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <CardTitle className="text-white text-base flex items-center gap-2">
                      <FileText className="w-4 h-4 text-teal-400" />
                      {t("gp_all_reports_title")}
                    </CardTitle>
                    <p className="text-white/50 text-xs mt-1">{t("gp_all_reports_subtitle")}</p>
                  </div>
                  <Button
                    onClick={() => {
                      setAllReportsRunning(true);
                      setAllReportsResults(null);
                      generateAllReports.mutate({ groupId: gId, lang });
                    }}
                    disabled={allReportsRunning || totalActivities === 0}
                    className="bg-teal-600 hover:bg-teal-500 text-white font-semibold gap-2"
                  >
                    {allReportsRunning ? (
                      <><Loader2 className="w-4 h-4 animate-spin" />{t("gp_generating_all")}</>
                    ) : allReportsResults ? (
                      <><FileText className="w-4 h-4" />{t("gp_all_reports_regenerate")}</>
                    ) : (
                      <><SebaSymbol className="w-4 h-4" />{t("gp_generate_all_reports")}</>
                    )}
                  </Button>
                </div>
              </CardHeader>
              {(allReportsRunning || allReportsResults) && (
                <CardContent>
                  {allReportsRunning && (
                    <div className="flex items-center gap-3 py-4 text-white/60">
                      <Loader2 className="w-5 h-5 animate-spin text-teal-400" />
                      <span className="text-sm">{t("gp_generating_all")}</span>
                    </div>
                  )}
                  {allReportsResults && !allReportsRunning && (
                    <div className="space-y-2">
                      {/* Progress summary bar */}
                      <div className="flex items-center gap-2 mb-3">
                        <div className="flex-1 bg-white/10 rounded-full h-2 overflow-hidden">
                          <div
                            className="h-full bg-teal-500 rounded-full transition-all"
                            style={{ width: `${Math.round((allReportsResults.filter(r => r.ok).length / allReportsResults.length) * 100)}%` }}
                          />
                        </div>
                        <span className="text-xs text-white/60 flex-shrink-0">
                          {allReportsResults.filter(r => r.ok).length} / {allReportsResults.length}
                        </span>
                      </div>
                      {allReportsResults.map((r) => (
                        <div key={r.studentId} className="flex items-center gap-3 p-2.5 bg-white/5 rounded-lg border border-white/10">
                          {r.ok ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                          ) : (
                            <XCircle className="w-4 h-4 text-orange-400 flex-shrink-0" />
                          )}
                          <span className="flex-1 text-sm text-white">{r.studentName}</span>
                          {r.grade && (
                            <Badge className={`${GRADE_COLORS[r.grade] ?? "bg-slate-500"} text-white text-xs`}>
                              {r.grade}
                            </Badge>
                          )}
                          {!r.ok && (
                            <span className="text-xs text-orange-400">{t("gp_all_reports_no_data")}</span>
                          )}
                          {r.ok && (
                            <a href={`/groups/${gId}/student/${r.studentId}?tab=report`}>
                              <Button size="sm" variant="ghost" className="text-teal-400 hover:text-teal-300 hover:bg-teal-900/30 text-xs h-7 px-2">
                                {t("gp_all_reports_view")}
                              </Button>
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              )}
            </Card>

            <Card className="bg-white/10 border-white/20 text-white">
              <CardHeader>
                <CardTitle className="text-white text-base">{t("gp_student_rankings")}</CardTitle>
              </CardHeader>
              <CardContent>
                {students.length === 0 ? (
                  <p className="text-white/40 text-sm text-center py-8">{t("gp_no_students")}</p>
                ) : (
                  <div className="space-y-2">
                    {ranked.map((s, idx) => (
                      <div key={s.student.id} className="flex items-center gap-3 p-3 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition-colors">
                        <div className="w-8 text-center flex-shrink-0">
                          {idx === 0 ? <Medal className="w-5 h-5 text-yellow-400 mx-auto" /> :
                           idx === 1 ? <Medal className="w-5 h-5 text-slate-300 mx-auto" /> :
                           idx === 2 ? <Medal className="w-5 h-5 text-amber-600 mx-auto" /> :
                           <span className="text-white/40 text-sm font-bold">{idx + 1}</span>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-white text-sm">{s.student.name}</div>
                          <div className="text-white/40 text-xs">{s.student.email} · {s.totalActivities} {t("gp_activities_label")}</div>
                        </div>
                        <div className="flex gap-1 flex-wrap justify-end max-w-[200px]">
                          {s.competencyScores.filter((c) => c.average !== null).map((c) => (
                            <span key={c.code} className={`text-xs px-1.5 py-0.5 rounded font-bold ${heatColor(c.average)}`}>
                              {c.code}: {c.average}
                            </span>
                          ))}
                        </div>
                        <div className="w-14 text-right flex-shrink-0">
                          <span className={`inline-block px-2 py-0.5 rounded text-sm font-bold ${heatColor(s.overall)}`}>
                            {s.overall !== null ? s.overall : "—"}
                          </span>
                        </div>
                        <Link href={`/groups/${gId}/student/${s.student.id}`}>
                          <Button size="sm" variant="ghost" className="text-teal-400 hover:text-teal-300 hover:bg-teal-900/30 text-xs">
                            {t("gp_view_student")}
                          </Button>
                        </Link>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── AI Class Report ── */}
          <TabsContent value="report">
            <Card className="bg-white/10 border-white/20 text-white">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-white text-base flex items-center gap-2">
                    <SebaSymbol className="w-5 h-5 text-yellow-400" />
                    {t("gp_report_title")}
                  </CardTitle>
                  <Button
                    onClick={() => {
                      setGenerating(true);
                      generateReport.mutate({
                        groupId: gId,
                        className: group?.className ?? "Class",
                        lang,
                      });
                    }}
                    disabled={generating || totalActivities === 0}
                    className="bg-yellow-500 hover:bg-yellow-400 text-black font-semibold"
                  >
                    {generating ? (
                      <><Loader2 className="w-4 h-4 animate-spin mr-2" />{t("gp_generating")}</>
                    ) : (
                      <><SebaSymbol className="w-4 h-4 mr-2" />{t("gp_generate_report")}</>
                    )}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {!reportText && !generating && (
                  <div className="text-center py-12 space-y-3">
                    <Trophy className="w-12 h-12 mx-auto text-yellow-400/50" />
                    <p className="text-white/50 text-sm">{t("gp_report_prompt")}</p>
                    {totalActivities === 0 && (
                      <p className="text-orange-400 text-xs">{t("gp_report_needs_data")}</p>
                    )}
                  </div>
                )}
                {generating && (
                  <div className="text-center py-12 space-y-3">
                    <Loader2 className="w-10 h-10 animate-spin mx-auto text-teal-400" />
                    <p className="text-white/60 text-sm">{t("gp_generating_report")}</p>
                  </div>
                )}
                {reportText && !generating && (
                  <div className="space-y-4">
                    {reportGrade && (
                      <div className="flex items-center gap-3 p-4 bg-white/5 rounded-lg border border-white/10">
                        <Trophy className="w-6 h-6 text-yellow-400" />
                        <div>
                          <div className="text-white/60 text-xs">{t("gp_lomloe_grade")}</div>
                          <Badge className={`${GRADE_COLORS[reportGrade] ?? "bg-slate-500"} text-white text-sm mt-1`}>
                            {reportGrade}
                          </Badge>
                        </div>
                      </div>
                    )}
                    <div className="prose prose-invert prose-sm max-w-none bg-white/5 rounded-lg p-4 border border-white/10">
                      <Streamdown>{reportText}</Streamdown>
                    </div>
                    {/* School logo upload strip */}
                    <div className="flex items-center gap-2 p-3 bg-white/5 rounded-lg border border-white/10">
                      <ImagePlus className="w-4 h-4 text-white/50 flex-shrink-0" />
                      <span className="text-white/60 text-xs flex-1">
                        {schoolLogo ? t("gp_logo_attached") : t("gp_logo_add")}
                      </span>
                      {schoolLogo && (
                        <>
                          <img src={schoolLogo} alt="logo" className="h-7 w-auto rounded" />
                          <button
                            className="text-white/40 hover:text-red-400 transition-colors"
                            onClick={() => { setSchoolLogo(null); localStorage.removeItem("seba_school_logo"); }}
                          ><XIcon className="w-4 h-4" /></button>
                        </>
                      )}
                      <label className="cursor-pointer">
                        <span className="text-xs text-teal-400 hover:text-teal-300 underline">
                          {schoolLogo ? t("gp_logo_change") : t("gp_logo_upload")}
                        </span>
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = () => {
                            const b64 = reader.result as string;
                            setSchoolLogo(b64);
                            localStorage.setItem("seba_school_logo", b64);
                          };
                          reader.readAsDataURL(file);
                          e.target.value = "";
                        }} />
                      </label>
                    </div>
                    <Button
                      variant="outline"
                      className="w-full border-white/20 text-white hover:bg-white/10 bg-transparent gap-2"
                      onClick={() => {
                        const className = group?.className ?? "Class";
                        const level = group?.level ?? "";
                        const grade = reportGrade ?? "N/A";
                        const date = new Date().toLocaleDateString();
                        const logo = schoolLogo;
                        // Build SVG bar chart for competency averages
                        const comps = classComps.filter(c => c.average !== null);
                        const chartSvg = comps.length ? (() => {
                          const W = 520, H = 160, padL = 48, padB = 32, padT = 10, padR = 10;
                          const innerW = W - padL - padR;
                          const innerH = H - padT - padB;
                          const barW = Math.floor(innerW / comps.length) - 6;
                          const bars = comps.map((c, i) => {
                            const x = padL + i * (innerW / comps.length) + 3;
                            const barH = Math.round(((c.average ?? 0) / 100) * innerH);
                            const y = padT + innerH - barH;
                            const color = COMP_COLORS[i % COMP_COLORS.length];
                            return `<rect x="${x}" y="${y}" width="${barW}" height="${barH}" fill="${color}" rx="2"/>
<text x="${x + barW / 2}" y="${y - 3}" text-anchor="middle" font-size="9" fill="#333">${c.average}</text>
<text x="${x + barW / 2}" y="${H - 6}" text-anchor="middle" font-size="9" fill="#555">${c.code}</text>`;
                          }).join("");
                          return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" style="display:block;margin:12px 0">
<line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT + innerH}" stroke="#ccc" stroke-width="1"/>
<line x1="${padL}" y1="${padT + innerH}" x2="${W - padR}" y2="${padT + innerH}" stroke="#ccc" stroke-width="1"/>
${bars}
</svg>`;
                        })() : "";
                        // Convert markdown body to HTML
                        const bodyHtml = (reportText ?? "")
                          .split("\n")
                          .map((line) => {
                            if (/^#{1,3}\s/.test(line)) {
                              const lvl = line.match(/^(#{1,3})/)?.[1].length ?? 1;
                              const tag = `h${lvl + 1}`;
                              return `<${tag}>${line.replace(/^#{1,3}\s/, "")}</${tag}>`;
                            }
                            if (line.trim() === "") return "<br/>";
                            return `<p>${line.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")}</p>`;
                          })
                          .join("");
                        const logoHtml = logo
                          ? `<img src="${logo}" alt="School logo" style="max-height:56px;max-width:140px;object-fit:contain;float:right;margin-left:12px" />`
                          : "";
                        const html = `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8" />
  <title>${className} — ${t("gp_print_class_report")}</title>
  <style>
    @page { size: A4; margin: 20mm 18mm; }
    body { font-family: Georgia, serif; font-size: 12pt; color: #111; line-height: 1.6; }
    header { border-bottom: 2px solid #1e3a5f; padding-bottom: 8px; margin-bottom: 20px; overflow: hidden; }
    header h1 { font-size: 18pt; margin: 0 0 4px; color: #1e3a5f; }
    header .meta { font-size: 10pt; color: #555; }
    .grade-badge { display: inline-block; padding: 4px 12px; border-radius: 4px; font-weight: bold; font-size: 11pt; background: #1e3a5f; color: #fff; margin-bottom: 16px; }
    h2 { font-size: 14pt; color: #1e3a5f; margin-top: 20px; }
    h3 { font-size: 12pt; color: #1e3a5f; margin-top: 14px; }
    p { margin: 6px 0; }
    .chart-title { font-size: 11pt; font-weight: bold; color: #1e3a5f; margin-top: 20px; margin-bottom: 4px; }
    footer { border-top: 1px solid #ccc; margin-top: 32px; padding-top: 8px; font-size: 9pt; color: #888; text-align: center; }
  </style>
</head>
<body>
  <header>
    ${logoHtml}
    <h1>${className} — ${t("gp_print_class_report")}</h1>
    <div class="meta">${t("gp_print_level")}: ${level} &nbsp;|&nbsp; ${t("gp_print_generated")}: ${date}</div>
  </header>
  <div class="grade-badge">${t("gp_print_lomloe_grade")}: ${grade}</div>
  ${comps.length ? `<div class="chart-title">${t("gp_print_comp_averages")}</div>${chartSvg}` : ""}
  ${bodyHtml}
  <footer>AINA | TA — LOMLOE Teaching Assistant &nbsp;|&nbsp; Powered by SEBA</footer>
</body>
</html>`;
                        const win = window.open("", "_blank", "width=900,height=700");
                        if (win) {
                          win.document.write(html);
                          win.document.close();
                          win.focus();
                          setTimeout(() => win.print(), 600);
                        }
                      }}
                    >
                      <Download className="w-4 h-4" />
                      {t("sp_download_pdf")}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          {/* ── Challenge History ── */}
          <ChallengeHistoryTab groupId={gId} />
        </Tabs>
      </div>
    </div>
  );
}

// ─── Challenge History Tab ────────────────────────────────────────────────────
function ChallengeHistoryTab({ groupId }: { groupId: number }) {
  const { t } = useI18n();
  const historyQ = trpc.progress.getChallengeHistory.useQuery({ groupId }, { enabled: groupId > 0 });
  const [expandedIdx, setExpandedIdx] = _useState<number | null>(null);

  if (historyQ.isLoading) return (
    <TabsContent value="history">
      <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-white/60" /></div>
    </TabsContent>
  );

  const sessions = historyQ.data ?? [];

  return (
    <TabsContent value="history" className="space-y-4">
      {sessions.length === 0 ? (
        <Card className="bg-white/10 border-white/20 text-white">
          <CardContent className="py-12 text-center text-white/60">
            <History className="w-8 h-8 mx-auto mb-3 opacity-40" />
            <p>{t("gp_history_empty")}</p>
          </CardContent>
        </Card>
      ) : sessions.map((session, idx) => {
        const { log, questions, participants } = session;
        const isExpanded = expandedIdx === idx;
        const totalQ = questions.length;
        const avgScore = participants.length > 0
          ? Math.round(participants.reduce((s, p) => s + (totalQ > 0 ? (p.score / totalQ) * 100 : 0), 0) / participants.length)
          : 0;
        return (
          <Card key={log.id} className="bg-white/10 border-white/20 text-white">
            <CardHeader
              className="cursor-pointer select-none"
              onClick={() => setExpandedIdx(isExpanded ? null : idx)}
            >
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-white text-sm">{log.challengeTitle}</CardTitle>
                  <p className="text-white/60 text-xs mt-0.5">
                    {new Date(log.runAt).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
                    {" · "}{participants.length} {t("gp_history_participants")}
                    {" · "}{t("gp_history_avg")} {avgScore}%
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      // Build CSV
                      const headers = ["#", "Question", "Correct Answer", ...participants.map(p => p.nickname)];
                      const rows = questions.map((q, qi) => [
                        qi + 1,
                        `"${q.question.replace(/"/g, '""')}"`,
                        `"${(q.options?.[q.correctIndex] ?? "").replace(/"/g, '""')}"`,
                        ...participants.map(p => {
                          const ans = p.answers[qi];
                          const correct = ans === q.correctIndex;
                          return `"${correct ? "✓" : "✗"} ${(q.options?.[ans] ?? "No answer").replace(/"/g, '""')}"`;
                        }),
                      ]);
                      const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
                      const blob = new Blob([csv], { type: "text/csv" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `${log.challengeTitle.replace(/[^a-z0-9]/gi, "_")}_${new Date(log.runAt).toISOString().split("T")[0]}.csv`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                    className="p-1.5 rounded hover:bg-white/10 text-white/50 hover:text-white/80 transition-colors"
                    title={t("gp_history_export_csv")}
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                  {isExpanded ? <ChevronDown className="w-4 h-4 text-white/60" /> : <ChevronRight className="w-4 h-4 text-white/60" />}
                </div>
              </div>
            </CardHeader>
            {isExpanded && (
              <CardContent className="pt-0 space-y-4">
                {/* Per-question accuracy */}
                {totalQ > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-white/70 mb-2 uppercase tracking-wide">{t("gp_history_per_question")}</p>
                    <div className="space-y-2">
                      {questions.map((q, qi) => {
                        const correct = participants.filter(p => p.answers[qi] === q.correctIndex).length;
                        const pct = participants.length > 0 ? Math.round((correct / participants.length) * 100) : 0;
                        return (
                          <div key={qi} className="flex items-center gap-3">
                            <span className="text-xs text-white/50 w-5 text-right">{qi + 1}.</span>
                            <span className="flex-1 text-xs text-white/80 truncate">{q.question}</span>
                            <div className="w-24 bg-white/10 rounded-full h-1.5">
                              <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, backgroundColor: pct >= 70 ? "#10b981" : pct >= 40 ? "#f59e0b" : "#ef4444" }} />
                            </div>
                            <span className="text-xs text-white/60 w-8 text-right">{pct}%</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {/* Leaderboard */}
                {participants.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-white/70 mb-2 uppercase tracking-wide">{t("gp_history_leaderboard")}</p>
                    <div className="space-y-1">
                      {participants.slice(0, 10).map((p, pi) => (
                        <div key={pi} className="flex items-center gap-2 text-xs">
                          <span className="text-white/40 w-4">{pi + 1}</span>
                          <span className="flex-1 text-white/80">{p.nickname}</span>
                          <span className="text-white/60">{p.score}/{totalQ}</span>
                          <span className="text-white/50">{totalQ > 0 ? Math.round((p.score / totalQ) * 100) : 0}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        );
      })}
    </TabsContent>
  );
}
