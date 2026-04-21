/**
 * TenantManagement.tsx
 * SEBA super-admin page for cross-tenant management.
 * Only accessible to users with role === 'admin'.
 *
 * Tabs:
 *  1. Schools — manage tenants, assign users
 *  2. Territorial Directors — grant/revoke role, assign territories
 *  3. Role Audit Log — immutable history of every role change
 */

import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Building2,
  Users,
  Plus,
  UserPlus,
  Trash2,
  MapPin,
  Shield,
  ShieldOff,
  X,
  ClipboardList,
  Search,
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  UserCog,
  GraduationCap,
  Globe,
  ShieldCheck,
  User,
  CircleCheck,
  CircleX,
  Pencil,
} from "lucide-react";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { CATALONIA_MUNICIPALITIES, SCHOOLS_BY_MUNICIPALITY, CATALONIA_SCHOOLS, MUNICIPALITIES_BY_COMARCA, CATALONIA_COMARQUES } from "@/data/cataloniaSchools";
import { ScrollArea } from "@/components/ui/scroll-area";

// ── Role badge metadata ─────────────────────────────────────────────────────
const ROLE_META: Record<string, { label: string; color: string; Icon: React.ElementType }> = {
  user:                 { label: "User",                color: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",          Icon: User },
  teacher:              { label: "Teacher",             color: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",              Icon: GraduationCap },
  director:             { label: "Director",            color: "bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300",       Icon: Building2 },
  head_of_study:        { label: "Head of Study",       color: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",          Icon: ShieldCheck },
  territorial_director: { label: "Territorial Dir.",    color: "bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300",             Icon: Globe },
  admin:                { label: "Admin",               color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",  Icon: Shield },
};

function OwnerRoleBadge({ role }: { role: string | null }) {
  if (!role) return null;
  const meta = ROLE_META[role] ?? ROLE_META.user;
  const { Icon } = meta;
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${meta.color}`}>
      <Icon className="w-2.5 h-2.5" />
      {meta.label}
    </span>
  );
}

function OwnerStatusPill({ deactivatedAt }: { deactivatedAt: Date | null }) {
  if (deactivatedAt) {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
        <CircleX className="w-2.5 h-2.5" />
        Deactivated
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">
      <CircleCheck className="w-2.5 h-2.5" />
      Active
    </span>
  );
}

// ── Role label formatter ────────────────────────────────────────────────────
const ROLE_LABELS: Record<string, string> = {
  user: "User",
  teacher: "Teacher",
  director: "Director",
  head_of_study: "Head of Study",
  territorial_director: "Territorial Director",
  admin: "Admin",
};
function formatRole(raw: string | null): string {
  if (!raw) return "—";
  return ROLE_LABELS[raw] ?? raw.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

// ── Action badge colours ──────────────────────────────────────────────────────
const actionBadge: Record<string, string> = {
  grant: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  revoke: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  assign_territory: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  remove_territory: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
};

export default function TenantManagement() {
  const { user, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();

  // ── Schools tab state ──────────────────────────────────────────────────────
  const [schoolMunicipalityFilter, setSchoolMunicipalityFilter] = useState("");
  const [schoolNameSearch, setSchoolNameSearch] = useState("");
  const [directorStatusFilter, setDirectorStatusFilter] = useState<"all" | "active" | "deactivated">("all");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [newTenantName, setNewTenantName] = useState("");
  const [newOwnerUserId, setNewOwnerUserId] = useState("");
  // Create-with-owner state
  const [createMode, setCreateMode] = useState<"existing" | "new">("existing");
  const [newOwnerName, setNewOwnerName] = useState("");
  const [newOwnerEmail, setNewOwnerEmail] = useState("");
  const [newOwnerPassword, setNewOwnerPassword] = useState("");
  const [showOwnerPassword, setShowOwnerPassword] = useState(false);
  const [createWithOwnerSuccess, setCreateWithOwnerSuccess] = useState<{ tenantName: string; ownerName: string; ownerEmail: string } | null>(null);
  const [assignUserId, setAssignUserId] = useState("");
  const [assignToTenantId, setAssignToTenantId] = useState("");
  const [assignSchoolSearch, setAssignSchoolSearch] = useState("");
  const [assignSelectedSchool, setAssignSelectedSchool] = useState("");
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [editingUserName, setEditingUserName] = useState("");
  const [editingTenantId, setEditingTenantId] = useState<number | null>(null);
  const [editingTenantName, setEditingTenantName] = useState("");

  // ── Territorial Directors tab state ────────────────────────────────────────
  const [grantDialogOpen, setGrantDialogOpen] = useState(false);
  const [grantEmailSearch, setGrantEmailSearch] = useState("");
  const [grantSelectedUser, setGrantSelectedUser] = useState<{ id: number; name: string | null; email: string | null } | null>(null);
  const [grantTerritoryId, setGrantTerritoryId] = useState("");
  const [grantReason, setGrantReason] = useState("");
  const [grantSuccessUser, setGrantSuccessUser] = useState<{ id: number; name: string | null } | null>(null);
  const [addTerritoryDialogUserId, setAddTerritoryDialogUserId] = useState<number | null>(null);
  const [addTerritoryId, setAddTerritoryId] = useState("");

  // ── Director Invite state ──────────────────────────────────────────────────
  const [inviteDialogTenantId, setInviteDialogTenantId] = useState<number | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteResult, setInviteResult] = useState<{ token: string; tenantName: string; expiresAt: Date } | null>(null);
  const [inviteCopied, setInviteCopied] = useState(false);

  // ── Tenant-to-territory state ─────────────────────────────────────────────
  const [tenantTerritoryDialogId, setTenantTerritoryDialogId] = useState<number | null>(null);
  const [tenantTerritoryId, setTenantTerritoryId] = useState("");

  // ── Audit tab state ────────────────────────────────────────────────────────
  const [auditOffset, setAuditOffset] = useState(0);
  const AUDIT_PAGE_SIZE = 25;

  const utils = trpc.useUtils();

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: tenantList, isLoading: tenantsLoading } = trpc.tenants.list.useQuery();
  const { data: unassignedUsers } = trpc.tenants.listUnassignedUsers.useQuery();
  const { data: territorialDirectors, isLoading: tdLoading } = trpc.tenants.listTerritorialDirectors.useQuery();
  const { data: allTerritories } = trpc.tenants.listTerritories.useQuery();
  const { data: auditRecords, isLoading: auditLoading } = trpc.tenants.listRoleAudit.useQuery({
    limit: AUDIT_PAGE_SIZE,
    offset: auditOffset,
  });

  // Filtered tenant list (municipality + name search + director status)
  const filteredTenants = useMemo(() => {
    if (!tenantList) return [];
    let result = tenantList;
    if (schoolMunicipalityFilter) {
      const schoolsInMunicipality = new Set(
        (SCHOOLS_BY_MUNICIPALITY[schoolMunicipalityFilter] ?? []).map((s) => s.toLowerCase())
      );
      result = result.filter((t) => {
        const ownerSchoolName = (t as any).ownerSchoolName as string | null;
        return ownerSchoolName && schoolsInMunicipality.has(ownerSchoolName.toLowerCase());
      });
    }
    if (schoolNameSearch.trim().length >= 2) {
      const q = schoolNameSearch.trim().toLowerCase();
      result = result.filter((t) =>
        t.name.toLowerCase().includes(q) ||
        ((t as any).ownerName as string | null)?.toLowerCase().includes(q) ||
        ((t as any).ownerSchoolName as string | null)?.toLowerCase().includes(q)
      );
    }
    if (directorStatusFilter !== "all") {
      result = result.filter((t) => {
        const deactivatedAt = (t as any).ownerDeactivatedAt as string | null;
        const isDeactivated = !!deactivatedAt;
        return directorStatusFilter === "deactivated" ? isDeactivated : !isDeactivated;
      });
    }
    return result;
  }, [tenantList, schoolMunicipalityFilter, schoolNameSearch, directorStatusFilter]);

  // Email search (only fires when ≥ 3 chars)
  const emailSearchEnabled = grantEmailSearch.length >= 3;
  const { data: emailSearchResults } = trpc.tenants.findUserByEmail.useQuery(
    { email: grantEmailSearch },
    { enabled: emailSearchEnabled }
  );

  // ── Mutations: Schools ─────────────────────────────────────────────────────
  const createMutation = trpc.tenants.create.useMutation({
    onSuccess: () => {
      utils.tenants.list.invalidate();
      utils.tenants.listUnassignedUsers.invalidate();
      setCreateDialogOpen(false);
      setNewTenantName("");
      setNewOwnerUserId("");
      toast.success("Tenant created successfully.");
    },
    onError: (err) => toast.error(err.message),
  });

  const createWithOwnerMutation = trpc.tenants.createWithOwner.useMutation({
    onSuccess: (data) => {
      utils.tenants.list.invalidate();
      utils.tenants.listUnassignedUsers.invalidate();
      setCreateWithOwnerSuccess({ tenantName: data.tenantName, ownerName: data.ownerName, ownerEmail: data.ownerEmail });
      toast.success(`Tenant "${data.tenantName}" created with owner ${data.ownerName}.`);
    },
    onError: (err) => toast.error(err.message),
  });

  const assignMutation = trpc.tenants.assignUser.useMutation({
    onSuccess: () => {
      utils.tenants.list.invalidate();
      utils.tenants.listUnassignedUsers.invalidate();
      setAssignDialogOpen(false);
      setAssignUserId("");
      setAssignToTenantId("");
      toast.success("User assigned to tenant.");
    },
    onError: (err) => toast.error(err.message),
  });

  const updateUserNameMutation = trpc.tenants.updateUserName.useMutation({
    onSuccess: () => {
      utils.tenants.listUnassignedUsers.invalidate();
      setEditingUserId(null);
      setEditingUserName("");
      toast.success("Name updated.");
    },
    onError: (err) => toast.error(err.message),
  });
  const deleteMutation = trpc.tenants.delete.useMutation({
    onSuccess: () => {
      utils.tenants.list.invalidate();
      utils.tenants.listUnassignedUsers.invalidate();
      toast.success("Tenant deleted. Users are now unassigned.");
    },
    onError: (err) => toast.error(err.message),
  });
  const editTenantMutation = trpc.tenants.updateName.useMutation({
    onSuccess: () => {
      utils.tenants.list.invalidate();
      setEditingTenantId(null);
      setEditingTenantName("");
      toast.success("School name updated.");
    },
    onError: (err) => toast.error(err.message),
  });
  const deleteUserMutation = trpc.tenants.deleteUser.useMutation({
    onSuccess: () => {
      utils.tenants.listUnassignedUsers.invalidate();
      toast.success("User deleted.");
    },
    onError: (err) => toast.error(err.message),
  });

  // ── Mutations: Territorial Directors ──────────────────────────────────────
  const grantTdMutation = trpc.tenants.grantTerritorialDirector.useMutation({
    onSuccess: () => {
      utils.tenants.listTerritorialDirectors.invalidate();
      utils.tenants.listUnassignedUsers.invalidate();
      utils.tenants.listRoleAudit.invalidate();
      setGrantSuccessUser(grantSelectedUser);
      setGrantDialogOpen(false);
      setGrantEmailSearch("");
      setGrantSelectedUser(null);
      setGrantTerritoryId("");
      setGrantReason("");
    },
    onError: (err) => toast.error(err.message),
  });

  const revokeTdMutation = trpc.tenants.revokeTerritorialDirector.useMutation({
    onSuccess: () => {
      utils.tenants.listTerritorialDirectors.invalidate();
      utils.tenants.listRoleAudit.invalidate();
      toast.success("Territorial Director role revoked.");
    },
    onError: (err) => toast.error(err.message),
  });

  const addTerritoryMutation = trpc.tenants.assignTerritory.useMutation({
    onSuccess: () => {
      utils.tenants.listTerritorialDirectors.invalidate();
      utils.tenants.listRoleAudit.invalidate();
      setAddTerritoryDialogUserId(null);
      setAddTerritoryId("");
      toast.success("Territory assigned.");
    },
    onError: (err) => toast.error(err.message),
  });

  const removeTerritoryMutation = trpc.tenants.removeTerritory.useMutation({
    onSuccess: () => {
      utils.tenants.listTerritorialDirectors.invalidate();
      utils.tenants.listRoleAudit.invalidate();
      toast.success("Territory removed.");
    },
    onError: (err) => toast.error(err.message),
  });

  // ── Mutations: Director Invites ────────────────────────────────────────────
  const [inviteEmailSent, setInviteEmailSent] = useState(false);
  const createInviteMutation = trpc.tenants.createDirectorInvite.useMutation({
    onSuccess: (data) => {
      setInviteResult(data);
      setInviteEmailSent(!!inviteEmail.trim());
      toast.success(`Invite created for ${data.tenantName}`);
    },
    onError: (err) => toast.error(err.message),
  });

  // ── Mutations: Tenant-to-Territory ─────────────────────────────────────────
  // Owner edit state
  const [editOwnerTenantId, setEditOwnerTenantId] = useState<number | null>(null);
  const [ownerSearch, setOwnerSearch] = useState("");
  const [ownerSearchResults, setOwnerSearchResults] = useState<{ id: number; name: string | null; email: string | null }[]>([]);
  const updateOwnerMutation = trpc.tenants.updateOwner.useMutation({
    onSuccess: () => {
      utils.tenants.list.invalidate();
      setEditOwnerTenantId(null);
      setOwnerSearch("");
      setOwnerSearchResults([]);
      toast.success("Owner updated successfully.");
    },
    onError: (e) => toast.error(e.message),
  });
  const { data: ownerSearchData } = trpc.tenants.findUserByEmail.useQuery(
    { email: ownerSearch },
    { enabled: ownerSearch.length >= 3 }
  );

  const assignTenantTerritoryMutation = trpc.tenants.assignTenantToTerritory.useMutation({
    onSuccess: () => {
      utils.tenants.list.invalidate();
      setTenantTerritoryDialogId(null);
      setTenantTerritoryId("");
      toast.success("Tenant assigned to territory.");
    },
    onError: (err) => toast.error(err.message),
  });

  // ── Auth guard ─────────────────────────────────────────────────────────────
  if (!authLoading && (!user || user.role !== "admin")) {
    navigate("/");
    return null;
  }

  if (authLoading || tenantsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const loginUrl = `${window.location.origin}/login`;

  return (
    <div className="container py-8 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Building2 className="h-7 w-7" />
            School Management
          </h1>
          <p className="text-muted-foreground mt-1">
            SEBA super-admin view — manage all school tenants, user assignments, and territorial oversight.
          </p>
        </div>
      </div>

      {/* Post-grant success banner */}
      {grantSuccessUser && (
        <Card className="mb-6 border-green-300 bg-green-50 dark:bg-green-950/20 dark:border-green-800">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400 shrink-0" />
                <div>
                  <p className="font-semibold text-green-800 dark:text-green-300">
                    Territorial Director role granted to {grantSuccessUser.name ?? `User #${grantSuccessUser.id}`}
                  </p>
                  <p className="text-sm text-green-700 dark:text-green-400 mt-0.5">
                    They can now log in and access their territory overview at{" "}
                    <span className="font-mono text-xs bg-green-100 dark:bg-green-900/40 px-1.5 py-0.5 rounded">
                      /territorial/overview
                    </span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-green-400 text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900/30"
                  onClick={() => {
                    navigator.clipboard.writeText(loginUrl);
                    toast.success("Login URL copied to clipboard.");
                  }}
                >
                  <Copy className="h-3.5 w-3.5 mr-1.5" />
                  Copy login link
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-green-600 hover:text-green-800"
                  onClick={() => setGrantSuccessUser(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="schools">
        <TabsList className="mb-6">
          <TabsTrigger value="schools" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Schools
          </TabsTrigger>
          <TabsTrigger value="territorial" className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Territorial Directors
          </TabsTrigger>
          <TabsTrigger value="audit" className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4" />
            Role Audit Log
          </TabsTrigger>
        </TabsList>

        {/* ── Schools Tab ─────────────────────────────────────────────────── */}
        <TabsContent value="schools" className="space-y-6">
          <div className="flex justify-end gap-2">
            <Dialog open={assignDialogOpen} onOpenChange={(open) => {
              setAssignDialogOpen(open);
              if (!open) { setAssignUserId(""); setAssignToTenantId(""); setAssignSchoolSearch(""); setAssignSelectedSchool(""); }
            }}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <UserPlus className="h-4 w-4 mr-2" />
                  Assign User
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Assign User to School</DialogTitle>
                  <DialogDescription>Move an unassigned user into a school in Catalonia.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  {/* User picker with inline name editing */}
                  <div>
                    <label className="text-sm font-medium mb-1 block">User</label>
                    {editingUserId ? (
                      /* Inline name editor */
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Input
                            className="h-8 text-sm flex-1"
                            value={editingUserName}
                            onChange={(e) => setEditingUserName(e.target.value)}
                            placeholder="Enter display name"
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && editingUserName.trim()) {
                                updateUserNameMutation.mutate({ userId: editingUserId, name: editingUserName.trim() });
                              }
                              if (e.key === "Escape") { setEditingUserId(null); setEditingUserName(""); }
                            }}
                            autoFocus
                          />
                          <Button
                            size="sm" className="h-8 px-2"
                            disabled={!editingUserName.trim() || updateUserNameMutation.isPending}
                            onClick={() => updateUserNameMutation.mutate({ userId: editingUserId, name: editingUserName.trim() })}
                          >Save</Button>
                          <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => { setEditingUserId(null); setEditingUserName(""); }}>Cancel</Button>
                        </div>
                        <p className="text-xs text-muted-foreground">Press Enter to save, Escape to cancel.</p>
                      </div>
                    ) : (
                      <Select value={assignUserId} onValueChange={setAssignUserId}>
                        <SelectTrigger><SelectValue placeholder="Select a user" /></SelectTrigger>
                        <SelectContent>
                          {unassignedUsers?.map(u => (
                            <div key={u.id} className="flex items-center group">
                              <SelectItem value={String(u.id)} className="flex-1">
                                {u.name ?? u.email ?? `User #${u.id}`}
                              </SelectItem>
                              <button
                                className="mr-1 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-accent transition-opacity"
                                title="Edit name"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  setEditingUserId(u.id);
                                  setEditingUserName(u.name ?? "");
                                }}
                              >
                                <Pencil className="h-3 w-3 text-muted-foreground" />
                              </button>
                            </div>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  {/* School picker — Catalonia full list with search */}
                  <div>
                    <label className="text-sm font-medium mb-1 block">School</label>
                    {/* Search input */}
                    <div className="relative mb-2">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                      <Input
                        className="pl-8 h-8 text-sm"
                        placeholder="Type 3+ letters to search schools…"
                        value={assignSchoolSearch}
                        onChange={(e) => { setAssignSchoolSearch(e.target.value); setAssignSelectedSchool(""); }}
                      />
                    </div>
                    {/* Selected school badge */}
                    {assignSelectedSchool && (
                      <div className="flex items-center gap-1.5 mb-2 px-2 py-1 rounded bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 text-sm">
                        <Building2 className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{assignSelectedSchool}</span>
                        <button className="ml-auto" onClick={() => { setAssignSelectedSchool(""); setAssignSchoolSearch(""); }}>
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                    {/* Scrollable results */}
                    {assignSchoolSearch.trim().length >= 3 && !assignSelectedSchool && (() => {
                      const q = assignSchoolSearch.trim().toLowerCase();
                      const matches = CATALONIA_SCHOOLS.filter(s => s.toLowerCase().includes(q)).slice(0, 80);
                      return matches.length === 0 ? (
                        <p className="text-xs text-muted-foreground px-1">No schools found.</p>
                      ) : (
                        <ScrollArea className="h-44 rounded border">
                          <div className="p-1">
                            {matches.map(school => (
                              <button
                                key={school}
                                className="w-full text-left text-sm px-2 py-1.5 rounded hover:bg-accent hover:text-accent-foreground transition-colors"
                                onClick={() => { setAssignSelectedSchool(school); setAssignSchoolSearch(school); }}
                              >
                                {school}
                              </button>
                            ))}
                          </div>
                        </ScrollArea>
                      );
                    })()}
                    {assignSchoolSearch.trim().length < 3 && !assignSelectedSchool && (
                      <p className="text-xs text-muted-foreground px-1">Type at least 3 letters to search all 4,890 schools in Catalonia.</p>
                    )}
                    {/* Also allow selecting from existing registered tenants */}
                    {!assignSelectedSchool && (
                      <div className="mt-3">
                        <p className="text-xs text-muted-foreground mb-1">Or select from registered schools:</p>
                        <Select value={assignToTenantId} onValueChange={setAssignToTenantId}>
                          <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select a registered school" /></SelectTrigger>
                          <SelectContent>
                            {tenantList?.map(t => (
                              <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>Cancel</Button>
                  <Button
                    onClick={() => {
                      if (!assignUserId || !assignToTenantId) return;
                      assignMutation.mutate({ userId: parseInt(assignUserId), tenantId: parseInt(assignToTenantId) });
                    }}
                    disabled={!assignUserId || !assignToTenantId || assignMutation.isPending}
                  >Assign</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={createDialogOpen} onOpenChange={(open) => {
              setCreateDialogOpen(open);
              if (!open) {
                setCreateMode("existing");
                setNewTenantName("");
                setNewOwnerUserId("");
                setNewOwnerName("");
                setNewOwnerEmail("");
                setNewOwnerPassword("");
                setShowOwnerPassword(false);
                setCreateWithOwnerSuccess(null);
              }
            }}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  New Tenant
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Create New Tenant</DialogTitle>
                  <DialogDescription>Create a new school or organisation and assign a director/owner.</DialogDescription>
                </DialogHeader>

                {createWithOwnerSuccess ? (
                  /* ── Success state ── */
                  <div className="py-4 space-y-4">
                    <div className="flex items-start gap-3 p-4 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
                      <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
                      <div>
                        <p className="font-semibold text-green-800 dark:text-green-300">
                          Tenant "{createWithOwnerSuccess.tenantName}" created
                        </p>
                        <p className="text-sm text-green-700 dark:text-green-400 mt-1">
                          Owner account created for <strong>{createWithOwnerSuccess.ownerName}</strong>
                          {" "}({createWithOwnerSuccess.ownerEmail}). They can now log in at{" "}
                          <span className="font-mono text-xs">{window.location.origin}/login</span>.
                        </p>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button onClick={() => setCreateDialogOpen(false)}>Done</Button>
                    </DialogFooter>
                  </div>
                ) : (
                  /* ── Form state ── */
                  <>
                    <div className="space-y-4 py-2">
                      {/* School name */}
                      <div className="space-y-1.5">
                        <Label htmlFor="tenant-name">School / Organisation Name</Label>
                        <Input
                          id="tenant-name"
                          placeholder="e.g. Escola Pia de Barcelona"
                          value={newTenantName}
                          onChange={e => setNewTenantName(e.target.value)}
                        />
                      </div>

                      <Separator />

                      {/* Owner mode toggle */}
                      <div className="space-y-2">
                        <Label>Owner / Director</Label>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant={createMode === "existing" ? "default" : "outline"}
                            onClick={() => setCreateMode("existing")}
                            className="flex-1"
                          >
                            <Users className="h-3.5 w-3.5 mr-1.5" />
                            Assign Existing User
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant={createMode === "new" ? "default" : "outline"}
                            onClick={() => setCreateMode("new")}
                            className="flex-1"
                          >
                            <UserCog className="h-3.5 w-3.5 mr-1.5" />
                            Create New User
                          </Button>
                        </div>
                      </div>

                      {createMode === "existing" ? (
                        /* Assign existing unassigned user */
                        <div className="space-y-1.5">
                          <Label>Select Existing User</Label>
                          <Select value={newOwnerUserId} onValueChange={setNewOwnerUserId}>
                            <SelectTrigger><SelectValue placeholder="Select the director/owner" /></SelectTrigger>
                            <SelectContent>
                              {unassignedUsers?.length === 0 && (
                                <SelectItem value="_none" disabled>No unassigned users</SelectItem>
                              )}
                              {unassignedUsers?.map(u => (
                                <SelectItem key={u.id} value={String(u.id)}>
                                  {u.name ?? u.email ?? `User #${u.id}`}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ) : (
                        /* Create new owner user */
                        <div className="space-y-3">
                          <div className="space-y-1.5">
                            <Label htmlFor="owner-name">Full Name</Label>
                            <Input
                              id="owner-name"
                              placeholder="e.g. Maria García"
                              value={newOwnerName}
                              onChange={e => setNewOwnerName(e.target.value)}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor="owner-email">Email Address</Label>
                            <Input
                              id="owner-email"
                              type="email"
                              placeholder="director@school.cat"
                              value={newOwnerEmail}
                              onChange={e => setNewOwnerEmail(e.target.value)}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor="owner-password">Temporary Password</Label>
                            <div className="relative">
                              <Input
                                id="owner-password"
                                type={showOwnerPassword ? "text" : "password"}
                                placeholder="Min. 8 characters"
                                value={newOwnerPassword}
                                onChange={e => setNewOwnerPassword(e.target.value)}
                                className="pr-10"
                              />
                              <button
                                type="button"
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                onClick={() => setShowOwnerPassword(v => !v)}
                              >
                                {showOwnerPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </button>
                            </div>
                            <p className="text-xs text-muted-foreground">Share this password with the director so they can log in and change it.</p>
                          </div>
                        </div>
                      )}
                    </div>

                    <DialogFooter>
                      <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
                      {createMode === "existing" ? (
                        <Button
                          onClick={() => {
                            if (!newTenantName.trim() || !newOwnerUserId) return;
                            createMutation.mutate({ name: newTenantName.trim(), ownerUserId: parseInt(newOwnerUserId) });
                          }}
                          disabled={!newTenantName.trim() || !newOwnerUserId || createMutation.isPending}
                        >
                          {createMutation.isPending ? "Creating..." : "Create Tenant"}
                        </Button>
                      ) : (
                        <Button
                          onClick={() => {
                            if (!newTenantName.trim() || !newOwnerName.trim() || !newOwnerEmail.trim() || newOwnerPassword.length < 8) return;
                            createWithOwnerMutation.mutate({
                              tenantName: newTenantName.trim(),
                              ownerName: newOwnerName.trim(),
                              ownerEmail: newOwnerEmail.trim(),
                              ownerPassword: newOwnerPassword,
                            });
                          }}
                          disabled={
                            !newTenantName.trim() ||
                            !newOwnerName.trim() ||
                            !newOwnerEmail.trim() ||
                            newOwnerPassword.length < 8 ||
                            createWithOwnerMutation.isPending
                          }
                        >
                          {createWithOwnerMutation.isPending ? "Creating..." : "Create Tenant & Owner"}
                        </Button>
                      )}
                    </DialogFooter>
                  </>
                )}
              </DialogContent>
            </Dialog>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Tenants</CardDescription>
                <CardTitle className="text-3xl">{tenantList?.length ?? 0}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Assigned Users</CardDescription>
                <CardTitle className="text-3xl">
                  {tenantList?.reduce((s, t) => s + t.memberCount, 0) ?? 0}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Unassigned Users</CardDescription>
                <CardTitle className="text-3xl">{unassignedUsers?.length ?? 0}</CardTitle>
              </CardHeader>
            </Card>
          </div>

          {/* Tenant list */}
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1">
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5" />
                    All Tenants
                    {(schoolMunicipalityFilter || schoolNameSearch.trim().length >= 2) && (
                      <span className="ml-1 text-sm font-normal text-muted-foreground">
                        ({filteredTenants.length} of {tenantList?.length ?? 0})
                      </span>
                    )}
                  </CardTitle>
                  <CardDescription>Each row represents one school or organisation.</CardDescription>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                  {/* Name search */}
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                    <Input
                      className="pl-8 h-8 text-sm w-48"
                      placeholder="Search schools…"
                      value={schoolNameSearch}
                      onChange={(e) => setSchoolNameSearch(e.target.value)}
                    />
                  </div>
                  {/* Municipality filter — grouped by comarca */}
                  <Select
                    value={schoolMunicipalityFilter || "__all__"}
                    onValueChange={(v) => setSchoolMunicipalityFilter(v === "__all__" ? "" : v)}
                  >
                    <SelectTrigger className="h-8 text-sm w-52">
                      <MapPin className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                      <SelectValue placeholder="All municipalities" />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      <SelectItem value="__all__">All municipalities</SelectItem>
                      {CATALONIA_COMARQUES.map((comarca) => (
                        <SelectGroup key={comarca}>
                          <SelectLabel className="text-xs font-semibold text-muted-foreground px-2 py-1">{comarca}</SelectLabel>
                          {(MUNICIPALITIES_BY_COMARCA[comarca] ?? []).map((m) => (
                            <SelectItem key={m} value={m}>{m}</SelectItem>
                          ))}
                        </SelectGroup>
                      ))}
                    </SelectContent>
                  </Select>
                  {/* Director status toggle */}
                  <Select
                    value={directorStatusFilter}
                    onValueChange={(v) => setDirectorStatusFilter(v as "all" | "active" | "deactivated")}
                  >
                    <SelectTrigger className="h-8 text-sm w-44">
                      <SelectValue placeholder="Director status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All directors</SelectItem>
                      <SelectItem value="active">Active directors</SelectItem>
                      <SelectItem value="deactivated">Deactivated directors</SelectItem>
                    </SelectContent>
                  </Select>
                  {/* Clear filters */}
                  {(schoolMunicipalityFilter || schoolNameSearch || directorStatusFilter !== "all") && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-xs text-muted-foreground"
                      onClick={() => { setSchoolMunicipalityFilter(""); setSchoolNameSearch(""); setDirectorStatusFilter("all"); }}
                    >
                      <X className="h-3.5 w-3.5 mr-1" /> Clear
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {!tenantList || tenantList.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Building2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">No tenants yet</p>
                  <p className="text-sm mt-1">Create the first tenant to get started.</p>
                </div>
              ) : filteredTenants.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Search className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">No schools match the current filters</p>
                  <p className="text-sm mt-1">Try a different municipality or clear the search.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>School / Organisation</TableHead>
                      <TableHead>Owner</TableHead>
                      <TableHead>Territory</TableHead>
                      <TableHead>Members</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTenants.map(tenant => (
                      <TableRow key={tenant.id}>
                        <TableCell className="font-medium">
                          {editingTenantId === tenant.id ? (
                            <div className="flex items-center gap-1">
                              <Input
                                value={editingTenantName}
                                onChange={e => setEditingTenantName(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === "Enter" && editingTenantName.trim()) editTenantMutation.mutate({ id: tenant.id, name: editingTenantName.trim() });
                                  if (e.key === "Escape") { setEditingTenantId(null); setEditingTenantName(""); }
                                }}
                                className="h-7 text-sm w-40"
                                autoFocus
                              />
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600" disabled={!editingTenantName.trim() || editTenantMutation.isPending}
                                onClick={() => editTenantMutation.mutate({ id: tenant.id, name: editingTenantName.trim() })}>
                                <CheckCircle2 className="h-4 w-4" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground"
                                onClick={() => { setEditingTenantId(null); setEditingTenantName(""); }}>
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 group">
                              <span>{tenant.name}</span>
                              <Button size="icon" variant="ghost" className="h-6 w-6 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-opacity"
                                onClick={() => { setEditingTenantId(tenant.id); setEditingTenantName(tenant.name); }}>
                                <Pencil className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {editOwnerTenantId === tenant.id ? (
                            <div className="space-y-1.5 min-w-[200px]">
                              <Input
                                autoFocus
                                placeholder="Search by name or email…"
                                value={ownerSearch}
                                onChange={e => setOwnerSearch(e.target.value)}
                                className="h-7 text-xs"
                              />
                              {ownerSearch.length >= 3 && ownerSearchData && ownerSearchData.length > 0 && (
                                <div className="border rounded-md bg-popover shadow-md max-h-40 overflow-y-auto">
                                  {ownerSearchData.map(u => (
                                    <button
                                      key={u.id}
                                      type="button"
                                      className="w-full text-left px-2 py-1.5 text-xs hover:bg-accent hover:text-accent-foreground flex flex-col"
                                      onClick={() => {
                                        if (confirm(`Set owner of "${tenant.name}" to ${u.name ?? u.email}?`)) {
                                          updateOwnerMutation.mutate({ tenantId: tenant.id, newOwnerUserId: u.id });
                                        }
                                      }}
                                    >
                                      <span className="font-medium">{u.name ?? "—"}</span>
                                      <span className="text-muted-foreground">{u.email}</span>
                                    </button>
                                  ))}
                                </div>
                              )}
                              {ownerSearch.length >= 3 && ownerSearchData && ownerSearchData.length === 0 && (
                                <p className="text-xs text-muted-foreground px-1">No users found.</p>
                              )}
                              <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => { setEditOwnerTenantId(null); setOwnerSearch(""); }}>
                                Cancel
                              </Button>
                            </div>
                          ) : (
                            <div className="group text-sm space-y-0.5 relative">
                              <div className="flex items-center gap-1">
                                <span className="font-medium">{tenant.ownerName ?? "—"}</span>
                                <button
                                  type="button"
                                  title="Change owner"
                                  className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                                  onClick={() => { setEditOwnerTenantId(tenant.id); setOwnerSearch(""); }}
                                >
                                  <Pencil className="h-3 w-3" />
                                </button>
                              </div>
                              {tenant.ownerEmail && (
                                <div className="text-muted-foreground text-xs">{tenant.ownerEmail}</div>
                              )}
                              {tenant.ownerName && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  <OwnerRoleBadge role={(tenant as any).ownerRole} />
                                  <OwnerStatusPill deactivatedAt={(tenant as any).ownerDeactivatedAt ?? null} />
                                </div>
                              )}
                              {(tenant as any).ownerSchoolName && (
                                <div className="flex items-center gap-0.5 mt-1 text-xs text-slate-600 dark:text-slate-400 max-w-[200px]">
                                  <Building2 className="h-3 w-3 shrink-0" />
                                  <span className="truncate" title={(tenant as any).ownerSchoolName}>{(tenant as any).ownerSchoolName}</span>
                                </div>
                              )}
                              {((tenant as any).ownerSchoolLocation || (tenant as any).ownerSchoolLanguage) && (
                                <div className="flex flex-wrap gap-2 mt-1">
                                  {(tenant as any).ownerSchoolLocation && (
                                    <span className="inline-flex items-center gap-0.5 text-xs text-violet-600 dark:text-violet-400">
                                      <MapPin className="h-3 w-3" />
                                      {(tenant as any).ownerSchoolLocation === "historical_centre" ? "Historical Centre" : (tenant as any).ownerSchoolLocation === "nucli_antic" ? "Nucli Antic" : (tenant as any).ownerSchoolLocation}
                                    </span>
                                  )}
                                  {(tenant as any).ownerSchoolLanguage && (
                                    <span className="inline-flex items-center gap-0.5 text-xs text-violet-600 dark:text-violet-400">
                                      <Globe className="h-3 w-3" />
                                      {(tenant as any).ownerSchoolLanguage === "en" ? "English" : (tenant as any).ownerSchoolLanguage === "es" ? "Spanish" : (tenant as any).ownerSchoolLanguage === "ca" ? "Catalan" : (tenant as any).ownerSchoolLanguage}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {(tenant as any).territoryName ? (
                            <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 border-purple-200 dark:border-purple-700 text-xs font-normal">
                              <MapPin className="h-3 w-3 mr-1" />
                              {(tenant as any).territoryName}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">Unassigned</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            <Users className="h-3 w-3 mr-1" />
                            {tenant.memberCount}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(tenant.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 text-xs px-2"
                              onClick={() => {
                                // Pre-select this tenant's territory (if set) and open the Grant TD dialog
                                setGrantTerritoryId((tenant as any).territoryId ? String((tenant as any).territoryId) : "");
                                setGrantEmailSearch("");
                                setGrantSelectedUser(null);
                                setGrantReason("");
                                setGrantSuccessUser(null);
                                setGrantDialogOpen(true);
                              }}
                              title="Invite / Grant Territorial Director"
                            >
                              <Globe className="h-3.5 w-3.5 mr-1" />
                              Invite Territory Director
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-purple-600 hover:text-purple-700 hover:bg-purple-50 text-xs px-2"
                              onClick={() => { setTenantTerritoryDialogId(tenant.id); setTenantTerritoryId(""); }}
                              title="Assign to Territory"
                            >
                              <MapPin className="h-3.5 w-3.5 mr-1" />
                              Territory
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive"
                              onClick={() => {
                                if (confirm(`Delete tenant "${tenant.name}"? All its users will become unassigned.`)) {
                                  deleteMutation.mutate({ id: tenant.id });
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Unassigned users */}
          {unassignedUsers && unassignedUsers.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Unassigned Users ({unassignedUsers.length})
                </CardTitle>
                <CardDescription>
                  These users are not yet part of any tenant. Use "Assign User" to place them.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Last Active</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {unassignedUsers.map(u => (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">{u.name ?? "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{u.email ?? "—"}</TableCell>
                        <TableCell>
                          <Badge variant={u.role === "admin" ? "default" : "secondary"}>{u.role}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {u.lastSignedIn ? new Date(u.lastSignedIn).toLocaleDateString() : "Never"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            title="Delete user"
                            onClick={() => {
                              if (confirm(`Permanently delete user "${u.name ?? u.email}"? This cannot be undone.`)) {
                                deleteUserMutation.mutate({ userId: u.id });
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── Territorial Directors Tab ──────────────────────────────────────────── */}

      {/* Director Invite Dialog */}
      <Dialog open={inviteDialogTenantId !== null} onOpenChange={open => { if (!open) { setInviteDialogTenantId(null); setInviteResult(null); setInviteEmailSent(false); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-blue-600" />
              Invite Director
            </DialogTitle>
            <DialogDescription>
              Generate a secure invite link for a new school director. The link is valid for 7 days.
            </DialogDescription>
          </DialogHeader>
          {!inviteResult ? (
            <div className="space-y-4 py-2">
              <div>
                <label className="text-sm font-medium mb-1 block">Pre-fill Email (optional)</label>
                <Input
                  type="email"
                  placeholder="director@school.cat"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">If provided, the invite link will be emailed automatically and the email field pre-filled on the acceptance page.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-green-800 dark:text-green-300">Invite created for {inviteResult.tenantName}</p>
                  <p className="text-xs text-green-700 dark:text-green-400">Expires {new Date(inviteResult.expiresAt).toLocaleDateString()}</p>
                </div>
              </div>
              {inviteEmailSent && (
                <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <CheckCircle2 className="h-4 w-4 text-blue-600 shrink-0" />
                  <p className="text-sm text-blue-800 dark:text-blue-300">Email sent to <strong>{inviteEmail}</strong></p>
                </div>
              )}
              <div>
                <label className="text-sm font-medium mb-1 block">Invite Link</label>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={`${window.location.origin}/invite/director/${inviteResult.token}`}
                    className="font-mono text-xs"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/invite/director/${inviteResult!.token}`);
                      setInviteCopied(true);
                      setTimeout(() => setInviteCopied(false), 2000);
                      toast.success("Invite link copied!");
                    }}
                  >
                    {inviteCopied ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            {!inviteResult ? (
              <>
                <Button variant="outline" onClick={() => setInviteDialogTenantId(null)}>Cancel</Button>
                <Button
                  disabled={createInviteMutation.isPending}
                  onClick={() => {
                    if (!inviteDialogTenantId) return;
                    createInviteMutation.mutate({
                      tenantId: inviteDialogTenantId,
                      email: inviteEmail.trim() || undefined,
                      origin: window.location.origin,
                    });
                  }}
                >
                  {createInviteMutation.isPending ? "Generating..." : "Generate Invite Link"}
                </Button>
              </>
            ) : (
              <Button onClick={() => { setInviteDialogTenantId(null); setInviteResult(null); }}>Done</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Tenant to Territory Dialog */}
      <Dialog open={tenantTerritoryDialogId !== null} onOpenChange={open => { if (!open) { setTenantTerritoryDialogId(null); setTenantTerritoryId(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-purple-600" />
              Assign Tenant to Territory
            </DialogTitle>
            <DialogDescription>
              Link this school to a Catalan territorial service so it appears in the correct Territorial Director's overview.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium mb-1 block">Territory</label>
              <Select value={tenantTerritoryId} onValueChange={setTenantTerritoryId}>
                <SelectTrigger><SelectValue placeholder="Select a territory" /></SelectTrigger>
                <SelectContent>
                  {allTerritories?.map(t => (
                    <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTenantTerritoryDialogId(null)}>Cancel</Button>
            <Button
              disabled={!tenantTerritoryId || assignTenantTerritoryMutation.isPending}
              onClick={() => {
                if (!tenantTerritoryDialogId || !tenantTerritoryId) return;
                assignTenantTerritoryMutation.mutate({ tenantId: tenantTerritoryDialogId, territoryId: parseInt(tenantTerritoryId) });
              }}
            >
              {assignTenantTerritoryMutation.isPending ? "Assigning..." : "Assign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

        <TabsContent value="territorial" className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <MapPin className="h-5 w-5 text-blue-500" />
                Territorial Directors
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Only SEBA admins can grant or revoke this role. Territorial directors have read-only
                oversight of schools within their assigned territory.
              </p>
            </div>

            {/* Grant role dialog */}
            <Dialog open={grantDialogOpen} onOpenChange={open => {
              setGrantDialogOpen(open);
              if (!open) {
                setGrantEmailSearch("");
                setGrantSelectedUser(null);
                setGrantTerritoryId("");
                setGrantReason("");
              }
            }}>
              <DialogTrigger asChild>
                <Button>
                  <Shield className="h-4 w-4 mr-2" />
                  Grant Role
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Grant Territorial Director Role</DialogTitle>
                  <DialogDescription>
                    Search for a user by email, then assign their territory. Only SEBA admins can perform this action.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  {/* Email search */}
                  <div>
                    <label className="text-sm font-medium mb-1 block">Search user by email</label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        className="pl-9"
                        placeholder="Type at least 3 characters…"
                        value={grantEmailSearch}
                        onChange={e => {
                          setGrantEmailSearch(e.target.value);
                          setGrantSelectedUser(null);
                        }}
                      />
                    </div>
                    {emailSearchEnabled && emailSearchResults && emailSearchResults.length > 0 && !grantSelectedUser && (
                      <div className="mt-1 border rounded-md bg-popover shadow-md overflow-hidden">
                        {emailSearchResults.map(u => (
                          <button
                            key={u.id}
                            className="w-full text-left px-3 py-2 hover:bg-muted text-sm flex items-center justify-between gap-2"
                            onClick={() => {
                              setGrantSelectedUser(u);
                              setGrantEmailSearch(u.email ?? "");
                            }}
                          >
                            <div>
                              <div className="font-medium">{u.name ?? "—"}</div>
                              <div className="text-muted-foreground text-xs">{u.email}</div>
                            </div>
                            <Badge variant="secondary" className="text-xs shrink-0">{u.role}</Badge>
                          </button>
                        ))}
                      </div>
                    )}
                    {emailSearchEnabled && emailSearchResults?.length === 0 && !grantSelectedUser && (
                      <p className="text-xs text-muted-foreground mt-1">No users found matching that email.</p>
                    )}
                    {grantSelectedUser && (
                      <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-md bg-primary/5 border border-primary/20">
                        <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{grantSelectedUser.name ?? "—"}</p>
                          <p className="text-xs text-muted-foreground truncate">{grantSelectedUser.email}</p>
                        </div>
                        <button
                          className="text-muted-foreground hover:text-foreground"
                          onClick={() => { setGrantSelectedUser(null); setGrantEmailSearch(""); }}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Territory */}
                  <div>
                    <label className="text-sm font-medium mb-1 block">Territory (optional)</label>
                    <Select value={grantTerritoryId} onValueChange={setGrantTerritoryId}>
                      <SelectTrigger><SelectValue placeholder="Select a territory" /></SelectTrigger>
                      <SelectContent>
                        {allTerritories?.map(t => (
                          <SelectItem key={t.id} value={String(t.id)}>
                            {t.name}{t.region ? ` — ${t.region}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Reason */}
                  <div>
                    <label className="text-sm font-medium mb-1 block">Reason (optional, recorded in audit log)</label>
                    <Input
                      placeholder="e.g. Appointed by Departament d'Educació"
                      value={grantReason}
                      onChange={e => setGrantReason(e.target.value)}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setGrantDialogOpen(false)}>Cancel</Button>
                  <Button
                    onClick={() => {
                      if (!grantSelectedUser) return;
                      grantTdMutation.mutate({
                        userId: grantSelectedUser.id,
                        territoryId: grantTerritoryId ? parseInt(grantTerritoryId) : undefined,
                        reason: grantReason || undefined,
                      });
                    }}
                    disabled={!grantSelectedUser || grantTdMutation.isPending}
                  >
                    Grant Role
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {/* Territories reference */}
          {allTerritories && allTerritories.length > 0 && (
            <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-300 flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Registered Territories ({allTerritories.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {allTerritories.map(t => (
                    <div
                      key={t.id}
                      className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 text-sm border border-blue-200 dark:border-blue-700"
                    >
                      <span className="font-medium">{t.name}</span>
                      {t.region && <span className="text-blue-500 dark:text-blue-400 text-xs">· {t.region}</span>}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Territorial directors list */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-blue-500" />
                Active Territorial Directors
              </CardTitle>
              <CardDescription>
                Users with the territorial_director role. Their access is strictly scoped to their assigned territories.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {tdLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                </div>
              ) : !territorialDirectors || territorialDirectors.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  <Shield className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">No territorial directors yet</p>
                  <p className="text-sm mt-1">Use "Grant Role" to appoint one.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {territorialDirectors.map(td => (
                    <div
                      key={td.id}
                      className="flex items-start justify-between p-4 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-semibold text-sm">{td.name ?? "—"}</p>
                          <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 text-xs border-0">
                            territorial_director
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mb-2">{td.email ?? "—"}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {td.territories.length === 0 ? (
                            <span className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">
                              ⚠ No territory assigned
                            </span>
                          ) : (
                            td.territories.map(terr => (
                              <span
                                key={terr.assignmentId}
                                className="flex items-center gap-1 text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full border border-blue-200 dark:border-blue-700"
                              >
                                <MapPin className="h-2.5 w-2.5" />
                                {terr.territoryName ?? `Territory #${terr.territoryId}`}
                                <button
                                  className="ml-0.5 hover:text-red-500 transition-colors"
                                  onClick={() => removeTerritoryMutation.mutate({ assignmentId: terr.assignmentId })}
                                  title="Remove territory"
                                >
                                  <X className="h-2.5 w-2.5" />
                                </button>
                              </span>
                            ))
                          )}
                          <button
                            className="text-xs text-blue-500 hover:text-blue-700 dark:hover:text-blue-300 px-2 py-0.5 rounded-full border border-dashed border-blue-300 dark:border-blue-700 transition-colors"
                            onClick={() => setAddTerritoryDialogUserId(td.id)}
                          >
                            + Add territory
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-4 shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/5"
                          onClick={() => {
                            if (confirm(`Revoke territorial director role from ${td.name ?? "this user"}? They will be demoted to 'user'.`)) {
                              revokeTdMutation.mutate({ userId: td.id });
                            }
                          }}
                          disabled={revokeTdMutation.isPending}
                        >
                          <ShieldOff className="h-3.5 w-3.5 mr-1" />
                          Revoke
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Role Audit Log Tab ─────────────────────────────────────────── */}
        <TabsContent value="audit" className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-muted-foreground" />
              Role Change Audit Log
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Immutable record of every role grant, revoke, and territory assignment. Read-only.
            </p>
          </div>

          <Card>
            <CardContent className="pt-4">
              {auditLoading ? (
                <div className="flex justify-center py-10">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                </div>
              ) : !auditRecords || auditRecords.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">No audit records yet</p>
                  <p className="text-sm mt-1">Records appear here when roles are granted or revoked.</p>
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>When</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Target User</TableHead>
                        <TableHead>Role Change</TableHead>
                        <TableHead>Territory</TableHead>
                        <TableHead>Performed By</TableHead>
                        <TableHead>Reason</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {auditRecords.map(r => (
                        <TableRow key={r.id}>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {new Date(r.createdAt).toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${actionBadge[r.action] ?? "bg-muted text-muted-foreground"}`}>
                              {r.action.replace(/_/g, " ")}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm font-medium">{r.targetUserName}</div>
                            <div className="text-xs text-muted-foreground">{r.targetUserEmail ?? ""}</div>
                          </TableCell>
                          <TableCell className="text-xs">
                            {r.oldRole ? (
                              <span className="flex items-center gap-1">
                                <span className="text-muted-foreground">{formatRole(r.oldRole)}</span>
                                <span className="text-muted-foreground">→</span>
                                <span className="font-medium">{formatRole(r.newRole)}</span>
                              </span>
                            ) : (
                              <span className="font-medium">{formatRole(r.newRole)}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {r.territoryName ?? "—"}
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">{r.actingUserName}</div>
                            <div className="text-xs text-muted-foreground">{r.actingUserEmail ?? ""}</div>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[180px] truncate">
                            {r.reason ?? "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {/* Pagination */}
                  <div className="flex items-center justify-between mt-4 pt-4 border-t">
                    <p className="text-sm text-muted-foreground">
                      Showing {auditOffset + 1}–{auditOffset + auditRecords.length}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={auditOffset === 0}
                        onClick={() => setAuditOffset(Math.max(0, auditOffset - AUDIT_PAGE_SIZE))}
                      >
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={auditRecords.length < AUDIT_PAGE_SIZE}
                        onClick={() => setAuditOffset(auditOffset + AUDIT_PAGE_SIZE)}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add territory dialog */}
      <Dialog
        open={addTerritoryDialogUserId !== null}
        onOpenChange={open => !open && setAddTerritoryDialogUserId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Territory Assignment</DialogTitle>
            <DialogDescription>
              Assign an additional territory to this territorial director.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <label className="text-sm font-medium mb-1 block">Territory</label>
            <Select value={addTerritoryId} onValueChange={setAddTerritoryId}>
              <SelectTrigger><SelectValue placeholder="Select a territory" /></SelectTrigger>
              <SelectContent>
                {allTerritories?.map(t => (
                  <SelectItem key={t.id} value={String(t.id)}>
                    {t.name}{t.region ? ` — ${t.region}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddTerritoryDialogUserId(null)}>Cancel</Button>
            <Button
              onClick={() => {
                if (!addTerritoryDialogUserId || !addTerritoryId) return;
                addTerritoryMutation.mutate({
                  userId: addTerritoryDialogUserId,
                  territoryId: parseInt(addTerritoryId),
                });
              }}
              disabled={!addTerritoryId || addTerritoryMutation.isPending}
            >
              Assign Territory
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
