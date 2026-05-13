import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Bell, CheckCircle, Trash2, MailOpen } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
// Toast notifications removed - use-toast not available
import { useAuth } from "@/contexts/AuthContext";
import { Pagination } from "@/components/ui/pagination";

type NotificationType = "profile_update" | "subject_assignment" | "schedule_change" | "assignment_history" | "general";

const notificationTypeConfig: Record<NotificationType, { icon: React.ReactNode; color: string; label: string }> = {
  profile_update: { icon: <AlertCircle className="w-4 h-4" />, color: "bg-blue-100 text-blue-800", label: "Profile Update" },
  subject_assignment: { icon: <CheckCircle className="w-4 h-4" />, color: "bg-green-100 text-green-800", label: "Subject Assignment" },
  schedule_change: { icon: <AlertCircle className="w-4 h-4" />, color: "bg-yellow-100 text-yellow-800", label: "Schedule Change" },
  assignment_history: { icon: <Bell className="w-4 h-4" />, color: "bg-purple-100 text-purple-800", label: "Assignment History" },
  general: { icon: <Bell className="w-4 h-4" />, color: "bg-gray-100 text-gray-800", label: "General" },
};

export default function TeacherNotifications() {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [unreadOnly, setUnreadOnly] = useState(false);

  const { data: notificationsData, isLoading, refetch } = trpc.teacherNotifications.getNotifications.useQuery({
    page,
    limit: 10,
    unreadOnly,
  });

  const { data: unreadCount } = trpc.teacherNotifications.getUnreadCount.useQuery();

  const markAsReadMutation = trpc.teacherNotifications.markAsRead.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  const markAllAsReadMutation = trpc.teacherNotifications.markAllAsRead.useMutation({
    onSuccess: () => {
      refetch();
      console.log("All notifications marked as read");
    },
  });

  const deleteNotificationMutation = trpc.teacherNotifications.deleteNotification.useMutation({
    onSuccess: () => {
      refetch();
      console.log("Notification deleted");
    },
  });

  const clearAllMutation = trpc.teacherNotifications.clearAll.useMutation({
    onSuccess: () => {
      refetch();
      console.log("All notifications cleared");
    },
  });

  if (!user) {
    return <div className="text-center py-8">Please log in to view notifications</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Bell className="w-8 h-8" />
            <h1 className="text-3xl font-bold">Notifications</h1>
            {unreadCount && unreadCount > 0 && (
              <Badge className="bg-red-500">{unreadCount} unread</Badge>
            )}
          </div>
          <div className="flex gap-2">
            {unreadCount && unreadCount > 0 && (
              <Button
                variant="outline"
                onClick={() => markAllAsReadMutation.mutate()}
                disabled={markAllAsReadMutation.isPending}
              >
                <MailOpen className="w-4 h-4 mr-2" />
                Mark All Read
              </Button>
            )}
            <Button
              variant="destructive"
              onClick={() => clearAllMutation.mutate()}
              disabled={clearAllMutation.isPending}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Clear All
            </Button>
          </div>
        </div>

        {/* Filter */}
        <div className="mb-6">
          <Button
            variant={unreadOnly ? "default" : "outline"}
            onClick={() => {
              setUnreadOnly(!unreadOnly);
              setPage(1);
            }}
          >
            {unreadOnly ? "Showing Unread" : "Show Unread"}
          </Button>
        </div>

        {/* Notifications List */}
        <div className="space-y-4">
          {isLoading ? (
            <div className="text-center py-8">Loading notifications...</div>
          ) : notificationsData?.notifications.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No notifications yet
            </div>
          ) : (
            notificationsData?.notifications.map((notification) => {
              const config = notificationTypeConfig[notification.notification_type as NotificationType];
              return (
                <Card
                  key={notification.id}
                  className={`p-4 ${!notification.is_read ? "border-l-4 border-blue-500 bg-blue-50 dark:bg-blue-950" : ""}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`p-2 rounded ${config.color}`}>
                          {config.icon}
                        </div>
                        <h3 className="font-semibold">{notification.title}</h3>
                        <Badge variant="secondary">{config.label}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        {notification.message}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {!notification.is_read && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => markAsReadMutation.mutate({ notificationId: notification.id })}
                          disabled={markAsReadMutation.isPending}
                        >
                          Mark Read
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteNotificationMutation.mutate({ notificationId: notification.id })}
                        disabled={deleteNotificationMutation.isPending}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </div>

        {/* Pagination */}
        {notificationsData && notificationsData.pages > 1 && (
          <div className="flex justify-center gap-2 mt-8">
            <Button
              variant="outline"
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
            >
              Previous
            </Button>
            <div className="flex items-center gap-2">
              {Array.from({ length: notificationsData.pages }, (_, i) => i + 1).map((p) => (
                <Button
                  key={p}
                  variant={p === page ? "default" : "outline"}
                  onClick={() => setPage(p)}
                  size="sm"
                >
                  {p}
                </Button>
              ))}
            </div>
            <Button
              variant="outline"
              onClick={() => setPage(Math.min(notificationsData.pages, page + 1))}
              disabled={page === notificationsData.pages}
            >
              Next
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
