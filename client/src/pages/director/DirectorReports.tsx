import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { useI18n } from "@/contexts/I18nContext";
import { trpc } from "@/lib/trpc";
import { Download, FileText, Shield, Users, Loader2, BarChart3, FileDown, ChevronDown, ChevronUp, BookOpen, Cpu, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

function downloadCSV(filename: string, rows: string[][]) {
  const csv = rows.map(r => r.map(c => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadFromUrl(url: string, filename: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.target = "_blank";
  a.click();
}

export default function DirectorReports() {
  const { t } = useI18n();
  const { user, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const [pdfLoading, setPdfLoading] = useState(false);
  const [lessonPlansExpanded, setLessonPlansExpanded] = useState(true);

  useEffect(() => { if (!authLoading && user && user.role !== "admin" && user.role !== "director") navigate("/"); }, [authLoading, user, navigate]);
  if (authLoading || (!user && !authLoading)) return null;
  if (user?.role !== "admin" && user?.role !== "director") return null;

  const { data, isLoading } = trpc.director.getReportsData.useQuery();
  const generatePdf = trpc.director.generateDirectorPdf.useMutation();

  async function handleExportPdf() {
    setPdfLoading(true);
    try {
      const result = await generatePdf.mutateAsync({ locale: "en" });
      downloadFromUrl(result.url, result.filename);
      toast.success(t("dir_pdf_ready"));
    } catch {
      toast.error(t("dir_pdf_error"));
    } finally {
      setPdfLoading(false);
    }
  }

  function exportLessonPlans() {
    if (!data) return;
    const headers = ["ID", "Title", "Subject", "Year Group", "AI Generated", "Competencies", "Created At"];
    const rows = data.allPlans.map(p => [
      String(p.id),
      p.title,
      p.subject ?? "",
      p.yearGroup ?? "",
      p.aiGenerated ? "Yes" : "No",
      (() => { try { return JSON.parse(p.competencies ?? "[]").join("; "); } catch { return ""; } })(),
      p.createdAt ? new Date(p.createdAt).toLocaleDateString() : "",
    ]);
    downloadCSV(`seba-lesson-plans-${new Date().toISOString().slice(0, 10)}.csv`, [headers, ...rows]);
  }

  function exportBiasScans() {
    if (!data) return;
    const headers = ["Scan ID", "Run At", "Incidents Found", "Status"];
    const rows = data.allScans.map(s => [
      String(s.id),
      s.runAt ? new Date(s.runAt).toLocaleString() : "",
      String(s.incidentCount ?? 0),
      s.status ?? "",
    ]);
    downloadCSV(`seba-bias-scans-${new Date().toISOString().slice(0, 10)}.csv`, [headers, ...rows]);
  }

  function exportBiasFlags() {
    if (!data) return;
    const headers = ["Flag ID", "Category", "Severity", "Description", "Resolved", "Created At"];
    const rows = data.allFlags.map(f => [
      String(f.id),
      f.flagReason ?? "",
      f.severity ?? "",
      f.flagReason ?? "",
      f.resolved ? "Yes" : "No",
      f.createdAt ? new Date(f.createdAt).toLocaleDateString() : "",
    ]);
    downloadCSV(`seba-bias-flags-${new Date().toISOString().slice(0, 10)}.csv`, [headers, ...rows]);
  }

  function exportStaff() {
    if (!data) return;
    const headers = ["Name", "Email", "Role", "Joined"];
    const rows = data.allTeachers.map(u => [
      u.name ?? "",
      u.email ?? "",
      u.role ?? "",
      u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "",
    ]);
    downloadCSV(`seba-staff-${new Date().toISOString().slice(0, 10)}.csv`, [headers, ...rows]);
  }

  const exportCards = [
    {
      key: "bias_scans",
      icon: <Shield className="w-5 h-5 text-amber-500" />,
      title: t("dir_report_bias_scans"),
      desc: t("dir_report_bias_scans_desc"),
      count: data?.allScans.length ?? 0,
      label: t("dir_report_scans"),
      onExport: exportBiasScans,
    },
    {
      key: "bias_flags",
      icon: <Shield className="w-5 h-5 text-red-500" />,
      title: t("dir_report_bias_flags"),
      desc: t("dir_report_bias_flags_desc"),
      count: data?.allFlags.length ?? 0,
      label: t("dir_report_flags"),
      onExport: exportBiasFlags,
    },
    {
      key: "staff",
      icon: <Users className="w-5 h-5 text-blue-500" />,
      title: t("dir_report_staff"),
      desc: t("dir_report_staff_desc"),
      count: data?.allTeachers.length ?? 0,
      label: t("dir_report_users"),
      onExport: exportStaff,
    },
  ];

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10">
              <Download className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">{t("dir_reports")}</h1>
              <p className="text-sm text-muted-foreground">{t("dir_reports_desc")}</p>
            </div>
          </div>
          {/* School Report PDF export */}
          <Button
            onClick={handleExportPdf}
            disabled={pdfLoading || isLoading}
            className="shrink-0 gap-2"
          >
            {pdfLoading ? (
              <><Loader2 className="w-4 h-4 animate-spin" />{t("dir_pdf_generating")}</>
            ) : (
              <><FileDown className="w-4 h-4" />{t("dir_pdf_export")}</>
            )}
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Lesson Plans — expandable list */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-primary" />
                    <CardTitle className="text-base">{t("dir_report_lesson_plans")}</CardTitle>
                    <Badge variant="secondary" className="ml-1">{data?.allPlans.length ?? 0} {t("dir_report_records")}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={exportLessonPlans} disabled={(data?.allPlans.length ?? 0) === 0}>
                      <Download className="w-3.5 h-3.5 mr-1.5" />
                      {t("dir_export_csv")}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setLessonPlansExpanded(v => !v)} className="px-2">
                      {lessonPlansExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
                <CardDescription className="text-xs">{t("dir_report_lesson_plans_desc")}</CardDescription>
              </CardHeader>

              {lessonPlansExpanded && (
                <CardContent className="pt-0">
                  {(data?.allPlans.length ?? 0) === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
                      <BookOpen className="w-10 h-10 text-muted-foreground/40" />
                      <p className="text-sm text-muted-foreground">{t("dir_report_no_lesson_plans") ?? "No lesson plans found for this school."}</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-border rounded-lg border overflow-hidden">
                      {data!.allPlans.map(plan => (
                        <div key={plan.id} className="flex items-start justify-between gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{plan.title}</p>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              {plan.subject && (
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <BookOpen className="w-3 h-3" />{plan.subject}
                                </span>
                              )}
                              {plan.yearGroup && (
                                <span className="text-xs text-muted-foreground">{plan.yearGroup}</span>
                              )}
                              {plan.aiGenerated && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-1 text-purple-600 border-purple-300">
                                  <Cpu className="w-2.5 h-2.5" />AI
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0 mt-0.5">
                            <Calendar className="w-3 h-3" />
                            {plan.createdAt ? new Date(plan.createdAt).toLocaleDateString() : "—"}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              )}
            </Card>

            {/* Other export cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {exportCards.map(r => (
                <Card key={r.key} className="flex flex-col">
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      {r.icon}
                      <CardTitle className="text-base">{r.title}</CardTitle>
                    </div>
                    <CardDescription className="text-xs">{r.desc}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex items-center justify-between mt-auto pt-2">
                    <Badge variant="secondary">{r.count} {r.label}</Badge>
                    <Button size="sm" variant="outline" onClick={r.onExport} disabled={r.count === 0}>
                      <Download className="w-3.5 h-3.5 mr-1.5" />
                      {t("dir_export_csv")}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Compliance note */}
        <div className="rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground flex gap-3">
          <BarChart3 className="w-4 h-4 mt-0.5 shrink-0 text-primary" />
          <p>{t("dir_reports_compliance_note")}</p>
        </div>

        <p className="text-xs text-muted-foreground text-right">Powered by SEBA</p>
      </div>
    </DashboardLayout>
  );
}
