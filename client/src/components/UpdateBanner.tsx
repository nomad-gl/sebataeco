import { RefreshCw, X, Sparkles } from "lucide-react";
import { useAppUpdate } from "@/hooks/useAppUpdate";

export default function UpdateBanner() {
  const { updateAvailable, applyUpdate, dismiss } = useAppUpdate();

  if (!updateAvailable) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[200] flex items-center justify-between gap-3 px-4 py-2.5
                 bg-primary text-primary-foreground shadow-lg"
      role="status"
      aria-live="polite"
    >
      {/* Left: icon + message */}
      <div className="flex items-center gap-2 min-w-0">
        <Sparkles className="w-4 h-4 flex-shrink-0 opacity-90" />
        <span className="text-sm font-medium truncate">
          A new version of SEBA is available
        </span>
      </div>

      {/* Right: refresh + dismiss */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={applyUpdate}
          className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-white/20 hover:bg-white/30
                     text-sm font-semibold transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
        <button
          onClick={dismiss}
          className="flex items-center justify-center w-7 h-7 rounded-md hover:bg-white/20
                     transition-colors"
          aria-label="Dismiss update notification"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
