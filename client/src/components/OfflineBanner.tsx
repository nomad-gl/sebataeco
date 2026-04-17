import { useI18n } from "@/contexts/I18nContext";
import { Wifi, WifiOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/**
 * OfflineBanner
 *
 * Shows a slim amber banner at the top of the page when the browser reports
 * that the network is offline (navigator.onLine === false).  When the
 * connection is restored it briefly shows a green "back online" confirmation
 * before fading out automatically after 2 seconds.
 */
export default function OfflineBanner() {
  const { t } = useI18n();
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [showBack, setShowBack] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handleOffline = () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      setShowBack(false);
      setIsOffline(true);
    };

    const handleOnline = () => {
      setIsOffline(false);
      setShowBack(true);
      hideTimer.current = setTimeout(() => setShowBack(false), 2500);
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  if (!isOffline && !showBack) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={[
        "fixed top-0 left-0 right-0 z-[9999] flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium transition-all duration-300",
        isOffline
          ? "bg-amber-500 text-white"
          : "bg-green-600 text-white",
      ].join(" ")}
    >
      {isOffline ? (
        <>
          <WifiOff className="h-4 w-4 shrink-0" />
          <span>{t("offline_banner_reconnecting")}</span>
        </>
      ) : (
        <>
          <Wifi className="h-4 w-4 shrink-0" />
          <span>{t("offline_banner_back")}</span>
        </>
      )}
    </div>
  );
}
