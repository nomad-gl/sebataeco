import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import NavBar from "@/components/NavBar";
import {
  Loader2, Lock, Users, TrendingUp, Trophy, Target,
  ChevronRight, Plus, BookOpen, Star, Download,
} from "lucide-react";
import { getLoginUrl } from "@/const";
import { useLocation, Link } from "wouter";
import { useI18n } from "@/contexts/I18nContext";

const GRADE_COLORS: Record<string, string> = {
  Sobresaliente: "bg-emerald-500 text-white",
  Notable: "bg-blue-500 text-white",
  Bien: "bg-yellow-500 text-black",
  Suficiente: "bg-orange-500 text-white",
  Insuficiente: "bg-red-500 text-white",
};

const COMP_CHIP: Record<string, string> = {
  CCL: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  CP: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  STEM: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  CD: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
  CPSAA: "bg-orange-500/20 text-orange-300 border-orange-500/30",
  CC: "bg-red-500/20 text-red-300 border-red-500/30",
  CE: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  CCEC: "bg-pink-500/20 text-pink-300 border-pink-500/30",
};

function ScoreRing({ value }: { value: number | null }) {
  if (value === null) {
    return (
      <div className="w-16 h-16 rounded-full border-4 border-white/10 flex items-center justify-center">
        <span className="text-white/30 text-xs">—</span>
      </div>
    );
  }
  const color =
    value >= 90 ? "#10b981" :
    value >= 70 ? "#3b82f6" :
    value >= 60 ? "#f59e0b" :
    value >= 50 ? "#f97316" : "#ef4444";
  const dash = 2 * Math.PI * 22;
  const filled = (value / 100) * dash;
  return (
    <div className="relative w-16 h-16 flex items-center justify-center">
      <svg className="absolute inset-0 -rotate-90" width="64" height="64">
        <circle cx="32" cy="32" r="22" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="5" />
        <circle
          cx="32" cy="32" r="22" fill="none"
          stroke={color} strokeWidth="5"
          strokeDasharray={`${filled} ${dash - filled}`}
          strokeLinecap="round"
        />
      </svg>
      <span className="text-white font-bold text-sm z-10">{value}</span>
    </div>
  );
}

