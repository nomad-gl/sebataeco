/**
 * useAinaWakeWord  (v3)
 *
 * Always-on wake-word listener for Aina.
 *
 * v3 improvements:
 * - Dual-language parallel listeners: one in ca-ES, one in es-ES.
 *   Both listen simultaneously; whichever detects "Aina" first wins.
 *   Prevents the need to switch the app language to trigger the wake word.
 * - Structured DevTools logging with console.group for easy filtering.
 *   Filter by "[Aina]" in the browser console to see all lifecycle events.
 * - onActivated callback: fires when the wake word is detected, before the
 *   input session starts. Used by AIChatBox to show a confirmation toast.
 * - Shared "activating" flag prevents double-activation race condition when
 *   both parallel listeners detect the wake word at the same time.
 */

import { useCallback, useEffect, useRef, useState } from "react";

export type WakeWordState = "idle" | "activating" | "recording";

export type UseAinaWakeWordOptions = {
  /** Called with the final transcript when the teacher finishes speaking */
  onTranscript: (text: string) => void;
  /**
   * Called immediately when the wake word is detected (before input session).
   * Use this to show a toast or visual confirmation.
   */
  onActivated?: () => void;
  /**
   * App language code ("en" | "es" | "ca").
   * The input session uses this language. The wake listeners always run in
   * both ca-ES and es-ES regardless of this setting.
   */
  lang?: string;
  /** Whether the always-on mode is enabled (default true) */
  enabled?: boolean;
  /**
   * Optional custom wake-word matcher. When provided, replaces the built-in
   * hardcoded `containsWakeWord` function. Use this to inject DB-driven words.
   */
  containsWakeWord?: (transcript: string) => boolean;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getSR = (): (new () => any) | null =>
  (window as any).SpeechRecognition ||
  (window as any).webkitSpeechRecognition ||
  null;

function isMobileBrowser(): boolean {
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

function toBCP47(lang: string | undefined): string {
  if (!lang) return "en-GB";
  const map: Record<string, string> = {
    en: "en-GB",
    es: "es-ES",
    ca: "ca-ES",
  };
  if (lang.includes("-")) return lang;
  return map[lang.toLowerCase()] ?? "en-GB";
}

function containsWakeWord(transcript: string): boolean {
  const t = transcript.toLowerCase().trim();
  // Primary names: Aina, Clara, Nana
  if (/\b(aina|clara|nana|klara)\b/.test(t)) return true;
  // Phonetic near-misses for Aina
  if (/\b(ayna|anna|haina|ina|i na|ay na|ay-na)\b/.test(t)) return true;
  // Phonetic near-misses for Clara
  if (/\b(klara|claro|claro|klara|clarita|klar)\b/.test(t)) return true;
  // Phonetic near-misses for Nana
  if (/\b(nana|nanna|nena|nano)\b/.test(t)) return true;
  // Prefix matches (catches start-of-sentence detections)
  if (/^(aina|ayna|anna|haina|klara|clara|nana|nanna)/.test(t)) return true;
  return false;
}

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
  } catch { /* audio not available */ }
}

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
      osc.onended = () => { ctx.close(); resolve(); };
    } catch { resolve(); }
  });
}

/** Languages to run parallel wake listeners in */
const WAKE_LANGS = ["ca-ES", "es-ES"];

