import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/contexts/I18nContext";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  ShieldCheck,
  Trash2,
  Download,
  RefreshCw,
  BookOpen,
  FileText,
  Calendar,
  Brain,
  BarChart2,
  Route,
  AlertTriangle,
  Clock,
  Users,
} from "lucide-react";

export default function Privacy() {
  const { t } = useI18n();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [confirmPhrase, setConfirmPhrase] = useState("");

  const { data: summary, isLoading, refetch } = trpc.privacy.getMyDataSummary.useQuery();

  const exportMutation = trpc.privacy.exportMyData.useQuery(undefined, {
    enabled: false,
  });

  const [parentReportLoading, setParentReportLoading] = useState(false);

  const parentReportMutation = trpc.privacy.generateParentReport.useMutation({
    onSuccess: (data) => {
      const link = document.createElement("a");
      link.href = `data:application/pdf;base64,${data.pdf}`;
      link.download = data.filename;
      link.click();
      setParentReportLoading(false);
    },
    onError: (err) => {
      toast.error(err.message);
      setParentReportLoading(false);
    },
  });

  const deleteMutation = trpc.privacy.deleteMyData.useMutation({
    onSuccess: () => {
      toast.success(t("privacy_data_deleted"));
      setDeleteDialogOpen(false);
      setConfirmPhrase("");
      refetch();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const handleExport = async () => {
    const result = await exportMutation.refetch();
    if (result.data) {
      const blob = new Blob([JSON.stringify(result.data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `seba-my-data-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t("privacy_export_success"));
    }
  };

  const dataCards = summary
    ? [
        {
          icon: BookOpen,
          label: t("privacy_practice_sessions"),
          value: summary.practiceSessions,
          note: t("privacy_retention_90"),
          color: "text-blue-500",
        },
        {
          icon: FileText,
          label: t("privacy_teaching_materials"),
          value: summary.teachingMaterials,
          note: t("privacy_kept_until_deleted"),
          color: "text-purple-500",
        },
        {
          icon: Calendar,
          label: t("privacy_lesson_plans"),
          value: summary.lessonPlans + summary.schoolCalendars,
          note: t("privacy_kept_until_deleted"),
          color: "text-green-500",
        },
        {
          icon: Brain,
          label: t("privacy_aina_profile"),
          value: summary.ainaProfileExists ? t("privacy_active") : t("privacy_none"),
          note: t("privacy_retention_90"),
          color: "text-amber-500",
        },
        {
          icon: BarChart2,
          label: t("privacy_assessments"),
          value: summary.aiAssessments,
          note: t("privacy_kept_until_deleted"),
          color: "text-red-500",
        },
        {
          icon: Route,
          label: t("privacy_learning_paths"),
          value: summary.learningPaths,
          note: t("privacy_kept_until_deleted"),
          color: "text-teal-500",
        },
      ]
    : [];

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-primary/10">
            <ShieldCheck className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{t("privacy_title")}</h1>
            <p className="text-muted-foreground mt-1 text-sm">{t("privacy_subtitle")}</p>
          </div>
        </div>

        {/* Principles */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("privacy_principles_title")}</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <div className="flex flex-col gap-1">
              <span className="font-semibold text-primary">{t("privacy_principle_min")}</span>
              <span className="text-muted-foreground">{t("privacy_principle_min_desc")}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="font-semibold text-primary">{t("privacy_principle_ret")}</span>
              <span className="text-muted-foreground">{t("privacy_principle_ret_desc")}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="font-semibold text-primary">{t("privacy_principle_ctrl")}</span>
              <span className="text-muted-foreground">{t("privacy_principle_ctrl_desc")}</span>
            </div>
          </CardContent>
        </Card>

        {/* Data summary */}
        <div>
          <h2 className="text-lg font-semibold mb-3">{t("privacy_data_stored")}</h2>
          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {dataCards.map((card) => (
                <Card key={card.label} className="relative overflow-hidden">
                  <CardContent className="pt-4 pb-3 px-4">
                    <card.icon className={`h-5 w-5 mb-2 ${card.color}`} />
                    <div className="text-xl font-bold">{card.value}</div>
                    <div className="text-xs font-medium text-foreground/80 mt-0.5">{card.label}</div>
                    <div className="flex items-center gap-1 mt-1.5">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      <span className="text-[11px] text-muted-foreground">{card.note}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Retention policy */}
        <Card className="border-amber-200/50 bg-amber-50/30 dark:bg-amber-900/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500" />
              {t("privacy_retention_title")}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-1">
            <p>{t("privacy_retention_sessions")}</p>
            <p>{t("privacy_retention_bias")}</p>
            <p>{t("privacy_retention_notifications")}</p>
            <p>{t("privacy_retention_profile")}</p>
          </CardContent>
        </Card>

        {/* EEA / Catalan Public Cloud data hosting notice */}
        <Card className="border-blue-200/50 bg-blue-50/30 dark:bg-blue-900/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <span className="text-lg">🇪🇺</span>
              {t("privacy_hosting_title")}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>{t("privacy_hosting_desc")}</p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Badge variant="outline" className="text-xs gap-1">
                <span>🇪🇺</span> GDPR Compliant
              </Badge>
              <Badge variant="outline" className="text-xs gap-1">
                <span>🏴󠁥󠁳󠁣󠁴󠁿</span> Núvol Públic de Catalunya
              </Badge>
              <Badge variant="outline" className="text-xs gap-1">
                <span>🔒</span> EEA Hosted
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground/70 pt-1">
              {t("privacy_hosting_note")}
            </p>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            variant="outline"
            className="flex-1 gap-2"
            onClick={handleExport}
            disabled={exportMutation.isFetching}
          >
            <Download className="h-4 w-4" />
            {exportMutation.isFetching ? t("privacy_exporting") : t("privacy_export_btn")}
          </Button>
          <Button
            variant="outline"
            className="flex-1 gap-2"
            onClick={() => {
              setParentReportLoading(true);
              parentReportMutation.mutate({});
            }}
            disabled={parentReportLoading}
          >
            <Users className="h-4 w-4" />
            {parentReportLoading ? "Generating…" : t("privacy_parent_report_btn")}
          </Button>
          <Button
            variant="outline"
            className="flex-1 gap-2"
            onClick={() => refetch()}
          >
            <RefreshCw className="h-4 w-4" />
            {t("privacy_refresh")}
          </Button>
          <Button
            variant="destructive"
            className="flex-1 gap-2"
            onClick={() => setDeleteDialogOpen(true)}
          >
            <Trash2 className="h-4 w-4" />
            {t("privacy_delete_btn")}
          </Button>
        </div>

        {/* Delete confirmation dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                {t("privacy_delete_title")}
              </DialogTitle>
              <DialogDescription>{t("privacy_delete_desc")}</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {t("privacy_delete_confirm_label")}:{" "}
                <span className="font-mono font-bold text-foreground">DELETE MY DATA</span>
              </p>
              <Input
                value={confirmPhrase}
                onChange={(e) => setConfirmPhrase(e.target.value)}
                placeholder="DELETE MY DATA"
                className="font-mono"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                {t("cancel")}
              </Button>
              <Button
                variant="destructive"
                disabled={confirmPhrase !== "DELETE MY DATA" || deleteMutation.isPending}
                onClick={() => deleteMutation.mutate({ confirmPhrase })}
              >
                {deleteMutation.isPending ? t("privacy_deleting") : t("privacy_delete_confirm_btn")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
