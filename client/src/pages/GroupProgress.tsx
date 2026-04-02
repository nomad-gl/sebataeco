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
} from "recharts";
import {
  ArrowLeft, Users, TrendingUp, Loader2, Sparkles, Trophy, Medal, Download,
} from "lucide-react";
import NavBar from "@/components/NavBar";
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

  const utils = trpc.useUtils();

  const summaryQ = trpc.progress.getGroupSummary.useQuery(
    { groupId: gId },
    { enabled: !!user && gId > 0 }
  );

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
                <a href={getLoginUrl()}>{t("nav_sign_in")}</a>
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
                        <th className="text-left text-white/60 pb-2 pr-3 font-medium">Student</th>
                        {classComps.map((c) => (
                          <th key={c.code} className="text-center text-white/60 pb-2 px-1 font-medium w-12">{c.code}</th>
                        ))}
                        <th className="text-center text-white/60 pb-2 pl-3 font-medium">Avg</th>
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
                          <div className="text-white/40 text-xs">{s.student.email} · {s.totalActivities} activities</div>
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
                    <Sparkles className="w-5 h-5 text-yellow-400" />
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
                      <><Sparkles className="w-4 h-4 mr-2" />{t("gp_generate_report")}</>
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
                    <Button
                      variant="outline"
                      className="w-full border-white/20 text-white hover:bg-white/10 bg-transparent gap-2"
                      onClick={() => {
                        const blob = new Blob([
                          `SEBA AI Studio — Class Progress Report\n`,
                          `Class: ${group?.className ?? "Class"} — ${group?.level ?? ""}\n`,
                          `LOMLOE Grade: ${reportGrade ?? "N/A"}\n`,
                          `Generated: ${new Date().toLocaleDateString()}\n\n`,
                          reportText ?? "",
                        ], { type: "text/plain" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `${(group?.className ?? "class").replace(/\s+/g, "_")}_progress_report.txt`;
                        a.click();
                        URL.revokeObjectURL(url);
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
        </Tabs>
      </div>
    </div>
  );
}
