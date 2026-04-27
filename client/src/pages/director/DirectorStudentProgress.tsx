import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { useI18n } from "@/contexts/I18nContext";
import { trpc } from "@/lib/trpc";
import { GraduationCap, Loader2, Users, TrendingUp, AlertCircle, Printer } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

/** The 8 LOMLOE key competencies in display order */
const LOMLOE_CODES = ["CCL", "CP", "STEM", "CD", "CPSAA", "CC", "CE", "CCEC"];

/** Short labels for heatmap column headers */
const COMP_SHORT: Record<string, string> = {
  CCL: "CCL",
  CP: "CP",
  STEM: "STEM",
  CD: "CD",
  CPSAA: "CPSAA",
  CC: "CC",
  CE: "CE",
  CCEC: "CCEC",
};

/** Full LOMLOE competency names */
const COMP_FULL: Record<string, string> = {
  CCL: "Comunicación lingüística",
  CP: "Plurilingüe",
  STEM: "Matemática, ciencia y tecnología",
  CD: "Digital",
  CPSAA: "Personal, social y aprender a aprender",
  CC: "Ciudadana",
  CE: "Emprendedora",
  CCEC: "Conciencia y expresiones culturales",
};

/** Returns a Tailwind background class based on score 0-100 (or null = no data) */
function heatColor(score: number | null): string {
  if (score === null) return "bg-muted/30 text-muted-foreground";
  if (score >= 80) return "bg-emerald-500 text-white";
  if (score >= 65) return "bg-teal-400 text-white";
  if (score >= 50) return "bg-yellow-400 text-gray-900";
  if (score >= 35) return "bg-orange-400 text-white";
  return "bg-red-500 text-white";
}

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-[10px] text-muted-foreground">—</span>;
  return <span className="text-[10px] font-bold">{score}</span>;
}

