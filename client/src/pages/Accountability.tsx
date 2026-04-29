import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { useI18n } from "@/contexts/I18nContext";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, CheckCircle, ChevronDown, ChevronUp, ClipboardList, Clock, Download, FileText, RefreshCw, Scan, ShieldCheck } from "lucide-react";
import { SebaSymbol } from "@/components/SebaSymbol";
import { toast } from "sonner";

const COMPETENCY_CODES = ["CCL", "CP", "STEM", "CD", "CPSAA", "CC", "CE", "CCEC"];
const YEAR_GROUPS = ["infantil", "lower_primary", "junior", "primary", "secondary"];

// ── Grade Overrides Tab ───────────────────────────────────────────────────────

function GradeOverridesTab() {
  const { t } = useI18n();
  const utils = trpc.useUtils();

  const [createOpen, setCreateOpen] = useState(false);
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<number | null>(null);
  const [createForm, setCreateForm] = useState({ studentId: "", competency: "CCL", yearGroup: "primary" });
  const [overrideForm, setOverrideForm] = useState({ teacherScore: "", reason: "" });

  const { data: assessments = [], isLoading } = trpc.accountability.grades.listAssessments.useQuery({});
  const { data: overrides = [] } = trpc.accountability.grades.listOverrides.useQuery(
    selectedAssessmentId ? { assessmentId: selectedAssessmentId } : {},
    { enabled: auditOpen }
  );

  const createMutation = trpc.accountability.grades.createAssessment.useMutation({
    onSuccess: () => {
      utils.accountability.grades.listAssessments.invalidate();
      setCreateOpen(false);
      setCreateForm({ studentId: "", competency: "CCL", yearGroup: "primary" });
      toast.success(t("acc_grade_create"));
    },
    onError: (e) => toast.error(e.message),
  });

  const overrideMutation = trpc.accountability.grades.overrideGrade.useMutation({
    onSuccess: () => {
      utils.accountability.grades.listAssessments.invalidate();
      setOverrideOpen(false);
      setOverrideForm({ teacherScore: "", reason: "" });
      toast.success(t("acc_grade_override") + " — saved to audit log");
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">{t("acc_tab_grades")}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Every AI assessment and teacher override is permanently recorded here.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} size="sm">
          {t("acc_grade_create")}
        </Button>
      </div>

      {isLoading ? (
        <div className="text-muted-foreground text-sm">{t("btn_loading")}</div>
      ) : assessments.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {t("acc_grade_no_assessments")}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {assessments.map((a) => (
            <Card key={a.id} className={a.overridden ? "border-amber-500/40" : ""}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline">{a.competency}</Badge>
                    {a.yearGroup && <Badge variant="secondary">{a.yearGroup}</Badge>}
                    {a.overridden && (
                      <Badge variant="outline" className="border-amber-500 text-amber-600">
                        {t("acc_grade_overridden")}
                      </Badge>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedAssessmentId(a.id);
                        setAuditOpen(true);
                      }}
                    >
                      <ClipboardList className="h-3.5 w-3.5 mr-1" />
                      {t("acc_audit_log")}
                    </Button>
                    {!a.overridden && (
                      <Button
                        size="sm"
                        onClick={() => {
                          setSelectedAssessmentId(a.id);
                          setOverrideOpen(true);
                        }}
                      >
                        {t("acc_grade_override")}
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                  <div>
                    <span className="text-muted-foreground">{t("acc_grade_student")}: </span>
                    <span className="font-medium">{a.studentId}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t("acc_grade_ai_score")}: </span>
                    <span className="font-semibold text-primary">{a.aiScore}%</span>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{a.aiSummary}</p>
                <p className="text-xs text-muted-foreground mt-2">
                  {t("acc_audit_date")}: {new Date(a.createdAt).toLocaleString()}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Assessment Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("acc_grade_create_title")}</DialogTitle>
            <DialogDescription>
              The AI will analyse the student's practice sessions and generate an objective assessment.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t("acc_grade_student_id")}</Label>
              <Input
                type="number"
                value={createForm.studentId}
                onChange={(e) => setCreateForm((f) => ({ ...f, studentId: e.target.value }))}
                placeholder="e.g. 42"
              />
            </div>
            <div>
              <Label>{t("acc_grade_competency")}</Label>
              <Select value={createForm.competency} onValueChange={(v) => setCreateForm((f) => ({ ...f, competency: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {COMPETENCY_CODES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("acc_grade_year_group")}</Label>
              <Select value={createForm.yearGroup} onValueChange={(v) => setCreateForm((f) => ({ ...f, yearGroup: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {YEAR_GROUPS.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>{t("btn_cancel")}</Button>
            <Button
              onClick={() =>
                createMutation.mutate({
                  studentId: parseInt(createForm.studentId),
                  competency: createForm.competency,
                  yearGroup: createForm.yearGroup,
                })
              }
              disabled={!createForm.studentId || createMutation.isPending}
            >
              {createMutation.isPending ? "Generating..." : t("acc_grade_generate")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Override Grade Dialog */}
      <Dialog open={overrideOpen} onOpenChange={setOverrideOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("acc_grade_override_title")}</DialogTitle>
            <DialogDescription>
              Your override will be permanently recorded in the audit log alongside the original AI grade.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t("acc_grade_teacher_score")} (0–100)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={overrideForm.teacherScore}
                onChange={(e) => setOverrideForm((f) => ({ ...f, teacherScore: e.target.value }))}
              />
            </div>
            <div>
              <Label>{t("acc_grade_override_reason")}</Label>
              <Textarea
                rows={4}
                value={overrideForm.reason}
                onChange={(e) => setOverrideForm((f) => ({ ...f, reason: e.target.value }))}
                placeholder={t("acc_grade_override_reason_ph")}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOverrideOpen(false)}>{t("btn_cancel")}</Button>
            <Button
              onClick={() => {
                if (!selectedAssessmentId) return;
                overrideMutation.mutate({
                  assessmentId: selectedAssessmentId,
                  teacherScore: parseInt(overrideForm.teacherScore),
                  reason: overrideForm.reason,
                });
              }}
              disabled={!overrideForm.teacherScore || overrideForm.reason.length < 10 || overrideMutation.isPending}
            >
              {overrideMutation.isPending ? "Saving..." : t("acc_grade_override_confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Audit Log Dialog */}
      <Dialog open={auditOpen} onOpenChange={setAuditOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("acc_audit_log")}</DialogTitle>
          </DialogHeader>
          {overrides.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">{t("acc_audit_no_overrides")}</p>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {overrides.map((o) => (
                <Card key={o.id} className="border-amber-500/30">
                  <CardContent className="pt-4 space-y-2">
                    <div className="flex gap-6 text-sm">
                      <div>
                        <span className="text-muted-foreground">{t("acc_audit_before")}: </span>
                        <span className="font-semibold text-destructive">{o.aiScore}%</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">{t("acc_audit_after")}: </span>
                        <span className="font-semibold text-green-600">{o.teacherScore}%</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">{t("acc_audit_teacher")}: </span>
                        <span>{o.teacherId}</span>
                      </div>
                    </div>
                    <p className="text-sm">
                      <span className="text-muted-foreground">{t("acc_audit_reason")}: </span>
                      {o.reason}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t("acc_audit_date")}: {new Date(o.createdAt).toLocaleString()}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAuditOpen(false)}>{t("btn_close")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Bias Incidents Tab ────────────────────────────────────────────────────────

function BiasIncidentsTab() {
  const { t } = useI18n();
  const utils = trpc.useUtils();
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [showResolved, setShowResolved] = useState(false);
  const [selectedScanId, setSelectedScanId] = useState<number | null>(null);
  const [scheduleHour, setScheduleHour] = useState<number>(4);
  const [showSchedule, setShowSchedule] = useState(false);

  const { data: flags = [], isLoading } = trpc.accountability.bias.listFlags.useQuery({
    resolved: showResolved,
  });

  const { data: lastScan } = trpc.accountability.bias.lastScanStatus.useQuery();
  const { data: scanHistory = [] } = trpc.accountability.bias.listScans.useQuery({ limit: 5 });
  const { data: scanFixes = [] } = trpc.accountability.bias.getScanFixes.useQuery(
    { scanRunId: selectedScanId! },
    { enabled: selectedScanId !== null }
  );
  trpc.accountability.bias.getScanSchedule.useQuery(undefined, {
    onSuccess: (d: { hour: number }) => setScheduleHour(d.hour),
  } as any);
  const { refetch: fetchExport, isFetching: isExporting } =
    trpc.accountability.bias.exportScanReport.useQuery(
      { scanRunId: selectedScanId ?? undefined },
      { enabled: false }
    );

  const resolveMutation = trpc.accountability.bias.resolveFlag.useMutation({
    onSuccess: () => {
      utils.accountability.bias.listFlags.invalidate();
      toast.success(t("acc_bias_resolve"));
    },
    onError: (e) => toast.error(e.message),
  });

  const runScanMutation = trpc.accountability.bias.runScan.useMutation({
    onSuccess: (result) => {
      utils.accountability.bias.listFlags.invalidate();
      utils.accountability.bias.lastScanStatus.invalidate();
      utils.accountability.bias.listScans.invalidate();
      toast.success(`Scan complete: ${result.summary}`);
    },
    onError: (e) => toast.error(`Scan failed: ${e.message}`),
  });

  const setScheduleMutation = trpc.accountability.bias.setScanSchedule.useMutation({
    onSuccess: (res) => toast.success(`Scan schedule updated to ${res.hour}:00 UTC`),
    onError: (e) => toast.error(`Failed to update schedule: ${e.message}`),
  });

  const handleExport = async () => {
    const result = await fetchExport();
    if (result.data) {
      const blob = new Blob([result.data.csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.data.filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Report downloaded");
    }
  };

  const severityVariant = (s: string): "destructive" | "outline" | "secondary" => {
    if (s === "high") return "destructive";
    if (s === "medium") return "outline";
    return "secondary";
  };

  const severityLabel = (s: string) => {
    if (s === "high") return t("acc_bias_high");
    if (s === "medium") return t("acc_bias_medium");
    return t("acc_bias_low");
  };

  const scanStatusColor = (status: string) => {
    if (status === "completed") return "text-green-600";
    if (status === "failed") return "text-destructive";
    return "text-amber-600";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">{t("acc_tab_bias")}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            The bias-guard middleware scans every AI response. A 24-hour automated scan detects and auto-resolves incidents.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowResolved((v) => !v)}>
            {showResolved ? t("acc_bias_unresolved") : t("acc_bias_resolved")}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowSchedule((v) => !v)}
          >
            <Clock className="h-4 w-4 mr-1.5" />
            Schedule
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleExport}
            disabled={isExporting}
          >
            {isExporting ? (
              <RefreshCw className="h-4 w-4 mr-1.5 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-1.5" />
            )}
            Export CSV
          </Button>
          <Button
            size="sm"
            variant="default"
            onClick={() => runScanMutation.mutate()}
            disabled={runScanMutation.isPending}
          >
            {runScanMutation.isPending ? (
              <RefreshCw className="h-4 w-4 mr-1.5 animate-spin" />
            ) : (
              <Scan className="h-4 w-4 mr-1.5" />
            )}
            Run Scan Now
          </Button>
        </div>
      </div>

      {/* Schedule settings panel */}
      {showSchedule && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="py-4 px-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
              <Clock className="h-4 w-4" /> Scan Schedule (UTC)
            </h3>
            <p className="text-xs text-muted-foreground mb-3">
              Set the UTC hour at which the automated daily scan runs. Changes take effect immediately.
            </p>
            <div className="flex items-center gap-3">
              <Select
                value={String(scheduleHour)}
                onValueChange={(v) => setScheduleHour(parseInt(v, 10))}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 24 }, (_, i) => (
                    <SelectItem key={i} value={String(i)}>
                      {String(i).padStart(2, "0")}:00 UTC
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                onClick={() => setScheduleMutation.mutate({ hour: scheduleHour })}
                disabled={setScheduleMutation.isPending}
              >
                {setScheduleMutation.isPending ? (
                  <RefreshCw className="h-4 w-4 mr-1.5 animate-spin" />
                ) : null}
                Save Schedule
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowSchedule(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Last scan status banner */}
      {lastScan && (
        <Card className="bg-muted/40">
          <CardContent className="py-3 px-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Scan className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Last scan:</span>
                <span className="text-sm text-muted-foreground">
                  {new Date(lastScan.runAt).toLocaleString()}
                </span>
                <Badge
                  variant="outline"
                  className={scanStatusColor(lastScan.status)}
                >
                  {lastScan.status}
                </Badge>
              </div>
              <div className="flex gap-4 text-sm text-muted-foreground">
                <span>{lastScan.incidentCount} incident{lastScan.incidentCount !== 1 ? "s" : ""} found</span>
                <span>{lastScan.fixesApplied} auto-resolved</span>
              </div>
            </div>
            {lastScan.summary && (
              <p className="text-xs text-muted-foreground mt-1.5">{lastScan.summary}</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Scan history */}
      {scanHistory.length > 1 && (
        <div>
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
            <SebaSymbol className="h-4 w-4" /> Recent Scan History
          </h3>
          <div className="space-y-1.5">
            {scanHistory.map((run) => (
              <button
                key={run.id}
                className="w-full text-left text-xs rounded border px-3 py-2 hover:bg-muted/60 transition-colors"
                onClick={() => setSelectedScanId(selectedScanId === run.id ? null : run.id)}
              >
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{new Date(run.runAt).toLocaleString()}</span>
                  <div className="flex gap-3">
                    <span className={scanStatusColor(run.status)}>{run.status}</span>
                    <span>{run.incidentCount} found · {run.fixesApplied} fixed</span>
                  </div>
                </div>
                {selectedScanId === run.id && scanFixes.length > 0 && (
                  <div className="mt-2 space-y-2">
                    {scanFixes.map((fix) => (
                      <div key={fix.id} className="bg-muted rounded p-2 space-y-1">
                        <p className="font-medium text-foreground">Flag #{fix.biasFlagId}</p>
                        <p className="text-muted-foreground"><span className="font-medium">Explanation:</span> {fix.biasExplanation}</p>
                        <p className="text-muted-foreground"><span className="font-medium">Suggested fix:</span> {fix.suggestedFix}</p>
                        <Badge variant="secondary" className="text-green-600 text-[10px]">Auto-applied</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Flag list */}
      {isLoading ? (
        <div className="text-muted-foreground text-sm">{t("btn_loading")}</div>
      ) : flags.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-3" />
            <p className="text-muted-foreground">{t("acc_bias_no_flags")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {flags.map((f) => (
            <Card key={f.id} className={f.severity === "high" ? "border-destructive/50" : ""}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={severityVariant(f.severity)}>{severityLabel(f.severity)}</Badge>
                    {f.resolved ? (
                      <Badge variant="secondary" className="text-green-600">{t("acc_bias_resolved")}</Badge>
                    ) : (
                      <Badge variant="outline" className="border-amber-500 text-amber-600">{t("acc_bias_unresolved")}</Badge>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button size="sm" variant="ghost" onClick={() => setExpandedId(expandedId === f.id ? null : f.id)}>
                      {expandedId === f.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                    {!f.resolved && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => resolveMutation.mutate({ flagId: f.id })}
                        disabled={resolveMutation.isPending}
                      >
                        {t("acc_bias_resolve")}
                      </Button>
                    )}
                  </div>
                </div>
                <p className="text-sm font-medium">{f.flagReason}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(f.createdAt).toLocaleString()}
                  {f.userId && ` · User ${f.userId}`}
                </p>
              </CardHeader>
              {expandedId === f.id && (
                <CardContent className="space-y-3 border-t pt-4">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">{t("acc_bias_input")}</p>
                    <p className="text-sm bg-muted rounded p-2 max-h-24 overflow-y-auto">{f.inputText}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">{t("acc_bias_output")}</p>
                    <p className="text-sm bg-muted rounded p-2 max-h-32 overflow-y-auto">{f.outputText}</p>
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Learning Paths Tab ────────────────────────────────────────────────────────

function LearningPathsTab() {
  const { t } = useI18n();
  const utils = trpc.useUtils();

  const [generateOpen, setGenerateOpen] = useState(false);
  const [justificationOpen, setJustificationOpen] = useState(false);
  const [selectedPathId, setSelectedPathId] = useState<number | null>(null);
  const [form, setForm] = useState({ studentId: "", studentName: "", competency: "CCL", yearGroup: "primary" });

  const { data: paths = [], isLoading } = trpc.accountability.paths.list.useQuery({});
  const { data: justification } = trpc.accountability.paths.getJustification.useQuery(
    { pathId: selectedPathId! },
    { enabled: justificationOpen && !!selectedPathId }
  );

  const generateMutation = trpc.accountability.paths.generate.useMutation({
    onSuccess: () => {
      utils.accountability.paths.list.invalidate();
      setGenerateOpen(false);
      setForm({ studentId: "", studentName: "", competency: "CCL", yearGroup: "primary" });
      toast.success(t("acc_path_saved"));
    },
    onError: (e) => toast.error(e.message),
  });

  type PathStep = { step: number; activity: string; duration: string; resources: string; rationale: string };
  type EvidenceSummary = { totalSessions: number; avgScore: number | null };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">{t("acc_tab_paths")}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Each path includes a full justification citing LOMLOE evidence — auditable by parents and teachers.
          </p>
        </div>
        <Button onClick={() => setGenerateOpen(true)} size="sm">
          {t("acc_path_generate")}
        </Button>
      </div>

      {isLoading ? (
        <div className="text-muted-foreground text-sm">{t("btn_loading")}</div>
      ) : paths.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {t("acc_path_no_paths")}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {paths.map((p) => (
            <Card key={p.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline">{p.competency}</Badge>
                      {p.yearGroup && <Badge variant="secondary">{p.yearGroup}</Badge>}
                    </div>
                    <CardDescription>
                      {t("acc_path_for_student")} {p.studentId} · {t("acc_path_generated_on")} {new Date(p.createdAt).toLocaleDateString()}
                    </CardDescription>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSelectedPathId(p.id);
                      setJustificationOpen(true);
                    }}
                  >
                    <FileText className="h-3.5 w-3.5 mr-1" />
                    {t("acc_path_view_justification")}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {(p.steps as PathStep[]).slice(0, 3).map((s) => (
                    <div key={s.step} className="flex items-start gap-3 text-sm">
                      <span className="shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold">
                        {s.step}
                      </span>
                      <div>
                        <span className="font-medium">{s.activity}</span>
                        <span className="text-muted-foreground ml-2">({s.duration})</span>
                      </div>
                    </div>
                  ))}
                  {(p.steps as PathStep[]).length > 3 && (
                    <p className="text-xs text-muted-foreground pl-9">
                      +{(p.steps as PathStep[]).length - 3} more steps
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Generate Dialog */}
      <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("acc_path_generate_title")}</DialogTitle>
            <DialogDescription>
              {t("acc_path_generate_desc")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t("acc_path_student_name")}</Label>
              <Input
                value={form.studentName}
                onChange={(e) => setForm((f) => ({ ...f, studentName: e.target.value }))}
                placeholder="e.g. Maria García"
              />
            </div>
            <div>
              <Label>{t("acc_path_student_id")}</Label>
              <Input
                type="number"
                value={form.studentId}
                onChange={(e) => setForm((f) => ({ ...f, studentId: e.target.value }))}
                placeholder="e.g. 42"
              />
            </div>
            <div>
              <Label>{t("acc_path_competency")}</Label>
              <Select value={form.competency} onValueChange={(v) => setForm((f) => ({ ...f, competency: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {COMPETENCY_CODES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("acc_path_year_group")}</Label>
              <Select value={form.yearGroup} onValueChange={(v) => setForm((f) => ({ ...f, yearGroup: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {YEAR_GROUPS.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGenerateOpen(false)}>{t("btn_cancel")}</Button>
            <Button
              onClick={() =>
                generateMutation.mutate({
                  studentId: parseInt(form.studentId),
                  studentName: form.studentName,
                  competency: form.competency,
                  yearGroup: form.yearGroup,
                })
              }
              disabled={!form.studentId || !form.studentName || generateMutation.isPending}
            >
              {generateMutation.isPending ? t("acc_path_generating") : t("acc_path_generate")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Justification Dialog */}
      <Dialog open={justificationOpen} onOpenChange={setJustificationOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("acc_path_justification")}</DialogTitle>
            <DialogDescription>
              This report can be shared with parents or used as evidence in a teacher review.
            </DialogDescription>
          </DialogHeader>
          {!justification ? (
            <p className="text-sm text-muted-foreground">{t("btn_loading")}</p>
          ) : (
            <div className="space-y-6">
              <div className="border rounded-lg p-4 bg-muted/30">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-muted-foreground">{t("acc_grade_student")}: </span><strong>{justification.studentId}</strong></div>
                  <div><span className="text-muted-foreground">{t("acc_grade_competency")}: </span><strong>{justification.competency}</strong></div>
                  {justification.yearGroup && <div><span className="text-muted-foreground">{t("acc_path_year_group")}: </span><strong>{justification.yearGroup}</strong></div>}
                  <div><span className="text-muted-foreground">{t("acc_path_generated_on")}: </span><strong>{new Date(justification.createdAt).toLocaleDateString()}</strong></div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  {t("acc_path_justification")}
                </h3>
                <p className="text-sm leading-relaxed bg-primary/5 border border-primary/20 rounded-lg p-4">
                  {justification.justification}
                </p>
              </div>

              <div>
                <h3 className="font-semibold mb-3">{t("acc_path_steps")}</h3>
                <div className="space-y-3">
                  {(justification.steps as PathStep[]).map((s) => (
                    <div key={s.step} className="border rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">
                          {s.step}
                        </span>
                        <span className="font-medium text-sm">{s.activity}</span>
                        <Badge variant="secondary" className="ml-auto shrink-0">{s.duration}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground ml-8">{t("acc_path_resources")}: {s.resources}</p>
                      <p className="text-xs text-primary/80 ml-8 mt-1 italic">{t("acc_path_rationale")}: {s.rationale}</p>
                    </div>
                  ))}
                </div>
              </div>

              {(justification.lomloeRefs as string[])?.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2">{t("acc_path_lomloe_refs")}</h3>
                  <ul className="list-disc list-inside space-y-1">
                    {(justification.lomloeRefs as string[]).map((ref, i) => (
                      <li key={i} className="text-sm text-muted-foreground">{ref}</li>
                    ))}
                  </ul>
                </div>
              )}

              {justification.evidence && (
                <div>
                  <h3 className="font-semibold mb-2">{t("acc_path_evidence")}</h3>
                  <div className="text-sm bg-muted rounded-lg p-3 space-y-1">
                    <p>Sessions: {(justification.evidence as EvidenceSummary).totalSessions}</p>
                    {(justification.evidence as EvidenceSummary).avgScore !== null && (
                      <p>Average score: {(justification.evidence as EvidenceSummary).avgScore}%</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => window.print()}>{t("acc_path_print")}</Button>
            <Button onClick={() => setJustificationOpen(false)}>{t("btn_close")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function Accountability() {
  const { t } = useI18n();

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <AlertTriangle className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">{t("acc_title")}</h1>
          </div>
          <p className="text-muted-foreground">
            Transparency and accountability for all AI-generated grades, content, and recommendations.
            Every action is permanently logged and auditable.
          </p>
        </div>

        <Tabs defaultValue="grades">
          <TabsList className="mb-6">
            <TabsTrigger value="grades" className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              {t("acc_tab_grades")}
            </TabsTrigger>
            <TabsTrigger value="bias" className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" />
              {t("acc_tab_bias")}
            </TabsTrigger>
            <TabsTrigger value="paths" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              {t("acc_tab_paths")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="grades"><GradeOverridesTab /></TabsContent>
          <TabsContent value="bias"><BiasIncidentsTab /></TabsContent>
          <TabsContent value="paths"><LearningPathsTab /></TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
