import BackButton from "@/components/BackButton";
import { useI18n } from "@/contexts/I18nContext";
import NavBar from "@/components/NavBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Wrench  } from "lucide-react";

export default function AdminFacilities() {
  const { t } = useI18n();
  return (
    <div className="min-h-screen bg-background">
      <NavBar />
      <div className="container max-w-4xl py-12">
        <BackButton className="mb-4" />
        <div className="flex items-center gap-4 mb-8">
          <div className="w-14 h-14 rounded-2xl bg-orange-600 flex items-center justify-center">
            <Wrench className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Facilities &amp; Inventory</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Instal·lacions i Inventari — Maintenance, materials, room bookings</p>
          </div>
          <Badge variant="secondary" className="ml-auto">{t("admin_coming_soon")}</Badge>
        </div>
        <Card className="border-dashed border-2 border-border">
          <CardHeader>
            <CardTitle className="text-base text-muted-foreground font-medium">
              This section is under development
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground leading-relaxed">
              The Facilities &amp; Inventory module will manage the school's physical resources: materials
              inventory, maintenance requests, room and equipment bookings, and asset tracking — helping
              the secretariat maintain an up-to-date record of all centre assets.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
