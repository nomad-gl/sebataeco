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
  const wakeRef = useRef<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
  const inputRef = useRef<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
  const enabledRef = useRef(enabled);
  const onTranscriptRef = useRef(onTranscript);
  const wakeStateRef = useRef<WakeWordState>("idle");
  const langRef = useRef(lang);

  // Keep refs in sync
  useEffect(() => { enabledRef.current = enabled; }, [enabled]);
  useEffect(() => { onTranscriptRef.current = onTranscript; }, [onTranscript]);
  useEffect(() => { langRef.current = lang; }, [lang]);

  const updateState = (s: WakeWordState) => {
    wakeStateRef.current = s;
    setWakeState(s);
  };

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
      // Return to idle regardless of error
      updateState("idle");
      if (enabledRef.current) scheduleWakeListener();
    };

    rec.onend = () => {
      inputRef.current = null;
      // Send transcript if we have one
      if (finalTranscript.trim()) {
        onTranscriptRef.current(finalTranscript.trim());
      }
      updateState("idle");
      // Restart wake listener after a short pause
      if (enabledRef.current) scheduleWakeListener();
    };

    try {
      rec.start();
    } catch {
      inputRef.current = null;
      updateState("idle");
      if (enabledRef.current) scheduleWakeListener();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Wake-word listener ──────────────────────────────────────────────────────

  // Forward declaration so startInputSession can reference it
  // eslint-disable-next-line prefer-const
  let scheduleWakeListener: () => void;

  const startWakeListener = useCallback(() => {
    const SR = getSR();
    if (!SR || !enabledRef.current) return;
    if (wakeStateRef.current !== "idle") return; // don't start if already active

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
        scheduleWakeListener();
      }
    };

    rec.onend = () => {
      wakeRef.current = null;
      // Only auto-restart if still in idle state (not activating/recording)
      if (enabledRef.current && wakeStateRef.current === "idle") {
        scheduleWakeListener();
      }
    };

    try {
      rec.start();
    } catch {
      wakeRef.current = null;
      if (enabledRef.current && wakeStateRef.current === "idle") {
        scheduleWakeListener();
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startInputSession]);

  scheduleWakeListener = useCallback(() => {
    setTimeout(() => {
      if (enabledRef.current && wakeStateRef.current === "idle") {
        startWakeListener();
      }
    }, 400);
  }, [startWakeListener]);

  // ─── Lifecycle: start/stop based on enabled prop ─────────────────────────────

  useEffect(() => {
    if (enabled) {
      updateState("idle");
      startWakeListener();
    } else {
      stopAll();
      updateState("idle");
    }
    return () => {
      stopAll();
    };
  }, [enabled, startWakeListener, stopAll]);

  return { wakeState, permissionError };
}
