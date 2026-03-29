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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import {
  ArrowLeft, User, TrendingUp, BookOpen, FileText,
  CheckCircle2, Circle, Loader2, Sparkles, Trophy, Star, Download,
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

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-white/40 text-sm">—</span>;
  const color =
    score >= 90 ? "bg-emerald-500" :
    score >= 70 ? "bg-blue-500" :
    score >= 60 ? "bg-yellow-500" :
    score >= 50 ? "bg-orange-500" : "bg-red-500";
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-white text-xs font-bold ${color}`}>
      {score}
    </span>
  );
}

export default function StudentProgress() {
  const { groupId, studentId } = useParams<{ groupId: string; studentId: string }>();
  const gId = parseInt(groupId ?? "0");
  const sId = parseInt(studentId ?? "0");
  const { t, lang } = useI18n();
  const { user } = useAuth();

  const [reportTab, setReportTab] = useState<"individual" | "assignments">("individual");
  const [generating, setGenerating] = useState(false);
  const [reportText, setReportText] = useState<string | null>(null);
  const [reportGrade, setReportGrade] = useState<string | null>(null);

  // Assignment creation state
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newComp, setNewComp] = useState("any");
  const [newFreq, setNewFreq] = useState<"once" | "daily" | "weekly">("once");
  const [newDue, setNewDue] = useState("");

  const utils = trpc.useUtils();

  // Queries
  const summaryQ = trpc.progress.getStudentSummary.useQuery(
    { groupId: gId, studentId: sId },
    { enabled: !!user && gId > 0 && sId > 0 }
  );
  const recordsQ = trpc.progress.getStudentProgress.useQuery(
    { groupId: gId, studentId: sId },
    { enabled: !!user && gId > 0 && sId > 0 }
  );
  const studentsQ = trpc.groups.listStudents.useQuery(
    { groupId: gId },
    { enabled: !!user && gId > 0 }
  );
  const assignmentsQ = trpc.progress.listAssignments.useQuery(
    { groupId: gId },
    { enabled: !!user && gId > 0 }
  );

  // Mutations
  const generateReport = trpc.progress.generateStudentReport.useMutation({
    onSuccess: (data) => {
      setReportText(typeof data.report === "string" ? data.report : "");
      setReportGrade(data.grade);
      setGenerating(false);
    },
    onError: () => {
      toast.error(t("sp_report_failed"));
      setGenerating(false);
    },
  });

  const createAssignment = trpc.progress.createAssignment.useMutation({
    onSuccess: () => {
      toast.success(t("sp_assignment_created"));
      setNewTitle(""); setNewDesc(""); setNewComp("any"); setNewFreq("once"); setNewDue("");
      utils.progress.listAssignments.invalidate({ groupId: gId });
    },
    onError: () => toast.error(t("sp_assignment_failed")),
  });

  const deleteAssignment = trpc.progress.deleteAssignment.useMutation({
    onSuccess: () => {
      toast.success(t("sp_assignment_deleted"));
      utils.progress.listAssignments.invalidate({ groupId: gId });
    },
  });

  const completeAssignment = trpc.progress.completeAssignment.useMutation({
    onSuccess: () => {
      toast.success(t("sp_assignment_completed"));
      utils.progress.listAssignments.invalidate({ groupId: gId });
    },
  });

  const logScore = trpc.progress.logScores.useMutation({
    onSuccess: () => {
      toast.success(t("sp_score_logged"));
      utils.progress.getStudentSummary.invalidate({ groupId: gId, studentId: sId });
      utils.progress.getStudentProgress.invalidate({ groupId: gId, studentId: sId });
    },
  });

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-900 via-slate-900 to-emerald-900">
        <NavBar />
        <div className="flex items-center justify-center min-h-[80vh]">
          <Card className="bg-white/10 border-white/20 text-white max-w-sm w-full mx-4">
            <CardContent className="pt-8 pb-8 text-center space-y-4">
              <User className="w-12 h-12 mx-auto text-teal-400" />
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

  const student = studentsQ.data?.find((s) => s.id === sId);
  const summary = summaryQ.data;
  const records = recordsQ.data ?? [];
  const assignments = assignmentsQ.data ?? [];

  const radarData = (summary?.competencyAverages ?? []).map((c) => ({
    subject: c.code,
    value: c.average ?? 0,
    fullMark: 100,
  }));

  const barData = (summary?.competencyAverages ?? []).map((c, i) => ({
    code: c.code,
    score: c.average ?? 0,
    fill: COMP_COLORS[i % COMP_COLORS.length],
  }));

  // Recent activity (last 10)
  const recentRecords = records.slice(0, 10);

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-900 via-slate-900 to-emerald-900">
      <NavBar />
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link href={`/groups`}>
            <Button variant="ghost" size="sm" className="text-white/70 hover:text-white hover:bg-white/10">
              <ArrowLeft className="w-4 h-4 mr-1" />
              {t("sp_back_to_groups")}
            </Button>
          </Link>
        </div>

        <div className="flex flex-col md:flex-row md:items-center gap-4 mb-8">
          <div className="w-16 h-16 rounded-full bg-teal-600/30 border-2 border-teal-400/50 flex items-center justify-center flex-shrink-0">
            <User className="w-8 h-8 text-teal-300" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">
              {student?.name ?? t("sp_loading")}
            </h1>
            <p className="text-white/60 text-sm mt-1">
              {student?.email} · {t("sp_student_number")} {student?.studentNumber}
            </p>
          </div>
          {summary?.overall !== null && summary?.overall !== undefined && (
            <div className="md:ml-auto flex items-center gap-3">
              <div className="text-center">
                <div className="text-4xl font-black text-white">{summary.overall}</div>
                <div className="text-white/50 text-xs">{t("sp_overall_score")}</div>
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: t("sp_total_activities"), value: summary?.totalActivities ?? 0, icon: BookOpen, color: "text-blue-400" },
            { label: t("sp_overall_avg"), value: summary?.overall !== null && summary?.overall !== undefined ? `${summary.overall}/100` : "—", icon: TrendingUp, color: "text-emerald-400" },
            { label: t("sp_assignments"), value: assignments.length, icon: FileText, color: "text-purple-400" },
            { label: t("sp_competencies_tracked"), value: (summary?.competencyAverages ?? []).filter((c) => c.average !== null).length, icon: Star, color: "text-yellow-400" },
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
              {t("sp_tab_overview")}
            </TabsTrigger>
            <TabsTrigger value="history" className="data-[state=active]:bg-teal-600 data-[state=active]:text-white text-white/70">
              {t("sp_tab_history")}
            </TabsTrigger>
            <TabsTrigger value="assignments" className="data-[state=active]:bg-teal-600 data-[state=active]:text-white text-white/70">
              {t("sp_tab_assignments")}
            </TabsTrigger>
            <TabsTrigger value="report" className="data-[state=active]:bg-teal-600 data-[state=active]:text-white text-white/70">
              {t("sp_tab_report")}
            </TabsTrigger>
          </TabsList>

          {/* ── Overview ── */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              {/* Radar Chart */}
              <Card className="bg-white/10 border-white/20 text-white">
                <CardHeader>
                  <CardTitle className="text-white text-base">{t("sp_competency_radar")}</CardTitle>
                </CardHeader>
                <CardContent>
                  {radarData.some((d) => d.value > 0) ? (
                    <ResponsiveContainer width="100%" height={280}>
                      <RadarChart data={radarData}>
                        <PolarGrid stroke="rgba(255,255,255,0.15)" />
                        <PolarAngleAxis dataKey="subject" tick={{ fill: "rgba(255,255,255,0.7)", fontSize: 12 }} />
                        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} />
                        <Radar name="Score" dataKey="value" stroke="#14b8a6" fill="#14b8a6" fillOpacity={0.3} />
                      </RadarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[280px] flex items-center justify-center text-white/40 text-sm">
                      {t("sp_no_data_yet")}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Bar Chart */}
              <Card className="bg-white/10 border-white/20 text-white">
                <CardHeader>
                  <CardTitle className="text-white text-base">{t("sp_competency_scores")}</CardTitle>
                </CardHeader>
                <CardContent>
                  {barData.some((d) => d.score > 0) ? (
                    <ResponsiveContainer width="100%" height={280}>
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
                    <div className="h-[280px] flex items-center justify-center text-white/40 text-sm">
                      {t("sp_no_data_yet")}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Competency breakdown table */}
            <Card className="bg-white/10 border-white/20 text-white">
              <CardHeader>
                <CardTitle className="text-white text-base">{t("sp_competency_breakdown")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {(summary?.competencyAverages ?? []).map((comp, i) => (
                    <div key={comp.code} className="flex items-center gap-3">
                      <div className="w-12 text-xs font-bold text-white/70">{comp.code}</div>
                      <div className="flex-1 text-sm text-white/80 hidden md:block">{comp.name}</div>
                      <div className="flex-1 bg-white/10 rounded-full h-2 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${comp.average ?? 0}%`,
                            backgroundColor: COMP_COLORS[i % COMP_COLORS.length],
                          }}
                        />
                      </div>
                      <div className="w-12 text-right">
                        <ScoreBadge score={comp.average} />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Manual score entry */}
            <Card className="bg-white/10 border-white/20 text-white">
              <CardHeader>
                <CardTitle className="text-white text-base">{t("sp_log_score_title")}</CardTitle>
              </CardHeader>
              <CardContent>
                <ManualScoreEntry
                  onSubmit={(competency, score, activityTitle) =>
                    logScore.mutate({
                      groupId: gId,
                      studentId: sId,
                      activityType: "practice",
                      activityTitle,
                      scores: [{ competency, score }],
                    })
                  }
                  loading={logScore.isPending}
                  t={t}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── History ── */}
          <TabsContent value="history">
            <Card className="bg-white/10 border-white/20 text-white">
              <CardHeader>
                <CardTitle className="text-white text-base">{t("sp_activity_history")}</CardTitle>
              </CardHeader>
              <CardContent>
                {records.length === 0 ? (
                  <p className="text-white/40 text-sm text-center py-8">{t("sp_no_history")}</p>
                ) : (
                  <div className="space-y-2">
                    {records.map((r) => (
                      <div key={r.id} className="flex items-center gap-3 p-3 bg-white/5 rounded-lg border border-white/10">
                        <div className="w-14 text-center">
                          <span className="text-xs font-bold text-white/60 bg-white/10 px-2 py-0.5 rounded">{r.competency}</span>
                        </div>
                        <div className="flex-1">
                          <div className="text-sm text-white font-medium">{r.activityTitle ?? r.activityType}</div>
                          <div className="text-xs text-white/40">{new Date(r.recordedAt).toLocaleDateString()}</div>
                        </div>
                        <ScoreBadge score={r.score} />
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Assignments ── */}
          <TabsContent value="assignments" className="space-y-6">
            {/* Create assignment */}
            <Card className="bg-white/10 border-white/20 text-white">
              <CardHeader>
                <CardTitle className="text-white text-base">{t("sp_new_assignment")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-white/70 text-xs">{t("sp_assignment_title")}</Label>
                    <Input
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      placeholder={t("sp_assignment_title_placeholder")}
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/30"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-white/70 text-xs">{t("sp_assignment_competency")}</Label>
                    <Select value={newComp} onValueChange={setNewComp}>
                      <SelectTrigger className="bg-white/10 border-white/20 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any">{t("sp_any_competency")}</SelectItem>
                        {["CCL","CP","STEM","CD","CPSAA","CC","CE","CCEC"].map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-white/70 text-xs">{t("sp_assignment_frequency")}</Label>
                    <Select value={newFreq} onValueChange={(v) => setNewFreq(v as "once" | "daily" | "weekly")}>
                      <SelectTrigger className="bg-white/10 border-white/20 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="once">{t("sp_freq_once")}</SelectItem>
                        <SelectItem value="daily">{t("sp_freq_daily")}</SelectItem>
                        <SelectItem value="weekly">{t("sp_freq_weekly")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-white/70 text-xs">{t("sp_assignment_due")}</Label>
                    <Input
                      type="date"
                      value={newDue}
                      onChange={(e) => setNewDue(e.target.value)}
                      className="bg-white/10 border-white/20 text-white"
                    />
                  </div>
                </div>
                <Input
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder={t("sp_assignment_desc_placeholder")}
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/30"
                />
                <Button
                  onClick={() =>
                    createAssignment.mutate({
                      groupId: gId,
                      title: newTitle,
                      description: newDesc || undefined,
                      competency: newComp === "any" ? undefined : newComp,
                      dueDate: newDue || undefined,
                      frequency: newFreq,
                    })
                  }
                  disabled={!newTitle || createAssignment.isPending}
                  className="bg-teal-600 hover:bg-teal-500 text-white"
                >
                  {createAssignment.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  {t("sp_create_assignment")}
                </Button>
              </CardContent>
            </Card>

            {/* Assignment list */}
            <Card className="bg-white/10 border-white/20 text-white">
              <CardHeader>
                <CardTitle className="text-white text-base">{t("sp_assignments_list")}</CardTitle>
              </CardHeader>
              <CardContent>
                {assignments.length === 0 ? (
                  <p className="text-white/40 text-sm text-center py-8">{t("sp_no_assignments")}</p>
                ) : (
                  <div className="space-y-3">
                    {assignments.map((a) => (
                      <AssignmentRow
                        key={a.id}
                        assignment={a}
                        studentId={sId}
                        onComplete={(score) =>
                          completeAssignment.mutate({ assignmentId: a.id, studentId: sId, score })
                        }
                        onDelete={() => deleteAssignment.mutate({ assignmentId: a.id })}
                        t={t}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── AI Report ── */}
          <TabsContent value="report">
            <Card className="bg-white/10 border-white/20 text-white">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-white text-base flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-yellow-400" />
                    {t("sp_ai_report_title")}
                  </CardTitle>
                  <Button
                    onClick={() => {
                      setGenerating(true);
                      generateReport.mutate({
                        groupId: gId,
                        studentId: sId,
                        studentName: student?.name ?? "Student",
                        lang,
                      });
                    }}
                    disabled={generating || !summary || summary.totalActivities === 0}
                    className="bg-yellow-500 hover:bg-yellow-400 text-black font-semibold"
                  >
                    {generating ? (
                      <><Loader2 className="w-4 h-4 animate-spin mr-2" />{t("sp_generating")}</>
                    ) : (
                      <><Sparkles className="w-4 h-4 mr-2" />{t("sp_generate_report")}</>
                    )}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {!reportText && !generating && (
                  <div className="text-center py-12 space-y-3">
                    <Trophy className="w-12 h-12 mx-auto text-yellow-400/50" />
                    <p className="text-white/50 text-sm">{t("sp_report_prompt")}</p>
                    {summary?.totalActivities === 0 && (
                      <p className="text-orange-400 text-xs">{t("sp_report_needs_data")}</p>
                    )}
                  </div>
                )}
                {generating && (
                  <div className="text-center py-12 space-y-3">
                    <Loader2 className="w-10 h-10 animate-spin mx-auto text-teal-400" />
                    <p className="text-white/60 text-sm">{t("sp_generating_report")}</p>
                  </div>
                )}
                {reportText && !generating && (
                  <div className="space-y-4">
                    {reportGrade && (
                      <div className="flex items-center gap-3 p-4 bg-white/5 rounded-lg border border-white/10">
                        <Trophy className="w-6 h-6 text-yellow-400" />
                        <div>
                          <div className="text-white/60 text-xs">{t("sp_lomloe_grade")}</div>
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
                          `SEBA AI Studio — Student Progress Report\n`,
                          `Student: ${student?.name ?? "Student"}\n`,
                          `LOMLOE Grade: ${reportGrade ?? "N/A"}\n`,
                          `Generated: ${new Date().toLocaleDateString()}\n\n`,
                          reportText,
                        ], { type: "text/plain" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `${(student?.name ?? "student").replace(/\s+/g, "_")}_progress_report.txt`;
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

// ── Sub-components ────────────────────────────────────────────────────────────

function ManualScoreEntry({
  onSubmit,
  loading,
  t,
}: {
  onSubmit: (competency: string, score: number, title: string) => void;
  loading: boolean;
  t: (k: import("@/contexts/I18nContext").TranslationKey) => string;
}) {
  const [comp, setComp] = useState("CCL");
  const [score, setScore] = useState("75");
  const [title, setTitle] = useState("");

  return (
    <div className="flex flex-wrap gap-3 items-end">
      <div className="space-y-1">
        <Label className="text-white/70 text-xs">{t("sp_competency")}</Label>
        <Select value={comp} onValueChange={setComp}>
          <SelectTrigger className="bg-white/10 border-white/20 text-white w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {["CCL","CP","STEM","CD","CPSAA","CC","CE","CCEC"].map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-white/70 text-xs">{t("sp_score_0_100")}</Label>
        <Input
          type="number"
          min={0}
          max={100}
          value={score}
          onChange={(e) => setScore(e.target.value)}
          className="bg-white/10 border-white/20 text-white w-24"
        />
      </div>
      <div className="space-y-1 flex-1 min-w-[160px]">
        <Label className="text-white/70 text-xs">{t("sp_activity_title_label")}</Label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t("sp_activity_title_placeholder")}
          className="bg-white/10 border-white/20 text-white placeholder:text-white/30"
        />
      </div>
      <Button
        onClick={() => onSubmit(comp, parseInt(score) || 0, title)}
        disabled={loading}
        className="bg-teal-600 hover:bg-teal-500 text-white"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : t("sp_log_score")}
      </Button>
    </div>
  );
}

function AssignmentRow({
  assignment,
  studentId,
  onComplete,
  onDelete,
  t,
}: {
  assignment: { id: number; title: string; competency: string | null; frequency: string; dueDate: Date | null; description: string | null };
  studentId: number;
  onComplete: (score?: number) => void;
  onDelete: () => void;
  t: (k: import("@/contexts/I18nContext").TranslationKey) => string;
}) {
  const [scoreInput, setScoreInput] = useState("");
  const completionsQ = trpc.progress.getAssignmentCompletions.useQuery({ assignmentId: assignment.id });
  const isCompleted = completionsQ.data?.some((c) => c.studentId === studentId);

  return (
    <div className={`p-3 rounded-lg border ${isCompleted ? "bg-emerald-900/20 border-emerald-500/30" : "bg-white/5 border-white/10"}`}>
      <div className="flex items-start gap-3">
        <button
          onClick={() => !isCompleted && onComplete(scoreInput ? parseInt(scoreInput) : undefined)}
          className="mt-0.5 flex-shrink-0"
        >
          {isCompleted
            ? <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            : <Circle className="w-5 h-5 text-white/30 hover:text-white/60" />
          }
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`font-medium text-sm ${isCompleted ? "text-white/50 line-through" : "text-white"}`}>
              {assignment.title}
            </span>
            {assignment.competency && (
              <Badge className="bg-indigo-600/40 text-indigo-200 text-xs border-0">{assignment.competency}</Badge>
            )}
            <Badge className="bg-white/10 text-white/60 text-xs border-0">{assignment.frequency}</Badge>
          </div>
          {assignment.description && (
            <p className="text-white/50 text-xs mt-1">{assignment.description}</p>
          )}
          {assignment.dueDate && (
            <p className="text-white/40 text-xs mt-1">
              {t("sp_due")}: {new Date(assignment.dueDate).toLocaleDateString()}
            </p>
          )}
        </div>
        {!isCompleted && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <Input
              type="number"
              min={0}
              max={100}
              placeholder={t("sp_score_opt")}
              value={scoreInput}
              onChange={(e) => setScoreInput(e.target.value)}
              className="bg-white/10 border-white/20 text-white placeholder:text-white/30 w-20 h-7 text-xs"
            />
          </div>
        )}
        <button
          onClick={onDelete}
          className="text-white/20 hover:text-red-400 text-xs flex-shrink-0"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