export default function Progress() {
  const { t } = useI18n();
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();

  const { data: groups, isLoading } = trpc.progress.getAllGroupsSummary.useQuery(
    undefined,
    { enabled: !!user }
  );

  const exportCSV = trpc.progress.exportGroupGradesCSV.useMutation({
    onSuccess: ({ csv, filename }) => {
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    },
  });

  if (loading || isLoading) {
    return (
      <div className="progress-bg flex flex-col min-h-screen">
        <NavBar />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="progress-bg flex flex-col min-h-screen">
        <NavBar />
        <div className="flex-1 flex items-center justify-center">
          <Card className="max-w-sm w-full mx-4 bg-white/10 backdrop-blur-md border-white/20">
            <CardContent className="p-8 flex flex-col items-center gap-4 text-center">
              <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center">
                <Lock className="w-8 h-8 text-white/70" />
              </div>
              <h2 className="text-xl font-bold text-white">{t("sign_in_required")}</h2>
              <p className="text-sm text-white/60">Sign in to view your groups' progress and LOMLOE grades.</p>
              <Button asChild className="w-full">
                <a href={getLoginUrl()}>{t("nav_sign_in")}</a>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const totalGroups = groups?.length ?? 0;
  const totalStudents = groups?.reduce((s, g) => s + g.studentCount, 0) ?? 0;
  const totalActivities = groups?.reduce((s, g) => s + g.totalActivities, 0) ?? 0;
  const gradedGroups = groups?.filter((g) => g.overall !== null) ?? [];
  const overallAvg =
    gradedGroups.length > 0
      ? Math.round(gradedGroups.reduce((s, g) => s + (g.overall ?? 0), 0) / gradedGroups.length)
      : null;

  return (
    <div className="progress-bg flex flex-col min-h-screen">
      <NavBar />
      <div className="container py-8 max-w-5xl mx-auto flex flex-col gap-8">

        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white">Group Progress</h1>
            <p className="text-white/60 text-sm mt-1">
              LOMLOE-aligned grades across all your class groups
            </p>
          </div>
          <Button
            onClick={() => navigate("/groups")}
            className="bg-teal-600 hover:bg-teal-500 text-white gap-2 self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" /> Manage Groups
          </Button>
        </div>

        {/* Summary stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Groups", value: totalGroups, icon: BookOpen, color: "text-blue-400" },
            { label: "Students", value: totalStudents, icon: Users, color: "text-purple-400" },
            { label: "Activities", value: totalActivities, icon: Target, color: "text-emerald-400" },
            { label: "Overall Avg", value: overallAvg !== null ? `${overallAvg}/100` : "—", icon: Trophy, color: "text-yellow-400" },
          ].map((stat) => (
            <Card key={stat.label} className="bg-white/10 backdrop-blur-md border-white/20">
              <CardContent className="p-4 flex flex-col gap-1">
                <div className="flex items-center gap-1.5 text-white/60">
                  <stat.icon className={`w-4 h-4 ${stat.color}`} />
                  <span className="text-xs font-medium uppercase tracking-wide">{stat.label}</span>
                </div>
                <p className="text-2xl font-bold text-white">{stat.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Groups list */}
        {totalGroups === 0 ? (
          <Card className="bg-white/10 backdrop-blur-md border-white/20">
            <CardContent className="p-12 flex flex-col items-center gap-4 text-center">
              <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center">
                <Users className="w-8 h-8 text-white/70" />
              </div>
              <div>
                <h3 className="font-semibold text-white text-lg">No groups yet</h3>
                <p className="text-white/60 text-sm mt-1">
                  Create a class group to start tracking student progress and LOMLOE grades.
                </p>
              </div>
              <Button onClick={() => navigate("/groups")} className="gap-2 bg-teal-600 hover:bg-teal-500">
                <Plus className="w-4 h-4" /> Create First Group
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-4">
            <h2 className="text-white font-semibold text-lg">Your Class Groups</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {groups?.map((item) => (
                <Link key={item.group.id} href={`/groups/${item.group.id}/progress`}>
                  <Card className="bg-white/10 backdrop-blur-md border-white/20 hover:bg-white/15 hover:border-teal-400/40 transition-all cursor-pointer group">
                    <CardContent className="p-5">
                      <div className="flex items-start gap-4">
                        {/* Score ring */}
                        <ScoreRing value={item.overall} />

                        {/* Group info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <h3 className="font-bold text-white text-base truncate group-hover:text-teal-300 transition-colors">
                                {item.group.className}
                              </h3>
                              <p className="text-white/50 text-xs mt-0.5 truncate">
                                {item.group.level} · {item.group.assessmentTitle}
                              </p>
                            </div>
                            {item.grade && (
                              <Badge className={`text-xs shrink-0 ${GRADE_COLORS[item.grade] ?? "bg-slate-500 text-white"}`}>
                                {item.grade}
                              </Badge>
                            )}
                          </div>

                          {/* Stats row */}
                          <div className="flex items-center gap-4 mt-3 text-xs text-white/60">
                            <span className="flex items-center gap-1">
                              <Users className="w-3 h-3" /> {item.studentCount} students
                            </span>
                            <span className="flex items-center gap-1">
                              <TrendingUp className="w-3 h-3" /> {item.totalActivities} activities
                            </span>
                          </div>

                          {/* Top competency chips */}
                          {item.topCompetencies.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              <span className="text-white/40 text-xs flex items-center gap-0.5">
                                <Star className="w-3 h-3" /> Top:
                              </span>
                              {item.topCompetencies.map((code) => (
                                <span
                                  key={code}
                                  className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs border ${COMP_CHIP[code] ?? "bg-white/10 text-white/60 border-white/20"}`}
                                >
                                  {code}
                                </span>
                              ))}
                            </div>
                          )}

                          {item.totalActivities === 0 && (
                            <p className="text-white/40 text-xs mt-2 italic">No activities recorded yet</p>
                          )}
                        </div>

                        <div className="flex flex-col items-center gap-2 shrink-0">
                          <ChevronRight className="w-4 h-4 text-white/30 group-hover:text-teal-400 transition-colors" />
                          <button
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); exportCSV.mutate({ groupId: item.group.id }); }}
                            title="Download grades CSV"
                            className="p-1 rounded text-white/30 hover:text-teal-400 hover:bg-white/10 transition-colors"
                          >
                            {exportCSV.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* LOMLOE grade legend */}
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-4">
            <p className="text-white/50 text-xs font-medium uppercase tracking-wide mb-3">LOMLOE Grade Scale</p>
            <div className="flex flex-wrap gap-2">
              {[
                { grade: "Sobresaliente", range: "90–100" },
                { grade: "Notable", range: "70–89" },
                { grade: "Bien", range: "60–69" },
                { grade: "Suficiente", range: "50–59" },
                { grade: "Insuficiente", range: "0–49" },
              ].map(({ grade, range }) => (
                <div key={grade} className="flex items-center gap-1.5">
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${GRADE_COLORS[grade]}`}>
                    {grade}
                  </span>
                  <span className="text-white/40 text-xs">{range}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
