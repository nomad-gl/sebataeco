import DashboardLayout from "@/components/DashboardLayout";
import { useI18n } from "@/contexts/I18nContext";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { UserCheck, Users, BookOpen, Sparkles, Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

export default function DirectorStaff() {
  const { t } = useI18n();
  const { user, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!authLoading && user && user.role !== "admin") navigate("/");
  }, [authLoading, user, navigate]);

  const { data, isLoading } = trpc.director.getStaffActivity.useQuery(undefined, {
    enabled: !!user && user.role === "admin",
  });

  if (authLoading || (!user && !authLoading)) return null;
  if (user?.role !== "admin") return null;

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10">
            <UserCheck className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t("dir_staff")}</h1>
            <p className="text-sm text-muted-foreground">{t("dir_staff_desc")}</p>
          </div>
        </div>

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
                        <span className="flex items-center justify-end gap-1"><Sparkles className="w-3 h-3" />{t("dir_ai_col")}</span>
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
                              <p className="font-medium text-foreground truncate">{teacher.name ?? teacher.email ?? t("dir_unknown_teacher")}</p>
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
