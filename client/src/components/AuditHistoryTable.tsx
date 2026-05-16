import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { CheckCircle2, AlertCircle, AlertTriangle } from "lucide-react";

interface AuditHistoryTableProps {
  auditHistory: any[];
}

export default function AuditHistoryTable({ auditHistory }: AuditHistoryTableProps) {
  if (!auditHistory.length) {
    return (
      <Card className="border-2">
        <CardHeader>
          <CardTitle>Audit History</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-slate-500 py-8">No audit history available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-2">
      <CardHeader>
        <CardTitle>Audit History</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Code Issues</TableHead>
              <TableHead>Vulnerabilities</TableHead>
              <TableHead>Weaknesses</TableHead>
              <TableHead>Self-Healing</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {auditHistory.map((audit) => (
              <TableRow key={audit.id}>
                <TableCell className="font-medium">
                  {format(new Date(audit.timestamp), "MMM d, yyyy h:mm a")}
                </TableCell>
                <TableCell>
                  <StatusBadge status={audit.overallStatus} />
                </TableCell>
                <TableCell>
                  <span className="text-blue-600 font-semibold">{audit.codeReview.issues.length}</span>
                </TableCell>
                <TableCell>
                  <span className="text-red-600 font-semibold">{audit.securityScan.vulnerabilities.length}</span>
                </TableCell>
                <TableCell>
                  <span className="text-amber-600 font-semibold">{audit.penetrationTest.weaknesses.length}</span>
                </TableCell>
                <TableCell>
                  <span className="text-green-600 font-semibold">
                    {audit.selfHealingActions.filter((a: any) => a.status === "COMPLETED").length}/
                    {audit.selfHealingActions.length}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: "PASS" | "FAIL" | "REMEDIATED" }) {
  const variants = {
    PASS: {
      bg: "bg-green-100",
      text: "text-green-800",
      icon: <CheckCircle2 className="w-4 h-4" />,
    },
    REMEDIATED: {
      bg: "bg-blue-100",
      text: "text-blue-800",
      icon: <AlertTriangle className="w-4 h-4" />,
    },
    FAIL: {
      bg: "bg-red-100",
      text: "text-red-800",
      icon: <AlertCircle className="w-4 h-4" />,
    },
  };

  const variant = variants[status];

  return (
    <Badge className={`${variant.bg} ${variant.text} gap-2`}>
      {variant.icon}
      {status}
    </Badge>
  );
}
