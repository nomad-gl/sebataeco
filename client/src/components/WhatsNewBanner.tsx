import { useState, useEffect } from "react";
import { X, RefreshCw, Wifi, Volume2, RotateCcw } from "lucide-react";
import { SebaSymbol } from "@/components/SebaSymbol";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useI18n, type TranslationKey } from "@/contexts/I18nContext";

/** Must match CURRENT_WHATS_NEW_VERSION in server/routers/whatsNew.ts */
const CURRENT_VERSION = "2025-04-11";
const STORAGE_KEY = `seba_whats_new_dismissed_${CURRENT_VERSION}`;

interface FeatureItem {
  icon: React.ElementType;
  color: string;
  bg: string;
  titleKey: TranslationKey;
  descKey: TranslationKey;
}

const FEATURES: FeatureItem[] = [
  {
    icon: RefreshCw,
    color: "text-blue-400",
    bg: "bg-blue-400/10",
    titleKey: "wn_retry_title",
    descKey: "wn_retry_desc",
  },
  {
    icon: Wifi,
    color: "text-amber-400",
    bg: "bg-amber-400/10",
    titleKey: "wn_offline_title",
    descKey: "wn_offline_desc",
  },
  {
    icon: Volume2,
    color: "text-purple-400",
    bg: "bg-purple-400/10",
    titleKey: "wn_voice_title",
    descKey: "wn_voice_desc",
  },
  {
    icon: RotateCcw,
    color: "text-green-400",
    bg: "bg-green-400/10",
    titleKey: "wn_voice_reset_title",
    descKey: "wn_voice_reset_desc",
  },
];

export default function WhatsNewBanner() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // Server-side dismissal check for logged-in users
  const { data: serverStatus, isLoading } = trpc.whatsNew.isDismissed.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: Infinity,
  });

  const dismissMutation = trpc.whatsNew.dismiss.useMutation();

  // Determine visibility once we have all the data we need
  useEffect(() => {
    if (isLoading) return;

    const localDismissed = localStorage.getItem(STORAGE_KEY) === "1";
    if (localDismissed) { setVisible(false); return; }

    if (user) {
      // For logged-in users, respect the server-side flag
      if (serverStatus?.dismissed) { setVisible(false); return; }
    }

    setVisible(true);
  }, [isLoading, user, serverStatus]);

  const dismiss = () => {
    // Always persist locally so guests and offline users are covered
    localStorage.setItem(STORAGE_KEY, "1");
    setVisible(false);

    // Also persist server-side for logged-in users (cross-device)
    if (user) {
      dismissMutation.mutate({ version: CURRENT_VERSION });
    }
  };

  if (!visible || isLoading) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[60] bg-[#0f172a]/97 border-t border-white/10 shadow-2xl backdrop-blur-md"
      role="status"
      aria-live="polite"
    >
      <div className="max-w-3xl mx-auto px-4 py-3">
        {/* Header row */}
        <div className="flex items-center gap-2">
          <SebaSymbol className="w-4 h-4 text-primary shrink-0" />
          <span className="text-sm font-semibold text-white flex-1">
            {t("wn_title")}
          </span>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-xs text-white/50 hover:text-white/80 transition-colors mr-2 underline underline-offset-2"
          >
            {expanded ? t("wn_hide") : t("wn_show")}
          </button>
          <button
            onClick={dismiss}
            className="flex items-center justify-center w-7 h-7 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors"
            aria-label={t("wn_dismiss")}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Expanded feature list */}
        {expanded && (
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 pb-1">
            {FEATURES.map(({ icon: Icon, color, bg, titleKey, descKey }) => (
              <div key={titleKey} className="flex gap-3 items-start">
                <div className={`shrink-0 w-8 h-8 rounded-xl ${bg} flex items-center justify-center mt-0.5`}>
                  <Icon className={`w-4 h-4 ${color}`} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white leading-tight">{t(titleKey)}</p>
                  <p className="text-xs text-white/50 mt-0.5 leading-relaxed">{t(descKey)}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Compact "Got it" CTA when collapsed */}
        {!expanded && (
          <p className="text-xs text-white/45 mt-0.5">
            {t("wn_subtitle")}
          </p>
        )}
      </div>
    </div>
  );
}
