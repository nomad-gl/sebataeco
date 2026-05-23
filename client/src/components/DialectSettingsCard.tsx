/**
 * DialectSettingsCard — allows users to select their preferred Catalan TTS dialect.
 * Includes auto-detect from school location with a suggestion banner.
 * Persists to the database via trpc.auth.setTtsDialect and syncs with localStorage
 * so the AIChatBox picks up the preference immediately.
 */
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Volume2, Check, MapPin, Sparkles, Info } from "lucide-react";
import { useI18n, type TranslationKey } from "@/contexts/I18nContext";

const DIALECT_STORAGE_KEY = "seba_aina_accent";

type Dialect = "central" | "balear" | "nord-occidental" | "valencia";

interface DialectOption {
  id: Dialect;
  labelKey: TranslationKey;
  regionKey: TranslationKey;
  descKey: TranslationKey;
  emoji: string;
}

const DIALECT_OPTIONS: DialectOption[] = [
  {
    id: "nord-occidental",
    labelKey: "dialect_nord_occidental" as TranslationKey,
    regionKey: "dialect_region_nord_occidental" as TranslationKey,
    descKey: "dialect_desc_nord_occidental" as TranslationKey,
    emoji: "🏔️",
  },
  {
    id: "central",
    labelKey: "dialect_central" as TranslationKey,
    regionKey: "dialect_region_central" as TranslationKey,
    descKey: "dialect_desc_central" as TranslationKey,
    emoji: "🏙️",
  },
  {
    id: "balear",
    labelKey: "dialect_balear" as TranslationKey,
    regionKey: "dialect_region_balear" as TranslationKey,
    descKey: "dialect_desc_balear" as TranslationKey,
    emoji: "🏝️",
  },
  {
    id: "valencia",
    labelKey: "dialect_valencia" as TranslationKey,
    regionKey: "dialect_region_valencia" as TranslationKey,
    descKey: "dialect_desc_valencia" as TranslationKey,
    emoji: "🍊",
  },
];

/** Map dialect code (ca, ca-nw, ca-ba, ca-va) to internal dialect name */
function dialectCodeToName(code: string): Dialect {
  switch (code) {
    case "ca-nw": return "nord-occidental";
    case "ca-ba": return "balear";
    case "ca-va": return "valencia";
    case "ca":
    default: return "central";
  }
}

