import { useState, useEffect, useRef } from "react";
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
  CheckCircle2, Circle, Loader2, Trophy, Star, Download, X, Plus, ImagePlus, X as XIcon,
  Pencil, Eye, RotateCcw, Save,
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
  const [schoolLogo, setSchoolLogo] = useState<string | null>(
    () => localStorage.getItem("seba_school_logo")
  );
  // Report editing state
  const [editMode, setEditMode] = useState(false);
  const [editedText, setEditedText] = useState<string | null>(null);
  const [isEdited, setIsEdited] = useState(false);

  // Assignment creation state
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newComp, setNewComp] = useState("any");
  const [newFreq, setNewFreq] = useState<"once" | "daily" | "weekly">("once");
  const [newDue, setNewDue] = useState("");
  const [newType, setNewType] = useState<"worksheet"|"essay"|"quiz"|"project"|"presentation"|"research"|"creative"|"debate"|"experiment"|"other">("worksheet");
  const [newDifficulty, setNewDifficulty] = useState<"easy"|"medium"|"hard">("medium");
  const [newYearGroup, setNewYearGroup] = useState<"junior"|"primary"|"secondary">("primary");
  // AI generation state
  const [generatedContent, setGeneratedContent] = useState<string | null>(null);
  const [generatedAssignmentId, setGeneratedAssignmentId] = useState<number | null>(null);
  const [editingContent, setEditingContent] = useState(false);
  const [editedAssignmentContent, setEditedAssignmentContent] = useState<string>("");
  // Per-assignment expand/assess state
  const [expandedAssignmentId, setExpandedAssignmentId] = useState<number | null>(null);
  const [assessingId, setAssessingId] = useState<number | null>(null);
  const [studentResponseInputs, setStudentResponseInputs] = useState<Record<number, string>>({});

  const utils = trpc.useUtils();

  // Load saved report from DB on mount
  const savedReportQ = trpc.progress.getStudentReport.useQuery(
    { groupId: gId, studentId: sId },
    { enabled: !!user && gId > 0 && sId > 0 }
  );

  // Sync saved report into local state when it arrives
  useEffect(() => {
    const saved = savedReportQ.data;
    if (!saved) return;
    setReportText(saved.editedText ?? saved.aiText);
    setReportGrade(saved.grade ?? null);
    setIsEdited(!!saved.editedText);
    if (!editedText) setEditedText(saved.editedText ?? saved.aiText);
  }, [savedReportQ.data]);

  const saveReportMutation = trpc.progress.saveStudentReport.useMutation({
    onSuccess: () => {
      toast.success(t("sp_save_success"));
      setIsEdited(true);
      setEditMode(false);
      utils.progress.getStudentReport.invalidate({ groupId: gId, studentId: sId });
    },
    onError: () => toast.error(t("sp_save_failed")),
  });

  const resetReportMutation = trpc.progress.resetStudentReport.useMutation({
    onSuccess: () => {
      toast.success(t("sp_reset_success"));
      setIsEdited(false);
      setEditMode(false);
      const aiText = savedReportQ.data?.aiText ?? reportText ?? "";
      setReportText(aiText);
      setEditedText(aiText);
      utils.progress.getStudentReport.invalidate({ groupId: gId, studentId: sId });
    },
    onError: () => toast.error(t("sp_reset_failed")),
  });

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
    onSuccess: (data) => {
      toast.success(t("sp_assignment_created"));
      setGeneratedAssignmentId(data.id);
      utils.progress.listAssignments.invalidate({ groupId: gId });
    },
    onError: () => toast.error(t("sp_assignment_failed")),
  });

  const generateAssignment = trpc.progress.generateAssignment.useMutation({
    onSuccess: (data) => {
      setGeneratedContent(data.aiContent);
      setEditedAssignmentContent(data.aiContent);
      setEditingContent(false);
      toast.success(t("sp_assignment_generated"));
      // Also persist to DB if we already have an assignment ID
      if (generatedAssignmentId) {
        utils.progress.listAssignments.invalidate({ groupId: gId });
      }
    },
    onError: () => toast.error(t("sp_assignment_gen_failed")),
  });

  const saveAssignmentEdit = trpc.progress.saveAssignmentEdit.useMutation({
    onSuccess: () => {
      toast.success(t("sp_assignment_edit_saved"));
      setEditingContent(false);
      utils.progress.listAssignments.invalidate({ groupId: gId });
    },
    onError: () => toast.error(t("sp_assignment_edit_failed")),
  });

  const assessAssignment = trpc.progress.assessAssignment.useMutation({
    onSuccess: () => {
      toast.success(t("sp_assessment_done"));
      setAssessingId(null);
      utils.progress.listAssignments.invalidate({ groupId: gId });
    },
    onError: () => toast.error(t("sp_assessment_failed")),
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

  const exportPdf = trpc.progress.exportStudentPdf.useMutation({
    onSuccess: (data) => {
      // Decode base64 PDF and trigger download
      const binary = atob(data.base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(student?.name ?? "student").replace(/\s+/g, "_")}_progress_report.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    },
    onError: () => toast.error(t("sp_pdf_export_failed")),
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
                <a href={getLoginUrl(window.location.pathname + window.location.search)}>{t("nav_sign_in")}</a>
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
                        <Radar name={t("gp_radar_score")} dataKey="value" stroke="#14b8a6" fill="#14b8a6" fillOpacity={0.3} />
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
                  onSubmit={(rows, activityTitle) =>
                    logScore.mutate({
                      groupId: gId,
                      studentId: sId,
                      activityType: "practice",
                      activityTitle,
                      scores: rows,
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
                <CardTitle className="text-white text-base flex items-center gap-2">
                  <Plus className="w-4 h-4 text-teal-400" />
                  {t("sp_new_assignment")}
                </CardTitle>
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
                    <Label className="text-white/70 text-xs">{t("sp_assignment_type")}</Label>
                    <Select value={newType} onValueChange={(v) => setNewType(v as typeof newType)}>
                      <SelectTrigger className="bg-white/10 border-white/20 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(["worksheet","essay","quiz","project","presentation","research","creative","debate","experiment","other"] as const).map((tp) => (
                          <SelectItem key={tp} value={tp}>{t(`sp_type_${tp}` as import("@/contexts/I18nContext").TranslationKey)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-white/70 text-xs">{t("sp_assignment_difficulty")}</Label>
                    <Select value={newDifficulty} onValueChange={(v) => setNewDifficulty(v as "easy"|"medium"|"hard")}>
                      <SelectTrigger className="bg-white/10 border-white/20 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="easy">{t("sp_diff_easy")}</SelectItem>
                        <SelectItem value="medium">{t("sp_diff_medium")}</SelectItem>
                        <SelectItem value="hard">{t("sp_diff_hard")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-white/70 text-xs">{t("sp_assignment_year_group")}</Label>
                    <Select value={newYearGroup} onValueChange={(v) => setNewYearGroup(v as "junior"|"primary"|"secondary")}>
                      <SelectTrigger className="bg-white/10 border-white/20 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="junior">{t("sp_year_junior")}</SelectItem>
                        <SelectItem value="primary">{t("sp_year_primary")}</SelectItem>
                        <SelectItem value="secondary">{t("sp_year_secondary")}</SelectItem>
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
                <div className="flex gap-3 flex-wrap">
                  <Button
                    onClick={() => {
                      if (!newTitle) return;
                      createAssignment.mutate({
                        groupId: gId,
                        title: newTitle,
                        description: newDesc || undefined,
                        competency: newComp === "any" ? undefined : newComp,
                        dueDate: newDue || undefined,
                        frequency: newFreq,
                      }, {
                        onSuccess: (data) => {
                          // After creating, immediately generate AI content
                          generateAssignment.mutate({
                            assignmentId: data.id,
                            studentName: student?.name ?? "Student",
                            title: newTitle,
                            description: newDesc || undefined,
                            competency: newComp === "any" ? undefined : newComp,
                            assignmentType: newType,
                            yearGroup: newYearGroup,
                            difficulty: newDifficulty,
                            uiLang: lang as "en"|"es"|"ca",
                            competencyScores: summary?.competencyAverages ?? [],
                          });
                          setNewTitle(""); setNewDesc(""); setNewComp("any"); setNewFreq("once"); setNewDue("");
                        }
                      });
                    }}
                    disabled={!newTitle || createAssignment.isPending || generateAssignment.isPending}
                    className="bg-teal-600 hover:bg-teal-500 text-white"
                  >
                    {(createAssignment.isPending || generateAssignment.isPending) ? (
                      <><Loader2 className="w-4 h-4 animate-spin mr-2" />{t("sp_generating_assignment")}</>
                    ) : (
                      <><SebaSymbol className="w-4 h-4 mr-2" />{t("sp_save_and_generate")}</>
                    )}
                  </Button>
                </div>

                {/* AI-generated assignment preview/edit panel */}
                {generatedContent && (
                  <div className="mt-4 border border-teal-500/30 rounded-lg bg-teal-900/20 p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <SebaSymbol className="w-4 h-4 text-teal-400" />
                        <span className="text-white font-medium text-sm">{t("sp_ai_assignment_preview")}</span>
                        <Badge className="bg-teal-600 text-white text-xs border-0">{t("sp_ai_badge")}</Badge>
                        {editingContent && <Badge className="bg-amber-500 text-white text-xs border-0">{t("sp_edited_assignment_badge")}</Badge>}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            if (editingContent) {
                              setEditingContent(false);
                            } else {
                              setEditingContent(true);
                              setEditedAssignmentContent(generatedContent);
                            }
                          }}
                          className="border-white/20 text-white/80 hover:text-white bg-transparent text-xs h-7"
                        >
                          {editingContent ? <><Eye className="w-3 h-3 mr-1" />{t("sp_view_assignment")}</> : <><Pencil className="w-3 h-3 mr-1" />{t("sp_edit_assignment")}</>}
                        </Button>
                        {editingContent && generatedAssignmentId && (
                          <>
                            <Button
                              size="sm"
                              onClick={() => saveAssignmentEdit.mutate({ assignmentId: generatedAssignmentId, editedContent: editedAssignmentContent })}
                              disabled={saveAssignmentEdit.isPending}
                              className="bg-teal-600 hover:bg-teal-500 text-white text-xs h-7"
                            >
                              {saveAssignmentEdit.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Save className="w-3 h-3 mr-1" />}
                              {t("sp_save_assignment_edit")}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => { setEditedAssignmentContent(generatedContent); setEditingContent(false); }}
                              className="border-white/20 text-white/60 hover:text-white bg-transparent text-xs h-7"
                            >
                              <RotateCcw className="w-3 h-3 mr-1" />{t("sp_reset_assignment")}
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                    {editingContent ? (
                      <textarea
                        value={editedAssignmentContent}
                        onChange={(e) => setEditedAssignmentContent(e.target.value)}
                        className="w-full min-h-[300px] bg-white/5 border border-white/20 rounded p-3 text-white text-sm font-mono resize-y focus:outline-none focus:border-teal-400"
                        placeholder={t("sp_student_response_placeholder")}
                      />
                    ) : (
                      <div className="prose prose-invert prose-sm max-w-none text-white/90">
                        <Streamdown>{generatedContent}</Streamdown>
                      </div>
                    )}
                  </div>
                )}
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
                    <SebaSymbol className="w-5 h-5 text-yellow-400" />
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
                      <><SebaSymbol className="w-4 h-4 mr-2" />{t("sp_generate_report")}</>
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
                    {/* Grade + edit/view toggle row */}
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      {reportGrade && (
                        <div className="flex items-center gap-3 p-3 bg-white/5 rounded-lg border border-white/10 flex-1 min-w-0">
                          <Trophy className="w-5 h-5 text-yellow-400 flex-shrink-0" />
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-white/60 text-xs">{t("sp_lomloe_grade")}:</span>
                            <Badge className={`${GRADE_COLORS[reportGrade] ?? "bg-slate-500"} text-white text-sm`}>
                              {reportGrade}
                            </Badge>
                            {isEdited && (
                              <Badge className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs">
                                <Pencil className="w-3 h-3 mr-1" />{t("sp_edited_badge")}
                              </Badge>
                            )}
                          </div>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        {isEdited && !editMode && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-white/20 text-white/70 hover:bg-white/10 bg-transparent gap-1 text-xs"
                            onClick={() => {
                              resetReportMutation.mutate({ groupId: gId, studentId: sId });
                            }}
                            disabled={resetReportMutation.isPending}
                          >
                            {resetReportMutation.isPending
                              ? <Loader2 className="w-3 h-3 animate-spin" />
                              : <RotateCcw className="w-3 h-3" />}
                            {t("sp_reset_to_ai")}
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          className={`border-white/20 bg-transparent gap-1 text-xs ${
                            editMode
                              ? "text-teal-300 border-teal-500/40 hover:bg-teal-500/10"
                              : "text-white/70 hover:bg-white/10"
                          }`}
                          onClick={() => {
                            if (!editMode) {
                              // Entering edit mode — pre-fill with current text
                              setEditedText(reportText ?? "");
                            }
                            setEditMode((m) => !m);
                          }}
                        >
                          {editMode ? <Eye className="w-3 h-3" /> : <Pencil className="w-3 h-3" />}
                          {editMode ? t("sp_view_report") : t("sp_edit_report")}
                        </Button>
                      </div>
                    </div>

                    {/* View mode */}
                    {!editMode && (
                      <div className="prose prose-invert prose-sm max-w-none bg-white/5 rounded-lg p-4 border border-white/10">
                        <Streamdown>{reportText ?? ""}</Streamdown>
                      </div>
                    )}

                    {/* Edit mode */}
                    {editMode && (
                      <div className="space-y-3">
                        <textarea
                          className="w-full min-h-[420px] bg-white/5 border border-teal-500/30 rounded-lg p-4 text-white text-sm leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-teal-500/50 placeholder:text-white/30 font-mono"
                          value={editedText ?? ""}
                          onChange={(e) => setEditedText(e.target.value)}
                          placeholder={t("sp_edit_placeholder")}
                        />
                        <div className="flex gap-2 justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-white/20 text-white/70 hover:bg-white/10 bg-transparent"
                            onClick={() => setEditMode(false)}
                          >
                            {t("sp_view_report")}
                          </Button>
                          <Button
                            size="sm"
                            className="bg-teal-600 hover:bg-teal-500 text-white gap-1"
                            onClick={() => {
                              if (!editedText) return;
                              // Update local view immediately
                              setReportText(editedText);
                              saveReportMutation.mutate({
                                groupId: gId,
                                studentId: sId,
                                editedText,
                              });
                            }}
                            disabled={saveReportMutation.isPending || !editedText}
                          >
                            {saveReportMutation.isPending
                              ? <><Loader2 className="w-3 h-3 animate-spin" />{t("sp_saving")}</>
                              : <><Save className="w-3 h-3" />{t("sp_save_edits")}</>}
                          </Button>
                        </div>
                      </div>
                    )}
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
                        if (!reportText) return;
                        const studentName = student?.name ?? "Student";
                        const grade = reportGrade ?? "N/A";
                        const overall = summaryQ.data?.overall ?? null;
                        const date = new Date().toLocaleDateString();
                        const logo = schoolLogo;
                        const scores = (summaryQ.data?.competencyAverages ?? []).filter(c => c.average !== null);
                        // Build SVG bar chart
                        const chartSvg = scores.length ? (() => {
                          const W = 520, H = 160, padL = 48, padB = 32, padT = 10, padR = 10;
                          const innerW = W - padL - padR;
                          const innerH = H - padT - padB;
                          const barW = Math.floor(innerW / scores.length) - 6;
                          const bars = scores.map((c, i) => {
                            const x = padL + i * (innerW / scores.length) + 3;
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
                        const scoresTableHtml = scores.length
                          ? `<table><thead><tr><th>${t("gp_print_competency")}</th><th>${t("gp_print_average_score")}</th></tr></thead><tbody>${
                              scores.map((c) => `<tr><td>${c.code} — ${c.name}</td><td>${c.average !== null ? c.average + "%" : t("gp_print_no_data")}</td></tr>`).join("")
                            }</tbody></table>`
                          : "";
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
  <title>${studentName} — ${t("gp_print_student_report")}</title>
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
    table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 11pt; }
    th { background: #1e3a5f; color: #fff; padding: 6px 10px; text-align: left; }
    td { border-bottom: 1px solid #ddd; padding: 5px 10px; }
    .chart-title { font-size: 11pt; font-weight: bold; color: #1e3a5f; margin-top: 20px; margin-bottom: 4px; }
    footer { border-top: 1px solid #ccc; margin-top: 32px; padding-top: 8px; font-size: 9pt; color: #888; text-align: center; }
  </style>
</head>
<body>
  <header>
    ${logoHtml}
    <h1>${studentName} — ${t("gp_print_student_report")}</h1>
    <div class="meta">${t("gp_print_overall_score")}: ${overall !== null ? overall + "%" : "N/A"} &nbsp;|&nbsp; ${t("gp_print_generated")}: ${date}</div>
  </header>
  <div class="grade-badge">${t("gp_print_lomloe_grade")}: ${grade}</div>
  ${scores.length ? `<div class="chart-title">${t("gp_print_comp_scores")}</div>${chartSvg}` : ""}
  ${scoresTableHtml}
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
        </Tabs>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

const ALL_COMPETENCIES = ["CCL","CP","STEM","CD","CPSAA","CC","CE","CCEC"];

function ManualScoreEntry({
  onSubmit,
  loading,
  t,
}: {
  onSubmit: (rows: { competency: string; score: number }[], title: string) => void;
  loading: boolean;
  t: (k: import("@/contexts/I18nContext").TranslationKey) => string;
}) {
  const [rows, setRows] = useState([{ competency: "CCL", score: "75" }]);
  const [title, setTitle] = useState("");

  const addRow = () => {
    // Pick first competency not already in the list, or default to CCL
    const used = new Set(rows.map((r) => r.competency));
    const next = ALL_COMPETENCIES.find((c) => !used.has(c)) ?? "CCL";
    setRows((prev) => [...prev, { competency: next, score: "75" }]);
  };

  const removeRow = (idx: number) => setRows((prev) => prev.filter((_, i) => i !== idx));

  const updateRow = (idx: number, field: "competency" | "score", value: string) =>
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));

  const handleSubmit = () => {
    const parsed = rows.map((r) => ({ competency: r.competency, score: parseInt(r.score) || 0 }));
    onSubmit(parsed, title);
    // Reset after submit
    setRows([{ competency: "CCL", score: "75" }]);
    setTitle("");
  };

  return (
    <div className="space-y-3">
      {/* Activity title */}
      <div className="space-y-1">
        <Label className="text-white/70 text-xs">{t("sp_activity_title_label")}</Label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t("sp_activity_title_placeholder")}
          className="bg-white/10 border-white/20 text-white placeholder:text-white/30"
        />
      </div>

      {/* Competency rows */}
      <div className="space-y-2">
        {rows.map((row, idx) => (
          <div key={idx} className="flex flex-wrap gap-2 items-end">
            <div className="space-y-1">
              {idx === 0 && <Label className="text-white/70 text-xs">{t("sp_competency")}</Label>}
              <Select value={row.competency} onValueChange={(v) => updateRow(idx, "competency", v)}>
                <SelectTrigger className="bg-white/10 border-white/20 text-white w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ALL_COMPETENCIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              {idx === 0 && <Label className="text-white/70 text-xs">{t("sp_score_0_100")}</Label>}
              <Input
                type="number"
                min={0}
                max={100}
                value={row.score}
                onChange={(e) => updateRow(idx, "score", e.target.value)}
                className="bg-white/10 border-white/20 text-white w-24"
              />
            </div>
            {rows.length > 1 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeRow(idx)}
                className="text-red-400 hover:text-red-300 hover:bg-red-400/10 h-9 w-9 p-0 self-end"
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        ))}
      </div>

      {/* Add competency + Submit */}
      <div className="flex gap-2 pt-1">
        {rows.length < ALL_COMPETENCIES.length && (
          <Button
            variant="ghost"
            size="sm"
            onClick={addRow}
            className="text-teal-400 hover:text-teal-300 hover:bg-teal-400/10 text-xs"
          >
            <Plus className="w-3.5 h-3.5 mr-1" /> Add competency
          </Button>
        )}
        <Button
          onClick={handleSubmit}
          disabled={loading || !title.trim()}
          className="bg-teal-600 hover:bg-teal-500 text-white ml-auto"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : t("sp_log_score")}
        </Button>
      </div>
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
  assignment: { id: number; title: string; competency: string | null; frequency: string; dueDate: Date | null; description: string | null; aiContent?: string | null; editedContent?: string | null; studentResponse?: string | null; aiFeedback?: string | null; aiScore?: number | null; submissionUrl?: string | null; submissionName?: string | null; submissionMime?: string | null };
  studentId: number;
  onComplete: (score?: number) => void;
  onDelete: () => void;
  t: (k: import("@/contexts/I18nContext").TranslationKey) => string;
}) {
  const [scoreInput, setScoreInput] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [editingContent, setEditingContent] = useState(false);
  const [editedContent, setEditedContent] = useState(assignment.editedContent ?? assignment.aiContent ?? "");
  const [showAssess, setShowAssess] = useState(false);
  const [studentResponse, setStudentResponse] = useState(assignment.studentResponse ?? "");
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [localSubmission, setLocalSubmission] = useState<{ url: string; name: string; mime: string } | null>(
    assignment.submissionUrl ? { url: assignment.submissionUrl, name: assignment.submissionName ?? "file", mime: assignment.submissionMime ?? "" } : null
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();

  const completionsQ = trpc.progress.getAssignmentCompletions.useQuery({ assignmentId: assignment.id });
  const isCompleted = completionsQ.data?.some((c) => c.studentId === studentId);

  const uploadFile = trpc.progress.uploadAssignmentFile.useMutation({
    onSuccess: (data) => {
      setLocalSubmission({ url: data.url, name: data.fileName, mime: data.mimeType });
      setUploadProgress("done");
      toast.success(t("sp_upload_success"));
      utils.progress.listAssignments.invalidate();
    },
    onError: () => { setUploadProgress("error"); toast.error(t("sp_upload_failed")); },
  });

  const assessUploaded = trpc.progress.assessUploadedAssignment.useMutation({
    onSuccess: () => {
      toast.success(t("sp_assessment_done"));
      utils.progress.listAssignments.invalidate();
    },
    onError: () => toast.error(t("sp_assessment_failed")),
  });

  const handleFileUpload = async (file: File) => {
    const MAX_MB = 16;
    if (file.size > MAX_MB * 1024 * 1024) {
      toast.error(t("sp_upload_too_large"));
      return;
    }
    setUploadProgress("uploading");
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      uploadFile.mutate({ assignmentId: assignment.id, fileBase64: base64, fileName: file.name, mimeType: file.type });
    };
    reader.onerror = () => { setUploadProgress("error"); toast.error(t("sp_upload_failed")); };
    reader.readAsDataURL(file);
  };

  const saveEdit = trpc.progress.saveAssignmentEdit.useMutation({
    onSuccess: () => {
      toast.success(t("sp_assignment_edit_saved"));
      setEditingContent(false);
      utils.progress.listAssignments.invalidate();
    },
    onError: () => toast.error(t("sp_assignment_edit_failed")),
  });

  const assess = trpc.progress.assessAssignment.useMutation({
    onSuccess: () => {
      toast.success(t("sp_assessment_done"));
      setShowAssess(false);
      utils.progress.listAssignments.invalidate();
    },
    onError: () => toast.error(t("sp_assessment_failed")),
  });

  const displayContent = assignment.editedContent ?? assignment.aiContent;

  return (
    <div className={`rounded-lg border ${isCompleted ? "bg-emerald-900/20 border-emerald-500/30" : "bg-white/5 border-white/10"}`}>
      {/* Header row */}
      <div className="flex items-start gap-3 p-3">
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
            {displayContent && (
              <Badge className="bg-teal-600/40 text-teal-200 text-xs border-0">
                <SebaSymbol className="w-3 h-3 mr-1" />{t("sp_ai_badge")}
              </Badge>
            )}
            {assignment.editedContent && (
              <Badge className="bg-amber-500/40 text-amber-200 text-xs border-0">{t("sp_edited_assignment_badge")}</Badge>
            )}
            {assignment.aiScore !== null && assignment.aiScore !== undefined && (
              <Badge className="bg-purple-600/40 text-purple-200 text-xs border-0">{t("sp_ai_score_label")}: {assignment.aiScore}%</Badge>
            )}
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
        <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
          {!isCompleted && (
            <Input
              type="number"
              min={0}
              max={100}
              placeholder={t("sp_score_opt")}
              value={scoreInput}
              onChange={(e) => setScoreInput(e.target.value)}
              className="bg-white/10 border-white/20 text-white placeholder:text-white/30 w-20 h-7 text-xs"
            />
          )}
          {/* View / Edit button — always shown; disabled when no AI content yet */}
          <Button
            size="sm"
            variant="outline"
            onClick={() => { if (displayContent) setExpanded(!expanded); }}
            disabled={!displayContent}
            title={displayContent ? (expanded ? "Close preview" : "View or edit before issuing to students") : "Generate AI content first"}
            className={`text-xs h-7 bg-transparent ${
              expanded
                ? "border-teal-500/50 text-teal-300 hover:text-teal-200 hover:bg-teal-500/10"
                : displayContent
                  ? "border-white/20 text-white/70 hover:text-white"
                  : "border-white/10 text-white/30 cursor-not-allowed"
            }`}
          >
            {expanded
              ? <><Eye className="w-3 h-3 mr-1" />{t("sp_view_assignment")}</>
              : <><FileText className="w-3 h-3 mr-1" />{t("sp_edit_assignment")}</>}
          </Button>
          <button
            onClick={onDelete}
            className="text-white/20 hover:text-red-400 text-xs flex-shrink-0"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Expandable AI content panel */}
      {expanded && displayContent && (
        <div className="border-t border-teal-500/20 p-4 space-y-3 bg-teal-950/20 rounded-b-lg">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Eye className="w-3.5 h-3.5 text-teal-400" />
              <span className="text-teal-300 text-xs font-semibold">{t("sp_ai_assignment_preview")}</span>
              {assignment.editedContent
                ? <Badge className="bg-amber-500/30 text-amber-200 border-amber-500/30 text-xs border">Edited</Badge>
                : <Badge className="bg-teal-600/30 text-teal-200 border-teal-500/30 text-xs border">AI Draft</Badge>
              }
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  if (editingContent) {
                    setEditingContent(false);
                  } else {
                    setEditingContent(true);
                    setEditedContent(assignment.editedContent ?? assignment.aiContent ?? "");
                  }
                }}
                className="border-white/20 text-white/80 hover:text-white bg-transparent text-xs h-7"
              >
                {editingContent
                  ? <><Eye className="w-3 h-3 mr-1" />{t("sp_view_assignment")}</>
                  : <><Pencil className="w-3 h-3 mr-1" />{t("sp_edit_assignment")}</>}
              </Button>
              {editingContent && (
                <>
                  <Button
                    size="sm"
                    onClick={() => saveEdit.mutate({ assignmentId: assignment.id, editedContent })}
                    disabled={saveEdit.isPending}
                    className="bg-teal-600 hover:bg-teal-500 text-white text-xs h-7"
                  >
                    {saveEdit.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Save className="w-3 h-3 mr-1" />}
                    {t("sp_save_assignment_edit")}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => { setEditedContent(assignment.aiContent ?? ""); setEditingContent(false); }}
                    className="border-white/20 text-white/60 hover:text-white bg-transparent text-xs h-7"
                  >
                    <RotateCcw className="w-3 h-3 mr-1" />{t("sp_reset_assignment")}
                  </Button>
                </>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowAssess(!showAssess)}
                className="border-purple-500/40 text-purple-300 hover:text-purple-200 bg-transparent text-xs h-7"
              >
                <SebaSymbol className="w-3 h-3 mr-1" />{t("sp_assess_with_ai")}
              </Button>
            </div>
          </div>

          {editingContent ? (
            <textarea
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              className="w-full min-h-[280px] bg-white/5 border border-white/20 rounded p-3 text-white text-sm font-mono resize-y focus:outline-none focus:border-teal-400"
            />
          ) : (
            <div className="prose prose-invert prose-sm max-w-none text-white/90">
              <Streamdown>{displayContent}</Streamdown>
            </div>
          )}

          {/* AI Assessment panel */}
          {showAssess && (
            <div className="border-t border-purple-500/20 pt-3 space-y-4">
              <p className="text-purple-300 text-xs font-medium">{t("sp_assess_with_ai")}</p>

              {/* File upload zone */}
              <div className="space-y-2">
                <Label className="text-white/60 text-xs">{t("sp_upload_section")}</Label>
                {localSubmission ? (
                  <div className="flex items-center gap-3 bg-white/5 border border-white/20 rounded p-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-xs font-medium truncate">{localSubmission.name}</p>
                      <p className="text-white/40 text-xs">{t("sp_upload_preview")}</p>
                    </div>
                    {localSubmission.mime.startsWith("image/") && (
                      <img src={localSubmission.url} alt="preview" className="w-16 h-16 object-cover rounded border border-white/20" />
                    )}
                    <div className="flex flex-col gap-1">
                      <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}
                        className="border-white/20 text-white/60 hover:text-white bg-transparent text-xs h-6">
                        {t("sp_upload_change")}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setLocalSubmission(null)}
                        className="border-red-500/30 text-red-400 hover:text-red-300 bg-transparent text-xs h-6">
                        {t("sp_upload_remove")}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div
                    className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                      isDragging ? "border-purple-400 bg-purple-900/20" : "border-white/20 hover:border-purple-400/50 hover:bg-white/5"
                    }`}
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragging(false);
                      const file = e.dataTransfer.files[0];
                      if (file) handleFileUpload(file);
                    }}
                  >
                    {uploadProgress === "uploading" ? (
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
                        <p className="text-white/60 text-xs">{t("sp_upload_uploading")}</p>
                      </div>
                    ) : (
                      <>
                        <Plus className="w-6 h-6 text-white/30 mx-auto mb-2" />
                        <p className="text-white/60 text-xs">{t("sp_upload_drop_zone")}</p>
                        <p className="text-white/30 text-xs mt-1">{t("sp_upload_supported")}</p>
                      </>
                    )}
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.pdf,.doc,.docx,.txt"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); }}
                />
              </div>

              {/* Assess uploaded file */}
              {localSubmission && (
                <Button
                  size="sm"
                  onClick={() => assessUploaded.mutate({ assignmentId: assignment.id, studentName: `Student ${studentId}` })}
                  disabled={assessUploaded.isPending}
                  className="bg-purple-600 hover:bg-purple-500 text-white text-xs"
                >
                  {assessUploaded.isPending
                    ? <><Loader2 className="w-3 h-3 animate-spin mr-1" />{t("sp_assessing_uploaded")}</>
                    : <><SebaSymbol className="w-3 h-3 mr-1" />{t("sp_assess_uploaded")}</>}
                </Button>
              )}

              {/* Text response fallback */}
              <div className="space-y-1">
                <Label className="text-white/60 text-xs">{t("sp_student_response_label")}</Label>
                <textarea
                  value={studentResponse}
                  onChange={(e) => setStudentResponse(e.target.value)}
                  placeholder={t("sp_student_response_placeholder")}
                  className="w-full min-h-[100px] bg-white/5 border border-white/20 rounded p-3 text-white text-sm resize-y focus:outline-none focus:border-purple-400"
                />
              </div>
              <Button
                size="sm"
                onClick={() => assess.mutate({ assignmentId: assignment.id, studentResponse, studentName: `Student ${studentId}` })}
                disabled={!studentResponse.trim() || assess.isPending}
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs"
              >
                {assess.isPending ? <><Loader2 className="w-3 h-3 animate-spin mr-1" />{t("sp_assessing")}</> : <><SebaSymbol className="w-3 h-3 mr-1" />{t("sp_assess_with_ai")}</>}
              </Button>

              {assignment.aiFeedback && (
                <div className="bg-purple-900/20 border border-purple-500/20 rounded p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-purple-300 text-xs font-medium">{t("sp_ai_feedback_title")}</span>
                    {assignment.aiScore !== null && assignment.aiScore !== undefined && (
                      <Badge className="bg-purple-600 text-white text-xs border-0">{t("sp_ai_score_label")}: {assignment.aiScore}%</Badge>
                    )}
                  </div>
                  <div className="prose prose-invert prose-xs max-w-none text-white/80 text-xs">
                    <Streamdown>{assignment.aiFeedback}</Streamdown>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
