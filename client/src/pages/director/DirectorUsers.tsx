/**
 * DirectorUsers — Director-only page listing all local (email+password) accounts.
 * Features: role selector, deactivate/reactivate, bulk deactivate, invite teacher,
 *           invite history table with Resend button.
 */
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/contexts/I18nContext";
import { trpc } from "@/lib/trpc";
import {
  KeyRound,
  Loader2,
  MailPlus,
  RefreshCw,
  Search,
  ShieldCheck,
  User,
  Users,
  UserX,
  UserCheck,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────────
type LocalUser = {
  id: number;
  displayName: string | null;
  email: string | null;
  role: string;
  position: string | null;
  lastSignedIn: Date | null;
  createdAt: Date | null;
  deactivatedAt: Date | null;
};

type DeactivateAction = { user: LocalUser; action: "deactivate" | "reactivate" };

type InviteRow = {
  id: number;
  token: string;
  email: string | null;
  createdAt: Date | null;
  expiresAt: Date;
  usedAt: Date | null;
  status: "pending" | "used" | "expired";
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatDate(date: Date | null): string {
  if (!date) return "—";
  return new Date(date).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function positionLabel(position: string | null): string {
  if (!position || position === "unassigned") return "—";
  return position
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function DirectorUsers() {
  const { t } = useI18n();
  const [search, setSearch] = useState("");
  const [confirmReset, setConfirmReset] = useState<LocalUser | null>(null);
  const [confirmDeactivate, setConfirmDeactivate] = useState<DeactivateAction | null>(null);
  const [resetResult, setResetResult] = useState<{ url: string; expiresAt: Date } | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteResult, setInviteResult] = useState<{ url: string; expiresAt: Date } | null>(null);

  // Invite history state
  const [confirmResend, setConfirmResend] = useState<InviteRow | null>(null);
  const [resendResult, setResendResult] = useState<{ url: string; expiresAt: Date } | null>(null);

  const { data: users = [], isLoading, refetch } = trpc.director.listLocalUsers.useQuery();
  const { data: invites = [], isLoading: invitesLoading, refetch: refetchInvites } =
    trpc.director.listTeacherInvites.useQuery();

  const resetMutation = trpc.director.adminRequestReset.useMutation({
    onSuccess: (data) => {
      setConfirmReset(null);
      setResetResult({ url: data.resetUrl, expiresAt: new Date(data.expiresAt) });
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const deactivateMutation = trpc.director.deactivateUser.useMutation({
    onSuccess: () => {
      setConfirmDeactivate(null);
      toast.success(t("dir_users_deactivated_toast"));
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const reactivateMutation = trpc.director.reactivateUser.useMutation({
    onSuccess: () => {
      setConfirmDeactivate(null);
      toast.success(t("dir_users_reactivated_toast"));
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const bulkDeactivateMutation = trpc.director.bulkDeactivateUsers.useMutation({
    onSuccess: (data) => {
      setShowBulkConfirm(false);
      setSelected(new Set());
      toast.success(t("dir_users_bulk_deactivated_toast").replace("{n}", String(data.count)));
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const inviteMutation = trpc.director.createTeacherInvite.useMutation({
    onSuccess: (data) => {
      setShowInvite(false);
      setInviteEmail("");
      setInviteResult({ url: data.inviteUrl, expiresAt: new Date(data.expiresAt) });
      refetchInvites();
    },
    onError: (err) => toast.error(err.message),
  });

  const resendMutation = trpc.director.resendTeacherInvite.useMutation({
    onSuccess: (data) => {
      setConfirmResend(null);
      setResendResult({ url: data.inviteUrl, expiresAt: new Date(data.expiresAt) });
      toast.success(t("dir_invite_resend_toast"));
      refetchInvites();
    },
    onError: (err) => toast.error(err.message),
  });

  const isDeactivatePending = deactivateMutation.isPending || reactivateMutation.isPending;

  const roleMutation = trpc.director.updateUserRole.useMutation({
    onSuccess: () => {
      toast.success(t("dir_users_role_updated_toast"));
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  // Filter by search
  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    return (
      !q ||
      (u.displayName ?? "").toLowerCase().includes(q) ||
      (u.email ?? "").toLowerCase().includes(q) ||
      (u.position ?? "").toLowerCase().includes(q)
    );
  });

  // Active (non-deactivated) users in the filtered list
  const activeFiltered = filtered.filter((u) => !u.deactivatedAt);
  const allActiveSelected =
    activeFiltered.length > 0 && activeFiltered.every((u) => selected.has(u.id));

  const toggleSelect = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allActiveSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(activeFiltered.map((u) => u.id)));
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Users className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">{t("dir_users_title")}</h1>
            <p className="text-sm text-muted-foreground">{t("dir_users_subtitle")}</p>
          </div>
        </div>
        <Button
          className="gap-2"
          onClick={() => setShowInvite(true)}
        >
          <MailPlus className="h-4 w-4" />
          {t("dir_users_invite_btn")}
        </Button>
      </div>

      {/* Search + bulk toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder={t("dir_users_search_placeholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {selected.size > 0 && (
          <Button
            variant="destructive"
            size="sm"
            className="gap-1.5"
            onClick={() => setShowBulkConfirm(true)}
          >
            <UserX className="h-4 w-4" />
            {t("dir_users_bulk_deactivate_btn").replace("{n}", String(selected.size))}
          </Button>
        )}
      </div>

      {/* Table card */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">
            {t("dir_users_table_title")} ({filtered.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>{t("dir_users_loading")}</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
              <Users className="h-8 w-8 opacity-30" />
              <p className="text-sm">{t("dir_users_empty")}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="px-4 py-3 w-10">
                      <Checkbox
                        checked={allActiveSelected}
                        onCheckedChange={toggleSelectAll}
                        aria-label="Select all active"
                      />
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t("dir_users_col_name")}</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t("dir_users_col_email")}</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t("dir_users_col_role")}</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t("dir_users_col_status")}</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t("dir_users_col_position")}</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t("dir_users_col_last_signin")}</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">{t("dir_users_col_actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((user) => {
                    const isDeactivated = !!user.deactivatedAt;
                    const isChecked = selected.has(user.id);
                    return (
                      <tr
                        key={user.id}
                        className={`border-b last:border-0 transition-colors ${isDeactivated ? "opacity-60 bg-muted/10" : isChecked ? "bg-primary/5" : "hover:bg-muted/20"}`}
                      >
                        <td className="px-4 py-3">
                          <Checkbox
                            checked={isChecked}
                            disabled={isDeactivated}
                            onCheckedChange={() => !isDeactivated && toggleSelect(user.id)}
                            aria-label={`Select ${user.displayName ?? user.email}`}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                              {user.role === "admin"
                                ? <ShieldCheck className="h-4 w-4 text-primary" />
                                : <User className="h-4 w-4 text-muted-foreground" />
                              }
                            </div>
                            <span className="font-medium">{user.displayName ?? "—"}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{user.email ?? "—"}</td>
                        <td className="px-4 py-3">
                          <Select
                            value={user.role === "admin" ? "admin" : "user"}
                            onValueChange={(newRole) => {
                              roleMutation.mutate({ userId: user.id, role: newRole as "user" | "admin" });
                            }}
                            disabled={roleMutation.isPending || isDeactivated}
                          >
                            <SelectTrigger className="h-7 w-28 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">
                                <span className="flex items-center gap-1.5">
                                  <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                                  {t("dir_users_role_admin")}
                                </span>
                              </SelectItem>
                              <SelectItem value="user">
                                <span className="flex items-center gap-1.5">
                                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                                  {t("dir_users_role_user")}
                                </span>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-4 py-3">
                          {isDeactivated ? (
                            <Badge variant="destructive" className="text-xs">
                              {t("dir_users_status_deactivated")}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs text-green-600 border-green-600">
                              {t("dir_users_status_active")}
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{positionLabel(user.position)}</td>
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{formatDate(user.lastSignedIn)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            {!isDeactivated && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1.5"
                                onClick={() => setConfirmReset(user)}
                              >
                                <KeyRound className="h-3.5 w-3.5" />
                                {t("dir_users_reset_btn")}
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant={isDeactivated ? "outline" : "ghost"}
                              className={`gap-1.5 ${isDeactivated ? "text-green-600 border-green-600 hover:bg-green-50" : "text-destructive hover:text-destructive hover:bg-destructive/10"}`}
                              onClick={() => setConfirmDeactivate({ user, action: isDeactivated ? "reactivate" : "deactivate" })}
                            >
                              {isDeactivated
                                ? <><UserCheck className="h-3.5 w-3.5" />{t("dir_users_reactivate_btn")}</>
                                : <><UserX className="h-3.5 w-3.5" />{t("dir_users_deactivate_btn")}</>
                              }
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invite history card */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">
            {t("dir_invite_history_title")} ({invites.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {invitesLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : invites.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
              <MailPlus className="h-8 w-8 opacity-30" />
              <p className="text-sm">{t("dir_invite_history_empty")}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t("dir_invite_col_email")}</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t("dir_invite_col_status")}</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t("dir_invite_col_created")}</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t("dir_invite_col_expires")}</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">{t("dir_invite_col_actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {(invites as InviteRow[]).map((invite) => (
                    <tr key={invite.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 text-muted-foreground">{invite.email ?? "—"}</td>
                      <td className="px-4 py-3">
                        {invite.status === "used" && (
                          <Badge variant="outline" className="text-xs text-green-600 border-green-600">
                            {t("dir_invite_status_used")}
                          </Badge>
                        )}
                        {invite.status === "pending" && (
                          <Badge variant="outline" className="text-xs text-amber-600 border-amber-600">
                            {t("dir_invite_status_pending")}
                          </Badge>
                        )}
                        {invite.status === "expired" && (
                          <Badge variant="outline" className="text-xs text-destructive border-destructive">
                            {t("dir_invite_status_expired")}
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{formatDate(invite.createdAt)}</td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{formatDate(invite.expiresAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end">
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5"
                            disabled={invite.status === "used"}
                            onClick={() => setConfirmResend(invite)}
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                            {t("dir_invite_resend_btn")}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirm reset dialog */}
      <Dialog open={!!confirmReset} onOpenChange={(open) => !open && setConfirmReset(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("dir_users_reset_confirm_title")}</DialogTitle>
            <DialogDescription>
              {t("dir_users_reset_confirm_desc").replace("{name}", confirmReset?.displayName ?? confirmReset?.email ?? String(confirmReset?.id ?? ""))}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmReset(null)}>
              {t("dir_users_cancel")}
            </Button>
            <Button
              disabled={resetMutation.isPending}
              onClick={() => {
                if (!confirmReset) return;
                resetMutation.mutate({ userId: confirmReset.id, origin: window.location.origin });
              }}
            >
              {resetMutation.isPending
                ? <><Loader2 className="h-4 w-4 animate-spin mr-1" />{t("dir_users_resetting")}</>
                : t("dir_users_reset_confirm_btn")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm deactivate / reactivate dialog */}
      <Dialog open={!!confirmDeactivate} onOpenChange={(open) => !open && setConfirmDeactivate(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmDeactivate?.action === "reactivate"
                ? t("dir_users_reactivate_confirm_title")
                : t("dir_users_deactivate_confirm_title")}
            </DialogTitle>
            <DialogDescription>
              {confirmDeactivate?.action === "reactivate"
                ? t("dir_users_reactivate_confirm_desc").replace("{name}", confirmDeactivate.user.displayName ?? confirmDeactivate.user.email ?? String(confirmDeactivate.user.id))
                : t("dir_users_deactivate_confirm_desc").replace("{name}", confirmDeactivate?.user.displayName ?? confirmDeactivate?.user.email ?? String(confirmDeactivate?.user.id ?? ""))}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmDeactivate(null)}>
              {t("dir_users_cancel")}
            </Button>
            <Button
              variant={confirmDeactivate?.action === "reactivate" ? "default" : "destructive"}
              disabled={isDeactivatePending}
              onClick={() => {
                if (!confirmDeactivate) return;
                if (confirmDeactivate.action === "reactivate") {
                  reactivateMutation.mutate({ userId: confirmDeactivate.user.id });
                } else {
                  deactivateMutation.mutate({ userId: confirmDeactivate.user.id });
                }
              }}
            >
              {isDeactivatePending
                ? <><Loader2 className="h-4 w-4 animate-spin mr-1" />{t("dir_users_resetting")}</>
                : confirmDeactivate?.action === "reactivate"
                  ? t("dir_users_reactivate_confirm_btn")
                  : t("dir_users_deactivate_confirm_btn")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk deactivate confirm dialog */}
      <Dialog open={showBulkConfirm} onOpenChange={(open) => !open && setShowBulkConfirm(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("dir_users_bulk_deactivate_confirm_title")}</DialogTitle>
            <DialogDescription>
              {t("dir_users_bulk_deactivate_confirm_desc").replace("{n}", String(selected.size))}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowBulkConfirm(false)}>
              {t("dir_users_cancel")}
            </Button>
            <Button
              variant="destructive"
              disabled={bulkDeactivateMutation.isPending}
              onClick={() => bulkDeactivateMutation.mutate({ userIds: Array.from(selected) })}
            >
              {bulkDeactivateMutation.isPending
                ? <><Loader2 className="h-4 w-4 animate-spin mr-1" />{t("dir_users_resetting")}</>
                : t("dir_users_bulk_deactivate_confirm_btn").replace("{n}", String(selected.size))}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invite teacher dialog */}
      <Dialog open={showInvite} onOpenChange={(open) => { if (!open) { setShowInvite(false); setInviteEmail(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("dir_users_invite_title")}</DialogTitle>
            <DialogDescription>{t("dir_users_invite_desc")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="invite-email">{t("dir_users_invite_email_label")}</Label>
            <Input
              id="invite-email"
              type="email"
              placeholder="teacher@school.edu"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setShowInvite(false); setInviteEmail(""); }}>
              {t("dir_users_cancel")}
            </Button>
            <Button
              disabled={inviteMutation.isPending || !inviteEmail.trim()}
              onClick={() => inviteMutation.mutate({ email: inviteEmail.trim(), origin: window.location.origin })}
            >
              {inviteMutation.isPending
                ? <><Loader2 className="h-4 w-4 animate-spin mr-1" />{t("dir_users_invite_sending")}</>
                : t("dir_users_invite_send_btn")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invite link result dialog */}
      <Dialog open={!!inviteResult} onOpenChange={(open) => !open && setInviteResult(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("dir_users_invite_done_title")}</DialogTitle>
            <DialogDescription>{t("dir_users_invite_done_desc")}</DialogDescription>
          </DialogHeader>
          <div className="rounded-md bg-muted p-3 text-xs font-mono break-all select-all">
            {inviteResult?.url}
          </div>
          <p className="text-xs text-muted-foreground">
            {t("dir_users_reset_expires")}: {inviteResult ? formatDate(inviteResult.expiresAt) : ""}
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                if (inviteResult?.url) {
                  navigator.clipboard.writeText(inviteResult.url);
                  toast.success(t("dir_users_reset_copied"));
                }
              }}
            >
              {t("dir_users_reset_copy_link")}
            </Button>
            <Button onClick={() => setInviteResult(null)}>{t("dir_users_close")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm resend invite dialog */}
      <Dialog open={!!confirmResend} onOpenChange={(open) => !open && setConfirmResend(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("dir_invite_resend_confirm_title")}</DialogTitle>
            <DialogDescription>
              {t("dir_invite_resend_confirm_desc").replace("{email}", confirmResend?.email ?? "—")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmResend(null)}>
              {t("dir_users_cancel")}
            </Button>
            <Button
              disabled={resendMutation.isPending}
              onClick={() => {
                if (!confirmResend) return;
                resendMutation.mutate({ inviteId: confirmResend.id, origin: window.location.origin });
              }}
            >
              {resendMutation.isPending
                ? <><Loader2 className="h-4 w-4 animate-spin mr-1" />{t("dir_users_resetting")}</>
                : t("dir_invite_resend_btn")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Resend result dialog */}
      <Dialog open={!!resendResult} onOpenChange={(open) => !open && setResendResult(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("dir_invite_resend_done_title")}</DialogTitle>
            <DialogDescription>{t("dir_invite_resend_done_desc")}</DialogDescription>
          </DialogHeader>
          <div className="rounded-md bg-muted p-3 text-xs font-mono break-all select-all">
            {resendResult?.url}
          </div>
          <p className="text-xs text-muted-foreground">
            {t("dir_users_reset_expires")}: {resendResult ? formatDate(resendResult.expiresAt) : ""}
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                if (resendResult?.url) {
                  navigator.clipboard.writeText(resendResult.url);
                  toast.success(t("dir_users_reset_copied"));
                }
              }}
            >
              {t("dir_users_reset_copy_link")}
            </Button>
            <Button onClick={() => setResendResult(null)}>{t("dir_users_close")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset link result dialog */}
      <Dialog open={!!resetResult} onOpenChange={(open) => !open && setResetResult(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("dir_users_reset_done_title")}</DialogTitle>
            <DialogDescription>
              {t("dir_users_reset_done_desc")}
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md bg-muted p-3 text-xs font-mono break-all select-all">
            {resetResult?.url}
          </div>
          <p className="text-xs text-muted-foreground">
            {t("dir_users_reset_expires")}: {resetResult ? formatDate(resetResult.expiresAt) : ""}
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                if (resetResult?.url) {
                  navigator.clipboard.writeText(resetResult.url);
                  toast.success(t("dir_users_reset_copied"));
                }
              }}
            >
              {t("dir_users_reset_copy_link")}
            </Button>
            <Button onClick={() => setResetResult(null)}>{t("dir_users_close")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
