/**
 * AdminSecurityDashboard — real-time security monitoring for administrators.
 *
 * Sections:
 *   1. KPI cards — login success/fail, MFA events, rate-limit hits, active sessions
 *   2. 24-hour event timeline chart (Chart.js bar chart)
 *   3. Active sessions table (users with a recent lastSignedIn)
 *   4. Event log table with filters (type, severity, search, time range)
 *
 * Data refreshes every 30 seconds via tRPC polling.
 * Access: admin role only.
 */
import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  LogIn,
  LogOut,
  AlertTriangle,
  Users,
  Activity,
  RefreshCw,
  Search,
  ChevronLeft,
  ChevronRight,
  Smartphone,
  Lock,
  Unlock,
  Zap,
  Clock,
} from "lucide-react";
import { Chart, registerables } from "chart.js";
Chart.register(...registerables);

// ── Helpers ───────────────────────────────────────────────────────────────────

const EVENT_LABELS: Record<string, string> = {
  login_success: "Login Success",
  login_fail: "Login Failed",
  logout: "Logout",
  mfa_enabled: "MFA Enabled",
  mfa_disabled: "MFA Disabled",
  mfa_verify_fail: "MFA Verify Fail",
  rate_limit_hit: "Rate Limit Hit",
  session_invalidated: "Session Invalidated",
  password_changed: "Password Changed",
  account_deactivated: "Account Deactivated",
  account_reactivated: "Account Reactivated",
};

