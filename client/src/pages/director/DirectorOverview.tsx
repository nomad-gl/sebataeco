import DashboardLayout from "@/components/DashboardLayout";
import { useI18n } from "@/contexts/I18nContext";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import {
  BarChart3, Users, BookOpen, Calendar,
  AlertTriangle, ShieldCheck, TrendingUp, FileDown, Loader2, Building2,
} from "lucide-react";
import { SebaSymbol } from "@/components/SebaSymbol";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

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
  const [pdfLocale, setPdfLocale] = useState<"en" | "es" | "ca">("ca");
  const [directorName, setDirectorName] = useState("");
  const [directorTitle, setDirectorTitle] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [directorLogoDataUrl, setDirectorLogoDataUrl] = useState<string | null>(null);
  const [prefilled, setPrefilled] = useState(false);

  const handleDirectorLogoUpload = (file: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      setDirectorLogoDataUrl(e.target?.result as string ?? null);
    };
    reader.readAsDataURL(file);
  };

  // Role gate: redirect non-admins
  useEffect(() => {
    if (!authLoading && user && user.role !== "admin" && user.role !== "director") {
      navigate("/");
    }
  }, [authLoading, user, navigate]);

  const { data: stats, isLoading } = trpc.director.getStats.useQuery(undefined, {
    enabled: !!user && (user.role === "admin" || user.role === "director"),
  });
  const { data: trends, isLoading: trendsLoading } = trpc.director.getTrends.useQuery(undefined, {
    enabled: !!user && (user.role === "admin" || user.role === "director"),
  });

  // Fetch director info for auto-prefill
  const { data: directorInfo, isLoading: directorInfoLoading } = trpc.director.getDirectorInfo.useQuery(undefined, {
    enabled: !!user && (user.role === "admin" || user.role === "director"),
  });

  // Security alerts query
  const { data: securityAlerts } = trpc.director.getSecurityAlerts.useQuery(undefined, {
    enabled: !!user && (user.role === "admin" || user.role === "director"),
  });

  // Auto-prefill fields once director info is loaded
  useEffect(() => {
    if (directorInfo && !prefilled) {
      if (directorInfo.name) setDirectorName(directorInfo.name);
      if (directorInfo.position) setDirectorTitle(directorInfo.position);
      if (directorInfo.schoolName) setSchoolName(directorInfo.schoolName);
      if (directorInfo.schoolLogoUrl && !directorLogoDataUrl) {
        setDirectorLogoDataUrl(directorInfo.schoolLogoUrl);
      }
      setPrefilled(true);
    }
  }, [directorInfo, prefilled, directorLogoDataUrl]);

  const generatePdf = trpc.director.generateDirectorPdf.useMutation({
    onSuccess: (data) => {
      const a = document.createElement("a");
      a.href = data.url;
      a.download = data.filename;
      a.target = "_blank";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success(t("dir_pdf_ready_title"), { description: t("dir_pdf_ready_desc") });
    },
    onError: (err) => {
      toast.error(t("dir_pdf_error_title"), { description: err.message });
    },
  });

  if (authLoading || (!user && !authLoading)) return null;
  if (user?.role !== "admin" && user?.role !== "director") return null;

  const statCards = [
    { icon: Users, label: t("dir_stat_teachers"), value: stats?.totalTeachers, color: "text-blue-500", href: "/director/staff" },
    { icon: BookOpen, label: t("dir_stat_lesson_plans"), value: stats?.totalLessonPlans, color: "text-green-500", href: "/director/reports" },
    { icon: SebaSymbol, label: t("dir_stat_ai_plans"), value: stats?.aiGeneratedPlans, color: "text-purple-500", href: "/director/reports" },
    { icon: TrendingUp, label: t("dir_stat_practice_sessions"), value: stats?.totalPracticeSessions, color: "text-cyan-500", href: "/director/progress" },
    { icon: Calendar, label: t("dir_stat_calendar_events"), value: stats?.totalCalendarEvents, color: "text-amber-500", href: "/school-calendar" },
    { icon: AlertTriangle, label: t("dir_stat_open_bias_flags"), value: stats?.openBiasFlags, color: "text-red-500", href: "/director/reports" },
  ];

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10">
              <BarChart3 className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">{t("dir_overview")}</h1>
              <p className="text-sm text-muted-foreground">{t("dir_overview_desc")}</p>
            </div>
          </div>

          {/* Director report panel */}
          <div className="flex flex-col items-end gap-3">
            {/* PDF Preview card — shows logo + director info */}
            <div className="rounded-xl border border-border bg-card shadow-sm p-4 flex flex-col items-center gap-2 min-w-[220px]">
              {/* Logo / motif */}
              <div className="flex items-center justify-center w-16 h-16 rounded-lg bg-muted overflow-hidden">
                {directorLogoDataUrl ? (
                  <img src={directorLogoDataUrl} alt="school logo" className="w-full h-full object-contain" />
                ) : (
                  <Building2 className="w-8 h-8 text-muted-foreground" />
                )}
              </div>
              {/* Director name */}
              {directorInfoLoading && !prefilled ? (
                <div className="w-32 h-4 bg-muted animate-pulse rounded" />
              ) : (
                <p className="text-sm font-semibold text-foreground text-center leading-tight">
                  {directorName || <span className="text-muted-foreground italic text-xs">{t("dir_pdf_director_name")}</span>}
                </p>
              )}
              {/* Director role */}
              {directorInfoLoading && !prefilled ? (
                <div className="w-24 h-3 bg-muted animate-pulse rounded" />
              ) : (
                <p className="text-xs text-muted-foreground text-center">
                  {directorTitle || <span className="italic">{t("dir_pdf_director_title")}</span>}
                </p>
              )}
              {/* School name */}
              {directorInfoLoading && !prefilled ? (
                <div className="w-28 h-3 bg-muted animate-pulse rounded" />
              ) : (
                <p className="text-xs font-medium text-primary text-center">
                  {schoolName || <span className="text-muted-foreground italic">{t("dir_pdf_school_name") ?? "School name"}</span>}
                </p>
              )}
              <p className="text-[10px] text-muted-foreground/60 mt-1">PDF Preview</p>
            </div>

            {/* Form fields */}
            <div className="flex items-center gap-2 flex-wrap justify-end">
              <input
                type="text"
                placeholder={t("dir_pdf_director_name")}
                value={directorName}
                onChange={e => setDirectorName(e.target.value)}
                className="text-xs border border-border rounded-md px-2 py-1.5 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary w-36"
                disabled={generatePdf.isPending}
              />
              <input
                type="text"
                placeholder={t("dir_pdf_director_title")}
                value={directorTitle}
                onChange={e => setDirectorTitle(e.target.value)}
                className="text-xs border border-border rounded-md px-2 py-1.5 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary w-36"
                disabled={generatePdf.isPending}
              />
              <input
                type="text"
                placeholder={t("dir_pdf_school_name") ?? "School name"}
                value={schoolName}
                onChange={e => setSchoolName(e.target.value)}
                className="text-xs border border-border rounded-md px-2 py-1.5 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary w-36"
                disabled={generatePdf.isPending}
              />
              <label className="cursor-pointer flex items-center gap-1 text-xs border border-border rounded-md px-2 py-1.5 bg-background text-foreground hover:bg-muted/40 transition-colors">
                {directorLogoDataUrl ? (
                  <><img src={directorLogoDataUrl} alt="logo" className="w-4 h-4 object-contain rounded" /><span className="text-green-600">{t("dir_pdf_logo_uploaded")}</span></>
                ) : (
                  <><FileDown className="w-3.5 h-3.5" />{t("dir_pdf_upload_logo")}</>
                )}
                <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleDirectorLogoUpload(f); }} />
              </label>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={pdfLocale}
                onChange={e => setPdfLocale(e.target.value as "en" | "es" | "ca")}
                className="text-xs border border-border rounded-md px-2 py-1.5 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                disabled={generatePdf.isPending}
              >
                <option value="ca">Català</option>
                <option value="es">Español</option>
                <option value="en">English</option>
              </select>
              <Button
                size="default"
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-md gap-2 px-5"
                onClick={() => generatePdf.mutate({
                  locale: pdfLocale,
                  directorName: directorName || null,
                  directorTitle: directorTitle || null,
                  schoolName: schoolName || null,
                  directorLogoUrl: directorLogoDataUrl || null,
                })}
                disabled={generatePdf.isPending}
              >
                {generatePdf.isPending ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />{t("dir_pdf_generating")}</>
                ) : (
                  <><FileDown className="w-4 h-4" />{t("dir_pdf_btn")}</>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* PDF hero banner — shown while generating */}
        {generatePdf.isPending && (
          <div className="rounded-xl border border-primary/30 bg-primary/5 px-5 py-4 flex items-center gap-4">
            <Loader2 className="w-6 h-6 text-primary animate-spin flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-foreground">{t("dir_pdf_generating_title")}</p>
              <p className="text-xs text-muted-foreground">{t("dir_pdf_generating_desc")}</p>
            </div>
          </div>
        )}

        {/* Security alerts */}
        {securityAlerts && (securityAlerts.noPasswordCount > 0 || securityAlerts.inactiveCount > 0) && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Security Alerts
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {securityAlerts.noPasswordCount > 0 && (
                <a href="/director/users" className="block group">
                  <div className="rounded-lg border border-red-300 bg-red-50 dark:bg-red-950/30 dark:border-red-800 p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start gap-3">
                      <div className="p-1.5 rounded-md bg-red-100 dark:bg-red-900 shrink-0">
                        <ShieldCheck className="w-4 h-4 text-red-600 dark:text-red-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-red-800 dark:text-red-300">
                          {securityAlerts.noPasswordCount} user{securityAlerts.noPasswordCount !== 1 ? "s" : ""} without a password
                        </p>
                        <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">
                          These accounts are still using a temporary password — a security risk.
                        </p>
                        {securityAlerts.noPasswordSample.length > 0 && (
                          <ul className="mt-2 space-y-0.5">
                            {securityAlerts.noPasswordSample.map((u) => (
                              <li key={u.id} className="text-xs text-red-700 dark:text-red-300 truncate">
                                · {u.name ?? u.email ?? `User #${u.id}`}
                              </li>
                            ))}
                            {securityAlerts.noPasswordCount > 5 && (
                              <li className="text-xs text-red-500 dark:text-red-400">
                                + {securityAlerts.noPasswordCount - 5} more
                              </li>
                            )}
                          </ul>
                        )}
                      </div>
                    </div>
                  </div>
                </a>
              )}
              {securityAlerts.inactiveCount > 0 && (
                <a href="/director/staff" className="block group">
                  <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700 p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start gap-3">
                      <div className="p-1.5 rounded-md bg-amber-100 dark:bg-amber-900 shrink-0">
                        <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                          {securityAlerts.inactiveCount} user{securityAlerts.inactiveCount !== 1 ? "s" : ""} inactive for 90+ days
                        </p>
                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                          These accounts have not signed in for over 90 days.
                        </p>
                        {securityAlerts.inactiveSample.length > 0 && (
                          <ul className="mt-2 space-y-0.5">
                            {securityAlerts.inactiveSample.map((u) => (
                              <li key={u.id} className="text-xs text-amber-700 dark:text-amber-300 truncate">
                                · {u.name ?? u.email ?? `User #${u.id}`}
                                {u.lastSignedIn && (
                                  <span className="text-amber-500 ml-1">
                                    ({Math.floor((Date.now() - new Date(u.lastSignedIn).getTime()) / (24 * 60 * 60 * 1000))}d ago)
                                  </span>
                                )}
                              </li>
                            ))}
                            {securityAlerts.inactiveCount > 5 && (
                              <li className="text-xs text-amber-500 dark:text-amber-400">
                                + {securityAlerts.inactiveCount - 5} more
                              </li>
                            )}
                          </ul>
                        )}
                      </div>
                    </div>
                  </div>
                </a>
              )}
            </div>
          </div>
        )}
        {/* Stats grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {statCards.map(({ icon: Icon, label, value, color, href }) => (
            <a key={label} href={href} className="block group">
              <Card className="text-center transition-all duration-150 hover:shadow-md hover:border-primary/40 group-hover:bg-muted/30 cursor-pointer">
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
            </a>
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
                  <p className="text-xs text-muted-foreground">{t("dir_bias_open")}</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-foreground">{stats?.recentScanRuns ?? 0}</p>
                  <p className="text-xs text-muted-foreground">{t("dir_bias_recent_scans")}</p>
                </div>
                {(stats?.openBiasFlags ?? 0) > 0 && (
                  <Badge variant="destructive" className="text-xs">
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    {t("dir_bias_action_needed")}
                  </Badge>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Activity trend */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="w-4 h-4 text-primary" />
              {t("dir_activity_trend")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {trendsLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={120}>
                <LineChart data={(trends as { date: string; count: number }[] | undefined) ?? []}>
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
