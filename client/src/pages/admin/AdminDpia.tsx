/**
 * AdminDpia — DPIA (Data Protection Impact Assessment) viewer
 * MED-03 security fix: surfaces the DPIA record in the admin UI.
 *
 * Access: admin role only (enforced both server-side and client-side).
 */
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Shield,
  FileText,
  Users,
  AlertTriangle,
  CheckCircle2,
  Globe,
  Clock,
  Mail,
} from "lucide-react";

function RiskBadge({ level }: { level: string }) {
  const variants: Record<string, string> = {
    Low: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    Medium: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
    High: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${variants[level] ?? variants.Medium}`}>
      {level}
    </span>
  );
}

export default function AdminDpia() {
  const { data: dpia, isLoading, error } = trpc.dpia.get.useQuery();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Card className="border-destructive/30">
          <CardContent className="pt-6 text-center text-destructive">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
            <p>{error.message}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!dpia) return null;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Shield className="h-10 w-10 text-primary mt-1 shrink-0" />
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Data Protection Impact Assessment</h1>
          <p className="text-muted-foreground text-sm mt-1">
            GDPR Article 35 — DPIA for SEBA AI Studio
          </p>
          <div className="flex flex-wrap gap-2 mt-2">
            <Badge variant="outline" className="text-xs">
              <Clock className="h-3 w-3 mr-1" />
              Version {dpia.version}
            </Badge>
            <Badge variant="outline" className="text-xs">
              Last reviewed: {dpia.lastReviewed}
            </Badge>
            <Badge variant="outline" className="text-xs">
              Next review: {dpia.nextReviewDue}
            </Badge>
          </div>
        </div>
      </div>

      {/* Data Controller */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Globe className="h-4 w-4" />
            Data Controller
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p><span className="font-medium">Organisation:</span> {dpia.dataController.name}</p>
          <p><span className="font-medium">Contact:</span> {dpia.dataController.contact}</p>
          <p><span className="font-medium">DPO:</span> {dpia.dataController.dpo}</p>
        </CardContent>
      </Card>

      {/* Legal Basis */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Legal Basis for Processing
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm">{dpia.legalBasis}</p>
        </CardContent>
      </Card>

      {/* Data Subjects */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            Data Subjects
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {dpia.dataSubjects.map((ds, i) => (
              <div key={i} className="flex gap-3">
                <Badge variant="secondary" className="shrink-0 mt-0.5 h-fit">{ds.category}</Badge>
                <p className="text-sm text-muted-foreground">{ds.description}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Processing Activities */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Processing Activities
          </CardTitle>
          <CardDescription>
            {dpia.processingActivities.length} activities identified
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {dpia.processingActivities.map((pa, i) => (
            <div key={i}>
              {i > 0 && <Separator className="mb-4" />}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono text-xs">{pa.id}</Badge>
                  <span className="font-medium text-sm">{pa.name}</span>
                </div>
                <div className="grid grid-cols-1 gap-1 text-sm pl-2">
                  <p><span className="text-muted-foreground">Purpose:</span> {pa.purpose}</p>
                  <p><span className="text-muted-foreground">Data categories:</span> {pa.dataCategories.join(", ")}</p>
                  <p><span className="text-muted-foreground">Retention:</span> {pa.retention}</p>
                  <p><span className="text-muted-foreground">Third parties:</span> {pa.thirdParties.join(", ")}</p>
                  <p><span className="text-muted-foreground">Risks:</span> {pa.risks}</p>
                  <p><span className="text-muted-foreground">Mitigations:</span> {pa.mitigations}</p>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Risk Assessment */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Risk Assessment
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 pr-4 font-medium">Risk</th>
                  <th className="text-left py-2 pr-4 font-medium">Likelihood</th>
                  <th className="text-left py-2 pr-4 font-medium">Impact</th>
                  <th className="text-left py-2 pr-4 font-medium">Residual</th>
                  <th className="text-left py-2 font-medium">Controls</th>
                </tr>
              </thead>
              <tbody>
                {dpia.riskAssessment.map((r, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-2 pr-4 text-muted-foreground">{r.risk}</td>
                    <td className="py-2 pr-4"><RiskBadge level={r.likelihood} /></td>
                    <td className="py-2 pr-4"><RiskBadge level={r.impact} /></td>
                    <td className="py-2 pr-4"><RiskBadge level={r.residualRisk} /></td>
                    <td className="py-2 text-muted-foreground text-xs">{r.controls}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Subject Rights */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Data Subject Rights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm">{dpia.subjectRights}</p>
        </CardContent>
      </Card>

      {/* International Transfers */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Globe className="h-4 w-4" />
            International Data Transfers
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm">{dpia.transfersOutsideEEA}</p>
        </CardContent>
      </Card>

      {/* Conclusion */}
      <Card className="border-green-200 bg-green-50 dark:bg-green-950/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2 text-green-700 dark:text-green-400">
            <CheckCircle2 className="h-4 w-4" />
            DPIA Conclusion
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm">{dpia.dpiaConclusion}</p>
        </CardContent>
      </Card>
    </div>
  );
}
