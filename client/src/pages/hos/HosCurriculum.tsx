import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/contexts/I18nContext";
import NavBar from "@/components/NavBar";
import BackButton from "@/components/BackButton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookCheck } from "lucide-react";
import { cn } from "@/lib/utils";

const LOMLOE_CODES = ["CCL", "CP", "STEM", "CD", "CPSAA", "CC", "CE", "CCEC"];
const YEAR_GROUPS = ["junior", "primary", "secondary"] as const;

const COMPETENCY_COLORS: Record<string, string> = {
  CCL: "bg-blue-500",
  CP: "bg-purple-500",
  STEM: "bg-green-500",
  CD: "bg-cyan-500",
  CPSAA: "bg-orange-500",
  CC: "bg-red-500",
  CE: "bg-yellow-500",
  CCEC: "bg-pink-500",
};

const COMPETENCY_LABELS: Record<string, string> = {
  CCL: "Comunicació Lingüística",
  CP: "Plurilingüe",
  STEM: "STEM",
  CD: "Digital",
  CPSAA: "Personal i Social",
  CC: "Ciutadana",
  CE: "Emprenedora",
  CCEC: "Expressió Cultural",
};

function CoverageBar({ pct, colorClass }: { pct: number; colorClass: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-3 bg-white/10 rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-500", colorClass)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-semibold w-10 text-right text-white/80">{pct}%</span>
    </div>
  );
}

export default function HosCurriculum() {
  const { t } = useI18n();
  const [activeYearGroup, setActiveYearGroup] = useState<"junior" | "primary" | "secondary">("secondary");

  const { data: rows = [], isLoading } = trpc.hos.getCurriculumCompliance.useQuery();

  const filtered = rows.filter((r) => r.yearGroup === activeYearGroup);

  const yearGroupLabel: Record<string, string> = {
    junior: "Junior (Yr 3–4)",
    primary: "Primary (Yr 5–6)",
    secondary: "Secondary (Yr 7–10)",
  };

  const overallCoverage =
    filtered.length > 0
      ? Math.round(filtered.reduce((sum, r) => sum + r.pct, 0) / filtered.length)
      : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-teal-950 to-slate-900">
      <NavBar />
      <div className="container py-8 max-w-5xl">
        {/* Header */}
        <BackButton label={t("btn_back")} variant="dark" className="mb-4" />
        <div className="flex items-center gap-3 mb-8">
          <div className="p-3 rounded-xl bg-teal-500/20 border border-teal-400/30">
            <BookCheck className="w-7 h-7 text-teal-300" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">{t("hos_curriculum")}</h1>
            <p className="text-white/60 text-sm mt-0.5">{t("curriculum_subtitle")}</p>
          </div>
        </div>

        {/* Year group tabs */}
        <div className="flex gap-2 mb-6">
          {YEAR_GROUPS.map((yg) => (
            <button
              key={yg}
              onClick={() => setActiveYearGroup(yg)}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-all",
                activeYearGroup === yg
                  ? "bg-teal-500 text-white shadow-lg shadow-teal-500/25"
                  : "bg-white/10 text-white/70 hover:bg-white/20"
              )}
            >
              {yearGroupLabel[yg]}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="text-white/60 text-center py-16">{t("loading")}</div>
        ) : (
          <>
            {/* Summary card */}
            <Card className="bg-white/5 border-white/10 mb-6">
              <CardContent className="pt-6 pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white/60 text-sm">{t("curriculum_overall_coverage")}</p>
                    <p className="text-4xl font-bold text-white mt-1">{overallCoverage}%</p>
                    <p className="text-white/50 text-xs mt-1">
                      {t("curriculum_across_competencies")}
                    </p>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {filtered.map((r) => (
                      <div key={r.competency} className="flex flex-col items-center gap-1">
                        <div
                          className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold",
                            COMPETENCY_COLORS[r.competency] ?? "bg-slate-500"
                          )}
                        >
                          {r.pct}
                        </div>
                        <span className="text-white/50 text-xs">{r.competency}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Competency coverage table */}
            <Card className="bg-white/5 border-white/10">
              <CardHeader className="pb-3">
                <CardTitle className="text-white text-lg">{t("curriculum_by_competency")}</CardTitle>
              </CardHeader>
              <CardContent>
                {filtered.length === 0 ? (
                  <p className="text-white/50 text-sm text-center py-8">{t("curriculum_no_data")}</p>
                ) : (
                  <div className="space-y-4">
                    {filtered.map((row) => (
                      <div key={row.competency} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge
                              className={cn(
                                "text-white text-xs font-bold px-2 py-0.5",
                                COMPETENCY_COLORS[row.competency] ?? "bg-slate-500"
                              )}
                            >
                              {row.competency}
                            </Badge>
                            <span className="text-white/80 text-sm">
                              {COMPETENCY_LABELS[row.competency] ?? row.competency}
                            </span>
                          </div>
                          <span className="text-white/50 text-xs">
                            {row.count} / {row.total} {t("curriculum_plans")}
                          </span>
                        </div>
                        <CoverageBar
                          pct={row.pct}
                          colorClass={COMPETENCY_COLORS[row.competency] ?? "bg-slate-500"}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Legend */}
            <div className="mt-6 p-4 rounded-xl bg-white/5 border border-white/10">
              <p className="text-white/50 text-xs">{t("curriculum_legend")}</p>
              <div className="flex flex-wrap gap-3 mt-2">
                {LOMLOE_CODES.map((code) => (
                  <div key={code} className="flex items-center gap-1.5">
                    <div className={cn("w-3 h-3 rounded-full", COMPETENCY_COLORS[code])} />
                    <span className="text-white/70 text-xs">
                      <strong>{code}</strong> — {COMPETENCY_LABELS[code]}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