export default function DirectorStudentProgress() {
  const { t } = useI18n();
  const { user, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  useEffect(() => { if (!authLoading && user && user.role !== "admin" && user.role !== "director") navigate("/"); }, [authLoading, user, navigate]);
  if (authLoading || (!user && !authLoading)) return null;
  if (user?.role !== "admin" && user?.role !== "director") return null;

  const { data, isLoading } = trpc.director.getSchoolWideStudentProgress.useQuery();
  const { data: infantilData, isLoading: infantilLoading } = trpc.director.getInfantilProgress.useQuery();

  const EIXOS = [
    { code: "EIX1", label: "Eix 1 — Identitat i Autonomia", color: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200" },
    { code: "EIX2", label: "Eix 2 — Descoberta de l'Entorn", color: "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200" },
    { code: "EIX3", label: "Eix 3 — Comunicació i Llenguatges", color: "bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200" },
    { code: "EIX4", label: "Eix 4 — Convivència", color: "bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200" },
  ];

  const hasData = data && data.groups.length > 0;
  const hasActivity = hasData && data.groups.some(g => g.totalActivities > 0);

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10">
            <GraduationCap className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t("dir_student_progress")}</h1>
            <p className="text-sm text-muted-foreground">{t("dir_student_progress_desc")}</p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : !hasData ? (
          <div className="rounded-xl border border-dashed bg-muted/30 p-10 text-center text-muted-foreground">
            <GraduationCap className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">{t("dir_progress_no_groups")}</p>
            <p className="text-sm mt-1">{t("dir_progress_no_groups_desc")}</p>
          </div>
        ) : (
          <>
            {/* School-wide summary row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="pt-4 pb-3">
                  <p className="text-2xl font-bold text-primary">{data.groups.length}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{t("dir_progress_total_classes")}</p>
                </CardContent>
              </Card>
              <Card className="bg-teal-500/5 border-teal-500/20">
                <CardContent className="pt-4 pb-3">
                  <p className="text-2xl font-bold text-teal-600">{data.groups.reduce((s, g) => s + g.studentCount, 0)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{t("dir_progress_total_students")}</p>
                </CardContent>
              </Card>
              <Card className="bg-amber-500/5 border-amber-500/20">
                <CardContent className="pt-4 pb-3">
                  <p className="text-2xl font-bold text-amber-600">{data.groups.reduce((s, g) => s + g.totalActivities, 0)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{t("dir_progress_total_activities")}</p>
                </CardContent>
              </Card>
              <Card className="bg-purple-500/5 border-purple-500/20">
                <CardContent className="pt-4 pb-3">
                  {(() => {
                    const scored = data.schoolAverages.filter(c => c.average !== null);
                    const avg = scored.length > 0 ? Math.round(scored.reduce((s, c) => s + (c.average ?? 0), 0) / scored.length) : null;
                    return (
                      <>
                        <p className="text-2xl font-bold text-purple-600">{avg !== null ? `${avg}%` : "—"}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{t("dir_progress_school_avg")}</p>
                      </>
                    );
                  })()}
                </CardContent>
              </Card>
            </div>

            {/* School-wide competency averages bar chart */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  <CardTitle className="text-base">{t("dir_progress_school_competency_avgs")}</CardTitle>
                </div>
                <CardDescription className="text-xs">{t("dir_progress_school_competency_avgs_desc")}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2.5">
                  {LOMLOE_CODES.map(code => {
                    const entry = data.schoolAverages.find(c => c.code === code);
                    const avg = entry?.average ?? null;
                    return (
                      <div key={code} className="flex items-center gap-3">
                        <span className="text-xs font-mono font-bold text-muted-foreground w-14 shrink-0">{code}</span>
                        <div className="flex-1 h-5 bg-muted/40 rounded-full overflow-hidden">
                          {avg !== null && (
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-teal-500 to-primary transition-all"
                              style={{ width: `${avg}%` }}
                            />
                          )}
                        </div>
                        <span className="text-xs font-bold w-8 text-right text-foreground">
                          {avg !== null ? `${avg}%` : "—"}
                        </span>
                      </div>
                    );
                  })}
                </div>
                {/* Legend */}
                <div className="flex flex-wrap gap-3 mt-4 pt-3 border-t text-[10px] text-muted-foreground">
                  {LOMLOE_CODES.map(code => (
                    <span key={code}><strong>{code}</strong> — {COMP_FULL[code]}</span>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Per-class heatmap */}
            {!hasActivity ? (
              <div className="rounded-xl border border-dashed bg-muted/30 p-8 text-center text-muted-foreground flex flex-col items-center gap-2">
                <AlertCircle className="w-8 h-8 opacity-30" />
                <p className="font-medium text-sm">{t("dir_progress_no_activity")}</p>
                <p className="text-xs">{t("dir_progress_no_activity_desc")}</p>
              </div>
            ) : (
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-primary" />
                    <CardTitle className="text-base">{t("dir_progress_heatmap_title")}</CardTitle>
                  </div>
                  <CardDescription className="text-xs">{t("dir_progress_heatmap_desc")}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border-collapse min-w-[640px]">
                      <thead>
                        <tr>
                          <th className="text-left py-2 pr-3 font-medium text-muted-foreground w-40">{t("dir_progress_class")}</th>
                          <th className="text-center py-2 px-1 font-medium text-muted-foreground w-10">{t("dir_progress_students")}</th>
                          {LOMLOE_CODES.map(code => (
                            <th key={code} className="text-center py-2 px-1 font-mono font-bold text-muted-foreground w-12">{COMP_SHORT[code]}</th>
                          ))}
                          <th className="text-center py-2 px-1 font-medium text-muted-foreground w-12">{t("dir_progress_overall")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.groups.map(group => (
                          <tr key={group.groupId} className="border-t border-border/50 hover:bg-muted/20 transition-colors">
                            <td className="py-2 pr-3">
                              <p className="font-medium text-foreground leading-tight">{group.className}</p>
                              <p className="text-[10px] text-muted-foreground">{group.level}</p>
                            </td>
                            <td className="text-center py-2 px-1">
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{group.studentCount}</Badge>
                            </td>
                            {LOMLOE_CODES.map(code => {
                              const entry = group.competencyAverages.find(c => c.code === code);
                              const score = entry?.average ?? null;
                              return (
                                <td key={code} className="text-center py-1 px-0.5">
                                  <div className={`rounded-md w-10 h-8 mx-auto flex items-center justify-center ${heatColor(score)}`}>
                                    <ScoreBadge score={score} />
                                  </div>
                                </td>
                              );
                            })}
                            <td className="text-center py-1 px-0.5">
                              <div className={`rounded-md w-10 h-8 mx-auto flex items-center justify-center font-bold ${heatColor(group.overall)}`}>
                                <ScoreBadge score={group.overall} />
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Colour legend */}
                  <div className="flex flex-wrap items-center gap-3 mt-4 pt-3 border-t text-[10px] text-muted-foreground">
                    <span className="font-medium">{t("dir_progress_legend")}:</span>
                    <span className="flex items-center gap-1"><span className="w-4 h-4 rounded bg-emerald-500 inline-block" /> ≥80</span>
                    <span className="flex items-center gap-1"><span className="w-4 h-4 rounded bg-teal-400 inline-block" /> 65–79</span>
                    <span className="flex items-center gap-1"><span className="w-4 h-4 rounded bg-yellow-400 inline-block" /> 50–64</span>
                    <span className="flex items-center gap-1"><span className="w-4 h-4 rounded bg-orange-400 inline-block" /> 35–49</span>
                    <span className="flex items-center gap-1"><span className="w-4 h-4 rounded bg-red-500 inline-block" /> &lt;35</span>
                    <span className="flex items-center gap-1"><span className="w-4 h-4 rounded bg-muted/40 border inline-block" /> {t("dir_progress_no_data")}</span>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* LOMLOE anonymisation note */}
            <div className="rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground flex gap-3">
              <GraduationCap className="w-4 h-4 mt-0.5 shrink-0 text-primary" />
              <p>{t("dir_progress_lomloe_note")}</p>
            </div>

            {/* ─── Educació Infantil Progress (Decree 21/2023) ─────────────────── */}
            <Card className="border-amber-200 bg-amber-50/30 dark:bg-amber-950/20 dark:border-amber-800">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <span className="text-lg">🧒</span>
                      {t("infantil_progress_title")}
                    </CardTitle>
                    <CardDescription className="text-xs mt-0.5">{t("infantil_progress_desc")}</CardDescription>
                  </div>
                  {infantilData && infantilData.totalInfantilPlans > 0 && (
                    <button
                      onClick={() => {
                        const win = window.open("", "_blank");
                        if (!win) return;
                        const rows = EIXOS.map(eix => {
                          const entry = infantilData.eixSummary.find(e => e.eix === eix.code);
                          return `<tr><td style="padding:6px 10px;border:1px solid #e5e7eb">${eix.code}</td><td style="padding:6px 10px;border:1px solid #e5e7eb">${eix.label}</td><td style="padding:6px 10px;border:1px solid #e5e7eb;text-align:center">${entry?.cycle03 ?? 0}</td><td style="padding:6px 10px;border:1px solid #e5e7eb;text-align:center">${entry?.cycle36 ?? 0}</td><td style="padding:6px 10px;border:1px solid #e5e7eb;text-align:center">${entry?.total ?? 0}</td></tr>`;
                        }).join("");
                        win.document.write(`<!DOCTYPE html><html><head><title>Educació Infantil Progress Report</title><style>body{font-family:sans-serif;padding:24px;color:#111}h1{font-size:18px;margin-bottom:4px}p{color:#666;font-size:13px;margin-bottom:16px}table{border-collapse:collapse;width:100%}th{background:#fef3c7;padding:8px 10px;border:1px solid #e5e7eb;text-align:left;font-size:13px}td{font-size:13px}.footer{margin-top:20px;font-size:11px;color:#9ca3af}</style></head><body><h1>🧒 Educació Infantil — Progress Report</h1><p>Decret 21/2023 · ${infantilData.totalInfantilPlans} lesson plans · ${infantilData.teacherCount} teachers · Generated ${new Date().toLocaleDateString()}</p><table><thead><tr><th>Eix</th><th>Description</th><th>Cycle 0–3</th><th>Cycle 3–6</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table><p class="footer">Powered by SEBA Platform</p></body></html>`);
                        win.document.close();
                        win.print();
                      }}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors dark:border-amber-700 dark:text-amber-300 dark:bg-amber-900/30 dark:hover:bg-amber-900/50"
                      title="Print / Export Infantil Progress Report"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      Print Report
                    </button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {infantilLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> {t("loading")}</div>
                ) : !infantilData || infantilData.totalInfantilPlans === 0 ? (
                  <div className="text-sm text-muted-foreground py-4 text-center">{t("infantil_progress_empty")}</div>
                ) : (
                  <>
                    {/* Summary stats */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                      <div className="rounded-lg border bg-background p-3 text-center">
                        <p className="text-2xl font-bold text-amber-600">{infantilData.totalInfantilPlans}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{t("infantil_progress_total_plans")}</p>
                      </div>
                      <div className="rounded-lg border bg-background p-3 text-center">
                        <p className="text-2xl font-bold text-amber-600">{infantilData.teacherCount}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{t("infantil_progress_teachers")}</p>
                      </div>
                      <div className="rounded-lg border bg-background p-3 text-center col-span-2 sm:col-span-1">
                        <p className="text-2xl font-bold text-amber-600">{infantilData.eixSummary.filter(e => e.total > 0).length}/4</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{t("infantil_progress_eixos_covered")}</p>
                      </div>
                    </div>
                    {/* Per-eix breakdown */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {EIXOS.map(eix => {
                        const entry = infantilData.eixSummary.find(e => e.eix === eix.code);
                        return (
                          <div key={eix.code} className="rounded-lg border bg-background p-3">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge className={`text-xs ${eix.color}`}>{eix.code}</Badge>
                              <span className="text-xs font-medium truncate">{eix.label}</span>
                            </div>
                            <div className="flex gap-4 text-xs text-muted-foreground">
                              <span>👶 {t("infantil_cycle_03")}: <strong className="text-foreground">{entry?.cycle03 ?? 0}</strong></span>
                              <span>👧 {t("infantil_cycle_36")}: <strong className="text-foreground">{entry?.cycle36 ?? 0}</strong></span>
                            </div>
                            <div className="mt-1.5 h-1.5 rounded-full bg-muted overflow-hidden">
                              <div
                                className="h-full rounded-full bg-amber-400 transition-all"
                                style={{ width: `${Math.min(100, ((entry?.total ?? 0) / Math.max(1, infantilData.totalInfantilPlans)) * 100)}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </>
        )}

        <p className="text-xs text-muted-foreground text-right">Powered by SEBA</p>
      </div>
    </DashboardLayout>
  );
}
