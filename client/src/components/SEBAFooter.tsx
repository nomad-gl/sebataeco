import React from "react";
import { useI18n } from "@/contexts/I18nContext";

export const SEBAFooter: React.FC = () => {
  const { t } = useI18n();
  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full border-t border-border bg-background py-6 text-center text-sm text-muted-foreground">
      <div className="container mx-auto px-4">
        <p>
          © {currentYear} SEBA AI Studio. {t("powered_by_seba")}
        </p>
        <p className="mt-2 text-xs">
          {t("seba_description")}
        </p>
      </div>
    </footer>
  );
};

export default SEBAFooter;
