import { useEffect, useRef } from "react";
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from "chart.js";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

interface AuditTrendChartProps {
  auditHistory: any[];
}

export default function AuditTrendChart({ auditHistory }: AuditTrendChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<ChartJS | null>(null);

  useEffect(() => {
    if (!canvasRef.current || !auditHistory.length) return;

    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;

    // Prepare data
    const labels = auditHistory.map((a) => new Date(a.timestamp).toLocaleDateString());
    const codeIssues = auditHistory.map((a) => a.codeReview.issues.length);
    const vulnerabilities = auditHistory.map((a) => a.securityScan.vulnerabilities.length);
    const weaknesses = auditHistory.map((a) => a.penetrationTest.weaknesses.length);

    // Destroy previous chart if it exists
    if (chartRef.current) {
      chartRef.current.destroy();
    }

    // Create new chart
    chartRef.current = new ChartJS(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Code Issues",
            data: codeIssues,
            borderColor: "#3b82f6",
            backgroundColor: "rgba(59, 130, 246, 0.1)",
            tension: 0.4,
            fill: true,
          },
          {
            label: "Vulnerabilities",
            data: vulnerabilities,
            borderColor: "#ef4444",
            backgroundColor: "rgba(239, 68, 68, 0.1)",
            tension: 0.4,
            fill: true,
          },
          {
            label: "Weaknesses",
            data: weaknesses,
            borderColor: "#f59e0b",
            backgroundColor: "rgba(245, 158, 11, 0.1)",
            tension: 0.4,
            fill: true,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            position: "top" as const,
          },
          title: {
            display: false,
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: "Count",
            },
          },
        },
      },
    });

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
      }
    };
  }, [auditHistory]);

  return <canvas ref={canvasRef} style={{ height: "300px" }} />;
}
