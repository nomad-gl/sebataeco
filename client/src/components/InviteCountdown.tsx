/**
 * InviteCountdown — live relative-time badge for a pending teacher invite.
 *
 * Shows "Expires in X h Y m" for pending invites, ticking every 60 s.
 * Colour thresholds:
 *   > 6 h  → amber (same as the existing pending badge)
 *   ≤ 6 h  → orange
 *   ≤ 1 h  → red
 */
import { Badge } from "@/components/ui/badge";
import { TranslationKey, useI18n } from "@/contexts/I18nContext";
import { useEffect, useState } from "react";

interface InviteCountdownProps {
  expiresAt: Date;
}

function formatCountdown(msLeft: number, t: (k: TranslationKey) => string): string {
  if (msLeft <= 0) return t("inv_countdown_expired");
  const totalMinutes = Math.floor(msLeft / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const remH = hours % 24;
    return t("inv_countdown_days")
      .replace("{d}", String(days))
      .replace("{h}", String(remH));
  }
  if (hours > 0) {
    return t("inv_countdown_hours")
      .replace("{h}", String(hours))
      .replace("{m}", String(minutes));
  }
  return t("inv_countdown_minutes").replace("{m}", String(minutes));
}

export function InviteCountdown({ expiresAt }: InviteCountdownProps) {
  const { t } = useI18n();
  const [msLeft, setMsLeft] = useState(() => expiresAt.getTime() - Date.now());

  useEffect(() => {
    // Recalculate immediately when expiresAt changes
    setMsLeft(expiresAt.getTime() - Date.now());

    const id = setInterval(() => {
      setMsLeft(expiresAt.getTime() - Date.now());
    }, 60_000);
    return () => clearInterval(id);
  }, [expiresAt]);

  const label = formatCountdown(msLeft, t);

  // Colour thresholds
  const ONE_HOUR_MS = 60 * 60 * 1000;
  const SIX_HOURS_MS = 6 * ONE_HOUR_MS;

  let className = "text-xs text-amber-600 border-amber-600"; // > 6 h
  if (msLeft <= 0) {
    className = "text-xs text-destructive border-destructive";
  } else if (msLeft <= ONE_HOUR_MS) {
    className = "text-xs text-red-600 border-red-600";
  } else if (msLeft <= SIX_HOURS_MS) {
    className = "text-xs text-orange-600 border-orange-600";
  }

  return (
    <Badge variant="outline" className={className} title={expiresAt.toLocaleString()}>
      {label}
    </Badge>
  );
}
