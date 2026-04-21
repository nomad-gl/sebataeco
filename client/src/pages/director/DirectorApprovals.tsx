import { useState } from "react";
import { CheckCircle2, XCircle, ClipboardList } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { useI18n } from "@/contexts/I18nContext";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface PendingRequest {
  id: number;
  targetUserId: number;
  targetUserName: string | null;
  targetUserEmail: string | null;
  requestedByName: string | null;
  requestedByEmail: string | null;
  tenantName?: string | null;
  requestNote: string | null;
  createdAt: Date | number;
  requestedByUserId: number;
  tenantId: number;
}

export default function DirectorApprovals() {
  const { t } = useI18n();
  const utils = trpc.useUtils();

  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const { data: pendingRequests = [], isLoading } = trpc.assignmentRequests.listPending.useQuery();

  const approveMutation = trpc.assignmentRequests.approve.useMutation({
    onSuccess: () => {
      toast.success(t("dir_approvals_approved_toast"));
      utils.assignmentRequests.listPending.invalidate();
      utils.tenants.list.invalidate();
      utils.tenants.listUnassignedUsers.invalidate();
    },
    onError: (err: { message: string }) => toast.error(err.message),
  });

  const rejectMutation = trpc.assignmentRequests.reject.useMutation({
    onSuccess: () => {
      toast.success(t("dir_approvals_rejected_toast"));
      setRejectDialogOpen(false);
      setRejectionReason("");
      setRejectingId(null);
      utils.assignmentRequests.listPending.invalidate();
    },
    onError: (err: { message: string }) => toast.error(err.message),
  });

  const openRejectDialog = (id: number) => {
    setRejectingId(id);
    setRejectionReason("");
    setRejectDialogOpen(true);
  };

  const confirmReject = () => {
    if (!rejectingId) return;
    rejectMutation.mutate({ requestId: rejectingId, reason: rejectionReason.trim() || undefined });
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/10">
            <ClipboardList className="w-6 h-6 text-amber-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t("dir_approvals")}</h1>
            <p className="text-sm text-muted-foreground">{t("dir_approvals_desc")}</p>
          </div>
        </div>

        {/* Pending requests */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              {t("dir_approvals_pending")}
              {pendingRequests.length > 0 && (
                <Badge variant="destructive" className="text-xs">{pendingRequests.length}</Badge>
              )}
            </CardTitle>
            <CardDescription>{t("dir_approvals_desc")}</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : pendingRequests.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-10 text-muted-foreground">
                <CheckCircle2 className="w-10 h-10 text-green-500/40" />
                <p className="text-sm">{t("dir_approvals_no_pending")}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {(pendingRequests as unknown as PendingRequest[]).map((req) => (
                  <div key={req.id} className="rounded-lg border bg-muted/20 p-4 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">{t("dir_approvals_target_user")}</p>
                        <p className="font-medium">{req.targetUserName ?? req.targetUserEmail ?? `User #${req.targetUserId}`}</p>
                        {req.targetUserEmail && req.targetUserName && (
                          <p className="text-xs text-muted-foreground">{req.targetUserEmail}</p>
                        )}
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">{t("dir_approvals_requested_by")}</p>
                        <p className="font-medium">{req.requestedByName ?? req.requestedByEmail ?? "Unknown"}</p>
                        {req.requestedByEmail && req.requestedByName && (
                          <p className="text-xs text-muted-foreground">{req.requestedByEmail}</p>
                        )}
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">{t("dir_approvals_school")}</p>
                        <p className="font-medium">{req.tenantName ?? "—"}</p>
                        <p className="text-xs text-muted-foreground">{new Date(req.createdAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                    {req.requestNote && (
                      <p className="text-sm italic text-muted-foreground border-l-2 border-primary/30 pl-3">
                        "{req.requestNote}"
                      </p>
                    )}
                    <div className="flex gap-2 pt-1">
                      <Button
                        size="sm"
                        className="gap-1.5"
                        onClick={() => approveMutation.mutate({ requestId: req.id })}
                        disabled={approveMutation.isPending}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {t("dir_approvals_approve")}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 text-destructive hover:text-destructive"
                        onClick={() => openRejectDialog(req.id)}
                        disabled={rejectMutation.isPending}
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        {t("dir_approvals_reject")}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground text-right">Powered by SEBA</p>
      </div>

      {/* Reject dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("dir_approvals_reject")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label>{t("dir_approvals_reject_reason")}</Label>
            <Textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder={t("dir_approvals_reject_reason_placeholder")}
              rows={3}
              maxLength={512}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={confirmReject}
              disabled={rejectMutation.isPending}
            >
              {rejectMutation.isPending ? "Rejecting…" : t("dir_approvals_reject")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
