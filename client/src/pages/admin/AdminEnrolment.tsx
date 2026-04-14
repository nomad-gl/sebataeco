import NavBar from "@/components/NavBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ClipboardList } from "lucide-react";

export default function AdminEnrolment() {
  return (
    <div className="min-h-screen bg-background">
      <NavBar />
      <div className="container max-w-4xl py-12">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center">
            <ClipboardList className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Enrolment &amp; Records</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Matriculació i Expedients — Pre-enrolment, academic records, certificates</p>
          </div>
          <Badge variant="secondary" className="ml-auto">Coming Soon</Badge>
        </div>
        <Card className="border-dashed border-2 border-border">
          <CardHeader>
            <CardTitle className="text-base text-muted-foreground font-medium">
              This section is under development
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground leading-relaxed">
              The Enrolment &amp; Records module will manage pre-enrolment processes, student academic records
              (<em>llibres d'escolaritat</em>), certificates, and official academic documentation in line
              with Departament d'Educació requirements.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
