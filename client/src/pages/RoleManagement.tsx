/**
 * RoleManagement — SEBA admin page for reassigning, promoting, or demoting
 * user roles across all categories: user, teacher, director, head_of_study,
 * territorial_director, admin.
 *
 * Accessible only from the secure admin (PIN-gated) Platform Tools section.
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useI18n, type TranslationKey } from "@/contexts/I18nContext";
import { trpc } from "@/lib/trpc";
import {
  Loader2,
  Search,
  Shield,
  ShieldCheck,
  ShieldAlert,
  UserCog,
  Users,
  Building2,
  GraduationCap,
  Globe,
  User,
  MapPin,
  Languages,
  Pencil,
  X,
  Check,
  KeyRound,
  RefreshCw,
  LockOpen,
  Lock,
  Eye,
  EyeOff,
  Copy,
} from "lucide-react";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useState, useMemo, useEffect } from "react";
import BackButton from "@/components/BackButton";
import { toast } from "sonner";
import { CATALONIA_SCHOOLS, CATALONIA_MUNICIPALITIES, SCHOOLS_BY_MUNICIPALITY } from "@/data/cataloniaSchools";

// ── Types ─────────────────────────────────────────────────────────────────────
type UserRole = "user" | "teacher" | "director" | "head_of_study" | "territorial_director" | "admin";

type ManagedUser = {
  id: number;
  name: string | null;
  displayName: string | null;
  email: string | null;
  role: string;
  position: string | null;
  tenantId: number | null;
  tenantName: string | null;
  lastSignedIn: Date | null;
  createdAt: Date | null;
  deactivatedAt: Date | null;
  schoolLocation: string | null;
  schoolLanguage: string | null;
  schoolName: string | null;
};

type PendingChange = { user: ManagedUser; newRole: UserRole };

// ── Role metadata ─────────────────────────────────────────────────────────────
const ROLE_META: Record<UserRole, { labelKey: TranslationKey; color: string; icon: React.ElementType }> = {
  user:                  { labelKey: "role_user",                  color: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",           icon: User },
  teacher:               { labelKey: "role_teacher",               color: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",               icon: GraduationCap },
  director:              { labelKey: "role_director",              color: "bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300",        icon: Building2 },
  head_of_study:         { labelKey: "role_head_of_study",         color: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",           icon: ShieldCheck },
  territorial_director:  { labelKey: "role_territorial_director",  color: "bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300",               icon: Globe },
  admin:                 { labelKey: "role_admin",                 color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",   icon: Shield },
};

const ALL_ROLES: UserRole[] = ["user", "teacher", "director", "head_of_study", "territorial_director", "admin"];

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatDate(date: Date | null): string {
  if (!date) return "—";
  return new Date(date).toLocaleString(undefined, {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function RoleBadge({ role, t }: { role: string; t: (k: TranslationKey) => string }) {
  const meta = ROLE_META[role as UserRole] ?? ROLE_META.user;
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${meta.color}`}>
      <Icon className="w-3 h-3" />
      {t(meta.labelKey)}
    </span>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function RoleManagement() {
  const { t } = useI18n();
  const utils = trpc.useUtils();
  const { data: users = [], isLoading, refetch } = trpc.director.listAllUsersForAdmin.useQuery();
  const roleMutation = trpc.director.updateUserRole.useMutation({
    onSuccess: (data) => {
      toast.success(t("role_mgmt_updated").replace("{role}", t(ROLE_META[data.newRole as UserRole]?.labelKey ?? "role_user")));
      // Refresh this page
      void refetch();
      // Invalidate TenantManagement queries so it reflects the updated role immediately
      void utils.tenants.list.invalidate();
      void utils.tenants.listUnassignedUsers.invalidate();
      void utils.tenants.listTerritorialDirectors.invalidate();
      void utils.tenants.listRoleAudit.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const bulkAssignMutation = trpc.tenants.bulkAssignUsers.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.assigned} user${data.assigned !== 1 ? "s" : ""} assigned to school successfully.`);
      setBulkAssignOpen(false);
      setBulkTenantId("");
      setSelectedIds(new Set());
      void refetch();
      void utils.tenants.list.invalidate();
      void utils.tenants.listUnassignedUsers.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState<string>("all");
  const [filterTenant, setFilterTenant] = useState<string>("all");
  const [pending, setPending] = useState<PendingChange | null>(null);

  // Director-specific extra fields shown in the confirmation dialog
  const [directorLocation, setDirectorLocation] = useState<string>("");
  const [directorLanguage, setDirectorLanguage] = useState<string>("");
  const [schoolSearch, setSchoolSearch] = useState<string>("");
  const [selectedSchool, setSelectedSchool] = useState<string>("");
  const [municipalityFilter, setMunicipalityFilter] = useState<string>("");

  // Bulk-assign selection for Unassigned filter view
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false);
  const [bulkTenantId, setBulkTenantId] = useState<string>("");

  // Inline user profile editing
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPosition, setEditPosition] = useState("");
  const [editSchoolName, setEditSchoolName] = useState("");

  const updateProfileMutation = trpc.director.updateUserProfile.useMutation({
    onSuccess: () => {
      toast.success("User profile updated.");
      setEditingUserId(null);
      void refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  function startEdit(u: ManagedUser) {
    setEditingUserId(u.id);
    setEditName(u.name ?? u.displayName ?? "");
    setEditEmail(u.email ?? "");
    setEditPosition(u.position ?? "");
    setEditSchoolName(u.schoolName ?? "");
  }

  function cancelEdit() {
    setEditingUserId(null);
  }

  function saveEdit(u: ManagedUser) {
    const payload: {
      userId: number;
      name?: string;
      email?: string;
      position?: string | null;
      schoolName?: string | null;
    } = { userId: u.id };
    if (editName.trim() && editName.trim() !== (u.displayName ?? "")) payload.name = editName.trim();
    if (editEmail.trim() && editEmail.trim() !== (u.email ?? "")) payload.email = editEmail.trim();
    if (editPosition !== (u.position ?? "")) payload.position = editPosition.trim() || null;
    if (editSchoolName !== (u.schoolName ?? "")) payload.schoolName = editSchoolName.trim() || null;
    updateProfileMutation.mutate(payload);
  }

  // Password Management card state
  const [pwdSearch, setPwdSearch] = useState("");
  const [pwdFilter, setPwdFilter] = useState<"all" | "set" | "not_set" | "must_change">("all");
  const [confirmResetUserId, setConfirmResetUserId] = useState<number | null>(null);
  const [pwdSelectedIds, setPwdSelectedIds] = useState<Set<number>>(new Set());
  const [bulkResetConfirm, setBulkResetConfirm] = useState(false);
  // Map of userId → { password, email, visible } revealed after a reset
  const [revealedPasswords, setRevealedPasswords] = useState<Record<number, { password: string; email: string; visible: boolean }>>({})
  // Map of userId → custom password input value (empty = auto-generate)
  const [customPasswordInputs, setCustomPasswordInputs] = useState<Record<number, string>>({})
  // Map of userId → whether to show the custom password input field
  const [showCustomInput, setShowCustomInput] = useState<Record<number, boolean>>({});
  const { data: pwdStatusUsers = [], isLoading: pwdLoading, refetch: refetchPwd } =
    trpc.director.listUsersPasswordStatus.useQuery();
  const resetPasswordMutation = trpc.director.adminResetUserPassword.useMutation({
    onSuccess: (data, variables) => {
      setRevealedPasswords(prev => ({
        ...prev,
        [variables.userId]: { password: data.tempPassword, email: data.email ?? "", visible: true },
      }));
      setConfirmResetUserId(null);
      void refetchPwd();
    },
    onError: (err) => {
      toast.error(err.message);
      setConfirmResetUserId(null);
    },
  });

  async function bulkResetPasswords(ids: number[]) {
    let done = 0;
    for (const id of ids) {
      try {
        await resetPasswordMutation.mutateAsync({ userId: id });
        done++;
      } catch { /* individual error already toasted */ }
    }
    toast.success(`${done} password${done !== 1 ? "s" : ""} reset and emailed.`);
    setPwdSelectedIds(new Set());
    setBulkResetConfirm(false);
    void refetchPwd();
  }

  // Reset selection when filter changes
  useEffect(() => {
    setSelectedIds(new Set());
  }, [filterRole]);

  // Reset director extras whenever a new pending change is set
  useEffect(() => {
    if (pending?.newRole === "director") {
      setDirectorLocation("");
      setDirectorLanguage("");
      setSchoolSearch("");
      setSelectedSchool("");
      setMunicipalityFilter("");
    }
  }, [pending]);

  // Filtered school list — filter by municipality first, then by 3+ char search
  const schoolMatches = useMemo(() => {
    const pool = municipalityFilter
      ? (SCHOOLS_BY_MUNICIPALITY[municipalityFilter] ?? [])
      : CATALONIA_SCHOOLS;
    if (!municipalityFilter && schoolSearch.trim().length < 3) return [];
    if (schoolSearch.trim().length === 0) return pool.slice(0, 100);
    const q = schoolSearch.trim().toLowerCase();
    return pool.filter((s) => s.toLowerCase().includes(q)).slice(0, 100);
  }, [schoolSearch, municipalityFilter]);

  // Derived tenant list for filter dropdown
  const tenants = useMemo(() => {
    const seen = new Map<string, string>();
    for (const u of users) {
      if (u.tenantId && u.tenantName) seen.set(String(u.tenantId), u.tenantName);
    }
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, [users]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return users.filter((u) => {
      const matchSearch =
        !q ||
        (u.displayName ?? "").toLowerCase().includes(q) ||
        (u.email ?? "").toLowerCase().includes(q) ||
        (u.tenantName ?? "").toLowerCase().includes(q);
      const matchRole =
        filterRole === "all" ||
        (filterRole === "unassigned" ? (u.role === "user" && !u.tenantId) : u.role === filterRole);
      const matchTenant = filterTenant === "all" || String(u.tenantId) === filterTenant;
      return matchSearch && matchRole && matchTenant;
    });
  }, [users, search, filterRole, filterTenant]);

  // Role counts for summary cards
  const roleCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const u of users) counts[u.role] = (counts[u.role] ?? 0) + 1;
    return counts;
  }, [users]);

  function handleRoleChange(user: ManagedUser, newRole: UserRole) {
    if (newRole === user.role) return;
    setPending({ user, newRole });
  }

  function confirmChange() {
    if (!pending) return;
    roleMutation.mutate({
      userId: pending.user.id,
      role: pending.newRole,
      ...(pending.newRole === "director" ? {
        schoolLocation: directorLocation || null,
        schoolLanguage: directorLanguage || null,
        schoolName: selectedSchool || null,
      } : {}),
    });
    setPending(null);
  }

  return (
    <div className="container py-8 space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <BackButton className="mt-1.5" />
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-violet-100 dark:bg-violet-900">
            <UserCog className="w-6 h-6 text-violet-600 dark:text-violet-300" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{t("role_mgmt_title")}</h1>
            <p className="text-sm text-muted-foreground">{t("role_mgmt_subtitle")}</p>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {ALL_ROLES.map((role) => {
          const meta = ROLE_META[role];
          const Icon = meta.icon;
          return (
            <Card key={role} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilterRole(filterRole === role ? "all" : role)}>
              <CardContent className="p-3 flex flex-col items-center gap-1 text-center">
                <Icon className="w-5 h-5 text-muted-foreground" />
                <span className="text-xl font-bold">{roleCounts[role] ?? 0}</span>
                <span className="text-xs text-muted-foreground">{t(meta.labelKey)}</span>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder={t("role_mgmt_search_placeholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={filterRole} onValueChange={setFilterRole}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder={t("role_mgmt_filter_role")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("role_mgmt_all_roles")}</SelectItem>
              {ALL_ROLES.map((r) => (
                <SelectItem key={r} value={r}>{t(ROLE_META[r].labelKey)}</SelectItem>
              ))}
              <SelectItem value="unassigned">Unassigned</SelectItem>
            </SelectContent>
          </Select>
          {tenants.length > 0 && (
            <Select value={filterTenant} onValueChange={setFilterTenant}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder={t("role_mgmt_filter_school")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("role_mgmt_all_schools")}</SelectItem>
                {tenants.map((tn) => (
                  <SelectItem key={tn.id} value={tn.id}>{tn.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </CardContent>
      </Card>

      {/* Bulk-assign toolbar — shown only when Unassigned filter is active and items are selected */}
      {filterRole === "unassigned" && selectedIds.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2 bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800 rounded-lg">
          <span className="text-sm font-medium text-violet-700 dark:text-violet-300">
            {selectedIds.size} user{selectedIds.size !== 1 ? "s" : ""} selected
          </span>
          <Button size="sm" variant="default" className="bg-violet-600 hover:bg-violet-700 text-white" onClick={() => setBulkAssignOpen(true)}>
            Assign to School
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>Clear</Button>
        </div>
      )}

      {/* Bulk-assign dialog */}
      <Dialog open={bulkAssignOpen} onOpenChange={setBulkAssignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign {selectedIds.size} user{selectedIds.size !== 1 ? "s" : ""} to a school</DialogTitle>
            <DialogDescription>Select the school to assign the selected users to. Their role will remain unchanged.</DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Select value={bulkTenantId} onValueChange={setBulkTenantId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a school..." />
              </SelectTrigger>
              <SelectContent>
                {tenants.map((tn) => (
                  <SelectItem key={tn.id} value={tn.id}>{tn.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setBulkAssignOpen(false)}>Cancel</Button>
            <Button
              disabled={!bulkTenantId || bulkAssignMutation.isPending}
              onClick={() => {
                if (!bulkTenantId) return;
                bulkAssignMutation.mutate({ userIds: Array.from(selectedIds), tenantId: Number(bulkTenantId) });
              }}
            >
              {bulkAssignMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Assign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* User table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-4 h-4" />
            {t("role_mgmt_users_count").replace("{n}", String(filtered.length))}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>{t("btn_loading")}</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">{t("role_mgmt_no_users")}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    {filterRole === "unassigned" && (
                      <th className="px-4 py-3 w-8">
                        <input
                          type="checkbox"
                          className="rounded"
                          checked={selectedIds.size === filtered.length && filtered.length > 0}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedIds(new Set(filtered.map(u => u.id)));
                            else setSelectedIds(new Set());
                          }}
                        />
                      </th>
                    )}
                    <th className="text-left px-4 py-3 font-medium">{t("role_mgmt_col_user")}</th>
                    <th className="text-left px-4 py-3 font-medium">{t("role_mgmt_col_school")}</th>
                    <th className="text-left px-4 py-3 font-medium">{t("role_mgmt_col_current_role")}</th>
                    <th className="text-left px-4 py-3 font-medium">{t("role_mgmt_col_assign_role")}</th>
                    {filterRole === "unassigned" ? (
                      <th className="text-left px-4 py-3 font-medium">Registered</th>
                    ) : (
                      <th className="text-left px-4 py-3 font-medium">{t("role_mgmt_col_last_seen")}</th>
                    )}
                    <th className="px-4 py-3 w-8" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((user) => (
                    <tr key={user.id} className={`group border-b last:border-0 hover:bg-muted/20 transition-colors ${user.deactivatedAt ? "opacity-50" : ""} ${selectedIds.has(user.id) ? "bg-violet-50 dark:bg-violet-950/20" : ""}`}>
                      {filterRole === "unassigned" && (
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            className="rounded"
                            checked={selectedIds.has(user.id)}
                            onChange={(e) => {
                              const next = new Set(selectedIds);
                              if (e.target.checked) next.add(user.id); else next.delete(user.id);
                              setSelectedIds(next);
                            }}
                          />
                        </td>
                      )}
                      <td className="px-4 py-3">
                        {editingUserId === user.id ? (
                          <div className="space-y-1.5">
                            <Input
                              className="h-7 text-xs"
                              placeholder="Name"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              onKeyDown={(e) => { if (e.key === "Enter") saveEdit(user); if (e.key === "Escape") cancelEdit(); }}
                            />
                            <Input
                              className="h-7 text-xs"
                              placeholder="Email"
                              value={editEmail}
                              onChange={(e) => setEditEmail(e.target.value)}
                              onKeyDown={(e) => { if (e.key === "Enter") saveEdit(user); if (e.key === "Escape") cancelEdit(); }}
                            />
                            <Input
                              className="h-7 text-xs"
                              placeholder="Position (optional)"
                              value={editPosition}
                              onChange={(e) => setEditPosition(e.target.value)}
                              onKeyDown={(e) => { if (e.key === "Enter") saveEdit(user); if (e.key === "Escape") cancelEdit(); }}
                            />
                            <Input
                              className="h-7 text-xs"
                              placeholder="School name (optional)"
                              value={editSchoolName}
                              onChange={(e) => setEditSchoolName(e.target.value)}
                              onKeyDown={(e) => { if (e.key === "Enter") saveEdit(user); if (e.key === "Escape") cancelEdit(); }}
                            />
                          </div>
                        ) : (
                          <>
                            <div className="font-medium">{user.name ?? user.displayName ?? user.email ?? `#${user.id}`}</div>
                            {(user.name ?? user.displayName) && user.email && (
                              <div className="text-xs text-muted-foreground">{user.email}</div>
                            )}
                            {user.position && (
                              <div className="text-xs text-muted-foreground italic">{user.position}</div>
                            )}
                            {user.deactivatedAt && (
                              <Badge variant="destructive" className="text-xs mt-0.5">{t("role_mgmt_deactivated")}</Badge>
                            )}
                          </>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {user.tenantName ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <RoleBadge role={user.role} t={t} />
                        {user.role === "director" && user.schoolName && (
                          <div className="mt-1 flex items-center gap-0.5 text-xs text-slate-600 dark:text-slate-400 max-w-[180px]">
                            <Building2 className="w-3 h-3 shrink-0" />
                            <span className="truncate" title={user.schoolName}>{user.schoolName}</span>
                          </div>
                        )}
                        {user.role === "director" && (user.schoolLocation || user.schoolLanguage) && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {user.schoolLocation && (
                              <span className="inline-flex items-center gap-0.5 text-xs text-violet-600 dark:text-violet-400">
                                <MapPin className="w-3 h-3" />
                                {user.schoolLocation === "historical_centre" ? "Historical Centre" : user.schoolLocation === "nucli_antic" ? "Nucli Antic" : user.schoolLocation}
                              </span>
                            )}
                            {user.schoolLanguage && (
                              <span className="inline-flex items-center gap-0.5 text-xs text-violet-600 dark:text-violet-400">
                                <Languages className="w-3 h-3" />
                                {user.schoolLanguage === "en" ? "English" : user.schoolLanguage === "es" ? "Spanish" : user.schoolLanguage === "ca" ? "Catalan" : user.schoolLanguage}
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Select
                          value={user.role}
                          onValueChange={(v) => handleRoleChange(user, v as UserRole)}
                          disabled={roleMutation.isPending}
                        >
                          <SelectTrigger className="w-48 h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ALL_ROLES.map((r) => (
                              <SelectItem key={r} value={r} className="text-xs">
                                {t(ROLE_META[r].labelKey)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {filterRole === "unassigned" ? formatDate(user.createdAt) : formatDate(user.lastSignedIn)}
                      </td>
                      <td className="px-4 py-3">
                        {editingUserId === user.id ? (
                          <div className="flex gap-1">
                            <button
                              type="button"
                              className="p-1 rounded hover:bg-green-100 dark:hover:bg-green-900 text-green-600 dark:text-green-400 disabled:opacity-50"
                              title="Save"
                              disabled={updateProfileMutation.isPending}
                              onClick={() => saveEdit(user)}
                            >
                              {updateProfileMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                            </button>
                            <button
                              type="button"
                              className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900 text-red-500"
                              title="Cancel"
                              onClick={cancelEdit}
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-muted text-muted-foreground"
                            title="Edit user"
                            onClick={() => startEdit(user)}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Password Management card ──────────────────────────────────────── */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="w-4 h-4 text-amber-500" />
            Password Management
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            View each user&apos;s password status and issue a new temporary password when needed.
            Passwords are stored as secure hashes and cannot be read — only reset.
          </p>
        </CardHeader>
        <CardContent>
          {/* Toolbar: search + filter + bulk reset */}
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <Input
                className="pl-8 text-sm"
                placeholder="Search by name, email or school…"
                value={pwdSearch}
                onChange={(e) => setPwdSearch(e.target.value)}
              />
            </div>
            {/* Status filter */}
            <Select value={pwdFilter} onValueChange={(v) => { setPwdFilter(v as typeof pwdFilter); setPwdSelectedIds(new Set()); }}>
              <SelectTrigger className="w-[170px] text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All users</SelectItem>
                <SelectItem value="set">Password set</SelectItem>
                <SelectItem value="not_set">No password</SelectItem>
                <SelectItem value="must_change">Must change</SelectItem>
              </SelectContent>
            </Select>
            {/* Bulk reset */}
            {pwdSelectedIds.size > 0 && (
              bulkResetConfirm ? (
                <span className="inline-flex items-center gap-1">
                  <span className="text-xs text-muted-foreground">Reset {pwdSelectedIds.size} user{pwdSelectedIds.size !== 1 ? "s" : ""}?</span>
                  <button
                    className="p-1 rounded text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20"
                    onClick={() => bulkResetPasswords(Array.from(pwdSelectedIds))}
                    title="Confirm bulk reset"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button
                    className="p-1 rounded text-muted-foreground hover:bg-muted"
                    onClick={() => setBulkResetConfirm(false)}
                    title="Cancel"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs gap-1 border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400"
                  onClick={() => setBulkResetConfirm(true)}
                >
                  <KeyRound className="w-3 h-3" />
                  Reset {pwdSelectedIds.size} selected
                </Button>
              )
            )}
          </div>

          {pwdLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : (() => {
            const filtered = pwdStatusUsers.filter((u) => {
              // text search
              if (pwdSearch.trim()) {
                const q = pwdSearch.toLowerCase();
                const match =
                  (u.name ?? "").toLowerCase().includes(q) ||
                  (u.displayName ?? "").toLowerCase().includes(q) ||
                  (u.email ?? "").toLowerCase().includes(q) ||
                  (u.schoolName ?? "").toLowerCase().includes(q);
                if (!match) return false;
              }
              // status filter
              if (pwdFilter === "set") return u.hasPassword;
              if (pwdFilter === "not_set") return !u.hasPassword;
              if (pwdFilter === "must_change") return !!u.mustChangePassword;
              return true;
            });
            const allFilteredIds = filtered.filter(u => !!u.email).map(u => u.id);
            const allChecked = allFilteredIds.length > 0 && allFilteredIds.every(id => pwdSelectedIds.has(id));
            return (
              <div className="overflow-x-auto rounded border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/40 border-b border-border">
                      <th className="px-3 py-2 w-8">
                        <input
                          type="checkbox"
                          className="rounded"
                          checked={allChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setPwdSelectedIds(new Set(allFilteredIds));
                            } else {
                              setPwdSelectedIds(new Set());
                            }
                          }}
                          title="Select all"
                        />
                      </th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">User</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Role</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">School</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Password</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Status</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Last Sign-in</th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filtered.map((u) => {
                      const displayName = u.name ?? u.displayName ?? u.email ?? `#${u.id}`;
                      const isResetting = resetPasswordMutation.isPending && confirmResetUserId === u.id;
                      const isChecked = pwdSelectedIds.has(u.id);
                      return (
                        <tr key={u.id} className={`hover:bg-muted/20 transition-colors ${isChecked ? "bg-amber-50/40 dark:bg-amber-900/10" : ""}`}>
                          {/* Checkbox */}
                          <td className="px-3 py-2">
                            <input
                              type="checkbox"
                              className="rounded"
                              checked={isChecked}
                              disabled={!u.email}
                              onChange={(e) => {
                                const next = new Set(pwdSelectedIds);
                                if (e.target.checked) next.add(u.id); else next.delete(u.id);
                                setPwdSelectedIds(next);
                              }}
                            />
                          </td>
                          {/* User */}
                          <td className="px-3 py-2">
                            <div className="font-medium truncate max-w-[160px]">{displayName}</div>
                            {u.email && displayName !== u.email && (
                              <div className="text-xs text-muted-foreground truncate max-w-[160px]">{u.email}</div>
                            )}
                          </td>
                          {/* Role */}
                          <td className="px-3 py-2">
                            <RoleBadge role={u.role ?? "user"} t={t} />
                          </td>
                          {/* School */}
                          <td className="px-3 py-2 text-xs text-muted-foreground max-w-[140px] truncate">
                            {u.schoolName ?? <span className="italic">—</span>}
                          </td>
                          {/* Password set? */}
                          <td className="px-3 py-2">
                            {u.hasPassword ? (
                              <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                                <Lock className="w-3 h-3" /> Set
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                <LockOpen className="w-3 h-3" /> Not set
                              </span>
                            )}
                          </td>
                          {/* mustChangePassword */}
                          <td className="px-3 py-2">
                            {u.mustChangePassword ? (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                                <RefreshCw className="w-3 h-3" /> Must change
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>
                          {/* Last sign-in */}
                          <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                            {formatDate(u.lastSignedIn)}
                          </td>
                          {/* Reset / reveal column */}
                          <td className="px-3 py-2">
                            <div className="flex flex-col gap-1.5 items-end">
                              {/* Revealed password display */}
                              {revealedPasswords[u.id] && (
                                <div className="flex items-center gap-1 bg-muted/60 border border-border rounded px-2 py-1 text-xs font-mono">
                                  <span className="select-all">
                                    {revealedPasswords[u.id].visible
                                      ? revealedPasswords[u.id].password
                                      : "•".repeat(revealedPasswords[u.id].password.length)}
                                  </span>
                                  <button
                                    className="p-0.5 rounded hover:bg-muted text-muted-foreground"
                                    title={revealedPasswords[u.id].visible ? "Hide" : "Show"}
                                    onClick={() => setRevealedPasswords(prev => ({
                                      ...prev,
                                      [u.id]: { ...prev[u.id], visible: !prev[u.id].visible },
                                    }))}
                                  >
                                    {revealedPasswords[u.id].visible
                                      ? <EyeOff className="w-3 h-3" />
                                      : <Eye className="w-3 h-3" />}
                                  </button>
                                  <button
                                    className="p-0.5 rounded hover:bg-muted text-muted-foreground"
                                    title="Copy password only"
                                    onClick={() => {
                                      void navigator.clipboard.writeText(revealedPasswords[u.id].password);
                                      toast.success("Password copied to clipboard");
                                    }}
                                  >
                                    <Copy className="w-3 h-3" />
                                  </button>
                                  {/* Divider */}
                                  <span className="text-border select-none">|</span>
                                  {/* Copy credentials (email + password) */}
                                  <button
                                    className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-primary/10 hover:bg-primary/20 text-primary text-[10px] font-sans font-medium whitespace-nowrap"
                                    title="Copy email and password together"
                                    onClick={() => {
                                      const text = `Email: ${revealedPasswords[u.id].email}\nPassword: ${revealedPasswords[u.id].password}`;
                                      void navigator.clipboard.writeText(text);
                                      toast.success("Email + password copied to clipboard");
                                    }}
                                  >
                                    <Copy className="w-2.5 h-2.5" />
                                    Both
                                  </button>
                                  <button
                                    className="p-0.5 rounded hover:bg-muted text-muted-foreground"
                                    title="Dismiss"
                                    onClick={() => setRevealedPasswords(prev => { const n = { ...prev }; delete n[u.id]; return n; })}
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              )}

                              {/* Custom password input toggle */}
                              {confirmResetUserId === u.id && (
                                <div className="flex flex-col gap-1 w-full">
                                  <button
                                    className="text-xs text-muted-foreground underline underline-offset-2 text-right"
                                    onClick={() => setShowCustomInput(prev => ({ ...prev, [u.id]: !prev[u.id] }))}
                                  >
                                    {showCustomInput[u.id] ? "Use auto-generated" : "Set custom password"}
                                  </button>
                                  {showCustomInput[u.id] && (
                                    <input
                                      type="text"
                                      className="w-full rounded border border-border bg-background px-2 py-1 text-xs font-mono"
                                      placeholder="Min 6 characters"
                                      value={customPasswordInputs[u.id] ?? ""}
                                      onChange={(e) => setCustomPasswordInputs(prev => ({ ...prev, [u.id]: e.target.value }))}
                                      autoFocus
                                    />
                                  )}
                                </div>
                              )}

                              {/* Confirm / Reset buttons */}
                              {confirmResetUserId === u.id ? (
                                <span className="inline-flex items-center gap-1">
                                  <span className="text-xs text-muted-foreground mr-1">Confirm?</span>
                                  <button
                                    className="p-1 rounded text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20"
                                    disabled={isResetting || (showCustomInput[u.id] && (customPasswordInputs[u.id] ?? "").length < 6)}
                                    onClick={() => resetPasswordMutation.mutate({
                                      userId: u.id,
                                      customPassword: showCustomInput[u.id] && customPasswordInputs[u.id]
                                        ? customPasswordInputs[u.id]
                                        : undefined,
                                    })}
                                    title="Yes, set password"
                                  >
                                    {isResetting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                                  </button>
                                  <button
                                    className="p-1 rounded text-muted-foreground hover:bg-muted"
                                    onClick={() => {
                                      setConfirmResetUserId(null);
                                      setShowCustomInput(prev => { const n = { ...prev }; delete n[u.id]; return n; });
                                      setCustomPasswordInputs(prev => { const n = { ...prev }; delete n[u.id]; return n; });
                                    }}
                                    title="Cancel"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </span>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs gap-1"
                                  disabled={!u.email}
                                  title={!u.email ? "No email address on file" : "Set or reset password"}
                                  onClick={() => setConfirmResetUserId(u.id)}
                                >
                                  <KeyRound className="w-3 h-3" />
                                  {revealedPasswords[u.id] ? "Reset again" : "Set / Reset"}
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {filtered.length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-3 py-6 text-center text-sm text-muted-foreground">
                          No users match the current filter.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            );
          })()}
        </CardContent>
      </Card>

      {/* Confirmation dialog */}
      <Dialog open={!!pending} onOpenChange={(open) => !open && setPending(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-amber-500" />
              {t("role_mgmt_confirm_title")}
            </DialogTitle>
            <DialogDescription>
              {pending && t("role_mgmt_confirm_desc")
                .replace("{name}", pending.user.name ?? pending.user.displayName ?? pending.user.email ?? `#${pending.user.id}`)
                .replace("{from}", t(ROLE_META[pending.user.role as UserRole]?.labelKey ?? "role_user"))
                .replace("{to}", t(ROLE_META[pending.newRole]?.labelKey ?? "role_user"))}
            </DialogDescription>
          </DialogHeader>

          {/* Director-specific extra fields */}
          {pending?.newRole === "director" && (
            <div className="space-y-4 py-2">

              {/* ── Municipality filter ── */}
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5 text-sm font-medium">
                  <Globe className="w-3.5 h-3.5 text-violet-500" />
                  Municipality
                  <span className="text-xs font-normal text-muted-foreground ml-1">(optional — narrows the school list)</span>
                </Label>
                <Select value={municipalityFilter} onValueChange={(v) => { setMunicipalityFilter(v === "__all__" ? "" : v); setSchoolSearch(""); setSelectedSchool(""); }}>
                  <SelectTrigger className="w-full text-sm">
                    <SelectValue placeholder="All municipalities…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All municipalities</SelectItem>
                    {CATALONIA_MUNICIPALITIES.map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* ── School search ── */}
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5 text-sm font-medium">
                  <Building2 className="w-3.5 h-3.5 text-violet-500" />
                  School Name
                  {!municipalityFilter && <span className="text-xs font-normal text-muted-foreground ml-1">(type 3+ letters to search)</span>}
                  {municipalityFilter && <span className="text-xs font-normal text-muted-foreground ml-1">(showing schools in {municipalityFilter})</span>}
                </Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                  <Input
                    className="pl-8 text-sm"
                    placeholder={municipalityFilter ? `Search in ${municipalityFilter}…` : "e.g. Escola Sant…"}
                    value={schoolSearch}
                    onChange={(e) => {
                      setSchoolSearch(e.target.value);
                      if (selectedSchool && !e.target.value) setSelectedSchool("");
                    }}
                  />
                </div>

                {/* Selected school badge */}
                {selectedSchool && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800 rounded text-xs text-violet-700 dark:text-violet-300">
                    <Building2 className="w-3 h-3 shrink-0" />
                    <span className="truncate">{selectedSchool}</span>
                    <button
                      type="button"
                      className="ml-auto shrink-0 text-violet-400 hover:text-violet-600"
                      onClick={() => { setSelectedSchool(""); setSchoolSearch(""); }}
                    >
                      ✕
                    </button>
                  </div>
                )}

                {/* Scrollable results list */}
                {schoolMatches.length > 0 && !selectedSchool && (
                  <ScrollArea className="h-48 border rounded-md bg-popover">
                    <div className="p-1">
                      {schoolMatches.map((school) => (
                        <button
                          key={school}
                          type="button"
                          className="w-full text-left px-3 py-1.5 text-sm rounded hover:bg-violet-50 dark:hover:bg-violet-950/30 hover:text-violet-700 dark:hover:text-violet-300 transition-colors"
                          onClick={() => {
                            setSelectedSchool(school);
                            setSchoolSearch(school);
                          }}
                        >
                          {school}
                        </button>
                      ))}
                      {schoolMatches.length === 100 && (
                        <p className="px-3 py-1.5 text-xs text-muted-foreground italic">Showing first 100 results — refine your search</p>
                      )}
                    </div>
                  </ScrollArea>
                )}

                {schoolSearch.trim().length >= 3 && schoolMatches.length === 0 && !selectedSchool && (
                  <p className="text-xs text-muted-foreground px-1">No schools found matching "{schoolSearch}"</p>
                )}
              </div>

              {/* ── Location ── */}
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5 text-sm font-medium">
                  <MapPin className="w-3.5 h-3.5 text-violet-500" />
                  School Location
                </Label>
                <Select value={directorLocation} onValueChange={setDirectorLocation}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select location…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="historical_centre">Historical Centre</SelectItem>
                    <SelectItem value="nucli_antic">Nucli Antic</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* ── Language ── */}
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5 text-sm font-medium">
                  <Languages className="w-3.5 h-3.5 text-violet-500" />
                  School Language
                </Label>
                <Select value={directorLanguage} onValueChange={setDirectorLanguage}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select language…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="es">Spanish (Español)</SelectItem>
                    <SelectItem value="ca">Catalan (Català)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <p className="text-xs text-muted-foreground">
                These details help identify the school. They are optional and can be updated later.
              </p>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setPending(null)}>{t("btn_cancel")}</Button>
            <Button
              onClick={confirmChange}
              disabled={roleMutation.isPending}
              className="bg-violet-600 hover:bg-violet-700 text-white"
            >
              {roleMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {t("role_mgmt_confirm_btn")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
