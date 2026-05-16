import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, AlertTriangle, Zap } from "lucide-react";

interface AuditStatusCardsProps {
  latestAudit: any;
}

export default function AuditStatusCards({ latestAudit }: AuditStatusCardsProps) {
  if (!latestAudit) return null;

  const sections = [
    {
      title: "Code Review",
      icon: <CheckCircle2 className="w-5 h-5 text-blue-500" />,
      items: [
        { label: "Issues Found", value: latestAudit.codeReview.issues.length, color: "text-blue-600" },
        { label: "Code Coverage", value: `${latestAudit.codeReview.coverage}%`, color: "text-green-600" },
      ],
    },
    {
      title: "Security Scan",
      icon: <AlertTriangle className="w-5 h-5 text-amber-500" />,
      items: [
        { label: "Vulnerabilities", value: latestAudit.securityScan.vulnerabilities.length, color: "text-red-600" },
        { label: "Dependencies", value: latestAudit.securityScan.dependenciesScanned, color: "text-slate-600" },
      ],
    },
    {
      title: "Penetration Test",
      icon: <AlertCircle className="w-5 h-5 text-red-500" />,
      items: [
        { label: "Weaknesses", value: latestAudit.penetrationTest.weaknesses.length, color: "text-red-600" },
        { label: "Tests Run", value: latestAudit.penetrationTest.testsConducted, color: "text-slate-600" },
      ],
    },
    {
      title: "Self-Healing",
      icon: <Zap className="w-5 h-5 text-yellow-500" />,
      items: [
        {
          label: "Actions Completed",
          value: `${latestAudit.selfHealingActions.filter((a: any) => a.status === "COMPLETED").length}/${latestAudit.selfHealingActions.length}`,
          color: "text-green-600",
        },
        {
          label: "Failed Actions",
          value: latestAudit.selfHealingActions.filter((a: any) => a.status === "FAILED").length,
          color: "text-red-600",
        },
      ],
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {sections.map((section) => (
        <Card key={section.title} className="border-2">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-4">
              {section.icon}
              <h3 className="font-semibold text-slate-900">{section.title}</h3>
            </div>
            <div className="space-y-3">
              {section.items.map((item) => (
                <div key={item.label} className="flex justify-between items-center">
                  <span className="text-sm text-slate-600">{item.label}</span>
                  <span className={`font-bold text-lg ${item.color}`}>{item.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
