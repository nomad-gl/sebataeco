/**
 * useClaraWakeWord
 *
 * A self-contained, always-on wake-word listener for Clara.
 * Completely independent of the manual mic button in AIChatBox.
 *
 * State machine:
 *   idle       → wake listener running (continuous), waiting for "Clara"
 *   activating → wake detected, beep played, 500 ms pause before mic handover
 *   recording  → input session open, waiting for teacher's question
 *
 * When the teacher finishes speaking, the transcript is passed to onTranscript
 * and the hook returns to idle automatically.
 */

import { useCallback, useEffect, useRef, useState } from "react";

export type WakeWordState = "idle" | "activating" | "recording";

export type UseClaraWakeWordOptions = {
  /** Called with the final transcript when the teacher finishes speaking */
  onTranscript: (text: string) => void;
  /** Language tag for SpeechRecognition (defaults to page lang or navigator.language) */
  lang?: string;
  /** Whether the always-on mode is enabled (default true) */
  enabled?: boolean;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getSR = (): (new () => any) | null =>
  (window as any).SpeechRecognition ||
  (window as any).webkitSpeechRecognition ||
  null;

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
      resolve(); // audio not available — continue silently
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

  // Refs so callbacks always see current values without re-creating effects
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wakeRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const inputRef = useRef<any>(null);
  const enabledRef = useRef(enabled);
  const onTranscriptRef = useRef(onTranscript);
  const wakeStateRef = useRef<WakeWordState>("idle");
  const langRef = useRef(lang);

  // scheduleWakeListener stored as a ref so all callbacks always call the
  // current version — this is the key fix for the "second question" bug.
  const scheduleWakeListenerRef = useRef<() => void>(() => {});

  // Keep refs in sync
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
    rec.lang = langRef.current || document.documentElement.lang || navigator.language || "en";
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
      // Send transcript if we have one
      if (finalTranscript.trim()) {
        onTranscriptRef.current(finalTranscript.trim());
      }
      updateState("idle");
      // Restart wake listener — use ref so we always call the current version
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
    if (wakeStateRef.current !== "idle") return; // don't start if already active
    if (wakeRef.current) return; // already running

    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = langRef.current || document.documentElement.lang || navigator.language || "en";
    wakeRef.current = rec;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => {
      if (wakeStateRef.current !== "idle") return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const transcript = Array.from(e.results as any[])
        .map((r: any) => r[0].transcript as string)
        .join(" ")
        .toLowerCase();

      if (/\bclara\b/.test(transcript)) {
        // Wake word detected
        updateState("activating");
        // Stop the wake listener
        try { rec.abort(); } catch { /* ignore */ }
        wakeRef.current = null;
        // Play beep then hand over to input session after mic release delay
        playBeep().then(() => {
          setTimeout(() => {
            if (enabledRef.current) startInputSession();
          }, 500);
        });
      }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onerror = (e: any) => {
      wakeRef.current = null;
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        setPermissionError("Microphone access denied. Please allow microphone access in your browser settings.");
        return; // don't retry on permission error
      }
      // For other errors (network, aborted), retry after a pause
      if (enabledRef.current && wakeStateRef.current === "idle") {
        scheduleWakeListenerRef.current();
      }
    };

    rec.onend = () => {
      wakeRef.current = null;
      // Only auto-restart if still in idle state (not activating/recording)
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

  // Store scheduleWakeListener in a ref so it is always the current version
  // This is the fix: all callbacks call scheduleWakeListenerRef.current()
  // instead of a captured closure, so the second (and subsequent) questions work.
  useEffect(() => {
    scheduleWakeListenerRef.current = () => {
      // Use a slightly longer delay (600 ms) to let the React render cycle
      // settle after onTranscript triggers setMessages in the parent component.
      setTimeout(() => {
        if (enabledRef.current && wakeStateRef.current === "idle") {
          startWakeListener();
        }
      }, 600);
    };
  }, [startWakeListener]);

  // ─── Lifecycle: start/stop based on enabled prop ─────────────────────────────

  useEffect(() => {
    if (enabled) {
      updateState("idle");
      // Small delay on initial start to let the component fully mount
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
