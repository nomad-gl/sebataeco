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
  const [teacherName, setTeacherName] = useState("");
  const [teacherEmail, setTeacherEmail] = useState("");
  const [note, setNote] = useState("");
  const utils = trpc.useUtils();

  const { data: mySubmissions = [], isLoading: loadingSubmissions } = trpc.hos.listMyTeacherSubmissions.useQuery();

  const submitMutation = trpc.hos.submitTeacher.useMutation({
    onSuccess: () => {
      toast.success("Teacher submitted for approval", {
        description: "The Director will review your request shortly.",
      });
      setTeacherName("");
      setTeacherEmail("");
      setNote("");
      utils.hos.listMyTeacherSubmissions.invalidate();
    },
    onError: (err: { message: string }) => {
      const msg = err.message.includes("already exists")
        ? "A pending submission already exists for this email address."
        : err.message;
      toast.error(msg);
    },
  });

  const cancelMutation = trpc.hos.cancelPendingTeacher.useMutation({
    onSuccess: () => {
      toast.success("Submission cancelled.");
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
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10">
            <UserPlus className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Add Teacher</h1>
            <p className="text-sm text-muted-foreground">
              Submit a new teacher for Director approval. An account will be created once approved.
            </p>
          </div>
        </div>

        {/* Submission form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">New Teacher Request</CardTitle>
            <CardDescription>
              Fill in the teacher's details. The Director will review and approve or reject the request.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="teacher-name">Full Name <span className="text-destructive">*</span></Label>
                <Input
                  id="teacher-name"
                  value={teacherName}
                  onChange={(e) => setTeacherName(e.target.value)}
                  placeholder="e.g. Maria García"
                  maxLength={255}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="teacher-email">Email Address <span className="text-destructive">*</span></Label>
                <Input
                  id="teacher-email"
                  type="email"
                  value={teacherEmail}
                  onChange={(e) => setTeacherEmail(e.target.value)}
                  placeholder="e.g. m.garcia@school.cat"
                  maxLength={255}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="note">Note (optional)</Label>
              <Textarea
                id="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Joining as Maths teacher for Year 3 from September"
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
              {submitMutation.isPending ? "Submitting…" : "Submit for Approval"}
            </Button>
          </CardContent>
        </Card>

        <Separator />

        {/* My submissions history */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardList className="w-4 h-4" />
              My Submissions
            </CardTitle>
            <CardDescription>
              {mySubmissions.length} submission{mySubmissions.length !== 1 ? "s" : ""}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingSubmissions ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : mySubmissions.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No submissions yet.</p>
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
                        <p className="text-xs text-destructive">Rejected: {sub.rejectionReason}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Submitted {new Date(sub.createdAt).toLocaleDateString()}
                        {sub.reviewedAt && ` · Reviewed ${new Date(sub.reviewedAt).toLocaleDateString()}`}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <StatusBadge status={sub.pts_status as StatusKey} />
                      {sub.pts_status === "pending" && (
                        <button
                          onClick={() => {
                            if (confirm(`Cancel submission for ${sub.teacherName}?`)) {
                              cancelMutation.mutate({ submissionId: sub.id });
                            }
                          }}
                          disabled={cancelMutation.isPending}
                          className="text-xs text-destructive hover:underline disabled:opacity-50"
                        >
                          Cancel
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
