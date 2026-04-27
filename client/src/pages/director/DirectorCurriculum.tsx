import DashboardLayout from "@/components/DashboardLayout";
import { useI18n } from "@/contexts/I18nContext";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { BookCheck, AlertTriangle, CheckCircle2, BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

const LOMLOE_DESCRIPTIONS: Record<string, string> = {
  CCL: "Competencia en comunicación lingüística",
  CP: "Competencia plurilingüe",
  STEM: "Competencia matemática y en ciencia, tecnología e ingeniería",
  CD: "Competencia digital",
  CPSAA: "Competencia personal, social y de aprender a aprender",
  CC: "Competencia ciudadana",
  CE: "Competencia emprendedora",
  CCEC: "Competencia en conciencia y expresión culturales",
};

export default function DirectorCurriculum() {
  const { t } = useI18n();
  const { user, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!authLoading && user && user.role !== "admin" && user.role !== "director") navigate("/");
  }, [authLoading, user, navigate]);

  const { data, isLoading } = trpc.director.getCurriculumCompliance.useQuery(undefined, {
    enabled: !!user && (user.role === "admin" || user.role === "director"),
  });

  if (authLoading || (!user && !authLoading)) return null;
  if (user?.role !== "admin" && user?.role !== "director") return null;

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10">
            <BookCheck className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t("dir_curriculum")}</h1>
            <p className="text-sm text-muted-foreground">{t("dir_curriculum_desc")}</p>
          </div>
        </div>

        {/* Summary row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20" />)
          ) : (
            <>
              <Card className="text-center">
                <CardContent className="pt-4 pb-3">
                  <p className="text-2xl font-bold text-foreground">{data?.totalPlans ?? 0}</p>
                  <p className="text-xs text-muted-foreground mt-1">{t("dir_stat_lesson_plans")}</p>
                </CardContent>
              </Card>
              <Card className="text-center">
                <CardContent className="pt-4 pb-3">
                  <p className="text-2xl font-bold text-green-500">
                    {data?.competencies.filter(c => !c.gap).length ?? 0}/8
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">{t("dir_competency_coverage")}</p>
                </CardContent>
              </Card>
              <Card className="text-center">
                <CardContent className="pt-4 pb-3">
                  <p className={`text-2xl font-bold ${(data?.gapCount ?? 0) > 0 ? "text-red-500" : "text-green-500"}`}>
                    {data?.gapCount ?? 0}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">{t("dir_competency_gap_count")}</p>
                </CardContent>
              </Card>
              <Card className="text-center">
                <CardContent className="pt-4 pb-3">
                  <p className="text-2xl font-bold text-foreground">{data?.subjectCoverage.length ?? 0}</p>
                  <p className="text-xs text-muted-foreground mt-1">{t("dir_subjects_active")}</p>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {/* Competency heatmap */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="w-4 h-4 text-primary" />
              {t("dir_competency_heatmap")}
            </CardTitle>
            <p className="text-xs text-muted-foreground">{t("dir_competency_coverage_desc")}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading
              ? Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-14" />)
              : data?.competencies.map((comp) => (
                  <div key={comp.code} className="space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Badge variant="outline" className="font-mono text-xs shrink-0">{comp.code}</Badge>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{comp.label}</p>
                          <p className="text-xs text-muted-foreground truncate">{LOMLOE_DESCRIPTIONS[comp.code]}</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        {comp.gap ? (
                          <span className="flex items-center gap-1 text-xs text-red-500">
                            <AlertTriangle className="w-3 h-3" /> {t("dir_gap")}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-green-500">
                            <CheckCircle2 className="w-3 h-3" /> {comp.percentage}%
                          </span>
                        )}
                        <p className="text-xs text-muted-foreground">{comp.count} {t("dir_plans")}</p>
                      </div>
                    </div>
                    <div className="h-3 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${
                          comp.gap ? "bg-red-400" : (LOMLOE_COLORS[comp.code] ?? "bg-primary")
                        }`}
                        style={{ width: `${Math.max(comp.percentage, comp.gap ? 1 : 0)}%` }}
                      />
                    </div>
                    {comp.recentPlans.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-0.5">
                        {comp.recentPlans.map(p => (
                          <span key={p.id} className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                            {p.title}{p.yearGroup ? ` · ${p.yearGroup}` : ""}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
          </CardContent>
        </Card>

        {/* Subject coverage breakdown */}
        {!isLoading && (data?.subjectCoverage.length ?? 0) > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t("dir_subject_breakdown")}</CardTitle>
              <p className="text-xs text-muted-foreground">{t("dir_subject_breakdown_desc")}</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {data?.subjectCoverage.map(s => (
                  <div key={s.subject} className="flex items-center justify-between gap-4">
                    <span className="text-sm text-foreground font-medium truncate">{s.subject}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex gap-1">
                        {s.competencyList.map(code => (
                          <span
                            key={code}
                            className={`w-4 h-4 rounded-sm text-white text-[9px] flex items-center justify-center font-bold ${LOMLOE_COLORS[code] ?? "bg-muted"}`}
                            title={code}
                          >
                            {code.slice(0, 1)}
                          </span>
                        ))}
                      </div>
                      <span className="text-xs text-muted-foreground">{s.competenciesCovered}/8</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <p className="text-xs text-muted-foreground text-right">Powered by SEBA</p>
      </div>
    </DashboardLayout>
  );
}
