import DashboardLayout from "@/components/DashboardLayout";
import { useI18n } from "@/contexts/I18nContext";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation, Link } from "wouter";
import { useEffect, useState } from "react";
import { UserCheck, Users, BookOpen, Activity, ScanLine, RefreshCw, Sparkles, Calendar, Clock, ExternalLink } from "lucide-react";
import { SebaSymbol } from "@/components/SebaSymbol";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  const [plansModal, setPlansModal] = useState<{ userId: number; name: string; aiOnly: boolean } | null>(null);

  useEffect(() => {
    if (!authLoading && user && user.role !== "admin" && user.role !== "director") navigate("/");
  }, [authLoading, user, navigate]);

  const { data, isLoading } = trpc.director.getStaffActivity.useQuery(undefined, {
    enabled: !!user && (user.role === "admin" || user.role === "director"),
  });

  const { data: allUsers, isLoading: usersLoading, refetch: refetchUsers } = trpc.director.listUsers.useQuery(undefined, {
    enabled: !!user && (user.role === "admin" || user.role === "director") && scanOpen,
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
  if (user?.role !== "admin" && user?.role !== "director") return null;

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
              <Link href="/director/users">
                <Card className="text-center cursor-pointer hover:shadow-md hover:border-primary/40 transition-all group">
                  <CardContent className="pt-4 pb-3">
                    <p className="text-2xl font-bold text-foreground group-hover:text-primary transition-colors">{data?.totalTeachers ?? 0}</p>
                    <p className="text-xs text-muted-foreground mt-1">{t("dir_total_teachers")}</p>
                  </CardContent>
                </Card>
              </Link>
              <a href="#staff-activity-table">
                <Card className="text-center cursor-pointer hover:shadow-md hover:border-primary/40 transition-all group">
                  <CardContent className="pt-4 pb-3">
                    <p className="text-2xl font-bold text-primary group-hover:text-primary/80 transition-colors">{data?.activeThisWeek ?? 0}</p>
                    <p className="text-xs text-muted-foreground mt-1">{t("dir_active_this_week")}</p>
                  </CardContent>
                </Card>
              </a>
              <Link href="/director/reports">
                <Card className="text-center cursor-pointer hover:shadow-md hover:border-green-400/40 transition-all group">
                  <CardContent className="pt-4 pb-3">
                    <p className="text-2xl font-bold text-green-500 group-hover:text-green-400 transition-colors">{data?.totalPlansCreated ?? 0}</p>
                    <p className="text-xs text-muted-foreground mt-1">{t("dir_stat_lesson_plans")}</p>
                  </CardContent>
                </Card>
              </Link>
              <Link href="/director/reports">
                <Card className="text-center cursor-pointer hover:shadow-md hover:border-amber-400/40 transition-all group">
                  <CardContent className="pt-4 pb-3">
                    <p className="text-2xl font-bold text-amber-500 group-hover:text-amber-400 transition-colors">{data?.totalAiPlans ?? 0}</p>
                    <p className="text-xs text-muted-foreground mt-1">{t("dir_stat_ai_plans")}</p>
                  </CardContent>
                </Card>
              </Link>
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
        <Card id="staff-activity-table">
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
                        <td className="py-2.5 pr-4 text-right font-medium">
                          <button
                            onClick={() => setPlansModal({ userId: teacher.id, name: teacher.name ?? teacher.email ?? t("dir_unknown_teacher"), aiOnly: false })}
                            className="font-medium text-foreground hover:text-primary hover:underline cursor-pointer transition-colors"
                            title={t("dir_view_plans")}
                          >
                            {teacher.plansCreated}
                          </button>
                        </td>
                        <td className="py-2.5 pr-4 text-right">
                          <button
                            onClick={() => setPlansModal({ userId: teacher.id, name: teacher.name ?? teacher.email ?? t("dir_unknown_teacher"), aiOnly: true })}
                            className="cursor-pointer"
                            title={t("dir_view_ai_plans")}
                          >
                            <Badge variant={teacher.aiPlans > 0 ? "default" : "secondary"} className="text-xs hover:opacity-80 transition-opacity">{teacher.aiPlans}</Badge>
                          </button>
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

      {/* Teacher Plans Modal */}
      {plansModal && (
        <TeacherPlansModal
          userId={plansModal.userId}
          teacherName={plansModal.name}
          aiOnly={plansModal.aiOnly}
          onClose={() => setPlansModal(null)}
        />
      )}
    </DashboardLayout>
  );
}

// ─── TeacherPlansModal ────────────────────────────────────────────────────────

function TeacherPlansModal({
  userId,
  teacherName,
  aiOnly,
  onClose,
}: {
  userId: number;
  teacherName: string;
  aiOnly: boolean;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const { data: plans, isLoading } = trpc.director.getTeacherPlans.useQuery(
    { userId, aiOnly },
    { enabled: true }
  );

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl w-full">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {aiOnly ? <Sparkles className="w-4 h-4 text-amber-500" /> : <BookOpen className="w-4 h-4 text-primary" />}
            {aiOnly ? t("dir_ai_plans_for") : t("dir_plans_for")} {teacherName}
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] pr-2">
          {isLoading ? (
            <div className="space-y-3 py-2">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16" />)}
            </div>
          ) : !plans?.length ? (
            <div className="text-center py-12 text-muted-foreground">
              <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">{t("dir_no_plans_found")}</p>
            </div>
          ) : (
            <div className="space-y-2 py-2">
              {plans.map((plan: NonNullable<typeof plans>[number]) => (
                <div
                  key={plan.id}
                  className="border rounded-lg p-3 hover:bg-muted/40 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm text-foreground truncate">{plan.title}</p>
                        {plan.aiGenerated && (
                          <Badge className="bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 text-[10px] px-1.5 py-0">
                            <Sparkles className="w-2.5 h-2.5 mr-0.5" /> AI
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                        {plan.subject && (
                          <span className="flex items-center gap-1">
                            <BookOpen className="w-3 h-3" />{plan.subject}
                          </span>
                        )}
                        {plan.yearGroup && <span>{plan.yearGroup}</span>}
                        {plan.lessonDate && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />{plan.lessonDate}
                          </span>
                        )}
                        {plan.duration && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />{plan.duration} min
                          </span>
                        )}
                        <span className="ml-auto">{new Date(plan.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                  {plan.learningOutcomes && (() => {
                    try {
                      const outcomes: string[] = JSON.parse(plan.learningOutcomes);
                      if (outcomes.length > 0) return (
                        <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                          {outcomes[0]}{outcomes.length > 1 ? ` (+${outcomes.length - 1} more)` : ""}
                        </p>
                      );
                    } catch { /* ignore */ }
                    return null;
                  })()}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
        <p className="text-xs text-muted-foreground text-right pt-1">
          {plans?.length ?? 0} {aiOnly ? t("dir_ai_plans_count") : t("dir_plans_count")}
        </p>
      </DialogContent>
    </Dialog>
  );
}
