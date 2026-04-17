/**
 * DirectorUsers — Director-only page listing all local (email+password) accounts.
 * Shows: display name, email, role badge, position, last sign-in, and a
 * "Reset Password" action that triggers adminRequestReset on the server.
 */
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/contexts/I18nContext";
import { trpc } from "@/lib/trpc";
import {
  KeyRound,
  Loader2,
  Search,
  ShieldCheck,
  User,
  Users,
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
  const [confirmUser, setConfirmUser] = useState<LocalUser | null>(null);
  const [resetResult, setResetResult] = useState<{ url: string; expiresAt: Date } | null>(null);

  const { data: users = [], isLoading, refetch } = trpc.director.listLocalUsers.useQuery();

  const resetMutation = trpc.director.adminRequestReset.useMutation({
    onSuccess: (data) => {
      setConfirmUser(null);
      setResetResult({ url: data.resetUrl, expiresAt: new Date(data.expiresAt) });
      refetch();
    },
    onError: (err) => {
      toast.error(err.message);
    },
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

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Users className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">{t("dir_users_title")}</h1>
          <p className="text-sm text-muted-foreground">{t("dir_users_subtitle")}</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder={t("dir_users_search_placeholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
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
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t("dir_users_col_name")}</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t("dir_users_col_email")}</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t("dir_users_col_role")}</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t("dir_users_col_position")}</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t("dir_users_col_last_signin")}</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t("dir_users_col_joined")}</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">{t("dir_users_col_actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((user) => (
                    <tr key={user.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
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
                        <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                          {user.role === "admin" ? t("dir_users_role_admin") : t("dir_users_role_user")}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{positionLabel(user.position)}</td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{formatDate(user.lastSignedIn)}</td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{formatDate(user.createdAt)}</td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5"
                          onClick={() => setConfirmUser(user)}
                        >
                          <KeyRound className="h-3.5 w-3.5" />
                          {t("dir_users_reset_btn")}
                        </Button>
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
      <Dialog open={!!confirmUser} onOpenChange={(open) => !open && setConfirmUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("dir_users_reset_confirm_title")}</DialogTitle>
            <DialogDescription>
              {t("dir_users_reset_confirm_desc").replace("{name}", confirmUser?.displayName ?? confirmUser?.email ?? String(confirmUser?.id ?? ""))}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmUser(null)}>
              {t("dir_users_cancel")}
            </Button>
            <Button
              disabled={resetMutation.isPending}
              onClick={() => {
                if (!confirmUser) return;
                resetMutation.mutate({ userId: confirmUser.id, origin: window.location.origin });
              }}
            >
              {resetMutation.isPending
                ? <><Loader2 className="h-4 w-4 animate-spin mr-1" />{t("dir_users_resetting")}</>
                : t("dir_users_reset_confirm_btn")}
            </Button>
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
