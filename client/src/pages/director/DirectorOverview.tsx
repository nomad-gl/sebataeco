import DashboardLayout from "@/components/DashboardLayout";
import { useI18n } from "@/contexts/I18nContext";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { useEffect } from "react";
import {
  BarChart3, Users, BookOpen, Sparkles, Calendar,
  AlertTriangle, ShieldCheck, TrendingUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

const LOMLOE_COLORS: Record<string, string> = {
  CCL: "bg-blue-500",
  CP: "bg-indigo-500",
  STEM: "bg-green-500",
  CD: "bg-cyan-500",
  CPSAA: "bg-purple-500",
  CC: "bg-amber-500",
  CE: "bg-orange-500",
  CCEC: "bg-pink-500",
};

export default function DirectorOverview() {
  const { t } = useI18n();
  const { user, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();

  // Role gate: redirect non-admins
  useEffect(() => {
    if (!authLoading && user && user.role !== "admin") {
      navigate("/");
    }
  }, [authLoading, user, navigate]);

  const { data: stats, isLoading } = trpc.director.getStats.useQuery(undefined, {
    enabled: !!user && user.role === "admin",
  });
  const { data: trends, isLoading: trendsLoading } = trpc.director.getTrends.useQuery(undefined, {
    enabled: !!user && user.role === "admin",
  });

  if (authLoading || (!user && !authLoading)) return null;
  if (user?.role !== "admin") return null;

  const statCards = [
    { icon: Users, label: t("dir_stat_teachers"), value: stats?.totalTeachers, color: "text-blue-500" },
    { icon: BookOpen, label: t("dir_stat_lesson_plans"), value: stats?.totalLessonPlans, color: "text-green-500" },
    { icon: Sparkles, label: t("dir_stat_ai_plans"), value: stats?.aiGeneratedPlans, color: "text-purple-500" },
    { icon: TrendingUp, label: t("dir_stat_practice_sessions"), value: stats?.totalPracticeSessions, color: "text-cyan-500" },
    { icon: Calendar, label: t("dir_stat_calendar_events"), value: stats?.totalCalendarEvents, color: "text-amber-500" },
    { icon: AlertTriangle, label: t("dir_stat_open_bias_flags"), value: stats?.openBiasFlags, color: "text-red-500" },
  ];

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10">
            <BarChart3 className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t("dir_overview")}</h1>
            <p className="text-sm text-muted-foreground">{t("dir_overview_desc")}</p>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {statCards.map(({ icon: Icon, label, value, color }) => (
            <Card key={label} className="text-center">
              <CardContent className="pt-5 pb-4 px-3">
                <Icon className={`w-6 h-6 mx-auto mb-2 ${color}`} />
                {isLoading ? (
                  <Skeleton className="h-8 w-12 mx-auto mb-1" />
                ) : (
                  <p className="text-2xl font-bold text-foreground">{value ?? 0}</p>
                )}
                <p className="text-xs text-muted-foreground leading-tight mt-1">{label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* LOMLOE Competency Coverage */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="w-4 h-4 text-primary" />
              {t("dir_competency_coverage")}
            </CardTitle>
            <p className="text-xs text-muted-foreground">{t("dir_competency_coverage_desc")}</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading
              ? Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="space-y-1">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-4 w-full" />
                  </div>
                ))
              : stats?.competencyCoverage.map((comp) => (
                  <div key={comp.code} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-foreground flex items-center gap-1.5">
                        <Badge variant="outline" className="text-xs px-1.5 py-0 font-mono">{comp.code}</Badge>
                        {comp.label}
                      </span>
                      <span className="text-muted-foreground">
                        {comp.count} {t("dir_plans")} · {comp.percentage}%
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          (comp as { gap?: boolean }).gap ? "bg-red-400" : (LOMLOE_COLORS[comp.code] ?? "bg-primary")
                        }`}
                        style={{ width: `${Math.max(comp.percentage, (comp as { gap?: boolean }).gap ? 2 : 0)}%` }}
                      />
                    </div>
                    {(comp as { gap?: boolean }).gap && (
                      <p className="text-xs text-red-500 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        {t("dir_competency_gap")}
                      </p>
                    )}
                  </div>
                ))}
          </CardContent>
        </Card>

        {/* Bias scan summary */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="w-4 h-4 text-primary" />
              {t("dir_bias_summary")}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-6 flex-wrap">
            {isLoading ? (
              <Skeleton className="h-8 w-40" />
            ) : (
              <>
                <div className="text-center">
                  <p className="text-2xl font-bold text-foreground">{stats?.openBiasFlags ?? 0}</p>
                  <p className="text-xs text-muted-foreground">{t("dir_open_bias_flags")}</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-foreground">{stats?.recentScanRuns ?? 0}</p>
                  <p className="text-xs text-muted-foreground">{t("dir_scans_30d")}</p>
                </div>
                <a href="/accountability" className="text-xs text-primary underline underline-offset-2 ml-auto">
                  {t("dir_view_accountability")} →
                </a>
              </>
            )}
          </CardContent>
        </Card>

        {/* Trend sparklines */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Lesson plans trend */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <TrendingUp className="w-4 h-4 text-green-500" />
                {t("dir_trend_plans")}
              </CardTitle>
              <p className="text-xs text-muted-foreground">{t("dir_trend_plans_desc")}</p>
            </CardHeader>
            <CardContent>
              {trendsLoading ? (
                <div className="h-24 flex items-center justify-center"><Skeleton className="h-20 w-full" /></div>
              ) : (
                <ResponsiveContainer width="100%" height={80}>
                  <LineChart data={(trends?.weeks ?? []).map(w => ({ week: w.label, count: w.plansCreated }))}>
                    <XAxis dataKey="week" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{ fontSize: 11, padding: "4px 8px", borderRadius: 6 }}
                      formatter={(v: number) => [v, t("dir_stat_lesson_plans")]}
                    />
                    <Line type="monotone" dataKey="count" stroke="#22c55e" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* AI sessions trend */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Sparkles className="w-4 h-4 text-purple-500" />
                {t("dir_trend_ai")}
              </CardTitle>
              <p className="text-xs text-muted-foreground">{t("dir_trend_ai_desc")}</p>
            </CardHeader>
            <CardContent>
              {trendsLoading ? (
                <div className="h-24 flex items-center justify-center"><Skeleton className="h-20 w-full" /></div>
              ) : (
                <ResponsiveContainer width="100%" height={80}>
                  <LineChart data={(trends?.weeks ?? []).map(w => ({ week: w.label, count: w.aiPlans }))}>
                    <XAxis dataKey="week" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{ fontSize: 11, padding: "4px 8px", borderRadius: 6 }}
                      formatter={(v: number) => [v, t("dir_trend_ai")]}
                    />
                    <Line type="monotone" dataKey="count" stroke="#a855f7" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        <p className="text-xs text-muted-foreground text-right">Powered by SEBA</p>
      </div>
    </DashboardLayout>
  );
}