export function useAinaWakeWord({
  onTranscript,
  onActivated,
  lang,
  enabled = true,
  containsWakeWord: customContainsWakeWord,
}: UseAinaWakeWordOptions) {
  const containsWakeWordRef = useRef(customContainsWakeWord ?? containsWakeWord);
  useEffect(() => { containsWakeWordRef.current = customContainsWakeWord ?? containsWakeWord; }, [customContainsWakeWord]);
  const [wakeState, setWakeState] = useState<WakeWordState>("idle");
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);

  // One SpeechRecognition instance per wake language
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wakeRefs = useRef<(any | null)[]>(WAKE_LANGS.map(() => null));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const inputRef = useRef<any>(null);

  const enabledRef = useRef(enabled);
  const onTranscriptRef = useRef(onTranscript);
  const onActivatedRef = useRef(onActivated);
  const wakeStateRef = useRef<WakeWordState>("idle");
  const langRef = useRef(lang);

  // Shared flag: prevents double-activation when both parallel listeners fire
  const activatingRef = useRef(false);

  const backoffMsRef = useRef<number>(isMobileBrowser() ? 1500 : 200);
  const sessionStartTimesRef = useRef<number[]>(WAKE_LANGS.map(() => 0));
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleWakeListenerRef = useRef<() => void>(() => {});

  useEffect(() => { enabledRef.current = enabled; }, [enabled]);
  useEffect(() => { onTranscriptRef.current = onTranscript; }, [onTranscript]);
  useEffect(() => { onActivatedRef.current = onActivated; }, [onActivated]);
  useEffect(() => { langRef.current = lang; }, [lang]);

  const updateState = useCallback((s: WakeWordState) => {
    wakeStateRef.current = s;
    setWakeState(s);
  }, []);

  // ─── Stop all sessions ───────────────────────────────────────────────────────

  const stopAll = useCallback(() => {
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    wakeRefs.current.forEach((rec, i) => {
      if (rec) {
        try { rec.abort(); } catch { /* ignore */ }
        wakeRefs.current[i] = null;
      }
    });
    if (inputRef.current) {
      try { inputRef.current.abort(); } catch { /* ignore */ }
      inputRef.current = null;
    }
    activatingRef.current = false;
    setIsListening(false);
  }, []);

  // ─── Input recording session ─────────────────────────────────────────────────

  const startInputSession = useCallback(() => {
    const SR = getSR();
    if (!SR) return;

    updateState("recording");
    setIsListening(true);

    console.group("[Aina] Input session started");
    console.log("Language:", toBCP47(langRef.current));
    console.groupEnd();

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
      console.log("[Aina] Input interim:", finalTranscript);
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onerror = (e: any) => {
      console.warn("[Aina] Input session error:", e.error);
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        setPermissionError("Microphone access denied. Please allow microphone access in your browser settings.");
      }
      inputRef.current = null;
      setIsListening(false);
      activatingRef.current = false;
      updateState("idle");
      if (enabledRef.current) scheduleWakeListenerRef.current();
    };

    rec.onend = () => {
      inputRef.current = null;
      setIsListening(false);
      activatingRef.current = false;
      if (finalTranscript.trim()) {
        console.group("[Aina] Input session complete");
        console.log("Transcript:", finalTranscript.trim());
        console.groupEnd();
        onTranscriptRef.current(finalTranscript.trim());
        backoffMsRef.current = isMobileBrowser() ? 1500 : 200;
      } else {
        console.log("[Aina] Input session ended with no speech — playing timeout tone");
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
      activatingRef.current = false;
      updateState("idle");
      if (enabledRef.current) scheduleWakeListenerRef.current();
    }
  }, [updateState]);

  // ─── Wake-word listener factory ──────────────────────────────────────────────

  const startWakeListeners = useCallback(() => {
    const SR = getSR();
    if (!SR || !enabledRef.current) return;
    if (wakeStateRef.current !== "idle") return;
    // Don't start if any listener is already running
    if (wakeRefs.current.some(r => r !== null)) return;
    if (document.visibilityState === "hidden") return;

    activatingRef.current = false;

    console.group("[Aina] Starting parallel wake listeners");
    console.log("Languages:", WAKE_LANGS.join(", "));
    console.log("Backoff:", backoffMsRef.current, "ms");
    console.groupEnd();

    WAKE_LANGS.forEach((wakeLang, idx) => {
      sessionStartTimesRef.current[idx] = Date.now();

      const rec = new SR();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = wakeLang;
      wakeRefs.current[idx] = rec;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rec.onresult = (e: any) => {
        if (wakeStateRef.current !== "idle") return;
        if (activatingRef.current) return; // another listener already won

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const transcript = Array.from(e.results as any[])
          .map((r: any) => r[0].transcript as string)
          .join(" ");

        if (containsWakeWordRef.current(transcript)) {
          activatingRef.current = true; // claim the activation slot

          console.group("[Aina] Wake word detected!");
          console.log("Listener language:", wakeLang);
          console.log("Raw transcript:", transcript);
          console.groupEnd();

          updateState("activating");

          // Stop all parallel listeners
          wakeRefs.current.forEach((r, i) => {
            if (r) {
              try { r.abort(); } catch { /* ignore */ }
              wakeRefs.current[i] = null;
            }
          });
          setIsListening(false);
          backoffMsRef.current = isMobileBrowser() ? 1500 : 200;

          // Fire the onActivated callback (for toast)
          try { onActivatedRef.current?.(); } catch { /* ignore */ }

          playBeep().then(() => {
            setTimeout(() => {
              if (enabledRef.current) startInputSession();
            }, 300);
          });
        }
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rec.onerror = (e: any) => {
        console.warn(`[Aina] Wake listener (${wakeLang}) error:`, e.error);
        wakeRefs.current[idx] = null;

        if (e.error === "not-allowed" || e.error === "service-not-allowed") {
          setPermissionError("Microphone access denied. Please allow microphone access in your browser settings.");
          // Stop all other listeners too
          wakeRefs.current.forEach((r, i) => {
            if (r) { try { r.abort(); } catch { /* ignore */ } wakeRefs.current[i] = null; }
          });
          setIsListening(false);
          return;
        }

        // If all listeners have errored, schedule a restart
        if (wakeRefs.current.every(r => r === null) && enabledRef.current && wakeStateRef.current === "idle") {
          if (isMobileBrowser()) {
            backoffMsRef.current = Math.min(backoffMsRef.current * 1.5, 8000);
          }
          scheduleWakeListenerRef.current();
        }
      };

      rec.onend = () => {
        wakeRefs.current[idx] = null;
        const sessionDuration = Date.now() - sessionStartTimesRef.current[idx];
        console.log(`[Aina] Wake listener (${wakeLang}) ended after ${sessionDuration}ms`);

        if (isMobileBrowser() && sessionDuration < 2000) {
          backoffMsRef.current = Math.min(backoffMsRef.current * 1.5, 8000);
        } else if (sessionDuration > 5000) {
          backoffMsRef.current = isMobileBrowser() ? 1500 : 200;
        }

        // If all listeners have ended and we're still idle, schedule restart
        if (wakeRefs.current.every(r => r === null) && enabledRef.current && wakeStateRef.current === "idle" && !activatingRef.current) {
          scheduleWakeListenerRef.current();
        }
      };

      try {
        rec.start();
        console.log(`[Aina] Wake listener (${wakeLang}) started`);
      } catch (err) {
        console.warn(`[Aina] Wake listener (${wakeLang}) start failed:`, err);
        wakeRefs.current[idx] = null;
        if (wakeRefs.current.every(r => r === null) && enabledRef.current && wakeStateRef.current === "idle") {
          scheduleWakeListenerRef.current();
        }
      }
    });

    // Update isListening if at least one listener started
    if (wakeRefs.current.some(r => r !== null)) {
      setIsListening(true);
    }
  }, [startInputSession, updateState]);

  // Keep scheduleWakeListenerRef current
  useEffect(() => {
    scheduleWakeListenerRef.current = () => {
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
      restartTimerRef.current = setTimeout(() => {
        restartTimerRef.current = null;
        if (enabledRef.current && wakeStateRef.current === "idle") {
          startWakeListeners();
        }
      }, backoffMsRef.current);
    };
  }, [startWakeListeners]);

  // ─── Pause when page is hidden ───────────────────────────────────────────────

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        console.log("[Aina] Page hidden — pausing wake listeners");
        wakeRefs.current.forEach((r, i) => {
          if (r) { try { r.abort(); } catch { /* ignore */ } wakeRefs.current[i] = null; }
        });
        if (restartTimerRef.current) { clearTimeout(restartTimerRef.current); restartTimerRef.current = null; }
        setIsListening(false);
      } else if (document.visibilityState === "visible" && enabledRef.current && wakeStateRef.current === "idle") {
        console.log("[Aina] Page visible — resuming wake listeners");
        restartTimerRef.current = setTimeout(() => {
          restartTimerRef.current = null;
          if (enabledRef.current && wakeStateRef.current === "idle") startWakeListeners();
        }, 500);
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [startWakeListeners]);

  // ─── Lifecycle ───────────────────────────────────────────────────────────────

  useEffect(() => {
    if (enabled) {
      updateState("idle");
      const t = setTimeout(() => startWakeListeners(), 300);
      return () => { clearTimeout(t); stopAll(); };
    } else {
      stopAll();
      updateState("idle");
      return () => { stopAll(); };
    }
  }, [enabled, startWakeListeners, stopAll, updateState]);

  const requestPermission = useCallback(async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      setPermissionError(null);
      stopAll();
      updateState("idle");
      setTimeout(() => startWakeListeners(), 100);
    } catch {
      setPermissionError("Microphone access denied. Please allow microphone access in your browser settings.");
    }
  }, [startWakeListeners, stopAll, updateState]);

  /** Call this after TTS finishes to ensure wake listeners restart promptly */
  const forceRestart = useCallback(() => {
    if (!enabledRef.current) return;
    // Only restart if we're idle and no listeners are running
    if (wakeStateRef.current !== "idle") return;
    if (wakeRefs.current.some(r => r !== null)) return;
    // Clear any pending restart timer and schedule a fresh one with minimal delay
    if (restartTimerRef.current) { clearTimeout(restartTimerRef.current); restartTimerRef.current = null; }
    restartTimerRef.current = setTimeout(() => {
      restartTimerRef.current = null;
      if (enabledRef.current && wakeStateRef.current === "idle") startWakeListeners();
    }, 300);
  }, [startWakeListeners]);

  return { wakeState, permissionError, isListening, requestPermission, forceRestart };
}
