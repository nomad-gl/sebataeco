import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { useI18n } from "@/contexts/I18nContext";
import { trpc } from "@/lib/trpc";
import { Download, FileText, Shield, Users, Loader2, BarChart3, FileDown } from "lucide-react";
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
  useEffect(() => { if (!authLoading && user && user.role !== "admin") navigate("/"); }, [authLoading, user, navigate]);
  if (authLoading || (!user && !authLoading)) return null;
  if (user?.role !== "admin") return null;

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

  const reports = [
    {
      key: "lesson_plans",
      icon: <FileText className="w-5 h-5 text-primary" />,
      title: t("dir_report_lesson_plans"),
      desc: t("dir_report_lesson_plans_desc"),
      count: data?.allPlans.length ?? 0,
      label: t("dir_report_records"),
      onExport: exportLessonPlans,
    },
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {reports.map(r => (
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
