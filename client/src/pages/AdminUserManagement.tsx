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
  User,
  ShieldCheck,
  Building2,
  UserX,
  UserCheck,
  KeyRound,
  ChevronDown,
  ChevronRight,
  Globe,
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
  const map: Record<string, { label: string; className: string }> = {
    admin:                { label: "Admin",              className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300" },
    director:             { label: "Director",           className: "bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300" },
    teacher:              { label: "Teacher",            className: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" },
    head_of_study:        { label: "Head of Study",      className: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300" },
    territorial_director: { label: "Territorial Dir.",   className: "bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300" },
    user:                 { label: "User",               className: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
  };
  const m = map[role] ?? map.user;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${m.className}`}>
      {m.label}
    </span>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function AdminUserManagement() {
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [collapsedSchools, setCollapsedSchools] = useState<Set<string>>(new Set());

  const { data: users = [], isLoading, refetch } = trpc.director.listAllLocalUsersForAdmin.useQuery();

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
    const map = new Map<string, { label: string; users: AdminLocalUser[] }>();
    for (const u of filtered) {
      const key = u.tenantId != null ? String(u.tenantId) : "unassigned";
      const label = u.schoolName ?? u.tenantName ?? (u.tenantId != null ? `School #${u.tenantId}` : "Unassigned");
      if (!map.has(key)) map.set(key, { label, users: [] });
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
            <UserCheck className="w-5 h-5 text-green-500" />
            <span className="text-xl font-bold">{totalActive}</span>
            <span className="text-xs text-muted-foreground">Active</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 flex flex-col items-center gap-1 text-center">
            <UserX className="w-5 h-5 text-amber-500" />
            <span className="text-xl font-bold">{totalDeactivated}</span>
            <span className="text-xs text-muted-foreground">Deactivated</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 flex flex-col items-center gap-1 text-center">
            <Building2 className="w-5 h-5 text-purple-500" />
            <span className="text-xl font-bold">{grouped.length}</span>
            <span className="text-xs text-muted-foreground">Schools</span>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search by name, email, or school…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
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
              <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Grouped tables */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
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
                <CardHeader
                  className="pb-2 cursor-pointer select-none"
                  onClick={() => toggleCollapse(key)}
                >
                  <CardTitle className="text-base flex items-center gap-2">
                    {isCollapsed
                      ? <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      : <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    }
                    {key === "unassigned"
                      ? <Globe className="w-4 h-4 text-muted-foreground" />
                      : <Building2 className="w-4 h-4 text-purple-500" />
                    }
                    <span>{group.label}</span>
                    <Badge variant="secondary" className="ml-auto text-xs">
                      {activeCount} active / {group.users.length} total
                    </Badge>
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
                        <tbody>
                          {group.users.map((user) => {
                            const isDeactivated = !!user.deactivatedAt;
                            return (
                              <tr
                                key={user.id}
                                className={`border-b last:border-0 transition-colors ${isDeactivated ? "opacity-60 bg-muted/10" : "hover:bg-muted/20"}`}
                              >
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                      {user.role === "admin"
                                        ? <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                                        : <User className="h-3.5 w-3.5 text-muted-foreground" />
                                      }
                                    </div>
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

      {/* Powered by SEBA */}
      <p className="text-center text-xs text-muted-foreground pt-4">Powered by SEBA</p>
    </div>
  );
}
