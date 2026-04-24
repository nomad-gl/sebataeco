/**
 * RegisterPage — Teacher class register marking UI.
 *
 * - Teacher selects a class group and date, then clicks "Mark Register".
 * - The marking teacher is automatically recorded as present.
 * - If the marking teacher is not the assigned teacher, an amber "In Absence Of" banner
 *   is shown with the date/time stamp and a note that the director has been notified.
 * - Shows the current register status for the selected group/date.
 */
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/contexts/I18nContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { AlertTriangle, CheckCircle2, ClipboardList, Clock, User } from "lucide-react";
import { toast } from "sonner";

export default function RegisterPage() {
  const { t } = useI18n();
  const { user } = useAuth();

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState(today);
  const [absenceReason, setAbsenceReason] = useState<"absent" | "sick" | "holiday" | "other">("absent");
  const [notes, setNotes] = useState("");

  // Load teacher's class groups
  const { data: groupsData } = trpc.groups.list.useQuery(undefined, {
    staleTime: 60_000,
  });

  // Load current register status for selected group/date
  const { data: registerStatus, refetch: refetchStatus } = trpc.register.getRegisterStatus.useQuery(
    { classGroupId: selectedGroupId!, lessonDate: selectedDate },
    { enabled: !!selectedGroupId }
  );

  const markRegister = trpc.register.markRegister.useMutation({
    onSuccess: (data) => {
      if (data.alreadyMarked) {
        toast.info(t("register_already_marked"));
      } else {
        toast.success(t("register_success"));
      }
      refetchStatus();
      setNotes("");
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const handleMarkRegister = () => {
    if (!selectedGroupId) return;
    markRegister.mutate({
      classGroupId: selectedGroupId,
      lessonDate: selectedDate,
      absenceReason,
      notes: notes || undefined,
    });
  };

  const isAbsence = registerStatus?.isAbsence;
  const alreadyMarked = !!registerStatus;

  return (
    <div className="container max-w-2xl py-8 space-y-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <ClipboardList className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">{t("register_page_title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("register_marked_by")}: <span className="font-medium">{user?.displayName ?? user?.name}</span>
          </p>
        </div>
      </div>

      {/* Selection card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("register_select_group")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Class group selector */}
          <div className="space-y-1.5">
            <Label>{t("register_select_group")}</Label>
            <Select
              value={selectedGroupId?.toString() ?? ""}
              onValueChange={(v) => setSelectedGroupId(Number(v))}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("register_select_group")} />
              </SelectTrigger>
              <SelectContent>
                {(groupsData ?? []).map((g: { id: number; className: string }) => (
                  <SelectItem key={g.id} value={g.id.toString()}>
                    {g.className}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date selector */}
          <div className="space-y-1.5">
            <Label>{t("register_date")}</Label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          {/* Absence reason (shown only when not already marked) */}
          {!alreadyMarked && (
            <div className="space-y-1.5">
              <Label>{t("register_absence_reason")}</Label>
              <Select
                value={absenceReason}
                onValueChange={(v) => setAbsenceReason(v as typeof absenceReason)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="absent">Absent</SelectItem>
                  <SelectItem value="sick">Sick</SelectItem>
                  <SelectItem value="holiday">Holiday</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Notes */}
          {!alreadyMarked && (
            <div className="space-y-1.5">
              <Label>{t("register_notes")}</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes..."
                rows={2}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* In-absence-of banner */}
      {alreadyMarked && isAbsence && registerStatus && (
        <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-4 space-y-2">
          <div className="flex items-center gap-2 text-amber-400 font-semibold">
            <AlertTriangle className="h-5 w-5" />
            <span>
              {t("register_in_absence_of")}: <strong>{registerStatus.assignedName}</strong>
            </span>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <User className="h-3.5 w-3.5" />
              {t("register_marked_by")}: <strong className="ml-1">{registerStatus.markerName}</strong>
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {new Date(registerStatus.markedAt).toLocaleString()}
            </span>
          </div>
          <p className="text-xs text-amber-400/80">{t("register_absence_logged")}</p>
        </div>
      )}

      {/* Already marked (present, no absence) */}
      {alreadyMarked && !isAbsence && registerStatus && (
        <div className="rounded-lg border border-green-500/50 bg-green-500/10 p-4 space-y-2">
          <div className="flex items-center gap-2 text-green-400 font-semibold">
            <CheckCircle2 className="h-5 w-5" />
            <span>{t("register_already_marked")}</span>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <User className="h-3.5 w-3.5" />
              {t("register_marked_by")}: <strong className="ml-1">{registerStatus.markerName}</strong>
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {new Date(registerStatus.markedAt).toLocaleString()}
            </span>
          </div>
          <Badge variant="outline" className="text-green-400 border-green-500/50">
            {t("register_status_present")}
          </Badge>
        </div>
      )}

      {/* Mark register button */}
      {!alreadyMarked && (
        <Button
          className="w-full"
          size="lg"
          onClick={handleMarkRegister}
          disabled={!selectedGroupId || markRegister.isPending}
        >
          {markRegister.isPending ? "Marking..." : t("register_mark_btn")}
        </Button>
      )}
    </div>
  );
}
