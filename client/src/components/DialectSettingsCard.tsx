/**
 * DialectSettingsCard — allows users to select their preferred Catalan TTS dialect.
 * Persists to the database via trpc.auth.setTtsDialect and syncs with localStorage
 * so the AIChatBox picks up the preference immediately.
 */
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Volume2, Check, MapPin } from "lucide-react";
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

export default function DialectSettingsCard() {
  const { t } = useI18n();
  const [selectedDialect, setSelectedDialect] = useState<Dialect>("nord-occidental");
  const [saving, setSaving] = useState(false);

  // Fetch current preference from DB
  const { data: dialectData } = trpc.auth.getTtsDialect.useQuery();
  const setDialectMutation = trpc.auth.setTtsDialect.useMutation();

  // Sync DB value to local state on load
  useEffect(() => {
    if (dialectData?.dialect) {
      setSelectedDialect(dialectData.dialect as Dialect);
      // Also sync to localStorage for AIChatBox
      localStorage.setItem(DIALECT_STORAGE_KEY, dialectData.dialect);
    }
  }, [dialectData]);

  const handleSelectDialect = async (dialect: Dialect) => {
    setSelectedDialect(dialect);
    setSaving(true);

    try {
      await setDialectMutation.mutateAsync({ dialect });
      // Sync to localStorage for immediate AIChatBox pickup
      localStorage.setItem(DIALECT_STORAGE_KEY, dialect);
      toast.success(t("dialect_saved_success" as TranslationKey));
    } catch {
      toast.error(t("dialect_saved_error" as TranslationKey));
    } finally {
      setSaving(false);
    }
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {DIALECT_OPTIONS.map((option) => {
            const isSelected = selectedDialect === option.id;
            return (
              <Button
                key={option.id}
                variant={isSelected ? "default" : "outline"}
                className={`h-auto py-3 px-4 flex flex-col items-start gap-1 text-left transition-all ${
                  isSelected
                    ? "ring-2 ring-primary/30 shadow-md"
                    : "hover:border-primary/50 hover:bg-primary/5"
                }`}
                onClick={() => handleSelectDialect(option.id)}
                disabled={saving}
              >
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
