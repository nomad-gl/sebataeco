/**
 * Settings page
 *
 * Provides teacher-facing configuration options.
 * Currently includes:
 *   - Branding: upload/manage school logo (stored in localStorage)
 *
 * Additional settings sections can be added as new Card blocks below.
 */

import { useEffect, useState } from "react";
import { Settings as SettingsIcon, Palette, CheckCircle2, BookOpen, FileText } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import NavBar from "@/components/NavBar";
import LogoUploader from "@/components/LogoUploader";
import { useI18n, type TranslationKey } from "@/contexts/I18nContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { getLoginUrl } from "@/const";

const STORAGE_KEY = "seba_school_logo";

// ── Live print-header preview ────────────────────────────────────────────────
function PrintHeaderPreview({ t }: { t: (k: TranslationKey) => string }) {
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) setLogoDataUrl(stored);

    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as string | null;
      setLogoDataUrl(detail);
    };
    window.addEventListener("seba_logo_changed", handler);
    return () => window.removeEventListener("seba_logo_changed", handler);
  }, []);

  return (
    <div className="rounded-lg border border-border bg-white shadow-sm overflow-hidden">
      {/* Simulated A4 header strip */}
      <div className="px-5 pt-4 pb-3 border-b border-border/60 flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-bold text-gray-800 leading-tight truncate">
            {t("settings_logo_preview_school")}
          </p>
          <p className="text-[10px] text-gray-500 mt-0.5 truncate">
            {t("settings_logo_preview_subject")}
          </p>
          <div className="flex gap-4 mt-1.5">
            <span className="text-[9px] text-gray-400">
              <span className="font-semibold text-gray-600">{t("settings_logo_preview_date")}</span> 07/04/2026
            </span>
            <span className="text-[9px] text-gray-400">
              <span className="font-semibold text-gray-600">{t("settings_logo_preview_teacher")}</span> Ms García
            </span>
          </div>
        </div>
        {logoDataUrl ? (
          <img
            src={logoDataUrl}
            alt="Logo preview"
            className="h-10 max-w-[90px] object-contain flex-shrink-0"
          />
        ) : (
          <div className="h-10 w-[90px] rounded border-2 border-dashed border-gray-200 flex items-center justify-center flex-shrink-0">
            <span className="text-[9px] text-gray-300 text-center leading-tight px-1">Logo here</span>
          </div>
        )}
      </div>
      <div className="px-5 py-2 bg-gray-50">
        <p className="text-[9px] text-gray-400 italic">{t("settings_logo_preview_title")}</p>
      </div>
    </div>
  );
}

// ── Where the logo is used ───────────────────────────────────────────────────
function WhereUsed({ t }: { t: (k: TranslationKey) => string }) {
  const items = [
    { icon: BookOpen, label: t("settings_where_lesson") },
    { icon: FileText, label: t("settings_where_worksheet") },
  ];
  return (
    <div className="rounded-lg border border-border bg-muted/20 p-4">
      <p className="text-xs font-semibold text-foreground mb-2">{t("settings_where_used")}</p>
      <ul className="space-y-1.5">
        {items.map(({ icon: Icon, label }) => (
          <li key={label} className="flex items-center gap-2 text-xs text-muted-foreground">
            <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
            <Icon className="w-3.5 h-3.5 flex-shrink-0" />
            <span>{label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function Settings() {
  const { t } = useI18n();
  const { user, loading } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <NavBar />
      <main className="container max-w-2xl py-8 px-4">
        {/* Page header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <SettingsIcon className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t("settings_title")}</h1>
            <p className="text-sm text-muted-foreground">Powered by SEBA</p>
          </div>
        </div>

        {/* Auth gate */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !user && !loading ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-4 py-12">
              <SettingsIcon className="w-10 h-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground text-center">
                Please sign in to access your settings.
              </p>
              <Button asChild>
                <a href={getLoginUrl("/settings")}>Sign In</a>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* ── Branding card ── */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Palette className="w-4 h-4 text-primary" />
                  <CardTitle className="text-base">{t("settings_branding")}</CardTitle>
                </div>
                <CardDescription className="text-sm leading-relaxed">
                  {t("settings_branding_desc")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Logo uploader */}
                <LogoUploader />

                {/* Live preview */}
                <div>
                  <p className="text-xs font-semibold text-foreground mb-2">
                    {t("settings_logo_preview_title")}
                  </p>
                  <PrintHeaderPreview t={t} />
                </div>

                {/* Where used */}
                <WhereUsed t={t} />
              </CardContent>
            </Card>

            {/* Placeholder for future settings sections */}
          </div>
        )}
      </main>
    </div>
  );
}
