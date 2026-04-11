/**
 * AdminErrors.tsx
 *
 * Admin-only Error Dashboard — shows the live error feed, fix history,
 * escalation alerts, and a manual "Run Health Check" button.
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, RefreshCw, ShieldCheck, Wrench, XCircle } from "lucide-react";
import { useLocation } from "wouter";

export default function AdminErrors() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [tab, setTab] = useState<"errors" | "fixes" | "health">("errors");

  // Redirect non-admins
  if (user && user.role !== "admin") {
    navigate("/");
    return null;
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Error Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Automated self-healing monitor — runs every 5 minutes
            </p>
          </div>
          <HealthStatusBadge />
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList>
            <TabsTrigger value="errors">Error Log</TabsTrigger>
            <TabsTrigger value="fixes">Fix History</TabsTrigger>
            <TabsTrigger value="health">Health Check</TabsTrigger>
          </TabsList>

          <TabsContent value="errors" className="mt-4">
            <ErrorLogTable />
          </TabsContent>

          <TabsContent value="fixes" className="mt-4">
            <FixHistoryTable />
          </TabsContent>

          <TabsContent value="health" className="mt-4">
            <HealthCheckPanel />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// ─── Health status badge (header) ────────────────────────────────────────────

function HealthStatusBadge() {
  const { data } = trpc.selfHeal.healthCheck.useQuery(undefined, {
    refetchInterval: 60_000,
    retry: false,
  });

  if (!data) return null;

  if (data.healthy) {
    return (
      <Badge className="gap-1.5 bg-green-500/20 text-green-400 border-green-500/30">
        <CheckCircle2 className="w-3.5 h-3.5" />
        All systems healthy
      </Badge>
    );
  }

  const issues = data.missingTables.length + data.missingColumns.length;
  return (
    <Badge className="gap-1.5 bg-red-500/20 text-red-400 border-red-500/30">
      <XCircle className="w-3.5 h-3.5" />
      {issues} issue{issues !== 1 ? "s" : ""} detected
    </Badge>
  );
}

// ─── Error log table ──────────────────────────────────────────────────────────

function ErrorLogTable() {
  const [onlyEscalations, setOnlyEscalations] = useState(false);
  const { data, isLoading, refetch } = trpc.selfHeal.getErrorLogs.useQuery(
    { limit: 50, offset: 0, onlyEscalations },
    { refetchInterval: 30_000 }
  );

  return (
    <Card className="bg-card border-border">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base font-semibold">Recent Errors</CardTitle>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={() => setOnlyEscalations((v) => !v)}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            {onlyEscalations ? "Show all" : "Escalations only"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => void refetch()}>
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-6 text-center text-sm text-muted-foreground">Loading…</div>
        ) : !data?.length ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-green-500/60" />
            No errors logged
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="text-left px-4 py-2 font-medium">Time</th>
                  <th className="text-left px-4 py-2 font-medium">Source</th>
                  <th className="text-left px-4 py-2 font-medium">Code</th>
                  <th className="text-left px-4 py-2 font-medium">Message</th>
                  <th className="text-left px-4 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row) => (
                  <tr key={row.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-2 text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(row.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-2">
                      <Badge variant="outline" className="text-xs capitalize">
                        {row.source}
                      </Badge>
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-amber-400">
                      {row.errorCode ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-xs max-w-xs truncate text-muted-foreground">
                      {row.errorMessage ?? "—"}
                    </td>
                    <td className="px-4 py-2">
                      {row.resolvedAt ? (
                        <Badge className="text-xs bg-green-500/20 text-green-400 border-green-500/30 gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Auto-fixed
                        </Badge>
                      ) : row.requiresEscalation ? (
                        <Badge className="text-xs bg-red-500/20 text-red-400 border-red-500/30 gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          Escalation
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs text-muted-foreground">
                          Logged
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Fix history table ────────────────────────────────────────────────────────

function FixHistoryTable() {
  const { data, isLoading, refetch } = trpc.selfHeal.getFixHistory.useQuery(
    { limit: 50, offset: 0 },
    { refetchInterval: 30_000 }
  );

  return (
    <Card className="bg-card border-border">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base font-semibold">Automated Fix History</CardTitle>
        <Button variant="outline" size="sm" onClick={() => void refetch()}>
          <RefreshCw className="w-3.5 h-3.5" />
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-6 text-center text-sm text-muted-foreground">Loading…</div>
        ) : !data?.length ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            <Wrench className="w-8 h-8 mx-auto mb-2 text-muted-foreground/40" />
            No fixes applied yet
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="text-left px-4 py-2 font-medium">Time</th>
                  <th className="text-left px-4 py-2 font-medium">Type</th>
                  <th className="text-left px-4 py-2 font-medium">Description</th>
                  <th className="text-left px-4 py-2 font-medium">Result</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row) => (
                  <tr key={row.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-2 text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(row.appliedAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-blue-400">
                      {row.fixType}
                    </td>
                    <td className="px-4 py-2 text-xs text-muted-foreground max-w-sm">
                      {row.fixDescription}
                    </td>
                    <td className="px-4 py-2">
                      {row.success ? (
                        <Badge className="text-xs bg-green-500/20 text-green-400 border-green-500/30 gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Success
                        </Badge>
                      ) : (
                        <Badge className="text-xs bg-red-500/20 text-red-400 border-red-500/30 gap-1">
                          <XCircle className="w-3 h-3" />
                          Failed
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Health check panel ───────────────────────────────────────────────────────

function HealthCheckPanel() {
  const utils = trpc.useUtils();
  const triggerMutation = trpc.selfHeal.triggerSelfHeal.useMutation({
    onSuccess: (result) => {
      void utils.selfHeal.healthCheck.invalidate();
      void utils.selfHeal.getFixHistory.invalidate();
      void utils.selfHeal.getErrorLogs.invalidate();
      if (result.fixesApplied.length > 0) {
        toast.success(`${result.fixesApplied.length} fix(es) applied automatically.`);
      } else if (result.escalations.length > 0) {
        toast.error(`${result.escalations.length} issue(s) require manual intervention.`);
      } else {
        toast.success("All systems healthy — no fixes needed.");
      }
    },
    onError: () => toast.error("Health check failed."),
  });

  const { data, isLoading } = trpc.selfHeal.healthCheck.useQuery(undefined, {
    refetchInterval: 60_000,
  });

  return (
    <div className="space-y-4">
      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base font-semibold">System Health</CardTitle>
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => triggerMutation.mutate()}
            disabled={triggerMutation.isPending}
          >
            {triggerMutation.isPending ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <ShieldCheck className="w-3.5 h-3.5" />
            )}
            Run Self-Heal Now
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Checking…</div>
          ) : !data ? (
            <div className="text-sm text-muted-foreground">No data</div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                {data.dbConnected ? (
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-500" />
                )}
                <span>Database connection: {data.dbConnected ? "Connected" : "Failed"}</span>
              </div>

              {data.missingTables.length > 0 && (
                <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3">
                  <p className="text-xs font-medium text-red-400 mb-1">Missing tables ({data.missingTables.length})</p>
                  <ul className="space-y-0.5">
                    {data.missingTables.map((t) => (
                      <li key={t} className="text-xs font-mono text-red-300">{t}</li>
                    ))}
                  </ul>
                </div>
              )}

              {data.missingColumns.length > 0 && (
                <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3">
                  <p className="text-xs font-medium text-amber-400 mb-1">Missing columns ({data.missingColumns.length})</p>
                  <ul className="space-y-0.5">
                    {data.missingColumns.map((c) => (
                      <li key={`${c.table}.${c.column}`} className="text-xs font-mono text-amber-300">
                        {c.table}.{c.column}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {data.healthy && (
                <div className="flex items-center gap-2 text-sm text-green-400">
                  <CheckCircle2 className="w-4 h-4" />
                  All {Object.keys(data).length > 0 ? "expected" : ""} tables and columns present
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                Last checked: {new Date(data.checkedAt).toLocaleString()}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
