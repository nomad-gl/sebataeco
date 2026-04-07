import { useState, useEffect } from "react";
import { Link } from "wouter";
import { X, Shield } from "lucide-react";
import { useI18n } from "@/contexts/I18nContext";

const STORAGE_KEY = "seba_data_notice_dismissed";

export default function DataNoticeBanner() {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem(STORAGE_KEY);
    if (!dismissed) setVisible(true);
  }, []);

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-primary/95 text-primary-foreground backdrop-blur-sm border-t border-primary/20 shadow-lg">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
        <Shield className="h-4 w-4 shrink-0 opacity-80" />
        <p className="text-sm flex-1">
          {t("data_notice_text")}{" "}
          <Link href="/privacy" className="underline underline-offset-2 font-medium hover:opacity-80">
            {t("data_notice_link")}
          </Link>
        </p>
        <button
          onClick={dismiss}
          className="shrink-0 flex items-center gap-1.5 text-sm font-medium bg-white/20 hover:bg-white/30 px-3 py-1 rounded-full transition-colors"
          aria-label={t("data_notice_dismiss")}
        >
          {t("data_notice_dismiss")}
          <X className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
