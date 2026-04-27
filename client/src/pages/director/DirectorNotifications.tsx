/**
 * DirectorNotifications — full-page list of all director alerts.
 *
 * Shows all non-dismissed alerts grouped by severity (critical first).
 * Supports mark-as-read, dismiss, and navigate-to-source actions.
 */
import { useEffect } from "react";
import { useLocation } from "wouter";
import {
  Bell, AlertTriangle, TrendingDown, X, CheckCheck,
  ExternalLink, ShieldAlert, Info,
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useI18n, type TranslationKey } from "@/contexts/I18nContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type AlertType = "unassigned_cover" | "high_absence_rate";
type AlertSeverity = "info" | "warning" | "critical";

interface DirectorAlert {
  id: number;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  body: string;
  link: string | null;
  isRead: boolean;
  isDismissed: boolean;
  createdAt: Date;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function severityLabel(severity: AlertSeverity, t: (k: TranslationKey) => string): string {
  switch (severity) {
    case "critical": return t("dir_notif_severity_critical");
    case "warning":  return t("dir_notif_severity_warning");
    default:         return t("dir_notif_severity_info");
  }
}

function severityVariant(severity: AlertSeverity): "destructive" | "secondary" | "outline" {
  switch (severity) {
    case "critical": return "destructive";
    case "warning":  return "secondary";
    default:         return "outline";
  }
}

function severityRowBg(severity: AlertSeverity): string {
  switch (severity) {
    case "critical": return "border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20";
    case "warning":  return "border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20";
    default:         return "border-border bg-card";
  }
}

function AlertTypeIcon({ type, severity }: { type: AlertType; severity: AlertSeverity }) {
  const colourMap: Record<AlertSeverity, string> = {
    critical: "text-red-500",
    warning:  "text-amber-500",
    info:     "text-blue-500",
  };
  const cls = `h-5 w-5 ${colourMap[severity]}`;
  if (type === "high_absence_rate") return <TrendingDown className={cls} />;
  if (severity === "critical") return <ShieldAlert className={cls} />;
  if (severity === "info") return <Info className={cls} />;
  return <AlertTriangle className={cls} />;
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleString("ca-ES", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DirectorNotifications() {
  const { t } = useI18n();
  const { user, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();

  // Role gate
  useEffect(() => {
    if (!authLoading && user && user.role !== "admin") navigate("/");
  }, [authLoading, user, navigate]);

  const utils = trpc.useUtils();

  const { data: alerts = [], isLoading } = trpc.directorAlerts.getAlerts.useQuery(undefined, {
    enabled: !!user && user.role === "admin",
    staleTime: 10_000,
  });

  const checkMutation = trpc.directorAlerts.checkAndCreateAlerts.useMutation({
    onSuccess: () => {
      utils.directorAlerts.getAlerts.invalidate();
      utils.directorAlerts.getUnreadCount.invalidate();
    },
  });

  // Run alert detection on page load
  useEffect(() => {
    if (user?.role === "admin") checkMutation.mutate();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.role]);

  const markReadMutation = trpc.directorAlerts.markRead.useMutation({
    onSuccess: () => {
      utils.directorAlerts.getAlerts.invalidate();
      utils.directorAlerts.getUnreadCount.invalidate();
    },
  });

  const markAllReadMutation = trpc.directorAlerts.markAllRead.useMutation({
    onSuccess: () => {
      utils.directorAlerts.getAlerts.invalidate();
      utils.directorAlerts.getUnreadCount.invalidate();
    },
  });

  const dismissMutation = trpc.directorAlerts.dismissAlert.useMutation({
    onSuccess: () => {
      utils.directorAlerts.getAlerts.invalidate();
      utils.directorAlerts.getUnreadCount.invalidate();
    },
  });

  if (authLoading || !user) return null;
  if (user.role !== "admin") return null;

  const typedAlerts = alerts as DirectorAlert[];
  const unreadCount = typedAlerts.filter((a) => !a.isRead).length;

  // Sort: critical first, then warning, then info; within each group newest first
  const severityOrder: Record<AlertSeverity, number> = { critical: 0, warning: 1, info: 2 };
  const sorted = [...typedAlerts].sort((a, b) => {
    const sd = severityOrder[a.severity] - severityOrder[b.severity];
    if (sd !== 0) return sd;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10">
              <Bell className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">{t("dir_notif_page_title")}</h1>
              <p className="text-sm text-muted-foreground">{t("dir_notif_page_desc")}</p>
            </div>
          </div>
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => markAllReadMutation.mutate()}
              disabled={markAllReadMutation.isPending}
              className="gap-2"
            >
              <CheckCheck className="h-4 w-4" />
              {t("dir_notif_mark_all_read")}
            </Button>
          )}
        </div>

        {/* Summary badges */}
        {!isLoading && sorted.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {(["critical", "warning", "info"] as AlertSeverity[]).map((sev) => {
              const count = sorted.filter((a) => a.severity === sev).length;
              if (count === 0) return null;
              return (
                <Badge key={sev} variant={severityVariant(sev)} className="gap-1">
                  {count} {severityLabel(sev, t)}
                </Badge>
              );
            })}
            {unreadCount > 0 && (
              <Badge variant="destructive" className="gap-1">
                {unreadCount} {t("dir_notif_unread")}
              </Badge>
            )}
          </div>
        )}

        {/* Alert list */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 w-full rounded-xl" />
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Bell className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-lg font-medium text-muted-foreground">{t("dir_notif_empty_page_title")}</p>
            <p className="text-sm text-muted-foreground/70 mt-1">{t("dir_notif_empty_page_desc")}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sorted.map((alert) => (
              <div
                key={alert.id}
                className={cn(
                  "group relative flex gap-4 p-4 rounded-xl border transition-all",
                  severityRowBg(alert.severity),
                  !alert.isRead && "shadow-sm",
                  alert.link && "cursor-pointer hover:shadow-md"
                )}
                onClick={() => {
                  if (!alert.isRead) markReadMutation.mutate({ id: alert.id });
                  if (alert.link) navigate(alert.link);
                }}
              >
                {/* Icon */}
                <div className="shrink-0 mt-0.5">
                  <AlertTypeIcon type={alert.type} severity={alert.severity} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-2 flex-wrap">
                    <p className={cn(
                      "text-sm font-semibold leading-tight",
                      !alert.isRead ? "text-foreground" : "text-muted-foreground"
                    )}>
                      {alert.title}
                    </p>
                    <Badge variant={severityVariant(alert.severity)} className="text-[10px] h-4 px-1.5 shrink-0">
                      {severityLabel(alert.severity, t)}
                    </Badge>
                    {!alert.isRead && (
                      <span className="h-2 w-2 rounded-full bg-red-500 shrink-0 mt-1" />
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                    {alert.body}
                  </p>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-xs text-muted-foreground/60">
                      {formatDate(alert.createdAt)}
                    </span>
                    {alert.link && (
                      <span className="text-xs text-primary flex items-center gap-1 font-medium">
                        {t("dir_notif_go_to_page")}
                        <ExternalLink className="h-3 w-3" />
                      </span>
                    )}
                  </div>
                </div>

                {/* Dismiss button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    dismissMutation.mutate({ id: alert.id });
                  }}
                  className="absolute top-3 right-3 h-6 w-6 flex items-center justify-center rounded-md opacity-0 group-hover:opacity-100 hover:bg-background/60 transition-all"
                  title={t("dir_notif_dismiss")}
                >
                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
