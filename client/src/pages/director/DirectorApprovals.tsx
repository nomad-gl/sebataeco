import { useState } from "react";
import { CheckCircle2, XCircle, ClipboardList, UserPlus, Eye, EyeOff, Copy } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { useI18n } from "@/contexts/I18nContext";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Pencil } from "lucide-react";

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

interface TeacherSubmission {
  id: number;
  teacherName: string;
  teacherEmail: string;
  note: string | null;
  pts_status: "pending" | "approved" | "rejected";
  rejectionReason: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
  tenantId: number;
  submittedByUserId: number;
  submittedByName: string | null;
  submittedByEmail: string | null;
}

export default function DirectorApprovals() {
  const { t } = useI18n();
  const utils = trpc.useUtils();

  // ── Assignment request state ──────────────────────────────────────────────
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  // ── Teacher submission state ──────────────────────────────────────────────
  const [teacherRejectDialogOpen, setTeacherRejectDialogOpen] = useState(false);
  const [teacherRejectingId, setTeacherRejectingId] = useState<number | null>(null);
  const [teacherRejectionReason, setTeacherRejectionReason] = useState("");
  const [revealedPasswords, setRevealedPasswords] = useState<Record<number, { password: string; visible: boolean }>>({});

  // ── Edit submission state ─────────────────────────────────────────────────
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingSubmission, setEditingSubmission] = useState<TeacherSubmission | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editNote, setEditNote] = useState("");

  // ── Queries ───────────────────────────────────────────────────────────────
  const { data: pendingRequests = [], isLoading } = trpc.assignmentRequests.listPending.useQuery();
  const { data: teacherSubmissions = [], isLoading: loadingTeachers } =
    trpc.director.listPendingTeacherSubmissions.useQuery();

  const pendingTeacherCount = (teacherSubmissions as unknown as TeacherSubmission[]).filter(
    (s) => s.pts_status === "pending"
  ).length;

  // ── Assignment mutations ──────────────────────────────────────────────────
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

  // ── Teacher submission mutations ──────────────────────────────────────────
  const approveTeacherMutation = trpc.director.approvePendingTeacher.useMutation({
    onSuccess: (data, variables) => {
      toast.success("Teacher approved", {
        description: `Account created and credentials emailed to ${data.teacherEmail}.`,
      });
      setRevealedPasswords((prev) => ({
        ...prev,
        [variables.submissionId]: { password: data.tempPassword, visible: false },
      }));
      utils.director.listPendingTeacherSubmissions.invalidate();
    },
    onError: (err: { message: string }) => toast.error(err.message),
  });

  const editTeacherMutation = trpc.director.editPendingTeacher.useMutation({
    onSuccess: () => {
      toast.success("Submission updated");
      setEditDialogOpen(false);
      setEditingSubmission(null);
      utils.director.listPendingTeacherSubmissions.invalidate();
    },
    onError: (err: { message: string }) => toast.error(err.message),
  });

  const rejectTeacherMutation = trpc.director.rejectPendingTeacher.useMutation({
    onSuccess: () => {
      toast.success("Teacher submission rejected");
      setTeacherRejectDialogOpen(false);
      setTeacherRejectionReason("");
      setTeacherRejectingId(null);
      utils.director.listPendingTeacherSubmissions.invalidate();
    },
    onError: (err: { message: string }) => toast.error(err.message),
  });

  // ── Helpers ───────────────────────────────────────────────────────────────
  const openRejectDialog = (id: number) => {
    setRejectingId(id);
    setRejectionReason("");
    setRejectDialogOpen(true);
  };

  const confirmReject = () => {
    if (!rejectingId) return;
    rejectMutation.mutate({ requestId: rejectingId, reason: rejectionReason.trim() || undefined });
  };

  const openEditDialog = (sub: TeacherSubmission) => {
    setEditingSubmission(sub);
    setEditName(sub.teacherName);
    setEditEmail(sub.teacherEmail);
    setEditNote(sub.note ?? "");
    setEditDialogOpen(true);
  };

  const confirmEdit = () => {
    if (!editingSubmission) return;
    editTeacherMutation.mutate({
      submissionId: editingSubmission.id,
      teacherName: editName.trim(),
      teacherEmail: editEmail.trim(),
      note: editNote.trim() || undefined,
    });
  };

  const openTeacherRejectDialog = (id: number) => {
    setTeacherRejectingId(id);
    setTeacherRejectionReason("");
    setTeacherRejectDialogOpen(true);
  };

  const confirmTeacherReject = () => {
    if (!teacherRejectingId) return;
    rejectTeacherMutation.mutate({
      submissionId: teacherRejectingId,
      reason: teacherRejectionReason.trim() || undefined,
    });
  };

  const toggleReveal = (id: number) => {
    setRevealedPasswords((prev) => ({
      ...prev,
      [id]: { ...prev[id], visible: !prev[id]?.visible },
    }));
  };

  const copyCredentials = (email: string, password: string) => {
    navigator.clipboard.writeText(`Email: ${email}\nPassword: ${password}`).then(() =>
      toast.success("Credentials copied to clipboard")
    );
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

        {/* ── Section 1: Assignment requests ─────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              {t("dir_approvals_pending")}
              {(pendingRequests as unknown as PendingRequest[]).length > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {(pendingRequests as unknown as PendingRequest[]).length}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>{t("dir_approvals_desc")}</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : (pendingRequests as unknown as PendingRequest[]).length === 0 ? (
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

        <Separator />

        {/* ── Section 2: Pending teacher submissions ─────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <UserPlus className="w-4 h-4" />
              Teacher Submissions
              {pendingTeacherCount > 0 && (
                <Badge variant="destructive" className="text-xs">{pendingTeacherCount}</Badge>
              )}
            </CardTitle>
            <CardDescription>
              New teacher accounts submitted by Heads of Study for your approval.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingTeachers ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : (teacherSubmissions as unknown as TeacherSubmission[]).length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-10 text-muted-foreground">
                <CheckCircle2 className="w-10 h-10 text-green-500/40" />
                <p className="text-sm">No teacher submissions pending.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {(teacherSubmissions as unknown as TeacherSubmission[]).map((sub) => {
                  const revealed = revealedPasswords[sub.id];
                  return (
                    <div key={sub.id} className="rounded-lg border bg-muted/20 p-4 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Teacher</p>
                          <p className="font-medium">{sub.teacherName}</p>
                          <p className="text-xs text-muted-foreground">{sub.teacherEmail}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Submitted by</p>
                          <p className="font-medium">{sub.submittedByName ?? sub.submittedByEmail ?? "Unknown"}</p>
                          {sub.submittedByEmail && sub.submittedByName && (
                            <p className="text-xs text-muted-foreground">{sub.submittedByEmail}</p>
                          )}
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Status</p>
                          <Badge
                            variant={
                              sub.pts_status === "approved"
                                ? "default"
                                : sub.pts_status === "rejected"
                                ? "destructive"
                                : "outline"
                            }
                            className="text-xs"
                          >
                            {sub.pts_status.charAt(0).toUpperCase() + sub.pts_status.slice(1)}
                          </Badge>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {new Date(sub.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>

                      {sub.note && (
                        <p className="text-sm italic text-muted-foreground border-l-2 border-primary/30 pl-3">
                          "{sub.note}"
                        </p>
                      )}

                      {sub.rejectionReason && (
                        <p className="text-xs text-destructive">Rejected: {sub.rejectionReason}</p>
                      )}

                      {/* Revealed password badge */}
                      {revealed && (
                        <div className="flex items-center gap-2 p-2 rounded-md bg-background border text-xs font-mono">
                          <span className="flex-1 truncate">
                            {revealed.visible ? revealed.password : "•".repeat(revealed.password.length)}
                          </span>
                          <button
                            onClick={() => toggleReveal(sub.id)}
                            className="text-muted-foreground hover:text-foreground"
                            title={revealed.visible ? "Hide" : "Show"}
                          >
                            {revealed.visible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            onClick={() => navigator.clipboard.writeText(revealed.password).then(() => toast.success("Password copied"))}
                            className="text-muted-foreground hover:text-foreground"
                            title="Copy password"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => copyCredentials(sub.teacherEmail, revealed.password)}
                            className="text-xs px-1.5 py-0.5 rounded bg-primary text-primary-foreground hover:bg-primary/90"
                            title="Copy email + password"
                          >
                            Both
                          </button>
                          <button
                            onClick={() => setRevealedPasswords((p) => { const n = { ...p }; delete n[sub.id]; return n; })}
                            className="text-muted-foreground hover:text-destructive"
                            title="Dismiss"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}

                      {sub.pts_status === "pending" && (
                        <div className="flex flex-wrap gap-2 pt-1">
                          <Button
                            size="sm"
                            className="gap-1.5"
                            onClick={() => approveTeacherMutation.mutate({ submissionId: sub.id })}
                            disabled={approveTeacherMutation.isPending}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5"
                            onClick={() => openEditDialog(sub)}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5 text-destructive hover:text-destructive"
                            onClick={() => openTeacherRejectDialog(sub.id)}
                            disabled={rejectTeacherMutation.isPending}
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            Reject
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground text-right">Powered by SEBA</p>
      </div>

      {/* Assignment reject dialog */}
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

      {/* Edit teacher submission dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Teacher Submission</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-teacher-name">Teacher Name</Label>
              <Input
                id="edit-teacher-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Full name"
                maxLength={255}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-teacher-email">Teacher Email</Label>
              <Input
                id="edit-teacher-email"
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                placeholder="teacher@school.cat"
                maxLength={255}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-teacher-note">Note (optional)</Label>
              <Textarea
                id="edit-teacher-note"
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                placeholder="Any additional context…"
                rows={2}
                maxLength={512}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={confirmEdit}
              disabled={editTeacherMutation.isPending || !editName.trim() || !editEmail.trim()}
            >
              {editTeacherMutation.isPending ? "Saving…" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Teacher submission reject dialog */}
      <Dialog open={teacherRejectDialogOpen} onOpenChange={setTeacherRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Teacher Submission</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label>Reason (optional)</Label>
            <Textarea
              value={teacherRejectionReason}
              onChange={(e) => setTeacherRejectionReason(e.target.value)}
              placeholder="e.g. Email address already in use, please resubmit with correct details."
              rows={3}
              maxLength={512}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTeacherRejectDialogOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={confirmTeacherReject}
              disabled={rejectTeacherMutation.isPending}
            >
              {rejectTeacherMutation.isPending ? "Rejecting…" : "Reject Submission"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
