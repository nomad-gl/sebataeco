/**
 * SovereigntyWarning
 *
 * Displays an amber inline banner when the user enters an email address
 * from a known consumer/non-institutional domain (Gmail, Outlook, Yahoo, etc.).
 *
 * Usage:
 *   <SovereigntyWarning email={loginEmail} />
 *
 * The warning is purely informational — it does NOT block form submission.
 * The user can acknowledge it and continue. For hard blocking, use the
 * server-side guard in localAuth.ts.
 */

import { AlertTriangle, ShieldAlert, X } from "lucide-react";
import { useI18n } from "@/contexts/I18nContext";
import { useState, useEffect } from "react";

// ── Blocked consumer domains ──────────────────────────────────────────────────
// This list covers the most common personal email providers. It is intentionally
// conservative — only well-known consumer services are listed. Institutional
// domains (e.g. @edu.gva.es, @xtec.cat) are never in this list.
const CONSUMER_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "outlook.es",
  "outlook.cat",
  "hotmail.com",
  "hotmail.es",
  "hotmail.co.uk",
  "live.com",
  "live.es",
  "msn.com",
  "yahoo.com",
  "yahoo.es",
  "yahoo.co.uk",
  "ymail.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "protonmail.com",
  "proton.me",
  "tutanota.com",
  "tutanota.de",
  "tuta.io",
  "zoho.com",
  "aol.com",
  "aim.com",
  "gmx.com",
  "gmx.de",
  "gmx.es",
  "web.de",
  "mail.com",
  "inbox.com",
  "fastmail.com",
  "fastmail.fm",
  "hey.com",
  "pm.me",
]);

/**
 * Returns true if the email address belongs to a known consumer domain.
 */
export function isConsumerEmail(email: string): boolean {
  const parts = email.trim().toLowerCase().split("@");
  if (parts.length !== 2) return false;
  const domain = parts[1];
  return CONSUMER_DOMAINS.has(domain);
}

// ── Component ─────────────────────────────────────────────────────────────────

interface SovereigntyWarningProps {
  /** The email address currently entered by the user */
  email: string;
  /** Optional: whether the email field is locked (pre-filled from invite) */
  locked?: boolean;
}

export default function SovereigntyWarning({ email, locked }: SovereigntyWarningProps) {
  const { t, lang } = useI18n();
  const [dismissed, setDismissed] = useState(false);

  // Reset dismissed state when the email changes to a new consumer address
  useEffect(() => {
    setDismissed(false);
  }, [email]);

  if (!isConsumerEmail(email) || dismissed) return null;

  return (
    <div
      role="alert"
      className="rounded-lg border border-amber-500/40 bg-amber-500/15 backdrop-blur-sm px-4 py-3 text-sm text-amber-200 space-y-2 relative"
    >
      {/* Dismiss button */}
      {!locked && (
        <button
          type="button"
          aria-label="Dismiss warning"
          className="absolute top-2 right-2 text-amber-300/60 hover:text-amber-200 transition-colors"
          onClick={() => setDismissed(true)}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}

      {/* Header */}
      <div className="flex items-start gap-2 pr-5">
        <ShieldAlert className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
        <p className="font-semibold text-amber-100">{t("sovereignty_warning_title")}</p>
      </div>

      {/* Body */}
      <p className="text-amber-200/90 leading-relaxed pl-6">
        {t("sovereignty_warning_body")}
      </p>

      {/* Suggestion */}
      <div className="flex items-start gap-2 pl-6">
        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
        <p className="text-amber-100 font-medium">{t("sovereignty_warning_suggestion")}</p>
      </div>

      {/* Contact */}
      <p className="text-amber-300/70 text-xs pl-6">
        {lang === "ca" ? t("sovereignty_warning_contact_ca") : t("sovereignty_warning_contact_en")}
      </p>
    </div>
  );
}
