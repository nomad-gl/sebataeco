/**
 * FirstLoginDialectAutoSet
 *
 * Invisible root-mounted component that auto-detects and saves the user's
 * TTS dialect on their first login, based on their school's geographic location.
 *
 * Uses a localStorage flag to ensure it only runs once per user.
 * After detection, it updates localStorage so AIChatBox picks up the dialect immediately.
 */
import { useEffect, useRef } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";

const DIALECT_STORAGE_KEY = "seba_aina_accent";
const FIRST_LOGIN_DIALECT_SET_KEY = "seba_dialect_first_login_set";

export default function FirstLoginDialectAutoSet() {
  const { user, isAuthenticated } = useAuth();
  const hasRun = useRef(false);

  const utils = trpc.useUtils();

  const autoDetectMutation = trpc.auth.autoDetectDialect.useQuery(
    { save: false },
    {
      enabled: false, // We'll manually refetch
    }
  );

  useEffect(() => {
    if (!isAuthenticated || !user || hasRun.current) return;

    // Check if we've already done first-login dialect set for this user
    const alreadySet = localStorage.getItem(
      `${FIRST_LOGIN_DIALECT_SET_KEY}_${user.id}`
    );
    if (alreadySet) return;

    hasRun.current = true;

    // Call autoDetectDialect with save=true via a direct fetch
    // We use the utils to call the procedure
    utils.auth.autoDetectDialect
      .fetch({ save: true })
      .then((result) => {
        if (result && result.source !== "default") {
          // Map dialect code to internal name for localStorage
          const dialectName =
            result.detected === "ca-nw"
              ? "nord-occidental"
              : result.detected === "ca-ba"
                ? "balear"
                : result.detected === "ca-va"
                  ? "valencia"
                  : "central";
          localStorage.setItem(DIALECT_STORAGE_KEY, dialectName);
        }
        // Mark as done regardless of result
        localStorage.setItem(
          `${FIRST_LOGIN_DIALECT_SET_KEY}_${user.id}`,
          "true"
        );
      })
      .catch(() => {
        // Silent failure — don't block the user experience
      });
  }, [isAuthenticated, user]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
