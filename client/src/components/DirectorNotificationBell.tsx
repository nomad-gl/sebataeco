/**
 * DirectorNotificationBell — notification bell icon for the director dashboard.
 *
 * Shows a red badge with the unread alert count.
 * On click, opens a dropdown panel listing the most recent alerts.
 * Provides Mark All Read and a link to the full notifications page.
 *
 * Also calls checkAndCreateAlerts on mount (and every 5 minutes) so the
 * director always sees fresh alerts without a manual refresh.
 */
import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Bell, AlertTriangle, TrendingDown, X, CheckCheck, ExternalLink } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/contexts/I18nContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
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

function severityColour(severity: AlertSeverity): string {
  switch (severity) {
    case "critical": return "text-red-500";
    case "warning":  return "text-amber-500";
    default:         return "text-blue-500";
  }
}

function severityBg(severity: AlertSeverity): string {
  switch (severity) {
    case "critical": return "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800";
    case "warning":  return "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800";
    default:         return "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800";
  }
}

function AlertIcon({ type, severity }: { type: AlertType; severity: AlertSeverity }) {
  const cls = `h-4 w-4 shrink-0 mt-0.5 ${severityColour(severity)}`;
  if (type === "high_absence_rate") return <TrendingDown className={cls} />;
  return <AlertTriangle className={cls} />;
}

function timeAgo(date: Date): string {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DirectorNotificationBell() {
  const { t } = useI18n();
  const [, navigate] = useLocation();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const utils = trpc.useUtils();

  // Fetch unread count (lightweight — runs every 60s)
  const { data: unreadCount = 0 } = trpc.directorAlerts.getUnreadCount.useQuery(undefined, {
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  // Fetch full alert list (only when panel is open)
  const { data: alerts = [] } = trpc.directorAlerts.getAlerts.useQuery(undefined, {
    enabled: open,
    staleTime: 10_000,
  });

  // Trigger alert detection on mount and every 5 minutes
  const checkMutation = trpc.directorAlerts.checkAndCreateAlerts.useMutation({
    onSuccess: () => {
      utils.directorAlerts.getUnreadCount.invalidate();
      utils.directorAlerts.getAlerts.invalidate();
    },
  });

  useEffect(() => {
    checkMutation.mutate();
    const interval = setInterval(() => checkMutation.mutate(), 5 * 60_000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mutations
  const markReadMutation = trpc.directorAlerts.markRead.useMutation({
    onSuccess: () => {
      utils.directorAlerts.getUnreadCount.invalidate();
      utils.directorAlerts.getAlerts.invalidate();
    },
  });

  const markAllReadMutation = trpc.directorAlerts.markAllRead.useMutation({
    onSuccess: () => {
      utils.directorAlerts.getUnreadCount.invalidate();
      utils.directorAlerts.getAlerts.invalidate();
    },
  });

  const dismissMutation = trpc.directorAlerts.dismissAlert.useMutation({
    onSuccess: () => {
      utils.directorAlerts.getUnreadCount.invalidate();
      utils.directorAlerts.getAlerts.invalidate();
    },
  });

  // Close panel when clicking outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleBellClick = () => {
    setOpen((prev) => !prev);
  };

  const handleAlertClick = (alert: DirectorAlert) => {
    if (!alert.isRead) markReadMutation.mutate({ id: alert.id });
    if (alert.link) {
      navigate(alert.link);
      setOpen(false);
    }
  };

  const handleDismiss = (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    dismissMutation.mutate({ id });
  };

  const visibleAlerts = (alerts as DirectorAlert[]).slice(0, 8);
  const hasUnread = unreadCount > 0;

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <button
        onClick={handleBellClick}
        className="relative h-9 w-9 flex items-center justify-center rounded-lg hover:bg-accent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={t("dir_notif_bell_label")}
      >
        <Bell className={cn("h-5 w-5", hasUnread ? "text-foreground" : "text-muted-foreground")} />
        {hasUnread && (
          <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-0.5 flex items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white leading-none">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 top-11 z-50 w-80 rounded-xl border bg-popover text-popover-foreground shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold text-sm">{t("dir_notif_panel_title")}</span>
              {hasUnread && (
                <Badge variant="destructive" className="h-4 px-1 text-[10px]">
                  {unreadCount}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1">
              {hasUnread && (
                <button
                  onClick={() => markAllReadMutation.mutate()}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-accent"
                  title={t("dir_notif_mark_all_read")}
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{t("dir_notif_mark_all_read")}</span>
                </button>
              )}
            </div>
          </div>

          {/* Alert list */}
          <ScrollArea className="max-h-80">
            {visibleAlerts.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p>{t("dir_notif_empty")}</p>
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {visibleAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    onClick={() => handleAlertClick(alert)}
                    className={cn(
                      "group relative flex gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-all",
                      severityBg(alert.severity),
                      !alert.isRead && "ring-1 ring-inset ring-current/20",
                      alert.link && "hover:shadow-sm"
                    )}
                  >
                    <AlertIcon type={alert.type} severity={alert.severity} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-1">
                        <p className={cn(
                          "text-xs font-medium leading-tight",
                          !alert.isRead ? "text-foreground" : "text-muted-foreground"
                        )}>
                          {alert.title}
                        </p>
                        {!alert.isRead && (
                          <span className="shrink-0 h-1.5 w-1.5 rounded-full bg-red-500 mt-1" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-snug">
                        {alert.body}
                      </p>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[10px] text-muted-foreground/70">
                          {timeAgo(alert.createdAt)}
                        </span>
                        {alert.link && (
                          <ExternalLink className="h-3 w-3 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors" />
                        )}
                      </div>
                    </div>
                    {/* Dismiss button */}
                    <button
                      onClick={(e) => handleDismiss(e, alert.id)}
                      className="absolute top-1.5 right-1.5 h-4 w-4 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 hover:bg-background/50 transition-all"
                      title={t("dir_notif_dismiss")}
                    >
                      <X className="h-3 w-3 text-muted-foreground" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Footer */}
          <div className="border-t px-4 py-2.5">
            <button
              onClick={() => { navigate("/director/notifications"); setOpen(false); }}
              className="w-full text-xs text-center text-primary hover:underline font-medium"
            >
              {t("dir_notif_view_all")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
