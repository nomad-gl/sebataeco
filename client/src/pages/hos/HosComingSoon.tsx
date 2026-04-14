import DashboardLayout from "@/components/DashboardLayout";
import { useI18n, TranslationKey } from "@/contexts/I18nContext";
import { LucideIcon } from "lucide-react";

interface HosComingSoonProps {
  titleKey: TranslationKey;
  descKey: TranslationKey;
  icon: LucideIcon;
}

export default function HosComingSoon({ titleKey, descKey, icon: Icon }: HosComingSoonProps) {
  const { t } = useI18n();

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10">
            <Icon className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t(titleKey)}</h1>
            <p className="text-sm text-muted-foreground">{t(descKey)}</p>
          </div>
        </div>

        {/* Coming soon card */}
        <div className="rounded-xl border border-dashed bg-muted/30 p-12 text-center text-muted-foreground flex flex-col items-center gap-4">
          <div className="p-4 rounded-2xl bg-primary/5">
            <Icon className="w-12 h-12 text-primary/40" />
          </div>
          <div>
            <p className="text-lg font-semibold text-foreground">{t("hos_coming_soon")}</p>
            <p className="text-sm mt-1 max-w-sm mx-auto">{t("hos_coming_soon_desc")}</p>
          </div>
        </div>

        <p className="text-xs text-muted-foreground text-right">Powered by SEBA</p>
      </div>
    </DashboardLayout>
  );
}