const SEVERITY_COLORS: Record<string, string> = {
  info: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  warning: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  critical: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

function SeverityBadge({ severity }: { severity: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${SEVERITY_COLORS[severity] ?? SEVERITY_COLORS.info}`}>
      {severity}
    </span>
  );
}

function EventTypeBadge({ type }: { type: string }) {
  const icons: Record<string, React.ReactNode> = {
    login_success: <LogIn className="h-3 w-3 mr-1" />,
    login_fail: <ShieldAlert className="h-3 w-3 mr-1" />,
    logout: <LogOut className="h-3 w-3 mr-1" />,
    mfa_enabled: <ShieldCheck className="h-3 w-3 mr-1" />,
    mfa_disabled: <Unlock className="h-3 w-3 mr-1" />,
    mfa_verify_fail: <Lock className="h-3 w-3 mr-1" />,
    rate_limit_hit: <Zap className="h-3 w-3 mr-1" />,
    session_invalidated: <Activity className="h-3 w-3 mr-1" />,
    password_changed: <Lock className="h-3 w-3 mr-1" />,
    account_deactivated: <AlertTriangle className="h-3 w-3 mr-1" />,
    account_reactivated: <ShieldCheck className="h-3 w-3 mr-1" />,
  };
  return (
    <span className="inline-flex items-center text-xs font-medium text-foreground/80">
      {icons[type] ?? <Activity className="h-3 w-3 mr-1" />}
      {EVENT_LABELS[type] ?? type}
    </span>
  );
}

function KpiCard({
  title,
  value,
  icon,
  description,
  variant = "default",
}: {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  description?: string;
  variant?: "default" | "warning" | "danger" | "success";
}) {
  const variantClasses = {
    default: "border-border",
    warning: "border-amber-400/40 bg-amber-50/30 dark:bg-amber-900/10",
    danger: "border-red-400/40 bg-red-50/30 dark:bg-red-900/10",
    success: "border-green-400/40 bg-green-50/30 dark:bg-green-900/10",
  };
  const iconClasses = {
    default: "text-muted-foreground",
    warning: "text-amber-500",
    danger: "text-red-500",
    success: "text-green-500",
  };
  return (
    <Card className={`${variantClasses[variant]}`}>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground font-medium">{title}</p>
            <p className="text-3xl font-bold mt-1 text-foreground">{value}</p>
            {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
          </div>
          <div className={`p-2 rounded-lg bg-muted/50 ${iconClasses[variant]}`}>{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Timeline Chart ─────────────────────────────────────────────────────────────

function TimelineChart({ data }: { data: Array<{ hour: string; total: number; info: number; warning: number; critical: number }> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (!canvasRef.current || !data.length) return;
    if (chartRef.current) chartRef.current.destroy();

    chartRef.current = new Chart(canvasRef.current, {
      type: "bar",
      data: {
        labels: data.map(d => d.hour),
        datasets: [
          {
            label: "Info",
            data: data.map(d => d.info),
            backgroundColor: "rgba(59,130,246,0.6)",
            borderColor: "rgba(59,130,246,0.9)",
            borderWidth: 1,
            stack: "events",
          },
          {
            label: "Warning",
            data: data.map(d => d.warning),
            backgroundColor: "rgba(245,158,11,0.6)",
            borderColor: "rgba(245,158,11,0.9)",
            borderWidth: 1,
            stack: "events",
          },
          {
            label: "Critical",
            data: data.map(d => d.critical),
            backgroundColor: "rgba(239,68,68,0.6)",
            borderColor: "rgba(239,68,68,0.9)",
            borderWidth: 1,
            stack: "events",
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "top", labels: { boxWidth: 12, font: { size: 11 } } },
          tooltip: { mode: "index", intersect: false },
        },
        scales: {
          x: {
            stacked: true,
            ticks: { maxTicksLimit: 12, font: { size: 10 } },
            grid: { display: false },
          },
          y: {
            stacked: true,
            beginAtZero: true,
            ticks: { stepSize: 1, font: { size: 10 } },
          },
        },
      },
    });

    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [data]);

  return (
    <div style={{ height: 220 }}>
      <canvas ref={canvasRef} />
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function AdminSecurityDashboard() {
  const [eventType, setEventType] = useState<string>("all");
  const [severity, setSeverity] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [hoursBack, setHoursBack] = useState(24);
  const [page, setPage] = useState(1);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  // Reset page on filter change
  useEffect(() => { setPage(1); }, [eventType, severity, debouncedSearch, hoursBack]);

  const refetchInterval = 30_000; // 30 s

  const { data: stats, refetch: refetchStats } = trpc.securityDashboard.getStats.useQuery(undefined, {
    refetchInterval,
  });
  const { data: timeline } = trpc.securityDashboard.getEventTimeline.useQuery(undefined, {
    refetchInterval,
  });
  const { data: activeSessions } = trpc.securityDashboard.getActiveSessions.useQuery(undefined, {
    refetchInterval,
  });
  const { data: events, isLoading: eventsLoading } = trpc.securityDashboard.getRecentEvents.useQuery(
    {
      page,
      pageSize: 20,
      eventType: eventType === "all" ? undefined : eventType,
      severity: severity === "all" ? undefined : (severity as "info" | "warning" | "critical"),
      search: debouncedSearch || undefined,
      hoursBack,
    },
    { refetchInterval }
  );

  function handleRefresh() {
    refetchStats();
    setLastRefresh(new Date());
  }

  const s = stats?.last24h;

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Security Dashboard</h1>
            <p className="text-sm text-muted-foreground">Real-time session activity and security events</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          <span>Last refresh: {lastRefresh.toLocaleTimeString()}</span>
          <Button variant="outline" size="sm" onClick={handleRefresh} className="ml-2 h-7 px-2">
            <RefreshCw className="h-3.5 w-3.5 mr-1" />
            Refresh
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          title="Active Sessions"
          value={activeSessions?.length ?? "—"}
          icon={<Users className="h-5 w-5" />}
          description="Within last 8 hours"
          variant="success"
        />
        <KpiCard
          title="Login Failures"
          value={s?.loginFail ?? "—"}
          icon={<ShieldAlert className="h-5 w-5" />}
          description="Last 24 hours"
          variant={s && s.loginFail > 10 ? "danger" : s && s.loginFail > 3 ? "warning" : "default"}
        />
        <KpiCard
          title="Rate Limit Hits"
          value={s?.rateLimitHit ?? "—"}
          icon={<Zap className="h-5 w-5" />}
          description="Last 24 hours"
          variant={s && s.rateLimitHit > 5 ? "warning" : "default"}
        />
        <KpiCard
          title="Critical Events"
          value={s?.severity.critical ?? "—"}
          icon={<AlertTriangle className="h-5 w-5" />}
          description="Last 24 hours"
          variant={s && s.severity.critical > 0 ? "danger" : "default"}
        />
      </div>

      {/* Second row KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          title="Successful Logins"
          value={s?.loginSuccess ?? "—"}
          icon={<LogIn className="h-5 w-5" />}
          description="Last 24 hours"
          variant="success"
        />
        <KpiCard
          title="MFA Verify Fails"
          value={s?.mfaVerifyFail ?? "—"}
          icon={<Lock className="h-5 w-5" />}
          description="Last 24 hours"
          variant={s && s.mfaVerifyFail > 3 ? "warning" : "default"}
        />
        <KpiCard
          title="Sessions Invalidated"
          value={s?.sessionInvalidated ?? "—"}
          icon={<Activity className="h-5 w-5" />}
          description="Last 24 hours"
        />
        <KpiCard
          title="Total Events (7d)"
          value={stats?.last7dTotal ?? "—"}
          icon={<Shield className="h-5 w-5" />}
          description="Last 7 days"
        />
      </div>

      {/* Timeline Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            Event Timeline — Last 24 Hours
          </CardTitle>
          <CardDescription>Stacked by severity (info / warning / critical)</CardDescription>
        </CardHeader>
        <CardContent>
          {timeline ? <TimelineChart data={timeline} /> : (
            <div className="flex items-center justify-center h-[220px] text-muted-foreground text-sm">
              Loading chart…
            </div>
          )}
        </CardContent>
      </Card>

      {/* Active Sessions */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            Active Sessions
            {activeSessions && (
              <Badge variant="secondary" className="ml-2 text-xs">{activeSessions.length}</Badge>
            )}
          </CardTitle>
          <CardDescription>Users with a session active within the last 8 hours</CardDescription>
        </CardHeader>
        <CardContent>
          {!activeSessions ? (
            <div className="text-center text-muted-foreground py-6 text-sm">Loading…</div>
          ) : activeSessions.length === 0 ? (
            <div className="text-center text-muted-foreground py-6 text-sm">No active sessions</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Login Method</TableHead>
                    <TableHead>MFA</TableHead>
                    <TableHead>Last Active</TableHead>
                    <TableHead>Session Age</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeSessions.map(session => (
                    <TableRow key={session.id}>
                      <TableCell>
                        <div className="font-medium text-sm">{session.displayName ?? session.name ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">{session.email ?? "—"}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs capitalize">{session.role}</Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground capitalize">
                          {session.loginMethod === "local" ? "Email/Password" : session.loginMethod ?? "OAuth"}
                        </span>
                      </TableCell>
                      <TableCell>
                        {session.mfaEnabled ? (
                          <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                            <ShieldCheck className="h-3.5 w-3.5" /> Enabled
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <Unlock className="h-3.5 w-3.5" /> Off
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(session.lastSignedIn).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {session.sessionAge < 60
                          ? `${session.sessionAge}m ago`
                          : `${Math.floor(session.sessionAge / 60)}h ${session.sessionAge % 60}m ago`}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Event Log */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            Security Event Log
          </CardTitle>
          <CardDescription>Filterable audit trail of all security events</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[180px] max-w-xs">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search email or IP…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8 h-8 text-sm"
              />
            </div>
            <Select value={eventType} onValueChange={setEventType}>
              <SelectTrigger className="w-44 h-8 text-sm">
                <SelectValue placeholder="Event type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All event types</SelectItem>
                {Object.entries(EVENT_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={severity} onValueChange={setSeverity}>
              <SelectTrigger className="w-32 h-8 text-sm">
                <SelectValue placeholder="Severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All severities</SelectItem>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>
            <Select value={String(hoursBack)} onValueChange={v => setHoursBack(Number(v))}>
              <SelectTrigger className="w-32 h-8 text-sm">
                <SelectValue placeholder="Time range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Last 1 hour</SelectItem>
                <SelectItem value="6">Last 6 hours</SelectItem>
                <SelectItem value="24">Last 24 hours</SelectItem>
                <SelectItem value="72">Last 3 days</SelectItem>
                <SelectItem value="168">Last 7 days</SelectItem>
                <SelectItem value="720">Last 30 days</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          {eventsLoading ? (
            <div className="text-center text-muted-foreground py-8 text-sm">Loading events…</div>
          ) : !events || events.events.length === 0 ? (
            <div className="text-center text-muted-foreground py-8 text-sm">
              No events found matching the current filters.
            </div>
          ) : (
            <>
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-36">Time</TableHead>
                      <TableHead>Event</TableHead>
                      <TableHead>Severity</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>IP Address</TableHead>
                      <TableHead>Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {events.events.map(ev => (
                      <TableRow key={ev.id}>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(ev.createdAt).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <EventTypeBadge type={ev.eventType} />
                        </TableCell>
                        <TableCell>
                          <SeverityBadge severity={ev.severity} />
                        </TableCell>
                        <TableCell>
                          <div className="text-xs">
                            <div className="font-medium">{ev.userEmail ?? "—"}</div>
                            {ev.userRole && (
                              <div className="text-muted-foreground capitalize">{ev.userRole}</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground font-mono">
                          {ev.ipAddress ?? "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                          {ev.metadata
                            ? (() => {
                                try {
                                  const m = JSON.parse(ev.metadata);
                                  return Object.entries(m)
                                    .map(([k, v]) => `${k}: ${v}`)
                                    .join(", ");
                                } catch {
                                  return ev.metadata;
                                }
                              })()
                            : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>
                  Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, events.total)} of {events.total} events
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2"
                    disabled={page <= 1}
                    onClick={() => setPage(p => p - 1)}
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Button>
                  <span className="px-2 text-xs">
                    Page {page} / {events.totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2"
                    disabled={page >= events.totalPages}
                    onClick={() => setPage(p => p + 1)}
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Footer */}
      <p className="text-center text-xs text-muted-foreground pb-4">
        Powered by SEBA · Data refreshes every 30 seconds
      </p>
    </div>
  );
}
