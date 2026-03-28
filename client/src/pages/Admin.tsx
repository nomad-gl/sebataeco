import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import NavBar from "@/components/NavBar";
import { cn } from "@/lib/utils";
import { BookOpen, Layers, Users, BarChart3, Lock } from "lucide-react";
import { getLoginUrl } from "@/const";

const YEAR_GROUPS = ["junior", "primary", "secondary"] as const;
const YEAR_GROUP_LABELS = {
  junior: "Junior (3–4)",
  primary: "Primary (5–6)",
  secondary: "Secondary (7–10)",
};

export default function Admin() {
  const { user, loading } = useAuth();
  const { data: stats, isLoading: statsLoading } = trpc.lomloe.getStats.useQuery(undefined, {
    enabled: !!user && user.role === "admin",
  });
  const { data: competencies } = trpc.lomloe.getCompetencies.useQuery();

  // Loading auth state
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
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
      <div className="min-h-screen bg-background flex flex-col">
        <NavBar />
        <div className="flex-1 flex items-center justify-center">
          <Card className="max-w-sm w-full mx-4">
            <CardContent className="p-8 flex flex-col items-center gap-4 text-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                <Lock className="w-8 h-8 text-muted-foreground" />
              </div>
              <h2 className="text-xl font-bold text-foreground">Sign in required</h2>
              <p className="text-muted-foreground text-sm">
                You need to sign in to access the admin dashboard.
              </p>
              <Button asChild className="w-full">
                <a href={getLoginUrl()}>Sign in</a>
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
      <div className="min-h-screen bg-background flex flex-col">
        <NavBar />
        <div className="flex-1 flex items-center justify-center">
          <Card className="max-w-sm w-full mx-4">
            <CardContent className="p-8 flex flex-col items-center gap-4 text-center">
              <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
                <Lock className="w-8 h-8 text-destructive" />
              </div>
              <h2 className="text-xl font-bold text-foreground">Access Restricted</h2>
              <p className="text-muted-foreground text-sm">
                The admin dashboard is only accessible to administrators.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (statsLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
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
    <div className="min-h-screen bg-background flex flex-col">
      <NavBar />

      <div className="container py-8 flex flex-col gap-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Admin Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Knowledge bank statistics and LOMLOE coverage metrics
          </p>
        </div>

        {/* Summary cards */}
        {stats && (
          <div className="grid sm:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-5 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <BookOpen className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-3xl font-bold text-foreground">{stats.totalQuestions}</p>
                  <p className="text-sm text-muted-foreground">Total Questions</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Layers className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-3xl font-bold text-foreground">{stats.totalCompetencies}</p>
                  <p className="text-sm text-muted-foreground">Competencies</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Users className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-3xl font-bold text-foreground">{stats.totalYearGroups}</p>
                  <p className="text-sm text-muted-foreground">Year Groups</p>
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
                Questions per Competency &amp; Year Group
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-secondary/30">
                      <th className="text-left px-6 py-3 font-semibold text-foreground">
                        Competency
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
                        Total
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
                          <td className="px-6 py-4">
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
                              <td key={yg} className="px-4 py-4 text-center">
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
                          <td className="px-4 py-4 text-center">
                            <span className="font-bold text-foreground">{row.total}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-border bg-secondary/20">
                      <td className="px-6 py-3 font-bold text-foreground">Total</td>
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
              <CardTitle className="text-base">Coverage Overview</CardTitle>
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
