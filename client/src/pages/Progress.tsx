import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import NavBar from "@/components/NavBar";
import { Loader2, Lock, Trophy, TrendingUp, Target } from "lucide-react";
import { getLoginUrl } from "@/const";
import { useLocation } from "wouter";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";

const COMP_COLORS: Record<string, string> = {
  CCL: "#3b82f6", CP: "#8b5cf6", STEM: "#10b981", CD: "#f59e0b",
  CPSAA: "#ef4444", CC: "#06b6d4", CE: "#f97316", CCEC: "#ec4899", all: "#6b7280",
};

export default function Progress() {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();

  const { data, isLoading } = trpc.materials.getMyProgress.useQuery(undefined, { enabled: !!user });

  if (loading || isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <NavBar />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <NavBar />
        <div className="flex-1 flex items-center justify-center">
          <Card className="max-w-sm w-full mx-4">
            <CardContent className="p-8 flex flex-col items-center gap-4 text-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                <Lock className="w-8 h-8 text-muted-foreground" />
              </div>
              <h2 className="text-xl font-bold">Sign in to view progress</h2>
              <Button asChild className="w-full">
                <a href={getLoginUrl()}>Sign in</a>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const totalSessions = data?.sessions.length ?? 0;
  const totalCorrect = data?.sessions.reduce((a, s) => a + s.score, 0) ?? 0;
  const totalQ = data?.sessions.reduce((a, s) => a + s.total, 0) ?? 0;
  const overallPct = totalQ > 0 ? Math.round((totalCorrect / totalQ) * 100) : 0;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <NavBar />
      <div className="container py-8 max-w-3xl mx-auto flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">My Progress</h1>
          <p className="text-sm text-muted-foreground mt-1">Track your practice performance across LOMLOE competencies.</p>
        </div>

        {totalSessions === 0 ? (
          <Card>
            <CardContent className="p-12 flex flex-col items-center gap-4 text-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                <TrendingUp className="w-8 h-8 text-muted-foreground" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">No sessions yet</h3>
                <p className="text-sm text-muted-foreground mt-1">Complete a practice session to start tracking your progress.</p>
              </div>
              <Button onClick={() => navigate("/practice")} className="gap-2">
                <Target className="w-4 h-4" /> Start Practising
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Summary stats */}
            <div className="grid grid-cols-3 gap-2 sm:gap-4">
              {[
                { label: "Sessions", value: totalSessions, icon: Target },
                { label: "Questions", value: totalQ, icon: TrendingUp },
                { label: "Overall Score", value: `${overallPct}%`, icon: Trophy },
              ].map(({ label, value, icon: Icon }) => (
                <Card key={label}>
                  <CardContent className="p-3 sm:p-4 flex flex-col gap-1">
                    <div className="flex items-center gap-1 sm:gap-2 text-muted-foreground">
                      <Icon className="w-4 h-4" />
                      <span className="text-xs font-medium uppercase tracking-wide hidden sm:inline">{label}</span>
                      <span className="text-xs font-medium sm:hidden">{label.split(' ')[0]}</span>
                    </div>
                    <p className="text-xl sm:text-2xl font-bold text-foreground">{value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Chart */}
            {data && data.chart.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Average Score by Competency</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={data.chart} margin={{ top: 4, right: 8, left: -20, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="code" tick={{ fontSize: 11 }} />
                      <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} />
                      <Tooltip
                        formatter={(v: number) => [`${v}%`, "Avg Score"]}
                        labelFormatter={(label) => data.chart.find(c => c.code === label)?.name ?? label}
                        contentStyle={{ fontSize: 12 }}
                      />
                      <Bar dataKey="avgPct" radius={[4, 4, 0, 0]}>
                        {data.chart.map((entry) => (
                          <Cell key={entry.code} fill={COMP_COLORS[entry.code] ?? "#6b7280"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* Recent sessions */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Recent Sessions</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 flex flex-col gap-2">
                {data?.sessions.map((s) => (
                  <div key={s.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-2 border-b border-border last:border-0 gap-1">
                    <div className="flex items-center gap-2">
                      {s.competency
                        ? <Badge variant="outline" className="text-xs">{s.competency}</Badge>
                        : <Badge variant="secondary" className="text-xs">All</Badge>}
                      {s.yearGroup && <Badge variant="outline" className="text-xs capitalize">{s.yearGroup}</Badge>}
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3">
                      <span className="text-sm font-semibold text-foreground">
                        {s.score}/{s.total} ({Math.round((s.score / s.total) * 100)}%)
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(s.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </>
        )}

        <p className="text-xs text-muted-foreground text-center pb-4">Powered by SEBA</p>
      </div>
    </div>
  );
}
