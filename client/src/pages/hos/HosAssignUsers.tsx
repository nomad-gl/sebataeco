import { useState } from "react";
import { UserPlus, ClipboardList, CheckCircle2, XCircle, Clock } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { useI18n } from "@/contexts/I18nContext";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/_core/hooks/useAuth";

type StatusKey = "pending" | "approved" | "rejected";

function StatusBadge({ status }: { status: StatusKey }) {
  const { t } = useI18n();
  const map: Record<StatusKey, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode }> = {
    pending:  { label: t("hos_assign_status_pending"),  variant: "outline",     icon: <Clock className="w-3 h-3" /> },
    approved: { label: t("hos_assign_status_approved"), variant: "default",     icon: <CheckCircle2 className="w-3 h-3" /> },
    rejected: { label: t("hos_assign_status_rejected"), variant: "destructive", icon: <XCircle className="w-3 h-3" /> },
  };
  const { label, variant, icon } = map[status] ?? map.pending;
  return (
    <Badge variant={variant} className="flex items-center gap-1 w-fit">
      {icon}
      {label}
    </Badge>
  );
}

export default function HosAssignUsers() {
  const { t } = useI18n();
  const { user } = useAuth();

  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [note, setNote] = useState("");

  const utils = trpc.useUtils();

  // Fetch unassigned users (users with no tenantId)
  const { data: unassignedUsers = [], isLoading: loadingUsers } = trpc.tenants.listUnassignedUsers.useQuery();

  // Fetch HoS's own requests
  const { data: myRequests = [], isLoading: loadingRequests } = trpc.assignmentRequests.listMyRequests.useQuery();

  const createRequest = trpc.assignmentRequests.createRequest.useMutation({
    onSuccess: () => {
      toast.success(t("hos_assign_submitted"), { description: t("hos_assign_submitted_desc") });
      setSelectedUserId("");
      setNote("");
      utils.assignmentRequests.listMyRequests.invalidate();
    },
    onError: (err: { message: string }) => {
      const msg = err.message.includes("already exists")
        ? t("hos_assign_already_pending")
        : err.message;
      toast.error(msg);
    },
  });

  const handleSubmit = () => {
    if (!selectedUserId || !user?.tenantId) return;
    createRequest.mutate({
      targetUserId: parseInt(selectedUserId),
      tenantId: user.tenantId,
      requestNote: note.trim() || undefined,
    });
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10">
            <UserPlus className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t("hos_assign_users")}</h1>
            <p className="text-sm text-muted-foreground">{t("hos_assign_users_desc")}</p>
          </div>
        </div>

        {/* Request form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("hos_assign_request_title")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>{t("hos_assign_select_user")}</Label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId} disabled={loadingUsers}>
                <SelectTrigger>
                  <SelectValue placeholder={loadingUsers ? "Loading…" : t("hos_assign_select_user")} />
                </SelectTrigger>
                <SelectContent>
                  {unassignedUsers.map((u) => (
                    <SelectItem key={u.id} value={String(u.id)}>
                      {u.name ?? u.email ?? `User #${u.id}`}
                      {u.email && u.name ? ` — ${u.email}` : ""}
                    </SelectItem>
                  ))}
                  {unassignedUsers.length === 0 && !loadingUsers && (
                    <SelectItem value="__none__" disabled>No unassigned users</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>{t("hos_assign_note")}</Label>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t("hos_assign_note_placeholder")}
                rows={3}
                maxLength={512}
              />
            </div>

            <Button
              onClick={handleSubmit}
              disabled={!selectedUserId || selectedUserId === "__none__" || createRequest.isPending}
              className="w-full sm:w-auto"
            >
              {createRequest.isPending ? "Submitting…" : t("hos_assign_submit")}
            </Button>
          </CardContent>
        </Card>

        <Separator />

        {/* My requests history */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardList className="w-4 h-4" />
              {t("hos_assign_my_requests")}
            </CardTitle>
            <CardDescription>{myRequests.length} request{myRequests.length !== 1 ? "s" : ""}</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingRequests ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : myRequests.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("hos_assign_no_requests")}</p>
            ) : (
              <div className="space-y-3">
                {myRequests.map((req) => (
                  <div key={req.id} className="flex flex-col sm:flex-row sm:items-start gap-3 p-3 rounded-lg border bg-muted/20">
                    <div className="flex-1 space-y-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {req.targetUserName ?? req.targetUserEmail ?? `User #${req.targetUserId}`}
                      </p>
                      {req.requestNote && (
                        <p className="text-xs text-muted-foreground italic">"{req.requestNote}"</p>
                      )}
                      {req.rejectionReason && (
                        <p className="text-xs text-destructive">Rejected: {req.rejectionReason}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {new Date(req.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <StatusBadge status={req.status as StatusKey} />
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
