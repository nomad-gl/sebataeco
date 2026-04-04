/**
 * useClaraWakeWord
 *
 * A self-contained wake-word listener for Clara.
 *
 * DESKTOP behaviour (non-mobile):
 *   Always-on continuous SpeechRecognition session listens for "Clara".
 *   When detected it plays a beep and opens a short recording window.
 *
 * MOBILE behaviour (iOS Safari, Chrome for Android, etc.):
 *   The always-on listener is DISABLED on mobile because every call to
 *   SpeechRecognition.start() triggers the OS "site is using your microphone"
 *   notification banner regardless of backoff. Instead, mobile users tap the
 *   mic button (exposed via the `mobileTapToRecord` callback) to start a single
 *   recording session. No background mic usage, no notification spam.
 *
 * State machine (desktop):
 *   idle       → wake listener running (continuous), waiting for "Clara"
 *   activating → wake detected, beep played, 300 ms pause before mic handover
 *   recording  → input session open, waiting for teacher's question
 *
 * State machine (mobile):
 *   idle       → no mic activity
 *   recording  → user tapped mic, single SpeechRecognition session open
 */

import { useCallback, useEffect, useRef, useState } from "react";

export type WakeWordState = "idle" | "activating" | "recording";

export type UseClaraWakeWordOptions = {
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

/** Detect mobile browsers — on these we NEVER run the always-on listener */
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

export function useClaraWakeWord({
  onTranscript,
  lang,
  enabled = true,
}: UseClaraWakeWordOptions) {
  const [wakeState, setWakeState] = useState<WakeWordState>("idle");
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const isMobile = isMobileBrowser();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wakeRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const inputRef = useRef<any>(null);
  const enabledRef = useRef(enabled);
  const onTranscriptRef = useRef(onTranscript);
  const wakeStateRef = useRef<WakeWordState>("idle");
  const langRef = useRef(lang);

  // Desktop-only backoff state
  const backoffMsRef = useRef<number>(400);
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
  }, []);

  // ─── Input recording session (shared by desktop wake-word and mobile tap) ───

  const startInputSession = useCallback(() => {
    const SR = getSR();
    if (!SR) return;

    updateState("recording");

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
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        setPermissionError("Microphone access denied. Please allow microphone access in your browser settings.");
      }
      inputRef.current = null;
      updateState("idle");
      // Desktop only: restart wake listener after input error
      if (!isMobile && enabledRef.current) scheduleWakeListenerRef.current();
    };

    rec.onend = () => {
      inputRef.current = null;
      if (finalTranscript.trim()) {
        onTranscriptRef.current(finalTranscript.trim());
      } else {
        playTimeoutTone();
      }
      updateState("idle");
      // Desktop only: restart wake listener after input ends
      if (!isMobile && enabledRef.current) scheduleWakeListenerRef.current();
    };

    try {
      rec.start();
    } catch {
      inputRef.current = null;
      updateState("idle");
      if (!isMobile && enabledRef.current) scheduleWakeListenerRef.current();
    }
  }, [isMobile, updateState]);

  // ─── Mobile: tap-to-record (single session, no background listener) ─────────

  const mobileTapToRecord = useCallback(() => {
    if (!isMobile) return;
    if (wakeStateRef.current === "recording") {
      // Second tap cancels the active session
      if (inputRef.current) {
        try { inputRef.current.abort(); } catch { /* ignore */ }
        inputRef.current = null;
      }
      updateState("idle");
      return;
    }
    if (wakeStateRef.current !== "idle") return;
    startInputSession();
  }, [isMobile, startInputSession, updateState]);

  // ─── Desktop: wake-word listener ────────────────────────────────────────────

  const startWakeListener = useCallback(() => {
    // Never run always-on listener on mobile
    if (isMobile) return;

    const SR = getSR();
    if (!SR || !enabledRef.current) return;
    if (wakeStateRef.current !== "idle") return;
    if (wakeRef.current) return;
    if (document.visibilityState === "hidden") return;

    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = toBCP47(langRef.current);
    wakeRef.current = rec;

    const sessionStart = Date.now();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => {
      if (wakeStateRef.current !== "idle") return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const transcript = Array.from(e.results as any[])
        .map((r: any) => r[0].transcript as string)
        .join(" ")
        .toLowerCase();

      if (/\b(clara|klara)\b/.test(transcript)) {
        updateState("activating");
        try { rec.abort(); } catch { /* ignore */ }
        wakeRef.current = null;
        backoffMsRef.current = 400; // reset backoff after successful detection
        playBeep().then(() => {
          setTimeout(() => {
            if (enabledRef.current) startInputSession();
          }, 300);
        });
      }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onerror = (e: any) => {
      wakeRef.current = null;
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        setPermissionError("Microphone access denied. Please allow microphone access in your browser settings.");
        return;
      }
      if (enabledRef.current && wakeStateRef.current === "idle") {
        backoffMsRef.current = Math.min(backoffMsRef.current * 1.5, 8000);
        scheduleWakeListenerRef.current();
      }
    };

    rec.onend = () => {
      wakeRef.current = null;
      if (enabledRef.current && wakeStateRef.current === "idle") {
        const duration = Date.now() - sessionStart;
        if (duration < 2000) {
          backoffMsRef.current = Math.min(backoffMsRef.current * 1.5, 8000);
        } else if (duration > 5000) {
          backoffMsRef.current = 400;
        }
        scheduleWakeListenerRef.current();
      }
    };

    try {
      rec.start();
    } catch {
      wakeRef.current = null;
      if (enabledRef.current && wakeStateRef.current === "idle") {
        scheduleWakeListenerRef.current();
      }
    }
  }, [isMobile, startInputSession, updateState]);

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

  // ─── Desktop: pause when page is hidden ─────────────────────────────────────

  useEffect(() => {
    if (isMobile) return; // mobile has no background listener to pause

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        if (wakeRef.current) {
          try { wakeRef.current.abort(); } catch { /* ignore */ }
          wakeRef.current = null;
        }
        if (restartTimerRef.current) {
          clearTimeout(restartTimerRef.current);
          restartTimerRef.current = null;
        }
      } else if (document.visibilityState === "visible" && enabledRef.current && wakeStateRef.current === "idle") {
        restartTimerRef.current = setTimeout(() => {
          restartTimerRef.current = null;
          if (enabledRef.current && wakeStateRef.current === "idle") {
            startWakeListener();
          }
        }, 800);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [isMobile, startWakeListener]);

  // ─── Lifecycle: start/stop based on enabled prop (desktop only) ─────────────

  useEffect(() => {
    if (isMobile) return; // mobile never auto-starts

    if (enabled) {
      updateState("idle");
      const t = setTimeout(() => startWakeListener(), 200);
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
  }, [isMobile, enabled, startWakeListener, stopAll, updateState]);

  // ─── Mobile cleanup on unmount ───────────────────────────────────────────────

  useEffect(() => {
    if (!isMobile) return;
    return () => stopAll();
  }, [isMobile, stopAll]);

  return {
    wakeState,
    permissionError,
    /** Mobile only: call this when the user taps the mic button */
    mobileTapToRecord,
    /** True when running on a mobile device (always-on listener disabled) */
    isMobile,
  };
}
