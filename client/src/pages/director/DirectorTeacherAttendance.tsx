/**
 * DirectorTeacherAttendance.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Daily Teacher Attendance Register for Directors and Heads of Study.
 *
 * Features:
 *  - Live register table: all teachers + today's status (present / absent / notified)
 *  - Date picker to browse historical registers
 *  - Absence notification review (approve / reject)
 *  - Daily comments log with add-comment form
 *  - Popup alarm for unacknowledged 09:00 alarms
 *  - Manual alarm trigger (for testing / manual check)
 */

import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/contexts/I18nContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  ClipboardList,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  CalendarOff,
  MessageSquare,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  BellOff,
} from "lucide-react";

// ─── helpers ─────────────────────────────────────────────────────────────────

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "present":
      return (
        <Badge className="bg-green-500 text-white gap-1">
          <CheckCircle2 className="h-3 w-3" /> Present
        </Badge>
      );
    case "absent_alarm":
      return (
        <Badge variant="destructive" className="gap-1">
          <AlertTriangle className="h-3 w-3" /> Absent ⚠
        </Badge>
      );
    case "absent_notified":
      return (
        <Badge className="bg-amber-500 text-white gap-1">
          <CalendarOff className="h-3 w-3" /> Notified Absent
        </Badge>
      );
    case "day_off":
      return <Badge variant="secondary">Day Off</Badge>;
    default:
      return (
        <Badge variant="outline" className="gap-1 text-muted-foreground">
          <Clock className="h-3 w-3" /> Not recorded
        </Badge>
      );
  }
}

function AbsenceStatusBadge({ status }: { status: string }) {
  switch (status) {
    case "approved":
      return <Badge className="bg-green-500 text-white text-xs">Approved</Badge>;
    case "rejected":
      return <Badge variant="destructive" className="text-xs">Rejected</Badge>;
    default:
      return <Badge variant="secondary" className="text-xs">Pending</Badge>;
  }
}

// ─── component ───────────────────────────────────────────────────────────────

