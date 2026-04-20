/**
 * TenantManagement.tsx
 * SEBA super-admin page for cross-tenant management.
 * Only accessible to users with role === 'admin'.
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
import { Building2, Users, Plus, Pencil, UserPlus, Trash2, ChevronRight } from "lucide-react";
import { toast } from "sonner";

export default function TenantManagement() {
  const { user, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedTenantId, setSelectedTenantId] = useState<number | null>(null);
  const [newTenantName, setNewTenantName] = useState("");
  const [newOwnerUserId, setNewOwnerUserId] = useState("");
  const [assignUserId, setAssignUserId] = useState("");
  const [assignToTenantId, setAssignToTenantId] = useState("");

  const utils = trpc.useUtils();

  const { data: tenantList, isLoading: tenantsLoading } = trpc.tenants.list.useQuery();
  const { data: unassignedUsers } = trpc.tenants.listUnassignedUsers.useQuery();

  const createMutation = trpc.tenants.create.useMutation({
    onSuccess: () => {
      utils.tenants.list.invalidate();
      utils.tenants.listUnassignedUsers.invalidate();
      setCreateDialogOpen(false);
      setNewTenantName("");
      setNewOwnerUserId("");
      toast.success("Tenant created — the new school tenant has been created.");
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

  // Guard: redirect non-admins
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
            SEBA super-admin view — manage all school tenants and user assignments.
          </p>
        </div>
        <div className="flex gap-2">
          {/* Assign User Dialog */}
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
                <DialogDescription>
                  Move an unassigned user into a school tenant.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div>
                  <label className="text-sm font-medium mb-1 block">User</label>
                  <Select value={assignUserId} onValueChange={setAssignUserId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a user" />
                    </SelectTrigger>
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
                    <SelectTrigger>
                      <SelectValue placeholder="Select a tenant" />
                    </SelectTrigger>
                    <SelectContent>
                      {tenantList?.map(t => (
                        <SelectItem key={t.id} value={String(t.id)}>
                          {t.name}
                        </SelectItem>
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
                    assignMutation.mutate({
                      userId: parseInt(assignUserId),
                      tenantId: parseInt(assignToTenantId),
                    });
                  }}
                  disabled={!assignUserId || !assignToTenantId || assignMutation.isPending}
                >
                  Assign
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Create Tenant Dialog */}
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
                <DialogDescription>
                  Create a new school tenant and assign an owner (director).
                </DialogDescription>
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
                    <SelectTrigger>
                      <SelectValue placeholder="Select the director/owner" />
                    </SelectTrigger>
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
                    createMutation.mutate({
                      name: newTenantName.trim(),
                      ownerUserId: parseInt(newOwnerUserId),
                    });
                  }}
                  disabled={!newTenantName.trim() || !newOwnerUserId || createMutation.isPending}
                >
                  Create Tenant
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
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
          <CardDescription>
            Each row represents one school or organisation. Click a row to view its members.
          </CardDescription>
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
                  <TableRow
                    key={tenant.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/admin/tenants/${tenant.id}`)}
                  >
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
                    <TableCell className="text-right" onClick={e => e.stopPropagation()}>
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
        <Card className="mt-6">
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
                      <Badge variant={u.role === "admin" ? "default" : "secondary"}>
                        {u.role}
                      </Badge>
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
    </div>
  );
}
