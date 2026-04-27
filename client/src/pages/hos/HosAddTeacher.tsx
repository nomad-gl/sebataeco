import { useState } from "react";
import { UserPlus, ClipboardList, CheckCircle2, XCircle, Clock, Send } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { useI18n } from "@/contexts/I18nContext";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";

type StatusKey = "pending" | "approved" | "rejected";

function StatusBadge({ status }: { status: StatusKey }) {
  const map: Record<StatusKey, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode }> = {
    pending:  { label: "Pending",  variant: "outline",     icon: <Clock className="w-3 h-3" /> },
    approved: { label: "Approved", variant: "default",     icon: <CheckCircle2 className="w-3 h-3" /> },
    rejected: { label: "Rejected", variant: "destructive", icon: <XCircle className="w-3 h-3" /> },
  };
  const { label, variant, icon } = map[status] ?? map.pending;
  return (
    <Badge variant={variant} className="flex items-center gap-1 w-fit">
      {icon}
      {label}
    </Badge>
  );
}

export default function HosAddTeacher() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const isDirector = user?.role === "director" || user?.role === "admin";
  const [teacherName, setTeacherName] = useState("");
  const [teacherEmail, setTeacherEmail] = useState("");
  const [note, setNote] = useState("");
  const utils = trpc.useUtils();

  const { data: mySubmissions = [], isLoading: loadingSubmissions } = trpc.hos.listMyTeacherSubmissions.useQuery();

  const submitMutation = trpc.hos.submitTeacher.useMutation({
    onSuccess: (data) => {
      if ((data as any).autoApproved) {
        // Director: account created — show brief toast then redirect to User Management
        // with prefill params so the Invite Teacher dialog opens automatically
        toast.success(t("add_teacher_director_toast"), {
          description: t("add_teacher_director_toast_desc").replace("{email}", teacherEmail.trim()),
          duration: 4000,
        });
        const params = new URLSearchParams({
          prefillEmail: teacherEmail.trim(),
          prefillName: teacherName.trim(),
        });
        setTimeout(() => navigate(`/director/users?${params.toString()}`), 1200);
      } else {
        // Head of Study: pending approval
        toast.success(t("add_teacher_submitted_toast"), {
          description: t("add_teacher_submitted_desc"),
        });
      }
      setTeacherName("");
      setTeacherEmail("");
      setNote("");
      utils.hos.listMyTeacherSubmissions.invalidate();
    },
    onError: (err: { message: string }) => {
      const msg = err.message.includes("already exists")
        ? t("add_teacher_duplicate_error")
        : err.message.includes("assigned to a school")
          ? t("add_teacher_no_school_error")
          : err.message.includes("pending submission already exists")
            ? t("add_teacher_pending_exists_error")
            : err.message;
      toast.error(msg);
    },
  });

  const cancelMutation = trpc.hos.cancelPendingTeacher.useMutation({
    onSuccess: () => {
      toast.success(t("add_teacher_cancelled_toast"));
      utils.hos.listMyTeacherSubmissions.invalidate();
    },
    onError: (err: { message: string }) => toast.error(err.message),
  });

  const handleSubmit = () => {
    if (!teacherName.trim() || !teacherEmail.trim()) return;
    submitMutation.mutate({
      teacherName: teacherName.trim(),
      teacherEmail: teacherEmail.trim(),
      note: note.trim() || undefined,
    });
  };

  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(teacherEmail.trim());
  const canSubmit = teacherName.trim().length > 0 && isValidEmail && !submitMutation.isPending;

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        {/* Back button */}
        <button
          onClick={() => navigate(isDirector ? "/director/approvals" : "/head-of-study/assign-users")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
          {isDirector ? t("add_teacher_back_approvals") : t("add_teacher_back")}
        </button>

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10">
            <UserPlus className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t("add_teacher_title")}</h1>
            <p className="text-sm text-muted-foreground">
              {isDirector
                ? t("add_teacher_director_subtitle")
                : t("add_teacher_subtitle")}
            </p>
          </div>
        </div>

        {/* Submission form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("add_teacher_form_title")}</CardTitle>
            <CardDescription>
              {t("add_teacher_form_desc")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="teacher-name">{t("add_teacher_name_label")} <span className="text-destructive">*</span></Label>
                <Input
                  id="teacher-name"
                  value={teacherName}
                  onChange={(e) => setTeacherName(e.target.value)}
                  placeholder={t("add_teacher_name_placeholder")}
                  maxLength={255}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="teacher-email">{t("add_teacher_email_label")} <span className="text-destructive">*</span></Label>
                <Input
                  id="teacher-email"
                  type="email"
                  value={teacherEmail}
                  onChange={(e) => setTeacherEmail(e.target.value)}
                  placeholder={t("add_teacher_email_placeholder")}
                  maxLength={255}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="note">{t("add_teacher_note_label")}</Label>
              <Textarea
                id="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t("add_teacher_note_placeholder")}
                rows={3}
                maxLength={512}
              />
            </div>
            <Button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="w-full sm:w-auto gap-2"
            >
              <Send className="w-4 h-4" />
              {submitMutation.isPending
                ? (isDirector ? t("add_teacher_director_submitting") : t("add_teacher_submitting"))
                : (isDirector ? t("add_teacher_director_submit") : t("add_teacher_submit"))}
            </Button>
          </CardContent>
        </Card>

        <Separator />

        {/* My submissions history */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardList className="w-4 h-4" />
              {t("add_teacher_history_title")}
            </CardTitle>
            <CardDescription>
              {mySubmissions.length} submission{mySubmissions.length !== 1 ? "s" : ""}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingSubmissions ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : mySubmissions.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">{t("add_teacher_no_submissions")}</p>
            ) : (
              <div className="space-y-3">
                {[...mySubmissions].reverse().map((sub) => (
                  <div
                    key={sub.id}
                    className="flex flex-col sm:flex-row sm:items-start gap-3 p-3 rounded-lg border bg-muted/20"
                  >
                    <div className="flex-1 space-y-1 min-w-0">
                      <p className="text-sm font-medium truncate">{sub.teacherName}</p>
                      <p className="text-xs text-muted-foreground truncate">{sub.teacherEmail}</p>
                      {sub.note && (
                        <p className="text-xs text-muted-foreground italic">"{sub.note}"</p>
                      )}
                      {sub.rejectionReason && (
                        <p className="text-xs text-destructive">{t("add_teacher_rejected_prefix")} {sub.rejectionReason}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {t("add_teacher_submitted_on")} {new Date(sub.createdAt).toLocaleDateString()}
                        {sub.reviewedAt && ` · ${t("add_teacher_reviewed_on")} ${new Date(sub.reviewedAt).toLocaleDateString()}`}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <StatusBadge status={sub.pts_status as StatusKey} />
                      {sub.pts_status === "pending" && (
                        <button
                          onClick={() => {
                            if (confirm(`${t("add_teacher_cancel_confirm")} ${sub.teacherName}?`)) {
                              cancelMutation.mutate({ submissionId: sub.id });
                            }
                          }}
                          disabled={cancelMutation.isPending}
                          className="text-xs text-destructive hover:underline disabled:opacity-50"
                        >
                          {t("add_teacher_cancel_btn")}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground text-right">Powered by SEBA</p>
      </div>
    </DashboardLayout>
  );
}
