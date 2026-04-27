/**
 * TeacherAttendance.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Teacher self-check-in page.
 *
 * Features:
 *  - One-tap daily check-in with optional notes
 *  - Shows current check-in status for today
 *  - Advance absence notification form (with date picker + reason)
 *  - List of upcoming absence notifications and their approval status
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/contexts/I18nContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  CalendarOff,
  ClipboardCheck,
  Send,
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

function statusBadge(status: string) {
  switch (status) {
    case "present":
      return <Badge className="bg-green-500 text-white">✓ Present</Badge>;
    case "absent_alarm":
      return <Badge variant="destructive">⚠ Absent (alarm)</Badge>;
    case "absent_notified":
      return <Badge className="bg-amber-500 text-white">Notified Absent</Badge>;
    case "day_off":
      return <Badge variant="secondary">Day Off</Badge>;
    default:
      return <Badge variant="outline">Not recorded</Badge>;
  }
}

function absenceStatusBadge(status: string) {
  switch (status) {
    case "approved":
      return <Badge className="bg-green-500 text-white">Approved</Badge>;
    case "rejected":
      return <Badge variant="destructive">Rejected</Badge>;
    default:
      return <Badge variant="secondary">Pending review</Badge>;
  }
}

// ─── component ───────────────────────────────────────────────────────────────

export default function TeacherAttendance() {
  const { t } = useI18n();
  const { user } = useAuth();
  const utils = trpc.useUtils();

  // Check-in state
  const [notes, setNotes] = useState("");
  const [checkingIn, setCheckingIn] = useState(false);

  // Absence notification form
  const [absenceDate, setAbsenceDate] = useState("");
  const [absenceReason, setAbsenceReason] = useState("");
  const [submittingAbsence, setSubmittingAbsence] = useState(false);

  // Queries
  const { data: myStatus, isLoading: statusLoading } =
    trpc.teacherAttendance.getMyStatus.useQuery(undefined, {
      refetchInterval: 60_000,
    });

  const { data: myAbsences, isLoading: absencesLoading } =
    trpc.teacherAttendance.getMyAbsenceNotifications.useQuery();

  // Mutations
  const checkInMutation = trpc.teacherAttendance.checkIn.useMutation({
    onSuccess: (data) => {
      utils.teacherAttendance.getMyStatus.invalidate();
      if (data.alreadyCheckedIn) {
        toast.success(t("ta_checkin_updated"), { description: t("ta_checkin_success_desc") });
      } else {
        toast.success(t("ta_checkin_success"), { description: t("ta_checkin_success_desc") });
      }
      setNotes("");
      setCheckingIn(false);
    },
    onError: (err) => {
      toast.error(t("ta_checkin_error"), { description: err.message });
      setCheckingIn(false);
    },
  });

  const notifyAbsenceMutation = trpc.teacherAttendance.notifyAbsence.useMutation({
    onSuccess: () => {
      utils.teacherAttendance.getMyAbsenceNotifications.invalidate();
      utils.teacherAttendance.getMyStatus.invalidate();
      toast.success(t("ta_absence_submitted"), { description: t("ta_absence_submitted_desc") });
      setAbsenceDate("");
      setAbsenceReason("");
      setSubmittingAbsence(false);
    },
    onError: (err) => {
      toast.error(t("ta_absence_error"), { description: err.message });
      setSubmittingAbsence(false);
    },
  });

  const handleCheckIn = () => {
    setCheckingIn(true);
    checkInMutation.mutate({ notes: notes.trim() || undefined });
  };

  const handleNotifyAbsence = () => {
    if (!absenceDate) {
      toast.error(t("ta_absence_date_required"));
      return;
    }
    if (absenceReason.trim().length < 5) {
      toast.error(t("ta_absence_reason_required"));
      return;
    }
    setSubmittingAbsence(true);
    notifyAbsenceMutation.mutate({ absenceDate, reason: absenceReason.trim() });
  };

  const today = todayStr();
  const isCheckedIn = myStatus?.record?.status === "present";
  const hasAbsenceToday = !!myStatus?.absenceNotification;

  return (
    <div className="container max-w-2xl py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <ClipboardCheck className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">{t("ta_title")}</h1>
          <p className="text-sm text-muted-foreground">{formatDate(today)}</p>
        </div>
      </div>

      {/* Today's status card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" />
            {t("ta_today_status")}
          </CardTitle>
          {user?.name && (
            <p className="text-sm text-muted-foreground -mt-1">{user.name}</p>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {statusLoading ? (
            <p className="text-sm text-muted-foreground">{t("ta_loading")}</p>
          ) : (
            <>
              <div className="flex items-center gap-3">
                {isCheckedIn ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : hasAbsenceToday ? (
                  <CalendarOff className="h-5 w-5 text-amber-500" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-muted-foreground" />
                )}
                <div>
                  {myStatus?.record
                    ? statusBadge(myStatus.record.status)
                    : hasAbsenceToday
                    ? <Badge className="bg-amber-500 text-white">{t("ta_absence_notified")}</Badge>
                    : <Badge variant="outline">{t("ta_not_checked_in")}</Badge>}
                  {myStatus?.record?.checkInAt && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {t("ta_checked_in_at")}{" "}
                      {new Date(myStatus.record.checkInAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  )}
                  {myStatus?.absenceNotification && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {t("ta_absence_reason_label")}: {myStatus.absenceNotification.reason}
                      {" · "}
                      {absenceStatusBadge(myStatus.absenceNotification.absenceStatus)}
                    </p>
                  )}
                </div>
              </div>

              {/* Check-in form — only show if not already present */}
              {!isCheckedIn && !hasAbsenceToday && (
                <div className="space-y-3 pt-2">
                  <div>
                    <Label htmlFor="notes" className="text-sm">
                      {t("ta_notes_label")}
                    </Label>
                    <Textarea
                      id="notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder={t("ta_notes_placeholder")}
                      rows={2}
                      className="mt-1 resize-none"
                    />
                  </div>
                  <Button
                    onClick={handleCheckIn}
                    disabled={checkingIn}
                    className="w-full"
                    size="lg"
                  >
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    {checkingIn ? t("ta_checking_in") : t("ta_checkin_btn")}
                  </Button>
                </div>
              )}

              {/* Already checked in — allow updating notes */}
              {isCheckedIn && (
                <div className="space-y-3 pt-2">
                  <div>
                    <Label htmlFor="notes-update" className="text-sm">
                      {t("ta_update_notes_label")}
                    </Label>
                    <Textarea
                      id="notes-update"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder={myStatus?.record?.notes ?? t("ta_notes_placeholder")}
                      rows={2}
                      className="mt-1 resize-none"
                    />
                  </div>
                  <Button
                    onClick={handleCheckIn}
                    disabled={checkingIn}
                    variant="outline"
                    size="sm"
                  >
                    {checkingIn ? t("ta_updating") : t("ta_update_btn")}
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Separator />

      {/* Absence notification form */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarOff className="h-4 w-4" />
            {t("ta_notify_absence_title")}
          </CardTitle>
          <p className="text-sm text-muted-foreground">{t("ta_notify_absence_desc")}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="absence-date" className="text-sm">
                {t("ta_absence_date_label")}
              </Label>
              <Input
                id="absence-date"
                type="date"
                value={absenceDate}
                min={today}
                onChange={(e) => setAbsenceDate(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="sm:col-span-1">
              <Label htmlFor="absence-reason" className="text-sm">
                {t("ta_absence_reason_label")}
              </Label>
              <Textarea
                id="absence-reason"
                value={absenceReason}
                onChange={(e) => setAbsenceReason(e.target.value)}
                placeholder={t("ta_absence_reason_placeholder")}
                rows={2}
                className="mt-1 resize-none"
              />
            </div>
          </div>
          <Button
            onClick={handleNotifyAbsence}
            disabled={submittingAbsence || !absenceDate || absenceReason.trim().length < 5}
            variant="outline"
            className="w-full"
          >
            <Send className="h-4 w-4 mr-2" />
            {submittingAbsence ? t("ta_submitting") : t("ta_submit_absence_btn")}
          </Button>
        </CardContent>
      </Card>

      {/* My absence notifications history */}
      {!absencesLoading && myAbsences && myAbsences.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t("ta_my_absences_title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {myAbsences.map((a) => (
                <div
                  key={a.id}
                  className="flex items-start justify-between gap-2 p-3 rounded-lg border bg-muted/30"
                >
                  <div>
                    <p className="text-sm font-medium">{formatDate(String(a.absenceDate))}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{a.reason}</p>
                    {a.reviewNote && (
                      <p className="text-xs text-muted-foreground italic mt-0.5">
                        {t("ta_review_note")}: {a.reviewNote}
                      </p>
                    )}
                  </div>
                  {absenceStatusBadge(a.absenceStatus as string)}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
