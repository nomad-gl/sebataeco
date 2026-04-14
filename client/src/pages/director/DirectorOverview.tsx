import DashboardLayout from "@/components/DashboardLayout";
import { useI18n } from "@/contexts/I18nContext";
import { BarChart3, Users, BookOpen, Brain, TrendingUp, Calendar } from "lucide-react";

export default function DirectorOverview() {
  const { t } = useI18n();

  const stats = [
    { icon: Users,      label: t("dir_stat_teachers"),    value: "—" },
    { icon: BookOpen,   label: t("dir_stat_plans"),        value: "—" },
    { icon: Brain,      label: t("dir_stat_ai_sessions"),  value: "—" },
    { icon: TrendingUp, label: t("dir_stat_competencies"), value: "—" },
    { icon: Calendar,   label: t("dir_stat_events"),       value: "—" },
  ];

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10">
            <BarChart3 className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t("dir_overview")}</h1>
            <p className="text-sm text-muted-foreground">{t("dir_overview_desc")}</p>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {stats.map(({ icon: Icon, label, value }) => (
            <div key={label} className="rounded-xl border bg-card p-4 flex flex-col gap-2">
              <Icon className="w-5 h-5 text-primary" />
              <p className="text-2xl font-bold text-foreground">{value}</p>
              <p className="text-xs text-muted-foreground leading-tight">{label}</p>
            </div>
          ))}
        </div>

        {/* Coming soon notice */}
        <div className="rounded-xl border border-dashed bg-muted/30 p-8 text-center text-muted-foreground">
          <BarChart3 className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">{t("dir_coming_soon")}</p>
          <p className="text-sm mt-1">{t("dir_coming_soon_desc")}</p>
        </div>

        <p className="text-xs text-muted-foreground text-right">Powered by SEBA</p>
      </div>
    </DashboardLayout>
  );
}
