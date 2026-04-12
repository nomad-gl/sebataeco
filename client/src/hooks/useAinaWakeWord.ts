/**
 * useAinaWakeWord
 *
 * A self-contained, always-on wake-word listener for Aina.
 * Completely independent of the manual mic button in AIChatBox.
 *
 * State machine:
 *   idle       → wake listener running (continuous), waiting for "Aina"
 *   activating → wake detected, beep played, 300 ms pause before mic handover
 *   recording  → input session open, waiting for teacher's question
 *
 * Reliability improvements (v2):
 * - Fuzzy wake-word matching: also catches "anna", "aina", "ayna", "aina" with
 *   phonetic variants common in speech recognition transcripts.
 * - Shorter backoff on desktop (200 ms base) so the listener restarts quickly
 *   after Chrome's ~60 s silence timeout.
 * - Exposes `isListening` so the UI can show a "mic is active" indicator.
 * - Exposes `requestPermission` so the UI can show a "click to activate"
 *   button when the browser blocks autostart.
 * - Logs recognition errors to console.warn for easier debugging.
 * - Mobile notification fix: exponential backoff on restarts (min 1.5 s, max 8 s).
 */

import { useCallback, useEffect, useRef, useState } from "react";

export type WakeWordState = "idle" | "activating" | "recording";

export type UseAinaWakeWordOptions = {
  /** Called with the final transcript when the teacher finishes speaking */
  onTranscript: (text: string) => void;
  /**
   * App language code ("en" | "es" | "ca").
   * Mapped internally to a full BCP-47 locale for SpeechRecognition.
   */
  lang?: string;
  /** Whether the always-on mode is enabled (default true) */
  enabled?: boolean;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getSR = (): (new () => any) | null =>
  (window as any).SpeechRecognition ||
  (window as any).webkitSpeechRecognition ||
  null;

/** Detect mobile browsers where every SpeechRecognition.start() triggers a system notification */
function isMobileBrowser(): boolean {
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

/**
 * Map app language codes to full BCP-47 locale tags that browsers accept.
 * Passing just "en" or "es" causes silent failures on Chrome/Safari.
 */
function toBCP47(lang: string | undefined): string {
  if (!lang) return "en-US";
  const map: Record<string, string> = {
    en: "en-US",
    es: "es-ES",
    ca: "ca-ES",
  };
  if (lang.includes("-")) return lang;
  return map[lang.toLowerCase()] ?? "en-US";
}

/**
 * Wake-word detection: matches "aina", "klara", and common speech-recognition
 * phonetic variants ("anna", "ayna", "aina", "i-na", "haina", etc.)
 */
function containsWakeWord(transcript: string): boolean {
  const t = transcript.toLowerCase().trim();
  // Primary exact matches
  if (/\b(aina|klara)\b/.test(t)) return true;
  // Phonetic variants that speech engines commonly produce for "Aina"
  if (/\b(ayna|aina|anna|haina|ina|i na|ay na|ay-na)\b/.test(t)) return true;
  // Partial match at start of utterance (e.g. "aina can you...")
  if (/^(aina|ayna|anna|haina)/.test(t)) return true;
  return false;
}

/** Play a soft low-pitched tone to signal the recording window closed with no speech */
function playTimeoutTone(): void {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(220, ctx.currentTime);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.4);
    osc.onended = () => ctx.close();
  } catch {
    // audio not available — continue silently
  }
}

/** Play a short confirmation beep via Web Audio API */
function playBeep(): Promise<void> {
  return new Promise((resolve) => {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.25);
      osc.onended = () => {
        ctx.close();
        resolve();
      };
    } catch {
      resolve();
    }
  });
}

