import { useState } from "react";
import { RefreshCw, X } from "lucide-react";
import { SebaSymbol } from "@/components/SebaSymbol";
import { useAppUpdate } from "@/hooks/useAppUpdate";
import WhatsNewModal from "./WhatsNewModal";

export default function UpdateBanner() {
  const { updateAvailable, applyUpdate, dismiss } = useAppUpdate();
  const [showChangelog, setShowChangelog] = useState(false);

  if (!updateAvailable) return null;

  return (
    <>
      <div
        className="fixed top-0 left-0 right-0 z-[200] flex items-center justify-between gap-3 px-4 py-2.5
                   bg-primary text-primary-foreground shadow-lg"
        role="status"
        aria-live="polite"
      >
        {/* Left: icon + message + what's new link */}
        <div className="flex items-center gap-2 min-w-0">
          <SebaSymbol className="w-4 h-4 flex-shrink-0 opacity-90" />
          <span className="text-sm font-medium truncate">
            A new version of AINA is available
          </span>
          <button
            onClick={() => setShowChangelog(true)}
            className="hidden sm:inline text-xs font-semibold underline underline-offset-2 opacity-80 hover:opacity-100 transition-opacity flex-shrink-0"
          >
            See what's new
          </button>
        </div>

        {/* Right: refresh + dismiss */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Mobile: what's new link */}
          <button
            onClick={() => setShowChangelog(true)}
            className="sm:hidden text-xs font-semibold underline underline-offset-2 opacity-80 hover:opacity-100 transition-opacity"
          >
            What's new
          </button>
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

      <WhatsNewModal open={showChangelog} onClose={() => setShowChangelog(false)} />
    </>
  );
}
