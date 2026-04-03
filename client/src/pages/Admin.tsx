import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import NavBar from "@/components/NavBar";
import { cn } from "@/lib/utils";
import { BookOpen, Layers, Users, BarChart3, Lock, Activity, MessageSquare, Zap, TrendingUp, ArrowLeft } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { getLoginUrl } from "@/const";
import { useI18n } from "@/contexts/I18nContext";

const YEAR_GROUPS = ["junior", "primary", "secondary"] as const;

export default function Admin() {
  const { t } = useI18n();
  const { user, loading } = useAuth();
  const { data: stats, isLoading: statsLoading } = trpc.lomloe.getStats.useQuery(undefined, {
    enabled: !!user && user.role === "admin",
  });
  const { data: competencies } = trpc.lomloe.getCompetencies.useQuery();
  const { data: analytics, isLoading: analyticsLoading } = trpc.analytics.getDashboard.useQuery(undefined, {
    enabled: !!user && user.role === "admin",
    refetchInterval: 60_000,
  });
  const { data: ratingSummary } = trpc.analytics.getRatingSummary.useQuery(undefined, {
    enabled: !!user && user.role === "admin",
    refetchInterval: 60_000,
  });
  const { data: questionAnalytics } = trpc.lomloe.getQuestionAnalytics.useQuery(undefined, {
    enabled: !!user && user.role === "admin",
    refetchInterval: 120_000,
  });

  const COMP_COLORS: Record<string, string> = {
    CCL: "#3b82f6", CP: "#8b5cf6", STEM: "#10b981", CD: "#f59e0b",
    CPSAA: "#ef4444", CC: "#06b6d4", CE: "#f97316", CCEC: "#ec4899",
  };

  const YEAR_GROUP_LABELS = {
    junior: `${t("admin_junior")} (3–4)`,
    primary: `${t("admin_primary")} (5–6)`,
    secondary: `${t("admin_secondary")} (7–10)`,
  };

  // Loading auth state
  if (loading) {
    return (
      <div className="admin-bg flex flex-col">
        <NavBar />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  // Not logged in
  if (!user) {
    return (
      <div className="admin-bg flex flex-col">
        <NavBar />
        <div className="flex-1 flex items-center justify-center">
          <Card className="max-w-sm w-full mx-4">
            <CardContent className="p-8 flex flex-col items-center gap-4 text-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                <Lock className="w-8 h-8 text-muted-foreground" />
              </div>
              <h2 className="text-xl font-bold text-foreground">{t("sign_in_required")}</h2>
              <Button asChild className="w-full">
                <a href={getLoginUrl(window.location.pathname + window.location.search)}>{t("nav_sign_in")}</a>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Logged in but not admin
  if (user.role !== "admin") {
    return (
      <div className="admin-bg flex flex-col">
        <NavBar />
        <div className="flex-1 flex items-center justify-center">
          <Card className="max-w-sm w-full mx-4">
            <CardContent className="p-8 flex flex-col items-center gap-4 text-center">
              <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
                <Lock className="w-8 h-8 text-destructive" />
              </div>
              <h2 className="text-xl font-bold text-foreground">{t("sign_in_required")}</h2>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (statsLoading) {
    return (
      <div className="admin-bg flex flex-col">
        <NavBar />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  const maxPerComp = stats
    ? Math.max(...stats.breakdown.map((b) => b.total))
    : 1;

  return (
    <div className="admin-bg flex flex-col">
      <NavBar />

      <div className="container py-4 sm:py-8 flex flex-col gap-6 sm:gap-8">
        {/* Header */}
        <div className="flex flex-col gap-2">
          <Button variant="ghost" size="sm" onClick={() => window.history.back()} className="self-start flex items-center gap-1.5 text-white/70 hover:text-white hover:bg-white/10 -ml-2">
            <ArrowLeft className="size-4" />{t("btn_back")}
          </Button>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">{t("admin_title")}</h1>
          <p className="text-sm text-muted-foreground">{t("admin_subtitle")}</p>
        </div>

        {/* Usage analytics */}
        {analytics && (
          <>
            {/* KPI row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
              {[
                { label: "Total Users", value: analytics.totalUsers, icon: Users, color: "text-blue-500" },
                { label: "Active (7d)", value: analytics.activeUsers, icon: Activity, color: "text-green-500" },
                { label: "New Users (7d)", value: analytics.newUsers, icon: TrendingUp, color: "text-purple-500" },
                { label: "Total Materials", value: analytics.totalMaterials, icon: BookOpen, color: "text-orange-500" },
                { label: "Practice Sessions", value: analytics.totalSessions, icon: Zap, color: "text-yellow-500" },
                { label: "Challenges", value: analytics.totalChallenges, icon: BarChart3, color: "text-red-500" },
                { label: "Forum Messages", value: analytics.totalForumMessages, icon: MessageSquare, color: "text-cyan-500" },
              ].map(({ label, value, icon: Icon, color }) => (
                <Card key={label}>
                  <CardContent className="p-3 sm:p-4 flex items-center gap-3">
                    <Icon className={`w-5 h-5 flex-shrink-0 ${color}`} />
                    <div>
                      <p className="text-xl font-bold text-foreground">{value}</p>
                      <p className="text-xs text-muted-foreground">{label}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Materials per week chart */}
            {analytics.weeklyMaterials.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-primary" />
                    Materials Created per Week
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={analytics.weeklyMaterials} margin={{ top: 4, right: 8, left: -20, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                      <Tooltip contentStyle={{ fontSize: 12 }} />
                      <Bar dataKey="total" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Materials" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* Clara ratings chart */}
            {ratingSummary && ratingSummary.totalUp + ratingSummary.totalDown > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-violet-500" />
                    Clara Response Quality
                    {ratingSummary.pctHelpful !== null && (
                      <span className={cn(
                        "ml-auto text-sm font-semibold",
                        ratingSummary.pctHelpful >= 70 ? "text-green-500" : ratingSummary.pctHelpful >= 40 ? "text-yellow-500" : "text-red-500"
                      )}>
                        {ratingSummary.pctHelpful}% helpful
                      </span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 space-y-3">
                  {/* Weekly thumbs chart */}
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={ratingSummary.weeks} margin={{ top: 4, right: 8, left: -20, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="label" tick={{ fontSize: 9 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                      <Tooltip contentStyle={{ fontSize: 12 }} />
                      <Bar dataKey="up" name="Helpful" fill="#22c55e" radius={[3, 3, 0, 0]} stackId="a" />
                      <Bar dataKey="down" name="Not helpful" fill="#ef4444" radius={[3, 3, 0, 0]} stackId="a" />
                    </BarChart>
                  </ResponsiveContainer>
                  {/* Report reason breakdown */}
                  {ratingSummary.reportReasons.length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1.5">Reported issues</p>
                      <div className="flex flex-wrap gap-1.5">
                        {ratingSummary.reportReasons.map((r) => (
                          <span key={r.reason} className="text-xs bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-full px-2 py-0.5">
                            {r.reason.replace("_", " ")} ({r.count})
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Top competencies */}
            {analytics.topCompetencies.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-primary" />
                    Most-Used Competencies (Materials)
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={analytics.topCompetencies} margin={{ top: 4, right: 8, left: -20, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="competency" tick={{ fontSize: 10 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                      <Tooltip contentStyle={{ fontSize: 12 }} />
                      <Bar dataKey="total" radius={[4, 4, 0, 0]} name="Materials">
                        {analytics.topCompetencies.map((entry) => (
                          <Cell key={entry.competency} fill={COMP_COLORS[entry.competency] ?? "#6b7280"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* Knowledge bank summary cards */}
        {stats && (
          <div className="grid grid-cols-3 gap-2 sm:gap-4">
            <Card>
              <CardContent className="p-3 sm:p-5 flex flex-col sm:flex-row items-center sm:items-start gap-2 sm:gap-4">
                <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <BookOpen className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                </div>
                <div>
                  <p className="text-xl sm:text-3xl font-bold text-foreground text-center sm:text-left">{stats.totalQuestions}</p>
                  <p className="text-sm text-muted-foreground">{t("admin_total_questions")}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 sm:p-5 flex flex-col sm:flex-row items-center sm:items-start gap-2 sm:gap-4">
                <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Layers className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                </div>
                <div>
                  <p className="text-xl sm:text-3xl font-bold text-foreground text-center sm:text-left">{stats.totalCompetencies}</p>
                  <p className="text-sm text-muted-foreground">{t("admin_competencies")}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 sm:p-5 flex flex-col sm:flex-row items-center sm:items-start gap-2 sm:gap-4">
                <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Users className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                </div>
                <div>
                  <p className="text-xl sm:text-3xl font-bold text-foreground text-center sm:text-left">{stats.totalYearGroups}</p>
                  <p className="text-sm text-muted-foreground">{t("admin_year_groups")}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Coverage table */}
        {stats && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart3 className="w-4 h-4" />
                {t("admin_by_competency")}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-secondary/30">
                      <th className="text-left px-6 py-3 font-semibold text-foreground">
                        {t("admin_competency")}
                      </th>
                      {YEAR_GROUPS.map((yg) => (
                        <th
                          key={yg}
                          className="text-center px-4 py-3 font-semibold text-foreground"
                        >
                          {YEAR_GROUP_LABELS[yg]}
                        </th>
                      ))}
                      <th className="text-center px-4 py-3 font-semibold text-foreground">
                        {t("admin_total")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.breakdown.map((row) => {
                      const comp = competencies?.find((c) => c.code === row.code);
                      return (
                        <tr
                          key={row.code}
                          className="border-b border-border last:border-0 hover:bg-secondary/20 transition-colors"
                        >
                          <td className="px-3 sm:px-6 py-3 sm:py-4">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">{comp?.emoji ?? ""}</span>
                              <div>
                                <span className={cn("badge-" + row.code, "mr-2")}>
                                  {row.code}
                                </span>
                                <span className="text-muted-foreground text-xs hidden sm:inline">
                                  {row.name}
                                </span>
                              </div>
                            </div>
                          </td>
                          {YEAR_GROUPS.map((yg) => {
                            const count = row[yg];
                            return (
                              <td key={yg} className="px-2 sm:px-4 py-3 sm:py-4 text-center">
                                <span
                                  className={cn(
                                    "inline-flex w-8 h-8 rounded-lg items-center justify-center font-semibold text-sm",
                                    count > 0
                                      ? "bg-primary/10 text-primary"
                                      : "bg-secondary text-muted-foreground"
                                  )}
                                >
                                  {count}
                                </span>
                              </td>
                            );
                          })}
                          <td className="px-2 sm:px-4 py-3 sm:py-4 text-center">
                            <span className="font-bold text-foreground">{row.total}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-border bg-secondary/20">
                      <td className="px-6 py-3 font-bold text-foreground">{t("admin_total")}</td>
                      {YEAR_GROUPS.map((yg) => {
                        const colTotal = stats.breakdown.reduce((a, b) => a + b[yg], 0);
                        return (
                          <td key={yg} className="px-4 py-3 text-center font-bold text-foreground">
                            {colTotal}
                          </td>
                        );
                      })}
                      <td className="px-4 py-3 text-center font-bold text-primary text-base">
                        {stats.totalQuestions}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Bar chart visualisation */}
        {stats && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t("admin_coverage")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {stats.breakdown.map((row) => (
                <div key={row.code} className="flex items-center gap-3">
                  <span className={cn("badge-" + row.code, "w-16 text-center flex-shrink-0")}>
                    {row.code}
                  </span>
                  <div className="flex-1 bg-secondary rounded-full h-5 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${(row.total / maxPerComp) * 100}%`,
                        background: `var(--comp-${row.code.toLowerCase()})`,
                      }}
                    />
                  </div>
                  <span className="text-sm font-semibold text-foreground w-8 text-right">
                    {row.total}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Per-question analytics */}
        {questionAnalytics && questionAnalytics.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-orange-500" />
                Question Difficulty Analytics
                <span className="ml-auto text-xs text-muted-foreground font-normal">
                  {questionAnalytics.length} questions tracked · sorted hardest first
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 pr-3 text-muted-foreground font-medium text-xs">Question ID</th>
                      <th className="text-left py-2 pr-3 text-muted-foreground font-medium text-xs">Competency</th>
                      <th className="text-left py-2 pr-3 text-muted-foreground font-medium text-xs">Year Group</th>
                      <th className="text-right py-2 pr-3 text-muted-foreground font-medium text-xs">Attempts</th>
                      <th className="text-left py-2 text-muted-foreground font-medium text-xs">Correct Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {questionAnalytics.slice(0, 20).map((row) => {
                      const pct = row.correctRate;
                      const barColor = pct < 40 ? "#ef4444" : pct < 70 ? "#f59e0b" : "#22c55e";
                      return (
                        <tr key={row.questionId} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                          <td className="py-2 pr-3">
                            <code className="text-xs bg-secondary px-1.5 py-0.5 rounded font-mono text-foreground">{row.questionId}</code>
                          </td>
                          <td className="py-2 pr-3">
                            <span className={cn("badge-" + row.competency)}>{row.competency}</span>
                          </td>
                          <td className="py-2 pr-3 capitalize text-muted-foreground text-xs">{row.yearGroup}</td>
                          <td className="py-2 pr-3 text-right text-foreground font-medium">{row.total}</td>
                          <td className="py-2">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden min-w-[60px]">
                                <div
                                  className="h-full rounded-full transition-all"
                                  style={{ width: `${pct}%`, backgroundColor: barColor }}
                                />
                              </div>
                              <span className="text-xs font-semibold w-9 text-right" style={{ color: barColor }}>
                                {pct}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {questionAnalytics.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    No practice answers recorded yet. Data will appear after students complete practice sessions.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Source info */}
        <Card className="bg-secondary/30 border-dashed">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">Knowledge bank source: </span>
              Questions extracted from{" "}
              <a
                href="https://sebasnap.com/competencies"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                sebasnap.com/competencies
              </a>
              . To refresh, run{" "}
              <code className="bg-secondary px-1.5 py-0.5 rounded text-xs font-mono">
                python3 /home/ubuntu/build_sebasnap_knowledge.py
              </code>{" "}
              then rebuild the project.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