export default function DialectSettingsCard() {
  const { t } = useI18n();
  const [selectedDialect, setSelectedDialect] = useState<Dialect>("nord-occidental");
  const [saving, setSaving] = useState(false);
  const [showAutoDetectBanner, setShowAutoDetectBanner] = useState(false);
  const [autoDetectedDialect, setAutoDetectedDialect] = useState<Dialect | null>(null);
  const [autoDetectSource, setAutoDetectSource] = useState<string | null>(null);

  // Fetch current preference from DB
  const { data: dialectData } = trpc.auth.getTtsDialect.useQuery();
  const setDialectMutation = trpc.auth.setTtsDialect.useMutation();

  // Auto-detect dialect from school location
  const { data: autoDetectData } = trpc.auth.autoDetectDialect.useQuery(
    { save: false },
    { staleTime: Infinity }
  );

  // Sync DB value to local state on load
  useEffect(() => {
    if (dialectData?.dialect) {
      setSelectedDialect(dialectData.dialect as Dialect);
      localStorage.setItem(DIALECT_STORAGE_KEY, dialectData.dialect);
    }
  }, [dialectData]);

  // Show auto-detect suggestion if user hasn't explicitly set a dialect
  // and the detected dialect differs from current
  useEffect(() => {
    if (autoDetectData && dialectData) {
      const detected = dialectCodeToName(autoDetectData.detected);
      setAutoDetectedDialect(detected);
      setAutoDetectSource(autoDetectData.source);

      // Show banner if auto-detected dialect differs from current and source is not "default"
      if (
        autoDetectData.source !== "default" &&
        detected !== (dialectData.dialect as Dialect)
      ) {
        setShowAutoDetectBanner(true);
      }
    }
  }, [autoDetectData, dialectData]);

  const handleSelectDialect = async (dialect: Dialect) => {
    setSelectedDialect(dialect);
    setSaving(true);
    setShowAutoDetectBanner(false);

    try {
      await setDialectMutation.mutateAsync({ dialect });
      localStorage.setItem(DIALECT_STORAGE_KEY, dialect);
      toast.success(t("dialect_saved_success" as TranslationKey));
    } catch {
      toast.error(t("dialect_saved_error" as TranslationKey));
    } finally {
      setSaving(false);
    }
  };

  const handleAcceptAutoDetect = () => {
    if (autoDetectedDialect) {
      handleSelectDialect(autoDetectedDialect);
    }
  };

  const handleDismissAutoDetect = () => {
    setShowAutoDetectBanner(false);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Volume2 className="w-4 h-4 text-primary" />
          <CardTitle className="text-base">{t("dialect_settings_title" as TranslationKey)}</CardTitle>
        </div>
        <CardDescription className="text-sm leading-relaxed">
          {t("dialect_settings_desc" as TranslationKey)}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Auto-detect suggestion banner */}
        {showAutoDetectBanner && autoDetectedDialect && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-3 space-y-2">
            <div className="flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
              <div className="flex-1 space-y-1">
                <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
                  {t("dialect_auto_detected_title" as TranslationKey)}
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  {t("dialect_auto_detected_desc" as TranslationKey)}{" "}
                  <span className="font-semibold">
                    {t(DIALECT_OPTIONS.find(o => o.id === autoDetectedDialect)?.labelKey || ("dialect_central" as TranslationKey))}
                  </span>
                  {autoDetectSource === "own_location" && (
                    <span className="text-amber-600 dark:text-amber-400">
                      {" "}({t("dialect_auto_source_own" as TranslationKey)})
                    </span>
                  )}
                  {autoDetectSource === "tenant_director" && (
                    <span className="text-amber-600 dark:text-amber-400">
                      {" "}({t("dialect_auto_source_school" as TranslationKey)})
                    </span>
                  )}
                </p>
              </div>
            </div>
            <div className="flex gap-2 ml-6">
              <Button
                size="sm"
                variant="default"
                className="h-7 text-xs bg-amber-600 hover:bg-amber-700 text-white"
                onClick={handleAcceptAutoDetect}
              >
                {t("dialect_auto_accept" as TranslationKey)}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs text-amber-700 dark:text-amber-300"
                onClick={handleDismissAutoDetect}
              >
                {t("dialect_auto_dismiss" as TranslationKey)}
              </Button>
            </div>
          </div>
        )}

        {/* Auto-detect info when source is known but matches current */}
        {!showAutoDetectBanner && autoDetectSource && autoDetectSource !== "default" && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-2">
            <Info className="w-3.5 h-3.5 shrink-0" />
            <span>
              {t("dialect_auto_matched" as TranslationKey)}
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {DIALECT_OPTIONS.map((option) => {
            const isSelected = selectedDialect === option.id;
            const isAutoDetected = autoDetectedDialect === option.id && autoDetectSource !== "default";
            return (
              <Button
                key={option.id}
                variant={isSelected ? "default" : "outline"}
                className={`h-auto py-3 px-4 flex flex-col items-start gap-1 text-left transition-all relative ${
                  isSelected
                    ? "ring-2 ring-primary/30 shadow-md"
                    : "hover:border-primary/50 hover:bg-primary/5"
                }`}
                onClick={() => handleSelectDialect(option.id)}
                disabled={saving}
              >
                {/* Auto-detect badge */}
                {isAutoDetected && !isSelected && (
                  <span className="absolute top-1.5 right-1.5 flex items-center gap-0.5 bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 text-[10px] font-medium px-1.5 py-0.5 rounded-full">
                    <MapPin className="w-2.5 h-2.5" />
                    Auto
                  </span>
                )}
                <div className="flex items-center gap-2 w-full">
                  <span className="text-lg">{option.emoji}</span>
                  <span className="font-semibold text-sm flex-1">
                    {t(option.labelKey)}
                  </span>
                  {isSelected && <Check className="w-4 h-4 text-primary-foreground" />}
                </div>
                <div className="flex items-center gap-1 ml-7">
                  <MapPin className="w-3 h-3 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    {t(option.regionKey)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground ml-7 line-clamp-2">
                  {t(option.descKey)}
                </p>
              </Button>
            );
          })}
        </div>

        <p className="text-[11px] text-muted-foreground pt-2 border-t border-border/50">
          {t("dialect_settings_note" as TranslationKey)}
        </p>
      </CardContent>
    </Card>
  );
}
