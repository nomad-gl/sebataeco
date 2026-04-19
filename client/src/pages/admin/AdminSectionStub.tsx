import NavBar from "@/components/NavBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LucideIcon, ArrowLeft } from "lucide-react";

interface AdminSectionStubProps {
  icon: LucideIcon;
  titleKey: string;
  descriptionKey: string;
  color: string;
}

export function AdminSectionStub({ icon: Icon, titleKey, descriptionKey, color }: AdminSectionStubProps) {
  return (
    <div className="min-h-screen bg-background">
      <NavBar />
      <div className="container max-w-4xl py-12">
        <button onClick={() => window.history.back()} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4">
          <ArrowLeft className="h-4 w-4" />Back
        </button>
        <div className="flex items-center gap-4 mb-8">
          <div className={`w-14 h-14 rounded-2xl ${color} flex items-center justify-center`}>
            <Icon className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{titleKey}</h1>
            <p className="text-muted-foreground text-sm mt-0.5">{descriptionKey}</p>
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
              This administration module is being built. It will integrate with the school's existing
              processes and provide a streamlined interface for managing this area directly within SEBA.
              Check back soon for updates.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
