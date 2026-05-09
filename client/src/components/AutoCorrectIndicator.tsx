import { useI18n } from "@/contexts/I18nContext";

type Props = {
  isPending: boolean;
  lastCorrection: { original: string; corrected: string } | null;
  isEnabled: boolean;
  onUndo: () => void;
  onToggle: () => void;
};

/**
 * AutoCorrectIndicator — Shows auto-correct status and undo option.
 * Displays a small inline indicator below text inputs.
 */
export function AutoCorrectIndicator({ isPending, lastCorrection, isEnabled, onUndo, onToggle }: Props) {
  const { t } = useI18n();

  if (!isEnabled) {
    return (
      <button
        type="button"
        onClick={onToggle}
        className="text-[10px] text-white/30 hover:text-white/50 transition-colors px-1"
        title={t("autocorrect_enable")}
      >
        Abc ✗
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 min-h-[16px]">
      {isPending && (
        <span className="text-[10px] text-amber-300/70 flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-full bg-amber-300/70 animate-pulse" />
          {t("autocorrect_checking")}
        </span>
      )}

      {!isPending && lastCorrection && (
        <button
          type="button"
          onClick={onUndo}
          className="text-[10px] text-emerald-300/70 hover:text-emerald-300 transition-colors flex items-center gap-1"
          title={t("autocorrect_undo_title")}
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a5 5 0 015 5v2M3 10l4-4M3 10l4 4" />
          </svg>
          {t("autocorrect_undo")}
        </button>
      )}

      <button
        type="button"
        onClick={onToggle}
        className="text-[10px] text-white/30 hover:text-white/50 transition-colors ml-auto"
        title={t("autocorrect_disable")}
      >
        Abc ✓
      </button>
    </div>
  );
}
