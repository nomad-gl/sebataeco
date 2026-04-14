import DashboardLayout from "@/components/DashboardLayout";
import { useI18n } from "@/contexts/I18nContext";
import { GraduationCap, BarChart3 } from "lucide-react";

export default function DirectorStudentProgress() {
  const { t } = useI18n();
  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10"><GraduationCap className="w-6 h-6 text-primary" /></div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t("dir_student_progress")}</h1>
            <p className="text-sm text-muted-foreground">{t("dir_student_progress_desc")}</p>
          </div>
        </div>
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