export function useAinaWakeWord({
  onTranscript,
  lang,
  enabled = true,
}: UseAinaWakeWordOptions) {
  const [wakeState, setWakeState] = useState<WakeWordState>("idle");
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wakeRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const inputRef = useRef<any>(null);
  const enabledRef = useRef(enabled);
  const onTranscriptRef = useRef(onTranscript);
  const wakeStateRef = useRef<WakeWordState>("idle");
  const langRef = useRef(lang);

  // Backoff state — shorter on desktop, longer on mobile to avoid OS notification spam
  const backoffMsRef = useRef<number>(isMobileBrowser() ? 1500 : 200);
  const sessionStartTimeRef = useRef<number>(0);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // scheduleWakeListener stored as a ref so all callbacks always call the
  // current version — prevents the stale-closure "second question" bug.
  const scheduleWakeListenerRef = useRef<() => void>(() => {});

  // Keep refs in sync with latest prop values
  useEffect(() => { enabledRef.current = enabled; }, [enabled]);
  useEffect(() => { onTranscriptRef.current = onTranscript; }, [onTranscript]);
  useEffect(() => { langRef.current = lang; }, [lang]);

  const updateState = useCallback((s: WakeWordState) => {
    wakeStateRef.current = s;
    setWakeState(s);
  }, []);

  // ─── Stop all recognition sessions ──────────────────────────────────────────

  const stopAll = useCallback(() => {
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    if (wakeRef.current) {
      try { wakeRef.current.abort(); } catch { /* ignore */ }
      wakeRef.current = null;
    }
    if (inputRef.current) {
      try { inputRef.current.abort(); } catch { /* ignore */ }
      inputRef.current = null;
    }
    setIsListening(false);
  }, []);

  // ─── Input recording session ─────────────────────────────────────────────────

  const startInputSession = useCallback(() => {
    const SR = getSR();
    if (!SR) return;

    updateState("recording");
    setIsListening(true);

    const rec = new SR();
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = toBCP47(langRef.current);
    inputRef.current = rec;

    let finalTranscript = "";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      finalTranscript = Array.from(e.results as any[])
        .map((r: any) => r[0].transcript as string)
        .join("");
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onerror = (e: any) => {
      console.warn("[Aina] Input session error:", e.error);
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        setPermissionError("Microphone access denied. Please allow microphone access in your browser settings.");
      }
      inputRef.current = null;
      setIsListening(false);
      updateState("idle");
      if (enabledRef.current) scheduleWakeListenerRef.current();
    };

    rec.onend = () => {
      inputRef.current = null;
      setIsListening(false);
      if (finalTranscript.trim()) {
        onTranscriptRef.current(finalTranscript.trim());
        // Reset backoff after a successful transcript — session was productive
        backoffMsRef.current = isMobileBrowser() ? 1500 : 200;
      } else {
        playTimeoutTone();
      }
      updateState("idle");
      if (enabledRef.current) scheduleWakeListenerRef.current();
    };

    try {
      rec.start();
    } catch (err) {
      console.warn("[Aina] Input session start failed:", err);
      inputRef.current = null;
      setIsListening(false);
      updateState("idle");
      if (enabledRef.current) scheduleWakeListenerRef.current();
    }
  }, [updateState]);

  // ─── Wake-word listener ──────────────────────────────────────────────────────

  const startWakeListener = useCallback(() => {
    const SR = getSR();
    if (!SR || !enabledRef.current) return;
    if (wakeStateRef.current !== "idle") return;
    if (wakeRef.current) return;
    // Don't start while the page is hidden (mobile background tab)
    if (document.visibilityState === "hidden") return;

    sessionStartTimeRef.current = Date.now();

    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    // Use the app language for wake detection; fall back to ca-ES (Catalan)
    rec.lang = toBCP47(langRef.current ?? "ca");
    wakeRef.current = rec;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => {
      if (wakeStateRef.current !== "idle") return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const transcript = Array.from(e.results as any[])
        .map((r: any) => r[0].transcript as string)
        .join(" ");

      if (containsWakeWord(transcript)) {
        console.log("[Aina] Wake word detected in:", transcript);
        updateState("activating");
        try { rec.abort(); } catch { /* ignore */ }
        wakeRef.current = null;
        setIsListening(false);
        // Reset backoff — wake word was detected, session was productive
        backoffMsRef.current = isMobileBrowser() ? 1500 : 200;
        playBeep().then(() => {
          setTimeout(() => {
            if (enabledRef.current) startInputSession();
          }, 300);
        });
      }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onerror = (e: any) => {
      console.warn("[Aina] Wake listener error:", e.error);
      wakeRef.current = null;
      setIsListening(false);
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        setPermissionError("Microphone access denied. Please allow microphone access in your browser settings.");
        return;
      }
      if (enabledRef.current && wakeStateRef.current === "idle") {
        // Increase backoff on error (network, aborted, etc.)
        if (isMobileBrowser()) {
          backoffMsRef.current = Math.min(backoffMsRef.current * 1.5, 8000);
        }
        scheduleWakeListenerRef.current();
      }
    };

    rec.onend = () => {
      wakeRef.current = null;
      setIsListening(false);
      if (enabledRef.current && wakeStateRef.current === "idle") {
        // If the session ended very quickly (< 2 s) it was likely an OS timeout
        // on mobile — apply backoff to avoid hammering the mic notification.
        const sessionDuration = Date.now() - sessionStartTimeRef.current;
        if (isMobileBrowser() && sessionDuration < 2000) {
          backoffMsRef.current = Math.min(backoffMsRef.current * 1.5, 8000);
        } else if (sessionDuration > 5000) {
          // Long session — reset backoff, things are working well
          backoffMsRef.current = isMobileBrowser() ? 1500 : 200;
        }
        scheduleWakeListenerRef.current();
      }
    };

    try {
      rec.start();
      setIsListening(true);
      console.log("[Aina] Wake listener started, lang:", rec.lang);
    } catch (err) {
      console.warn("[Aina] Wake listener start failed:", err);
      wakeRef.current = null;
      setIsListening(false);
      if (enabledRef.current && wakeStateRef.current === "idle") {
        scheduleWakeListenerRef.current();
      }
    }
  }, [startInputSession, updateState]);

  // Keep scheduleWakeListenerRef current
  useEffect(() => {
    scheduleWakeListenerRef.current = () => {
      if (restartTimerRef.current) {
        clearTimeout(restartTimerRef.current);
      }
      restartTimerRef.current = setTimeout(() => {
        restartTimerRef.current = null;
        if (enabledRef.current && wakeStateRef.current === "idle") {
          startWakeListener();
        }
      }, backoffMsRef.current);
    };
  }, [startWakeListener]);

  // ─── Pause when page is hidden (mobile background) ───────────────────────────

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        // Stop the wake listener when the tab goes to background
        if (wakeRef.current) {
          try { wakeRef.current.abort(); } catch { /* ignore */ }
          wakeRef.current = null;
        }
        if (restartTimerRef.current) {
          clearTimeout(restartTimerRef.current);
          restartTimerRef.current = null;
        }
        setIsListening(false);
      } else if (document.visibilityState === "visible" && enabledRef.current && wakeStateRef.current === "idle") {
        // Resume when the tab comes back to foreground — with a short delay
        restartTimerRef.current = setTimeout(() => {
          restartTimerRef.current = null;
          if (enabledRef.current && wakeStateRef.current === "idle") {
            startWakeListener();
          }
        }, 500);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [startWakeListener]);

  // ─── Lifecycle: start/stop based on enabled prop ─────────────────────────────

  useEffect(() => {
    if (enabled) {
      updateState("idle");
      // Small delay to allow the component to mount before starting
      const t = setTimeout(() => startWakeListener(), 300);
      return () => {
        clearTimeout(t);
        stopAll();
      };
    } else {
      stopAll();
      updateState("idle");
      return () => {
        stopAll();
      };
    }
  }, [enabled, startWakeListener, stopAll, updateState]);

  /**
   * Call this from a user-gesture handler (e.g. button click) to explicitly
   * request microphone permission and start the wake listener.
   * Useful when the browser blocks autostart without a user gesture.
   */
  const requestPermission = useCallback(async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      setPermissionError(null);
      // Stop any existing session and restart cleanly
      stopAll();
      updateState("idle");
      setTimeout(() => startWakeListener(), 100);
    } catch {
      setPermissionError("Microphone access denied. Please allow microphone access in your browser settings.");
    }
  }, [startWakeListener, stopAll, updateState]);

  return { wakeState, permissionError, isListening, requestPermission };
}
