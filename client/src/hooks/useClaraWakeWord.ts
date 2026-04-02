/**
 * useClaraWakeWord
 *
 * A self-contained, always-on wake-word listener for Clara.
 * Completely independent of the manual mic button in AIChatBox.
 *
 * State machine:
 *   idle       → wake listener running (continuous), waiting for "Clara"
 *   activating → wake detected, beep played, 300 ms pause before mic handover
 *   recording  → input session open, waiting for teacher's question
 *
 * When the teacher finishes speaking, the transcript is passed to onTranscript
 * and the hook returns to idle automatically.
 *
 * Key reliability decisions:
 * - Wake listener uses `continuous: true` with `interimResults: true` so it
 *   never misses a word between utterances.
 * - The speech engine lang is always a full BCP-47 tag (e.g. "en-US", "es-ES",
 *   "ca-ES") — passing just "en" or "es" can cause silent failures on some
 *   browsers.
 * - scheduleWakeListenerRef is a stable ref so callbacks always call the
 *   current version — this prevents the "second question" stale-closure bug.
 * - Delays are kept short (300 ms handover, 400 ms restart) to minimise
 *   perceived latency between saying "Clara" and the mic opening.
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
  // If already a full tag (e.g. "en-US") return as-is
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wakeRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const inputRef = useRef<any>(null);
  const enabledRef = useRef(enabled);
  const onTranscriptRef = useRef(onTranscript);
  const wakeStateRef = useRef<WakeWordState>("idle");
  const langRef = useRef(lang);

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
    if (wakeRef.current) {
      try { wakeRef.current.abort(); } catch { /* ignore */ }
      wakeRef.current = null;
    }
    if (inputRef.current) {
      try { inputRef.current.abort(); } catch { /* ignore */ }
      inputRef.current = null;
    }
  }, []);

  // ─── Input recording session ─────────────────────────────────────────────────

  const startInputSession = useCallback(() => {
    const SR = getSR();
    if (!SR) return;

    updateState("recording");

    const rec = new SR();
    rec.continuous = false;
    rec.interimResults = true;
    // Use full BCP-47 locale — critical for reliable recognition
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
      if (enabledRef.current) scheduleWakeListenerRef.current();
    };

    rec.onend = () => {
      inputRef.current = null;
      if (finalTranscript.trim()) {
        onTranscriptRef.current(finalTranscript.trim());
      } else {
        playTimeoutTone();
      }
      updateState("idle");
      if (enabledRef.current) scheduleWakeListenerRef.current();
    };

    try {
      rec.start();
    } catch {
      inputRef.current = null;
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

    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    // Use full BCP-47 locale — passing just "en" or "es" causes silent failures
    rec.lang = toBCP47(langRef.current);
    wakeRef.current = rec;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => {
      if (wakeStateRef.current !== "idle") return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const transcript = Array.from(e.results as any[])
        .map((r: any) => r[0].transcript as string)
        .join(" ")
        .toLowerCase();

      // Match "clara" in any language context — also catches "klara", "clara"
      if (/\b(clara|klara)\b/.test(transcript)) {
        updateState("activating");
        try { rec.abort(); } catch { /* ignore */ }
        wakeRef.current = null;
        // Reduced handover delay: beep (250 ms) + 300 ms = ~550 ms total
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
        scheduleWakeListenerRef.current();
      }
    };

    rec.onend = () => {
      wakeRef.current = null;
      if (enabledRef.current && wakeStateRef.current === "idle") {
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
  }, [startInputSession, updateState]);

  // Keep scheduleWakeListenerRef current — 400 ms restart delay (was 600 ms)
  // to let React settle after setMessages without excessive dead time.
  useEffect(() => {
    scheduleWakeListenerRef.current = () => {
      setTimeout(() => {
        if (enabledRef.current && wakeStateRef.current === "idle") {
          startWakeListener();
        }
      }, 400);
    };
  }, [startWakeListener]);

  // ─── Lifecycle: start/stop based on enabled prop ─────────────────────────────

  useEffect(() => {
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
  }, [enabled, startWakeListener, stopAll, updateState]);

  return { wakeState, permissionError };
}
