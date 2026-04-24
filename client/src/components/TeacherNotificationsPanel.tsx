/**
 * TeacherNotificationsPanel — Slide-over panel showing all notifications
 * for the current user, with Accept/Decline buttons for cover/payback requests.
 *
 * Used in the NavBar notification bell.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/contexts/I18nContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Clock,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

// ─── Notification type icons ──────────────────────────────────────────────────
function NotifIcon({ type }: { type: string }) {
  if (type === "cover_assigned" || type === "cover_request")
    return <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />;
  if (type === "payback_scheduled")
    return <RefreshCw className="h-4 w-4 text-blue-400 shrink-0" />;
  if (type === "register_absence")
    return <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />;
  if (type === "cover_response")
    return <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0" />;
  return <Bell className="h-4 w-4 text-muted-foreground shrink-0" />;
}

type Notif = {
  id: number;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  requiresResponse: boolean;
  response?: string | null;
  respondedAt?: Date | string | null;
  createdAt: Date | string;
};

// ─── Single notification row ──────────────────────────────────────────────────
function NotifRow({ notif, onResponded }: { notif: Notif; onResponded: () => void }) {
  const { t } = useI18n();
  const markRead = trpc.cover.markNotificationRead.useMutation();

  const respond = trpc.cover.respondToNotification.useMutation({
    onSuccess: (data) => {
      toast.success(
        data.response === "accepted"
          ? `${t("notif_accept_change")} — ${t("notif_response_sent")}`
          : `${t("notif_decline_change")} — ${t("notif_response_sent")}`
      );
      onResponded();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleRead = () => {
    if (!notif.isRead) markRead.mutate({ notificationId: notif.id });
  };

  const hasResponded = !!notif.response;

  return (
    <div
      className={`rounded-lg border p-3 space-y-2 transition-colors ${
        notif.isRead ? "border-border bg-transparent" : "border-primary/30 bg-primary/5"
      }`}
      onClick={handleRead}
    >
      {/* Header */}
      <div className="flex items-start gap-2">
        <NotifIcon type={notif.type} />
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium leading-tight ${notif.isRead ? "text-foreground" : "text-foreground"}`}>
            {notif.title}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <Clock className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              {new Date(notif.createdAt).toLocaleString()}
            </span>
            {!notif.isRead && (
              <Badge variant="outline" className="text-xs px-1 py-0 text-primary border-primary/50">
                New
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Body */}
      <p className="text-xs text-muted-foreground leading-relaxed pl-6">{notif.body}</p>

      {/* Response buttons */}
      {notif.requiresResponse && !hasResponded && (
        <div className="flex gap-2 pl-6 pt-1">
          <Button
            size="sm"
            className="text-xs h-7 px-3"
            disabled={respond.isPending}
            onClick={(e) => {
              e.stopPropagation();
              respond.mutate({ notificationId: notif.id, response: "accepted" });
            }}
          >
            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
            {t("notif_accept_change")}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-7 px-3 bg-transparent"
            disabled={respond.isPending}
            onClick={(e) => {
              e.stopPropagation();
              respond.mutate({ notificationId: notif.id, response: "declined" });
            }}
          >
            <XCircle className="h-3.5 w-3.5 mr-1" />
            {t("notif_decline_change")}
          </Button>
        </div>
      )}

      {/* Already responded */}
      {notif.requiresResponse && hasResponded && (
        <div className="pl-6 flex items-center gap-1.5 text-xs text-muted-foreground">
          {notif.response === "accepted" ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
          ) : (
            <XCircle className="h-3.5 w-3.5 text-red-400" />
          )}
          <span className="capitalize">{notif.response}</span>
          {notif.respondedAt && (
            <span>&middot; {new Date(notif.respondedAt).toLocaleString()}</span>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────
export function TeacherNotificationsPanel({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const utils = trpc.useUtils();

  const { data: notifications, isLoading, refetch } = trpc.cover.getMyNotifications.useQuery(
    { unreadOnly: false },
    { enabled: open }
  );

  const markAllRead = trpc.cover.markAllNotificationsRead.useMutation({
    onSuccess: () => {
      utils.cover.getMyNotifications.invalidate();
    },
  });

  const unreadCount = (notifications ?? []).filter((n: Notif) => !n.isRead).length;

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="pb-4 border-b border-border">
          <SheetTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              {t("notif_bell_title")}
              {unreadCount > 0 && (
                <Badge className="text-xs px-1.5 py-0">{unreadCount}</Badge>
              )}
            </span>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={() => markAllRead.mutate()}
                disabled={markAllRead.isPending}
              >
                {t("notif_mark_all_read")}
              </Button>
            )}
          </SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-2">
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
              <RefreshCw className="h-4 w-4 animate-spin" />
              Loading...
            </div>
          ) : !notifications || notifications.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Bell className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">{t("notif_no_notifications")}</p>
            </div>
          ) : (
            (notifications as Notif[]).map((n) => (
              <NotifRow
                key={n.id}
                notif={n}
                onResponded={() => {
                  utils.cover.getMyNotifications.invalidate();
                  refetch();
                }}
              />
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/**
 * NotificationBell — compact bell icon button for the NavBar.
 * Shows a red dot when there are unread notifications.
 */
export function NotificationBell() {
  const [open, setOpen] = useState(false);

  const { data: notifications } = trpc.cover.getMyNotifications.useQuery(
    { unreadOnly: true },
    { refetchInterval: 30_000 } // poll every 30s
  );

  const unreadCount = (notifications ?? []).length;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="relative p-2 rounded-full hover:bg-accent transition-colors"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5 text-foreground" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-500" />
        )}
      </button>
      <TeacherNotificationsPanel open={open} onClose={() => setOpen(false)} />
    </>
  );
}
