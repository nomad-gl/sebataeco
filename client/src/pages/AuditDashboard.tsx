import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/contexts/I18nContext";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ShieldCheck,
  AlertTriangle,
  Info,
  BookOpen,
  ChevronRight,
  RefreshCw,
  FileText,
  Download,
  Trash2,
  Clock,
  UserX,
  UserCheck,
  KeyRound,
  Users,
} from "lucide-react";
import { toast } from "sonner";

type EventType = "all" | "grade_override" | "bias_flag" | "learning_path" | "assessment" | "account_changes";

const SEVERITY_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  info: { label: "Info", variant: "secondary" },
  warning: { label: "Warning", variant: "outline" },
  critical: { label: "Critical", variant: "destructive" },
};

const TYPE_ICONS: Record<string, React.ReactNode> = {
  grade_override: <ShieldCheck className="h-4 w-4 text-blue-500" />,
  bias_flag: <AlertTriangle className="h-4 w-4 text-amber-500" />,
  learning_path: <BookOpen className="h-4 w-4 text-green-500" />,
  assessment: <Info className="h-4 w-4 text-purple-500" />,
  deactivate_user: <UserX className="h-4 w-4 text-red-500" />,
  reactivate_user: <UserCheck className="h-4 w-4 text-green-600" />,
  admin_password_reset: <KeyRound className="h-4 w-4 text-orange-500" />,
};

