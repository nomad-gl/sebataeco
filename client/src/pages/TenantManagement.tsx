/**
 * TenantManagement.tsx
 * SEBA super-admin page for cross-tenant management.
 * Only accessible to users with role === 'admin'.
 *
 * Tabs:
 *  1. Schools — manage tenants, assign users
 *  2. Territorial Directors — grant/revoke role, assign territories
 */

import { useState } from "react";
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
  SelectItem,
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
} from "lucide-react";
import { toast } from "sonner";

export default function TenantManagement() {
  const { user, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();

  // ── Schools tab state ──────────────────────────────────────────────────────
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [newTenantName, setNewTenantName] = useState("");
  const [newOwnerUserId, setNewOwnerUserId] = useState("");
  const [assignUserId, setAssignUserId] = useState("");
  const [assignToTenantId, setAssignToTenantId] = useState("");

  // ── Territorial Directors tab state ────────────────────────────────────────
  const [grantDialogOpen, setGrantDialogOpen] = useState(false);
  const [grantUserId, setGrantUserId] = useState("");
  const [grantTerritoryId, setGrantTerritoryId] = useState("");
  const [addTerritoryDialogUserId, setAddTerritoryDialogUserId] = useState<number | null>(null);
  const [addTerritoryId, setAddTerritoryId] = useState("");

  const utils = trpc.useUtils();

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: tenantList, isLoading: tenantsLoading } = trpc.tenants.list.useQuery();
  const { data: unassignedUsers } = trpc.tenants.listUnassignedUsers.useQuery();
  const { data: territorialDirectors, isLoading: tdLoading } = trpc.tenants.listTerritorialDirectors.useQuery();
  const { data: allTerritories } = trpc.tenants.listTerritories.useQuery();

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

  const deleteMutation = trpc.tenants.delete.useMutation({
    onSuccess: () => {
      utils.tenants.list.invalidate();
      utils.tenants.listUnassignedUsers.invalidate();
      toast.success("Tenant deleted. Users are now unassigned.");
    },
    onError: (err) => toast.error(err.message),
  });

  // ── Mutations: Territorial Directors ──────────────────────────────────────
  const grantTdMutation = trpc.tenants.grantTerritorialDirector.useMutation({
    onSuccess: () => {
      utils.tenants.listTerritorialDirectors.invalidate();
      utils.tenants.listUnassignedUsers.invalidate();
      setGrantDialogOpen(false);
      setGrantUserId("");
      setGrantTerritoryId("");
      toast.success("Territorial Director role granted.");
    },
    onError: (err) => toast.error(err.message),
  });

  const revokeTdMutation = trpc.tenants.revokeTerritorialDirector.useMutation({
    onSuccess: () => {
      utils.tenants.listTerritorialDirectors.invalidate();
      toast.success("Territorial Director role revoked.");
    },
    onError: (err) => toast.error(err.message),
  });

  const addTerritoryMutation = trpc.tenants.assignTerritory.useMutation({
    onSuccess: () => {
      utils.tenants.listTerritorialDirectors.invalidate();
      setAddTerritoryDialogUserId(null);
      setAddTerritoryId("");
      toast.success("Territory assigned.");
    },
    onError: (err) => toast.error(err.message),
  });

  const removeTerritoryMutation = trpc.tenants.removeTerritory.useMutation({
    onSuccess: () => {
      utils.tenants.listTerritorialDirectors.invalidate();
      toast.success("Territory removed.");
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

  // All users (assigned + unassigned) for the grant dialog
  const allKnownUsers = [
    ...(unassignedUsers ?? []),
  ];

  return (
    <div className="container py-8 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Building2 className="h-8 w-8 text-primary" />
            Tenant Management
          </h1>
          <p className="text-muted-foreground mt-1">
            SEBA super-admin view — manage all school tenants, user assignments, and territorial oversight.
          </p>
        </div>
      </div>

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
        </TabsList>

        {/* ── Schools Tab ─────────────────────────────────────────────────── */}
        <TabsContent value="schools" className="space-y-6">
          {/* Action buttons */}
          <div className="flex justify-end gap-2">
            <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <UserPlus className="h-4 w-4 mr-2" />
                  Assign User
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Assign User to Tenant</DialogTitle>
                  <DialogDescription>Move an unassigned user into a school tenant.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div>
                    <label className="text-sm font-medium mb-1 block">User</label>
                    <Select value={assignUserId} onValueChange={setAssignUserId}>
                      <SelectTrigger><SelectValue placeholder="Select a user" /></SelectTrigger>
                      <SelectContent>
                        {unassignedUsers?.map(u => (
                          <SelectItem key={u.id} value={String(u.id)}>
                            {u.name ?? u.email ?? `User #${u.id}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Tenant</label>
                    <Select value={assignToTenantId} onValueChange={setAssignToTenantId}>
                      <SelectTrigger><SelectValue placeholder="Select a tenant" /></SelectTrigger>
                      <SelectContent>
                        {tenantList?.map(t => (
                          <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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

            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  New Tenant
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Tenant</DialogTitle>
                  <DialogDescription>Create a new school tenant and assign an owner (director).</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div>
                    <label className="text-sm font-medium mb-1 block">School / Organisation Name</label>
                    <Input
                      placeholder="e.g. Escola Pia de Barcelona"
                      value={newTenantName}
                      onChange={e => setNewTenantName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Owner User</label>
                    <Select value={newOwnerUserId} onValueChange={setNewOwnerUserId}>
                      <SelectTrigger><SelectValue placeholder="Select the director/owner" /></SelectTrigger>
                      <SelectContent>
                        {unassignedUsers?.map(u => (
                          <SelectItem key={u.id} value={String(u.id)}>
                            {u.name ?? u.email ?? `User #${u.id}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
                  <Button
                    onClick={() => {
                      if (!newTenantName.trim() || !newOwnerUserId) return;
                      createMutation.mutate({ name: newTenantName.trim(), ownerUserId: parseInt(newOwnerUserId) });
                    }}
                    disabled={!newTenantName.trim() || !newOwnerUserId || createMutation.isPending}
                  >Create Tenant</Button>
                </DialogFooter>
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
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                All Tenants
              </CardTitle>
              <CardDescription>Each row represents one school or organisation.</CardDescription>
            </CardHeader>
            <CardContent>
              {!tenantList || tenantList.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Building2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">No tenants yet</p>
                  <p className="text-sm mt-1">Create the first tenant to get started.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>School / Organisation</TableHead>
                      <TableHead>Owner</TableHead>
                      <TableHead>Members</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tenantList.map(tenant => (
                      <TableRow key={tenant.id}>
                        <TableCell className="font-medium">{tenant.name}</TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div>{tenant.ownerName ?? "—"}</div>
                            <div className="text-muted-foreground text-xs">{tenant.ownerEmail ?? ""}</div>
                          </div>
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
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── Territorial Directors Tab ──────────────────────────────────── */}
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
            <Dialog open={grantDialogOpen} onOpenChange={setGrantDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Shield className="h-4 w-4 mr-2" />
                  Grant Role
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Grant Territorial Director Role</DialogTitle>
                  <DialogDescription>
                    Promote a user to Territorial Director and optionally assign their territory.
                    Only SEBA admins can perform this action.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div>
                    <label className="text-sm font-medium mb-1 block">User</label>
                    <Input
                      placeholder="Enter user ID (e.g. 1504672)"
                      value={grantUserId}
                      onChange={e => setGrantUserId(e.target.value)}
                      type="number"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Find the user ID from the database or audit log.
                    </p>
                  </div>
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
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setGrantDialogOpen(false)}>Cancel</Button>
                  <Button
                    onClick={() => {
                      if (!grantUserId) return;
                      grantTdMutation.mutate({
                        userId: parseInt(grantUserId),
                        territoryId: grantTerritoryId ? parseInt(grantTerritoryId) : undefined,
                      });
                    }}
                    disabled={!grantUserId || grantTdMutation.isPending}
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
                  Registered Territories
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
                      <span className="text-blue-400 text-xs ml-1">#{t.id}</span>
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

                        {/* Territory chips */}
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
                          {/* Add territory button */}
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
      </Tabs>

      {/* Add territory dialog (triggered inline from TD card) */}
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
