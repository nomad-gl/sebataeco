/**
 * DirectorCoverRequests — Director's cover management hub.
 *
 * Shows:
 *  - All absence events (registers marked in absence of assigned teacher)
 *  - AI-ranked cover teacher candidates for each unresolved absence
 *  - Cover confirmation dialog
 *  - Payback opportunity panel (after cover is confirmed)
 */
import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/contexts/I18nContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  RefreshCw,
  Sparkles,
  User,
  Users,
} from "lucide-react";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────
type AbsenceRow = {
  id: number;
  classGroupId: number;
  lessonDate: unknown;
  assignedTeacherId: number;
  markedByTeacherId: number;
  markedAt: Date | string;
  isAbsence: boolean;
  absenceReason?: string | null;
  notes?: string | null;
  tenantId: number;
  className: string;
  assignedName: string;
  markerName: string;
  hasCover: boolean;
  coverAssignment: { id: number; coverTeacherId: number; status: string; deadlineAt?: Date | string | null; escalationSentAt?: Date | string | null } | null;
};

type CoverCandidate = {
  teacherId: number;
  tier: 1 | 2 | 3;
  reason: string;
  teacherName: string;
};

// ─── Cover Confirmation Dialog ────────────────────────────────────────────────
function CoverConfirmDialog({
  registerId,
  className,
  assignedName,
  lessonDate,
  onClose,
  onConfirmed,
}: {
  registerId: number;
  className: string;
  assignedName: string;
  lessonDate: string;
  onClose: () => void;
  onConfirmed: () => void;
}) {
  const { t } = useI18n();
  const [selectedTeacherId, setSelectedTeacherId] = useState<number | null>(null);
  const [directorComment, setDirectorComment] = useState("");

  const { data: candidatesData, isLoading: loadingCandidates } =
    trpc.cover.findCoverCandidates.useQuery({ registerId });

  const assignCover = trpc.cover.assignCover.useMutation({
    onSuccess: () => {
      toast.success(`${t("cover_assigned_success")} — ${t("cover_director_notified")}`);
      onConfirmed();
    },
    onError: (err) => toast.error(err.message),
  });

  const tierLabel = (tier: 1 | 2 | 3) => {
    if (tier === 1) return t("cover_tier_1");
    if (tier === 2) return t("cover_tier_2");
    return t("cover_tier_3");
  };

  const tierColor = (tier: 1 | 2 | 3) => {
    if (tier === 1) return "border-green-500/50 bg-green-500/10";
    if (tier === 2) return "border-blue-500/50 bg-blue-500/10";
    return "border-slate-500/50 bg-slate-500/10";
  };

  const tierBadgeColor = (tier: 1 | 2 | 3) => {
    if (tier === 1) return "text-green-400 border-green-500/50";
    if (tier === 2) return "text-blue-400 border-blue-500/50";
    return "text-slate-400 border-slate-500/50";
  };

  const candidates: CoverCandidate[] = candidatesData?.candidates ?? [];
  const selectedCandidate = candidates.find((c) => c.teacherId === selectedTeacherId);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            {t("cover_confirm_title")}
          </DialogTitle>
        </DialogHeader>

        {/* Context */}
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm space-y-1">
          <p>
            <span className="text-muted-foreground">{t("register_assigned_teacher")}:</span>{" "}
            <strong>{assignedName}</strong>
          </p>
          <p>
            <span className="text-muted-foreground">Class:</span> <strong>{className}</strong>
          </p>
          <p>
            <span className="text-muted-foreground">{t("register_date")}:</span>{" "}
            <strong>{lessonDate}</strong>
          </p>
          {candidatesData && (
            <p className="text-xs text-muted-foreground">
              {t("cover_slot_info")}: {candidatesData.slotStart}–{candidatesData.slotEnd} &middot;{" "}
              {candidatesData.subject}
            </p>
          )}
        </div>

        {/* Candidates list */}
        {loadingCandidates ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <Sparkles className="h-4 w-4 text-primary" />
            AI is ranking available teachers...
          </div>
        ) : candidates.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">{t("cover_no_candidates")}</p>
        ) : (
          <div className="space-y-2">
            {candidates.map((c) => (
              <button
                key={c.teacherId}
                onClick={() => setSelectedTeacherId(c.teacherId)}
                className={`w-full text-left rounded-lg border p-3 transition-all ${tierColor(c.tier)} ${
                  selectedTeacherId === c.teacherId
                    ? "ring-2 ring-primary"
                    : "hover:ring-1 hover:ring-primary/50"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-sm">{c.teacherName}</span>
                  <Badge variant="outline" className={`text-xs ${tierBadgeColor(c.tier)}`}>
                    {tierLabel(c.tier)}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{c.reason}</p>
              </button>
            ))}
          </div>
        )}

        {/* Director comment */}
        <div className="space-y-1.5">
          <Label className="text-sm">{t("hour_adj_comment")} (optional)</Label>
          <Textarea
            value={directorComment}
            onChange={(e) => setDirectorComment(e.target.value)}
            placeholder="Add a note about this cover arrangement..."
            rows={2}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!selectedTeacherId || assignCover.isPending}
            onClick={() => {
              if (!selectedTeacherId) return;
              assignCover.mutate({
                registerId,
                coverTeacherId: selectedTeacherId,
                aiReasoning: selectedCandidate?.reason,
                directorComment: directorComment || undefined,
              });
            }}
          >
            {assignCover.isPending ? "Assigning..." : t("cover_assign_btn")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Payback Panel ────────────────────────────────────────────────────────────
function PaybackPanel({ coverAssignmentId }: { coverAssignmentId: number }) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const [schedulingPayback, setSchedulingPayback] = useState(false);

  const { data: payback, isLoading } = trpc.cover.findPaybackOpportunity.useQuery(
    { coverAssignmentId },
    { enabled: expanded }
  );

  const schedulePayback = trpc.cover.schedulePayback.useMutation({
    onSuccess: () => {
      toast.success(t("payback_opportunity_found"));
      setSchedulingPayback(false);
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <div className="mt-2">
      <button
        onClick={() => setExpanded((p) => !p)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        <Sparkles className="h-3.5 w-3.5 text-primary" />
        {t("payback_title")}
      </button>

      {expanded && (
        <div className="mt-2 rounded-md border border-border p-3 text-sm space-y-2">
          {isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              Scanning calendar for payback opportunity...
            </div>
          ) : !payback ? null : !payback.paybackAvailable ? (
            <p className="text-muted-foreground text-xs">
              {payback.reason === "under_hours"
                ? t("payback_under_hours_note")
                : payback.message ?? t("payback_no_opportunity")}
            </p>
          ) : (
            <div className="space-y-2">
              <p className="text-green-400 font-medium text-xs flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {t("payback_opportunity_found")}
              </p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <span className="text-muted-foreground">{t("payback_day")}:</span>
                <span className="font-medium capitalize">{payback.dayOfWeek}</span>
                <span className="text-muted-foreground">{t("payback_slot")}:</span>
                <span className="font-medium">{payback.lessonSlot}</span>
                <span className="text-muted-foreground">{t("payback_subject")}:</span>
                <span className="font-medium">{payback.subject}</span>
              </div>
              <p className="text-xs text-muted-foreground italic">{payback.reasoning}</p>
              <Button
                size="sm"
                variant="outline"
                className="w-full text-xs"
                disabled={schedulePayback.isPending || schedulingPayback}
                onClick={() => {
                  if (!payback.paybackAvailable) return;
                  setSchedulingPayback(true);
                  schedulePayback.mutate({
                    originalCoverAssignmentId: coverAssignmentId,
                    dayOfWeek: payback.dayOfWeek!,
                    lessonSlot: payback.lessonSlot!,
                    startTime: payback.startTime!,
                    endTime: payback.endTime!,
                    subject: payback.subject!,
                  });
                }}
              >
                {schedulePayback.isPending ? "Scheduling..." : t("payback_schedule_btn")}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function DirectorCoverRequests() {
  const { t } = useI18n();
  const [confirmingRegisterId, setConfirmingRegisterId] = useState<number | null>(null);
  const [escalationCount, setEscalationCount] = useState(0);
  const utils = trpc.useUtils();

  const { data: pendingCovers, isLoading, refetch } = trpc.cover.listPendingCovers.useQuery();
  const checkDeadlines = trpc.cover.checkExpiredDeadlines.useMutation({
    onSuccess: (result) => {
      if (result.escalated > 0) {
        setEscalationCount(prev => prev + result.escalated);
        refetch();
        toast.warning(t("cover_deadline_escalated").replace("{n}", String(result.escalated)));
      }
    },
  });

  // Poll for expired deadlines every 5 minutes
  useEffect(() => {
    checkDeadlines.mutate();
    const interval = setInterval(() => checkDeadlines.mutate(), 5 * 60 * 1000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const confirmingRow = pendingCovers?.find((r) => r.id === confirmingRegisterId);

  return (
    <div className="container max-w-3xl py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-7 w-7 text-amber-400" />
          <div>
            <h1 className="text-2xl font-bold">{t("cover_requests_title")}</h1>
            <p className="text-sm text-muted-foreground">
              Absence log &amp; AI-assisted cover assignment
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-1.5" />
          Refresh
        </Button>
      </div>

      {/* Escalation banner */}
      {escalationCount > 0 && (
        <div className="rounded-lg border border-red-500/40 bg-red-950/20 p-3 flex items-center gap-3 text-sm">
          <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
          <p className="text-red-300">
            {t("cover_deadline_escalated").replace("{n}", String(escalationCount))}
          </p>
          <Button size="sm" variant="outline" className="ml-auto text-xs" onClick={() => setEscalationCount(0)}>
            Dismiss
          </Button>
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading...</div>
      ) : !pendingCovers || pendingCovers.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <CheckCircle2 className="h-10 w-10 mx-auto mb-3 text-green-400/50" />
            <p>No absence events recorded.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {(pendingCovers as AbsenceRow[]).map((row) => (
            <Card key={row.id} className="overflow-hidden">
              <CardContent className="p-4 space-y-3">
                {/* Row header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-0.5">
                    <p className="font-semibold text-sm">{row.className}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <User className="h-3.5 w-3.5" />
                        {t("register_in_absence_of")}: <strong className="ml-1 text-amber-400">{row.assignedName}</strong>
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {new Date(row.markedAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Marked by: <strong>{row.markerName}</strong>
                      {row.absenceReason && (
                        <> &middot; <span className="capitalize">{row.absenceReason}</span></>
                      )}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    {row.hasCover ? (
                      <Badge variant="outline" className="text-green-400 border-green-500/50 text-xs">
                        {t("cover_covered_badge")}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-amber-400 border-amber-500/50 text-xs">
                        {t("cover_pending_badge")}
                      </Badge>
                    )}
                    {!row.hasCover && (
                      <Button
                        size="sm"
                        className="text-xs"
                        onClick={() => setConfirmingRegisterId(row.id)}
                      >
                        {t("cover_confirm_title")}
                      </Button>
                    )}
                    {row.hasCover && row.coverAssignment?.deadlineAt && !row.coverAssignment?.escalationSentAt && (() => {
                      const deadline = new Date(row.coverAssignment!.deadlineAt as string);
                      const remaining = deadline.getTime() - Date.now();
                      if (remaining > 0) {
                        const mins = Math.ceil(remaining / 60000);
                        return (
                          <span className="flex items-center gap-1 text-xs text-amber-400">
                            <Clock className="h-3 w-3" />
                            {t("cover_deadline_remaining").replace("{n}", String(mins))}
                          </span>
                        );
                      }
                      return (
                        <Badge variant="outline" className="text-red-400 border-red-500/50 text-xs">
                          {t("cover_deadline_expired")}
                        </Badge>
                      );
                    })()}
                  </div>
                </div>

                {/* Notes */}
                {row.notes && (
                  <p className="text-xs text-muted-foreground border-t border-border pt-2 italic">
                    {row.notes}
                  </p>
                )}

                {/* Payback panel (shown when cover is confirmed) */}
                {row.hasCover && row.coverAssignment && (
                  <PaybackPanel coverAssignmentId={row.coverAssignment.id} />
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Cover confirmation dialog */}
      {confirmingRegisterId && confirmingRow && (
        <CoverConfirmDialog
          registerId={confirmingRegisterId}
          className={confirmingRow.className}
          assignedName={confirmingRow.assignedName}
          lessonDate={String(confirmingRow.lessonDate)}
          onClose={() => setConfirmingRegisterId(null)}
          onConfirmed={() => {
            setConfirmingRegisterId(null);
            utils.cover.listPendingCovers.invalidate();
          }}
        />
      )}
    </div>
  );
}