export default function AuditDashboard() {
  const { t } = useI18n();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [eventType, setEventType] = useState<EventType>("all");
  const [offset, setOffset] = useState(0);
  const [selectedEvent, setSelectedEvent] = useState<Record<string, unknown> | null>(null);
  const LIMIT = 25;

  const { data: stats, refetch: refetchStats } = trpc.audit.getStats.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const { data: logData, isLoading, refetch: refetchLog } = trpc.audit.getAuditLog.useQuery(
    { limit: LIMIT, offset, eventType },
    { refetchOnWindowFocus: false }
  );

  const handleRefresh = () => {
    void refetchStats();
    void refetchLog();
  };

  const csvQuery = trpc.audit.exportCsv.useQuery(
    { eventType },
    { enabled: false, refetchOnWindowFocus: false }
  );

  const handleExportCsv = async () => {
    const result = await csvQuery.refetch();
    if (result.data) {
      const blob = new Blob([result.data.csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `seba-audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`${t("audit_export_csv_title")} — ${result.data.count} events`);
    }
  };

  const utils = trpc.useUtils();

  const { data: retentionStatus, refetch: refetchRetention } = trpc.audit.getRetentionStatus.useQuery(
    undefined,
    { refetchOnWindowFocus: false }
  );

  const purgeMutation = trpc.audit.runRetentionPurge.useMutation({
    onSuccess: (data) => {
      toast.success(`${t("audit_retention_success")} — ${data.deleted} ${t("audit_retention_deleted")}`);
      void refetchRetention();
      void utils.audit.getStats.invalidate();
    },
    onError: () => toast.error(t("audit_retention_error")),
  });

  const formatDate = (ts: number) =>
    new Date(ts).toLocaleString(undefined, {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <NavBar />
      <main className="flex-1">
      <div className="container max-w-6xl py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t("audit_title")}</h1>
            <p className="text-muted-foreground text-sm mt-1">{t("audit_subtitle")}</p>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <Button variant="outline" size="sm" onClick={handleExportCsv} disabled={csvQuery.isFetching}>
                <Download className="h-4 w-4 mr-2" />
                {csvQuery.isFetching ? "…" : t("audit_export_csv")}
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handleRefresh}>
              <RefreshCw className="h-4 w-4 mr-2" />
              {t("audit_refresh")}
            </Button>
          </div>
        </div>

        {/* Retention status card */}
        <Card className="border-amber-200/50 bg-amber-50/30 dark:bg-amber-900/10">
          <CardContent className="py-3 px-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="p-1.5 rounded-md bg-amber-100 dark:bg-amber-900/30 mt-0.5">
                  <Trash2 className="h-4 w-4 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{t("audit_retention_title")}</p>
                  <p className="text-xs text-muted-foreground">{t("audit_retention_months")}</p>
                  {retentionStatus && (
                    <div className="flex items-center gap-1.5 mt-1">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        {t("audit_retention_status")}:{" "}
                        {retentionStatus.lastRunAt
                          ? `${new Date(retentionStatus.lastRunAt).toLocaleString()} — ${retentionStatus.lastDeletedCount} ${t("audit_retention_deleted")}`
                          : t("audit_retention_never")}
                      </span>
                      {retentionStatus.lastError && (
                        <Badge variant="destructive" className="text-[10px] py-0">
                          {t("audit_retention_error")}
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              </div>
          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 border-amber-300 hover:bg-amber-100"
              onClick={() => purgeMutation.mutate(undefined as unknown as void)}
              disabled={purgeMutation.isPending}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              {purgeMutation.isPending ? t("audit_retention_running") : t("audit_retention_run_btn")}
            </Button>
          )}
            </div>
          </CardContent>
        </Card>

        {/* Stats row */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { label: t("audit_stat_overrides"), value: stats.last30Days.gradeOverrides, icon: <ShieldCheck className="h-4 w-4 text-blue-500" /> },
              { label: t("audit_stat_bias"), value: stats.last30Days.biasFlags, icon: <AlertTriangle className="h-4 w-4 text-amber-500" /> },
              { label: t("audit_stat_unresolved"), value: stats.last30Days.unresolvedBiasFlags, icon: <AlertTriangle className="h-4 w-4 text-red-500" /> },
              { label: t("audit_stat_paths"), value: stats.last30Days.learningPaths, icon: <BookOpen className="h-4 w-4 text-green-500" /> },
              { label: t("audit_stat_assessments"), value: stats.last30Days.aiAssessments, icon: <Info className="h-4 w-4 text-purple-500" /> },
              { label: t("audit_stat_account_changes"), value: stats.last30Days.accountChanges ?? 0, icon: <Users className="h-4 w-4 text-slate-500" /> },
            ].map((s) => (
              <Card key={s.label} className="p-3">
                <div className="flex items-center gap-2 mb-1">{s.icon}<span className="text-xs text-muted-foreground">{s.label}</span></div>
                <p className="text-2xl font-bold">{s.value}</p>
                <p className="text-xs text-muted-foreground">{t("audit_last_30_days")}</p>
              </Card>
            ))}
          </div>
        )}

        <Tabs defaultValue="log">
          <TabsList>
            <TabsTrigger value="log">{t("audit_tab_log")}</TabsTrigger>
            <TabsTrigger value="algorithm">{t("audit_tab_algorithm")}</TabsTrigger>
          </TabsList>

          {/* Audit Log Tab */}
          <TabsContent value="log" className="space-y-4">
            <div className="flex items-center gap-3">
              <Select value={eventType} onValueChange={(v) => { setEventType(v as EventType); setOffset(0); }}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("audit_filter_all")}</SelectItem>
                  <SelectItem value="grade_override">{t("audit_filter_override")}</SelectItem>
                  <SelectItem value="bias_flag">{t("audit_filter_bias")}</SelectItem>
                  <SelectItem value="learning_path">{t("audit_filter_path")}</SelectItem>
                  <SelectItem value="assessment">{t("audit_filter_assessment")}</SelectItem>
                  <SelectItem value="account_changes">{t("audit_filter_account_changes")}</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-sm text-muted-foreground">
                {logData ? `${logData.total} ${t("audit_events_total")}` : ""}
              </span>
            </div>

            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead>{t("audit_col_type")}</TableHead>
                    <TableHead>{t("audit_col_summary")}</TableHead>
                    <TableHead>{t("audit_col_severity")}</TableHead>
                    <TableHead>{t("audit_col_status")}</TableHead>
                    <TableHead>{t("audit_col_date")}</TableHead>
                    <TableHead className="w-8"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        {t("audit_loading")}
                      </TableCell>
                    </TableRow>
                  )}
                  {!isLoading && (!logData?.events || logData.events.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        {t("audit_no_events")}
                      </TableCell>
                    </TableRow>
                  )}
                  {logData?.events.map((event) => {
                    const sev = SEVERITY_CONFIG[event.severity] ?? SEVERITY_CONFIG.info;
                    return (
                      <TableRow key={event.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedEvent(event as unknown as Record<string, unknown>)}>
                        <TableCell>{TYPE_ICONS[event.type]}</TableCell>
                        <TableCell className="font-medium text-sm">{event.typeLabel}</TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-xs truncate">{event.summary}</TableCell>
                        <TableCell>
                          <Badge variant={sev.variant}>{sev.label}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={event.resolved ? "secondary" : "outline"}>
                            {event.resolved ? t("audit_resolved") : t("audit_open")}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatDate(event.createdAt)}
                        </TableCell>
                        <TableCell>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>

            {/* Pagination */}
            {logData && logData.total > LIMIT && (
              <div className="flex justify-between items-center">
                <Button variant="outline" size="sm" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - LIMIT))}>
                  {t("audit_prev")}
                </Button>
                <span className="text-sm text-muted-foreground">
                  {offset + 1}–{Math.min(offset + LIMIT, logData.total)} / {logData.total}
                </span>
                <Button variant="outline" size="sm" disabled={offset + LIMIT >= logData.total} onClick={() => setOffset(offset + LIMIT)}>
                  {t("audit_next")}
                </Button>
              </div>
            )}
          </TabsContent>

          {/* Plain-language Algorithm Description Tab */}
          <TabsContent value="algorithm">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  <CardTitle>{t("audit_algo_title")}</CardTitle>
                </div>
                <CardDescription>{t("audit_algo_subtitle")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 text-sm leading-relaxed">
                {[
                  {
                    heading: t("audit_algo_h1"),
                    body: t("audit_algo_p1"),
                  },
                  {
                    heading: t("audit_algo_h2"),
                    body: t("audit_algo_p2"),
                  },
                  {
                    heading: t("audit_algo_h3"),
                    body: t("audit_algo_p3"),
                  },
                  {
                    heading: t("audit_algo_h4"),
                    body: t("audit_algo_p4"),
                  },
                  {
                    heading: t("audit_algo_h5"),
                    body: t("audit_algo_p5"),
                  },
                  {
                    heading: t("audit_algo_h6"),
                    body: t("audit_algo_p6"),
                  },
                ].map((section) => (
                  <div key={section.heading} className="space-y-1">
                    <h3 className="font-semibold text-foreground">{section.heading}</h3>
                    <p className="text-muted-foreground">{section.body}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
      </main>

      {/* Event detail dialog */}
      <Dialog open={!!selectedEvent} onOpenChange={() => setSelectedEvent(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("audit_event_detail")}</DialogTitle>
          </DialogHeader>
          {selectedEvent && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-xs text-muted-foreground">{t("audit_col_type")}</p>
                  <p className="font-medium">{String(selectedEvent.typeLabel ?? "")}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t("audit_col_date")}</p>
                  <p className="font-medium">{formatDate(selectedEvent.createdAt as number)}</p>
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t("audit_col_summary")}</p>
                <p className="font-medium">{String(selectedEvent.summary ?? "")}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">{t("audit_details")}</p>
                <pre className="bg-muted rounded p-3 text-xs overflow-auto max-h-48">
                  {JSON.stringify(selectedEvent.details, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <Footer />
    </div>
  );
}

