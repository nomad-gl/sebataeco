/**
 * AdminUserManagement — Super-admin page listing ALL local (email+password)
 * accounts across all schools, grouped by school/tenant.
 * Accessible from the Administration → Territorial Services dropdown.
 */
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import {
  Loader2,
  Search,
  Users,
  UserX,
  UserCheck,
  KeyRound,
  ChevronDown,
  ChevronRight,
  Globe,
  Building2,
  UserPlus,
  X,
  AlertTriangle,
  Link2,
  Trash2,
} from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import BackButton from "@/components/BackButton";

// ── Types ─────────────────────────────────────────────────────────────────────
type AdminLocalUser = {
  id: number;
  displayName: string | null;
  email: string | null;
  role: string;
  position: string | null;
  tenantId: number | null;
  tenantName: string | null;
  schoolName: string | null;
  lastSignedIn: Date | null;
  createdAt: Date | null;
  deactivatedAt: Date | null;
  isPermanent: boolean | null;
  invitedByUserId: number | null;
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

function roleBadge(role: string) {
  const map: Record<string, string> = {
    admin: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
    director: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
    teacher: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
    head_of_study: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300",
    territorial_director: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
    user: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${map[role] ?? map.user}`}>
      {role.replace(/_/g, " ")}
    </span>
  );
}

// ── Add User Dialog ───────────────────────────────────────────────────────────
interface AddUserDialogProps {
  tenantId: number | null;
  schoolLabel: string;
  onClose: () => void;
  onSuccess: () => void;
}

function AddUserDialog({ tenantId, schoolLabel, onClose, onSuccess }: AddUserDialogProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"teacher" | "head_of_study" | "director" | "user">("teacher");

  const createMutation = trpc.director.createLocalUserWithTempPassword.useMutation({
    onSuccess: (data) => {
      toast.success(`User created. Temp password: ${data.tempPassword}`);
      navigator.clipboard.writeText(data.tempPassword).catch(() => {});
      onSuccess();
      onClose();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    createMutation.mutate({
      name: name.trim(),
      email: email.trim(),
      role,
      tenantId: tenantId ?? undefined,
    });
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget && !createMutation.isPending) onClose(); }}
    >
      <div className="bg-background rounded-xl shadow-2xl w-full max-w-md p-6 space-y-5" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-violet-100 dark:bg-violet-900">
              <UserPlus className="w-5 h-5 text-violet-600 dark:text-violet-300" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Add User</h2>
              <p className="text-xs text-muted-foreground truncate max-w-[220px]">{schoolLabel}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={createMutation.isPending}
            className="p-1.5 rounded-lg hover:bg-secondary transition-colors text-muted-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Full name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Maria García"
              required
              disabled={createMutation.isPending}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Email address</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. m.garcia@escola.cat"
              required
              disabled={createMutation.isPending}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Role</label>
            <Select value={role} onValueChange={(v) => setRole(v as typeof role)} disabled={createMutation.isPending}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="teacher">Teacher</SelectItem>
                <SelectItem value="head_of_study">Head of Study</SelectItem>
                <SelectItem value="director">Director</SelectItem>
                <SelectItem value="user">User</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3 text-xs text-amber-800 dark:text-amber-300">
            A temporary password will be generated and copied to your clipboard. The user will be prompted to set a new password on first sign-in.
          </div>

          <div className="flex gap-2 justify-end pt-1">
            <Button type="button" variant="outline" onClick={onClose} disabled={createMutation.isPending}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!name.trim() || !email.trim() || createMutation.isPending}
              className="gap-1.5"
            >
              {createMutation.isPending ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Creating…</>
              ) : (
                <><UserPlus className="w-4 h-4" /> Add User</>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AdminUserManagement() {
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [collapsedSchools, setCollapsedSchools] = useState<Set<string>>(new Set());
  const [addUserTarget, setAddUserTarget] = useState<{ tenantId: number | null; label: string } | null>(null);
  const [backfillOpen, setBackfillOpen] = useState(false);
  const [backfillSelections, setBackfillSelections] = useState<Record<number, number>>({});

  const { data: users = [], isLoading, refetch } = trpc.director.listAllLocalUsersForAdmin.useQuery();
  // Fetch director/admin users for backfill dropdown
  const { data: allAdminUsers = [] } = trpc.director.listAllUsersForAdmin.useQuery();
  const directors = (allAdminUsers as Array<{ id: number; name: string | null; email: string | null; role: string }>).filter((u) => u.role === "director" || u.role === "admin");
  const unassignedUsers = users.filter((u) => u.invitedByUserId == null && !u.deactivatedAt);
  const backfillMutation = trpc.director.backfillInvitedBy.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.updated} user${data.updated !== 1 ? "s" : ""} assigned to directors.`);
      refetch();
      setBackfillOpen(false);
      setBackfillSelections({});
    },
    onError: (err) => toast.error(err.message),
  });

  const resetMutation = trpc.director.adminRequestReset.useMutation({
    onSuccess: (data) => {
      toast.success("Password reset link generated.");
      navigator.clipboard.writeText(data.resetUrl).then(() => {
        toast.success("Reset link copied to clipboard.");
      }).catch(() => {});
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });
  const deactivateMutation = trpc.director.deactivateUser.useMutation({
    onSuccess: () => { toast.success("User deactivated."); refetch(); },
    onError: (err) => toast.error(err.message),
  });
  const reactivateMutation = trpc.director.reactivateUser.useMutation({
    onSuccess: () => { toast.success("User reactivated."); refetch(); },
    onError: (err) => toast.error(err.message),
  });
  const [deleteConfirmUserId, setDeleteConfirmUserId] = useState<number | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState<string>("");
  const deleteMutation = trpc.tenants.deleteUser.useMutation({
    onSuccess: () => {
      toast.success("User permanently deleted.");
      setDeleteConfirmUserId(null);
      refetch();
    },
    onError: (err) => {
      toast.error(err.message);
      setDeleteConfirmUserId(null);
    },
  });

  // Filter users
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return users.filter((u) => {
      const matchSearch =
        !q ||
        (u.displayName ?? "").toLowerCase().includes(q) ||
        (u.email ?? "").toLowerCase().includes(q) ||
        (u.tenantName ?? "").toLowerCase().includes(q) ||
        (u.schoolName ?? "").toLowerCase().includes(q);
      const matchRole = filterRole === "all" || u.role === filterRole;
      return matchSearch && matchRole;
    });
  }, [users, search, filterRole]);

  // Group by school
  const grouped = useMemo(() => {
    const map = new Map<string, { label: string; tenantId: number | null; users: AdminLocalUser[] }>();
    for (const u of filtered) {
      const key = u.tenantId != null ? String(u.tenantId) : "unassigned";
      const label = u.schoolName ?? u.tenantName ?? (u.tenantId != null ? `School #${u.tenantId}` : "Unassigned");
      if (!map.has(key)) map.set(key, { label, tenantId: u.tenantId, users: [] });
      map.get(key)!.users.push(u);
    }
    return Array.from(map.entries()).sort((a, b) => a[1].label.localeCompare(b[1].label));
  }, [filtered]);

  const toggleCollapse = (key: string) => {
    setCollapsedSchools((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const totalActive = users.filter((u) => !u.deactivatedAt).length;
  const totalDeactivated = users.filter((u) => !!u.deactivatedAt).length;

  return (
    <div className="container py-8 space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <BackButton className="mt-1.5" />
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-violet-100 dark:bg-violet-900">
            <Users className="w-6 h-6 text-violet-600 dark:text-violet-300" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">User Management</h1>
            <p className="text-sm text-muted-foreground">
              All local accounts across all schools — super-admin view
            </p>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3 flex flex-col items-center gap-1 text-center">
            <Users className="w-5 h-5 text-muted-foreground" />
            <span className="text-xl font-bold">{users.length}</span>
            <span className="text-xs text-muted-foreground">Total accounts</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 flex flex-col items-center gap-1 text-center">
            <UserCheck className="w-5 h-5 text-green-600" />
            <span className="text-xl font-bold text-green-700 dark:text-green-400">{totalActive}</span>
            <span className="text-xs text-muted-foreground">Active</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 flex flex-col items-center gap-1 text-center">
            <UserX className="w-5 h-5 text-red-500" />
            <span className="text-xl font-bold text-red-600 dark:text-red-400">{totalDeactivated}</span>
            <span className="text-xs text-muted-foreground">Deactivated</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 flex flex-col items-center gap-1 text-center">
            <Building2 className="w-5 h-5 text-purple-500" />
            <span className="text-xl font-bold text-purple-700 dark:text-purple-400">{grouped.length}</span>
            <span className="text-xs text-muted-foreground">Schools</span>
          </CardContent>
        </Card>
      </div>

      {/* Backfill alert — shown when there are active users with no director assigned */}
      {unassignedUsers.length > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                {unassignedUsers.length} user{unassignedUsers.length !== 1 ? "s" : ""} not assigned to a director
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                These users were created before director scoping was introduced. Assign them to a director so they appear in the correct director's User Management view.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="border-amber-400 text-amber-800 hover:bg-amber-100 dark:border-amber-600 dark:text-amber-300 dark:hover:bg-amber-900/40 shrink-0"
            onClick={() => setBackfillOpen(true)}
          >
            <Link2 className="w-3.5 h-3.5 mr-1.5" />
            Assign Directors
          </Button>
        </div>
      )}
      {/* Backfill modal */}
      {backfillOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setBackfillOpen(false)}>
          <div className="bg-background rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="font-semibold text-base">Assign Directors to Unassigned Users</h2>
              <button onClick={() => setBackfillOpen(false)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
            </div>
            <div className="overflow-y-auto flex-1 p-4 space-y-3">
              {unassignedUsers.map((u) => (
                <div key={u.id} className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{u.displayName ?? u.email ?? `User #${u.id}`}</p>
                    <p className="text-xs text-muted-foreground truncate">{u.email} · {u.tenantName ?? u.schoolName ?? "No school"}</p>
                  </div>
                  <Select
                    value={backfillSelections[u.id] != null ? String(backfillSelections[u.id]) : ""}
                    onValueChange={(val) => setBackfillSelections((prev) => ({ ...prev, [u.id]: Number(val) }))}
                  >
                    <SelectTrigger className="w-44 h-8 text-xs">
                      <SelectValue placeholder="Select director…" />
                    </SelectTrigger>
                    <SelectContent>
                      {directors.map((d) => (
                        <SelectItem key={d.id} value={String(d.id)}>
                          {d.name ?? d.email ?? `Director #${d.id}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
            <div className="p-4 border-t flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setBackfillOpen(false)}>Cancel</Button>
              <Button
                size="sm"
                disabled={backfillMutation.isPending || Object.keys(backfillSelections).length === 0}
                onClick={() => {
                  const assignments = Object.entries(backfillSelections).map(([userId, directorId]) => ({
                    userId: Number(userId),
                    directorId: Number(directorId),
                  }));
                  backfillMutation.mutate({ assignments });
                }}
              >
                {backfillMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Link2 className="w-3.5 h-3.5 mr-1.5" />}
                Save {Object.keys(backfillSelections).length > 0 ? `(${Object.keys(backfillSelections).length})` : ""}
              </Button>
            </div>
          </div>
        </div>
      )}
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, or school…"
            className="pl-9"
          />
        </div>
        <Select value={filterRole} onValueChange={setFilterRole}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="All roles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            <SelectItem value="teacher">Teacher</SelectItem>
            <SelectItem value="director">Director</SelectItem>
            <SelectItem value="head_of_study">Head of Study</SelectItem>
            <SelectItem value="user">User</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* School cards */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Loading users…</span>
        </div>
      ) : grouped.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
          <Users className="w-8 h-8 opacity-30" />
          <p className="text-sm">No users match the current filters.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(([key, group]) => {
            const isCollapsed = collapsedSchools.has(key);
            const activeCount = group.users.filter((u) => !u.deactivatedAt).length;
            return (
              <Card key={key}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    {/* Collapse toggle — only the chevron + icon + name are clickable */}
                    <button
                      className="flex items-center gap-2 flex-1 min-w-0 text-left"
                      onClick={() => toggleCollapse(key)}
                    >
                      {isCollapsed
                        ? <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                        : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                      }
                      {key === "unassigned"
                        ? <Globe className="w-4 h-4 text-muted-foreground shrink-0" />
                        : <Building2 className="w-4 h-4 text-purple-500 shrink-0" />
                      }
                      <span className="truncate">{group.label}</span>
                      <Badge variant="secondary" className="ml-2 text-xs shrink-0">
                        {activeCount} active / {group.users.length} total
                      </Badge>
                    </button>
                    {/* Add User button — stops propagation so it doesn't toggle collapse */}
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2.5 gap-1.5 text-xs shrink-0 border-violet-300 text-violet-700 hover:bg-violet-50 dark:border-violet-700 dark:text-violet-300 dark:hover:bg-violet-900/30"
                      onClick={(e) => {
                        e.stopPropagation();
                        setAddUserTarget({ tenantId: group.tenantId, label: group.label });
                      }}
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      Add User
                    </Button>
                  </CardTitle>
                </CardHeader>
                {!isCollapsed && (
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-muted/40">
                            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Name</th>
                            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Email</th>
                            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Role</th>
                            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Last Sign-in</th>
                            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Added by</th>
                            <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {group.users.map((user) => {
                            const isDeactivated = !!user.deactivatedAt;
                            return (
                              <tr key={user.id} className={`hover:bg-muted/30 transition-colors ${isDeactivated ? "opacity-60" : ""}`}>
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">{user.displayName ?? "—"}</span>
                                    {user.isPermanent === false && (
                                      <Badge className="text-[10px] px-1.5 py-0 bg-amber-500/20 text-amber-400 border border-amber-500/40 shrink-0">Temp</Badge>
                                    )}
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-muted-foreground">{user.email ?? "—"}</td>
                                <td className="px-4 py-3">{roleBadge(user.role)}</td>
                                <td className="px-4 py-3">
                                  {isDeactivated ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">
                                      <UserX className="w-3 h-3" /> Deactivated
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                                      <UserCheck className="w-3 h-3" /> Active
                                    </span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-muted-foreground text-xs">{formatDate(user.lastSignedIn)}</td>
                                <td className="px-4 py-3 text-xs text-muted-foreground">
                                  {user.invitedByUserId == null ? (
                                    <span className="text-violet-600 dark:text-violet-400 font-medium">Super-admin</span>
                                  ) : (
                                    <span>Director #{user.invitedByUserId}</span>
                                  )}
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center justify-end gap-1.5">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 px-2 gap-1 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                      disabled={resetMutation.isPending}
                                      onClick={() => resetMutation.mutate({ userId: user.id, origin: window.location.origin })}
                                    >
                                      <KeyRound className="w-3 h-3" />
                                      Reset
                                    </Button>
                                    {isDeactivated ? (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-7 px-2 gap-1 text-xs text-green-600 hover:text-green-700 hover:bg-green-50"
                                        disabled={reactivateMutation.isPending}
                                        onClick={() => reactivateMutation.mutate({ userId: user.id })}
                                      >
                                        <UserCheck className="w-3 h-3" />
                                        Reactivate
                                      </Button>
                                    ) : (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-7 px-2 gap-1 text-xs text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                                        disabled={deactivateMutation.isPending}
                                        onClick={() => deactivateMutation.mutate({ userId: user.id, reason: "Deactivated by super-admin" })}
                                      >
                                        <UserX className="w-3 h-3" />
                                        Deactivate
                                      </Button>
                                    )}
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 px-2 gap-1 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                                      disabled={deleteMutation.isPending}
                                      onClick={() => { setDeleteConfirmUserId(user.id); setDeleteConfirmName(user.displayName ?? user.email ?? `User #${user.id}`); }}
                                    >
                                      <Trash2 className="w-3 h-3" />
                                      Delete
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Add User Dialog */}
      {addUserTarget && (
        <AddUserDialog
          tenantId={addUserTarget.tenantId}
          schoolLabel={addUserTarget.label}
          onClose={() => setAddUserTarget(null)}
          onSuccess={() => refetch()}
        />
      )}

      {/* Delete User Confirmation Dialog */}
      {deleteConfirmUserId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl p-6 max-w-md w-full mx-4">
            <div className="flex items-start gap-3 mb-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">Permanently delete user?</h3>
                <p className="text-sm text-gray-500 mt-1">
                  This will permanently delete <span className="font-medium text-gray-800 dark:text-gray-200">{deleteConfirmName}</span> and all their associated data. This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeleteConfirmUserId(null)}
                disabled={deleteMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="bg-red-600 hover:bg-red-700 text-white"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate({ userId: deleteConfirmUserId })}
              >
                {deleteMutation.isPending ? (
                  <><Loader2 className="w-3 h-3 animate-spin mr-1" /> Deleting…</>
                ) : (
                  <><Trash2 className="w-3 h-3 mr-1" /> Delete permanently</>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
      {/* Powered by SEBA */}
      <p className="text-center text-xs text-muted-foreground pt-4">Powered by SEBA</p>
    </div>
  );
}
