import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, AlertTriangle, TrendingUp, RefreshCw, Download } from "lucide-react";
import { format } from "date-fns";
import AuditStatusCards from "@/components/AuditStatusCards";
import AuditTrendChart from "@/components/AuditTrendChart";
import AuditHistoryTable from "@/components/AuditHistoryTable";

export default function SecurityAuditDashboard() {
  const [selectedWeeks, setSelectedWeeks] = useState(12);
  const [isManualAuditRunning, setIsManualAuditRunning] = useState(false);

  // Fetch latest audit
  const { data: latestAudit, isLoading: isLoadingLatest, refetch: refetchLatest } = trpc.auditSystem.getLatestAudit.useQuery();

  // Fetch audit history
  const { data: auditHistory = [], isLoading: isLoadingHistory } = trpc.auditSystem.getAuditHistory.useQuery({
    weeks: selectedWeeks,
  });

  // Fetch trend report
  const { data: trendReport = "", isLoading: isLoadingTrend } = trpc.auditSystem.getAuditTrendReport.useQuery({
    weeks: selectedWeeks,
  });

  // Manual audit trigger
  const runAuditMutation = trpc.auditSystem.runAuditNow.useMutation({
    onSuccess: () => {
      setIsManualAuditRunning(false);
      refetchLatest();
    },
    onError: () => {
      setIsManualAuditRunning(false);
    },
  });

  const handleManualAudit = async () => {
    setIsManualAuditRunning(true);
    await runAuditMutation.mutateAsync();
  };

  const isLoading = isLoadingLatest || isLoadingHistory || isLoadingTrend;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-slate-900">Security Audit Dashboard</h1>
            <p className="text-slate-600 mt-2">Weekly software sovereignty verification and self-healing system</p>
          </div>
          <div className="flex gap-3">
            <Button
              onClick={handleManualAudit}
              disabled={isManualAuditRunning}
              variant="outline"
              className="gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${isManualAuditRunning ? "animate-spin" : ""}`} />
              {isManualAuditRunning ? "Running Audit..." : "Run Audit Now"}
            </Button>
            <Button variant="outline" className="gap-2">
              <Download className="w-4 h-4" />
              Export Report
            </Button>
          </div>
        </div>

        {/* Latest Audit Status */}
        {latestAudit && (
          <Card className="border-2 bg-white">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Latest Audit Results</CardTitle>
                  <CardDescription>
                    {format(new Date(latestAudit.timestamp), "MMMM d, yyyy 'at' h:mm a")}
                  </CardDescription>
                </div>
                <StatusBadge status={latestAudit.overallStatus} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-4">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-slate-600">Code Issues</p>
                  <p className="text-3xl font-bold">{latestAudit.codeReview.issues.length}</p>
                  <p className="text-xs text-slate-500">Coverage: {latestAudit.codeReview.coverage}%</p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-slate-600">Vulnerabilities</p>
                  <p className="text-3xl font-bold">{latestAudit.securityScan.vulnerabilities.length}</p>
                  <p className="text-xs text-slate-500">
                    {latestAudit.securityScan.dependenciesScanned} dependencies scanned
                  </p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-slate-600">Weaknesses</p>
                  <p className="text-3xl font-bold">{latestAudit.penetrationTest.weaknesses.length}</p>
                  <p className="text-xs text-slate-500">{latestAudit.penetrationTest.testsConducted} tests</p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-slate-600">Self-Healing</p>
                  <p className="text-3xl font-bold">
                    {latestAudit.selfHealingActions.filter((a) => a.status === "COMPLETED").length}/
                    {latestAudit.selfHealingActions.length}
                  </p>
                  <p className="text-xs text-slate-500">Actions completed</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Status Cards */}
        <AuditStatusCards latestAudit={latestAudit} />

        {/* Trend Chart */}
        <Card className="border-2 bg-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Audit Trends ({selectedWeeks} weeks)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex gap-2">
                {[4, 12, 26, 52].map((weeks) => (
                  <Button
                    key={weeks}
                    variant={selectedWeeks === weeks ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedWeeks(weeks)}
                  >
                    {weeks}w
                  </Button>
                ))}
              </div>
              <AuditTrendChart auditHistory={auditHistory} />
            </div>
          </CardContent>
        </Card>

        {/* Trend Report */}
        {trendReport && (
          <Card className="border-2 bg-white">
            <CardHeader>
              <CardTitle>Trend Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="bg-slate-50 p-4 rounded-lg text-sm overflow-auto max-h-96 font-mono text-slate-700">
                {trendReport}
              </pre>
            </CardContent>
          </Card>
        )}

        {/* History Table */}
        <AuditHistoryTable auditHistory={auditHistory} />

        {/* Footer */}
        <div className="text-center text-sm text-slate-600 pt-8 border-t">
          <p>Powered by SEBA • Weekly audits run every Monday at 2:00 AM UTC</p>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: "PASS" | "FAIL" | "REMEDIATED" }) {
  const variants = {
    PASS: {
      bg: "bg-green-100",
      text: "text-green-800",
      icon: <CheckCircle2 className="w-5 h-5" />,
    },
    REMEDIATED: {
      bg: "bg-blue-100",
      text: "text-blue-800",
      icon: <AlertTriangle className="w-5 h-5" />,
    },
    FAIL: {
      bg: "bg-red-100",
      text: "text-red-800",
      icon: <AlertCircle className="w-5 h-5" />,
    },
  };

  const variant = variants[status];

  return (
    <Badge className={`${variant.bg} ${variant.text} gap-2 px-4 py-2 text-base font-semibold`}>
      {variant.icon}
      {status}
    </Badge>
  );
}
