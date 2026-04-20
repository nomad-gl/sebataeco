/**
 * TerritorialDirectorOverview.tsx
 *
 * Read-only oversight dashboard for the Director of Territorial Services
 * for Education and Vocational Training in Terres de l'Ebre.
 *
 * Access: territorial_director + admin roles only.
 * All data is scoped to the territories assigned to the current user.
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  MapPin,
  Building2,
  Users,
  GraduationCap,
  BookOpen,
  AlertTriangle,
  Search,
  Eye,
  ChevronRight,
  Shield,
} from "lucide-react";

export default function TerritorialDirectorOverview() {
  const { user, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [selectedTenantId, setSelectedTenantId] = useState<number | null>(null);

  const { data: stats, isLoading: statsLoading } = trpc.territorialDirector.getOverviewStats.useQuery();
  const { data: myTerritories } = trpc.territorialDirector.getMyTerritories.useQuery();
  const { data: tenantList, isLoading: tenantsLoading } = trpc.territorialDirector.getAllTenants.useQuery();
  const { data: tenantDetail } = trpc.territorialDirector.getTenantDetail.useQuery(
    { tenantId: selectedTenantId! },
    { enabled: selectedTenantId !== null }
  );

  // Guard: redirect non-authorised users
  if (!authLoading && (!user || (user.role !== "admin" && user.role !== "territorial_director"))) {
    navigate("/");
    return null;
  }

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const filteredTenants = (tenantList ?? []).filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    (t.ownerName ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (t.territoryName ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const positionBadge = (position: string) => {
    const map: Record<string, string> = {
      director: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
      teacher: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
      head_of_study: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
      unassigned: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
    };
    return map[position] ?? map.unassigned;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white">
      {/* Header */}
      <div className="border-b border-white/10 bg-white/5 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/20 border border-blue-400/30">
              <MapPin className="w-5 h-5 text-blue-300" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Territorial Services Overview</h1>
              <p className="text-sm text-blue-200/70">
                {myTerritories && myTerritories.length > 0
                  ? myTerritories.map(t => t.name).join(" · ")
                  : "Education and Vocational Training"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="bg-blue-500/20 text-blue-200 border border-blue-400/30 text-xs">
              <Shield className="w-3 h-3 mr-1" />
              {user?.role === "admin" ? "SEBA Admin" : "Territorial Director"}
            </Badge>
            <Badge className="bg-white/10 text-white/70 border border-white/20 text-xs">
              Read-only
            </Badge>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">

        {/* Territory chips */}
        {myTerritories && myTerritories.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {myTerritories.map(t => (
              <div
                key={t.id}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/15 border border-blue-400/25 text-sm text-blue-200"
              >
                <MapPin className="w-3.5 h-3.5" />
                <span className="font-medium">{t.name}</span>
                {t.region && <span className="text-blue-300/60 text-xs">· {t.region}</span>}
              </div>
            ))}
          </div>
        )}

        {/* Stats cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: "Schools", value: stats?.totalTenants, icon: Building2, color: "text-blue-300" },
            { label: "Users", value: stats?.totalUsers, icon: Users, color: "text-emerald-300" },
            { label: "Directors", value: stats?.totalDirectors, icon: GraduationCap, color: "text-purple-300" },
            { label: "Lesson Plans", value: stats?.totalLessonPlans, icon: BookOpen, color: "text-amber-300" },
            { label: "Open Flags", value: stats?.openBiasFlags, icon: AlertTriangle, color: "text-rose-300" },
          ].map(({ label, value, icon: Icon, color }) => (
            <Card key={label} className="bg-white/5 border-white/10 text-white">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Icon className={`w-4 h-4 ${color}`} />
                  <span className="text-xs text-white/50 uppercase tracking-wide">{label}</span>
                </div>
                <p className="text-2xl font-bold">
                  {statsLoading ? "—" : (value ?? 0).toLocaleString()}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Schools table */}
        <Card className="bg-white/5 border-white/10 text-white">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <CardTitle className="text-white flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-blue-300" />
                  Schools in Territory
                </CardTitle>
                <CardDescription className="text-white/50">
                  {filteredTenants.length} school{filteredTenants.length !== 1 ? "s" : ""} visible to you
                </CardDescription>
              </div>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                <Input
                  placeholder="Search schools…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9 bg-white/5 border-white/20 text-white placeholder:text-white/30 focus:border-blue-400"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {tenantsLoading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400" />
              </div>
            ) : filteredTenants.length === 0 ? (
              <div className="text-center py-12 text-white/40">
                <Building2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">
                  {tenantList?.length === 0
                    ? "No schools are assigned to your territory yet."
                    : "No schools match your search."}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/10 hover:bg-transparent">
                      <TableHead className="text-white/50">School</TableHead>
                      <TableHead className="text-white/50">Territory</TableHead>
                      <TableHead className="text-white/50">Director</TableHead>
                      <TableHead className="text-white/50 text-center">Users</TableHead>
                      <TableHead className="text-white/50 text-center">Teachers</TableHead>
                      <TableHead className="text-white/50">Last Activity</TableHead>
                      <TableHead className="text-white/50 text-right">Detail</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTenants.map(tenant => (
                      <TableRow
                        key={tenant.id}
                        className="border-white/10 hover:bg-white/5 cursor-pointer"
                        onClick={() => setSelectedTenantId(tenant.id)}
                      >
                        <TableCell className="font-medium text-white">{tenant.name}</TableCell>
                        <TableCell>
                          {tenant.territoryName ? (
                            <span className="flex items-center gap-1 text-blue-300 text-sm">
                              <MapPin className="w-3 h-3" />
                              {tenant.territoryName}
                            </span>
                          ) : (
                            <span className="text-white/30 text-sm">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="text-sm text-white">{tenant.ownerName ?? "—"}</p>
                            {tenant.ownerEmail && (
                              <p className="text-xs text-white/40">{tenant.ownerEmail}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center text-white/80">{tenant.memberCount}</TableCell>
                        <TableCell className="text-center text-white/80">{tenant.teacherCount}</TableCell>
                        <TableCell className="text-white/50 text-sm">
                          {tenant.lastActivity
                            ? new Date(tenant.lastActivity).toLocaleDateString()
                            : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-blue-300 hover:text-blue-200 hover:bg-blue-500/10"
                            onClick={e => { e.stopPropagation(); setSelectedTenantId(tenant.id); }}
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tenant detail dialog */}
      <Dialog open={selectedTenantId !== null} onOpenChange={open => !open && setSelectedTenantId(null)}>
        <DialogContent className="max-w-2xl bg-slate-900 border-white/10 text-white max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <Building2 className="w-5 h-5 text-blue-300" />
              {tenantDetail?.name ?? "School Detail"}
            </DialogTitle>
          </DialogHeader>

          {!tenantDetail ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-400" />
            </div>
          ) : (
            <div className="space-y-5">
              {/* Meta */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                {[
                  { label: "Territory", value: tenantDetail.territoryName ?? "Unassigned" },
                  { label: "Created", value: new Date(tenantDetail.createdAt).toLocaleDateString() },
                  { label: "Lesson Plans", value: tenantDetail.lessonPlanCount },
                  { label: "Class Groups", value: tenantDetail.classGroupCount },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-white/5 rounded-lg p-3 border border-white/10">
                    <p className="text-white/40 text-xs uppercase tracking-wide mb-1">{label}</p>
                    <p className="text-white font-medium">{value}</p>
                  </div>
                ))}
              </div>

              {/* Members */}
              <div>
                <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wide mb-3 flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Members ({tenantDetail.members.length})
                </h3>
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {tenantDetail.members.length === 0 ? (
                    <p className="text-white/30 text-sm text-center py-4">No members yet.</p>
                  ) : (
                    tenantDetail.members.map(member => (
                      <div
                        key={member.id}
                        className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2 border border-white/10"
                      >
                        <div>
                          <p className="text-sm text-white font-medium">{member.name ?? "—"}</p>
                          <p className="text-xs text-white/40">{member.email ?? "—"}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${positionBadge(member.position)}`}>
                            {member.position.replace("_", " ")}
                          </span>
                          <span className="text-xs text-white/30">
                            {member.lastSignedIn
                              ? new Date(member.lastSignedIn).toLocaleDateString()
                              : "Never"}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
