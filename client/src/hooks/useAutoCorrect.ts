import { useState, useRef, useCallback, useEffect } from "react";
import { useI18n } from "@/contexts/I18nContext";
import { trpc } from "@/lib/trpc";

/**
 * useAutoCorrect — Real-time spelling/grammar auto-correction hook.
 *
 * Uses a debounced LLM call (via the server autoCorrect.correct mutation)
 * to correct text as the user types. Respects the current UI language
 * (EN/ES/CA) for language-aware correction.
 *
 * Features:
 * - Debounced correction (waits for user to pause typing)
 * - Language-aware (corrects in the active language)
 * - Shows visual indicator when correction is pending
 * - Allows undo of corrections
 * - Skips correction for very short text or text that hasn't changed
 */

type AutoCorrectOptions = {
  /** Debounce delay in ms before triggering correction (default: 1200ms) */
  debounceMs?: number;
  /** Minimum text length to trigger correction (default: 10 chars) */
  minLength?: number;
  /** Whether auto-correct is enabled by default (default: true) */
  enabled?: boolean;
  /** Maximum text length to correct (default: 500 chars) */
  maxLength?: number;
};

type AutoCorrectState = {
  /** Whether a correction is currently pending/in-flight */
  isPending: boolean;
  /** The last correction that was applied (for undo) */
  lastCorrection: { original: string; corrected: string } | null;
  /** Whether auto-correct is enabled */
  isEnabled: boolean;
};

type AutoCorrectReturn = {
  /** Current state of the auto-correct system */
  state: AutoCorrectState;
  /** Call this on every input change — returns corrected text via callback */
  handleChange: (text: string, onCorrected?: (corrected: string) => void) => void;
  /** Undo the last correction (call the callback with original text) */
  undoLastCorrection: () => string | null;
  /** Toggle auto-correct on/off */
  toggleEnabled: () => void;
  /** Force a correction now (bypasses debounce) */
  correctNow: (text: string, onCorrected?: (corrected: string) => void) => void;
};

const AUTOCORRECT_ENABLED_KEY = "seba_autocorrect_enabled";

export function useAutoCorrect(options: AutoCorrectOptions = {}): AutoCorrectReturn {
  const {
    debounceMs = 1200,
    minLength = 10,
    enabled: initialEnabled = true,
    maxLength = 500,
  } = options;

  const { lang } = useI18n();

  const [isEnabled, setIsEnabled] = useState<boolean>(() => {
    const stored = localStorage.getItem(AUTOCORRECT_ENABLED_KEY);
    return stored !== null ? stored === "true" : initialEnabled;
  });
  const [isPending, setIsPending] = useState(false);
  const [lastCorrection, setLastCorrection] = useState<{ original: string; corrected: string } | null>(null);

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCorrectedRef = useRef<string>("");
  const callbackRef = useRef<((corrected: string) => void) | undefined>();
  const currentTextRef = useRef<string>("");

  // Use trpc mutation
  const correctMutation = trpc.autoCorrect.correct.useMutation();

  // Persist enabled state
  useEffect(() => {
    localStorage.setItem(AUTOCORRECT_ENABLED_KEY, String(isEnabled));
  }, [isEnabled]);

  const performCorrection = useCallback(async (text: string, onCorrected?: (corrected: string) => void) => {
    if (!text || text.trim().length < minLength || text.length > maxLength) return;
    // Don't re-correct text we already corrected
    if (text === lastCorrectedRef.current) return;

    setIsPending(true);

    try {
      const result = await correctMutation.mutateAsync({
        text,
        language: lang as "en" | "es" | "ca",
      });

      if (result.changed && result.corrected && result.corrected !== text) {
        // Only apply if the current text hasn't changed since we started
        if (currentTextRef.current === text) {
          lastCorrectedRef.current = result.corrected;
          setLastCorrection({ original: text, corrected: result.corrected });
          onCorrected?.(result.corrected);
          callbackRef.current = onCorrected;
        }
      }
    } catch (err: any) {
      // Silently fail — auto-correct is non-critical
      if (err.name !== "AbortError") {
        console.warn("[AutoCorrect] correction failed:", err.message);
      }
    } finally {
      setIsPending(false);
    }
  }, [lang, minLength, maxLength, correctMutation]);

  const handleChange = useCallback((text: string, onCorrected?: (corrected: string) => void) => {
    currentTextRef.current = text;

    if (!isEnabled) return;

    // Clear previous debounce
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    // Set new debounce — only correct after user pauses typing
    debounceTimer.current = setTimeout(() => {
      performCorrection(text, onCorrected);
    }, debounceMs);
  }, [isEnabled, debounceMs, performCorrection]);

  const undoLastCorrection = useCallback((): string | null => {
    if (lastCorrection) {
      const original = lastCorrection.original;
      lastCorrectedRef.current = "";
      setLastCorrection(null);
      return original;
    }
    return null;
  }, [lastCorrection]);

  const toggleEnabled = useCallback(() => {
    setIsEnabled(prev => !prev);
  }, []);

  const correctNow = useCallback((text: string, onCorrected?: (corrected: string) => void) => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    currentTextRef.current = text;
    performCorrection(text, onCorrected);
  }, [performCorrection]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, []);

  return {
    state: {
      isPending,
      lastCorrection,
      isEnabled,
    },
    handleChange,
    undoLastCorrection,
    toggleEnabled,
    correctNow,
  };
}
