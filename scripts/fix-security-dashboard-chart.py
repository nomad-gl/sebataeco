path = "/home/ubuntu/seba-ai-studio/client/src/pages/admin/AdminSecurityDashboard.tsx"
with open(path, "r") as f:
    content = f.read()

# 1. Remove chart.js import and register call, replace with recharts import
old_chartjs = (
    'import { Chart, registerables } from "chart.js";\n'
    'Chart.register(...registerables);'
)
new_recharts = (
    'import {\n'
    '  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer\n'
    '} from "recharts";'
)
content = content.replace(old_chartjs, new_recharts, 1)

# 2. Remove the useRef import for chart (keep useState, useEffect, useRef for other uses)
# useRef is still needed for other things, keep it

# 3. Replace the TimelineChart component (canvas-based) with recharts version
old_timeline = '''// ── Timeline Chart ─────────────────────────────────────────────────────────────
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
      <canvas ref={canvasRef} />'''

new_timeline = '''// ── Timeline Chart (Recharts) ──────────────────────────────────────────────────
function TimelineChart({ data }: { data: Array<{ hour: string; total: number; info: number; warning: number; critical: number }> }) {
  return (
    <div style={{ height: 220 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.07)" />
          <XAxis dataKey="hour" tick={{ fontSize: 10 }} interval={2} />
          <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
          <Tooltip
            contentStyle={{ background: "#1e1e2e", border: "1px solid #333", borderRadius: 6, fontSize: 12 }}
            labelStyle={{ color: "#ccc" }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="info" name="Info" stackId="a" fill="rgba(59,130,246,0.75)" radius={[0,0,0,0]} />
          <Bar dataKey="warning" name="Warning" stackId="a" fill="rgba(245,158,11,0.75)" radius={[0,0,0,0]} />
          <Bar dataKey="critical" name="Critical" stackId="a" fill="rgba(239,68,68,0.75)" radius={[2,2,0,0]} />
        </BarChart>
      </ResponsiveContainer>'''

content = content.replace(old_timeline, new_timeline, 1)

# 4. Remove the useRef for chart from the import since we no longer need it for chart
# (useRef is still used for other things - check)
# Actually useRef is still in the import but may not be used anymore - check
if 'useRef' not in content.replace('import { useState, useEffect, useRef }', ''):
    content = content.replace(
        'import { useState, useEffect, useRef } from "react";',
        'import { useState, useEffect } from "react";',
        1
    )

with open(path, "w") as f:
    f.write(content)

# Verify
checks = [
    ("chart.js" not in content, "chart.js removed"),
    ("recharts" in content, "recharts imported"),
    ("ResponsiveContainer" in content, "ResponsiveContainer used"),
    ("BarChart" in content, "BarChart used"),
    ("TimelineChart" in content, "TimelineChart function present"),
]
for ok, label in checks:
    print(f"  {'OK' if ok else 'FAIL'} {label}")
