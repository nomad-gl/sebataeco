/**
 * PasswordReminderBanner.tsx
 *
 * Persistent top-of-page banner shown to any local user whose
 * mustChangePassword flag is still true (i.e. they are still using
 * the temporary password issued by their director).
 *
 * The banner is dismissible for the current session but will reappear
 * on next login until the password has actually been changed.
 */
import { useState } from "react";
import { ShieldAlert, X, Lock } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Link } from "wouter";

export default function PasswordReminderBanner() {
  const { user, loading } = useAuth();
  const [dismissed, setDismissed] = useState(false);

  // Only show for authenticated local users who still have a temp password
  if (loading || !user) return null;
  if (!(user as any).mustChangePassword) return null;
  if (dismissed) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[199] flex items-center justify-between gap-3 px-4 py-2.5
                 bg-destructive text-destructive-foreground shadow-lg"
      role="alert"
      aria-live="assertive"
    >
      {/* Left: icon + message */}
      <div className="flex items-center gap-2 min-w-0">
        <ShieldAlert className="w-4 h-4 flex-shrink-0 opacity-90" />
        <span className="text-sm font-medium truncate">
          <span className="font-bold">Security risk:</span> your account is using a temporary password — your data is not fully protected.
        </span>
      </div>

      {/* Right: action + dismiss */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <Link
          href="/change-password"
          className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-white/20 hover:bg-white/30
                     text-sm font-semibold transition-colors whitespace-nowrap"
        >
          <Lock className="w-3.5 h-3.5" />
          Set password now
        </Link>
        <button
          onClick={() => setDismissed(true)}
          className="flex items-center justify-center w-7 h-7 rounded-md hover:bg-white/20
                     transition-colors"
          aria-label="Dismiss security reminder"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
