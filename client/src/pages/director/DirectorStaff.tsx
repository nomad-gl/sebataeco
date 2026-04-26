import DashboardLayout from "@/components/DashboardLayout";
import { useI18n } from "@/contexts/I18nContext";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { UserCheck, Users, BookOpen, Activity, ScanLine, RefreshCw } from "lucide-react";
import { SebaSymbol } from "@/components/SebaSymbol";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

type Position = "unassigned" | "teacher" | "head_of_study" | "director";

const POSITION_COLORS: Record<Position, string> = {
  director:      "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  head_of_study: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  teacher:       "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  unassigned:    "bg-muted text-muted-foreground",
};

export default function DirectorStaff() {
  const { t } = useI18n();
  const { user, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const [scanOpen, setScanOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && user && user.role !== "admin") navigate("/");
  }, [authLoading, user, navigate]);

  const { data, isLoading } = trpc.director.getStaffActivity.useQuery(undefined, {
    enabled: !!user && user.role === "admin",
  });

  const { data: allUsers, isLoading: usersLoading, refetch: refetchUsers } = trpc.director.listUsers.useQuery(undefined, {
    enabled: !!user && user.role === "admin" && scanOpen,
  });

  const utils = trpc.useUtils();
  const setPositionMutation = trpc.director.setUserPosition.useMutation({
    onSuccess: () => {
      utils.director.listUsers.invalidate();
      toast.success(t("dir_position_updated"));
    },
    onError: () => toast.error(t("dir_position_update_error")),
  });

  if (authLoading || (!user && !authLoading)) return null;
  if (user?.role !== "admin") return null;

  const positionLabel = (p: Position) => {
    const map: Record<Position, string> = {
      director:      t("position_director"),
      head_of_study: t("position_head_of_study"),
      teacher:       t("position_teacher"),
      unassigned:    t("position_unassigned"),
    };
    return map[p] ?? p;
  };

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10">
            <UserCheck className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t("dir_staff")}</h1>
            <p className="text-sm text-muted-foreground">{t("dir_staff_desc")}</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20" />)
          ) : (
            <>
              <Card className="text-center"><CardContent className="pt-4 pb-3">
                <p className="text-2xl font-bold text-foreground">{data?.totalTeachers ?? 0}</p>
                <p className="text-xs text-muted-foreground mt-1">{t("dir_total_teachers")}</p>
              </CardContent></Card>
              <Card className="text-center"><CardContent className="pt-4 pb-3">
                <p className="text-2xl font-bold text-primary">{data?.activeThisWeek ?? 0}</p>
                <p className="text-xs text-muted-foreground mt-1">{t("dir_active_this_week")}</p>
              </CardContent></Card>
              <Card className="text-center"><CardContent className="pt-4 pb-3">
                <p className="text-2xl font-bold text-green-500">{data?.totalPlansCreated ?? 0}</p>
                <p className="text-xs text-muted-foreground mt-1">{t("dir_stat_lesson_plans")}</p>
              </CardContent></Card>
              <Card className="text-center"><CardContent className="pt-4 pb-3">
                <p className="text-2xl font-bold text-amber-500">{data?.totalAiPlans ?? 0}</p>
                <p className="text-xs text-muted-foreground mt-1">{t("dir_stat_ai_plans")}</p>
              </CardContent></Card>
            </>
          )}
        </div>

        {/* ── Member Scan Panel ────────────────────────────────────────────── */}
        <Card className="border-primary/20">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <CardTitle className="flex items-center gap-2 text-base">
                <ScanLine className="w-4 h-4 text-primary" />
                {t("dir_member_scan_title")}
              </CardTitle>
              <div className="flex gap-2">
                {scanOpen && (
                  <Button size="sm" variant="ghost" onClick={() => refetchUsers()} disabled={usersLoading}>
                    <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${usersLoading ? "animate-spin" : ""}`} />
                    {t("dir_member_scan_refresh")}
                  </Button>
                )}
                <Button
                  size="sm"
                  variant={scanOpen ? "secondary" : "default"}
                  onClick={() => setScanOpen(v => !v)}
                >
                  <ScanLine className="w-3.5 h-3.5 mr-1.5" />
                  {scanOpen ? t("dir_member_scan_hide") : t("dir_member_scan_run")}
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{t("dir_member_scan_desc")}</p>
          </CardHeader>

          {scanOpen && (
            <CardContent>
              {usersLoading ? (
                <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
              ) : !allUsers?.length ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">{t("dir_no_members_found")}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="pb-2 pr-4 font-medium">{t("dir_member_name")}</th>
                        <th className="pb-2 pr-4 font-medium hidden sm:table-cell">{t("dir_member_joined")}</th>
                        <th className="pb-2 pr-4 font-medium hidden md:table-cell">{t("dir_member_last_seen")}</th>
                        <th className="pb-2 font-medium">{t("dir_member_position")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {allUsers.map(member => {
                        const pos = (member.position ?? "unassigned") as Position;
                        return (
                          <tr key={member.id} className="hover:bg-muted/30 transition-colors">
                            <td className="py-2.5 pr-4">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                                  {(member.name ?? member.email ?? "?").charAt(0).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <p className="font-medium text-foreground truncate">{member.name ?? t("dir_unknown_teacher")}</p>
                                    {pos === "teacher" && (
                                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700 shrink-0">
                                        CUTCG
                                      </span>
                                    )}
                                  </div>
                                  {member.email && (
                                    <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="py-2.5 pr-4 text-muted-foreground text-xs hidden sm:table-cell">
                              {member.createdAt ? new Date(member.createdAt).toLocaleDateString() : "—"}
                            </td>
                            <td className="py-2.5 pr-4 text-muted-foreground text-xs hidden md:table-cell">
                              {member.lastSignedIn ? new Date(member.lastSignedIn).toLocaleDateString() : "—"}
                            </td>
                            <td className="py-2.5">
                              <Select
                                value={pos}
                                onValueChange={(val) =>
                                  setPositionMutation.mutate({ userId: member.id, position: val as Position })
                                }
                                disabled={setPositionMutation.isPending}
                              >
                                <SelectTrigger className="h-7 text-xs w-40">
                                  <SelectValue>
                                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${POSITION_COLORS[pos]}`}>
                                      {positionLabel(pos)}
                                    </span>
                                  </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                  {(["director", "head_of_study", "teacher", "unassigned"] as Position[]).map(p => (
                                    <SelectItem key={p} value={p}>
                                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${POSITION_COLORS[p]}`}>
                                        {positionLabel(p)}
                                      </span>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <p className="text-xs text-muted-foreground mt-3 text-right">
                    {allUsers.length} {t("dir_members_total")}
                  </p>
                </div>
              )}
            </CardContent>
          )}
        </Card>

        {/* ── Staff Activity Table ─────────────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="w-4 h-4 text-primary" />
              {t("dir_staff_activity_table")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
            ) : !data?.teachers.length ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">{t("dir_no_staff_data")}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="pb-2 pr-4 font-medium">{t("dir_teacher_name")}</th>
                      <th className="pb-2 pr-4 font-medium text-right">
                        <span className="flex items-center justify-end gap-1"><BookOpen className="w-3 h-3" />{t("dir_plans_col")}</span>
                      </th>
                      <th className="pb-2 pr-4 font-medium text-right">
                        <span className="flex items-center justify-end gap-1"><SebaSymbol className="w-3 h-3" />{t("dir_ai_col")}</span>
                      </th>
                      <th className="pb-2 font-medium text-right">{t("dir_last_active_col")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.teachers.map(teacher => (
                      <tr key={teacher.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-2.5 pr-4">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                              {(teacher.name ?? teacher.email ?? "?").charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <p className="font-medium text-foreground truncate">{teacher.name ?? teacher.email ?? t("dir_unknown_teacher")}</p>
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700 shrink-0">
                                  CUTCG
                                </span>
                              </div>
                              {teacher.email && teacher.name && (
                                <p className="text-xs text-muted-foreground truncate">{teacher.email}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-2.5 pr-4 text-right font-medium">{teacher.plansCreated}</td>
                        <td className="py-2.5 pr-4 text-right">
                          <Badge variant={teacher.aiPlans > 0 ? "default" : "secondary"} className="text-xs">{teacher.aiPlans}</Badge>
                        </td>
                        <td className="py-2.5 text-right text-muted-foreground text-xs">
                          {teacher.lastActive ? new Date(teacher.lastActive).toLocaleDateString() : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground text-right">Powered by SEBA</p>
      </div>
    </DashboardLayout>
  );
}