export default function DirectorTeacherAttendance() {
  const { t } = useI18n();
  const utils = trpc.useUtils();

  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [newComment, setNewComment] = useState("");
  const [addingComment, setAddingComment] = useState(false);
  const [alarmDialogOpen, setAlarmDialogOpen] = useState(false);
  const [reviewingId, setReviewingId] = useState<number | null>(null);
  const [reviewNote, setReviewNote] = useState("");

  const isToday = selectedDate === todayStr();

  // ── queries ──────────────────────────────────────────────────────────────

  const { data: register, isLoading: registerLoading, refetch: refetchRegister } =
    trpc.teacherAttendance.getRegister.useQuery(
      { date: selectedDate },
      { refetchInterval: isToday ? 60_000 : false }
    );

  const { data: comments, refetch: refetchComments } =
    trpc.teacherAttendance.getDailyComments.useQuery(
      { date: selectedDate },
      { refetchInterval: isToday ? 30_000 : false }
    );

  const { data: alarms, refetch: refetchAlarms } =
    trpc.teacherAttendance.getUnacknowledgedAlarms.useQuery(undefined, {
      refetchInterval: isToday ? 30_000 : false,
    });

  // Show alarm dialog whenever there are unacknowledged alarms
  useEffect(() => {
    if (alarms && alarms.length > 0) {
      setAlarmDialogOpen(true);
    }
  }, [alarms]);

  // ── mutations ─────────────────────────────────────────────────────────────

  const addCommentMutation = trpc.teacherAttendance.addDailyComment.useMutation({
    onSuccess: () => {
      refetchComments();
      setNewComment("");
      setAddingComment(false);
      toast.success(t("ta_comment_added"));
    },
    onError: (err) => toast.error(err.message),
  });

  const reviewMutation = trpc.teacherAttendance.reviewAbsenceNotification.useMutation({
    onSuccess: (_, vars) => {
      refetchRegister();
      setReviewingId(null);
      setReviewNote("");
      toast.success(
        vars.decision === "approved" ? t("ta_absence_approved") : t("ta_absence_rejected")
      );
    },
    onError: (err) => toast.error(err.message),
  });

  const ackAllMutation = trpc.teacherAttendance.acknowledgeAllAlarms.useMutation({
    onSuccess: () => {
      refetchAlarms();
      setAlarmDialogOpen(false);
      toast.success(t("ta_alarms_dismissed"));
    },
    onError: (err) => toast.error(err.message),
  });

  const triggerAlarmMutation = trpc.teacherAttendance.triggerAlarmCheck.useMutation({
    onSuccess: (data) => {
      refetchRegister();
      refetchComments();
      refetchAlarms();
      toast.success(`${t("ta_alarm_triggered")}: ${data.alarmsCreated} ${t("ta_alarm_new")}`);
    },
    onError: (err) => toast.error(err.message),
  });

  // ── derived data ──────────────────────────────────────────────────────────

  const teachers = register?.teachers ?? [];
  const records = register?.records ?? [];
  const absenceNotifications = register?.absenceNotifications ?? [];

  // Build a map: userId → { record, absenceNotification }
  type TeacherRow = {
    id: number;
    name: string | null;
    displayName: string | null;
    email: string | null;
    position: string;
    role: string;
    status: string;
    checkInAt: Date | null;
    notes: string | null;
    absenceNotification: (typeof absenceNotifications)[0] | null;
  };

  const rows: TeacherRow[] = teachers.map((teacher) => {
    const record = records.find((r) => r.userId === teacher.id);
    const absenceNote = absenceNotifications.find((n) => n.userId === teacher.id);
    return {
      ...teacher,
      status: record?.status ?? (absenceNote ? "absent_notified" : "not_recorded"),
      checkInAt: record?.checkInAt ?? null,
      notes: record?.notes ?? null,
      absenceNotification: absenceNote ?? null,
    };
  });

  const presentCount = rows.filter((r) => r.status === "present").length;
  const absentAlarmCount = rows.filter((r) => r.status === "absent_alarm").length;
  const notifiedCount = rows.filter((r) => r.absenceNotification).length;

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div className="container max-w-5xl py-8 space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <ClipboardList className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">{t("ta_register_title")}</h1>
            <p className="text-sm text-muted-foreground">{formatDate(selectedDate)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Date navigation */}
          <Button
            variant="outline"
            size="icon"
            onClick={() => setSelectedDate((d) => shiftDate(d, -1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Input
            type="date"
            value={selectedDate}
            max={todayStr()}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-36"
          />
          <Button
            variant="outline"
            size="icon"
            onClick={() => setSelectedDate((d) => shiftDate(d, 1))}
            disabled={selectedDate >= todayStr()}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => { refetchRegister(); refetchComments(); refetchAlarms(); }}
            title={t("ta_refresh")}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          {isToday && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => triggerAlarmMutation.mutate({ date: selectedDate })}
              disabled={triggerAlarmMutation.isPending}
              className="gap-1 text-amber-600 border-amber-300 hover:bg-amber-50"
            >
              <AlertTriangle className="h-4 w-4" />
              {t("ta_run_alarm_check")}
            </Button>
          )}
        </div>
      </div>

      {/* ── Summary stats ── */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="text-center p-4">
          <p className="text-2xl font-bold text-green-600">{presentCount}</p>
          <p className="text-xs text-muted-foreground mt-1">{t("ta_stat_present")}</p>
        </Card>
        <Card className="text-center p-4">
          <p className="text-2xl font-bold text-red-500">{absentAlarmCount}</p>
          <p className="text-xs text-muted-foreground mt-1">{t("ta_stat_absent_alarm")}</p>
        </Card>
        <Card className="text-center p-4">
          <p className="text-2xl font-bold text-amber-500">{notifiedCount}</p>
          <p className="text-xs text-muted-foreground mt-1">{t("ta_stat_notified")}</p>
        </Card>
      </div>

      {/* ── Register table ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t("ta_register_table_title")}</CardTitle>
        </CardHeader>
        <CardContent>
          {registerLoading ? (
            <p className="text-sm text-muted-foreground py-4 text-center">{t("ta_loading")}</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">{t("ta_no_teachers")}</p>
          ) : (
            <div className="space-y-2">
              {rows.map((row) => (
                <div
                  key={row.id}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-lg border ${
                    row.status === "absent_alarm"
                      ? "border-red-200 bg-red-50 dark:bg-red-950/20"
                      : row.status === "present"
                      ? "border-green-200 bg-green-50 dark:bg-green-950/20"
                      : "bg-muted/20"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">
                      {row.displayName ?? row.name ?? row.email}
                    </p>
                    {row.checkInAt && (
                      <p className="text-xs text-muted-foreground">
                        {t("ta_checked_in_at")}{" "}
                        {new Date(row.checkInAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        {row.notes && ` · ${row.notes}`}
                      </p>
                    )}
                    {row.absenceNotification && (
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <AbsenceStatusBadge status={row.absenceNotification.absenceStatus} />
                        <span className="text-xs text-muted-foreground">
                          {row.absenceNotification.reason}
                        </span>
                        {row.absenceNotification.absenceStatus === "pending" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 text-xs px-2"
                            onClick={() => setReviewingId(row.absenceNotification!.id)}
                          >
                            {t("ta_review")}
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                  <StatusBadge status={row.status} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Separator />

      {/* ── Daily comments log ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            {t("ta_daily_comments_title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Existing comments */}
          {comments && comments.length > 0 ? (
            <div className="space-y-2">
              {comments.map((c) => (
                <div
                  key={c.id}
                  className={`p-3 rounded-lg border text-sm ${
                    c.isAlarm
                      ? "border-red-200 bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-300"
                      : "bg-muted/30"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {c.isAlarm && <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-red-500" />}
                    <div className="flex-1">
                      <p>{c.comment}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(c.createdAt!).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        {c.isAlarm && !c.acknowledged && (
                          <span className="ml-2 text-amber-600 font-medium">
                            {t("ta_unacknowledged")}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t("ta_no_comments")}</p>
          )}

          {/* Add comment form */}
          <div className="space-y-2 pt-2">
            <Label htmlFor="new-comment" className="text-sm">
              {t("ta_add_comment_label")}
            </Label>
            <Textarea
              id="new-comment"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder={t("ta_add_comment_placeholder")}
              rows={2}
              className="resize-none"
            />
            <Button
              size="sm"
              onClick={() => {
                if (!newComment.trim()) return;
                setAddingComment(true);
                addCommentMutation.mutate({
                  date: selectedDate,
                  comment: newComment.trim(),
                });
              }}
              disabled={addingComment || !newComment.trim()}
            >
              {addingComment ? t("ta_submitting") : t("ta_add_comment_btn")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Alarm popup dialog ── */}
      <Dialog open={alarmDialogOpen} onOpenChange={setAlarmDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              {t("ta_alarm_dialog_title")}
            </DialogTitle>
            <DialogDescription>{t("ta_alarm_dialog_desc")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {alarms?.map((alarm) => (
              <div
                key={alarm.id}
                className="p-3 rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 text-sm text-red-700 dark:text-red-300"
              >
                <AlertTriangle className="h-4 w-4 inline mr-2" />
                {alarm.comment}
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAlarmDialogOpen(false)}
              className="gap-1"
            >
              <BellOff className="h-4 w-4" />
              {t("ta_alarm_dismiss_later")}
            </Button>
            <Button
              onClick={() => ackAllMutation.mutate()}
              disabled={ackAllMutation.isPending}
              className="gap-1 bg-red-600 hover:bg-red-700 text-white"
            >
              <CheckCircle2 className="h-4 w-4" />
              {t("ta_alarm_acknowledge_all")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Absence review dialog ── */}
      <Dialog open={reviewingId !== null} onOpenChange={(open) => { if (!open) { setReviewingId(null); setReviewNote(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("ta_review_absence_title")}</DialogTitle>
            <DialogDescription>{t("ta_review_absence_desc")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label htmlFor="review-note" className="text-sm">{t("ta_review_note_label")}</Label>
            <Textarea
              id="review-note"
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
              placeholder={t("ta_review_note_placeholder")}
              rows={2}
              className="resize-none"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              className="gap-1 text-red-600 border-red-200 hover:bg-red-50"
              onClick={() =>
                reviewMutation.mutate({
                  notificationId: reviewingId!,
                  decision: "rejected",
                  reviewNote: reviewNote.trim() || undefined,
                })
              }
              disabled={reviewMutation.isPending}
            >
              <XCircle className="h-4 w-4" />
              {t("ta_reject")}
            </Button>
            <Button
              className="gap-1 bg-green-600 hover:bg-green-700 text-white"
              onClick={() =>
                reviewMutation.mutate({
                  notificationId: reviewingId!,
                  decision: "approved",
                  reviewNote: reviewNote.trim() || undefined,
                })
              }
              disabled={reviewMutation.isPending}
            >
              <CheckCircle2 className="h-4 w-4" />
              {t("ta_approve")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
