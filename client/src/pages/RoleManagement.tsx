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
} from "lucide-react";
import { Label } from "@/components/ui/label";
import { useState, useMemo, useEffect } from "react";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────────
type UserRole = "user" | "teacher" | "director" | "head_of_study" | "territorial_director" | "admin";

type ManagedUser = {
  id: number;
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

  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState<string>("all");
  const [filterTenant, setFilterTenant] = useState<string>("all");
  const [pending, setPending] = useState<PendingChange | null>(null);

  // Director-specific extra fields shown in the confirmation dialog
  const [directorLocation, setDirectorLocation] = useState<string>("");
  const [directorLanguage, setDirectorLanguage] = useState<string>("");

  // Reset director extras whenever a new pending change is set
  useEffect(() => {
    if (pending?.newRole === "director") {
      setDirectorLocation("");
      setDirectorLanguage("");
    }
  }, [pending]);

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
      const matchRole = filterRole === "all" || u.role === filterRole;
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
      } : {}),
    });
    setPending(null);
  }

  return (
    <div className="container py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-violet-100 dark:bg-violet-900">
          <UserCog className="w-6 h-6 text-violet-600 dark:text-violet-300" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">{t("role_mgmt_title")}</h1>
          <p className="text-sm text-muted-foreground">{t("role_mgmt_subtitle")}</p>
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
                    <th className="text-left px-4 py-3 font-medium">{t("role_mgmt_col_user")}</th>
                    <th className="text-left px-4 py-3 font-medium">{t("role_mgmt_col_school")}</th>
                    <th className="text-left px-4 py-3 font-medium">{t("role_mgmt_col_current_role")}</th>
                    <th className="text-left px-4 py-3 font-medium">{t("role_mgmt_col_assign_role")}</th>
                    <th className="text-left px-4 py-3 font-medium">{t("role_mgmt_col_last_seen")}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((user) => (
                    <tr key={user.id} className={`border-b last:border-0 hover:bg-muted/20 transition-colors ${user.deactivatedAt ? "opacity-50" : ""}`}>
                      <td className="px-4 py-3">
                        <div className="font-medium">{user.displayName ?? user.email ?? `#${user.id}`}</div>
                        {user.displayName && user.email && (
                          <div className="text-xs text-muted-foreground">{user.email}</div>
                        )}
                        {user.deactivatedAt && (
                          <Badge variant="destructive" className="text-xs mt-0.5">{t("role_mgmt_deactivated")}</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {user.tenantName ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <RoleBadge role={user.role} t={t} />
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
                        {formatDate(user.lastSignedIn)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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
                .replace("{name}", pending.user.displayName ?? pending.user.email ?? `#${pending.user.id}`)
                .replace("{from}", t(ROLE_META[pending.user.role as UserRole]?.labelKey ?? "role_user"))
                .replace("{to}", t(ROLE_META[pending.newRole]?.labelKey ?? "role_user"))}
            </DialogDescription>
          </DialogHeader>

          {/* Director-specific extra fields */}
          {pending?.newRole === "director" && (
            <div className="space-y-4 py-2">
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
